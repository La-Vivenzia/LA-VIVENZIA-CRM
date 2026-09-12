import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { FN_AUDIT_LEAD_RESTORED_ID } from 'src/constants/universal-identifiers';
import { auditDestructiveEvent } from 'src/modules/lv-governance/services/destructive-event-audit';

// Audits a lead restored from the trash (RESTORE)

export const handler = (payload: DatabaseEventPayload) =>
  auditDestructiveEvent(payload as Parameters<typeof auditDestructiveEvent>[0], 'lvLead');

export default defineLogicFunction({
  universalIdentifier: FN_AUDIT_LEAD_RESTORED_ID,
  name: 'lv-audit-lead-restored',
  description: 'Audits a lead restored from the trash (RESTORE)',
  timeoutSeconds: 15,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvLead.restored' },
});
