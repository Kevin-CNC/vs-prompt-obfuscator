import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../utils/ConfigManager';
import { validateRules } from '../anonymizer/RuleValidator';

export class mainUIProvider {
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static onConfigChanged?: () => void;
    private static activeConfigManager?: ConfigManager;

    /**
     * Post an arbitrary message to the webview, if it exists.
     * Used by commands (e.g. IaC scan) to push data into the Vue app.
     */
    public static postMessage(message: unknown): void {
        if (mainUIProvider.currentPanel) {
            mainUIProvider.currentPanel.webview.postMessage(message);
        }
    }

    public static refreshCurrentPanel(): void {
        if (mainUIProvider.currentPanel && mainUIProvider.activeConfigManager) {
            void mainUIProvider.postInit(mainUIProvider.currentPanel.webview, mainUIProvider.activeConfigManager);
        }
    }

    public static show(context: vscode.ExtensionContext, configManager?: ConfigManager, onConfigChanged?: () => void) {
        if (onConfigChanged) {
            mainUIProvider.onConfigChanged = onConfigChanged;
        }

        if (configManager) {
            mainUIProvider.activeConfigManager = configManager;
        }

        // If a panel already exists, just reveal it
        if (mainUIProvider.currentPanel) {
            mainUIProvider.currentPanel.reveal(vscode.ViewColumn.One);
            if (mainUIProvider.activeConfigManager) {
                void mainUIProvider.postInit(mainUIProvider.currentPanel.webview, mainUIProvider.activeConfigManager);
            }
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'PromptHider',
            'Prompt Hider: Main',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview')),
                    vscode.Uri.file(path.join(context.extensionPath, 'node_modules', '@vscode', 'codicons', 'dist'))
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
                    if (!mainUIProvider.activeConfigManager) { break; }
                    await mainUIProvider.postInit(panel.webview, mainUIProvider.activeConfigManager);
                    break;
                }

                case 'saveRules': {
                    const activeConfig = mainUIProvider.activeConfigManager;
                    if (!activeConfig) { break; }
                    const rules = mainUIProvider.normalizeRules(message.rules as any[]);

                    const validation = validateRules(rules);
                    if (!validation.valid) {
                        panel.webview.postMessage({
                            command: 'ruleValidation',
                            level: 'error',
                            source: 'saveRules',
                            messages: validation.errors,
                        });
                        vscode.window.showErrorMessage('Rule validation failed. Fix invalid regex or replacement values before saving.');
                        break;
                    }

                    if (validation.warnings.length > 0) {
                        panel.webview.postMessage({
                            command: 'ruleValidation',
                            level: 'warning',
                            source: 'saveRules',
                            messages: validation.warnings,
                        });

                        const answer = await vscode.window.showWarningMessage(
                            `Rule warnings detected (${validation.warnings.length}). Save anyway?`,
                            { modal: true },
                            'Save Anyway',
                            'Cancel'
                        );

                        if (answer !== 'Save Anyway') {
                            break;
                        }
                    }

                    await activeConfig.saveProjectRules(rules);
                    mainUIProvider.onConfigChanged?.();
                    panel.webview.postMessage({ command: 'rulesSaved', ruleIds: rules.map(r => r.id) });
                    break;
                }

                case 'saveSingleRule': {
                    const activeConfig = mainUIProvider.activeConfigManager;
                    if (!activeConfig) { break; }
                    const ruleCarried = message.rule as { id: string; pattern: string; replacement: string };

                    // Load current rules from disk
                    const loadedProject = await activeConfig.loadFullConfig();
                    const currentRules = Array.isArray(loadedProject?.rules) ? loadedProject.rules : [];
                    const ruleExistsIndx = currentRules.findIndex(r => r.id === ruleCarried.id);
                    
                    // Create a normalized rule object (matching the structure ConfigManager expects)
                    const normalizedRule = {
                        id: ruleCarried.id,
                        type: 'custom' as const,
                        pattern: ruleCarried.pattern,  // ConfigManager will convert this to RegExp internally
                        replacement: ruleCarried.replacement,
                        enabled: true,
                        description: `Custom rule: ${ruleCarried.pattern} → ${ruleCarried.replacement}`,
                    };

                    if (ruleExistsIndx !== -1) {
                        // Update the single rule if it already exists
                        currentRules[ruleExistsIndx] = normalizedRule;
                        console.log("Updating existing rule:", normalizedRule);
                    } else {
                        // OR Add it to the file
                        currentRules.push(normalizedRule);
                        console.log("Adding new rule:", normalizedRule);
                    }

                    const validation = validateRules(currentRules);
                    if (!validation.valid) {
                        panel.webview.postMessage({
                            command: 'ruleValidation',
                            level: 'error',
                            source: 'saveSingleRule',
                            messages: validation.errors,
                        });
                        vscode.window.showErrorMessage('Rule validation failed. Fix invalid regex or replacement values before saving.');
                        break;
                    }

                    if (validation.warnings.length > 0) {
                        panel.webview.postMessage({
                            command: 'ruleValidation',
                            level: 'warning',
                            source: 'saveSingleRule',
                            messages: validation.warnings,
                        });

                        const answer = await vscode.window.showWarningMessage(
                            `Rule warnings detected (${validation.warnings.length}). Save anyway?`,
                            { modal: true },
                            'Save Anyway',
                            'Cancel'
                        );

                        if (answer !== 'Save Anyway') {
                            break;
                        }
                    }

                    // Save to disk (ConfigManager will handle pattern normalization)
                    await activeConfig.saveProjectRules(currentRules);
                    mainUIProvider.onConfigChanged?.();
                    panel.webview.postMessage({ command: 'rulesSaved', ruleIds: [normalizedRule.id] });
                    break;
                }


                case 'deleteRule': {
                    const activeConfig = mainUIProvider.activeConfigManager;
                    if (!activeConfig) { break; }
                    const ruleIdToDelete = message.id as string;

                    // Load & Filter out current rules from disk
                    const loadedProject = await activeConfig.loadFullConfig();
                    const currentRules = Array.isArray(loadedProject?.rules) ? loadedProject.rules : [];
                    const updatedRules = currentRules.filter(r => r.id !== ruleIdToDelete);
                    
                    // Save the updated rules
                    await activeConfig.saveProjectRules(updatedRules);
                    mainUIProvider.onConfigChanged?.();
                    panel.webview.postMessage({ command: 'ruleDeleted' });
                    break;
                }

                case 'importRules': {
                    await mainUIProvider.importRulesToWebview(panel.webview);
                    break;
                }

                case 'exportRules': {
                    const activeConfig = mainUIProvider.activeConfigManager;
                    if (!activeConfig) { break; }
                    await mainUIProvider.exportRulesFromWebview(activeConfig, message.rules as any[]);
                    break;
                }

                case 'scanIacFile': {
                    // Delegate to the registered command which handles the file picker + scanning
                    vscode.commands.executeCommand('prompthider.scanIacFile');
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

            // Get URI for codicon stylesheet
            const codiconsUri = panel.webview.asWebviewUri(
                vscode.Uri.file(path.join(context.extensionPath, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'))
            );

            // Add codicon stylesheet to the head
            html = html.replace('</head>', `<link href="${codiconsUri}" rel="stylesheet" /></head>`);

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

    private static normalizeRules(rules: any[]) {
        return (rules ?? []).map(r => ({
            id: String(r.id),
            type: 'custom' as const,
            pattern: String(r.pattern ?? ''),
            replacement: String(r.replacement ?? ''),
            enabled: true,
            description: `Custom rule: ${String(r.pattern ?? '')} → ${String(r.replacement ?? '')}`,
        }));
    }

    private static async postInit(webview: vscode.Webview, configManager: ConfigManager): Promise<void> {
        const config = await configManager.loadFullConfig();
        const name = configManager.getRulesheetName();
        webview.postMessage({
            command: 'init',
            rulesheetName: name,
            workspaceName: configManager.getWorkspaceFolderName(),
            rulesheetPath: configManager.getConfigFilePath(),
            rules: (config?.rules ?? []).map(r => ({
                id: r.id,
                pattern: typeof r.pattern === 'string' ? r.pattern : r.pattern.source,
                replacement: r.replacement,
            })),
            enabled: config?.enabled ?? false,
        });
    }

    private static async importRulesToWebview(webview: vscode.Webview): Promise<void> {
        const picked = await vscode.window.showOpenDialog({
            canSelectMany: false,
            canSelectFiles: true,
            canSelectFolders: false,
            openLabel: 'Import Rules',
            filters: {
                'JSON Files': ['json'],
                'All Files': ['*'],
            },
        });

        if (!picked || picked.length === 0) {
            return;
        }

        try {
            const content = fs.readFileSync(picked[0].fsPath, 'utf8');
            const parsed = JSON.parse(content) as any;
            const sourceRules = Array.isArray(parsed) ? parsed : Array.isArray(parsed.rules) ? parsed.rules : [];
            const normalizedRules = sourceRules
                .map((r: any) => ({
                    id: String(r.id ?? `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
                    pattern: typeof r.pattern === 'string' ? r.pattern : String(r.pattern?.source ?? ''),
                    replacement: String(r.replacement ?? ''),
                }))
                .filter((r: { pattern: string; replacement: string }) => r.pattern.trim() !== '' || r.replacement.trim() !== '');

            webview.postMessage({
                command: 'importedRules',
                rules: normalizedRules,
                fileName: path.basename(picked[0].fsPath),
            });
            vscode.window.showInformationMessage(`Imported ${normalizedRules.length} rule(s) from ${path.basename(picked[0].fsPath)}.`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to import rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private static async exportRulesFromWebview(configManager: ConfigManager, rules: any[]): Promise<void> {
        const saveUri = await vscode.window.showSaveDialog({
            saveLabel: 'Export Rules',
            filters: { 'JSON Files': ['json'] },
            defaultUri: vscode.Uri.file(`${configManager.getRulesheetName()}.rules.export.json`),
        });

        if (!saveUri) {
            return;
        }

        try {
            const normalizedRules = (rules ?? [])
                .map(r => ({
                    id: String(r.id),
                    pattern: String(r.pattern ?? ''),
                    replacement: String(r.replacement ?? ''),
                }))
                .filter((r: { pattern: string; replacement: string }) => r.pattern.trim() !== '' || r.replacement.trim() !== '');

            fs.writeFileSync(saveUri.fsPath, JSON.stringify({
                version: 1,
                exportedAt: new Date().toISOString(),
                rulesheet: configManager.getRulesheetName(),
                rules: normalizedRules,
            }, null, 2), 'utf8');

            vscode.window.showInformationMessage(`Exported ${normalizedRules.length} rule(s) to ${path.basename(saveUri.fsPath)}.`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
