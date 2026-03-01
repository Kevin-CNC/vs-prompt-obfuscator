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
     * Build the pattern matcher from regex patterns.
     * Invalid patterns are silently dropped with a console warning.
     */
    build(patterns: Array<{ pattern: string; replacement: string }>) {
        this.patterns = patterns.filter(p => {
            try {
                new RegExp(p.pattern);
                return true;
            } catch {
                console.warn(`[PatternMatcher] Invalid regex, skipping: ${p.pattern}`);
                return false;
            }
        });
    }

    /**
     * Find all non-overlapping pattern matches in text.
     *
     * Patterns are tried longest-first so that more specific rules take priority.
     * Occupied character ranges are tracked via sorted intervals (O(n log n))
     * rather than a per-character Set, keeping large texts performant.
     */
    findMatches(text: string): PatternMatch[] {
        const matches: PatternMatch[] = [];
        /** Sorted list of occupied [start, end) intervals. */
        const occupied: Array<[number, number]> = [];

        // Sort patterns by length (longest first) to prioritise longer matches
        const sortedPatterns = [...this.patterns].sort(
            (a, b) => b.pattern.length - a.pattern.length
        );

        for (const { pattern, replacement } of sortedPatterns) {
            try {
                const regex = new RegExp(pattern, 'g');
                let match: RegExpExecArray | null;

                while ((match = regex.exec(text)) !== null) {
                    const start = match.index;
                    const end = match.index + match[0].length;

                    if (!this.overlaps(occupied, start, end)) {
                        matches.push({ pattern, match: match[0], start, end, replacement });
                        this.insertInterval(occupied, start, end);
                    }
                }
            } catch (error) {
                console.error(`[PatternMatcher] Error matching pattern ${pattern}:`, error);
            }
        }

        // Sort by position for consistent ordering
        return matches.sort((a, b) => a.start - b.start);
    }

    // ---- interval helpers -------------------------------------------------------

    /** Binary-search check: does [start, end) overlap any existing interval? */
    private overlaps(intervals: Array<[number, number]>, start: number, end: number): boolean {
        let lo = 0;
        let hi = intervals.length - 1;

        while (lo <= hi) {
            const mid = (lo + hi) >>> 1;
            const [iStart, iEnd] = intervals[mid];

            if (end <= iStart) {
                hi = mid - 1;
            } else if (start >= iEnd) {
                lo = mid + 1;
            } else {
                return true; // overlap
            }
        }
        return false;
    }

    /** Insert [start, end) into the sorted interval list, maintaining order. */
    private insertInterval(intervals: Array<[number, number]>, start: number, end: number): void {
        let lo = 0;
        let hi = intervals.length;

        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (intervals[mid][0] < start) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        intervals.splice(lo, 0, [start, end]);
    }
}