import { TokenManager } from './TokenManager';
import { ConfigManager } from '../utils/ConfigManager';
import { RegexPatternMatcher, type PatternMatch } from './patternMatcher';
import { CloakdLogger } from '../utils/CloakdLogger';

export interface AnonymizationResult {
    original: string;
    anonymized: string;
    mappings: Map<string, string>;
    stats: {
        totalMatches: number;
        patternBreakdown: Record<string, number>;
    };
}

export class AnonymizationEngine {
    private tokenManager: TokenManager;
    private configManager: ConfigManager;
    private patternMatcher: RegexPatternMatcher;
    private lastRulesFingerprint: string | undefined;

    constructor(tokenManager: TokenManager, configManager: ConfigManager) {
        this.tokenManager = tokenManager;
        this.configManager = configManager;
        this.patternMatcher = new RegexPatternMatcher();
    }

    private initializePatterns(force = false): void {
        const nextFingerprint = this.configManager.getRulesCacheFingerprint();
        if (!force && this.lastRulesFingerprint === nextFingerprint) {
            return;
        }

        const rules = this.configManager.getRules();
        this.patternMatcher.build(rules);
        this.lastRulesFingerprint = nextFingerprint;
    }

    async anonymize(text: string): Promise<AnonymizationResult> {
        try {
            // Refresh matcher only when rulesheet content changed.
            this.initializePatterns();

            // Find all pattern matches
            const matches = this.patternMatcher.findMatches(text);
            const mappings = new Map<string, string>();
            const patternBreakdown: Record<string, number> = {};

            // Sort matches by position (descending) to avoid offset issues
            matches.sort((a, b) => b.start - a.start);

            let anonymized = text;

            // Replace matches from end to start (prevents offset shifts)
            for (const match of matches) {
                // Always route token creation through TokenManager for consistency
                const token = this.tokenManager.generateToken(match.replacement, match.match);
                mappings.set(match.match, token);

                // Replace the matched text with the token
                anonymized = 
                    anonymized.substring(0, match.start) + 
                    token + 
                    anonymized.substring(match.end);

                // Track statistics
                patternBreakdown[match.pattern] = (patternBreakdown[match.pattern] || 0) + 1;
            }

            return {
                original: text,
                anonymized,
                mappings,
                stats: {
                    totalMatches: matches.length,
                    patternBreakdown
                }
            };
        } catch (error) {
            CloakdLogger.error('Anonymization failed inside engine.', {
                reason: error instanceof Error ? error.message : String(error),
                textLength: text.length,
            });
            throw new Error(`Anonymization pipeline failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async detectPatterns(text: string): Promise<PatternMatch[]> {
        this.initializePatterns();
        return this.patternMatcher.findMatches(text);
    }

    invalidatePatternCache(): void {
        this.lastRulesFingerprint = undefined;
    }
}