import { type AiFailureCode } from 'src/modules/lv-ai/provider/ai-provider';
import { type GraphqlClient } from 'src/modules/lv-ai/runtime/clients';

// Protection against spending the provider's quota — and the caller's time —
// on requests that are already known to fail.
//
// What this is not: a retry limiter. The retry budget in `http-provider` is
// already correct. `AI_QUOTA_EXHAUSTED` is marked `retryable: false` and the
// loop breaks on it, so an exhausted account costs exactly one round trip per
// request, never three. There is no retry storm to fix.
//
// What is missing is memory. Nothing recorded that the provider had already
// said "no quota", so every subsequent request paid its own round trip to be
// told the same thing. The audit found 437 of them. A breaker is the fix: once
// the provider has refused for quota, stop asking for a while.
//
// Where the state lives matters. Logic functions run in a serverless sandbox,
// so anything held in a module variable dies with the invocation and a breaker
// built on it would never trip. The state therefore comes from `_lvAiRun`,
// which already records every call's provider, status, error code and time for
// exactly this kind of observability. No new table, no new queue, no Redis
// reachable from the sandbox — the existing audit trail read backwards.
//
// Degradation is unchanged: a tripped breaker returns the same
// `AI_QUOTA_EXHAUSTED` / `AI_RATE_LIMITED` codes the provider would have
// returned, so every screen already knows how to say it, and the deterministic
// engines keep working untouched.

/** How the breaker is tuned. Deliberately conservative. */
export const THROTTLE = {
  /** Consecutive quota refusals before the provider is left alone. */
  quotaFailuresToTrip: 3,
  /** How long the breaker stays open before a single probe is allowed. */
  cooldownMs: 10 * 60 * 1000,
  /** Window the breaker reads over. */
  lookbackMs: 30 * 60 * 1000,
  /** Model calls one person may make in the window below. */
  perActorLimit: 30,
  perActorWindowMs: 5 * 60 * 1000,
  /** Model calls the whole workspace may make in the window below. */
  perWorkspaceLimit: 120,
  perWorkspaceWindowMs: 5 * 60 * 1000,
  /** How many rows to read back. Enough for the widest window above. */
  sampleSize: 200,
} as const;

/** Codes that mean "the provider will refuse the next one too". */
const QUOTA_CODES = new Set<string>(['AI_QUOTA_EXHAUSTED']);

/** Codes that mean "slow down", which the breaker counts but treats as softer. */
const RATE_CODES = new Set<string>(['AI_RATE_LIMITED']);

export type ThrottleDecision =
  | { allowed: true }
  | { allowed: false; code: AiFailureCode; message: string; reason: 'BREAKER_OPEN' | 'ACTOR_LIMIT' | 'WORKSPACE_LIMIT' };

type RunSample = { provider: string | null; status: string | null; errorCode: string | null; createdAt: string; actorId: string | null };

/**
 * Recent model calls, newest first. Only model providers are read — a
 * deterministic `rules` run never touches a quota and must not influence
 * either the breaker or the rate limit.
 */
const recentRuns = async (application: GraphqlClient, provider: string, sinceIso: string): Promise<RunSample[]> => {
  const { data } = await application.query<{ lvAiRuns?: { edges: { node: RunSample }[] } }>(
    `query($filter: LvAiRunFilterInput) {
      lvAiRuns(first: ${THROTTLE.sampleSize}, filter: $filter, orderBy: [{ createdAt: DescNullsLast }]) {
        edges { node { provider status errorCode createdAt actorId } }
      }
    }`,
    { filter: { provider: { eq: provider }, createdAt: { gte: sinceIso } } },
  );

  return (data.lvAiRuns?.edges ?? []).map((edge) => edge.node);
};

/**
 * Is the provider's circuit open?
 *
 * Open when the most recent runs — ignoring anything older than the lookback —
 * begin with an unbroken run of quota refusals at least `quotaFailuresToTrip`
 * long, and the newest of them is inside the cooldown. A success anywhere in
 * that leading sequence closes it, which is what lets the breaker recover
 * without a separate half-open state machine: one success is proof enough.
 */
export const breakerState = (
  runs: readonly RunSample[],
  now: number,
): { open: boolean; consecutive: number; opensUntil: number | null } => {
  let consecutive = 0;
  let newestFailureAt: number | null = null;

  for (const run of runs) {
    const at = Date.parse(run.createdAt);

    if (!Number.isFinite(at) || now - at > THROTTLE.lookbackMs) {
      break;
    }

    const code = run.errorCode ?? '';

    if (QUOTA_CODES.has(code) || RATE_CODES.has(code)) {
      consecutive += 1;
      newestFailureAt ??= at;
      continue;
    }

    // Anything else — a success, a rejected request, a bad response — ends the
    // streak. Only quota and rate limiting say anything about capacity.
    break;
  }

  if (consecutive < THROTTLE.quotaFailuresToTrip || newestFailureAt === null) {
    return { open: false, consecutive, opensUntil: null };
  }

  const opensUntil = newestFailureAt + THROTTLE.cooldownMs;

  return { open: now < opensUntil, consecutive, opensUntil };
};

/** How many model calls appear in a window, optionally for one actor. */
export const countInWindow = (runs: readonly RunSample[], now: number, windowMs: number, actorId?: string | null): number =>
  runs.filter((run) => {
    const at = Date.parse(run.createdAt);

    if (!Number.isFinite(at) || now - at > windowMs) {
      return false;
    }

    return actorId === undefined ? true : run.actorId === actorId;
  }).length;

/**
 * May this call reach the provider?
 *
 * Read-only and best effort. If the audit table cannot be read the call is
 * allowed: a throttle that fails closed would take the AI down over a
 * reporting problem, which is worse than the quota it is protecting.
 */
export const checkThrottle = async (
  application: GraphqlClient,
  input: { provider: string; actorWorkspaceMemberId: string | null; now?: number },
): Promise<ThrottleDecision> => {
  // "rules" and "none" never reach a provider, so they are never throttled.
  if (input.provider === 'rules' || input.provider === 'none' || input.provider === '') {
    return { allowed: true };
  }

  const now = input.now ?? Date.now();

  let runs: RunSample[];

  try {
    runs = await recentRuns(application, input.provider, new Date(now - THROTTLE.lookbackMs).toISOString());
  } catch (caught) {
    console.warn('[lv-ai] throttle could not read the run history, allowing the call:', caught instanceof Error ? caught.message : String(caught));

    return { allowed: true };
  }

  const breaker = breakerState(runs, now);

  if (breaker.open) {
    return {
      allowed: false,
      code: 'AI_QUOTA_EXHAUSTED',
      message: `The AI provider refused ${breaker.consecutive} requests in a row for quota, so it is being left alone for a few minutes. Nothing else in the CRM is affected.`,
      reason: 'BREAKER_OPEN',
    };
  }

  if (input.actorWorkspaceMemberId !== null && countInWindow(runs, now, THROTTLE.perActorWindowMs, input.actorWorkspaceMemberId) >= THROTTLE.perActorLimit) {
    return {
      allowed: false,
      code: 'AI_RATE_LIMITED',
      message: 'You have asked the assistant a great many questions in the last few minutes. Give it a moment.',
      reason: 'ACTOR_LIMIT',
    };
  }

  if (countInWindow(runs, now, THROTTLE.perWorkspaceWindowMs) >= THROTTLE.perWorkspaceLimit) {
    return {
      allowed: false,
      code: 'AI_RATE_LIMITED',
      message: 'The workspace has reached its short-term limit for assistant requests. It will clear in a few minutes.',
      reason: 'WORKSPACE_LIMIT',
    };
  }

  return { allowed: true };
};
