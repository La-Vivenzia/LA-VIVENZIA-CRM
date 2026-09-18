// Retries `fetch` when the failure happened BEFORE any request was sent — a
// DNS lookup that did not answer (ENOTFOUND / EAI_AGAIN) or a refused
// connection. Nothing reached the server in those cases, so retrying a
// GraphQL mutation cannot duplicate a write.
//
// Why: in production the logic functions run as short-lived child processes
// on Alpine (musl resolver, no retry of its own); roughly one lookup in six
// of the CRM's own public hostname came back ENOTFOUND, which surfaced as
// "The dashboard could not be loaded". Installed once per process by the
// shared client modules; a no-op in the browser and when already installed.
const RETRYABLE = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED']);
const DELAYS_MS = [150, 400, 900];
const INSTALLED = Symbol.for('lv.resilientFetch');

const causeCode = (error: unknown): string | null => {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;

  return cause && typeof cause.code === 'string' ? cause.code : null;
};

export const isPreConnectionFailure = (error: unknown): boolean => RETRYABLE.has(causeCode(error) ?? '');

export const withRetry = (base: typeof fetch): typeof fetch => {
  const wrapped = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    let attempt = 0;

    for (;;) {
      try {
        return await base(input, init);
      } catch (error) {
        if (!isPreConnectionFailure(error) || attempt >= DELAYS_MS.length) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, DELAYS_MS[attempt]));
        attempt += 1;
      }
    }
  }) as typeof fetch;

  return wrapped;
};

export const installResilientFetch = (): void => {
  const g = globalThis as typeof globalThis & { [INSTALLED]?: boolean; window?: unknown };

  if (g[INSTALLED] || typeof g.fetch !== 'function' || typeof g.window !== 'undefined') {
    return;
  }

  g.fetch = withRetry(g.fetch.bind(g));
  g[INSTALLED] = true;
};

installResilientFetch();
