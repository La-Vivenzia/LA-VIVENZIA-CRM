import { describe, expect, it } from 'vitest';

import { isPreConnectionFailure, withRetry } from 'src/modules/lv-core/runtime/resilient-fetch';

const failWith = (code: string) => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error(code), { code }) });

describe('resilient fetch', () => {
  it('retries a DNS failure and returns the later success', async () => {
    let calls = 0;
    const base = (async () => {
      calls += 1;

      if (calls < 3) {
        throw failWith('ENOTFOUND');
      }

      return new Response('ok');
    }) as unknown as typeof fetch;
    const response = await withRetry(base)('https://example.invalid/');

    expect(await response.text()).toBe('ok');
    expect(calls).toBe(3);
  });

  it('gives up after the retry budget', async () => {
    let calls = 0;
    const base = (async () => {
      calls += 1;
      throw failWith('EAI_AGAIN');
    }) as unknown as typeof fetch;

    await expect(withRetry(base)('https://example.invalid/')).rejects.toThrow('fetch failed');
    expect(calls).toBe(4);
  });

  it('never retries once a connection may have carried the request (ECONNRESET, HTTP errors)', async () => {
    let calls = 0;
    const base = (async () => {
      calls += 1;
      throw failWith('ECONNRESET');
    }) as unknown as typeof fetch;

    await expect(withRetry(base)('https://example.invalid/')).rejects.toThrow();
    expect(calls).toBe(1);
    expect(isPreConnectionFailure(failWith('ECONNRESET'))).toBe(false);
    expect(isPreConnectionFailure(failWith('ENOTFOUND'))).toBe(true);
    expect(isPreConnectionFailure(new Error('plain'))).toBe(false);
  });
});
