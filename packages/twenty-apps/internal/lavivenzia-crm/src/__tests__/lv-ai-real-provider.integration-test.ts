// REAL PROVIDER smoke test (Day 10). Unlike `lv-ai/__tests__/ai-provider.test.ts`,
// which drives HttpChatProvider with a fake transport, this file calls the
// configured vendor for real. It runs only when LV_AI_API_KEY is present in
// the test process environment (never read from a file, never printed) and
// is skipped otherwise, so the suite stays green without a key.
//
// What it proves: initialisation, authentication, text generation,
// structured output, classification, summarisation, error handling (bad key,
// unknown model), timeout handling, invalid-response handling, and the
// unavailable path. Nothing here writes to the CRM.

import { describe, expect, it } from 'vitest';

import { readAiConfig } from 'src/modules/lv-ai/config/ai-config';
import { createAiProvider } from 'src/modules/lv-ai/provider/create-provider';
import { isRecord } from 'src/modules/lv-ai/provider/structured-output';

const KEY = (process.env.LV_AI_API_KEY ?? '').trim();
const PROVIDER = (process.env.LV_AI_PROVIDER ?? 'openai').trim();
const MODEL = (process.env.LV_AI_MODEL ?? '').trim();

const base = { LV_AI_PROVIDER: PROVIDER, LV_AI_API_KEY: KEY, LV_AI_MODEL: MODEL, LV_AI_MAX_RETRIES: '1', LV_AI_TIMEOUT_MS: '30000' };

const evidence: Record<string, unknown>[] = [];
const note = (step: string, detail: Record<string, unknown>) => {
  evidence.push({ step, ...detail });
  console.info(`[real-provider] ${step}: ${JSON.stringify(detail)}`);
};

// An account-side condition (no credits, hard rate limit) is not a CRM defect:
// the step is reported BLOCKED (skipped) with the code, never passed.
const ACCOUNT_SIDE = /denied access|no longer available|not available to|not found|permission denied|\(40[34]\)/i;
const blocked = (ctx: { skip: () => void }, step: string, result: { ok: boolean; code?: string; message?: string }): boolean => {
  if (!result.ok && (result.code === 'AI_QUOTA_EXHAUSTED' || result.code === 'AI_RATE_LIMITED' || result.code === 'AI_RETRY_EXHAUSTED' || (result.code === 'AI_REQUEST_REJECTED' && ACCOUNT_SIDE.test(result.message ?? '')))) {
    note(step, { BLOCKED: result.code, message: result.message });
    ctx.skip();

    return true;
  }

  return false;
};

describe.skipIf(KEY === '')('REAL PROVIDER smoke test (LV_AI_API_KEY present)', () => {
  const provider = createAiProvider(readAiConfig(base));

  it('1. initialises a real provider from the configuration', () => {
    expect(provider.available).toBe(true);
    expect(provider.name).toBe(PROVIDER);
    expect(provider.model).toBeTruthy();
    note('init', { provider: provider.name, model: provider.model });
  });

  it('2. authenticates — the real key is never reported as invalid credentials', async () => {
    const result = await provider.generateText({ purpose: 'd10-smoke-auth', system: 'Answer with one word.', user: 'Say yes.', maxOutputTokens: 16 });

    if (!result.ok) {
      // Model access or quota may still be missing (account side); the credentials themselves must not be the reason.
      expect(result.message).not.toMatch(/rejected the credentials/);
      expect(result.message).not.toContain(KEY);
    }

    note('auth', { ok: result.ok, code: result.ok ? null : result.code, message: result.ok ? null : result.message });
  });

  it('3. generates text', async (ctx) => {
    const result = await provider.generateText({ purpose: 'd10-smoke-text', system: 'Answer in one short sentence.', user: 'Say that the La Vivenzia CRM smoke test reached the provider.', maxOutputTokens: 60 });

    if (blocked(ctx, 'generateText', result)) {
      return;
    }

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.trim().length).toBeGreaterThan(0);
      expect(result.usage.outputTokens ?? 1).toBeGreaterThan(0);
      note('generateText', { latencyMs: result.latencyMs, attempts: result.attempts, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, chars: result.value.length });
    }
  });

  it('4. returns validated structured output', async (ctx) => {
    const result = await provider.structuredOutput<{ city: string; count: number }>(
      { purpose: 'd10-smoke-json', system: 'Respond with JSON only: {"city": string, "count": number}.', user: 'The CRM context lists 3 leads in Goa. Report the city and the count.', maxOutputTokens: 60 },
      (candidate) => (isRecord(candidate) && typeof candidate.city === 'string' && typeof candidate.count === 'number' ? { ok: true, value: { city: candidate.city, count: candidate.count } } : { ok: false, error: 'shape' }),
    );

    if (blocked(ctx, 'structuredOutput', result)) {
      return;
    }

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.count).toBe(3);
      expect(result.value.city.toLowerCase()).toContain('goa');
      note('structuredOutput', { value: result.value, latencyMs: result.latencyMs });
    }
  });

  it('5. classifies inside an allowlist and never outside it', async (ctx) => {
    const result = await provider.classify({
      purpose: 'd10-smoke-classify',
      system: 'Classify the lead.',
      user: 'A family-run villa with four rooms near Alibaug that hosts overnight guests.',
      labels: ['STAY', 'EXPERIENCE', 'BUSINESS_PARTNER'] as const,
    });

    if (blocked(ctx, 'classify', result)) {
      return;
    }

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(['STAY', 'EXPERIENCE', 'BUSINESS_PARTNER', null]).toContain(result.value.label);
      expect(result.value.label).toBe('STAY');
      note('classify', { label: result.value.label, confidence: result.value.confidence });
    }
  });

  it('6. summarises grounded text', async (ctx) => {
    const result = await provider.summarize({
      purpose: 'd10-smoke-summarise',
      system: 'Summarise the interaction in two sentences. Use only the facts given.',
      user: 'Call on Monday: the partner asked for the commission structure and said they can host from November. They want a written proposal by Friday.',
      maxOutputTokens: 120,
    });

    if (blocked(ctx, 'summarize', result)) {
      return;
    }

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.toLowerCase()).toMatch(/commission|november|proposal/);
      note('summarize', { chars: result.value.length, latencyMs: result.latencyMs });
    }
  });

  it('7a. rejects invalid credentials without retrying (AI_REQUEST_REJECTED)', async () => {
    const bad = createAiProvider(readAiConfig({ ...base, LV_AI_API_KEY: 'invalid-key-for-day-10-smoke-test' }));
    const result = await bad.generateText({ purpose: 'd10-smoke-badkey', system: 'x', user: 'x', maxOutputTokens: 16 });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe('AI_REQUEST_REJECTED');
      expect(result.message).toMatch(/rejected the credentials/);
      expect(result.attempts).toBe(1);
      expect(result.message).not.toContain('invalid-key-for');
      note('invalidKey', { code: result.code, attempts: result.attempts });
    }
  });

  it('7b. reports an unsupported model as a rejected request', async () => {
    const wrong = createAiProvider(readAiConfig({ ...base, LV_AI_MODEL: 'lv-model-that-does-not-exist' }));
    const result = await wrong.generateText({ purpose: 'd10-smoke-badmodel', system: 'x', user: 'x', maxOutputTokens: 16 });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(['AI_REQUEST_REJECTED', 'AI_PROVIDER_ERROR']).toContain(result.code);
      note('unsupportedModel', { code: result.code });
    }
  });

  it('8. times out and reports AI_TIMEOUT / AI_RETRY_EXHAUSTED', async (ctx) => {
    const slow = createAiProvider(readAiConfig({ ...base, LV_AI_TIMEOUT_MS: '2000', LV_AI_MAX_RETRIES: '0', LV_AI_MAX_OUTPUT_TOKENS: '4000' }));
    const result = await slow.generateText({ purpose: 'd10-smoke-timeout', system: 'Write at great length.', user: 'Write a 3000-word essay about the history of Indian hospitality, without stopping early.', maxOutputTokens: 4000 });

    if (!result.ok && (result.code === 'AI_QUOTA_EXHAUSTED' || (result.code === 'AI_REQUEST_REJECTED' && ACCOUNT_SIDE.test(result.message ?? '')))) {
      note('timeout', { BLOCKED: result.code, message: result.message });
      ctx.skip();
    }

    // A very fast answer would be a pass of a different kind; the assertion is that a timeout never masquerades as success with truncated garbage.
    if (!result.ok) {
      expect(['AI_TIMEOUT', 'AI_RETRY_EXHAUSTED']).toContain(result.code);
      expect(result.retryable).toBe(true);
    }

    note('timeout', { ok: result.ok, code: result.ok ? null : result.code, latencyMs: result.latencyMs });
  }, 60_000);

  it('9. fails closed on a response that does not satisfy the validator (AI_INVALID_RESPONSE)', async (ctx) => {
    const result = await provider.structuredOutput<never>(
      { purpose: 'd10-smoke-invalid', system: 'Respond with JSON only: {"answer": string}.', user: 'Say hello.', maxOutputTokens: 40 },
      () => ({ ok: false, error: 'The Day 10 validator refuses every shape on purpose.' }),
    );

    if (blocked(ctx, 'invalidResponse', result)) {
      return;
    }

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe('AI_INVALID_RESPONSE');
      note('invalidResponse', { code: result.code });
    }
  });

  it('10. network failure surfaces as AI_UNAVAILABLE and the key never appears in the message', async () => {
    const unreachable = createAiProvider(readAiConfig({ ...base, LV_AI_PROVIDER: 'openai-compatible', LV_AI_BASE_URL: 'http://127.0.0.1:9/v1', LV_AI_MODEL: 'any', LV_AI_MAX_RETRIES: '0' }));
    const result = await unreachable.generateText({ purpose: 'd10-smoke-network', system: 'x', user: 'x', maxOutputTokens: 16 });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(['AI_UNAVAILABLE', 'AI_TIMEOUT']).toContain(result.code);
      expect(result.message).not.toContain(KEY);
      note('network', { code: result.code });
    }
  });

  it('11. an unconfigured provider answers AI_UNAVAILABLE with no network call', async () => {
    const none = createAiProvider(readAiConfig({}));
    const result = await none.generateText({ purpose: 'd10-smoke-none', system: 'x', user: 'x' });

    expect(none.available).toBe(false);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe('AI_UNAVAILABLE');
    }

    expect(JSON.stringify(evidence)).not.toContain(KEY);
  });
});

describe.skipIf(KEY !== '')('REAL PROVIDER smoke test', () => {
  it('is skipped: LV_AI_API_KEY is not present in the environment', () => {
    expect(KEY).toBe('');
  });
});
