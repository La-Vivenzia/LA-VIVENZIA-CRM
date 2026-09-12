// JSON extraction and validation helpers for structured model output.
//
// Models wrap JSON in prose or code fences more often than not; this pulls
// the first JSON object or array out of the text and leaves validation to the
// caller's validator. Nothing here repairs semantics — a response that fails
// validation is AI_INVALID_RESPONSE, never silently coerced.

import { type OutputValidator } from 'src/modules/lv-ai/provider/ai-provider';

export const extractJson = (text: string): unknown | undefined => {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1]?.trim(), trimmed];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      return JSON.parse(candidate);
    } catch {
      // fall through to a bracket scan
    }

    const start = Math.min(...['{', '['].map((char) => candidate.indexOf(char)).filter((index) => index >= 0));

    if (!Number.isFinite(start)) {
      continue;
    }

    const opener = candidate[start];
    const closer = opener === '{' ? '}' : ']';
    const end = candidate.lastIndexOf(closer);

    if (end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        // not JSON after all
      }
    }
  }

  return undefined;
};

// Small validator combinators — enough for the prompt schemas without a
// dependency.
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const optionalString = (value: unknown, maxLength = 2_000): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, maxLength) : null;

export const requiredString = (value: unknown, maxLength = 2_000): string | undefined => {
  const result = optionalString(value, maxLength);

  return result ?? undefined;
};

export const stringList = (value: unknown, maxItems = 10, maxLength = 400): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .slice(0, maxItems)
        .map((item) => item.trim().slice(0, maxLength))
    : [];

// Confidence is accepted as 0..1 or 0..100 and normalised to 0..1; anything
// else is "no confidence stated".
export const confidence01 = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalised = value > 1 ? value / 100 : value;

  return normalised < 0 || normalised > 1 ? null : Math.round(normalised * 100) / 100;
};

export const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value.toUpperCase()) ? (value.toUpperCase() as T) : null;

export const objectValidator = <T>(build: (record: Record<string, unknown>) => T | string): OutputValidator<T> => (candidate) => {
  if (!isRecord(candidate)) {
    return { ok: false, error: 'Expected a JSON object.' };
  }

  const result = build(candidate);

  return typeof result === 'string' ? { ok: false, error: result } : { ok: true, value: result };
};
