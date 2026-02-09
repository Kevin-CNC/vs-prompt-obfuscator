import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class mainUIProvider {
    public static show(context: vscode.ExtensionContext) {
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

        try {
            // Load the built Vue app HTML
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
