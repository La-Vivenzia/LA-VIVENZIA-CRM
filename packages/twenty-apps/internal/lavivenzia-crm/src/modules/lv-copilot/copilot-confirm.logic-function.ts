import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_COPILOT_CONFIRM_ID } from 'src/constants/universal-identifiers';
import { isRecord } from 'src/modules/lv-ai/provider/structured-output';
import { applicationClient, delegatedClient } from 'src/modules/lv-ai/runtime/clients';
import { type ProposedAction } from 'src/modules/lv-copilot/query/intent-rules';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { isUuid } from 'src/modules/lv-intelligence/services/route-support';
import { loadLeadContext } from 'src/modules/lv-intelligence/services/lead-context';

// POST /copilot/confirm { proposalId, edits? }
//
// Executes ONE proposal the Copilot showed the same person, within 15
// minutes, exactly once — with that person's own token, so the platform's
// permission check is the one that counts. Anything not in the proposal
// (a different lead, a different action) cannot be smuggled in through edits.

type Input = { proposalId?: unknown; edits?: unknown; cancel?: unknown };

const DAY = 86_400_000;

const dueFrom = (dueIn: string): string => {
  const at = new Date();
  const days = dueIn === 'today' ? 0 : dueIn === 'tomorrow' ? 1 : dueIn === '3d' ? 3 : 7;

  at.setTime(at.getTime() + days * DAY);
  at.setUTCHours(12, 30, 0, 0);

  return at.toISOString();
};

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Confirmation requires a signed-in team member.' };
  }

  if (!isUuid(input.proposalId)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'proposalId must be a UUID.' };
  }

  try {
    const application = applicationClient();
    const delegated = delegatedClient();
    const { data } = await application.query<{ lvAiRuns?: { edges: { node: { id: string; status: string; actorId: string | null; targetRecordId: string | null; metadata: unknown } }[] } }>(
      `query($filter: LvAiRunFilterInput) { lvAiRuns(first: 1, filter: $filter) { edges { node { id status actorId targetRecordId metadata } } } }`,
      { filter: { id: { eq: input.proposalId }, operation: { eq: 'COPILOT_PROPOSAL' } } },
    );
    const proposal = data.lvAiRuns?.edges?.[0]?.node ?? null;

    if (!proposal || proposal.actorId !== actorWorkspaceMemberId) {
      // Someone else's proposal is indistinguishable from a missing one.
      return { ok: false, refusal: 'NOT_FOUND', error: 'Proposal not found.' };
    }

    const setStatus = (status: 'CONFIRMED' | 'EXPIRED' | 'REFUSED', extra: Record<string, unknown> = {}) =>
      application.query(`mutation($id: UUID!, $data: LvAiRunUpdateInput!) { updateLvAiRun(id: $id, data: $data) { id } }`, { id: proposal.id, data: { status, metadata: { ...(isRecord(proposal.metadata) ? proposal.metadata : {}), ...extra, decidedAt: new Date().toISOString() } } });

    if (proposal.status !== 'PROPOSED') {
      return { ok: false, refusal: 'ALREADY_DECIDED', error: `This proposal is already ${proposal.status.toLowerCase()}.` };
    }

    const metadata = isRecord(proposal.metadata) ? proposal.metadata : {};
    const expiresAt = typeof metadata.expiresAt === 'string' ? Date.parse(metadata.expiresAt) : 0;

    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      await setStatus('EXPIRED');

      return { ok: false, refusal: 'EXPIRED', error: 'This proposal has expired. Ask again.' };
    }

    if (input.cancel === true) {
      await setStatus('REFUSED', { cancelledByUser: true });

      return { ok: true, status: 'CANCELLED' };
    }

    const action = isRecord(metadata.action) ? (metadata.action as unknown as ProposedAction) : null;
    const leadId = proposal.targetRecordId;

    if (!action || !leadId || action.kind === 'UNSUPPORTED_ACTION') {
      await setStatus('REFUSED', { reason: 'unsupported' });

      return { ok: false, refusal: 'NOT_SUPPORTED', error: 'This proposal cannot be executed.' };
    }

    const context = await loadLeadContext(delegated, application, leadId);

    if (!context) {
      await setStatus('REFUSED', { reason: 'lead not accessible' });

      return { ok: false, refusal: 'NOT_FOUND', error: 'The lead is no longer accessible.' };
    }

    const edits = isRecord(input.edits) ? input.edits : {};
    const label = `${context.lead.lvLeadId ?? ''} ${context.lead.name ?? ''}`.trim();

    if (action.kind === 'CREATE_TASK') {
      const title = (typeof edits.title === 'string' && edits.title.trim() ? edits.title.trim() : action.title ?? `Follow up with ${label}`).slice(0, 200);
      const dueAt = typeof edits.dueAt === 'string' && Number.isFinite(Date.parse(edits.dueAt)) ? new Date(edits.dueAt).toISOString() : dueFrom(action.dueIn);
      const { data: created, errors } = await delegated.query<{ createTask?: { id: string } }>(`mutation($data: TaskCreateInput!) { createTask(data: $data) { id } }`, {
        data: { title, status: 'TODO', dueAt, assigneeId: actorWorkspaceMemberId, lvPriority: 'MEDIUM', bodyV2: { markdown: 'Created from the CRM Copilot after confirmation.' } },
      });

      if (!created.createTask) {
        await setStatus('REFUSED', { reason: errors[0]?.message ?? 'permission' });

        return { ok: false, refusal: 'NOT_PERMITTED', error: 'Your role cannot create tasks.' };
      }

      await delegated.query(`mutation($data: TaskTargetCreateInput!) { createTaskTarget(data: $data) { id } }`, { data: { taskId: created.createTask.id, targetLvLeadId: context.lead.id } });
      await setStatus('CONFIRMED', { taskId: created.createTask.id, title, dueAt });

      return { ok: true, status: 'CONFIRMED', created: { object: 'task', recordId: created.createTask.id, title, dueAt }, target: { object: 'task', recordId: created.createTask.id } };
    }

    if (action.kind === 'ADD_NOTE') {
      const title = (typeof edits.title === 'string' && edits.title.trim() ? edits.title.trim() : action.title ?? `Note on ${label}`).slice(0, 200);
      const body = typeof edits.body === 'string' ? edits.body.slice(0, 4_000) : '';
      const { data: created, errors } = await delegated.query<{ createNote?: { id: string } }>(`mutation($data: NoteCreateInput!) { createNote(data: $data) { id } }`, {
        data: { title, bodyV2: { markdown: body } },
      });

      if (!created.createNote) {
        await setStatus('REFUSED', { reason: errors[0]?.message ?? 'permission' });

        return { ok: false, refusal: 'NOT_PERMITTED', error: 'Your role cannot create notes.' };
      }

      await delegated.query(`mutation($data: NoteTargetCreateInput!) { createNoteTarget(data: $data) { id } }`, { data: { noteId: created.createNote.id, targetLvLeadId: context.lead.id } });
      await setStatus('CONFIRMED', { noteId: created.createNote.id, title });

      return { ok: true, status: 'CONFIRMED', created: { object: 'note', recordId: created.createNote.id, title }, target: { object: 'note', recordId: created.createNote.id } };
    }

    await setStatus('REFUSED', { reason: 'unknown action' });

    return { ok: false, refusal: 'NOT_SUPPORTED', error: 'Unknown proposal kind.' };
  } catch (error) {
    console.error('[lv-copilot-confirm]', error instanceof Error ? error.message : String(error));

    return { ok: false, error: 'The action could not be completed. Please try again.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_COPILOT_CONFIRM_ID,
  name: 'lv-copilot-confirm',
  description: 'Executes a Copilot proposal (task / note) after the same person confirms it, with that person’s own permissions',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: { path: '/copilot/confirm', httpMethod: 'POST', isAuthRequired: true },
});
