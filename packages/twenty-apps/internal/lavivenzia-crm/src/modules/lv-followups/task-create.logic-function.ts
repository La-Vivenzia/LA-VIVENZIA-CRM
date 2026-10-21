import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_TASK_CREATE_ID } from 'src/constants/universal-identifiers';
import { isLeadPriority, LEAD_PRIORITIES, type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';
import { hasUnstorableCharacters, priorityWasAsked } from 'src/modules/lv-followups/utils/task-input';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { dueAtFor, quickAction } from 'src/modules/lv-followups/utils/quick-actions';
import { createLeadTask } from 'src/modules/lv-followups/services/create-lead-task';

// POST /tasks/create { leadId, title?, description?, dueAt?, priority?, assigneeId?, quickAction?, timezoneOffsetMinutes?, sourceInteractionId? }
//
// Creates a Twenty task attached to the lead (task + taskTarget), as the
// caller: the platform's task permission and CM-004's view of the lead are
// what authorise it. The assignee defaults to the caller; a body may name a
// colleague — that is delegation, not identity — but the actor recorded in
// the audit row is always the session member. A `quickAction` fills title,
// due date and priority from one shared table (quick-actions.ts) so the
// one-tap buttons and the full form are the same thing.

type Input = {
  leadId?: unknown;
  title?: unknown;
  description?: unknown;
  dueAt?: unknown;
  priority?: unknown;
  assigneeId?: unknown;
  quickAction?: unknown;
  timezoneOffsetMinutes?: unknown;
  sourceInteractionId?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can create a task.' };
  }

  if (typeof input.leadId !== 'string' || !UUID.test(input.leadId)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'leadId is required.' };
  }

  const now = new Date().toISOString();
  const preset = quickAction(input.quickAction);
  const offset = typeof input.timezoneOffsetMinutes === 'number' && Number.isFinite(input.timezoneOffsetMinutes) ? Math.max(-840, Math.min(840, input.timezoneOffsetMinutes)) : 0;
  const title = (typeof input.title === 'string' && input.title.trim().length > 0 ? input.title.trim() : preset?.title ?? '').slice(0, 200);

  if (title.length === 0) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'A task needs a title.' };
  }

  if (hasUnstorableCharacters(title)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'That title contains characters that cannot be stored. Remove them and try again.' };
  }

  let dueAt: string | null = null;

  if (typeof input.dueAt === 'string' && input.dueAt.length > 0) {
    if (Number.isNaN(Date.parse(input.dueAt))) {
      return { ok: false, refusal: 'INVALID_INPUT', error: 'Due date is not valid.' };
    }

    dueAt = new Date(input.dueAt).toISOString();
  } else if (preset) {
    dueAt = dueAtFor(preset, now, offset);
  }

  // A priority that was *asked for* and is not one of ours is a mistake worth
  // reporting. It used to fall through to MEDIUM, so `priority: 'SUPER'` was
  // accepted, answered with ok: true, and quietly stored as something the
  // caller never asked for — the worst of the three possible behaviours. The
  // fallback stays for the case it was written for: no priority supplied at
  // all, where the quick action's own default is the right answer.
  if (priorityWasAsked(input.priority) && !isLeadPriority(input.priority)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: `That is not a priority. Use one of ${LEAD_PRIORITIES.join(', ')}.` };
  }

  const priority: LeadPriority = isLeadPriority(input.priority) ? input.priority : (preset?.priority ?? 'MEDIUM');
  const assigneeId = typeof input.assigneeId === 'string' && UUID.test(input.assigneeId) ? input.assigneeId : actorWorkspaceMemberId;
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 4000) : '';
  const sourceInteractionId = typeof input.sourceInteractionId === 'string' && UUID.test(input.sourceInteractionId) ? input.sourceInteractionId : null;
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
  const outcome = await createLeadTask(delegated, application, actorWorkspaceMemberId, { leadId: lead.id, leadLabel: label, title, description, dueAt, priority, assigneeId, sourceInteractionId, quickActionKey: preset?.key ?? null, origin: 'LEAD_360' }, now);

  if (!outcome.ok) {
    // The reason travels as the service classified it, rather than only
    // NOT_PERMITTED being allowed through and everything else losing its code.
    return { ok: false, refusal: outcome.refusal, error: outcome.error, detail: outcome.detail };
  }

  return { ok: true, taskId: outcome.taskId, title, dueAt, priority, assigneeId, auditId: outcome.auditId };
};

export default defineLogicFunction({
  universalIdentifier: FN_TASK_CREATE_ID,
  name: 'lv-task-create',
  description: 'Creates a follow-up task on a lead from Lead 360 (full form or quick action), as the caller, with an audit row',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: { path: '/tasks/create', httpMethod: 'POST', isAuthRequired: true },
});
