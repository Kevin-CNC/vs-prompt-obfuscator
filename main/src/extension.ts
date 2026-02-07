import * as vscode from 'vscode';
import * as path from 'path';
import { AnonymizationEngine } from './anonymizer/AnonymizationEngine';
import { TokenManager } from './anonymizer/TokenManager';
import { ConfigManager } from './utils/ConfigManager';
import { window } from 'vscode';
import * as fs from 'fs';

// TODO: Import UI providers when ready
// import { RuleEditorProvider } from './ui/RuleEditorProvider';
// import { MappingsViewProvider } from './ui/MappingsViewProvider';

function randomStringGen(size: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < size; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function updateDevFiles(rulesheetPath: string, fileName: string) {
    // currently targets .gitignore & .copilotignore

    // get current workspace folder path
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;
    const workspacePath = workspaceFolders[0].uri.fsPath;

    // find the files & update them
    const gitIgnore = path.join(workspacePath, '.gitignore');
    const copilotIgnore = path.join(workspacePath, '.copilotignore');

    for (const ignoreFile of [gitIgnore, copilotIgnore]) {
        // Only update if file exists; does NOT create if missing.6
        if (fs.existsSync(ignoreFile)) {
            const cnt = fs.readFileSync(ignoreFile, 'utf8');
            if (!cnt.includes(rulesheetPath)) {
                fs.appendFileSync(ignoreFile, rulesheetPath + '\n');
            } else {
                fs.writeFileSync(ignoreFile, `${fileName}\n`);
            }
        }
        // If file does not exist, nothing happens!
    }

    vscode.window.showInformationMessage(`Rulesheet added to dev files.`);
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('The prompt hider is online.');
    let selectedFile:vscode.Uri | undefined = undefined;

    // will check if a file already exists in the folder and if so, directly load that one
    const prmptHidFiles = await vscode.workspace.findFiles('**/*.prompthider.json');

    if ( prmptHidFiles.length == 1 ){ // one -> load it
        selectedFile = prmptHidFiles[0];
        vscode.window.showInformationMessage(`Rulesheet found: ${path.basename(selectedFile.fsPath)}. Loading it for the session.`);



    }else if ( prmptHidFiles.length > 1 ){ // multiple -> choose one
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
        }else{
            // default to the first file found
            selectedFile = prmptHidFiles[0];
            vscode.window.showInformationMessage(`No file picked, defaulting to the first one found: ${path.basename(selectedFile.fsPath)}.`);
        }

    }else if ( prmptHidFiles.length === 0 ){ // none -> create one
        console.log("No rule files found, creating a new one with default name.")

        let givenName = await window.showInputBox({
            placeHolder: 'Enter your rule file name (Else press enter for default name).'
        });

        if ( givenName == undefined )  { givenName = `default-${randomStringGen(5)}` } // assign 'default' if no name is given

        const workspaceFldrs = vscode.workspace.workspaceFolders;692
        if ( workspaceFldrs && workspaceFldrs.length > 0 ){
            const workspaceUri = workspaceFldrs[0].uri;

            const newFPath = path.join(workspaceUri.fsPath,  `${givenName}.prompthider.json`);
            selectedFile = vscode.Uri.file(newFPath);

            // actually creating the file
            const content = Buffer.from('{}', 'utf8');
            await vscode.workspace.fs.writeFile(selectedFile, content);

            vscode.window.showInformationMessage(`Created rule file: ${path.basename(selectedFile.fsPath)} !`);

            updateDevFiles(`/${path.basename(selectedFile.fsPath)}`, selectedFile.fsPath);
        }
    }

        


    const tokenManager = new TokenManager(context);
    const configs = new ConfigManager(selectedFile);
    const anonymizationEngine = new AnonymizationEngine(tokenManager, configs);

    // TODO: Register UI providers (webviews, tree views, etc.)

    // TODO: Register commands

    // Anonymize command toggle;
    // Informs the user if their prompts will be anonymized or not.
    // Switch toggle functionality.
    let anonSwitch = false;
    const anonymizeCommand = vscode.commands.registerCommand(
        'prompthider.anonymize',
        async () => {
            anonSwitch = !anonSwitch;

            vscode.window.showInformationMessage(`Anonymize prompts set to: ${anonSwitch}`);
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

