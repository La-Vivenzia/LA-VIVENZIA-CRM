import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_LEAD_LIFECYCLE_ACTION_ID } from 'src/constants/universal-identifiers';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';
import {
  decideLifecycleAction,
  isLifecycleAction,
} from 'src/modules/lv-governance/services/governance';

// POST /leads/lifecycle { leadId, action: ARCHIVE|CLOSE|MARK_DUPLICATE|REOPEN|SET_STATUS, reason?, status? }
//
// The non-destructive alternatives to deleting a lead, plus (Day 7) the
// governed forward step SET_STATUS that Lead 360 uses. The status change is
// made DELEGATED — as the caller — so Twenty's object permissions and CM-004
// decide whether this person may change this lead at all; the route adds
// nothing. What the route adds is the policy (reason required to close or
// mark duplicate; only a closed lead can be reopened) and the audit row,
// written with the application role from the session-derived actor.

type Input = { leadId?: unknown; action?: unknown; reason?: unknown; status?: unknown };

const UUID = /^[0-9a-f-]{36}$/i;

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can change a lead lifecycle.' };
  }

  if (typeof input.leadId !== 'string' || !UUID.test(input.leadId)) {
    return { ok: false, error: 'leadId is required.' };
  }

  if (!isLifecycleAction(input.action)) {
    return { ok: false, error: 'action must be ARCHIVE, CLOSE, MARK_DUPLICATE, REOPEN or SET_STATUS.' };
  }

  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 500) : null;
  const delegated = new CoreApiClient();

  // Read as the caller: a lead they cannot see is, to them, not there.
  type LeadRow = { id: string; name?: string | null; status?: string | null; lvLeadId?: string | null };
  let lead: LeadRow | null = null;

  try {
    const result = await delegated.query({
      lvLead: { __args: { filter: { id: { eq: input.leadId } } }, id: true, name: true, status: true, lvLeadId: true },
    });

    lead = (result as { lvLead?: LeadRow | null }).lvLead ?? null;
  } catch {
    lead = null;
  }

  if (lead === null) {
    return { ok: false, refusal: 'NOT_FOUND', error: 'That lead does not exist.' };
  }

  const decision = decideLifecycleAction({
    action: input.action,
    currentStatus: lead.status ?? null,
    requestedStatus: typeof input.status === 'string' ? input.status : null,
    reason,
  });

  if (!decision.ok) {
    return { ok: false, refusal: 'POLICY', error: decision.error };
  }

  const now = new Date().toISOString();
  const application = new CoreApiClient({ runAs: 'application' });
  const label = `${lead.lvLeadId ?? ''} ${lead.name ?? ''}`.trim() || lead.id;

  try {
    await delegated.mutation({
      updateLvLead: { __args: { id: lead.id, data: { status: decision.toStatus } }, id: true },
    });
  } catch (error) {
    await writeAuditEvent(application, {
      action: decision.auditAction,
      outcome: 'REFUSED',
      targetObject: 'lvLead',
      targetRecordId: lead.id,
      targetLabel: label,
      actorWorkspaceMemberId,
      at: now,
      reason,
      metadata: { from: lead.status ?? null, to: decision.toStatus, error: 'permission' },
    });

    return {
      ok: false,
      refusal: 'NOT_PERMITTED',
      error: 'Your role cannot change this lead.',
      detail: error instanceof Error ? error.message.slice(0, 120) : undefined,
    };
  }

  const auditId = await writeAuditEvent(application, {
    action: decision.auditAction,
    outcome: 'APPLIED',
    targetObject: 'lvLead',
    targetRecordId: lead.id,
    targetLabel: label,
    actorWorkspaceMemberId,
    at: now,
    reason,
    metadata: { from: lead.status ?? null, to: decision.toStatus },
  });

  return { ok: true, leadId: lead.id, from: lead.status ?? null, to: decision.toStatus, auditId };
};

export default defineLogicFunction({
  universalIdentifier: FN_LEAD_LIFECYCLE_ACTION_ID,
  name: 'lv-lead-lifecycle-action',
  description: 'Archive, close, mark duplicate or reopen a lead as the caller, with a governance audit entry',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/leads/lifecycle',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
