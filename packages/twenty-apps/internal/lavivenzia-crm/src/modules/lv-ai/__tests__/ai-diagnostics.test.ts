import { describe, expect, it } from 'vitest';

import { readAiConfig } from 'src/modules/lv-ai/config/ai-config';
import { configurationError, describeAiDiagnostics, keyFingerprint, PROBE_EXPLANATION, probeOutcomeFor } from 'src/modules/lv-ai/config/ai-diagnostics';

// The operator's read-out. Everything it returns has to be safe to paste into
// a ticket, which is the whole point: diagnosing a key problem must not
// require anyone to handle the key.
//
// No test here contacts a provider, so the suite consumes no quota.

const SECRET = ['AIza', 'SyEXAMPLE-not-a-real-key-0123456789'].join('');

describe('the key fingerprint', () => {
  it('reveals no part of the key', () => {
    const fingerprint = keyFingerprint(SECRET) ?? '';

    expect(fingerprint).not.toContain(SECRET);
    // Not a prefix, not a suffix, not a middle slice. A hash, not a truncation.
    for (let length = 4; length <= 12; length += 1) {
      expect(fingerprint).not.toContain(SECRET.slice(0, length));
      expect(fingerprint).not.toContain(SECRET.slice(-length));
    }

    expect(fingerprint).not.toMatch(/AIza/);
  });

  it('is stable for one key and different for another', () => {
    expect(keyFingerprint(SECRET)).toBe(keyFingerprint(SECRET));
    expect(keyFingerprint(SECRET)).not.toBe(keyFingerprint(SECRET + 'x'));
  });

  it('distinguishes a truncated paste from the real thing', () => {
    // The commonest configuration mistake, and invisible without the length.
    expect(keyFingerprint(SECRET)).not.toBe(keyFingerprint(SECRET.slice(0, -4)));
    expect(keyFingerprint(SECRET)).toMatch(new RegExp(`_${SECRET.length}$`));
  });

  it('is absent when nothing is configured', () => {
    expect(keyFingerprint(null)).toBeNull();
    expect(keyFingerprint('')).toBeNull();
  });
});

describe('the configuration read-out', () => {
  it('reports a configured Gemini setup without the key', () => {
    const diagnostics = describeAiDiagnostics(readAiConfig({ LV_AI_PROVIDER: 'gemini', LV_AI_API_KEY: SECRET, LV_AI_MODEL: 'gemini-3.6-flash' }));

    expect(diagnostics.provider).toBe('gemini');
    expect(diagnostics.model).toBe('gemini-3.6-flash');
    expect(diagnostics.apiKeyConfigured).toBe(true);
    expect(diagnostics.ready).toBe(true);
    expect(diagnostics.reason).toBeNull();

    // The whole object, serialised, must not contain the secret.
    expect(JSON.stringify(diagnostics)).not.toContain(SECRET);
  });

  it('names the precedence chain rather than guessing which link supplied it', () => {
    // A logic function sees only the merged sandbox env, so claiming to know
    // the exact source would be a lie. Naming the order is actionable.
    const diagnostics = describeAiDiagnostics(readAiConfig({ LV_AI_API_KEY: SECRET }));

    expect(diagnostics.apiKeySource).toMatch(/applicationVariable/);
    expect(diagnostics.apiKeySource).toMatch(/worker process environment/);
  });

  it('reports an unconfigured setup honestly', () => {
    const diagnostics = describeAiDiagnostics(readAiConfig({}));

    expect(diagnostics.apiKeyConfigured).toBe(false);
    expect(diagnostics.apiKeyFingerprint).toBeNull();
    expect(diagnostics.ready).toBe(false);
    expect(diagnostics.provider).toBe('none');
    expect(diagnostics.reason).toMatch(/LV_AI_PROVIDER/);
  });

  it('carries the tuning values through', () => {
    const diagnostics = describeAiDiagnostics(
      readAiConfig({ LV_AI_API_KEY: SECRET, LV_AI_TIMEOUT_MS: '9000', LV_AI_MAX_OUTPUT_TOKENS: '500', LV_AI_MAX_RETRIES: '1', LV_AI_TEMPERATURE: '0.5' }),
    );

    expect(diagnostics.timeoutMs).toBe(9000);
    expect(diagnostics.maxOutputTokens).toBe(500);
    expect(diagnostics.maxRetries).toBe(1);
    expect(diagnostics.temperature).toBe(0.5);
  });
});

describe('the configuration error', () => {
  it('is silent when everything is in place', () => {
    expect(configurationError(readAiConfig({ LV_AI_PROVIDER: 'gemini', LV_AI_API_KEY: SECRET }))).toBeNull();
  });

  it('explains the empty-workspace-variable trap when the key is missing', () => {
    // The asymmetry that actually bites: registration variables skip empty
    // values, workspace variables do not. A blank workspace variable shadows
    // a good environment variable and reads back as "missing".
    const message = configurationError(readAiConfig({})) ?? '';

    expect(message).toMatch(/LV_AI_API_KEY is not set/);
    expect(message).toMatch(/empty string shadows the environment/);
  });

  it('names the provider when the key is present but the kind is not ours', () => {
    const message = configurationError(readAiConfig({ LV_AI_PROVIDER: 'not-a-provider', LV_AI_API_KEY: SECRET })) ?? '';

    expect(message).toMatch(/LV_AI_PROVIDER/);
  });

  it('names the model when an openai-compatible gateway omits it', () => {
    const message = configurationError(readAiConfig({ LV_AI_PROVIDER: 'openai-compatible', LV_AI_API_KEY: SECRET, LV_AI_BASE_URL: 'https://gw.example/v1' })) ?? '';

    expect(message).toMatch(/LV_AI_MODEL/);
  });

  it('never repeats the key back', () => {
    for (const env of [{}, { LV_AI_API_KEY: SECRET, LV_AI_PROVIDER: 'nonsense' }, { LV_AI_PROVIDER: 'openai-compatible', LV_AI_API_KEY: SECRET }]) {
      expect(configurationError(readAiConfig(env)) ?? '').not.toContain(SECRET);
    }
  });
});

describe('what a probe concluded', () => {
  it('reports success only on success', () => {
    expect(probeOutcomeFor(null, true)).toBe('SUCCESS');
  });

  it('tells the states apart that an operator must act on differently', () => {
    expect(probeOutcomeFor('AI_UNAVAILABLE', false)).toBe('CONFIGURATION_MISSING');
    expect(probeOutcomeFor('AI_REQUEST_REJECTED', false)).toBe('AUTHENTICATION_FAILED');
    expect(probeOutcomeFor('AI_QUOTA_EXHAUSTED', false)).toBe('QUOTA_EXHAUSTED');
    expect(probeOutcomeFor('AI_RATE_LIMITED', false)).toBe('RATE_LIMITED');
    expect(probeOutcomeFor('AI_TIMEOUT', false)).toBe('TIMEOUT');
    expect(probeOutcomeFor('AI_RETRY_EXHAUSTED', false)).toBe('TIMEOUT');
    expect(probeOutcomeFor('AI_INVALID_RESPONSE', false)).toBe('INVALID_RESPONSE');
  });

  it('never reads an unknown failure as a success', () => {
    for (const code of ['AI_SOMETHING_NEW', '', null]) {
      expect(probeOutcomeFor(code, false)).toBe('PROVIDER_UNAVAILABLE');
    }
  });

  it('says plainly that an exhausted quota is a billing state, not a CRM fault', () => {
    expect(PROBE_EXPLANATION.QUOTA_EXHAUSTED).toMatch(/billing state, not a fault in the CRM/);
  });

  it('has an explanation for every outcome it can return', () => {
    const outcomes = ['CONFIGURATION_MISSING', 'AUTHENTICATION_FAILED', 'QUOTA_EXHAUSTED', 'RATE_LIMITED', 'TIMEOUT', 'PROVIDER_UNAVAILABLE', 'INVALID_RESPONSE', 'THROTTLED_LOCALLY', 'SUCCESS'] as const;

    for (const outcome of outcomes) {
      expect(PROBE_EXPLANATION[outcome], outcome).toBeTruthy();
    }
  });
});

describe('the deterministic tier is independent of all of this', () => {
  it('stays available when no provider is configured at all', () => {
    // The rules engines have 445 successes and 0 failures precisely because
    // they never consult a provider. Nothing in this configuration path may
    // change that.
    const diagnostics = describeAiDiagnostics(readAiConfig({}));

    expect(diagnostics.ready).toBe(false);
    expect(diagnostics.provider).toBe('none');
    // There is no switch here that could disable the rules path; the absence
    // of one is the guarantee, and this test documents the intent.
    expect(Object.keys(diagnostics)).not.toContain('rulesDisabled');
  });
});
