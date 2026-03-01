import * as vscode from 'vscode';
import * as path from 'path';
import { AnonymizationEngine } from './anonymizer/AnonymizationEngine';
import { TokenManager } from './anonymizer/TokenManager';
import { ConfigManager } from './utils/ConfigManager';
import { mainUIProvider } from './ui/mainUiProvider';
import { RuleEditorProvider } from './ui/RuleEditorProvider';
import { MappingsViewProvider } from './ui/MappingsViewProvider';
import { CommandExecutor } from './tools/CommandExecutor';
import { ScpTransferTool } from './tools/ScpTransferTool';
import { IacScanner } from './scanner/IacScanner';
import * as fs from 'fs';

// Module-level reference for cleanup in deactivate().
let commandExecutorInstance: CommandExecutor | undefined;

function updateDevFiles(rulesheetRelativePath: string) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;
    const workspacePath = workspaceFolders[0].uri.fsPath;

    const ignoreFiles = [
        path.join(workspacePath, '.gitignore'),
        path.join(workspacePath, '.copilotignore')
    ];

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
    const prmptHidFiles = await vscode.workspace.findFiles('**/*.prompthider.json');

    if (prmptHidFiles.length === 1) {
        selectedFile = prmptHidFiles[0];
        vscode.window.showInformationMessage(`Rulesheet found: ${path.basename(selectedFile.fsPath)}. Loading it for the session.`);
    } else if (prmptHidFiles.length > 1) {
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
            selectedFile = prmptHidFiles[0];
            vscode.window.showInformationMessage(`No file picked, defaulting to the first one found: ${path.basename(selectedFile.fsPath)}.`);
        }
    } else if (prmptHidFiles.length === 0) {
        let givenName = await vscode.window.showInputBox({
            placeHolder: 'Enter your rule file name (Else press enter for default name).'
        });

        if (givenName === undefined || givenName === '') {
            givenName = 'defaultSheet';
        }

        givenName = givenName.replace(/[/\\:*?"<>|]/g, '_').trim();
        if (!givenName) {
            givenName = 'defaultSheet';
        }

        const workspaceFldrs = vscode.workspace.workspaceFolders;
        if (workspaceFldrs && workspaceFldrs.length > 0) {
            const workspaceUri = workspaceFldrs[0].uri;
            const promptHiderFolder = path.join(workspaceUri.fsPath, '.prompthider');

            if (!fs.existsSync(promptHiderFolder)) {
                fs.mkdirSync(promptHiderFolder, { recursive: true });
            }

            const newFPath = path.join(promptHiderFolder, `${givenName}.prompthider.json`);
            selectedFile = vscode.Uri.file(newFPath);

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

    if (!selectedFile) {
        vscode.window.showErrorMessage('No rulesheet file selected or created.');
        return;
    }


    const tokenManager = new TokenManager(context);
    const configs = new ConfigManager(selectedFile.fsPath);
    const anonymizationEngine = new AnonymizationEngine(tokenManager, configs);
    const commandExecutor = new CommandExecutor(tokenManager);
    commandExecutorInstance = commandExecutor;
    const scpTransferTool = new ScpTransferTool(commandExecutor);

    // Create mappingsViewProvider early so the chat participant can refresh it.
    const mappingsViewProvider = new MappingsViewProvider(tokenManager);

    const toolDisposable = vscode.lm.registerTool('prompthider_execute_command', commandExecutor);
    const scpToolDisposable = vscode.lm.registerTool('prompthider_scp_transfer', scpTransferTool);
    context.subscriptions.push(toolDisposable, scpToolDisposable);

    function getToolDefinitions(): vscode.LanguageModelChatTool[] {
        return vscode.lm.tools
            .filter(t => t.name.startsWith('prompthider_'))
            .map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema ?? {}
            }));
    }

    // Reads each URI-based file reference, anonymizes its content, and returns
    // formatted code-fence strings ready to be appended to a user message.
    async function processFileReferences(
        references: readonly vscode.ChatPromptReference[]
    ): Promise<string[]> {
        const contextParts: string[] = [];
        for (const ref of references) {
            if (ref.value instanceof vscode.Uri) {
                try {
                    const bytes = await vscode.workspace.fs.readFile(ref.value);
                    const content = Buffer.from(bytes).toString('utf8');
                    const anonResult = await anonymizationEngine.anonymize(content);
                    const fileName = path.basename(ref.value.fsPath);
                    contextParts.push(
                        `[Attached file: ${fileName}]\n\`\`\`\n${anonResult.anonymized}\n\`\`\``
                    );
                } catch {
                    // Unreadable file — skip silently
                }
            }
        }
        return contextParts;
    }

    const chatParticipant = vscode.chat.createChatParticipant('prompthider', async (request, chatContext, stream, token) => {
        const userPrompt = request.prompt;
        const result = await anonymizationEngine.anonymize(userPrompt);

        if (result.stats.totalMatches > 0) {
            stream.markdown(`> **PromptHider**: ${result.stats.totalMatches} pattern(s) anonymized before sending.\n\n`);
            mappingsViewProvider.refresh();
        }

        const messages: vscode.LanguageModelChatMessage[] = [];

        for (const turn of chatContext.history) {
            if (turn instanceof vscode.ChatRequestTurn) {
                const histResult = await anonymizationEngine.anonymize(turn.prompt);
                const histFileParts = await processFileReferences(turn.references);
                const histParts = histFileParts.length > 0
                    ? `${histResult.anonymized}\n\n${histFileParts.join('\n\n')}`
                    : histResult.anonymized;
                messages.push(vscode.LanguageModelChatMessage.User(histParts));
            } else if (turn instanceof vscode.ChatResponseTurn) {
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

        // Process any file/script attachments on the current turn
        const fileParts = await processFileReferences(request.references);
        if (fileParts.length > 0) {
            stream.markdown(`> **PromptHider**: ${fileParts.length} file(s) attached and anonymized.\n\n`);
        }

        const currentUserMessage = fileParts.length > 0
            ? `${result.anonymized}\n\n${fileParts.join('\n\n')}`
            : result.anonymized;
        messages.push(vscode.LanguageModelChatMessage.User(currentUserMessage));

        // Inject active token names so the model uses them verbatim
        const activeTokens = tokenManager.getAllMappings();
        if (activeTokens.size > 0) {
            const tokenList = [...new Set(activeTokens.values())].join(', ');
            messages.unshift(
                vscode.LanguageModelChatMessage.User(
                    `[SYSTEM — PromptHider context]\n` +
                    `The following anonymized tokens are currently active: ${tokenList}.\n` +
                    `When referring to these values or using the execute_command tool, use these EXACT token names as they appear above. ` +
                    `Do NOT rename, reformat, or standardize them (e.g. do not change "lxcIP1" to "IP_1").\n` +
                    `Treat them as opaque identifiers.`
                )
            );
        }

        const toolDefs = getToolDefinitions();
        const MAX_TOOL_ROUNDS = 10;
        try {
            let continueLoop = true;
            let iterations = 0;
            while (continueLoop) {
                continueLoop = false;
                iterations++;

                if (iterations > MAX_TOOL_ROUNDS) {
                    stream.markdown('\n\n> **PromptHider**: Reached maximum tool-call rounds. Stopping.\n');
                    break;
                }

                const modelResponse = await request.model.sendRequest(
                    messages,
                    { tools: toolDefs },
                    token
                );

                const assistantParts: (vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart)[] = [];

                for await (const part of modelResponse.stream) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        stream.markdown(part.value);
                        assistantParts.push(part);
                    } else if (part instanceof vscode.LanguageModelToolCallPart) {
                        assistantParts.push(part);
                        continueLoop = true;
                    }
                }

                if (continueLoop && assistantParts.length > 0) {
                    messages.push(vscode.LanguageModelChatMessage.Assistant(assistantParts));
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
        } finally {
            // Always refresh the sidebar so it reflects the latest session mappings.
            mappingsViewProvider.refresh();
        }
    });
    
    context.subscriptions.push(chatParticipant);
    const ruleEditorProvider = new RuleEditorProvider(
        vscode.Uri.file(context.extensionPath),
        configs
    );

    vscode.window.registerTreeDataProvider('prompthider.mappingsView', mappingsViewProvider);
    // Populate the tree immediately with any mappings already in workspaceState
    // (persisted from a previous session against the same rulesheet).
    mappingsViewProvider.refresh();
    vscode.window.registerWebviewViewProvider(RuleEditorProvider.viewType, ruleEditorProvider);

    const openWebUI = vscode.commands.registerCommand(
        'prompthider.openUI',
        () => {
            mainUIProvider.show(context, configs);
        });

    const showMappingsCommand = vscode.commands.registerCommand(
        'prompthider.showMappings',
        () => {
            mappingsViewProvider.refresh();
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

    const scanIacFileCommand = vscode.commands.registerCommand(
        'prompthider.scanIacFile',
        async () => {
            const fileUris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                canSelectFolders: false,
                canSelectFiles: true,
                openLabel: 'Scan for Sensitive Patterns',
                filters: {
                    'Infrastructure as Code': ['tf', 'tfvars', 'yml', 'yaml', 'json'],
                    'All Files': ['*'],
                },
            });

            if (!fileUris || fileUris.length === 0) { return; }

            const filePath = fileUris[0].fsPath;

            try {
                const scannedRules = await IacScanner.scanFile(filePath);

                if (scannedRules.length === 0) {
                    vscode.window.showInformationMessage('No sensitive patterns detected in the selected file.');
                    return;
                }

                // Ensure the main UI panel is open so we can push the rules into it
                mainUIProvider.show(context, configs);

                // Give the webview a moment to initialise if it was just created
                setTimeout(() => {
                    mainUIProvider.postMessage({
                        command: 'scannedRules',
                        rules: scannedRules.map(r => ({
                            id: r.id,
                            pattern: r.pattern,
                            replacement: r.replacement,
                        })),
                        fileName: path.basename(filePath),
                    });
                }, 500);

                vscode.window.showInformationMessage(
                    `Found ${scannedRules.length} potential pattern(s) in ${path.basename(filePath)}. Review and save in the UI.`
                );
            } catch (err) {
                vscode.window.showErrorMessage(
                    `Failed to scan file: ${err instanceof Error ? err.message : 'Unknown error'}`
                );
            }
        }
    );

    context.subscriptions.push(
        openWebUI,
        showMappingsCommand,
        clearMappingsCommand,
        scanIacFileCommand
    );
}

export function deactivate() {
    commandExecutorInstance?.dispose();
    commandExecutorInstance = undefined;
    console.log('VS Prompt Hider deactivated');
}

