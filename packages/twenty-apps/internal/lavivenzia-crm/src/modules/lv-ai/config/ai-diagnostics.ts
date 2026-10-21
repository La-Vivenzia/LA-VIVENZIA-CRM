import { type AiConfig, describeAiAvailability, isAiConfigured, readAiConfig } from 'src/modules/lv-ai/config/ai-config';

// What an operator may be told about the AI configuration.
//
// Everything here is safe to print, log, paste into a ticket or include in a
// report. The key itself never appears — not in full, not in part, not as a
// prefix. What the operator gets instead is a fingerprint: enough to confirm
// *which* key is live and to tell two keys apart, and not enough to
// reconstruct either.
//
// Where the values come from is worth saying plainly, because the chain has
// three links and the wrong one silently wins. A logic function reads
// `process.env` of its own sandbox, and the platform builds that sandbox env
// as, in increasing precedence:
//
//   1. the worker process's own environment (LOGIC_FUNCTION_TYPE=LOCAL spawns
//      a child with `{ ...process.env, ...applicationVariables }`)
//   2. applicationRegistrationVariable — per registration, empty values skipped
//   3. applicationVariable — per workspace, empty values NOT skipped
//
// That last asymmetry is the trap. An empty workspace variable still sets the
// key to '' in the sandbox, which shadows a perfectly good worker environment
// variable and reads back as "not configured". To fall back to the
// environment, the workspace variable has to be *absent*, not blank.

/**
 * A short, non-reversible fingerprint of the configured key.
 *
 * FNV-1a over the value, which is a hash rather than a truncation, so no
 * character of the key survives into the output. Two different keys give
 * different fingerprints; the same key always gives the same one.
 */
export const keyFingerprint = (apiKey: string | null): string | null => {
  if (apiKey === null || apiKey === '') {
    return null;
  }

  let hash = 0x811c9dc5;

  for (let index = 0; index < apiKey.length; index += 1) {
    hash ^= apiKey.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  // The length is included because it distinguishes a truncated paste from the
  // real thing, which is the most common configuration mistake.
  return `fp_${hash.toString(16).padStart(8, '0')}_${apiKey.length}`;
};

export type AiDiagnostics = {
  provider: AiConfig['provider'];
  model: string | null;
  apiKeyConfigured: boolean;
  /** Never the value. A fingerprint, or null when nothing is configured. */
  apiKeyFingerprint: string | null;
  /**
   * Which layer the sandbox could have taken it from. A logic function sees
   * only the merged environment, so this names the precedence rather than
   * claiming to know which link supplied the value.
   */
  apiKeySource: string;
  baseUrlConfigured: boolean;
  timeoutMs: number;
  maxOutputTokens: number;
  maxRetries: number;
  temperature: number;
  ready: boolean;
  /** The operator-facing reason when it is not ready. */
  reason: string | null;
};

const SOURCE_CHAIN =
  'sandbox environment — workspace applicationVariable (highest) > applicationRegistrationVariable > worker process environment (lowest)';

export const describeAiDiagnostics = (config: AiConfig = readAiConfig()): AiDiagnostics => {
  const availability = describeAiAvailability(config);

  return {
    provider: config.provider,
    model: config.model === '' ? null : config.model,
    apiKeyConfigured: config.apiKey !== null,
    apiKeyFingerprint: keyFingerprint(config.apiKey),
    apiKeySource: config.apiKey === null ? `not set in the ${SOURCE_CHAIN}` : SOURCE_CHAIN,
    baseUrlConfigured: config.baseUrl.length > 0,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens,
    maxRetries: config.maxRetries,
    temperature: config.temperature,
    ready: isAiConfigured(config),
    reason: availability.reason,
  };
};

/** A configuration error an operator can act on, with no secret in it. */
export const configurationError = (config: AiConfig = readAiConfig()): string | null => {
  if (isAiConfigured(config)) {
    return null;
  }

  if (config.apiKey === null) {
    return 'LV_AI_API_KEY is not set. Provision it as a workspace application variable for the La Vivenzia CRM application, or in the worker process environment with no workspace variable of that name present — a workspace variable set to an empty string shadows the environment and reads as missing.';
  }

  if (config.provider === 'none') {
    return 'LV_AI_PROVIDER is not one of gemini, openai, openai-compatible or anthropic.';
  }

  if (config.model === '') {
    return 'LV_AI_MODEL is empty and the provider has no default for it.';
  }

  return 'LV_AI_BASE_URL is empty and the provider has no default for it.';
};

/** How a probe turned out, in the operator's terms. */
export type ProbeOutcome =
  | 'CONFIGURATION_MISSING'
  | 'AUTHENTICATION_FAILED'
  | 'QUOTA_EXHAUSTED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_RESPONSE'
  | 'THROTTLED_LOCALLY'
  | 'SUCCESS';

/**
 * Map a provider failure code onto the outcome an operator needs to tell
 * apart. Deliberately total: an unmapped code becomes PROVIDER_UNAVAILABLE
 * rather than being reported as a success.
 */
export const probeOutcomeFor = (code: string | null, ok: boolean): ProbeOutcome => {
  if (ok) {
    return 'SUCCESS';
  }

  switch (code) {
    case 'AI_UNAVAILABLE':
      return 'CONFIGURATION_MISSING';
    case 'AI_REQUEST_REJECTED':
      return 'AUTHENTICATION_FAILED';
    case 'AI_QUOTA_EXHAUSTED':
      return 'QUOTA_EXHAUSTED';
    case 'AI_RATE_LIMITED':
      return 'RATE_LIMITED';
    case 'AI_TIMEOUT':
    case 'AI_RETRY_EXHAUSTED':
      return 'TIMEOUT';
    case 'AI_INVALID_RESPONSE':
    case 'AI_EMPTY_RESPONSE':
      return 'INVALID_RESPONSE';
    default:
      return 'PROVIDER_UNAVAILABLE';
  }
};

/** One sentence per outcome, for whoever is reading the result. */
export const PROBE_EXPLANATION: Record<ProbeOutcome, string> = {
  CONFIGURATION_MISSING: 'No provider is configured, so no request was made.',
  AUTHENTICATION_FAILED: 'The provider rejected the credentials. The key is present but not accepted.',
  QUOTA_EXHAUSTED: 'The key is valid and the provider was reached, but the project has no quota or billing remaining. This is a billing state, not a fault in the CRM.',
  RATE_LIMITED: 'The provider is rate limiting. The configuration is sound; the request was too soon after others.',
  TIMEOUT: 'The provider did not answer in time. Configuration is sound.',
  PROVIDER_UNAVAILABLE: 'The provider could not be reached at all — network, DNS or base URL.',
  INVALID_RESPONSE: 'The provider answered but not with what the model contract expects.',
  THROTTLED_LOCALLY: 'The CRM declined to call out: its own circuit breaker or rate limit is engaged.',
  SUCCESS: 'The provider answered and the response validated. AI is live.',
};
