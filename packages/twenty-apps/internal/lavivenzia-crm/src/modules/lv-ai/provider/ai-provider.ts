// The provider abstraction every AI operation goes through. Nothing else in
// the application knows which vendor is behind it, and nothing calls a vendor
// API directly.
//
// Four verbs, one transport: `generateText` and `structuredOutput` are the
// primitives; `classify` and `summarize` are conveniences that shape a
// structured request. A provider never throws for a model-side problem — it
// returns a typed failure the caller can record and show as AI_UNAVAILABLE,
// AI_TIMEOUT, and so on.

export const AI_FAILURE_CODES = [
  'AI_UNAVAILABLE',
  'AI_TIMEOUT',
  'AI_RATE_LIMITED',
  'AI_INVALID_RESPONSE',
  'AI_EMPTY_RESPONSE',
  'AI_RETRY_EXHAUSTED',
  'AI_REQUEST_REJECTED',
  'AI_PROVIDER_ERROR',
] as const;

export type AiFailureCode = (typeof AI_FAILURE_CODES)[number];

export type AiUsage = { inputTokens: number | null; outputTokens: number | null };

export type AiRequest = {
  // A stable, human-readable purpose — the prompt id (e.g. lead-summary-v1).
  purpose: string;
  system: string;
  user: string;
  maxOutputTokens?: number;
  temperature?: number;
  // When true the provider asks for JSON and the caller parses/validates it.
  json?: boolean;
  // Day 8: images the model should look at (visiting cards). Sent inline as
  // base64; the caller has already bounded their size and type. A provider
  // whose model cannot see images answers AI_INVALID_RESPONSE rather than
  // guessing.
  images?: readonly AiImageInput[];
};

export type AiImageInput = { mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string };

export type AiSuccess<T> = {
  ok: true;
  value: T;
  rawText: string;
  provider: string;
  model: string;
  usage: AiUsage;
  latencyMs: number;
  attempts: number;
};

export type AiFailure = {
  ok: false;
  code: AiFailureCode;
  message: string;
  provider: string;
  model: string | null;
  latencyMs: number;
  attempts: number;
  retryable: boolean;
};

export type AiResult<T> = AiSuccess<T> | AiFailure;

// A validator turns the model's JSON into a typed value or explains why not.
export type OutputValidator<T> = (candidate: unknown) => { ok: true; value: T } | { ok: false; error: string };

export type ClassifyRequest<T extends string> = {
  purpose: string;
  system: string;
  user: string;
  labels: readonly T[];
  allowNone?: boolean;
};

export type ClassifyResult<T extends string> = { label: T | null; confidence: number | null; reasoning: string };

export type SummarizeRequest = { purpose: string; system: string; user: string; maxOutputTokens?: number };

export interface AiProvider {
  readonly name: string;
  readonly model: string | null;
  readonly available: boolean;
  generateText(request: AiRequest): Promise<AiResult<string>>;
  structuredOutput<T>(request: AiRequest, validate: OutputValidator<T>): Promise<AiResult<T>>;
  classify<T extends string>(request: ClassifyRequest<T>): Promise<AiResult<ClassifyResult<T>>>;
  summarize(request: SummarizeRequest): Promise<AiResult<string>>;
}

export const failure = (
  code: AiFailureCode,
  message: string,
  extra: { provider: string; model: string | null; latencyMs?: number; attempts?: number; retryable?: boolean },
): AiFailure => ({
  ok: false,
  code,
  message,
  provider: extra.provider,
  model: extra.model,
  latencyMs: extra.latencyMs ?? 0,
  attempts: extra.attempts ?? 0,
  retryable: extra.retryable ?? false,
});
