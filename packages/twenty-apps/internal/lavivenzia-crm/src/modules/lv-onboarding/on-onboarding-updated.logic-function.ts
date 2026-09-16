import { CoreApiClient } from 'twenty-client-sdk/core';
import {
  defineLogicFunction,
  type DatabaseEventPayload,
  type ObjectRecordUpdateEvent,
} from 'twenty-sdk/define';

import { FN_ON_ONBOARDING_UPDATED_ID } from 'src/constants/universal-identifiers';
import { priorityOrDefault } from 'src/modules/lv-core/constants/lead-lifecycle';
import { ensurePartnerForOnboarding, type LeadForActivation, type OnboardingForActivation } from 'src/modules/lv-core/services/ecosystem-activation';
import { loadListingsForPartner, loadOnboardingWithDocuments, loadPartner, partnerReadiness } from 'src/modules/lv-core/services/ecosystem-service';
import { type Readiness } from 'src/modules/lv-core/services/activation-readiness';
import { applicationClient } from 'src/modules/lv-ai/runtime/clients';
import { isClosedOrArchived } from 'src/modules/lv-governance/services/governance';
import { isOnboardingStatus, type OnboardingStatus } from 'src/modules/lv-onboarding/constants/onboarding-status';
import { createCoreApiNotificationPort } from 'src/modules/lv-notifications/services/core-api-notification-port';
import { findLead } from 'src/modules/lv-notifications/services/member-lookup';
import { dispatchNotifications } from 'src/modules/lv-notifications/services/notification-service';
import { notificationsForEcosystem, notificationsForOnboardingStatus } from 'src/modules/lv-notifications/utils/build-notification';
import { createCoreApiSlaPort } from 'src/modules/lv-sla/services/core-api-sla-port';
import { evaluateTarget, startSla } from 'src/modules/lv-sla/services/sla-lifecycle';
import { entersOnboardingInitiated } from 'src/modules/lv-sla/utils/sla-triggers';

// Reacts to an onboarding status change: mirrors the status onto the lead,
// notifies the people the change concerns and — Day 9 — on APPROVED (or an
// ACTIVATED onboarding that never got one) creates or links the partner and
// its experience / property (ecosystem-activation.ts, idempotent by source
// key, so a replayed event changes nothing).
//
// Why a database event rather than the transition route doing it: routes run
// with the caller's own permissions, and a reviewer — correctly — cannot write
// leads or other people's notifications. This function runs as the
// application role, triggered by the update the route already made. Both
// writes are idempotent: the lead sync is same-in-same-out, and the
// notifications are keyed on the record's updatedAt.

type OnboardingRow = {
  id: string;
  name?: string | null;
  leadId?: string | null;
  status?: string | null;
  reviewerId?: string | null;
  updatedAt?: string | null;
};

// Which lead status an onboarding status implies (null = leave the lead alone).
export const leadStatusFor = (status: OnboardingStatus): string | null => {
  switch (status) {
    case 'INVITED':
    case 'INITIATED':
      return 'ONBOARDING_INITIATED';
    case 'IN_PROGRESS':
    case 'WAITING_FOR_PARTNER':
    case 'CHANGES_REQUESTED':
      return 'ONBOARDING_IN_PROGRESS';
    case 'VERIFICATION':
    case 'INTERNAL_REVIEW':
      return 'VERIFICATION';
    case 'APPROVED':
      return 'APPROVED';
    case 'ACTIVATED':
      return 'LIVE_ACTIVE';
    default:
      return null;
  }
};

const MIRRORED_ORDER = ['ONBOARDING_INITIATED', 'ONBOARDING_IN_PROGRESS', 'VERIFICATION', 'APPROVED', 'LIVE_ACTIVE', 'GROWTH'];

// Never move a lead backwards along the mirrored stretch (CHANGES_REQUESTED
// after VERIFICATION is the one legitimate step back, and it is allowed:
// ONBOARDING_IN_PROGRESS < VERIFICATION, so this returns true for it — the
// onboarding really did go back to the partner).
const rewinds = (current: string, next: string): boolean => {
  const from = MIRRORED_ORDER.indexOf(current);
  const to = MIRRORED_ORDER.indexOf(next);

  // A lead before the onboarding stretch (e.g. INTERESTED) may always enter it.
  if (from === -1) {
    return false;
  }

  // GROWTH and LIVE_ACTIVE are never rewound by an onboarding event.
  return from >= MIRRORED_ORDER.indexOf('LIVE_ACTIVE') && to < from;
};

// Readiness right after creation, read with the application role (this runs
// from a database event; there is no caller).
const readPartnerReadiness = async (_client: CoreApiClient, partnerId: string, now: string): Promise<Readiness | null> => {
  try {
    const graphql = applicationClient();
    const partner = await loadPartner(graphql, partnerId);

    if (!partner) {
      return null;
    }

    const [{ onboarding, documents }, experiences, properties] = await Promise.all([loadOnboardingWithDocuments(graphql, partner.onboardingId), loadListingsForPartner(graphql, 'experience', partner.id), loadListingsForPartner(graphql, 'property', partner.id)]);

    return partnerReadiness({ partner, onboarding, documents, experiences, properties, now });
  } catch {
    return null;
  }
};

export const handler = async (
  payload: DatabaseEventPayload<ObjectRecordUpdateEvent<OnboardingRow>>,
): Promise<Record<string, unknown>> => {
  const after = payload.properties.after;
  const before = payload.properties.before;

  if (!after?.id) {
    return { synced: false, notified: 0, reason: 'No record.' };
  }

  if (!after.status || !isOnboardingStatus(after.status)) {
    return { synced: false, notified: 0, reason: 'No recognisable status on the record.' };
  }

  const client = new CoreApiClient({ runAs: 'application' });
  const now = new Date().toISOString();
  const slaPort = createCoreApiSlaPort(client);

  // Every update re-evaluates the onboarding's open SLAs (a reviewer change is
  // a reassignment; a status change may resolve the first-action clock or
  // close the missing-document clocks). Only a status change goes further.
  const slaEvaluated = (await evaluateTarget({ port: slaPort, onboardingId: after.id, now })).length;

  // Only act on a status change. Every other update to an onboarding (answers,
  // progress, reviewer) would otherwise re-write the lead for nothing.
  if (before?.status === after.status) {
    return { synced: false, notified: 0, reason: 'Status unchanged.', slaEvaluated };
  }

  const lead = await findLead(client, after.leadId);

  // SLA rule 3 — onboarding first action, owned by the reviewer.
  let slaStarted: string | null = null;

  if (entersOnboardingInitiated(before?.status, after.status)) {
    const outcome = await startSla({
      port: slaPort,
      rule: 'ONBOARDING_FIRST_ACTION',
      subjectName: after.name ?? lead?.name ?? 'Partner onboarding',
      priority: priorityOrDefault(lead?.priority),
      ownerWorkspaceMemberId: after.reviewerId ?? null,
      target: { object: 'lvOnboarding', recordId: after.id },
      leadId: lead?.id ?? null,
      onboardingId: after.id,
      documentId: null,
      startedAt: after.updatedAt ?? now,
      sourceEvent: payload.name,
      actorWorkspaceMemberId: payload.workspaceMemberId ?? null,
    });

    slaStarted = outcome.outcome;
  }

  let synced = false;

  if (lead !== null) {
    // The lead's own lifecycle follows the onboarding through its mirrored
    // states (ONBOARDING.md); a closed / archived lead is left alone, and a
    // lead already further along is never rewound.
    const mirrored = leadStatusFor(after.status);
    const current = (await client.query({ lvLead: { __args: { filter: { id: { eq: lead.id } } }, status: true } })) as { lvLead?: { status?: string | null } | null };
    const currentStatus = current.lvLead?.status ?? null;
    const canMirror = mirrored !== null && (currentStatus === null || (!isClosedOrArchived(currentStatus) && !rewinds(currentStatus, mirrored)));

    await client.mutation({
      updateLvLead: {
        __args: { id: lead.id, data: { onboardingStatus: after.status, ...(canMirror ? { status: mirrored } : {}) } },
        id: true,
      },
    });
    synced = true;
  }

  // Approval → partner (and listing). Also on ACTIVATED, in case an
  // onboarding was approved before Day 9 and never produced its partner.
  let activation: Awaited<ReturnType<typeof ensurePartnerForOnboarding>> | { error: string } | null = null;

  if (after.status === 'APPROVED' || after.status === 'ACTIVATED') {
    try {
      const full = (await client.query({ lvOnboarding: { __args: { filter: { id: { eq: after.id } } }, id: true, name: true, status: true, leadId: true, reviewerId: true, decidedAt: true, answers: true } })) as { lvOnboarding?: OnboardingForActivation | null };
      const leadRow = after.leadId
        ? ((await client.query({ lvLead: { __args: { filter: { id: { eq: after.leadId } } }, id: true, lvLeadId: true, name: true, organisationName: true, category: true, subcategory: true, location: true, ownerId: true, languages: true, emails: { primaryEmail: true }, phones: { primaryPhoneNumber: true, primaryPhoneCallingCode: true, primaryPhoneCountryCode: true }, website: { primaryLinkUrl: true }, instagram: { primaryLinkUrl: true } } })) as { lvLead?: LeadForActivation | null }).lvLead ?? null
        : null;

      if (full.lvOnboarding) {
        activation = await ensurePartnerForOnboarding({ application: client, onboarding: full.lvOnboarding, lead: leadRow, actorWorkspaceMemberId: payload.workspaceMemberId ?? null, now, sourceEvent: payload.name });

        // Tell the owner a partner now exists (and whether it can go live) —
        // through the Day 4 dispatcher, deduped on the approval event.
        if (activation.partner.created) {
          const readiness = await readPartnerReadiness(client, activation.partner.id, now);
          const intents = [
            ...notificationsForEcosystem({ event: 'PARTNER_CREATED', recordId: activation.partner.id, recordName: leadRow?.name ?? after.name ?? 'Partner', recordCode: activation.partner.partnerCode, object: 'lvPartner', partnerId: activation.partner.id, leadId: after.leadId ?? null, recipients: [leadRow?.ownerId ?? null], actorWorkspaceMemberId: null, changedAt: after.updatedAt ?? now, readinessReasons: readiness?.reasons.length ?? undefined }),
            ...(readiness?.status === 'READY' ? notificationsForEcosystem({ event: 'ACTIVATION_READY', recordId: activation.partner.id, recordName: leadRow?.name ?? after.name ?? 'Partner', recordCode: activation.partner.partnerCode, object: 'lvPartner', partnerId: activation.partner.id, leadId: after.leadId ?? null, recipients: [leadRow?.ownerId ?? null, after.reviewerId ?? null], actorWorkspaceMemberId: null, changedAt: after.updatedAt ?? now }) : []),
          ];

          await dispatchNotifications({ port: createCoreApiNotificationPort(client), intents, sourceEvent: payload.name, actorWorkspaceMemberId: payload.workspaceMemberId ?? null });
        }
      }
    } catch (error) {
      activation = { error: error instanceof Error ? error.message.slice(0, 200) : String(error) };
      console.error('[lv-onboarding] partner activation failed:', activation.error);
    }
  }

  const intents = notificationsForOnboardingStatus({
    onboardingId: after.id,
    onboardingName: after.name ?? lead?.name ?? 'Partner onboarding',
    status: after.status,
    changedAt: after.updatedAt ?? new Date(0).toISOString(),
    reviewerWorkspaceMemberId: after.reviewerId ?? null,
    leadId: lead?.id ?? null,
    leadOwnerWorkspaceMemberId: lead?.ownerWorkspaceMemberId ?? null,
  });

  const outcome = await dispatchNotifications({
    port: createCoreApiNotificationPort(client),
    intents,
    sourceEvent: payload.name,
    // The person who made the transition, from the event — never the body.
    actorWorkspaceMemberId: payload.workspaceMemberId ?? null,
  });

  return {
    synced,
    activation,
    leadId: lead?.id ?? null,
    status: after.status,
    notified: outcome.created.length,
    duplicates: outcome.duplicates.length,
    suppressed: outcome.suppressed,
    slaEvaluated,
    slaStarted,
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_ON_ONBOARDING_UPDATED_ID,
  name: 'lv-on-onboarding-updated',
  description:
    'Mirrors an onboarding status change onto its lead and notifies the reviewer and lead owner, running as the application role',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvOnboarding.updated' },
});
