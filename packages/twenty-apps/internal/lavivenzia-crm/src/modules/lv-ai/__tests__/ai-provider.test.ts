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
    dialect: overrides.provider === 'anthropic' ? 'anthropic' : 'openai',
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

    expect(cfg.provider).toBe('openai');
    expect(cfg.model).toBe(AI_DEFAULTS.model.openai);
    expect(cfg.baseUrl).toBe(AI_DEFAULTS.baseUrl.openai);
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
