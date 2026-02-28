import * as vscode from 'vscode';
import * as cp from 'child_process';
import { TokenManager } from '../anonymizer/TokenManager';

export interface CommandInput {
    command: string;
}

interface ExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export class CommandExecutor implements vscode.LanguageModelTool<CommandInput> {
    private terminal: vscode.Terminal | undefined;
    private static readonly TIMEOUT_MS = 30_000;
    private static readonly MAX_BUFFER = 512 * 1024;

    constructor(private readonly tokenManager: TokenManager) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<CommandInput>,
        cancellationToken: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const rawCommand = options.input.command?.trim();

        if (!rawCommand) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('Error: no command was provided.')
            ]);
        }

        const realCommand = this.deAnonymize(rawCommand);
        console.log('[CommandExecutor] Executing (de-anonymized):', realCommand);

        this.ensureTerminal();
        this.terminal!.show(true);
        this.terminal!.sendText(realCommand, true);

        let result: ExecutionResult;
        try {
            result = await this.capture(realCommand, cancellationToken);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Execution error: ${msg}`)
            ]);
        }

        const safeStdout = this.reAnonymize(result.stdout);
        const safeStderr = this.reAnonymize(result.stderr);

        const summary = [
            `Exit code: ${result.exitCode}`,
            safeStdout ? `\nOutput:\n${safeStdout}` : '',
            safeStderr ? `\nErrors:\n${safeStderr}` : ''
        ].join('');

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(summary)
        ]);
    }

    private ensureTerminal(): void {
        if (!this.terminal || this.terminal.exitStatus !== undefined) {
            this.terminal = vscode.window.createTerminal('PromptHider');
        }
    }

    /**
     * Prepare a command for non-interactive execution.
     * SSH commands get `-T -o BatchMode=yes` so they fail fast on
     * host-key / password prompts instead of hanging without a PTY.
     */
    private prepareForCapture(command: string): string {
        const trimmed = command.trimStart();

        // Match `ssh` at the start, optionally preceded by env vars (VAR=val)
        if (/^(?:\S+=\S+\s+)*ssh\s/i.test(trimmed)) {
            return trimmed.replace(
                /^((?:\S+=\S+\s+)*ssh)\s/i,
                '$1 -T -o BatchMode=yes '
            );
        }

        return command;
    }

    private capture(
        command: string,
        cancellationToken: vscode.CancellationToken
    ): Promise<ExecutionResult> {
        const prepared = this.prepareForCapture(command);

        return new Promise((resolve, reject) => {
            const proc = cp.exec(
                prepared,
                { timeout: CommandExecutor.TIMEOUT_MS, maxBuffer: CommandExecutor.MAX_BUFFER },
                (error, stdout, stderr) => {
                    resolve({
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        exitCode: error?.code ?? (error ? 1 : 0)
                    });
                }
            );

            proc.stdin?.end();

            const cancelDisposable = cancellationToken.onCancellationRequested(() => {
                proc.kill();
                cancelDisposable.dispose();
                reject(new Error('Command cancelled.'));
            });

            proc.on('error', (err) => {
                cancelDisposable.dispose();
                reject(err);
            });
        });
    }

    /** Replace anonymized tokens with real values (longest-first). */
    deAnonymize(text: string): string {
        const reverse = this.tokenManager.getReverseMappings();
        const sorted = [...reverse.keys()].sort((a, b) => b.length - a.length);

        let result = text;
        for (const token of sorted) {
            const original = reverse.get(token)!;
            result = result.replace(new RegExp(this.escapeRegex(token), 'g'), original);
        }
        return result;
    }

    /** Replace real values with tokens in command output before returning to model. */
    private reAnonymize(text: string): string {
        if (!text) { return text; }

        const forward = this.tokenManager.getAllMappings();
        const sorted = [...forward.keys()].sort((a, b) => b.length - a.length);

        let result = text;
        for (const original of sorted) {
            const token = forward.get(original)!;
            result = result.replace(new RegExp(this.escapeRegex(original), 'g'), token);
        }
        return result;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
