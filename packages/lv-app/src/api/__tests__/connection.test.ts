import { describe, expect, it, vi } from 'vitest';

import { isExpiredSession, isReachable, onReachabilityChange, UNREACHABLE } from 'src/api/client';

// 14.6 — reachability.
//
// The rule these tests pin down is the one that is easy to get wrong: an
// answer of any kind means the server is there, and only a transport failure
// means it is not. A 500 is the server talking.

describe('reachability', () => {
  it('starts out assuming the server is there', () => {
    // Anything else would flash an offline bar on first paint, before a single
    // request has been made.
    expect(isReachable()).toBe(true);
  });

  it('tells a listener when the answer changes, and stops when unsubscribed', () => {
    const listener = vi.fn();
    const stop = onReachabilityChange(listener);

    expect(typeof stop).toBe('function');

    stop();
    // Unsubscribing twice is harmless — a component may unmount more than once
    // in React's strict development double-render.
    expect(() => stop()).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('has one sentence for being unreachable, and it reassures', () => {
    // The bar appears while the person is mid-task; it must not imply loss.
    expect(UNREACHABLE).toMatch(/could not be reached/i);
    expect(UNREACHABLE).toMatch(/nothing has been lost/i);
  });
});

describe('an expired session is not a connection problem', () => {
  it('keeps the two apart', () => {
    // Both end a request, but one asks the person to sign in again and the
    // other asks them to wait. Confusing them strands people.
    expect(isExpiredSession('Token has expired')).toBe(true);
    expect(isExpiredSession('unauthorized')).toBe(true);
    expect(isExpiredSession(UNREACHABLE)).toBe(false);
    expect(isExpiredSession(null)).toBe(false);
  });
});
