import { type AiConfig, isAiConfigured, readAiConfig } from 'src/modules/lv-ai/config/ai-config';
import {
  type AiProvider,
  type AiRequest,
  type AiResult,
  type ClassifyRequest,
  type ClassifyResult,
  failure,
  type OutputValidator,
  type SummarizeRequest,
} from 'src/modules/lv-ai/provider/ai-provider';
import { type Dialect, HttpChatProvider, type HttpProviderOptions } from 'src/modules/lv-ai/provider/http-provider';

// Which wire format a configured provider kind speaks. Everything above this
// line is provider-agnostic; switching vendors is a configuration change.
export const dialectFor = (provider: AiConfig['provider']): Dialect => (provider === 'gemini' ? 'gemini' : provider === 'anthropic' ? 'anthropic' : 'openai');

// The provider that answers when nothing is configured. Every verb fails
// with AI_UNAVAILABLE immediately — no network, no delay, no fabricated text.
export class UnavailableProvider implements AiProvider {
  readonly name = 'none';
  readonly model = null;
  readonly available = false;

  constructor(private readonly reason: string) {}

  private refuse<T>(): Promise<AiResult<T>> {
    return Promise.resolve(failure('AI_UNAVAILABLE', this.reason, { provider: 'none', model: null }));
  }

  generateText(_request: AiRequest): Promise<AiResult<string>> {
    return this.refuse();
  }

  structuredOutput<T>(_request: AiRequest, _validate: OutputValidator<T>): Promise<AiResult<T>> {
    return this.refuse();
  }

  classify<T extends string>(_request: ClassifyRequest<T>): Promise<AiResult<ClassifyResult<T>>> {
    return this.refuse();
  }

  summarize(_request: SummarizeRequest): Promise<AiResult<string>> {
    return this.refuse();
  }
}

export const createAiProvider = (
  config: AiConfig = readAiConfig(),
  transport: Pick<HttpProviderOptions, 'fetchImpl' | 'sleep'> = {},
): AiProvider => {
  if (!isAiConfigured(config)) {
    return new UnavailableProvider('No AI provider is configured for this workspace.');
  }

  return new HttpChatProvider({
    dialect: dialectFor(config.provider),
    config,
    ...transport,
  });
};
