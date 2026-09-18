import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_LEAD_ASSIGN_ID } from 'src/constants/universal-identifiers';
import { STATUS_AFTER_ASSIGNMENT } from 'src/modules/lv-core/constants/lead-lifecycle';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { decideOwnerChange } from 'src/modules/lv-assignment/utils/assignment-policy';
import { resolveCaller } from 'src/modules/lv-dashboard/services/caller-context';
import { DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';

// POST /leads/assign { leadId, newOwnerId | null, reason? }
//
// The manual "Change owner" on Lead 360. The policy (assignment-policy.ts)
// decides whether THIS caller may move THIS lead to THAT owner; the update is
// then made as the caller so CM-004 and the lead permission still bind. The
// existing lvLead.updated hook notifies the new owner and re-evaluates SLAs
// exactly as it does for an engine decision — nothing is duplicated here.
// What the engine path has and a raw field edit lacked is written here:
// an lvAssignmentHistory row (strategy MANUAL) and an OWNER_CHANGE audit row.

type Input = { leadId?: unknown; newOwnerId?: unknown; reason?: unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can change an owner.' };
  }

  if (typeof input.leadId !== 'string' || !UUID.test(input.leadId)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'leadId is required.' };
  }

  const newOwnerId = input.newOwnerId === null || input.newOwnerId === '' ? null : typeof input.newOwnerId === 'string' && UUID.test(input.newOwnerId) ? input.newOwnerId : undefined;

  if (newOwnerId === undefined) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'newOwnerId must be a member id or null.' };
  }

  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 500) : null;
  const now = new Date().toISOString();
  const delegated = new CoreApiClient();
  const application = new CoreApiClient({ runAs: 'application' });

  type LeadRow = { id: string; name?: string | null; lvLeadId?: string | null; ownerId?: string | null; status?: string | null };
  let lead: LeadRow | null = null;

  try {
    const result = await delegated.query({ lvLead: { __args: { filter: { id: { eq: input.leadId } } }, id: true, name: true, lvLeadId: true, ownerId: true, status: true } });

    lead = (result as { lvLead?: LeadRow | null }).lvLead ?? null;
  } catch {
    lead = null;
  }

  if (lead === null) {
    return { ok: false, refusal: 'NOT_FOUND', error: 'That lead does not exist or is not visible to you.' };
  }

  if (newOwnerId !== null) {
    // The target must be a real, current member — as the caller, who can read
    // the team. An unknown id would leave the lead pointing at nobody.
    const memberResult = await delegated.query({ workspaceMember: { __args: { filter: { id: { eq: newOwnerId } } }, id: true } });

    if (!(memberResult as { workspaceMember?: { id?: string } | null }).workspaceMember?.id) {
      return { ok: false, refusal: 'INVALID_INPUT', error: 'That team member does not exist.' };
    }
  }

  const caller = await resolveCaller(new DelegatedGraphqlClient());
  const decision = decideOwnerChange({
    actorWorkspaceMemberId,
    isAdmin: caller.isAdmin,
    canEditLead: caller.objectPermissions.lvLead?.update === true,
    currentOwnerId: lead.ownerId ?? null,
    newOwnerId,
  });
  const label = `${lead.lvLeadId ?? ''} ${lead.name ?? ''}`.trim() || lead.id;

  if (!decision.ok) {
    await writeAuditEvent(application, {
      action: 'OWNER_CHANGE',
      outcome: 'REFUSED',
      targetObject: 'lvLead',
      targetRecordId: lead.id,
      targetLabel: label,
      actorWorkspaceMemberId,
      at: now,
      reason,
      metadata: { from: lead.ownerId ?? null, to: newOwnerId, error: 'policy' },
    });

    return { ok: false, refusal: 'POLICY', error: decision.error };
  }

  const data: Record<string, unknown> = { ownerId: newOwnerId, assignedAt: newOwnerId === null ? null : now };

  // A lead that is still upstream of ASSIGNED moves there on its first owner,
  // as the engine does; a lead further along keeps its status.
  if (newOwnerId !== null && (lead.status === 'DISCOVERED' || lead.status === 'NEW' || lead.status === 'QUALIFYING')) {
    data.status = STATUS_AFTER_ASSIGNMENT;
  }

  try {
    await delegated.mutation({ updateLvLead: { __args: { id: lead.id, data }, id: true } });
  } catch (error) {
    await writeAuditEvent(application, {
      action: 'OWNER_CHANGE',
      outcome: 'REFUSED',
      targetObject: 'lvLead',
      targetRecordId: lead.id,
      targetLabel: label,
      actorWorkspaceMemberId,
      at: now,
      reason,
      metadata: { from: lead.ownerId ?? null, to: newOwnerId, error: 'permission' },
    });

    return { ok: false, refusal: 'NOT_PERMITTED', error: 'Your role cannot change this lead.', detail: error instanceof Error ? error.message.slice(0, 160) : undefined };
  }

  try {
    await application.mutation({
      createLvAssignmentHistory: {
        __args: {
          data: {
            name: `MANUAL → ${newOwnerId ?? 'unassigned'}`,
            leadId: lead.id,
            fromOwnerId: lead.ownerId ?? null,
            toOwnerId: newOwnerId,
            strategy: 'MANUAL',
            score: null,
            reason: reason ?? `${decision.kind.toLowerCase()} from Lead 360`,
            assignedAt: now,
            eventKey: null,
          },
        },
        id: true,
      },
    });
  } catch {
    // History is best-effort; the audit row below is the record of decision.
  }

  const auditId = await writeAuditEvent(application, {
    action: 'OWNER_CHANGE',
    outcome: 'APPLIED',
    targetObject: 'lvLead',
    targetRecordId: lead.id,
    targetLabel: label,
    actorWorkspaceMemberId,
    at: now,
    reason,
    metadata: { from: lead.ownerId ?? null, to: newOwnerId, kind: decision.kind, statusSet: data.status ?? null },
  });

  return { ok: true, leadId: lead.id, from: lead.ownerId ?? null, to: newOwnerId, kind: decision.kind, auditId };
};

export default defineLogicFunction({
  universalIdentifier: FN_LEAD_ASSIGN_ID,
  name: 'lv-lead-assign',
  description: 'Changes a lead’s owner by hand (reassign, hand over, release, claim) under the assignment policy, with history and an audit row',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: { path: '/leads/assign', httpMethod: 'POST', isAuthRequired: true },
});
