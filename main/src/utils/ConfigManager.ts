import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AnonymizationRule } from '../anonymizer/PatternLibrary';

export interface ProjectConfig {
    version: string;
    enabled: boolean;
    rules: AnonymizationRule[];
    tokenConsistency: boolean;
    autoAnonymize: boolean;
    showPreview: boolean;
}

export class ConfigManager {
    readonly configFileName = String();

    constructor( ruleName:string | undefined ){
        this.configFileName = ruleName || ".projectRuleSet";
        this.loadProjectRules()
    }


    // helper for getting the workspace root path
    private getWorkspacePth(): string{
        const workspace = vscode.workspace.workspaceFolders;

        if ( workspace === undefined || workspace.length === 0){
            throw new Error('No workspace folder open');
        }

        return workspace[0].uri.fsPath;
    }


    private rulesheetExists(pathOfRulesheet:string): boolean{
        return fs.existsSync(pathOfRulesheet);
    }


    async loadProjectRules(): Promise<AnonymizationRule[]> {
        // TODO: Load custom rules from .prompthider.json in workspace root
        try{
            const workspace = this.getWorkspacePth();
            const rulesheetPath = path.join(workspace, this.configFileName)
            
            // before anything, check if the rulesheet actually exists.
            if(!this.rulesheetExists( rulesheetPath )){
                console.log(`Config file not found at ${rulesheetPath}`);
                return [];
            }


        }catch(error){

        }

        // Get workspace folder
        // 2. Check if .prompthider.json exists
        // 3. Parse JSON and return rules array
        return [];
    }

    async saveProjectRules(rules: AnonymizationRule[]): Promise<void> {
        // TODO: Save rules to .prompthider.json
        // 1. Get workspace folder
        // 2. Load existing config or create new
        // 3. Update rules and write to file
    }

    async initializeProjectConfig(): Promise<void> {
        // TODO: Create default .prompthider.json in workspace root
        // 1. Check workspace exists
        // 2. Check file doesn't already exist
        // 3. Create with default config structure
    }

    private createDefaultConfig(rules: AnonymizationRule[]): ProjectConfig {
        return {
            version: '1.0',
            enabled: true,
            rules: rules,
            tokenConsistency: true,
            autoAnonymize: true,
            showPreview: true
        };
    }
}
