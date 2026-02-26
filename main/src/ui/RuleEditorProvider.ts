import * as vscode from 'vscode';
import { ConfigManager } from '../utils/ConfigManager';

function randomStringGen(size: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < size; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export class RuleEditorProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'prompthider.rulesView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _configManager: ConfigManager
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        // TODO: Load built Vue.js app instead of simple HTML
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // TODO: Handle messages from webview
        // - Load rules
        // - Save rules
        // - Initialize config
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const nonce = randomStringGen(12);

        // TODO: Replace with built Vue.js app from webview-ui/dist
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Rule Editor</title>
        </head>
        <body>
            <h3>Rule Editor</h3>
            <p>TODO: Load Vue.js app here</p>
        </body>
        </html>`;
    }
}
