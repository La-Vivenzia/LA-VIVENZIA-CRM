import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callRoute, onSessionExpired, setSession, isReachable, UNREACHABLE } from 'src/api/client';

// The failure contract of `callRoute`.
//
// These exist because of a real defect: the platform answers a dead
// logic-function sandbox with its own envelope — `{ statusCode: 500, code:
// 'ROUTE_TRIGGER_USER_UNCAUGHT_ERROR' }` — which carries no `ok` field at
// all. `callRoute` rejected only on `ok === false`, so that envelope was
// handed to screens as though it were data, and they read fields off an error
// object. The Messages draft dialog crashed on `undefined.matchAll` and
// blanked; every other screen since Phase 2 would have done something equally
// strange.
//
// The rule being locked down: a reply is data only when nothing about it says
// otherwise — not the body, and not the transport.

const reply = (body: unknown, status = 200) =>
  Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);

describe('callRoute', () => {
  beforeEach(() => {
    setSession({ token: 'test-token', expiresAt: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it('returns the body when the route succeeded', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply({ ok: true, leads: [{ id: 'a' }] })));

    await expect(callRoute<{ leads: { id: string }[] }>('/leads/360')).resolves.toEqual({ ok: true, leads: [{ id: 'a' }] });
  });

  it('rejects a refusal, carrying the reason the server gave', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply({ ok: false, refusal: 'NOT_FOUND', error: 'Lead not found or not accessible.' })));

    await expect(callRoute('/leads/360')).rejects.toThrow('Lead not found or not accessible.');
  });

  it('rejects the platform envelope a crashed sandbox returns', async () => {
    // The exact shape observed in Phase 9, including its HTTP status.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => reply({ statusCode: 500, error: 'Error', messages: ['Exited with code 3221225794'], code: 'ROUTE_TRIGGER_USER_UNCAUGHT_ERROR' }, 500)),
    );

    await expect(callRoute('/ai/lead/generate')).rejects.toThrow(/500.*Exited with code 3221225794/);
  });

  it('rejects the envelope even when it arrives over a 200', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply({ statusCode: 503, messages: ['upstream unavailable'] }, 200)));

    await expect(callRoute('/dashboard/summary')).rejects.toThrow(/503/);
  });

  it('rejects an error status whose body says nothing recognisable', async () => {
    // A proxy or gateway: no `ok`, no `statusCode`, just an HTTP failure.
    // This is the case the first fix still let through.
    vi.stubGlobal('fetch', vi.fn(() => reply({ error: 'Bad gateway' }, 502)));

    await expect(callRoute('/tasks/create')).rejects.toThrow(/502/);
  });

  it('rejects a body that is not JSON at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ status: 500, ok: false, text: () => Promise.resolve('<html>Internal Server Error</html>') } as Response)),
    );

    await expect(callRoute('/capture/create')).rejects.toThrow(/Internal Server Error/);
  });

  it('reports a network failure in words, rather than inventing a reply', async () => {
    // Phase 14 (14.6) changed the message, not the behaviour: a transport
    // failure still rejects and still invents nothing, but "Failed to fetch"
    // is a browser string nobody can act on, so it becomes the sentence the
    // offline bar uses — and the client records that the server is unreachable.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));

    await expect(callRoute('/interactions/log')).rejects.toThrow(UNREACHABLE);
    expect(isReachable()).toBe(false);
  });

  it('treats any answer, even a failure, as proof the server is there', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply({ ok: false, error: 'Nope' }, 500)));

    await expect(callRoute('/interactions/log')).rejects.toThrow('Nope');
    expect(isReachable()).toBe(true);
  });

  it('refuses to call anything without a session', async () => {
    setSession(null);
    const fetchSpy = vi.fn(() => reply({ ok: true }));

    vi.stubGlobal('fetch', fetchSpy);

    await expect(callRoute('/leads/360')).rejects.toThrow('You are signed out.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('signs the person out when the session has expired', async () => {
    const listener = vi.fn();
    const stop = onSessionExpired(listener);

    vi.stubGlobal('fetch', vi.fn(() => reply({ ok: false, error: 'Token has expired.' })));

    await expect(callRoute('/leads/360')).rejects.toThrow('Token has expired.');
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
  });

  it('treats a true `ok` as data even beside an unrelated numeric field', async () => {
    // `statusCode` only means failure at 400 and above; a route is free to
    // return one of its own below that.
    vi.stubGlobal('fetch', vi.fn(() => reply({ ok: true, statusCode: 200, report: [] })));

    await expect(callRoute<{ report: unknown[] }>('/capture/import/commit')).resolves.toMatchObject({ report: [] });
  });
});
