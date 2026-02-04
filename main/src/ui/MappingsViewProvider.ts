import * as vscode from 'vscode';
import { TokenManager } from '../anonymizer/TokenManager';

export class MappingsViewProvider implements vscode.TreeDataProvider<MappingItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MappingItem | undefined | null | void> = 
        new vscode.EventEmitter<MappingItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MappingItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    constructor(private tokenManager: TokenManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MappingItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: MappingItem): Thenable<MappingItem[]> {
        // TODO: Get mappings from TokenManager and convert to tree items
        // TODO: Group by type (IPs, Emails, Secrets, etc.)
        return Promise.resolve([]);
    }
}

export class MappingItem extends vscode.TreeItem {
    constructor(
        public readonly token: string,
        public readonly originalValue: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(token, collapsibleState);
        this.tooltip = `${token} → ${originalValue}`;
        this.description = originalValue;
        this.contextValue = 'mapping';
    }
}
