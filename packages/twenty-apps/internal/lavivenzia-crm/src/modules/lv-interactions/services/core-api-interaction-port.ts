import { type CoreApiClient } from 'twenty-client-sdk/core';

import { type FollowUpDraft } from 'src/modules/lv-followups/utils/derive-follow-up';
import { type InteractionPort } from 'src/modules/lv-interactions/services/interaction-orchestrator';

// CoreApiClient implementation of the interaction port. All workspace I/O for
// the interaction/follow-up path lives here so the orchestrator stays pure.
//
// A follow-up is created as a Twenty `task` plus a `taskTarget` row pointing at
// the lead. Twenty exposes the custom object on taskTarget as `targetLvLeadId`,
// is why no bespoke join table exists in this application.

export const createCoreApiInteractionPort = (
  client: CoreApiClient,
): InteractionPort => ({
  getLead: async (leadId: string) => {
    const result = await client.query({
      lvLead: {
        __args: { filter: { id: { eq: leadId } } },
        id: true,
        ownerId: true,
        lastInteractionAt: true,
      },
    });

    const lead = (
      result as {
        lvLead?: {
          id?: string;
          ownerId?: string | null;
          lastInteractionAt?: string | null;
        };
      }
    ).lvLead;

    if (!lead?.id) {
      return null;
    }

    return {
      id: lead.id,
      ownerWorkspaceMemberId: lead.ownerId ?? null,
      lastInteractionAt: lead.lastInteractionAt ?? null,
    };
  },

  updateLeadSummary: async ({ leadId, patch }) => {
    // An empty patch would still issue a pointless write and a spurious
    // timelineActivity row.
    if (Object.keys(patch).length === 0) {
      return;
    }

    await client.mutation({
      updateLvLead: {
        __args: { id: leadId, data: patch },
        id: true,
      },
    });
  },

  createFollowUpTask: async (draft: FollowUpDraft) => {
    const created = await client.mutation({
      createTask: {
        __args: {
          data: {
            title: draft.title,
            bodyV2: { markdown: draft.body },
            dueAt: draft.dueAt,
            status: 'TODO',
            assigneeId: draft.assigneeWorkspaceMemberId,
            lvPriority: draft.priority,
            lvSourceInteractionId: draft.sourceInteractionId,
          },
        },
        id: true,
      },
    });

    const taskId = (created as { createTask?: { id?: string } }).createTask?.id;

    if (!taskId) {
      return null;
    }

    // taskTarget is what puts the follow-up on the lead's Tasks tab.
    await client.mutation({
      createTaskTarget: {
        __args: { data: { taskId, targetLvLeadId: draft.leadId } },
        id: true,
      },
    });

    return { id: taskId };
  },
});
