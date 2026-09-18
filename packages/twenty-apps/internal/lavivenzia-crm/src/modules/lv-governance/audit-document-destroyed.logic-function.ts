import 'src/modules/lv-core/runtime/resilient-fetch';
import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { FN_AUDIT_DOCUMENT_DESTROYED_ID } from 'src/constants/universal-identifiers';
import { auditDestructiveEvent } from 'src/modules/lv-governance/services/destructive-event-audit';

// Audits a permanently deleted onboarding document (PERMANENT_DELETE)

export const handler = (payload: DatabaseEventPayload) =>
  auditDestructiveEvent(payload as Parameters<typeof auditDestructiveEvent>[0], 'lvOnboardingDocument');

export default defineLogicFunction({
  universalIdentifier: FN_AUDIT_DOCUMENT_DESTROYED_ID,
  name: 'lv-audit-document-destroyed',
  description: 'Audits a permanently deleted onboarding document (PERMANENT_DELETE)',
  timeoutSeconds: 15,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvOnboardingDocument.destroyed' },
});
