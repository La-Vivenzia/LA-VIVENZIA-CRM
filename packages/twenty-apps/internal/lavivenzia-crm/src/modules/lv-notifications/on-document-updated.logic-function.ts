import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import {
  defineLogicFunction,
  type DatabaseEventPayload,
  type ObjectRecordUpdateEvent,
} from 'twenty-sdk/define';

import { FN_ON_DOCUMENT_UPDATED_ID } from 'src/constants/universal-identifiers';
import { createCoreApiNotificationPort } from 'src/modules/lv-notifications/services/core-api-notification-port';
import { findLead } from 'src/modules/lv-notifications/services/member-lookup';
import { dispatchNotifications } from 'src/modules/lv-notifications/services/notification-service';
import { notificationsForDocumentRejected } from 'src/modules/lv-notifications/utils/build-notification';
import { priorityOrDefault } from 'src/modules/lv-core/constants/lead-lifecycle';
import { createCoreApiSlaPort } from 'src/modules/lv-sla/services/core-api-sla-port';
import { evaluateTarget, startSla } from 'src/modules/lv-sla/services/sla-lifecycle';
import { entersMissingDocument } from 'src/modules/lv-sla/utils/sla-triggers';

// Fires on lvOnboardingDocument.updated. Produces DOCUMENT_REJECTED when a
// document's verification state becomes REJECTED — however that happened
// (the review route, or an admin edit). Runs as the application role because
// the reviewer who rejected it cannot write the lead owner's notification.
//
// Also the document-side SLA hook: a document entering REJECTED /
// NEEDS_REPLACEMENT / EXPIRED starts the missing-document clock (rule 4), and
// any review action re-evaluates the onboarding's SLAs (a first review
// resolves rule 3; a resubmission resolves rule 4).

type DocumentRow = {
  id: string;
  name?: string | null;
  documentType?: string | null;
  onboardingId?: string | null;
  verificationState?: string | null;
  rejectionReason?: string | null;
  updatedAt?: string | null;
};

export const handler = async (
  payload: DatabaseEventPayload<ObjectRecordUpdateEvent<DocumentRow>>,
): Promise<Record<string, unknown>> => {
  const after = payload.properties.after;
  const before = payload.properties.before;

  if (!after?.id) {
    return { notified: 0, reason: 'No record.' };
  }

  const client = new CoreApiClient({ runAs: 'application' });
  const now = new Date().toISOString();
  const slaPort = createCoreApiSlaPort(client);

  let reviewerWorkspaceMemberId: string | null = null;
  let leadId: string | null = null;

  if (after.onboardingId) {
    const parent = await client.query({
      lvOnboarding: {
        __args: { filter: { id: { eq: after.onboardingId } } },
        reviewerId: true,
        leadId: true,
      },
    });
    const onboarding = (
      parent as { lvOnboarding?: { reviewerId?: string | null; leadId?: string | null } | null }
    ).lvOnboarding;

    reviewerWorkspaceMemberId = onboarding?.reviewerId ?? null;
    leadId = onboarding?.leadId ?? null;
  }

  const lead = await findLead(client, leadId);

  // SLA rule 4 — missing document. Owned by whoever chases the partner: the
  // lead owner, or the reviewer when the onboarding has no lead.
  let slaStarted: string | null = null;

  if (entersMissingDocument(before?.verificationState, after.verificationState)) {
    const outcome = await startSla({
      port: slaPort,
      rule: 'MISSING_DOCUMENT',
      subjectName: `${after.name ?? after.documentType ?? 'Document'}${lead ? ` (${lead.name})` : ''}`,
      priority: priorityOrDefault(lead?.priority),
      ownerWorkspaceMemberId: lead?.ownerWorkspaceMemberId ?? reviewerWorkspaceMemberId,
      target: { object: 'lvOnboardingDocument', recordId: after.id },
      leadId: lead?.id ?? null,
      onboardingId: after.onboardingId ?? null,
      documentId: after.id,
      startedAt: after.updatedAt ?? now,
      sourceEvent: payload.name,
      actorWorkspaceMemberId: payload.workspaceMemberId ?? null,
    });

    slaStarted = outcome.outcome;
  }

  const slaEvaluated = (
    await evaluateTarget({ port: slaPort, documentId: after.id, onboardingId: after.onboardingId ?? null, now })
  ).length;

  if (after.verificationState !== 'REJECTED' || before?.verificationState === 'REJECTED') {
    return { notified: 0, reason: 'Not a transition into REJECTED.', slaStarted, slaEvaluated };
  }

  const intents = notificationsForDocumentRejected({
    documentId: after.id,
    documentLabel: after.name ?? after.documentType ?? 'Document',
    onboardingId: after.onboardingId ?? null,
    reason: after.rejectionReason ?? null,
    changedAt: after.updatedAt ?? new Date(0).toISOString(),
    reviewerWorkspaceMemberId,
    leadId: lead?.id ?? null,
    leadName: lead?.name ?? null,
    leadOwnerWorkspaceMemberId: lead?.ownerWorkspaceMemberId ?? null,
  });

  const outcome = await dispatchNotifications({
    port: createCoreApiNotificationPort(client),
    intents,
    sourceEvent: payload.name,
    actorWorkspaceMemberId: payload.workspaceMemberId ?? null,
  });

  return {
    notified: outcome.created.length,
    duplicates: outcome.duplicates.length,
    suppressed: outcome.suppressed,
    slaStarted,
    slaEvaluated,
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_ON_DOCUMENT_UPDATED_ID,
  name: 'lv-on-document-updated',
  description:
    'Notifies the reviewer and lead owner when an onboarding document is rejected',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvOnboardingDocument.updated' },
});
