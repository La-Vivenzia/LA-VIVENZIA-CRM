import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { FN_AUDIT_DOCUMENT_DELETED_ID } from 'src/constants/universal-identifiers';
import { auditDestructiveEvent } from 'src/modules/lv-governance/services/destructive-event-audit';

// Audits an onboarding document moved to the trash (TRASH)

export const handler = (payload: DatabaseEventPayload) =>
  auditDestructiveEvent(payload as Parameters<typeof auditDestructiveEvent>[0], 'lvOnboardingDocument');

export default defineLogicFunction({
  universalIdentifier: FN_AUDIT_DOCUMENT_DELETED_ID,
  name: 'lv-audit-document-deleted',
  description: 'Audits an onboarding document moved to the trash (TRASH)',
  timeoutSeconds: 15,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvOnboardingDocument.deleted' },
});
