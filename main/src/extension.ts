import * as vscode from 'vscode';
import { AnonymizationEngine } from './anonymizer/AnonymizationEngine';
import { TokenManager } from './anonymizer/TokenManager';
import { ConfigManager } from './utils/ConfigManager';

// TODO: Import UI providers when ready
// import { RuleEditorProvider } from './ui/RuleEditorProvider';
// import { MappingsViewProvider } from './ui/MappingsViewProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('VS Prompt Hider is now active!');

    // TODO: Initialize core services
    // const tokenManager = new TokenManager(context);
    // const configManager = new ConfigManager();
    // const anonymizationEngine = new AnonymizationEngine(tokenManager, configManager);

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
