// The one real provider: an HTTP chat-completion client with two dialects —
// OpenAI-compatible (`/chat/completions`, which also covers gateways such as
// OpenRouter, Groq, Mistral, or a private proxy) and Anthropic (`/messages`).
//
// Bounded by construction: a timeout on every call, a hard cap on output
// tokens, a retry budget that applies only to retryable failures (429, 5xx,
// network, timeout) with exponential backoff, and structured responses that
// are validated before anyone sees them. The API key lives in a closure and is
// never included in an error message.

import { type AiConfig } from 'src/modules/lv-ai/config/ai-config';
import {
  type AiFailure,
  type AiProvider,
  type AiRequest,
  type AiResult,
  type AiUsage,
  type ClassifyRequest,
  type ClassifyResult,
  failure,
  type OutputValidator,
  type SummarizeRequest,
} from 'src/modules/lv-ai/provider/ai-provider';
import { confidence01, extractJson, isRecord, optionalString } from 'src/modules/lv-ai/provider/structured-output';

export type Dialect = 'openai' | 'anthropic';

type Transport = (url: string, init: RequestInit) => Promise<Response>;

type Attempt =
  | { ok: true; text: string; usage: AiUsage }
  | { ok: false; code: AiFailure['code']; message: string; retryable: boolean };

export type HttpProviderOptions = {
  dialect: Dialect;
  config: AiConfig;
  fetchImpl?: Transport;
  // Injectable for tests so retries do not really sleep.
  sleep?: (ms: number) => Promise<void>;
};

const BACKOFF_BASE_MS = 400;

export class HttpChatProvider implements AiProvider {
  readonly name: string;
  readonly model: string;
  readonly available = true;
  private readonly dialect: Dialect;
  private readonly config: AiConfig;
  private readonly transport: Transport;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: HttpProviderOptions) {
    this.dialect = options.dialect;
    this.config = options.config;
    this.name = options.config.provider;
    this.model = options.config.model;
    this.transport = options.fetchImpl ?? ((url, init) => fetch(url, init));
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async generateText(request: AiRequest): Promise<AiResult<string>> {
    return this.run(request, (text) => ({ ok: true, value: text }));
  }

  async structuredOutput<T>(request: AiRequest, validate: OutputValidator<T>): Promise<AiResult<T>> {
    return this.run({ ...request, json: true }, (text) => {
      const parsed = extractJson(text);

      if (parsed === undefined) {
        return { ok: false, error: 'The model did not return JSON.' };
      }

      return validate(parsed);
    });
  }

  async classify<T extends string>(request: ClassifyRequest<T>): Promise<AiResult<ClassifyResult<T>>> {
    const labels = request.labels.join(', ');
    const noneClause = request.allowNone === false ? '' : ' Use null when none of the labels fits or the evidence is insufficient.';

    return this.structuredOutput<ClassifyResult<T>>(
      {
        purpose: request.purpose,
        system: `${request.system}\nRespond with JSON only: {"label": one of [${labels}] or null, "confidence": number 0..1, "reasoning": short string}.${noneClause}`,
        user: request.user,
        json: true,
        maxOutputTokens: 300,
      },
      (candidate) => {
        if (!isRecord(candidate)) {
          return { ok: false, error: 'Expected an object.' };
        }

        const raw = typeof candidate.label === 'string' ? candidate.label.trim().toUpperCase() : null;
        const label = raw !== null && (request.labels as readonly string[]).includes(raw) ? (raw as T) : null;

        if (raw !== null && label === null) {
          return { ok: false, error: `Label "${raw}" is not one of the allowed labels.` };
        }

        return {
          ok: true,
          value: { label, confidence: confidence01(candidate.confidence), reasoning: optionalString(candidate.reasoning, 600) ?? '' },
        };
      },
    );
  }

  async summarize(request: SummarizeRequest): Promise<AiResult<string>> {
    return this.generateText({ purpose: request.purpose, system: request.system, user: request.user, maxOutputTokens: request.maxOutputTokens });
  }

  // ---------------------------------------------------------------------
  private async run<T>(request: AiRequest, finish: (text: string) => { ok: true; value: T } | { ok: false; error: string }): Promise<AiResult<T>> {
    const startedAt = Date.now();
    const maxAttempts = this.config.maxRetries + 1;
    let attempts = 0;
    let last: Attempt | null = null;

    while (attempts < maxAttempts) {
      attempts += 1;
      last = await this.attempt(request);

      if (last.ok) {
        if (last.text.trim().length === 0) {
          return failure('AI_EMPTY_RESPONSE', 'The model returned an empty response.', this.meta(startedAt, attempts));
        }

        const finished = finish(last.text);

        if (!finished.ok) {
          return failure('AI_INVALID_RESPONSE', finished.error, this.meta(startedAt, attempts));
        }

        return {
          ok: true,
          value: finished.value,
          rawText: last.text,
          provider: this.name,
          model: this.model,
          usage: last.usage,
          latencyMs: Date.now() - startedAt,
          attempts,
        };
      }

      if (!last.retryable || attempts >= maxAttempts) {
        break;
      }

      await this.sleep(BACKOFF_BASE_MS * 2 ** (attempts - 1));
    }

    if (last && !last.ok) {
      const exhausted = last.retryable && attempts >= maxAttempts && this.config.maxRetries > 0;

      return failure(exhausted ? 'AI_RETRY_EXHAUSTED' : last.code, last.message, { ...this.meta(startedAt, attempts), retryable: last.retryable });
    }

    return failure('AI_PROVIDER_ERROR', 'No attempt was made.', this.meta(startedAt, attempts));
  }

  private meta(startedAt: number, attempts: number) {
    return { provider: this.name, model: this.model, latencyMs: Date.now() - startedAt, attempts };
  }

  private async attempt(request: AiRequest): Promise<Attempt> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const maxOutputTokens = Math.min(request.maxOutputTokens ?? this.config.maxOutputTokens, this.config.maxOutputTokens);
    const temperature = request.temperature ?? this.config.temperature;

    try {
      const { url, init } = this.dialect === 'anthropic' ? this.anthropicRequest(request, maxOutputTokens, temperature) : this.openaiRequest(request, maxOutputTokens, temperature);
      const response = await this.transport(url, { ...init, signal: controller.signal });

      if (response.status === 429) {
        return { ok: false, code: 'AI_RATE_LIMITED', message: 'The AI provider is rate limiting requests.', retryable: true };
      }

      if (response.status === 401 || response.status === 403) {
        return { ok: false, code: 'AI_REQUEST_REJECTED', message: 'The AI provider rejected the credentials.', retryable: false };
      }

      if (response.status >= 500) {
        return { ok: false, code: 'AI_PROVIDER_ERROR', message: `The AI provider failed (${response.status}).`, retryable: true };
      }

      if (!response.ok) {
        return { ok: false, code: 'AI_REQUEST_REJECTED', message: `The AI provider rejected the request (${response.status}).`, retryable: false };
      }

      let body: unknown;

      try {
        body = await response.json();
      } catch {
        return { ok: false, code: 'AI_INVALID_RESPONSE', message: 'The AI provider returned a non-JSON body.', retryable: false };
      }

      return this.dialect === 'anthropic' ? this.readAnthropic(body) : this.readOpenai(body);
    } catch {
      if (controller.signal.aborted) {
        return { ok: false, code: 'AI_TIMEOUT', message: `The AI provider did not answer within ${this.config.timeoutMs} ms.`, retryable: true };
      }

      return { ok: false, code: 'AI_UNAVAILABLE', message: 'The AI provider could not be reached.', retryable: true };
    } finally {
      clearTimeout(timer);
    }
  }

  private openaiRequest(request: AiRequest, maxOutputTokens: number, temperature: number): { url: string; init: RequestInit } {
    const images = request.images ?? [];
    const userContent =
      images.length === 0
        ? request.user
        : [{ type: 'text', text: request.user }, ...images.map((image) => ({ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } }))];
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: userContent },
      ],
      max_tokens: maxOutputTokens,
      temperature,
    };

    if (request.json) {
      body.response_format = { type: 'json_object' };
    }

    return {
      url: `${this.config.baseUrl}/chat/completions`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey ?? ''}` },
        body: JSON.stringify(body),
      },
    };
  }

  private anthropicRequest(request: AiRequest, maxOutputTokens: number, temperature: number): { url: string; init: RequestInit } {
    return {
      url: `${this.config.baseUrl}/messages`,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey ?? '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          system: request.json ? `${request.system}\nRespond with a single JSON object and nothing else.` : request.system,
          messages: [
            {
              role: 'user',
              content:
                (request.images ?? []).length === 0
                  ? request.user
                  : [...(request.images ?? []).map((image) => ({ type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } })), { type: 'text', text: request.user }],
            },
          ],
          max_tokens: maxOutputTokens,
          temperature,
        }),
      },
    };
  }

  private readOpenai(body: unknown): Attempt {
    if (!isRecord(body)) {
      return { ok: false, code: 'AI_INVALID_RESPONSE', message: 'Unexpected provider response.', retryable: false };
    }

    const choices = Array.isArray(body.choices) ? body.choices : [];
    const first = isRecord(choices[0]) ? choices[0] : null;
    const message = first && isRecord(first.message) ? first.message : null;
    const content = message?.content;
    const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : '')).join('') : '';
    const usage = isRecord(body.usage) ? body.usage : {};

    return {
      ok: true,
      text,
      usage: {
        inputTokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : null,
        outputTokens: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : null,
      },
    };
  }

  private readAnthropic(body: unknown): Attempt {
    if (!isRecord(body)) {
      return { ok: false, code: 'AI_INVALID_RESPONSE', message: 'Unexpected provider response.', retryable: false };
    }

    const content = Array.isArray(body.content) ? body.content : [];
    const text = content.map((part) => (isRecord(part) && part.type === 'text' && typeof part.text === 'string' ? part.text : '')).join('');
    const usage = isRecord(body.usage) ? body.usage : {};

    return {
      ok: true,
      text,
      usage: {
        inputTokens: typeof usage.input_tokens === 'number' ? usage.input_tokens : null,
        outputTokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : null,
      },
    };
  }
}
