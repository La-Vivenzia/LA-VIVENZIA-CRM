import { describe, expect, it, vi } from 'vitest';

import { breakerState, checkThrottle, countInWindow, THROTTLE } from 'src/modules/lv-ai/runtime/throttle';

// Protection against spending quota on calls already known to fail.
//
// The audit counted 437 AI_QUOTA_EXHAUSTED runs. The retry budget was never
// the cause — `http-provider` marks quota exhaustion `retryable: false`, so
// each of those cost exactly one round trip. What was missing was memory: no
// request knew the previous one had already been refused.

const NOW = Date.parse('2026-10-06T18:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const run = (over: Partial<{ provider: string; status: string; errorCode: string | null; createdAt: string; actorId: string | null }> = {}) => ({
  provider: 'gemini',
  status: 'FAILED',
  errorCode: 'AI_QUOTA_EXHAUSTED',
  createdAt: ago(1000),
  actorId: 'member-1',
  ...over,
});

describe('the circuit breaker', () => {
  it('stays closed while there is no history', () => {
    expect(breakerState([], NOW).open).toBe(false);
  });

  it('stays closed below the trip threshold', () => {
    const runs = Array.from({ length: THROTTLE.quotaFailuresToTrip - 1 }, (_, i) => run({ createdAt: ago(i * 1000) }));

    expect(breakerState(runs, NOW).open).toBe(false);
  });

  it('opens once the provider has refused for quota that many times in a row', () => {
    const runs = Array.from({ length: THROTTLE.quotaFailuresToTrip }, (_, i) => run({ createdAt: ago(i * 1000) }));
    const state = breakerState(runs, NOW);

    expect(state.open).toBe(true);
    expect(state.consecutive).toBe(THROTTLE.quotaFailuresToTrip);
  });

  it('counts rate limiting toward the same streak', () => {
    const runs = [run({ errorCode: 'AI_RATE_LIMITED' }), run(), run()];

    expect(breakerState(runs, NOW).open).toBe(true);
  });

  it('is closed by one success, however many failures preceded it', () => {
    // The newest run is what matters. A success is proof the provider is
    // answering again, which is why no separate half-open state is needed.
    const runs = [run({ status: 'SUCCESS', errorCode: null }), run(), run(), run(), run(), run()];

    expect(breakerState(runs, NOW).open).toBe(false);
  });

  it('is not tripped by failures that are not about capacity', () => {
    // A rejected request or a bad response says nothing about quota, and
    // treating it as a capacity problem would disable AI over a bad prompt.
    for (const code of ['AI_REQUEST_REJECTED', 'AI_INVALID_RESPONSE', 'AI_EMPTY_RESPONSE', 'AI_TIMEOUT']) {
      expect(breakerState([run({ errorCode: code }), run({ errorCode: code }), run({ errorCode: code })], NOW).open, code).toBe(false);
    }
  });

  it('reopens the provider once the cooldown has passed', () => {
    const stale = ago(THROTTLE.cooldownMs + 60_000);
    const runs = [run({ createdAt: stale }), run({ createdAt: stale }), run({ createdAt: stale })];
    const state = breakerState(runs, NOW);

    expect(state.open).toBe(false);
    expect(state.opensUntil).not.toBeNull();
  });

  it('ignores history older than the lookback window entirely', () => {
    const ancient = ago(THROTTLE.lookbackMs + 60_000);

    expect(breakerState([run({ createdAt: ancient }), run({ createdAt: ancient }), run({ createdAt: ancient })], NOW).consecutive).toBe(0);
  });
});

describe('counting a window', () => {
  it('counts only what falls inside it', () => {
    const runs = [run({ createdAt: ago(1000) }), run({ createdAt: ago(2000) }), run({ createdAt: ago(10 * 60 * 1000) })];

    expect(countInWindow(runs, NOW, 5 * 60 * 1000)).toBe(2);
  });

  it('counts one actor when asked for one', () => {
    const runs = [run({ actorId: 'a' }), run({ actorId: 'a' }), run({ actorId: 'b' })];

    expect(countInWindow(runs, NOW, 5 * 60 * 1000, 'a')).toBe(2);
    expect(countInWindow(runs, NOW, 5 * 60 * 1000, 'b')).toBe(1);
  });
});

describe('the decision a call gets', () => {
  const client = (rows: ReturnType<typeof run>[]) => ({
    query: vi.fn().mockResolvedValue({ data: { lvAiRuns: { edges: rows.map((node) => ({ node })) } }, errors: [] }),
  });

  it('never throttles the deterministic engines', async () => {
    // `rules` reaches no provider, so it has no quota to protect. Throttling
    // it would disable the one tier that has never failed.
    for (const provider of ['rules', 'none', '']) {
      const application = client([]);
      const decision = await checkThrottle(application as never, { provider, actorWorkspaceMemberId: 'member-1', now: NOW });

      expect(decision.allowed, provider).toBe(true);
      expect(application.query).not.toHaveBeenCalled();
    }
  });

  it('allows a call when the provider is healthy', async () => {
    const decision = await checkThrottle(client([run({ status: 'SUCCESS', errorCode: null })]) as never, { provider: 'gemini', actorWorkspaceMemberId: 'member-1', now: NOW });

    expect(decision.allowed).toBe(true);
  });

  it('refuses with the provider own code once the breaker is open, without calling out', async () => {
    const rows = Array.from({ length: THROTTLE.quotaFailuresToTrip }, (_, i) => run({ createdAt: ago(i * 1000) }));
    const decision = await checkThrottle(client(rows) as never, { provider: 'gemini', actorWorkspaceMemberId: 'member-1', now: NOW });

    expect(decision.allowed).toBe(false);

    if (!decision.allowed) {
      // The same code the provider itself would have returned, so every screen
      // already knows how to say it.
      expect(decision.code).toBe('AI_QUOTA_EXHAUSTED');
      expect(decision.reason).toBe('BREAKER_OPEN');
      expect(decision.message).toMatch(/nothing else in the crm is affected/i);
    }
  });

  it('rate limits one person without affecting the rest', async () => {
    const mine = Array.from({ length: THROTTLE.perActorLimit }, (_, i) => run({ status: 'SUCCESS', errorCode: null, actorId: 'me', createdAt: ago(i * 100) }));
    const decision = await checkThrottle(client(mine) as never, { provider: 'gemini', actorWorkspaceMemberId: 'me', now: NOW });
    const other = await checkThrottle(client(mine) as never, { provider: 'gemini', actorWorkspaceMemberId: 'someone-else', now: NOW });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe('AI_RATE_LIMITED');
      expect(decision.reason).toBe('ACTOR_LIMIT');
    }

    expect(other.allowed).toBe(true);
  });

  it('rate limits the workspace once everyone together passes the ceiling', async () => {
    const busy = Array.from({ length: THROTTLE.perWorkspaceLimit }, (_, i) => run({ status: 'SUCCESS', errorCode: null, actorId: `member-${i}`, createdAt: ago(i * 100) }));
    const decision = await checkThrottle(client(busy) as never, { provider: 'gemini', actorWorkspaceMemberId: 'fresh-member', now: NOW });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe('WORKSPACE_LIMIT');
    }
  });

  it('allows the call when the history cannot be read', async () => {
    // Failing closed would take AI down over a reporting problem — worse than
    // the quota it is protecting.
    const broken = { query: vi.fn().mockRejectedValue(new Error('audit table unreachable')) };
    const decision = await checkThrottle(broken as never, { provider: 'gemini', actorWorkspaceMemberId: 'member-1', now: NOW });

    expect(decision.allowed).toBe(true);
  });
});
