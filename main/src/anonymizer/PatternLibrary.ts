export interface AnonymizationRule {
    id: string;
    type: 'ip' | 'email' | 'uuid' | 'secret' | 'api-key' | 'path' | 'jwt' | 'private-key' | 'custom';
    pattern: string | RegExp;
    replacement: string;
    enabled: boolean;
    description?: string;
}

// TODO: Add more built-in patterns as needed
export const BUILTIN_PATTERNS: AnonymizationRule[] = [
    {
        id: 'ipv4',
        type: 'ip',
        pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        replacement: 'IP_{index}',
        enabled: true,
        description: 'IPv4 addresses'
    },
    {
        id: 'email',
        type: 'email',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        replacement: 'USER_{index}@domain.tld',
        enabled: true,
        description: 'Email addresses'
    },
    // TODO: Add more patterns:
    // - IPv6
    // - UUIDs
    // - API keys (AWS, OpenAI, GitHub, etc.)
    // - JWT tokens
    // - Private keys
    // - Credit cards
    // - Phone numbers
];
