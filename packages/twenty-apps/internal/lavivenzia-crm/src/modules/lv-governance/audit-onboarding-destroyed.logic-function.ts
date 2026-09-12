import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { FN_AUDIT_ONBOARDING_DESTROYED_ID } from 'src/constants/universal-identifiers';
import { auditDestructiveEvent } from 'src/modules/lv-governance/services/destructive-event-audit';

// Audits a permanently deleted onboarding (PERMANENT_DELETE)

export const handler = (payload: DatabaseEventPayload) =>
  auditDestructiveEvent(payload as Parameters<typeof auditDestructiveEvent>[0], 'lvOnboarding');

export default defineLogicFunction({
  universalIdentifier: FN_AUDIT_ONBOARDING_DESTROYED_ID,
  name: 'lv-audit-onboarding-destroyed',
  description: 'Audits a permanently deleted onboarding (PERMANENT_DELETE)',
  timeoutSeconds: 15,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvOnboarding.destroyed' },
});
