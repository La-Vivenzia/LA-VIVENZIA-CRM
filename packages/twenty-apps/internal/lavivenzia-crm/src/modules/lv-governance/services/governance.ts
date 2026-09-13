import { LEAD_MAIN_FLOW_STATUSES, type LeadStatus } from 'src/modules/lv-core/constants/lead-lifecycle';
import { type GovernanceAction } from 'src/modules/lv-governance/objects/audit-event.object';

// The destructive-action policy, as decisions a route can apply.
//
// Principle: nobody without the Main Admin role can make a record disappear.
// What a normal user CAN do is change a lead's lifecycle — archive it, close
// it, mark it a duplicate, reopen it — which is an ordinary update the role
// already permits and CM-004 already scopes. Permanent deletion stays
// Twenty's own `destroy`, which only the Main Admin role holds; the lead page
// shows its impact first, and every trash / restore / destroy is audited from
// the platform's events.

// SET_STATUS (Day 7) is the governed way to move a lead along the positive
// flow (Contacted, Engaged, Interested, …) or into the holding states a
// coordinator uses day to day (Follow up later, No response). It exists so the
// Lead 360 page never writes `status` directly: every step goes through the
// same route, policy and audit row as the closing actions.
export const LIFECYCLE_ACTIONS = ['ARCHIVE', 'CLOSE', 'MARK_DUPLICATE', 'REOPEN', 'SET_STATUS'] as const;

export type LifecycleAction = (typeof LIFECYCLE_ACTIONS)[number];

export const isLifecycleAction = (value: unknown): value is LifecycleAction =>
  typeof value === 'string' && (LIFECYCLE_ACTIONS as readonly string[]).includes(value);

// The status each fixed lifecycle action sets. Archive = DORMANT (parked, not
// lost); close = LOST unless a more specific closing status is supplied;
// reopen = QUALIFYING (a human must re-qualify before it re-enters the funnel).
// SET_STATUS carries its own target and is deliberately absent.
export const LIFECYCLE_TARGET_STATUS: Record<Exclude<LifecycleAction, 'SET_STATUS'>, LeadStatus> = {
  ARCHIVE: 'DORMANT',
  CLOSE: 'LOST',
  MARK_DUPLICATE: 'DUPLICATE',
  REOPEN: 'QUALIFYING',
};

// The onboarding-driven statuses are mirrored from lvOnboarding by
// lv-on-onboarding-updated; a person setting them by hand would desynchronise
// the two records, so from the lead side they are display-only.
export const ONBOARDING_MIRRORED_STATUSES: readonly LeadStatus[] = [
  'ONBOARDING_INITIATED',
  'ONBOARDING_IN_PROGRESS',
  'VERIFICATION',
  'APPROVED',
  'LIVE_ACTIVE',
];

// Statuses SET_STATUS may target: the main flow (minus the mirrored ones) plus
// the two holding states that are not a closure. Everything else has a
// dedicated action with its own reason rule (CLOSE, MARK_DUPLICATE, ARCHIVE).
export const SETTABLE_STATUSES: readonly LeadStatus[] = [
  ...LEAD_MAIN_FLOW_STATUSES.filter((status) => !ONBOARDING_MIRRORED_STATUSES.includes(status)),
  'FOLLOW_UP_LATER',
  'NO_RESPONSE',
];

export const isSettableStatus = (value: unknown): value is LeadStatus =>
  typeof value === 'string' && (SETTABLE_STATUSES as readonly string[]).includes(value);

export const CLOSING_STATUSES: readonly LeadStatus[] = [
  'LOST',
  'NOT_INTERESTED',
  'WRONG_CONTACT',
  'NOT_ELIGIBLE',
  'TEMPORARILY_CLOSED',
  'REJECTED',
];

export const REASON_REQUIRED: readonly LifecycleAction[] = ['CLOSE', 'MARK_DUPLICATE'];

export const MIN_REASON_LENGTH = 3;

export type LifecycleDecision =
  | { ok: true; toStatus: LeadStatus; auditAction: GovernanceAction }
  | { ok: false; error: string };

export const decideLifecycleAction = ({
  action,
  currentStatus,
  requestedStatus,
  reason,
}: {
  action: LifecycleAction;
  currentStatus: string | null;
  requestedStatus?: string | null;
  reason: string | null;
}): LifecycleDecision => {
  if (REASON_REQUIRED.includes(action) && (reason ?? '').trim().length < MIN_REASON_LENGTH) {
    return { ok: false, error: `A reason is required to ${action.toLowerCase().replace('_', ' ')} a lead.` };
  }

  if (action === 'SET_STATUS') {
    if (!isSettableStatus(requestedStatus)) {
      return {
        ok: false,
        error: 'That status cannot be set directly. Use Close, Archive or Mark duplicate, or let onboarding drive it.',
      };
    }

    if (currentStatus !== null && isClosedOrArchived(currentStatus)) {
      return { ok: false, error: 'Reopen the lead first; a closed or archived lead cannot change status.' };
    }

    if (currentStatus === requestedStatus) {
      return { ok: false, error: `The lead is already ${requestedStatus.toLowerCase().replace(/_/g, ' ')}.` };
    }

    return { ok: true, toStatus: requestedStatus, auditAction: 'STATUS_CHANGE' };
  }

  let toStatus: LeadStatus = LIFECYCLE_TARGET_STATUS[action];

  if (action === 'CLOSE' && requestedStatus && (CLOSING_STATUSES as readonly string[]).includes(requestedStatus)) {
    toStatus = requestedStatus as LeadStatus;
  }

  if (action === 'REOPEN' && currentStatus !== null && !isClosedOrArchived(currentStatus)) {
    return { ok: false, error: 'Only an archived, closed or duplicate lead can be reopened.' };
  }

  if (currentStatus === toStatus) {
    return { ok: false, error: `The lead is already ${toStatus.toLowerCase().replace(/_/g, ' ')}.` };
  }

  return { ok: true, toStatus, auditAction: action };
};

export const isClosedOrArchived = (status: string): boolean =>
  status === 'DORMANT' || status === 'DUPLICATE' || (CLOSING_STATUSES as readonly string[]).includes(status);

// ---------------------------------------------------------------------------
// Permanent delete
// ---------------------------------------------------------------------------

export const DELETABLE_OBJECTS = ['lvLead', 'lvOnboarding', 'lvOnboardingDocument'] as const;

export type DeletableObject = (typeof DELETABLE_OBJECTS)[number];

export const isDeletableObject = (value: unknown): value is DeletableObject =>
  typeof value === 'string' && (DELETABLE_OBJECTS as readonly string[]).includes(value);

export type Dependents = Record<string, number>;

// Permanent deletion is Twenty's own two-step path (Delete → Trash →
// Permanently destroy), gated by the caller's role permission — only Main
// Admin holds destroy — and audited from the *.deleted / *.restored /
// *.destroyed events. A logic function cannot perform it: it acts with the
// application's own role, which deliberately has neither destroy nor
// soft-delete permission. The route this module exposes is therefore an
// impact analysis, not a delete.
