import 'src/modules/lv-core/runtime/resilient-fetch';
import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { FN_AUDIT_LEAD_DESTROYED_ID } from 'src/constants/universal-identifiers';
import { auditDestructiveEvent } from 'src/modules/lv-governance/services/destructive-event-audit';

// Audits a permanently deleted lead (PERMANENT_DELETE) from the snapshot the event carries

export const handler = (payload: DatabaseEventPayload) =>
  auditDestructiveEvent(payload as Parameters<typeof auditDestructiveEvent>[0], 'lvLead');

export default defineLogicFunction({
  universalIdentifier: FN_AUDIT_LEAD_DESTROYED_ID,
  name: 'lv-audit-lead-destroyed',
  description: 'Audits a permanently deleted lead (PERMANENT_DELETE) from the snapshot the event carries',
  timeoutSeconds: 15,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvLead.destroyed' },
});
