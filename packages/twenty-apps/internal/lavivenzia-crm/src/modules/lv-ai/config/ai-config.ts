// AI provider configuration, read from the application variables Twenty
// injects into the logic functions (Settings → Applications → La Vivenzia
// CRM). The API key is a secret variable: it never reaches the browser and is
// never written to a record or a log.
//
// With no key the CRM runs exactly as before; every AI operation answers
// AI_UNAVAILABLE and nothing pretends otherwise.

// Day 10: `gemini` (Google Generative Language API) is the primary provider.
export const AI_PROVIDER_KINDS = ['gemini', 'openai', 'openai-compatible', 'anthropic', 'none'] as const;

export type AiProviderKind = (typeof AI_PROVIDER_KINDS)[number];

export type AiConfig = {
  provider: AiProviderKind;
  apiKey: string | null;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  maxRetries: number;
  temperature: number;
};

export const AI_DEFAULTS = {
  model: { gemini: 'gemini-3.6-flash', openai: 'gpt-4o-mini', 'openai-compatible': '', anthropic: 'claude-3-5-haiku-latest', none: '' },
  baseUrl: { gemini: 'https://generativelanguage.googleapis.com/v1beta', openai: 'https://api.openai.com/v1', 'openai-compatible': '', anthropic: 'https://api.anthropic.com/v1', none: '' },
  timeoutMs: 20_000,
  maxOutputTokens: 900,
  maxRetries: 2,
  temperature: 0.2,
} as const;

const HARD_LIMITS = {
  timeoutMs: { min: 2_000, max: 60_000 },
  maxOutputTokens: { min: 64, max: 4_000 },
  maxRetries: { min: 0, max: 5 },
  temperature: { min: 0, max: 1 },
};

const clamp = (raw: string | undefined, fallback: number, limits: { min: number; max: number }): number => {
  const parsed = raw === undefined || raw.trim() === '' ? Number.NaN : Number(raw);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(limits.max, Math.max(limits.min, parsed));
};

const isKind = (value: string): value is AiProviderKind => (AI_PROVIDER_KINDS as readonly string[]).includes(value);

export const readAiConfig = (env: Record<string, string | undefined> = process.env): AiConfig => {
  const requested = (env.LV_AI_PROVIDER ?? '').trim().toLowerCase();
  const apiKey = (env.LV_AI_API_KEY ?? '').trim() || null;
  // A key with no provider named means Gemini (the primary provider since Day 10).
  const provider: AiProviderKind = requested === '' ? (apiKey ? 'gemini' : 'none') : isKind(requested) ? requested : 'none';
  const baseUrl = ((env.LV_AI_BASE_URL ?? '').trim() || AI_DEFAULTS.baseUrl[provider]).replace(/\/+$/, '');
  const model = (env.LV_AI_MODEL ?? '').trim() || AI_DEFAULTS.model[provider];

  return {
    provider,
    apiKey,
    baseUrl,
    model,
    timeoutMs: clamp(env.LV_AI_TIMEOUT_MS, AI_DEFAULTS.timeoutMs, HARD_LIMITS.timeoutMs),
    maxOutputTokens: clamp(env.LV_AI_MAX_OUTPUT_TOKENS, AI_DEFAULTS.maxOutputTokens, HARD_LIMITS.maxOutputTokens),
    maxRetries: clamp(env.LV_AI_MAX_RETRIES, AI_DEFAULTS.maxRetries, HARD_LIMITS.maxRetries),
    temperature: clamp(env.LV_AI_TEMPERATURE, AI_DEFAULTS.temperature, HARD_LIMITS.temperature),
  };
};

// A provider is usable only with a kind, a key, a base URL and a model. An
// "openai-compatible" gateway must name all three explicitly.
export const isAiConfigured = (config: AiConfig): boolean =>
  config.provider !== 'none' && config.apiKey !== null && config.baseUrl.length > 0 && config.model.length > 0;

// What the browser may know about the configuration: never the key or URL.
export const describeAiAvailability = (config: AiConfig): { available: boolean; provider: AiProviderKind; model: string | null; reason: string | null } =>
  isAiConfigured(config)
    ? { available: true, provider: config.provider, model: config.model, reason: null }
    : {
        available: false,
        provider: config.provider,
        model: null,
        reason:
          config.provider === 'none' && config.apiKey === null
            ? 'No AI provider is configured (LV_AI_PROVIDER / LV_AI_API_KEY).'
            : 'The AI provider configuration is incomplete (provider, key, base URL and model are all required).',
      };
