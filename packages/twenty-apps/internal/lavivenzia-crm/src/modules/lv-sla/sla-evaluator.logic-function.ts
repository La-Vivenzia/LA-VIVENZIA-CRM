import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_SLA_EVALUATOR_ID } from 'src/constants/universal-identifiers';
import {
  ACTIONABLE_FOR_EVALUATION,
  createCoreApiSlaPort,
} from 'src/modules/lv-sla/services/core-api-sla-port';
import { evaluateSla, type SlaEvaluationResult } from 'src/modules/lv-sla/services/sla-evaluator';

// The SLA clock's heartbeat: every 15 minutes, evaluate every open SLA.
//
// Restart-safe and idempotent by construction (see sla-evaluator.ts): a run
// that is interrupted leaves rows in whatever state their claims reached, and
// the next run continues from there without repeating a notification or a
// task. Two overlapping runs race on per-row claims and each side effect
// happens once. Bounded: at most PAGE rows per run, oldest deadline first, so
// a backlog drains in deadline order rather than starving.
//
// Test hook: when executed directly (executeOneLogicFunction, which requires
// the WORKFLOWS settings permission) the payload may carry `clock`, an ISO
// timestamp the evaluator treats as "now", and `slaIds` to restrict the run.
// The cron trigger sends no payload, so production always uses the server
// clock. This is how 24-hour behaviour is verified without waiting 24 hours.

const PAGE = 200;

type EvaluatorPayload = { clock?: unknown; slaIds?: unknown } | null | undefined;

export const resolveClock = (payload: EvaluatorPayload): string => {
  const clock = payload && typeof payload === 'object' ? payload.clock : undefined;

  if (typeof clock === 'string' && !Number.isNaN(Date.parse(clock))) {
    return new Date(Date.parse(clock)).toISOString();
  }

  return new Date().toISOString();
};

const resolveSlaIds = (payload: EvaluatorPayload): Set<string> | null => {
  const ids = payload && typeof payload === 'object' ? payload.slaIds : undefined;

  return Array.isArray(ids) && ids.every((id) => typeof id === 'string') && ids.length > 0
    ? new Set(ids as string[])
    : null;
};

export const handler = async (payload: EvaluatorPayload): Promise<Record<string, unknown>> => {
  const now = resolveClock(payload);
  const only = resolveSlaIds(payload);
  const port = createCoreApiSlaPort(new CoreApiClient({ runAs: 'application' }));

  const candidates = (
    await port.listActionable({ statuses: ACTIONABLE_FOR_EVALUATION, limit: PAGE })
  ).filter((sla) => only === null || only.has(sla.id));

  const results: SlaEvaluationResult[] = [];

  for (const sla of candidates) {
    results.push(await evaluateSla({ sla, port, now }));
  }

  const count = (predicate: (result: SlaEvaluationResult) => boolean): number =>
    results.filter(predicate).length;

  return {
    clock: now,
    evaluated: results.length,
    truncated: candidates.length === PAGE,
    transitions: count((result) => result.transitionClaimed),
    resolved: count((result) => result.after === 'RESOLVED' && result.transitionClaimed),
    breached: count((result) => result.breachClaimed),
    escalated: count((result) => result.escalated),
    escalationTasksCreated: count((result) => result.escalationTaskCreated),
    escalationBlocked: count((result) => result.escalationBlocked !== null),
    reassigned: count((result) => result.reassigned),
    notified: results.reduce((sum, result) => sum + result.notified, 0),
    errors: results.flatMap((result) => result.errors.map((error) => `${result.slaId}: ${error}`)),
    results: results.map((result) => ({
      slaId: result.slaId,
      rule: result.rule,
      before: result.before,
      after: result.after,
      plan: result.plan,
      claimed: result.transitionClaimed,
      notified: result.notified,
      escalated: result.escalated,
      escalationTaskCreated: result.escalationTaskCreated,
      escalationBlocked: result.escalationBlocked,
    })),
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_SLA_EVALUATOR_ID,
  name: 'lv-sla-evaluator',
  description:
    'Evaluates every open SLA against the server clock: due soon, due, breached, escalated, resolved; idempotent and concurrency-safe',
  timeoutSeconds: 120,
  handler,
  cronTriggerSettings: { pattern: '*/15 * * * *' },
});
