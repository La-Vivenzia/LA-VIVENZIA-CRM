import { type CoreApiClient } from 'twenty-client-sdk/core';

import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';

// Creates a Twenty task attached to a lead (task + taskTarget) as the caller
// and writes the TASK_CREATED audit row. Shared by the Lead 360 route
// (/tasks/create) and by capture, which creates the first next action for a
// lead it has just made. The assignee is whoever the caller named — that is
// delegation, not identity; the audit actor is always the session member.

export type LeadTaskInput = {
  leadId: string;
  leadLabel: string;
  title: string;
  description?: string;
  dueAt: string | null;
  priority: LeadPriority;
  assigneeId: string;
  sourceInteractionId?: string | null;
  quickActionKey?: string | null;
  origin?: 'LEAD_360' | 'CAPTURE';
};

export type LeadTaskOutcome = { ok: true; taskId: string; auditId: string | null } | { ok: false; refusal: 'NOT_PERMITTED' | 'FAILED'; error: string; detail?: string };

export const createLeadTask = async (delegated: CoreApiClient, application: CoreApiClient, actorWorkspaceMemberId: string, input: LeadTaskInput, now = new Date().toISOString()): Promise<LeadTaskOutcome> => {
  let taskId: string | null = null;

  try {
    const created = await delegated.mutation({
      createTask: {
        __args: {
          data: {
            title: input.title,
            bodyV2: { markdown: input.description ?? '' },
            dueAt: input.dueAt,
            status: 'TODO',
            assigneeId: input.assigneeId,
            lvPriority: input.priority,
            lvSourceInteractionId: input.sourceInteractionId ?? null,
          },
        },
        id: true,
      },
    });

    taskId = (created as { createTask?: { id?: string } }).createTask?.id ?? null;

    if (taskId) {
      await delegated.mutation({ createTaskTarget: { __args: { data: { taskId, targetLvLeadId: input.leadId } }, id: true } });
    }
  } catch (error) {
    await writeAuditEvent(application, {
      action: 'TASK_CREATED',
      outcome: 'REFUSED',
      targetObject: 'lvLead',
      targetRecordId: input.leadId,
      targetLabel: input.leadLabel,
      actorWorkspaceMemberId,
      at: now,
      reason: null,
      metadata: { title: input.title, error: 'permission', taskId, origin: input.origin ?? 'LEAD_360' },
    });

    return { ok: false, refusal: 'NOT_PERMITTED', error: 'Your role cannot create tasks on this lead.', detail: error instanceof Error ? error.message.slice(0, 160) : undefined };
  }

  if (taskId === null) {
    return { ok: false, refusal: 'FAILED', error: 'The task was not created.' };
  }

  const auditId = await writeAuditEvent(application, {
    action: 'TASK_CREATED',
    outcome: 'APPLIED',
    targetObject: 'lvLead',
    targetRecordId: input.leadId,
    targetLabel: input.leadLabel,
    actorWorkspaceMemberId,
    at: now,
    reason: null,
    metadata: { taskId, title: input.title, dueAt: input.dueAt, priority: input.priority, assigneeId: input.assigneeId, quickAction: input.quickActionKey ?? null, origin: input.origin ?? 'LEAD_360' },
  });

  return { ok: true, taskId, auditId };
};
