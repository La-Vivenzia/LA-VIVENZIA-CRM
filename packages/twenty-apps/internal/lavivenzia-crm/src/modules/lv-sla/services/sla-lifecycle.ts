import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';
import {
  RESOLVABLE_SLA_STATUSES,
  SLA_RULE_LABELS,
  type SlaRule,
} from 'src/modules/lv-sla/constants/sla-rules';
import { auditEntry, type SlaRecord } from 'src/modules/lv-sla/services/sla-engine';
import { evaluateSla, type SlaEvaluationResult } from 'src/modules/lv-sla/services/sla-evaluator';
import { type SlaPort } from 'src/modules/lv-sla/services/sla-port';
import { scheduleFor } from 'src/modules/lv-sla/utils/sla-clock';

// The two things an event hook does with SLAs:
//   startSla     — a trigger happened (lead created, status entered, document
//                  rejected): open the clock, exactly once per trigger
//   evaluateTarget — something about the target changed (owner, status,
//                  interaction logged): let the engine re-decide now, so a
//                  resolution or reassignment lands immediately rather than at
//                  the next 15-minute sweep. Same code path as the cron.

const stamp = (isoTimestamp: string): string => isoTimestamp.replace(/[^0-9]/g, '');

export const slaDedupeKey = ({
  rule,
  targetRecordId,
  startedAt,
}: {
  rule: SlaRule;
  targetRecordId: string;
  startedAt: string;
}): string => `${rule}:${targetRecordId}:${stamp(startedAt)}`;

export type StartSlaInput = {
  port: SlaPort;
  rule: SlaRule;
  subjectName: string;
  priority: LeadPriority;
  ownerWorkspaceMemberId: string | null;
  target: { object: SlaRecord['targetObject']; recordId: string };
  leadId: string | null;
  onboardingId: string | null;
  documentId: string | null;
  // The record's own timestamp for the triggering change — deterministic, so
  // a replayed event derives the same key and the same deadline.
  startedAt: string;
  sourceEvent: string;
  actorWorkspaceMemberId: string | null;
  metadata?: Record<string, unknown>;
};

export type StartSlaOutcome =
  | { outcome: 'CREATED'; id: string; dueAt: string }
  | { outcome: 'DUPLICATE'; dueAt: string };

export const startSla = async (input: StartSlaInput): Promise<StartSlaOutcome> => {
  const schedule = scheduleFor({ rule: input.rule, startedAt: input.startedAt });
  const dedupeKey = slaDedupeKey({
    rule: input.rule,
    targetRecordId: input.target.recordId,
    startedAt: schedule.startedAt,
  });

  const result = await input.port.createIfAbsent({
    name: `${SLA_RULE_LABELS[input.rule]} — ${input.subjectName}`,
    rule: input.rule,
    priority: input.priority,
    ownerWorkspaceMemberId: input.ownerWorkspaceMemberId,
    targetObject: input.target.object,
    targetRecordId: input.target.recordId,
    leadId: input.leadId,
    onboardingId: input.onboardingId,
    documentId: input.documentId,
    startedAt: schedule.startedAt,
    dueSoonAt: schedule.dueSoonAt,
    dueAt: schedule.dueAt,
    breachAt: schedule.breachAt,
    dedupeKey,
    sourceEvent: input.sourceEvent,
    audit: auditEntry('CREATED', schedule.startedAt, {
      to: 'ON_TRACK',
      actorWorkspaceMemberId: input.actorWorkspaceMemberId,
      detail: `${input.sourceEvent}; due ${schedule.dueAt}`,
    }),
    metadata: input.metadata ?? {},
  });

  return result.outcome === 'CREATED'
    ? { outcome: 'CREATED', id: result.id, dueAt: schedule.dueAt }
    : { outcome: 'DUPLICATE', dueAt: schedule.dueAt };
};

// Re-evaluates every open SLA on a target right now. Used by the event hooks;
// the cron does the same over everything actionable.
export const evaluateTarget = async ({
  port,
  leadId = null,
  onboardingId = null,
  documentId = null,
  now,
}: {
  port: SlaPort;
  leadId?: string | null;
  onboardingId?: string | null;
  documentId?: string | null;
  now: string;
}): Promise<SlaEvaluationResult[]> => {
  const open = await port.listForTarget({
    leadId,
    onboardingId,
    documentId,
    statuses: RESOLVABLE_SLA_STATUSES,
  });

  const results: SlaEvaluationResult[] = [];

  for (const sla of open) {
    results.push(await evaluateSla({ sla, port, now }));
  }

  return results;
};
