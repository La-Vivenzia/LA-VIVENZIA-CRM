import {
  INTERACTION_CHANNEL_LABELS,
  type InteractionChannel,
  type InteractionOutcome,
} from 'src/modules/lv-interactions/constants/interaction-vocabulary';
import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';

// The smart follow-up engine from PRODUCT-REQUIREMENTS.md: "Every interaction
// can produce a next action, due date, priority and reminder."
//
// A follow-up is a Twenty `task`, not a new object — task already has title,
// body, dueAt, status and assignee, and taskTarget attaches it to any record.
// This module only decides WHAT task to create; the port writes it.

export type FollowUpDraft = {
  title: string;
  body: string;
  dueAt: string;
  priority: LeadPriority;
  assigneeWorkspaceMemberId: string | null;
  leadId: string;
  sourceInteractionId: string | null;
};

// Hours until a follow-up is due, by priority. Anchored on
// ASSIGNMENT-SLA-NOTIFICATIONS.md's initial SLAs: an interested lead is chased
// within 48h, urgent work the same day.
export const FOLLOW_UP_HOURS_BY_PRIORITY: Record<LeadPriority, number> = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 120,
};

// Outcome -> suggested priority, used only when the user did not choose one.
// Deterministic mapping, not a prediction.
const PRIORITY_BY_OUTCOME: Partial<Record<InteractionOutcome, LeadPriority>> = {
  COMMITMENT_MADE: 'HIGH',
  INTERESTED: 'HIGH',
  OBJECTION_RAISED: 'HIGH',
  DOCUMENT_RECEIVED: 'MEDIUM',
  AWAITING_RESPONSE: 'MEDIUM',
  NO_ANSWER: 'MEDIUM',
  RESCHEDULED: 'MEDIUM',
  CONNECTED: 'MEDIUM',
  INFORMATION_SHARED: 'MEDIUM',
  NO_OUTCOME: 'LOW',
};

// Outcomes that end the conversation. Creating a chase task after "not
// interested" is exactly the noise that makes a task list get ignored, so the
// engine stays silent unless a human explicitly asks for a follow-up.
const OUTCOMES_WITHOUT_AUTOMATIC_FOLLOW_UP = new Set<InteractionOutcome>([
  'NOT_INTERESTED',
]);

export const suggestedPriority = (
  outcome: InteractionOutcome | null | undefined,
): LeadPriority =>
  (outcome ? PRIORITY_BY_OUTCOME[outcome] : undefined) ?? 'MEDIUM';

export const addHours = (isoTimestamp: string, hours: number): string => {
  const base = Date.parse(isoTimestamp);

  if (Number.isNaN(base)) {
    throw new Error(`Invalid timestamp: ${isoTimestamp}`);
  }

  return new Date(base + hours * 60 * 60 * 1000).toISOString();
};

export type InteractionForFollowUp = {
  id: string | null;
  leadId: string;
  leadName: string;
  channel: InteractionChannel;
  occurredAt: string;
  outcome?: InteractionOutcome | null;
  nextAction?: string | null;
  nextFollowUpAt?: string | null;
  priority?: LeadPriority | null;
  actorWorkspaceMemberId?: string | null;
  leadOwnerWorkspaceMemberId?: string | null;
};

// Whether this interaction should produce a follow-up at all.
export const shouldCreateFollowUp = (
  interaction: InteractionForFollowUp,
): boolean => {
  // An explicit next action or date is a human instruction and always wins,
  // even after a closing outcome.
  const hasExplicitRequest =
    (interaction.nextAction !== null &&
      interaction.nextAction !== undefined &&
      interaction.nextAction.trim().length > 0) ||
    (interaction.nextFollowUpAt !== null && interaction.nextFollowUpAt !== undefined);

  if (hasExplicitRequest) {
    return true;
  }

  if (
    interaction.outcome &&
    OUTCOMES_WITHOUT_AUTOMATIC_FOLLOW_UP.has(interaction.outcome)
  ) {
    return false;
  }

  return true;
};

export const deriveFollowUp = (
  interaction: InteractionForFollowUp,
): FollowUpDraft | null => {
  if (!shouldCreateFollowUp(interaction)) {
    return null;
  }

  const priority = interaction.priority ?? suggestedPriority(interaction.outcome);

  const dueAt =
    interaction.nextFollowUpAt ??
    addHours(interaction.occurredAt, FOLLOW_UP_HOURS_BY_PRIORITY[priority]);

  const action =
    interaction.nextAction && interaction.nextAction.trim().length > 0
      ? interaction.nextAction.trim()
      : `Follow up with ${interaction.leadName}`;

  const channelLabel = INTERACTION_CHANNEL_LABELS[interaction.channel];

  return {
    title: action,
    body: `Follow-up from a ${channelLabel.toLowerCase()} interaction on ${interaction.occurredAt.slice(0, 10)}.`,
    dueAt,
    priority,
    // Follow-ups belong to whoever owns the relationship; the person who logged
    // the interaction may have been standing in.
    assigneeWorkspaceMemberId:
      interaction.leadOwnerWorkspaceMemberId ??
      interaction.actorWorkspaceMemberId ??
      null,
    leadId: interaction.leadId,
    sourceInteractionId: interaction.id,
  };
};
