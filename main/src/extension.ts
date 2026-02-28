import * as vscode from 'vscode';
import * as path from 'path';
import { AnonymizationEngine } from './anonymizer/AnonymizationEngine';
import { TokenManager } from './anonymizer/TokenManager';
import { ConfigManager } from './utils/ConfigManager';
import { window } from 'vscode';
import { mainUIProvider } from './ui/mainUiProvider';
import { RuleEditorProvider } from './ui/RuleEditorProvider';
import { MappingsViewProvider } from './ui/MappingsViewProvider';
import { CommandExecutor } from './tools/CommandExecutor';
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
    const commandExecutor = new CommandExecutor(tokenManager);

    // Register the execute_command tool so the LM can invoke it
    const toolDisposable = vscode.lm.registerTool('prompthider_execute_command', commandExecutor);
    context.subscriptions.push(toolDisposable);

    // Build the LanguageModelChatTool descriptor from the registered tool metadata
    function getToolDefinitions(): vscode.LanguageModelChatTool[] {
        return vscode.lm.tools
            .filter(t => t.name === 'prompthider_execute_command')
            .map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema ?? {}
            }));
    }

    // Create the chat participant
    const chatParticipant = vscode.chat.createChatParticipant('prompthider', async (request, chatContext, stream, token) => {
        // Intercept the user's raw prompt
        const userPrompt = request.prompt;
        console.log('[PromptHider] Original prompt:', userPrompt);

        // Anonymize the prompt using the loaded rulesheet
        const result = await anonymizationEngine.anonymize(userPrompt);
        console.log('[PromptHider] Anonymized prompt:', result.anonymized);

        // Notify the user that anonymization ran (only show detail if matches were found)
        if (result.stats.totalMatches > 0) {
            stream.markdown(`> **PromptHider**: ${result.stats.totalMatches} pattern(s) anonymized before sending.\n\n`);
        }

        // Build message history from prior turns so the model has conversational context
        const messages: vscode.LanguageModelChatMessage[] = [];

        for (const turn of chatContext.history) {
            if (turn instanceof vscode.ChatRequestTurn) {
                // Re-anonymize history prompts too so tokens stay consistent
                const histResult = await anonymizationEngine.anonymize(turn.prompt);
                messages.push(vscode.LanguageModelChatMessage.User(histResult.anonymized));
            } else if (turn instanceof vscode.ChatResponseTurn) {
                // Collect plain text from previous assistant responses
                const responseText = turn.response
                    .filter((part): part is vscode.ChatResponseMarkdownPart =>
                        part instanceof vscode.ChatResponseMarkdownPart)
                    .map(part => part.value.value)
                    .join('');
                if (responseText) {
                    messages.push(vscode.LanguageModelChatMessage.Assistant(responseText));
                }
            }
        }

        // Append the current (anonymized) user message
        messages.push(vscode.LanguageModelChatMessage.User(result.anonymized));

        const toolDefs = getToolDefinitions();

        // Agentic tool-calling loop:
        // The model may respond with tool call parts instead of (or alongside) text.
        // We execute each requested tool client-side and feed results back until the
        // model produces a final text-only response.
        try {
            let continueLoop = true;
            while (continueLoop) {
                continueLoop = false;

                const modelResponse = await request.model.sendRequest(
                    messages,
                    { tools: toolDefs },
                    token
                );

                // Collect parts so we can build the assistant history entry
                const assistantParts: (vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart)[] = [];

                for await (const part of modelResponse.stream) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        stream.markdown(part.value);
                        assistantParts.push(part);
                    } else if (part instanceof vscode.LanguageModelToolCallPart) {
                        // Model wants to execute a command — do not stream; handle below
                        assistantParts.push(part);
                        continueLoop = true;
                    }
                }

                if (continueLoop && assistantParts.length > 0) {
                    // Record the assistant's turn (with tool call parts) in message history
                    messages.push(vscode.LanguageModelChatMessage.Assistant(assistantParts));

                    // Invoke each requested tool and accumulate results
                    const toolResultParts: vscode.LanguageModelToolResultPart[] = [];

                    for (const part of assistantParts) {
                        if (part instanceof vscode.LanguageModelToolCallPart) {
                            console.log(`[PromptHider] Tool call: ${part.name}`, part.input);

                            const toolResult = await vscode.lm.invokeTool(
                                part.name,
                                {
                                    input: part.input,
                                    toolInvocationToken: request.toolInvocationToken
                                },
                                token
                            );

                            toolResultParts.push(
                                new vscode.LanguageModelToolResultPart(part.callId, toolResult.content)
                            );
                        }
                    }

                    // Append tool results as a User turn so the model can continue
                    messages.push(vscode.LanguageModelChatMessage.User(toolResultParts));
                }
            }
        } catch (err) {
            if (err instanceof vscode.LanguageModelError) {
                console.error('[PromptHider] LM error:', err.message, err.code);
                stream.markdown(`**PromptHider error**: ${err.message}`);
            } else {
                throw err;
            }
        }
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

