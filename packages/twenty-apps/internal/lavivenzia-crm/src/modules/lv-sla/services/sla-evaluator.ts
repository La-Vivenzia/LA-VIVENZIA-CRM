import {
  dispatchNotifications,
  type DispatchOutcome,
} from 'src/modules/lv-notifications/services/notification-service';
import {
  buildEscalationNotification,
  buildSlaBreachNotification,
  buildSlaDueNotification,
  type NotificationIntent,
  type NotificationTarget,
} from 'src/modules/lv-notifications/utils/build-notification';
import {
  SLA_RULE_EXPECTATIONS,
  SLA_RULE_LABELS,
  type SlaStatus,
} from 'src/modules/lv-sla/constants/sla-rules';
import {
  auditEntry,
  planEvaluation,
  type SlaPlan,
  type SlaRecord,
  type TargetFacts,
} from 'src/modules/lv-sla/services/sla-engine';
import { type SlaPort } from 'src/modules/lv-sla/services/sla-port';

// Applies the engine's plan for one SLA through the port. Idempotent and
// concurrency-safe by construction:
//
//   - every state change is a conditional claim; the loser of a race does
//     nothing further for that step
//   - every notification goes through the Day 4A service with a deterministic
//     dedupe key, so even a claim winner that crashes after notifying cannot
//     notify again on the next run
//   - the escalation task is linked by a claim on escalationTaskId; a task
//     created by a run that lost that claim is destroyed (compensation), and a
//     run that finds a previously created-but-unlinked task re-links it
//
// A failure in any side effect (notification, task) is reported, never
// swallowed into a wrong state: the row keeps the state it reached and the
// next run resumes from there.

export type SlaEvaluationResult = {
  slaId: string;
  rule: string;
  before: SlaStatus;
  after: SlaStatus;
  plan: string;
  reassigned: boolean;
  transitionClaimed: boolean;
  // True when THIS run moved the row into BREACHED (it may go on to ESCALATED).
  breachClaimed: boolean;
  notified: number;
  escalationTaskCreated: boolean;
  escalated: boolean;
  escalationBlocked: string | null;
  errors: string[];
};

const SOURCE = 'lv-sla-evaluator';

// The record the owner opens. Reviewers reach the onboarding; lead owners the
// lead; a document SLA's owner is the lead owner, so the lead when there is
// one, otherwise the document (the reviewer can open it).
export const targetForOwner = (sla: SlaRecord): NotificationTarget => {
  if (sla.targetObject === 'lvLead') {
    return { object: 'lvLead', recordId: sla.targetRecordId };
  }

  if (sla.targetObject === 'lvOnboarding') {
    return { object: 'lvOnboarding', recordId: sla.targetRecordId };
  }

  return sla.leadId
    ? { object: 'lvLead', recordId: sla.leadId }
    : { object: 'lvOnboardingDocument', recordId: sla.targetRecordId };
};

const subjectOf = (sla: SlaRecord, facts: TargetFacts): string =>
  facts.kind === 'GONE' ? sla.name : facts.name || sla.name;

const notify = async (
  port: SlaPort,
  intents: NotificationIntent[],
): Promise<DispatchOutcome> =>
  dispatchNotifications({
    port: port.notifications,
    intents,
    sourceEvent: SOURCE,
    actorWorkspaceMemberId: null,
  });

export const escalationTaskBody = ({
  sla,
  subject,
  ownerName,
  escalationOwnerName,
}: {
  sla: SlaRecord;
  subject: string;
  ownerName: string | null;
  escalationOwnerName: string | null;
}): string =>
  [
    `**SLA breached — ${SLA_RULE_LABELS[sla.rule]}**`,
    '',
    `- Subject: ${subject}`,
    `- Expected action: ${SLA_RULE_EXPECTATIONS[sla.rule]}`,
    `- Original owner: ${ownerName ?? 'unassigned'}`,
    `- Escalated to: ${escalationOwnerName ?? 'escalation owner'}`,
    `- Deadline: ${sla.dueAt} (UTC)`,
    `- Breached at: ${sla.breachedAt ?? sla.breachAt} (UTC)`,
    `- SLA record: ${sla.id}`,
    '',
    'Created automatically by the La Vivenzia SLA engine. Resolving the underlying action resolves the SLA; this task records that the breach was escalated.',
  ].join('\n');

export const evaluateSla = async ({
  sla,
  port,
  now,
}: {
  sla: SlaRecord;
  port: SlaPort;
  now: string;
}): Promise<SlaEvaluationResult> => {
  const result: SlaEvaluationResult = {
    slaId: sla.id,
    rule: sla.rule,
    before: sla.status,
    after: sla.status,
    plan: '',
    reassigned: false,
    transitionClaimed: false,
    breachClaimed: false,
    notified: 0,
    escalationTaskCreated: false,
    escalated: false,
    escalationBlocked: null,
    errors: [],
  };

  const facts = await port.fetchFacts(sla);
  const escalationOwner = await port.resolveEscalationOwner();
  const plan: SlaPlan = planEvaluation({
    sla,
    facts,
    now,
    escalationOwnerWorkspaceMemberId: escalationOwner?.workspaceMemberId ?? null,
  });

  result.plan = plan.summary;

  // Work on a local copy that tracks what we know the row now says.
  let current: SlaRecord = { ...sla, auditTrail: [...sla.auditTrail] };

  try {
    if (plan.reassignTo) {
      const entry = auditEntry('REASSIGNED', now, {
        from: plan.reassignTo.from,
        to: plan.reassignTo.to,
        detail: 'Responsibility follows the record owner; deadline unchanged.',
      });

      if (
        await port.claimOwnerChange({
          slaId: sla.id,
          from: plan.reassignTo.from,
          to: plan.reassignTo.to,
          audit: entry,
          knownTrail: current.auditTrail,
        })
      ) {
        result.reassigned = true;
        current = {
          ...current,
          ownerWorkspaceMemberId: plan.reassignTo.to,
          auditTrail: [...current.auditTrail, entry],
        };
      }
    }

    if (plan.resolve) {
      const entry = auditEntry('RESOLVED', now, {
        from: current.status,
        to: 'RESOLVED',
        detail: plan.resolve.reason,
      });
      const claimed = await port.claimTransition({
        slaId: sla.id,
        from: current.status,
        to: 'RESOLVED',
        at: now,
        patch: { resolvedAt: now, resolutionReason: plan.resolve.reason, previousStatus: current.status },
        audit: entry,
        knownTrail: current.auditTrail,
      });

      result.transitionClaimed = claimed;
      result.after = 'RESOLVED';

      return result;
    }

    if (plan.transition) {
      const { from, to } = plan.transition;
      const entry = auditEntry('TRANSITION', now, { from, to });
      const claimed = await port.claimTransition({
        slaId: sla.id,
        from,
        to,
        at: now,
        patch: {
          previousStatus: from,
          ...(to === 'BREACHED' ? { breachedAt: now } : {}),
        },
        audit: entry,
        knownTrail: current.auditTrail,
      });

      result.transitionClaimed = claimed;
      result.breachClaimed = claimed && to === 'BREACHED';

      if (claimed) {
        current = {
          ...current,
          status: to,
          breachedAt: to === 'BREACHED' ? now : current.breachedAt,
          auditTrail: [...current.auditTrail, entry],
        };
        result.after = to;

        // Only the claimant notifies. When the clock jumped several states
        // at once (worker was down), only the state reached is announced.
        if (current.ownerWorkspaceMemberId) {
          const subject = subjectOf(current, facts);
          const target = targetForOwner(current);
          const intent =
            to === 'BREACHED'
              ? buildSlaBreachNotification({
                  slaRecordId: current.id,
                  ruleLabel: SLA_RULE_LABELS[current.rule],
                  ownerWorkspaceMemberId: current.ownerWorkspaceMemberId,
                  target,
                  leadId: current.leadId,
                  subjectName: subject,
                  dueAt: current.dueAt,
                  priority: current.priority === 'LOW' || current.priority === 'MEDIUM' ? 'HIGH' : current.priority,
                })
              : buildSlaDueNotification({
                  slaRecordId: current.id,
                  ruleLabel: SLA_RULE_LABELS[current.rule],
                  expectation: SLA_RULE_EXPECTATIONS[current.rule],
                  ownerWorkspaceMemberId: current.ownerWorkspaceMemberId,
                  target,
                  leadId: current.leadId,
                  subjectName: subject,
                  dueAt: current.dueAt,
                  priority: current.priority,
                  kind: to === 'DUE' ? 'DUE' : 'DUE_SOON',
                });

          const outcome = await notify(port, [intent]);

          result.notified += outcome.created.length;

          if (outcome.created.length > 0) {
            const notified = auditEntry('NOTIFIED', now, {
              to: current.ownerWorkspaceMemberId,
              detail: intent.type,
            });

            await port.appendAudit({ slaId: sla.id, entry: notified, lastNotifiedAt: now });
            current.auditTrail.push(notified);
          }
        }
      } else {
        // Someone else moved it. Re-read what they reached so escalation
        // below reasons about the truth, not our stale copy.
        result.after = to;
        current = { ...current, status: to };
      }
    }

    if (plan.escalate && current.status === 'BREACHED') {
      if (!escalationOwner) {
        const reason = 'NO_ESCALATION_OWNER_CONFIGURED';

        await port.markEscalationBlocked({ slaId: sla.id, reason, at: now });
        result.escalationBlocked = reason;

        return result;
      }

      const subject = subjectOf(current, facts);
      const ownerName = await port.memberName(current.ownerWorkspaceMemberId);

      // Claim the escalation. Fails when another run already holds it (or
      // held it and crashed — the repair path below still completes it).
      const ownerEntry = auditEntry('ESCALATED', now, {
        to: escalationOwner.workspaceMemberId,
        detail: 'Escalation owner assigned',
      });
      const claimedOwner =
        current.escalationOwnerWorkspaceMemberId === null &&
        (await port.claimEscalationOwner({
          slaId: sla.id,
          escalationOwnerWorkspaceMemberId: escalationOwner.workspaceMemberId,
          audit: ownerEntry,
          knownTrail: current.auditTrail,
        }));

      if (claimedOwner) {
        current = {
          ...current,
          escalationOwnerWorkspaceMemberId: escalationOwner.workspaceMemberId,
          auditTrail: [...current.auditTrail, ownerEntry],
        };
      } else if (current.escalationOwnerWorkspaceMemberId === null) {
        // A concurrent run holds the escalation right now; let it finish.
        return result;
      }

      const escalateTo = current.escalationOwnerWorkspaceMemberId ?? escalationOwner.workspaceMemberId;

      // Dedupe-keyed on (sla, manager): safe to attempt on every repair run.
      const escalation = await notify(port, [
        buildEscalationNotification({
          slaRecordId: current.id,
          ruleLabel: SLA_RULE_LABELS[current.rule],
          managerWorkspaceMemberId: escalateTo,
          ownerName,
          target: targetForOwner(current),
          leadId: current.leadId,
          subjectName: subject,
          dueAt: current.dueAt,
        }),
      ]);

      result.notified += escalation.created.length;

      if (escalation.created.length > 0) {
        const notified = auditEntry('NOTIFIED', now, { to: escalateTo, detail: 'ESCALATION' });

        await port.appendAudit({ slaId: sla.id, entry: notified, lastNotifiedAt: now });
        current = { ...current, auditTrail: [...current.auditTrail, notified] };
      }

      let task = await port.findEscalationTask(sla.id);
      let createdHere = false;

      if (task === null) {
        task = await port.createEscalationTask({
          slaId: sla.id,
          title: `Escalation: ${SLA_RULE_LABELS[current.rule]} — ${subject}`,
          bodyMarkdown: escalationTaskBody({
            sla: current,
            subject,
            ownerName,
            escalationOwnerName: escalationOwner.displayName,
          }),
          assigneeWorkspaceMemberId: escalateTo,
          // An escalation is due the moment it exists.
          dueAt: now,
          leadId: current.leadId,
          onboardingId: current.onboardingId,
        });
        createdHere = true;
      }

      const linked = await port.claimEscalationTask({
        slaId: sla.id,
        taskId: task.id,
        at: now,
        audit: auditEntry('ESCALATION_TASK_CREATED', now, { detail: task.id }),
        knownTrail: current.auditTrail,
      });

      if (linked) {
        result.escalationTaskCreated = createdHere;
        result.escalated = true;
        result.after = 'ESCALATED';
      } else if (createdHere) {
        // Lost the race to another run that linked its own task first.
        await port.destroyTask(task.id);
      } else {
        result.after = 'ESCALATED';
      }
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    await port.touchEvaluated({ slaId: sla.id, at: now }).catch((error: unknown) => {
      result.errors.push(
        `touchEvaluated: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  return result;
};
