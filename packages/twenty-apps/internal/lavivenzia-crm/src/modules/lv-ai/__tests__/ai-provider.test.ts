import { describe, expect, it } from 'vitest';

import { AI_DEFAULTS, describeAiAvailability, isAiConfigured, readAiConfig } from 'src/modules/lv-ai/config/ai-config';
import { HttpChatProvider } from 'src/modules/lv-ai/provider/http-provider';
import { createAiProvider, UnavailableProvider } from 'src/modules/lv-ai/provider/create-provider';
import { confidence01, extractJson, oneOf } from 'src/modules/lv-ai/provider/structured-output';
import {
  CONVERSATION_SUMMARY_PROMPT,
  COPILOT_INTENT_PROMPT,
  DRAFT_PROMPT,
  LEAD_CLASSIFICATION_PROMPT,
  LEAD_SUMMARY_PROMPT,
  MORNING_BRIEFING_PROMPT,
  ONBOARDING_ASSIST_PROMPT,
  PROMPT_VERSIONS,
} from 'src/modules/lv-ai/prompts/prompt-registry';

// The provider abstraction with a deterministic transport. Nothing here
// touches the network; every failure mode the brief lists is exercised
// against the real retry / timeout / validation code.

const config = (overrides: Partial<ReturnType<typeof readAiConfig>> = {}) => ({
  ...readAiConfig({ LV_AI_PROVIDER: 'openai', LV_AI_API_KEY: 'test-key', LV_AI_MAX_RETRIES: '2', LV_AI_TIMEOUT_MS: '2000' }),
  ...overrides,
});

const openaiBody = (content: string) => JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });

const response = (status: number, body: string): Response => new Response(body, { status, headers: { 'Content-Type': 'application/json' } });

const provider = (script: (call: number, init: RequestInit) => Promise<Response> | Response, overrides: Partial<ReturnType<typeof readAiConfig>> = {}) => {
  let calls = 0;
  const requests: { url: string; init: RequestInit }[] = [];
  const instance = new HttpChatProvider({
    dialect: overrides.provider === 'gemini' ? 'gemini' : overrides.provider === 'anthropic' ? 'anthropic' : 'openai',
    config: config(overrides),
    fetchImpl: async (url, init) => {
      calls += 1;
      requests.push({ url, init });

      return script(calls, init);
    },
    sleep: async () => undefined,
  });

  return { instance, requests, calls: () => calls };
};

describe('AI configuration', () => {
  it('is unavailable with no key and never fabricates', async () => {
    const cfg = readAiConfig({});

    expect(cfg.provider).toBe('none');
    expect(isAiConfigured(cfg)).toBe(false);
    expect(describeAiAvailability(cfg)).toMatchObject({ available: false, model: null });
    expect(describeAiAvailability(cfg).reason).toMatch(/LV_AI_PROVIDER/);

    const unavailable = createAiProvider(cfg);

    expect(unavailable).toBeInstanceOf(UnavailableProvider);
    const result = await unavailable.generateText({ purpose: 'x', system: 's', user: 'u' });

    expect(result).toMatchObject({ ok: false, code: 'AI_UNAVAILABLE' });
  });

  it('defaults per provider, clamps limits, and never exposes the key', () => {
    const cfg = readAiConfig({ LV_AI_API_KEY: 'k', LV_AI_TIMEOUT_MS: '999999', LV_AI_MAX_OUTPUT_TOKENS: '1', LV_AI_MAX_RETRIES: '-3', LV_AI_TEMPERATURE: 'abc' });

    // Day 10: a bare key means Gemini, the primary provider.
    expect(cfg.provider).toBe('gemini');
    expect(cfg.model).toBe(AI_DEFAULTS.model.gemini);
    expect(cfg.baseUrl).toBe(AI_DEFAULTS.baseUrl.gemini);
    expect(cfg.timeoutMs).toBe(60_000);
    expect(cfg.maxOutputTokens).toBe(64);
    expect(cfg.maxRetries).toBe(0);
    expect(cfg.temperature).toBe(AI_DEFAULTS.temperature);
    expect(JSON.stringify(describeAiAvailability(cfg))).not.toContain('k"');
  });

  it('openai-compatible requires an explicit base URL and model', () => {
    expect(isAiConfigured(readAiConfig({ LV_AI_PROVIDER: 'openai-compatible', LV_AI_API_KEY: 'k' }))).toBe(false);
    expect(isAiConfigured(readAiConfig({ LV_AI_PROVIDER: 'openai-compatible', LV_AI_API_KEY: 'k', LV_AI_BASE_URL: 'https://gw.example/v1/', LV_AI_MODEL: 'm' }))).toBe(true);
    expect(readAiConfig({ LV_AI_PROVIDER: 'openai-compatible', LV_AI_API_KEY: 'k', LV_AI_BASE_URL: 'https://gw.example/v1/', LV_AI_MODEL: 'm' }).baseUrl).toBe('https://gw.example/v1');
  });
});

describe('HTTP provider', () => {
  it('returns validated structured output with usage and latency', async () => {
    const { instance, requests } = provider(() => response(200, openaiBody('```json\n{"overview":"Hello","currentRelationship":"x","recentActivity":[],"openItems":[],"risks":[],"nextBestAction":"call","insufficientData":false,"citedRecordIds":["a"]}\n```')));
    const result = await instance.structuredOutput({ purpose: LEAD_SUMMARY_PROMPT.id, system: LEAD_SUMMARY_PROMPT.system, user: 'ctx', json: true }, LEAD_SUMMARY_PROMPT.validate);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.overview).toBe('Hello');
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
      expect(result.attempts).toBe(1);
    }

    const sent = JSON.parse(String(requests[0]!.init.body)) as { response_format?: { type: string }; max_tokens: number; messages: { role: string }[] };

    expect(sent.response_format).toEqual({ type: 'json_object' });
    expect(sent.max_tokens).toBeLessThanOrEqual(900);
    expect(requests[0]!.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(String((requests[0]!.init.headers as Record<string, string>).Authorization)).toBe('Bearer test-key');
  });

  it('malformed JSON → AI_INVALID_RESPONSE, no retry', async () => {
    const { instance, calls } = provider(() => response(200, openaiBody('Sure! Here is {not json')));
    const result = await instance.structuredOutput({ purpose: 'x', system: 's', user: 'u' }, LEAD_SUMMARY_PROMPT.validate);

    expect(result).toMatchObject({ ok: false, code: 'AI_INVALID_RESPONSE' });
    expect(calls()).toBe(1);
  });

  it('valid JSON that fails the schema → AI_INVALID_RESPONSE', async () => {
    const { instance } = provider(() => response(200, openaiBody('{"foo": 1}')));
    const result = await instance.structuredOutput({ purpose: 'x', system: 's', user: 'u' }, LEAD_SUMMARY_PROMPT.validate);

    expect(result).toMatchObject({ ok: false, code: 'AI_INVALID_RESPONSE' });
    expect(result.ok ? '' : result.message).toMatch(/overview/);
  });

  it('empty response → AI_EMPTY_RESPONSE', async () => {
    const { instance } = provider(() => response(200, openaiBody('   ')));

    expect(await instance.generateText({ purpose: 'x', system: 's', user: 'u' })).toMatchObject({ ok: false, code: 'AI_EMPTY_RESPONSE' });
  });

  it('rate limit is retried with backoff, then succeeds', async () => {
    const { instance, calls } = provider((call) => (call === 1 ? response(429, '{}') : response(200, openaiBody('done'))));
    const result = await instance.generateText({ purpose: 'x', system: 's', user: 'u' });

    expect(result.ok).toBe(true);
    expect(calls()).toBe(2);
    expect(result.attempts).toBe(2);
  });

  it('an exhausted credit balance (429 insufficient_quota) is not retried → AI_QUOTA_EXHAUSTED', async () => {
    const { instance, calls } = provider(() => response(429, '{"error":{"message":"You have no credits remaining.","type":"insufficient_quota","code":"credit_balance_exhausted"}}'));
    const result = await instance.generateText({ purpose: 'x', system: 's', user: 'u' });

    expect(result).toMatchObject({ ok: false, code: 'AI_QUOTA_EXHAUSTED', attempts: 1, retryable: false });
    expect(calls()).toBe(1);
  });

  it('persistent provider errors exhaust the retry budget → AI_RETRY_EXHAUSTED', async () => {
    const { instance, calls } = provider(() => response(503, 'down'));
    const result = await instance.generateText({ purpose: 'x', system: 's', user: 'u' });

    expect(result).toMatchObject({ ok: false, code: 'AI_RETRY_EXHAUSTED', attempts: 3, retryable: true });
    expect(calls()).toBe(3);
  });

  it('a timeout aborts the request and is retried up to the budget', async () => {
    const { instance, calls } = provider((_call, init) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))), { timeoutMs: 50, maxRetries: 1 });
    const result = await instance.generateText({ purpose: 'x', system: 's', user: 'u' });

    expect(result.ok).toBe(false);
    expect(['AI_TIMEOUT', 'AI_RETRY_EXHAUSTED']).toContain(result.ok ? '' : result.code);
    expect(calls()).toBe(2);
  });

  it('bad credentials are not retried → AI_REQUEST_REJECTED', async () => {
    const { instance, calls } = provider(() => response(401, '{}'));

    expect(await instance.generateText({ purpose: 'x', system: 's', user: 'u' })).toMatchObject({ ok: false, code: 'AI_REQUEST_REJECTED', retryable: false });
    expect(calls()).toBe(1);
  });

  it('network failure → AI_UNAVAILABLE (retryable)', async () => {
    const { instance } = provider(() => Promise.reject(new Error('ECONNREFUSED')), { maxRetries: 0 });

    expect(await instance.generateText({ purpose: 'x', system: 's', user: 'u' })).toMatchObject({ ok: false, code: 'AI_UNAVAILABLE', attempts: 1 });
  });

  it('classify only accepts allowed labels', async () => {
    const good = provider(() => response(200, openaiBody('{"label":"stay","confidence":0.8,"reasoning":"villa"}')));
    const result = await good.instance.classify({ purpose: 'c', system: 's', user: 'u', labels: ['STAY', 'EXPERIENCE'] as const });

    expect(result.ok && result.value).toMatchObject({ label: 'STAY', confidence: 0.8 });

    const bad = provider(() => response(200, openaiBody('{"label":"HOTEL","confidence":0.9}')));

    expect(await bad.instance.classify({ purpose: 'c', system: 's', user: 'u', labels: ['STAY'] as const })).toMatchObject({ ok: false, code: 'AI_INVALID_RESPONSE' });
  });

  it('speaks the Anthropic dialect', async () => {
    const { instance, requests } = provider(() => response(200, JSON.stringify({ content: [{ type: 'text', text: '{"subject":"Hi","body":"Hello","placeholders":[]}' }], usage: { input_tokens: 3, output_tokens: 2 } })), {
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-3-5-haiku-latest',
    });
    const result = await instance.structuredOutput({ purpose: DRAFT_PROMPT.id, system: DRAFT_PROMPT.system, user: 'u' }, DRAFT_PROMPT.validate);

    expect(result.ok && result.value.body).toBe('Hello');
    expect(requests[0]!.url).toBe('https://api.anthropic.com/v1/messages');
    expect((requests[0]!.init.headers as Record<string, string>)['x-api-key']).toBe('test-key');
  });
});

describe('Gemini dialect (mock transport — the REAL provider test is lv-ai-real-provider.integration-test.ts)', () => {
  const geminiBody = (text: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP', ...extra }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 7 } });
  const gemini = (script: (call: number, init: RequestInit) => Promise<Response> | Response) =>
    provider(script, { provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash' });

  it('is the default provider when only a key is configured', () => {
    const config = readAiConfig({ LV_AI_API_KEY: 'k' });

    expect(config.provider).toBe('gemini');
    expect(config.model).toBe('gemini-3.6-flash');
    expect(config.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
  });

  it('sends the Gemini wire format: model in the path, key in a header, system instruction, JSON mime type, thinking off', async () => {
    const { instance, requests } = gemini(() => response(200, geminiBody('{"subject":"Hi","body":"Hello","placeholders":[]}')));
    const result = await instance.structuredOutput({ purpose: DRAFT_PROMPT.id, system: DRAFT_PROMPT.system, user: 'u', temperature: 0.1, maxOutputTokens: 200 }, DRAFT_PROMPT.validate);

    expect(result.ok && result.value.body).toBe('Hello');
    expect(result.ok && result.usage).toEqual({ inputTokens: 12, outputTokens: 7 });
    expect(requests[0]!.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    const headers = requests[0]!.init.headers as Record<string, string>;

    expect(headers['x-goog-api-key']).toBe('test-key');
    expect(headers.Authorization).toBeUndefined();
    const body = JSON.parse(String(requests[0]!.init.body)) as { systemInstruction: { parts: { text: string }[] }; contents: { role: string; parts: unknown[] }[]; generationConfig: Record<string, unknown> };

    expect(body.systemInstruction.parts[0]!.text).toBe(DRAFT_PROMPT.system);
    expect(body.contents[0]!.role).toBe('user');
    expect(body.generationConfig).toEqual({ maxOutputTokens: 200, temperature: 0.1, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: 'application/json' });
    expect(String(requests[0]!.init.body)).not.toContain('test-key');
  });

  it('carries images as inlineData parts after the text', async () => {
    const { instance, requests } = gemini(() => response(200, geminiBody('ok')));

    await instance.generateText({ purpose: 'x', system: 's', user: 'read the card', images: [{ mimeType: 'image/png', base64: 'AAAA' }] });
    const body = JSON.parse(String(requests[0]!.init.body)) as { contents: { parts: Record<string, unknown>[] }[] };

    expect(body.contents[0]!.parts).toEqual([{ text: 'read the card' }, { inlineData: { mimeType: 'image/png', data: 'AAAA' } }]);
  });

  it('maps an invalid key (400 API_KEY_INVALID) to AI_REQUEST_REJECTED without retry', async () => {
    const { instance, calls } = gemini(() => response(400, JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } })));
    const result = await instance.generateText({ purpose: 'x', system: 's', user: 'u' });

    expect(result).toMatchObject({ ok: false, code: 'AI_REQUEST_REJECTED', attempts: 1, retryable: false });
    expect(calls()).toBe(1);
  });

  it('treats a per-minute 429 RESOURCE_EXHAUSTED as a retryable rate limit, then succeeds', async () => {
    const perMinute = { error: { code: 429, message: 'You exceeded your current quota, please check your plan and billing details.', status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] }] } };
    const { instance, calls } = gemini((call) => (call === 1 ? response(429, JSON.stringify(perMinute)) : response(200, geminiBody('done'))));
    const result = await instance.generateText({ purpose: 'x', system: 's', user: 'u' });

    expect(result.ok).toBe(true);
    expect(calls()).toBe(2);
  });

  it('waits for the vendor retry hint (capped) before retrying a rate limit', async () => {
    const waits: number[] = [];
    const script = (call: number) => (call === 1 ? response(429, JSON.stringify({ error: { code: 429, message: 'You exceeded your current quota. Please retry in 6.283s.', status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '6s' }] } })) : response(200, geminiBody('done')));
    const instance = new HttpChatProvider({ dialect: 'gemini', config: config({ provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.6-flash' }), fetchImpl: (() => { let calls = 0; return async () => script(++calls); })(), sleep: async (ms) => { waits.push(ms); } });
    const result = await instance.generateText({ purpose: 'x', system: 's', user: 'u' });

    expect(result.ok).toBe(true);
    expect(waits).toEqual([6250]);
  });

  it('treats a per-day 429 as AI_QUOTA_EXHAUSTED without retry', async () => {
    const perDay = { error: { code: 429, message: 'You exceeded your current quota, please check your plan and billing details.', status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } };
    const { instance, calls } = gemini(() => response(429, JSON.stringify(perDay)));
    const result = await instance.generateText({ purpose: 'x', system: 's', user: 'u' });

    expect(result).toMatchObject({ ok: false, code: 'AI_QUOTA_EXHAUSTED', attempts: 1, retryable: false });
    expect(calls()).toBe(1);
  });

  it('a safety block is a rejected request; a token-capped answer is an invalid response; an empty candidate is empty', async () => {
    const blocked = gemini(() => response(200, JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] })));

    expect(await blocked.instance.generateText({ purpose: 'x', system: 's', user: 'u' })).toMatchObject({ ok: false, code: 'AI_REQUEST_REJECTED' });

    const capped = gemini(() => response(200, geminiBody('{"subject": "Hi", "bo', { finishReason: 'MAX_TOKENS' })));

    expect(await capped.instance.structuredOutput({ purpose: 'x', system: 's', user: 'u' }, DRAFT_PROMPT.validate)).toMatchObject({ ok: false, code: 'AI_INVALID_RESPONSE' });

    const empty = gemini(() => response(200, JSON.stringify({ candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] })));

    expect(await empty.instance.generateText({ purpose: 'x', system: 's', user: 'u' })).toMatchObject({ ok: false, code: 'AI_EMPTY_RESPONSE' });
  });

  it('retries once without the thinking config when a model refuses it (400 INVALID_ARGUMENT), and remembers', async () => {
    const { instance, requests } = gemini((call) => (call === 1 ? response(400, JSON.stringify({ error: { code: 400, message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT' } })) : response(200, geminiBody('ok'))));
    const first = await instance.generateText({ purpose: 'x', system: 's', user: 'u' });

    expect(first.ok).toBe(true);
    expect(requests).toHaveLength(2);
    expect(String(requests[0]!.init.body)).toContain('thinkingConfig');
    expect(String(requests[1]!.init.body)).not.toContain('thinkingConfig');
    await instance.generateText({ purpose: 'x', system: 's', user: 'u' });
    expect(requests).toHaveLength(3);
    expect(String(requests[2]!.init.body)).not.toContain('thinkingConfig');
  });

  it('never sends the thinking config to a lite model', async () => {
    const { instance, requests } = provider(() => response(200, geminiBody('ok')), { provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.5-flash-lite' });

    await instance.generateText({ purpose: 'x', system: 's', user: 'u' });
    expect(String(requests[0]!.init.body)).not.toContain('thinkingConfig');
  });

  it('validates structured output against the prompt schema exactly as for any other dialect', async () => {
    const { instance } = gemini(() => response(200, geminiBody('{"category":"STAY","confidence":0.9}')));
    const result = await instance.structuredOutput({ purpose: DRAFT_PROMPT.id, system: DRAFT_PROMPT.system, user: 'u' }, DRAFT_PROMPT.validate);

    expect(result).toMatchObject({ ok: false, code: 'AI_INVALID_RESPONSE' });
  });

  it('classification labels outside the allowlist are refused for Gemini too', async () => {
    const { instance } = gemini(() => response(200, geminiBody('{"label":"HOTEL","confidence":0.8,"reasoning":"x"}')));
    const result = await instance.classify({ purpose: 'x', system: 's', user: 'u', labels: ['STAY', 'EXPERIENCE'] as const });

    expect(result).toMatchObject({ ok: false, code: 'AI_INVALID_RESPONSE' });
  });
});

describe('structured output helpers', () => {
  it('extracts JSON from prose and fences', () => {
    expect(extractJson('Answer:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go {"a":[1,2]} thanks')).toEqual({ a: [1, 2] });
    expect(extractJson('no json here')).toBeUndefined();
  });

  it('normalises confidence and enums', () => {
    expect(confidence01(91)).toBe(0.91);
    expect(confidence01(0.5)).toBe(0.5);
    expect(confidence01('high')).toBeNull();
    expect(confidence01(170)).toBeNull();
    expect(oneOf('negative', ['POSITIVE', 'NEGATIVE'] as const)).toBe('NEGATIVE');
    expect(oneOf('angry', ['POSITIVE', 'NEGATIVE'] as const)).toBeNull();
  });
});

describe('prompt registry', () => {
  it('every prompt carries a versioned id and the registry maps them uniquely', () => {
    const prompts = [LEAD_SUMMARY_PROMPT, LEAD_CLASSIFICATION_PROMPT, CONVERSATION_SUMMARY_PROMPT, MORNING_BRIEFING_PROMPT, DRAFT_PROMPT, ONBOARDING_ASSIST_PROMPT, COPILOT_INTENT_PROMPT];

    for (const prompt of prompts) {
      expect(prompt.id).toMatch(/-v\d+$/);
      expect(prompt.system).toContain('Never invent');
      expect(prompt.maxOutputTokens).toBeLessThanOrEqual(900);
    }

    expect(new Set(Object.values(PROMPT_VERSIONS)).size).toBe(Object.values(PROMPT_VERSIONS).length);
  });

  it('conversation summary validator bounds and normalises the output', () => {
    const validated = CONVERSATION_SUMMARY_PROMPT.validate({
      summary: 'Talked pricing',
      sentiment: 'furious',
      commitments: [{ text: 'send brochure', certainty: 'maybe' }],
      objections: [{ category: 'money', text: 'too expensive', confidence: 75 }],
      followUpDateSuggestion: 'next week',
      problemSuggestions: new Array(10).fill({ type: 'PRICING', severity: 'HIGH', description: 'x' }),
    });

    expect(validated.ok).toBe(true);

    if (validated.ok) {
      expect(validated.value.sentiment).toBe('UNCLEAR');
      expect(validated.value.commitments[0]).toEqual({ text: 'send brochure', certainty: 'UNCERTAIN' });
      expect(validated.value.objections[0]).toMatchObject({ category: 'OTHER', confidence: 0.75 });
      expect(validated.value.followUpDateSuggestion).toBeNull();
      expect(validated.value.problemSuggestions).toHaveLength(3);
    }
  });
});

describe('Day 8 · images in a request (vision OCR)', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  it('OpenAI dialect sends the image as an image_url data URI alongside the text', async () => {
    const p = provider(() => response(200, openaiBody('{"ok":true}')));
    const result = await p.instance.generateText({ purpose: 'capture', system: 'read the card', user: 'JSON please', images: [{ mimeType: 'image/png', base64: png }] });

    expect(result.ok).toBe(true);
    const body = JSON.parse(String(p.requests[0]!.init.body)) as { messages: { role: string; content: unknown }[] };
    const user = body.messages.find((message) => message.role === 'user')!;

    expect(Array.isArray(user.content)).toBe(true);
    expect(user.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'JSON please' }), expect.objectContaining({ type: 'image_url', image_url: expect.objectContaining({ url: `data:image/png;base64,${png}` }) })]));
  });

  it('Anthropic dialect sends the image as a base64 source part', async () => {
    const p = provider(() => response(200, JSON.stringify({ content: [{ type: 'text', text: '{"ok":true}' }], usage: { input_tokens: 1, output_tokens: 1 } })), { provider: 'anthropic' });
    const result = await p.instance.generateText({ purpose: 'capture', system: 'read the card', user: 'JSON please', images: [{ mimeType: 'image/png', base64: png }] });

    expect(result.ok).toBe(true);
    const body = JSON.parse(String(p.requests[0]!.init.body)) as { messages: { role: string; content: unknown }[] };
    const user = body.messages.find((message) => message.role === 'user')!;

    expect(user.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: png } }), expect.objectContaining({ type: 'text', text: 'JSON please' })]));
  });

  it('without images the user content stays a plain string (Day 6 requests unchanged)', async () => {
    const p = provider(() => response(200, openaiBody('{"ok":true}')));

    await p.instance.generateText({ purpose: 'x', system: 's', user: 'plain' });
    const body = JSON.parse(String(p.requests[0]!.init.body)) as { messages: { role: string; content: unknown }[] };

    expect(body.messages.find((message) => message.role === 'user')!.content).toBe('plain');
  });
});
