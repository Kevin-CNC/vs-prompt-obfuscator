import { TokenManager } from './TokenManager';
import { ConfigManager } from '../utils/ConfigManager';
import { BUILTIN_PATTERNS } from './PatternLibrary';
import { AhoCorasick, type PatternMatch } from './patternMatcher';

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
    private ahoCorasick: AhoCorasick;


    constructor(tokenManager: TokenManager, configManager: ConfigManager) {
        this.tokenManager = tokenManager;
        this.configManager = configManager;
        this.ahoCorasick = new AhoCorasick();
        this.initializePatterns();
    }


    private initializePatterns(){
        // Loads the rules from the configuration
        const prjRules = this.configManager.getRules();

        const patterns = prjRules.map(rule => ({
            pattern: rule.pattern,
            replacement: rule.replacement
        }));

        this.ahoCorasick.addPatterns(patterns);
    }


    async anonymize(context: string): Promise<AnonymizationResult> {
        const matches = this.ahoCorasick.findMatches(context);
        const mappings = new Map<string, string>();
        const patterns: Record<string, number> = {};


        // Process matches in reverse order to avoid messing up indices
        matches.sort((a,b) => b.start - a.start);

        let anonymized = context;

        for (const match of matches) {
            // Generates the token for the match and adds it to the mapping <mapped:token>
            const tkn = this.tokenManager.generateToken(match.match, match.replacement);
            mappings.set(match.match, tkn);


            anonymized = anonymized.substring(0, match.start) + tkn + anonymized.substring(match.end); 
        }

        return {
            original: context,
            anonymized,
            mappings,
            stats: {
                totalMatches: matches.length,
                patternBreakdown: patterns
            }
        };
    }

    async detectPatterns(cntx: string): Promise<PatternMatch[]> {
        return this.ahoCorasick.findMatches(cntx);
    }
}
