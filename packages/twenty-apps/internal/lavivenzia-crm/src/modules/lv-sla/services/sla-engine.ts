import {
  LEAD_ADDITIONAL_STATUSES,
  LEAD_MAIN_FLOW_STATUSES,
  type LeadPriority,
} from 'src/modules/lv-core/constants/lead-lifecycle';
import {
  canAdvanceSla,
  type SlaRule,
  type SlaStatus,
} from 'src/modules/lv-sla/constants/sla-rules';
import { clockStateAt, type ClockState } from 'src/modules/lv-sla/utils/sla-clock';

// The SLA decision engine. Pure: it takes an SLA row, the facts about its
// target and a clock, and returns what should happen. Nothing here touches
// I/O, so every rule, threshold and transition is testable with a fake clock
// — 24 hours in a millisecond — and the evaluator is just "fetch, decide,
// apply through the port".
//
// Audit convention follows onboarding.auditTrail: an append-only array of
// entries with UTC time and actor (null = the system).

export type SlaAuditEvent =
  | 'CREATED'
  | 'TRANSITION'
  | 'NOTIFIED'
  | 'REASSIGNED'
  | 'ESCALATION_TASK_CREATED'
  | 'ESCALATED'
  | 'ESCALATION_BLOCKED'
  | 'RESOLVED';

export type SlaAuditEntry = {
  at: string;
  event: SlaAuditEvent;
  from?: string | null;
  to?: string | null;
  actorWorkspaceMemberId: string | null;
  detail?: string | null;
};

export type SlaRecord = {
  id: string;
  name: string;
  rule: SlaRule;
  status: SlaStatus;
  priority: LeadPriority;
  ownerWorkspaceMemberId: string | null;
  escalationOwnerWorkspaceMemberId: string | null;
  escalationTaskId: string | null;
  targetObject: 'lvLead' | 'lvOnboarding' | 'lvOnboardingDocument';
  targetRecordId: string;
  leadId: string | null;
  onboardingId: string | null;
  documentId: string | null;
  startedAt: string;
  dueSoonAt: string;
  dueAt: string;
  breachAt: string;
  breachedAt: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  auditTrail: SlaAuditEntry[];
};

// What the evaluator learned about the target, read fresh each run. Every
// "since" flag is relative to the SLA's startedAt so an old interaction cannot
// satisfy a new commitment.
export type TargetFacts =
  | { kind: 'GONE' }
  | {
      kind: 'LEAD';
      name: string;
      status: string | null;
      ownerWorkspaceMemberId: string | null;
      outwardContactSinceStart: boolean;
      followUpCompletedSinceStart: boolean;
    }
  | {
      kind: 'ONBOARDING';
      name: string;
      status: string | null;
      reviewerWorkspaceMemberId: string | null;
      leadOwnerWorkspaceMemberId: string | null;
      documentReviewedSinceStart: boolean;
    }
  | {
      kind: 'DOCUMENT';
      name: string;
      verificationState: string | null;
      onboardingStatus: string | null;
      reviewerWorkspaceMemberId: string | null;
      leadOwnerWorkspaceMemberId: string | null;
      replacementRegistered: boolean;
    };

const MAIN_FLOW_RANK = new Map<string, number>(
  LEAD_MAIN_FLOW_STATUSES.map((status, index) => [status, index]),
);
const CLOSED_LEAD_STATUSES = new Set<string>(LEAD_ADDITIONAL_STATUSES);

const leadReached = (status: string | null, milestone: string): boolean => {
  const rank = status ? MAIN_FLOW_RANK.get(status) : undefined;
  const target = MAIN_FLOW_RANK.get(milestone);

  return rank !== undefined && target !== undefined && rank >= target;
};

// ---------------------------------------------------------------------------
// Resolution — the required action actually happened (or can no longer matter)
// ---------------------------------------------------------------------------

export type ResolutionReason =
  | 'TARGET_GONE'
  | 'LEAD_CONTACTED'
  | 'CONTACT_LOGGED'
  | 'LEAD_CLOSED'
  | 'LEAD_PROGRESSED'
  | 'LEAD_STATUS_CHANGED'
  | 'FOLLOW_UP_LOGGED'
  | 'FOLLOW_UP_COMPLETED'
  | 'ONBOARDING_PROGRESSED'
  | 'DOCUMENT_REVIEWED'
  | 'DOCUMENT_RESUBMITTED'
  | 'DOCUMENT_VERIFIED'
  | 'DOCUMENT_REPLACED'
  | 'ONBOARDING_CLOSED';

export const resolutionFor = (sla: SlaRecord, facts: TargetFacts): ResolutionReason | null => {
  if (facts.kind === 'GONE') {
    return 'TARGET_GONE';
  }

  switch (sla.rule) {
    case 'NEW_LEAD_CONTACT': {
      if (facts.kind !== 'LEAD') {
        return null;
      }

      if (facts.status && CLOSED_LEAD_STATUSES.has(facts.status)) {
        return 'LEAD_CLOSED';
      }

      if (leadReached(facts.status, 'CONTACTED')) {
        return 'LEAD_CONTACTED';
      }

      return facts.outwardContactSinceStart ? 'CONTACT_LOGGED' : null;
    }

    case 'INTERESTED_FOLLOW_UP': {
      if (facts.kind !== 'LEAD') {
        return null;
      }

      if (facts.status && CLOSED_LEAD_STATUSES.has(facts.status)) {
        return 'LEAD_CLOSED';
      }

      if (facts.status !== 'INTERESTED') {
        return leadReached(facts.status, 'NEGOTIATION') ? 'LEAD_PROGRESSED' : 'LEAD_STATUS_CHANGED';
      }

      if (facts.outwardContactSinceStart) {
        return 'FOLLOW_UP_LOGGED';
      }

      return facts.followUpCompletedSinceStart ? 'FOLLOW_UP_COMPLETED' : null;
    }

    case 'ONBOARDING_FIRST_ACTION': {
      if (facts.kind !== 'ONBOARDING') {
        return null;
      }

      if (facts.status !== 'INITIATED') {
        return 'ONBOARDING_PROGRESSED';
      }

      return facts.documentReviewedSinceStart ? 'DOCUMENT_REVIEWED' : null;
    }

    case 'MISSING_DOCUMENT': {
      if (facts.kind !== 'DOCUMENT') {
        return null;
      }

      if (facts.onboardingStatus === 'REJECTED' || facts.onboardingStatus === 'ACTIVATED') {
        return 'ONBOARDING_CLOSED';
      }

      if (facts.verificationState === 'VERIFIED') {
        return 'DOCUMENT_VERIFIED';
      }

      if (facts.verificationState === 'PENDING' || facts.verificationState === 'UNDER_REVIEW') {
        return 'DOCUMENT_RESUBMITTED';
      }

      return facts.replacementRegistered ? 'DOCUMENT_REPLACED' : null;
    }

    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Ownership — who is responsible right now, read from the record
// ---------------------------------------------------------------------------

export const expectedOwnerFor = (facts: TargetFacts): string | null | undefined => {
  switch (facts.kind) {
    case 'GONE':
      return undefined; // nothing to say
    case 'LEAD':
      return facts.ownerWorkspaceMemberId;
    case 'ONBOARDING':
      return facts.reviewerWorkspaceMemberId;
    case 'DOCUMENT':
      // The person who chases the partner: the lead owner, or the reviewer
      // when the onboarding has no lead.
      return facts.leadOwnerWorkspaceMemberId ?? facts.reviewerWorkspaceMemberId;
    default:
      return undefined;
  }
};

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export type SlaPlan = {
  // Owner on the record differs from the SLA's owner — move responsibility.
  reassignTo?: { from: string | null; to: string | null };
  resolve?: { reason: ResolutionReason };
  // Clock says a later state than the row has.
  transition?: { from: SlaStatus; to: ClockState };
  // After the transition (or already), the row is BREACHED and not escalated.
  escalate?: { escalationOwnerWorkspaceMemberId: string | null };
  // Human-readable summary for the run report.
  summary: string;
};

export const planEvaluation = ({
  sla,
  facts,
  now,
  escalationOwnerWorkspaceMemberId,
}: {
  sla: SlaRecord;
  facts: TargetFacts;
  now: string;
  escalationOwnerWorkspaceMemberId: string | null;
}): SlaPlan => {
  if (sla.status === 'RESOLVED') {
    return { summary: 'already resolved' };
  }

  const plan: SlaPlan = { summary: '' };

  const expectedOwner = expectedOwnerFor(facts);

  if (expectedOwner !== undefined && expectedOwner !== sla.ownerWorkspaceMemberId) {
    plan.reassignTo = { from: sla.ownerWorkspaceMemberId, to: expectedOwner };
  }

  const reason = resolutionFor(sla, facts);

  if (reason !== null) {
    plan.resolve = { reason };
    plan.summary = `resolve: ${reason}`;

    return plan;
  }

  if (sla.status === 'ESCALATED') {
    plan.summary = 'escalated; awaiting resolution';

    return plan;
  }

  const clock = clockStateAt({ schedule: sla, now });
  let status: SlaStatus = sla.status;

  if (canAdvanceSla(sla.status, clock)) {
    plan.transition = { from: sla.status, to: clock };
    status = clock;
  }

  if (status === 'BREACHED' && sla.escalationTaskId === null) {
    plan.escalate = { escalationOwnerWorkspaceMemberId };
  }

  plan.summary =
    [
      plan.reassignTo ? 'reassign' : null,
      plan.transition ? `${plan.transition.from}→${plan.transition.to}` : null,
      plan.escalate ? (escalationOwnerWorkspaceMemberId ? 'escalate' : 'escalation blocked') : null,
    ]
      .filter(Boolean)
      .join(', ') || 'no change';

  return plan;
};

export const auditEntry = (
  event: SlaAuditEvent,
  at: string,
  extra: Partial<Omit<SlaAuditEntry, 'event' | 'at'>> = {},
): SlaAuditEntry => ({
  at,
  event,
  actorWorkspaceMemberId: null,
  ...extra,
});
