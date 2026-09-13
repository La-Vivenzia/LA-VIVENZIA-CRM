import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_LOG_INTERACTION_ID } from 'src/constants/universal-identifiers';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { resolveCaller } from 'src/modules/lv-dashboard/services/caller-context';
import { DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';
import { validateInteractionInput } from 'src/modules/lv-interactions/utils/validate-interaction-input';

// POST /interactions/log { leadId, channel, direction, occurredAt?, durationMinutes?,
//   purpose?, summary?, sentiment?, outcome?, objections?, commitments?, nextAction?, nextFollowUpAt? }
//
// The employee-facing way to record a contact. The actor is the session
// member — a body field named actorId / workspaceMemberId is ignored. The
// lead is read AS THE CALLER, so CM-004 decides whether they can see it at
// all; then:
//
//   - a role that may write interactions (coordinator, operations, admin)
//     creates the row delegated, so the platform's object permission binds;
//   - a role that may write the LEAD but not interactions (Experience
//     Hunter) still gets to log the contact — working a lead includes
//     recording what happened — and the row is written with the application
//     role, carrying the session actor, only after the delegated read proved
//     the lead is theirs to work.
//
// Everything downstream (lead summary, follow-up task, LEAD_REPLIED, SLA
// re-evaluation, the timeline entry) is the existing lv-on-interaction-created
// hook; this route deliberately adds no second copy of any of it.

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Record<string, unknown>>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can log an interaction.' };
  }

  const now = new Date().toISOString();
  const validation = validateInteractionInput(input, now);

  if (!validation.ok) {
    return { ok: false, refusal: 'INVALID_INPUT', error: validation.errors[0], errors: validation.errors };
  }

  const draft = validation.input;
  const delegated = new CoreApiClient();
  type LeadRow = { id: string; name?: string | null; lvLeadId?: string | null; status?: string | null };
  let lead: LeadRow | null = null;

  try {
    const result = await delegated.query({
      lvLead: { __args: { filter: { id: { eq: draft.leadId } } }, id: true, name: true, lvLeadId: true, status: true },
    });

    lead = (result as { lvLead?: LeadRow | null }).lvLead ?? null;
  } catch {
    lead = null;
  }

  if (lead === null) {
    return { ok: false, refusal: 'NOT_FOUND', error: 'That lead does not exist or is not yours to work.' };
  }

  const caller = await resolveCaller(new DelegatedGraphqlClient());
  const mayWriteInteractions = caller.objectPermissions.lvInteraction?.update === true;
  const mayWriteLead = caller.objectPermissions.lvLead?.update === true;

  if (!mayWriteInteractions && !mayWriteLead) {
    return { ok: false, refusal: 'NOT_PERMITTED', error: 'Your role cannot log interactions.' };
  }

  const writer = mayWriteInteractions ? delegated : new CoreApiClient({ runAs: 'application' });
  const application = new CoreApiClient({ runAs: 'application' });
  const label = `${lead.lvLeadId ?? ''} ${lead.name ?? ''}`.trim() || lead.id;
  let interactionId: string | null = null;

  try {
    const created = await writer.mutation({
      createLvInteraction: {
        __args: {
          data: {
            name: draft.name,
            leadId: draft.leadId,
            channel: draft.channel,
            direction: draft.direction,
            occurredAt: draft.occurredAt,
            // Session-derived. This is the only identity the row ever carries.
            actorId: actorWorkspaceMemberId,
            durationMinutes: draft.durationMinutes,
            purpose: draft.purpose,
            // A RICH_TEXT composite must be absent, not null, when empty.
            ...(draft.summary ? { summary: { markdown: draft.summary } } : {}),
            sentiment: draft.sentiment,
            outcome: draft.outcome,
            objections: draft.objections,
            commitments: draft.commitments,
            nextAction: draft.nextAction,
            nextFollowUpAt: draft.nextFollowUpAt,
          },
        },
        id: true,
      },
    });

    interactionId = (created as { createLvInteraction?: { id?: string } }).createLvInteraction?.id ?? null;
  } catch (error) {
    await writeAuditEvent(application, {
      action: 'INTERACTION_LOGGED',
      outcome: 'REFUSED',
      targetObject: 'lvLead',
      targetRecordId: lead.id,
      targetLabel: label,
      actorWorkspaceMemberId,
      at: now,
      reason: null,
      metadata: { channel: draft.channel, error: 'permission' },
    });

    return {
      ok: false,
      refusal: 'NOT_PERMITTED',
      error: 'The interaction was refused by the server.',
      detail: error instanceof Error ? error.message.slice(0, 160) : undefined,
    };
  }

  if (interactionId === null) {
    return { ok: false, error: 'The interaction was not created.' };
  }

  const auditId = await writeAuditEvent(application, {
    action: 'INTERACTION_LOGGED',
    outcome: 'APPLIED',
    targetObject: 'lvLead',
    targetRecordId: lead.id,
    targetLabel: label,
    actorWorkspaceMemberId,
    at: now,
    reason: null,
    metadata: {
      interactionId,
      channel: draft.channel,
      direction: draft.direction,
      outcome: draft.outcome,
      nextFollowUpAt: draft.nextFollowUpAt,
      writtenAs: mayWriteInteractions ? 'caller' : 'application-for-lead-writer',
    },
  });

  return {
    ok: true,
    interactionId,
    leadId: lead.id,
    name: draft.name,
    occurredAt: draft.occurredAt,
    // The follow-up task, lead summary and notifications are produced by the
    // lvInteraction.created hook shortly after; the page reloads to show them.
    followUpScheduled: draft.nextFollowUpAt !== null || draft.nextAction !== null,
    auditId,
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_LOG_INTERACTION_ID,
  name: 'lv-log-interaction',
  description: 'Records a contact with a lead from Lead 360, with the actor taken from the session and an audit row',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: { path: '/interactions/log', httpMethod: 'POST', isAuthRequired: true },
});
