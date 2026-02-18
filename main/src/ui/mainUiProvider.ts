import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../utils/ConfigManager';

export class mainUIProvider {
    private static currentPanel: vscode.WebviewPanel | undefined;

    public static show(context: vscode.ExtensionContext, configManager?: ConfigManager) {
        // If a panel already exists, just reveal it
        if (mainUIProvider.currentPanel) {
            mainUIProvider.currentPanel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'PromptHider',
            'Prompt Hider: Main',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview'))
                ]
            }
        );

        mainUIProvider.currentPanel = panel;

        panel.onDidDispose(() => {
            mainUIProvider.currentPanel = undefined;
        });

        // ---- Handle messages from the webview ----
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'ready': {
                    if (!configManager) { break; }
                    const config = await configManager.loadFullConfig();
                    const name = configManager.getRulesheetName();
                    panel.webview.postMessage({
                        command: 'init',
                        rulesheetName: name,
                        rules: (config?.rules ?? []).map(r => ({
                            id: r.id,
                            pattern: typeof r.pattern === 'string' ? r.pattern : r.pattern.source,
                            replacement: r.replacement,
                        })),
                        enabled: config?.enabled ?? false,
                    });
                    break;
                }

                case 'saveRules': {
                    if (!configManager) { break; }
                    const rules = (message.rules as any[]).map(r => ({
                        id: r.id as string,
                        type: 'custom' as const,
                        pattern: r.pattern as string,
                        replacement: r.replacement as string,
                        enabled: true,
                        description: `Custom rule: ${r.pattern} → ${r.replacement}`,
                    }));
                    await configManager.saveProjectRules(rules);
                    panel.webview.postMessage({ command: 'rulesSaved' });
                    break;
                }

                case 'toggleEnabled': {
                    if (!configManager) { break; }
                    await configManager.setEnabled(message.enabled as boolean);
                    panel.webview.postMessage({
                        command: 'enabledUpdated',
                        enabled: message.enabled,
                    });
                    break;
                }
            }
        });

        // ---- Load the built Vue app ----
        try {
            const distPath = path.join(context.extensionPath, 'dist', 'webview', 'index.html');

            if (!fs.existsSync(distPath)) {
                vscode.window.showErrorMessage(
                    `Webview assets not found at ${distPath}. Run 'npm run webview:build' first.`
                );
                return;
            }

            let html = fs.readFileSync(distPath, 'utf8');

            // Transform asset URLs to use vscode-resource:// scheme
            const distDir = path.join(context.extensionPath, 'dist', 'webview');
            html = html.replace(/(?:src|href)="\/([^"]+)"/g, (match, file) => {
                const resourceUri = vscode.Uri.file(path.join(distDir, file));
                const webviewUri = panel.webview.asWebviewUri(resourceUri);
                const attrName = match.startsWith('src=') ? 'src' : 'href';
                return `${attrName}="${webviewUri}"`;
            });

            panel.webview.html = html;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load webview: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
