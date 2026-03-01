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
    {
        id: 'ipv6',
        type: 'ip',
        pattern: /\b(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}\b|\b(?:[0-9A-Fa-f]{1,4}:){1,7}:\b|\b:(?::[0-9A-Fa-f]{1,4}){1,7}\b/g,
        replacement: 'IPV6_{index}',
        enabled: true,
        description: 'IPv6 addresses'
    },
    {
        id: 'uuid',
        type: 'uuid',
        pattern: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b/g,
        replacement: 'UUID_{index}',
        enabled: true,
        description: 'UUID values'
    },
    {
        id: 'api-keys',
        type: 'api-key',
        pattern: /\b(?:AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\-_]{35})\b/g,
        replacement: 'API_KEY_{index}',
        enabled: true,
        description: 'Common API key formats (AWS/GitHub/OpenAI/Google)'
    },
    {
        id: 'jwt',
        type: 'jwt',
        pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
        replacement: 'JWT_TOKEN_{index}',
        enabled: true,
        description: 'JWT tokens'
    },
    {
        id: 'private-key',
        type: 'private-key',
        pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
        replacement: 'PRIVATE_KEY_{index}',
        enabled: true,
        description: 'PEM/OpenSSH private key blocks'
    },
];
