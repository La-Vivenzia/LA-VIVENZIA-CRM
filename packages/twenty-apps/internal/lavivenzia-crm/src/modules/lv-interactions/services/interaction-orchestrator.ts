import {
  deriveFollowUp,
  type FollowUpDraft,
  type InteractionForFollowUp,
} from 'src/modules/lv-followups/utils/derive-follow-up';
import {
  isOutwardContact,
  type InteractionChannel,
  type InteractionOutcome,
} from 'src/modules/lv-interactions/constants/interaction-vocabulary';
import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';

// What logging an interaction does to the rest of the record: refresh the
// lead's relationship summary fields, then create the follow-up task.
//
// The follow-up is a Twenty `task` linked through `taskTarget`, and the visible
// history is Twenty's own `timelineActivity` — neither is reimplemented here.

export type InteractionRecord = {
  id: string;
  leadId: string;
  leadName: string;
  channel: InteractionChannel;
  occurredAt: string;
  outcome?: InteractionOutcome | null;
  summary?: string | null;
  nextAction?: string | null;
  nextFollowUpAt?: string | null;
  priority?: LeadPriority | null;
  actorWorkspaceMemberId?: string | null;
};

export type LeadSummaryPatch = {
  lastInteractionAt?: string;
  nextAction?: string | null;
  nextFollowUpAt?: string | null;
};

export type InteractionPort = {
  getLead(leadId: string): Promise<{
    id: string;
    ownerWorkspaceMemberId: string | null;
    lastInteractionAt: string | null;
  } | null>;
  updateLeadSummary(input: { leadId: string; patch: LeadSummaryPatch }): Promise<void>;
  // Creates a Twenty task and attaches it to the lead via taskTarget.
  createFollowUpTask(draft: FollowUpDraft): Promise<{ id: string } | null>;
};

export type ApplyInteractionOutcome = {
  leadPatch: LeadSummaryPatch;
  followUp: FollowUpDraft | null;
  followUpTaskId: string | null;
  skippedReason: string | null;
};

// Only contact with the lead advances "last interaction". An internal note is
// the team talking to itself; letting it reset the clock would make a silent
// relationship look active and hide it from every stale-lead view.
export const computeLeadPatch = ({
  interaction,
  currentLastInteractionAt,
  followUp,
}: {
  interaction: InteractionRecord;
  currentLastInteractionAt: string | null;
  followUp: FollowUpDraft | null;
}): LeadSummaryPatch => {
  const patch: LeadSummaryPatch = {};

  if (isOutwardContact(interaction.channel)) {
    const current =
      currentLastInteractionAt === null ? 0 : Date.parse(currentLastInteractionAt);
    const incoming = Date.parse(interaction.occurredAt);

    // Back-dated entries must not rewind the field.
    if (!Number.isNaN(incoming) && incoming > current) {
      patch.lastInteractionAt = interaction.occurredAt;
    }
  }

  if (followUp !== null) {
    patch.nextAction = followUp.title;
    patch.nextFollowUpAt = followUp.dueAt;
  } else {
    // The conversation closed without a next step. Clearing both is what makes
    // "leads without a next action" a truthful view rather than a stale one.
    patch.nextAction = null;
    patch.nextFollowUpAt = null;
  }

  return patch;
};

export const applyInteraction = async ({
  interaction,
  port,
}: {
  interaction: InteractionRecord;
  port: InteractionPort;
}): Promise<ApplyInteractionOutcome> => {
  const lead = await port.getLead(interaction.leadId);

  if (lead === null) {
    return {
      leadPatch: {},
      followUp: null,
      followUpTaskId: null,
      skippedReason: `Lead ${interaction.leadId} no longer exists.`,
    };
  }

  const forFollowUp: InteractionForFollowUp = {
    id: interaction.id,
    leadId: interaction.leadId,
    leadName: interaction.leadName,
    channel: interaction.channel,
    occurredAt: interaction.occurredAt,
    outcome: interaction.outcome,
    nextAction: interaction.nextAction,
    nextFollowUpAt: interaction.nextFollowUpAt,
    priority: interaction.priority,
    actorWorkspaceMemberId: interaction.actorWorkspaceMemberId,
    leadOwnerWorkspaceMemberId: lead.ownerWorkspaceMemberId,
  };

  const followUp = deriveFollowUp(forFollowUp);

  const leadPatch = computeLeadPatch({
    interaction,
    currentLastInteractionAt: lead.lastInteractionAt,
    followUp,
  });

  await port.updateLeadSummary({ leadId: interaction.leadId, patch: leadPatch });

  const created = followUp === null ? null : await port.createFollowUpTask(followUp);

  return {
    leadPatch,
    followUp,
    followUpTaskId: created?.id ?? null,
    skippedReason: null,
  };
};
