import * as vscode from 'vscode';
import * as path from 'path';
import { AnonymizationEngine } from './anonymizer/AnonymizationEngine';
import { TokenManager } from './anonymizer/TokenManager';
import { ConfigManager } from './utils/ConfigManager';
import { window } from 'vscode';
import { mainUIProvider } from './ui/mainUiProvider';
import { RuleEditorProvider } from './ui/RuleEditorProvider';
import { MappingsViewProvider } from './ui/MappingsViewProvider';
import * as fs from 'fs';

function updateDevFiles(rulesheetRelativePath: string) {
    // for now only target .gitignore and .copilotignore

    // check current workspace folder for files to append the rulesheet to
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;
    const workspacePath = workspaceFolders[0].uri.fsPath;

    // add more files later
    const ignoreFiles = [
        path.join(workspacePath, '.gitignore'),
        path.join(workspacePath, '.copilotignore')
    ];


    // for each file update by appending at the end (only if file exists of course)
    for (const ignoreFile of ignoreFiles) {
        if (fs.existsSync(ignoreFile)) {
            const cnt = fs.readFileSync(ignoreFile, 'utf8');
            if (!cnt.includes(rulesheetRelativePath)) {
                fs.appendFileSync(ignoreFile, `${rulesheetRelativePath}\n`);
            }
        }
    }

    vscode.window.showInformationMessage(`Rulesheet added to dev files.`);
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('The prompt hider is online.');
    let selectedFile: vscode.Uri | undefined = undefined;

    // will check if a file already exists in the folder and if so, directly load that one
    const prmptHidFiles = await vscode.workspace.findFiles('**/*.prompthider.json');

    if (prmptHidFiles.length === 1) { // one -> load it
        selectedFile = prmptHidFiles[0];
        vscode.window.showInformationMessage(`Rulesheet found: ${path.basename(selectedFile.fsPath)}. Loading it for the session.`);
    } else if (prmptHidFiles.length > 1) { // multiple -> choose one
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
        } else {
            // default to the first file found
            selectedFile = prmptHidFiles[0];
            vscode.window.showInformationMessage(`No file picked, defaulting to the first one found: ${path.basename(selectedFile.fsPath)}.`);
        }
    } else if (prmptHidFiles.length === 0) { // none -> create one
        console.log("No rule files found, creating a new one with default name.");
        let givenName = await vscode.window.showInputBox({
            placeHolder: 'Enter your rule file name (Else press enter for default name).'
        });

        if (givenName === undefined || givenName === '') {
            givenName = 'defaultSheet';
        }

        const workspaceFldrs = vscode.workspace.workspaceFolders;
        if (workspaceFldrs && workspaceFldrs.length > 0) {
            const workspaceUri = workspaceFldrs[0].uri;
            const promptHiderFolder = path.join(workspaceUri.fsPath, '.prompthider');

            // Ensure .prompthider folder exists
            if (!fs.existsSync(promptHiderFolder)) {
                fs.mkdirSync(promptHiderFolder, { recursive: true });
            }

            const newFPath = path.join(promptHiderFolder, `${givenName}.prompthider.json`);
            selectedFile = vscode.Uri.file(newFPath);

            // actually creating the file & adding default data
            const defaultData = {
                version: "0",
                enabled: false,
                rules: [],
                tokenConsistency: false,
                autoAnonymize: false,
                showPreview: true
            };
            
            const content = Buffer.from(JSON.stringify(defaultData, null, 4), 'utf8');
            await vscode.workspace.fs.writeFile(selectedFile, content);

            vscode.window.showInformationMessage(`Created rule file: ${path.basename(selectedFile.fsPath)} !`);

            const relPath = path.relative(workspaceUri.fsPath, selectedFile.fsPath).replace(/\\/g, '/');
            updateDevFiles(relPath);
        }
    }

    // Ensure selectedFile is defined before proceeding
    if (!selectedFile) {
        vscode.window.showErrorMessage('No rulesheet file selected or created.');
        return;
    }


    const tokenManager = new TokenManager(context);
    const configs = new ConfigManager(selectedFile.fsPath);
    const anonymizationEngine = new AnonymizationEngine(tokenManager, configs);

    // Create the chat participant
    const chatParticipant = vscode.chat.createChatParticipant('prompthider', async (rqst, context, stream, token) => {
        // The user's prompt to be obfuscated
        const userPrompt = rqst.prompt;
        
        console.log('Intercepted prompt:', userPrompt);

        const result = await anonymizationEngine.anonymize(userPrompt); // Perform the anonymization

        console.log('Anonymized:', result.anonymized);
        console.log('Stats:', result.stats);

        stream.markdown(`**Anonymized Prompt:**\n\`\`\`\n${result.anonymized}\n\`\`\`\n\n**Matched patterns:** ${result.stats.totalMatches}`);
    });
    
    context.subscriptions.push(chatParticipant);

    // Register UI providers
    const mappingsViewProvider = new MappingsViewProvider(tokenManager);
    const ruleEditorProvider = new RuleEditorProvider(
        vscode.Uri.file(context.extensionPath),
        configs
    );

    // Register tree views
    vscode.window.registerTreeDataProvider('prompthider.mappingsView', mappingsViewProvider);
    vscode.window.registerWebviewViewProvider(RuleEditorProvider.viewType, ruleEditorProvider);

    // TODO: Register commands

    // Anonymize command toggle;
    // Informs the user if their prompts will be anonymized or not.
    // Switch toggle functionality.


    // COMMANDS HERE FOR THE EXTENSION
    let anonSwitch = false;
    const anonymizeCommand = vscode.commands.registerCommand(
        'prompthider.anonymize',
        async () => {
            anonSwitch = !anonSwitch;

            vscode.window.showInformationMessage(`Anonymize prompts set to: ${anonSwitch}`);
        }
    );
 

    const openWebUI = vscode.commands.registerCommand(
        'prompthider.openUI',
        () => {
            vscode.window.showInformationMessage('Opening main ui...');
            mainUIProvider.show(context, configs);
        });


    const openRuleEditorCommand = vscode.commands.registerCommand(
        'prompthider.openRuleEditor',
        () => {
            vscode.window.showInformationMessage('Opening rule editor...');
            // The rule editor is already registered as a webview view
            // Users can access it from the sidebar
        }
    );

    const showMappingsCommand = vscode.commands.registerCommand(
        'prompthider.showMappings',
        () => {
            mappingsViewProvider.refresh();
            vscode.window.showInformationMessage('Showing token mappings...');
        }
    );

    const toggleAnonymizationCommand = vscode.commands.registerCommand(
        'prompthider.toggleAnonymization',
        () => {
            anonSwitch = !anonSwitch;
            vscode.window.showInformationMessage(`Auto-anonymization: ${anonSwitch ? 'enabled' : 'disabled'}`);
        }
    );

    const clearMappingsCommand = vscode.commands.registerCommand(
        'prompthider.clearMappings',
        async () => {
            const answer = await vscode.window.showWarningMessage(
                'Are you sure you want to clear all token mappings?',
                'Yes', 'No'
            );
            if (answer === 'Yes') {
                tokenManager.clearMappings();
                mappingsViewProvider.refresh();
                vscode.window.showInformationMessage('Token mappings cleared');
            }
        }
    );

    const createRulesheetCommand = vscode.commands.registerCommand(
        'prompthider.activate',
        async () => {
            vscode.window.showInformationMessage('Creating a new rulesheet...');
            // TODO: Implement rulesheet creation logic
        }
    );

    // TODO: Add more commands (showMappings, toggleAnonymization, clearMappings)

    // TODO: Create status bar item

    // TODO: Listen for configuration changes

    context.subscriptions.push(
        anonymizeCommand,
        openRuleEditorCommand,
        openWebUI,
        showMappingsCommand,
        toggleAnonymizationCommand,
        clearMappingsCommand,
        createRulesheetCommand
    );
}

export function deactivate() {
    console.log('VS Prompt Hider deactivated');
}

