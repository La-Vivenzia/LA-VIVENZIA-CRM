import { CoreApiClient } from 'twenty-client-sdk/core';
import { type DatabaseEventPayload } from 'twenty-sdk/define';

import { type GovernanceAction } from 'src/modules/lv-governance/objects/audit-event.object';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';

// Audits Twenty's own destructive operations from their database events:
//   *.deleted   → TRASH            (soft delete; the record is recoverable)
//   *.restored  → RESTORE
//   *.destroyed → PERMANENT_DELETE (the record is gone; only its snapshot remains)
//
// Capturing these at the event means EVERY path is covered — the record menu,
// the trash view, the REST/GraphQL API, a bulk action — not just a button this
// application draws. The actor is the event's workspaceMemberId (null for an
// API key or the system); the label comes from the record snapshot the event
// carries, which is all that survives a destroy.

type Snapshot = {
  id?: string;
  name?: string | null;
  lvLeadId?: string | null;
  status?: string | null;
  ownerId?: string | null;
  reviewerId?: string | null;
  verificationState?: string | null;
  onboardingId?: string | null;
  leadId?: string | null;
};

type AnyRecordEvent = DatabaseEventPayload<{
  recordId: string;
  userId?: string;
  workspaceMemberId?: string;
  properties: { before?: Snapshot; after?: Snapshot };
}>;

const ACTION_FOR_SUFFIX: Record<string, GovernanceAction> = {
  deleted: 'TRASH',
  restored: 'RESTORE',
  destroyed: 'PERMANENT_DELETE',
};

export const labelOf = (snapshot: Snapshot | undefined, fallback: string): string =>
  `${snapshot?.lvLeadId ?? ''} ${snapshot?.name ?? ''}`.trim() || fallback;

export const auditDestructiveEvent = async (
  payload: AnyRecordEvent,
  objectNameSingular: string,
): Promise<Record<string, unknown>> => {
  const suffix = payload.name.split('.').pop() ?? '';
  const action = ACTION_FOR_SUFFIX[suffix];
  const snapshot = payload.properties.before ?? payload.properties.after;
  const recordId = payload.recordId ?? snapshot?.id;

  if (!action || !recordId) {
    return { audited: false, reason: `Unhandled event ${payload.name}.` };
  }

  const client = new CoreApiClient({ runAs: 'application' });
  const auditId = await writeAuditEvent(client, {
    action,
    outcome: 'APPLIED',
    targetObject: objectNameSingular,
    targetRecordId: recordId,
    targetLabel: labelOf(snapshot, recordId),
    actorWorkspaceMemberId: payload.workspaceMemberId ?? null,
    at: new Date().toISOString(),
    reason: null,
    metadata: {
      event: payload.name,
      status: snapshot?.status ?? snapshot?.verificationState ?? null,
      ownerId: snapshot?.ownerId ?? snapshot?.reviewerId ?? null,
      leadId: snapshot?.leadId ?? null,
      onboardingId: snapshot?.onboardingId ?? null,
      // No human actor on the event means an API key or automation did it.
      actorKind: payload.workspaceMemberId ? 'MEMBER' : 'SYSTEM_OR_API_KEY',
    },
  });

  return { audited: auditId !== null, auditId, action, recordId };
};
