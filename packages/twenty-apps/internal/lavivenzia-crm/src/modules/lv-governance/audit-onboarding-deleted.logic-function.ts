import 'src/modules/lv-core/runtime/resilient-fetch';
import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { FN_AUDIT_ONBOARDING_DELETED_ID } from 'src/constants/universal-identifiers';
import { auditDestructiveEvent } from 'src/modules/lv-governance/services/destructive-event-audit';

// Audits an onboarding moved to the trash (TRASH)

export const handler = (payload: DatabaseEventPayload) =>
  auditDestructiveEvent(payload as Parameters<typeof auditDestructiveEvent>[0], 'lvOnboarding');

export default defineLogicFunction({
  universalIdentifier: FN_AUDIT_ONBOARDING_DELETED_ID,
  name: 'lv-audit-onboarding-deleted',
  description: 'Audits an onboarding moved to the trash (TRASH)',
  timeoutSeconds: 15,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvOnboarding.deleted' },
});
