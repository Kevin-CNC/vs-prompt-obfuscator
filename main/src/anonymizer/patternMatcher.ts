export interface PatternMatch {
    pattern: string;  // The regex pattern itself
    match: string;    // The actual matched text
    start: number;
    end: number;
    replacement: string;  // The replacement label
}

export class RegexPatternMatcher {
    private patterns: Array<{ pattern: string; replacement: string }> = [];

    /**
     * Build the pattern matcher from regex patterns
     */
    build(patterns: Array<{ pattern: string; replacement: string }>) {
        this.patterns = patterns.filter(p => {
            try {
                // Validate that pattern is valid regex
                new RegExp(p.pattern);
                return true;
            } catch {
                console.warn(`Invalid regex pattern: ${p.pattern}`);
                return false;
            }
        });
    }

    /**
     * Find all pattern matches in text using regex
     * O(n * m) where n is text length, m is number of patterns
     */
    findMatches(text: string): PatternMatch[] {
        const matches: PatternMatch[] = [];
        const usedRanges = new Set<string>();

        // Sort patterns by length (longest first) to prioritize longer matches
        const sortedPatterns = [...this.patterns].sort((a, b) => 
            b.pattern.length - a.pattern.length
        );

        for (const { pattern, replacement } of sortedPatterns) {
            try {
                const regex = new RegExp(pattern, 'g');
                let match;

                while ((match = regex.exec(text)) !== null) {
                    const start = match.index;
                    const end = match.index + match[0].length;

                    // Check for overlaps
                    let isOverlap = false;
                    for (let i = start; i < end; i++) {
                        if (usedRanges.has(String(i))) {
                            isOverlap = true;
                            break;
                        }
                    }

                    if (!isOverlap) {
                        matches.push({
                            pattern,
                            match: match[0],
                            start,
                            end,
                            replacement
                        });

                        // Mark range as used
                        for (let i = start; i < end; i++) {
                            usedRanges.add(String(i));
                        }
                    }
                }
            } catch (error) {
                console.error(`Error matching pattern ${pattern}:`, error);
            }
        }

        // Sort by position for consistent ordering
        return matches.sort((a, b) => a.start - b.start);
    }
}