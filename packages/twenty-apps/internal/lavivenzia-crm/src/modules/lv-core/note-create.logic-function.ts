import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_NOTE_CREATE_ID } from 'src/constants/universal-identifiers';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';

// POST /notes/create { leadId, title?, body }
//
// An internal note from Lead 360. It is Twenty's own `note` + `noteTarget`
// (the same rows the Notes tab shows and the timeline records), created as
// the caller so the note permission binds. Only the audit row is added —
// notes are relationship history and a team needs to know who wrote what.

type Input = { leadId?: unknown; title?: unknown; body?: unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can add a note.' };
  }

  if (typeof input.leadId !== 'string' || !UUID.test(input.leadId)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'leadId is required.' };
  }

  const body = typeof input.body === 'string' ? input.body.trim().slice(0, 8000) : '';

  if (body.length < 2) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'Write the note first.' };
  }

  const title = (typeof input.title === 'string' && input.title.trim().length > 0 ? input.title.trim() : body.split('\n')[0]).slice(0, 120);
  const now = new Date().toISOString();
  const delegated = new CoreApiClient();
  const application = new CoreApiClient({ runAs: 'application' });

  type LeadRow = { id: string; name?: string | null; lvLeadId?: string | null };
  let lead: LeadRow | null = null;

  try {
    const result = await delegated.query({ lvLead: { __args: { filter: { id: { eq: input.leadId } } }, id: true, name: true, lvLeadId: true } });

    lead = (result as { lvLead?: LeadRow | null }).lvLead ?? null;
  } catch {
    lead = null;
  }

  if (lead === null) {
    return { ok: false, refusal: 'NOT_FOUND', error: 'That lead does not exist or is not yours to work.' };
  }

  const label = `${lead.lvLeadId ?? ''} ${lead.name ?? ''}`.trim() || lead.id;
  let noteId: string | null = null;

  try {
    const created = await delegated.mutation({
      createNote: { __args: { data: { title, bodyV2: { markdown: body } } }, id: true },
    });

    noteId = (created as { createNote?: { id?: string } }).createNote?.id ?? null;

    if (noteId) {
      await delegated.mutation({ createNoteTarget: { __args: { data: { noteId, targetLvLeadId: lead.id } }, id: true } });
    }
  } catch (error) {
    await writeAuditEvent(application, {
      action: 'NOTE_CREATED',
      outcome: 'REFUSED',
      targetObject: 'lvLead',
      targetRecordId: lead.id,
      targetLabel: label,
      actorWorkspaceMemberId,
      at: now,
      reason: null,
      metadata: { error: 'permission', noteId },
    });

    return { ok: false, refusal: 'NOT_PERMITTED', error: 'Your role cannot add notes on this lead.', detail: error instanceof Error ? error.message.slice(0, 160) : undefined };
  }

  if (noteId === null) {
    return { ok: false, error: 'The note was not created.' };
  }

  const auditId = await writeAuditEvent(application, {
    action: 'NOTE_CREATED',
    outcome: 'APPLIED',
    targetObject: 'lvLead',
    targetRecordId: lead.id,
    targetLabel: label,
    actorWorkspaceMemberId,
    at: now,
    reason: null,
    metadata: { noteId, title },
  });

  return { ok: true, noteId, title, auditId };
};

export default defineLogicFunction({
  universalIdentifier: FN_NOTE_CREATE_ID,
  name: 'lv-note-create',
  description: 'Adds an internal note to a lead from Lead 360 (Twenty note + noteTarget), as the caller, with an audit row',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: { path: '/notes/create', httpMethod: 'POST', isAuthRequired: true },
});
