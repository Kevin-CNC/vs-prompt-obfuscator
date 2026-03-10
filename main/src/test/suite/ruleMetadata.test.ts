import * as assert from 'assert';
import { AnonymizationEngine } from '../../anonymizer/AnonymizationEngine';
import { normalizeImportedRules, normalizeRuleForStorage } from '../../utils/RuleMetadata';

suite('Rule Metadata Utilities', () => {
    test('normalizeRuleForStorage preserves existing metadata when incoming fields are missing', () => {
        const existing = {
            id: 'r1',
            type: 'email' as const,
            pattern: 'foo@example.com',
            replacement: 'USER_A@domain.tld',
            enabled: false,
            description: 'existing description',
        };

        const normalized = normalizeRuleForStorage(
            {
                id: 'r1',
                pattern: 'foo2@example.com',
                replacement: 'USER_B@domain.tld',
            },
            existing
        );

        assert.strictEqual(normalized.id, 'r1');
        assert.strictEqual(normalized.pattern, 'foo2@example.com');
        assert.strictEqual(normalized.replacement, 'USER_B@domain.tld');
        assert.strictEqual(normalized.type, 'email');
        assert.strictEqual(normalized.enabled, false);
        assert.strictEqual(normalized.description, 'existing description');
    });

    test('normalizeImportedRules materializes missing metadata safely', () => {
        const normalized = normalizeImportedRules([
            {
                pattern: 'secret_[0-9]+',
                replacement: 'SECRET_{index}',
            },
        ]);

        assert.strictEqual(normalized.length, 1);
        assert.strictEqual(normalized[0].type, 'custom');
        assert.strictEqual(normalized[0].enabled, true);
        assert.strictEqual(normalized[0].description, '');
    });
});

suite('AnonymizationEngine Cache', () => {
    test('reuses compiled patterns until rules fingerprint changes', async () => {
        let rulesCalls = 0;
        let fingerprint = 'fp1';

        const fakeConfig = {
            getRulesCacheFingerprint: (): string => fingerprint,
            getRules: (): Array<{ pattern: string; replacement: string }> => {
                rulesCalls += 1;
                return [{ pattern: 'server-[0-9]+', replacement: 'HOST_{index}' }];
            },
        };

        const fakeTokens = {
            generateToken: (type: string, originalValue: string): string => `${type}:${originalValue}`,
        };

        const engine = new AnonymizationEngine(
            fakeTokens as never,
            fakeConfig as never
        );

        await engine.anonymize('connect server-1');
        await engine.anonymize('connect server-2');
        assert.strictEqual(rulesCalls, 1, 'rules should only be fetched once for same fingerprint');

        fingerprint = 'fp2';
        await engine.anonymize('connect server-3');
        assert.strictEqual(rulesCalls, 2, 'rules should be fetched again after fingerprint change');
    });
});
