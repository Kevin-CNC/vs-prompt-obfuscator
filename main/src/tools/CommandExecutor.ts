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
    /** Dedicated terminal for user-visible mirroring; recreated on close. */
    private terminal: vscode.Terminal | undefined;

    /** Maximum time (ms) to wait for a command before aborting. */
    private static readonly TIMEOUT_MS = 30_000;

    /** Maximum stdout+stderr buffer (bytes). */
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

        // 1. De-anonymize: resolve tokens to real values client-side
        const realCommand = this.deAnonymize(rawCommand);
        console.log('[CommandExecutor] Executing (de-anonymized):', realCommand);

        // 2. Mirror to terminal so the user can see what ran
        this.ensureTerminal();
        this.terminal!.show(true); // preserves chat panel focus
        this.terminal!.sendText(realCommand, true);

        // 3. Capture output via child_process
        let result: ExecutionResult;
        try {
            result = await this.capture(realCommand, cancellationToken);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Execution error: ${msg}`)
            ]);
        }

        // 4. Re-anonymize stdout/stderr — real values must never reach the model
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

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    private ensureTerminal(): void {
        if (!this.terminal || this.terminal.exitStatus !== undefined) {
            this.terminal = vscode.window.createTerminal('PromptHider');
        }
    }

    /**
     * Spawn a child process, capture its stdout/stderr, and resolve when done.
     * Respects VS Code's CancellationToken — kills the process on cancellation.
     */
    private capture(
        command: string,
        cancellationToken: vscode.CancellationToken
    ): Promise<ExecutionResult> {
        return new Promise((resolve, reject) => {
            const proc = cp.exec(
                command,
                { timeout: CommandExecutor.TIMEOUT_MS, maxBuffer: CommandExecutor.MAX_BUFFER },
                (error, stdout, stderr) => {
                    resolve({
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        exitCode: error?.code ?? (error ? 1 : 0)
                    });
                }
            );

            // Honour cancellation (e.g. user stops the chat participant)
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

    /**
     * Replace all anonymized tokens in `text` with their real originals.
     * Tokens are sorted longest-first to prevent prefix collisions
     * (e.g. IP_10 must be replaced before IP_1).
     */
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

    /**
     * Replace all real values in `text` with their anonymized tokens.
     * Applied to command output before it is returned to the model,
     * ensuring real values never leave the extension host.
     * Originals are sorted longest-first for the same prefix-collision reason.
     */
    private reAnonymize(text: string): string {
        if (!text) { return text; }

        const forward = this.tokenManager.getAllMappings(); // original → token
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
