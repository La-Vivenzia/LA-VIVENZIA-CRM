import 'src/modules/lv-core/runtime/resilient-fetch';
import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { FN_AUDIT_LEAD_DELETED_ID } from 'src/constants/universal-identifiers';
import { auditDestructiveEvent } from 'src/modules/lv-governance/services/destructive-event-audit';

// Audits a lead moved to the trash (TRASH), whichever path did it

export const handler = (payload: DatabaseEventPayload) =>
  auditDestructiveEvent(payload as Parameters<typeof auditDestructiveEvent>[0], 'lvLead');

export default defineLogicFunction({
  universalIdentifier: FN_AUDIT_LEAD_DELETED_ID,
  name: 'lv-audit-lead-deleted',
  description: 'Audits a lead moved to the trash (TRASH), whichever path did it',
  timeoutSeconds: 15,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvLead.deleted' },
});
