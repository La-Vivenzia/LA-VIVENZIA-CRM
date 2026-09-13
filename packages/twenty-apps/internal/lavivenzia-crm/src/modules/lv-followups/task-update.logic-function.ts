import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_TASK_UPDATE_ID } from 'src/constants/universal-identifiers';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';

// POST /tasks/update { taskId, leadId, action: COMPLETE | RESCHEDULE | REOPEN, dueAt?, title? }
//
// The next-action controls on Lead 360. Runs as the caller — Twenty's task
// permission decides — and the task must be attached to the lead the page is
// showing, so a task id guessed from elsewhere cannot be completed through a
// lead the caller happens to own. Audited as TASK_COMPLETED / TASK_RESCHEDULED
// with the session actor.

type Input = { taskId?: unknown; leadId?: unknown; action?: unknown; dueAt?: unknown; title?: unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = ['COMPLETE', 'RESCHEDULE', 'REOPEN'] as const;

type Action = (typeof ACTIONS)[number];

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can update a task.' };
  }

  if (typeof input.taskId !== 'string' || !UUID.test(input.taskId) || typeof input.leadId !== 'string' || !UUID.test(input.leadId)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'taskId and leadId are required.' };
  }

  if (typeof input.action !== 'string' || !(ACTIONS as readonly string[]).includes(input.action)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'action must be COMPLETE, RESCHEDULE or REOPEN.' };
  }

  const action = input.action as Action;
  let dueAt: string | null = null;

  if (action === 'RESCHEDULE') {
    if (typeof input.dueAt !== 'string' || Number.isNaN(Date.parse(input.dueAt))) {
      return { ok: false, refusal: 'INVALID_INPUT', error: 'A valid new due date is required to reschedule.' };
    }

    dueAt = new Date(input.dueAt).toISOString();
  }

  const title = typeof input.title === 'string' && input.title.trim().length > 0 ? input.title.trim().slice(0, 200) : null;
  const now = new Date().toISOString();
  const delegated = new CoreApiClient();
  const application = new CoreApiClient({ runAs: 'application' });

  type TargetRow = { id: string; task?: { id: string; title?: string | null; status?: string | null; dueAt?: string | null } | null };
  let target: TargetRow | null = null;

  try {
    const result = await delegated.query({
      taskTargets: {
        __args: { filter: { taskId: { eq: input.taskId }, targetLvLeadId: { eq: input.leadId } }, first: 1 },
        edges: { node: { id: true, task: { id: true, title: true, status: true, dueAt: true } } },
      },
    });

    target = (result as { taskTargets?: { edges?: { node: TargetRow }[] } }).taskTargets?.edges?.[0]?.node ?? null;
  } catch {
    target = null;
  }

  if (target?.task === null || target?.task === undefined) {
    return { ok: false, refusal: 'NOT_FOUND', error: 'That task is not attached to this lead, or is not visible to you.' };
  }

  const task = target.task;
  const auditAction = action === 'RESCHEDULE' ? 'TASK_RESCHEDULED' : 'TASK_COMPLETED';
  const data: Record<string, unknown> =
    action === 'COMPLETE' ? { status: 'DONE' } : action === 'REOPEN' ? { status: 'TODO' } : { dueAt, ...(title ? { title } : {}) };

  try {
    await delegated.mutation({ updateTask: { __args: { id: task.id, data }, id: true } });
  } catch (error) {
    await writeAuditEvent(application, {
      action: auditAction,
      outcome: 'REFUSED',
      targetObject: 'task',
      targetRecordId: task.id,
      targetLabel: task.title ?? task.id,
      actorWorkspaceMemberId,
      at: now,
      reason: null,
      metadata: { leadId: input.leadId, action, error: 'permission' },
    });

    return { ok: false, refusal: 'NOT_PERMITTED', error: 'Your role cannot change this task.', detail: error instanceof Error ? error.message.slice(0, 160) : undefined };
  }

  const auditId = await writeAuditEvent(application, {
    action: auditAction,
    outcome: 'APPLIED',
    targetObject: 'task',
    targetRecordId: task.id,
    targetLabel: task.title ?? task.id,
    actorWorkspaceMemberId,
    at: now,
    reason: null,
    metadata: { leadId: input.leadId, action, from: { status: task.status ?? null, dueAt: task.dueAt ?? null }, to: data },
  });

  return { ok: true, taskId: task.id, action, dueAt, auditId };
};

export default defineLogicFunction({
  universalIdentifier: FN_TASK_UPDATE_ID,
  name: 'lv-task-update',
  description: 'Completes, reopens or reschedules a task attached to a lead from Lead 360, as the caller, with an audit row',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: { path: '/tasks/update', httpMethod: 'POST', isAuthRequired: true },
});
