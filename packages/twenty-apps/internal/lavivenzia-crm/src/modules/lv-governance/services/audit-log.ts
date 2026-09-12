import { type CoreApiClient } from 'twenty-client-sdk/core';

import { type GovernanceAction } from 'src/modules/lv-governance/objects/audit-event.object';

// Writes governance audit rows. Always with the APPLICATION role: the person
// acting has no write permission on lvAuditEvent, which is the point — an
// audit log a user could edit is not an audit log. The actor is whatever the
// route derived from the session, never a body field.

export type AuditWrite = {
  action: GovernanceAction;
  outcome: 'APPLIED' | 'REFUSED' | 'FAILED';
  targetObject: string;
  targetRecordId: string;
  targetLabel: string;
  actorWorkspaceMemberId: string | null;
  at: string;
  reason: string | null;
  metadata: Record<string, unknown>;
};

export const writeAuditEvent = async (client: CoreApiClient, event: AuditWrite): Promise<string | null> => {
  try {
    const result = await client.mutation({
      createLvAuditEvent: {
        __args: {
          data: {
            name: `${event.action} · ${event.targetLabel}`.slice(0, 200),
            action: event.action,
            outcome: event.outcome,
            targetObject: event.targetObject,
            targetRecordId: event.targetRecordId,
            targetLabel: event.targetLabel,
            actorId: event.actorWorkspaceMemberId,
            at: event.at,
            reason: event.reason,
            metadata: event.metadata,
          },
        },
        id: true,
      },
    });

    return (result as { createLvAuditEvent?: { id?: string } }).createLvAuditEvent?.id ?? null;
  } catch {
    // The audit write failing must not hide the outcome from the caller, but
    // a destructive action must not proceed without it — callers check for
    // null before destroying.
    return null;
  }
};

export const updateAuditOutcome = async (
  client: CoreApiClient,
  auditId: string,
  outcome: 'APPLIED' | 'REFUSED' | 'FAILED',
  detail: Record<string, unknown>,
): Promise<void> => {
  await client
    .mutation({
      updateLvAuditEvent: { __args: { id: auditId, data: { outcome, metadata: detail } }, id: true },
    })
    .catch(() => undefined);
};
