import * as vscode from 'vscode';
import { CommandExecutor } from './CommandExecutor';

// ── Input schema (mirrors package.json declaration) ──────

export interface ScpTransferInput {
    /** Source path — local or remote (user@HOST_TOKEN:/path). */
    source: string;
    /** Destination path — local or remote (user@HOST_TOKEN:/path). */
    destination: string;
    /** Copy directories recursively (-r flag). */
    recursive?: boolean;
}

// ── Tool implementation ──────────────────────────────────

/**
 * LanguageModelTool for SCP file transfers.
 *
 * Delegates the actual execution to {@link CommandExecutor.executeCommand} so
 * that the full anonymization round-trip (de-anonymize command → execute →
 * re-anonymize output) is applied transparently. SSH ControlMaster session
 * reuse, adaptive timeouts, and BatchMode are handled by the executor's
 * `prepareForCapture()` path for SCP commands.
 */
export class ScpTransferTool implements vscode.LanguageModelTool<ScpTransferInput> {
    constructor(private readonly commandExecutor: CommandExecutor) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ScpTransferInput>,
        cancellationToken: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const { source, destination, recursive } = options.input;

        if (!source || !destination) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    'Error: both `source` and `destination` are required.'
                )
            ]);
        }

        // Build the SCP command string — tokens (IP_1, FILE_PATH_1, …) are
        // left as-is; executeCommand() will de-anonymize them before spawning.
        const flags = recursive ? '-r ' : '';
        const scpCommand = `scp ${flags}${source} ${destination}`;

        console.log('[ScpTransferTool] SCP command (anonymized):', scpCommand);

        try {
            const { exitCode, safeStdout, safeStderr, mode } =
                await this.commandExecutor.executeCommand(
                    scpCommand,
                    cancellationToken
                );

            if (mode === 'terminal') {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        'SCP command sent to the PromptHider terminal for interactive/background execution. No captured transfer output is available in terminal mode.'
                    )
                ]);
            }

            if (exitCode === 0) {
                const parts = [
                    `Transfer successful.`,
                    safeStdout ? `\nOutput:\n${safeStdout}` : '',
                    safeStderr ? `\nWarnings:\n${safeStderr}` : '',
                ];
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(parts.join(''))
                ]);
            } else {
                const parts = [
                    `Transfer failed (exit code ${exitCode}).`,
                    safeStderr ? `\nErrors:\n${safeStderr}` : '',
                    safeStdout ? `\nOutput:\n${safeStdout}` : '',
                ];
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(parts.join(''))
                ]);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Transfer error: ${msg}`)
            ]);
        }
    }
}
