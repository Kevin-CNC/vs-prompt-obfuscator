import * as vscode from 'vscode';
import * as path from 'path';
import { AnonymizationEngine } from './anonymizer/AnonymizationEngine';
import { TokenManager } from './anonymizer/TokenManager';
import { ConfigManager } from './utils/ConfigManager';
import { window } from 'vscode';

// TODO: Import UI providers when ready
// import { RuleEditorProvider } from './ui/RuleEditorProvider';
// import { MappingsViewProvider } from './ui/MappingsViewProvider';

function randomStringGen(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('The prompt hider is online.');
    let selectedFile: vscode.Uri | undefined;

    // will check if a file already exists in the folder and if so, directly load that one
    const prmptHidFiles = await vscode.workspace.findFiles('**/*.prompthider.json');
    if ( prmptHidFiles.length > 0 ){ // multiple -> choose one
        const items = prmptHidFiles.map(file => ({
            label: vscode.workspace.asRelativePath(file),
            description: file.fsPath,
            fileUri: file
        }));

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'Multiple rules files found, please pick the one you want to use for the session.'
        });

        if (picked) {
            selectedFile = picked.fileUri;
        }

    }else if ( prmptHidFiles.length === 0 ){ // none -> create one
        console.log("No rule files found, creating a new one with default name.")

        let givenName = await window.showInputBox({
            placeHolder: 'Enter your rule file name (Else press enter for default name).'
        });

        if ( givenName == undefined )  { givenName = "default" } // assign 'default' if no name is given

        const workspaceFldrs = vscode.workspace.workspaceFolders;
        if ( workspaceFldrs && workspaceFldrs.length > 0 ){
            const workspaceUri = workspaceFldrs[0].uri;

            const newFPath = path.join(workspaceUri.fsPath, `${givenName}.prompthider.json`);
            selectedFile = vscode.Uri.file(newFPath);

            // actually creating the file
            const content = Buffer.from('{}', 'utf8');
            await vscode.workspace.fs.writeFile(selectedFile, content);

            vscode.window.showInformationMessage(`Created rule file: ${path.basename(selectedFile.fsPath)} !`);
        }

        



    const tokenManager = new TokenManager(context);
    const configs = new ConfigManager(userResponse);
    const anonymizationEngine = new AnonymizationEngine(tokenManager, configs);

    // TODO: Register UI providers (webviews, tree views, etc.)

    // TODO: Register commands
    const anonymizeCommand = vscode.commands.registerCommand(
        'prompthider.anonymize',
        async () => {
            // TODO: Implement anonymization logic
            vscode.window.showInformationMessage('Anonymize command triggered!');
        }
    );

    const openRuleEditorCommand = vscode.commands.registerCommand(
        'prompthider.openRuleEditor',
        () => {
            // TODO: Open rule editor webview
            vscode.window.showInformationMessage('Opening rule editor...');
        }
    );

    // TODO: Add more commands (showMappings, toggleAnonymization, clearMappings)

    // TODO: Create status bar item

    // TODO: Listen for configuration changes

    context.subscriptions.push(
        anonymizeCommand,
        openRuleEditorCommand
    );
}

export function deactivate() {
    console.log('VS Prompt Hider deactivated');
}
