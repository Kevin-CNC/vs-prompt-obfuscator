import * as vscode from 'vscode';

export class TokenManager {
    private mappings: Map<string, string> = new Map(); // original -> token
    private reverseMappings: Map<string, string> = new Map(); // token -> original
    private counters: Map<string, number> = new Map(); // type -> count
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadMappings();
    }
    

    generateToken(type: string, originalValue: string): string {
        // Check if value already has a token (for consistency)
        const existing = this.mappings.get(originalValue);
        if (existing) {
            return existing;
        }

        // Get or initialize counter for this type
        const count = (this.counters.get(type) || 0) + 1;
        this.counters.set(type, count);

        // Generate new token
        const token = this.formatToken(type, count);

        // Store bidirectional mapping
        this.mappings.set(originalValue, token);
        this.reverseMappings.set(token, originalValue);

        // Persist to VS Code's workspace state
        this.saveMappings();
        
        return token;
    }

    private formatToken(type: string, index: number): string {
        // Format tokens based on type
        switch(type.toLowerCase()) {
            case 'ip':
                return `IP_${index}`;
            case 'email':
                return `USER_${String.fromCharCode(64 + index)}@domain.tld`;
            case 'api-key':
                return `API_KEY_v${index}`;
            case 'uuid':
                return `UUID_${index}`;
            case 'secret':
                return `SECRET_${index}`;
            case 'jwt':
                return `JWT_TOKEN_${index}`;
            case 'path':
                return `/PATH_${index}`;
            default:
                return `${type.toUpperCase()}_${index}`;
        }
    }

    getOriginalValue(token: string): string | undefined {
        return this.reverseMappings.get(token);
    }

    getAllMappings(): Map<string, string> {
        return new Map(this.mappings);
    }

    clearMappings(): void {
        this.mappings.clear();
        this.reverseMappings.clear();
        this.counters.clear();
        this.saveMappings();
    }

    private saveMappings(): void {
        // Persist mappings to VS Code workspace state
        const mappingsArray = Array.from(this.mappings.entries());
        const countersArray = Array.from(this.counters.entries());
        
        this.context.workspaceState.update('prompthider.mappings', mappingsArray);
        this.context.workspaceState.update('prompthider.counters', countersArray);
    }

    private loadMappings(): void {
        // Load mappings from VS Code workspace state
        const mappingsArray = this.context.workspaceState.get<Array<[string, string]>>('prompthider.mappings', []);
        const countersArray = this.context.workspaceState.get<Array<[string, number]>>('prompthider.counters', []);
        
        this.mappings = new Map(mappingsArray);
        this.counters = new Map(countersArray);
        
        // Rebuild reverse mappings
        this.reverseMappings.clear();
        for (const [original, token] of this.mappings) {
            this.reverseMappings.set(token, original);
        }
    }
}
