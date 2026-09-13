import { INTERACTION_DIRECTIONS, type InteractionDirection } from 'src/modules/lv-interactions/constants/interaction-direction';
import {
  channelSupportsDuration,
  INTERACTION_CHANNEL_LABELS,
  INTERACTION_OUTCOME_LABELS,
  INTERACTION_PURPOSE_LABELS,
  INTERACTION_PURPOSES,
  INTERACTION_SENTIMENTS,
  type InteractionChannel,
  type InteractionOutcome,
  type InteractionPurpose,
  type InteractionSentiment,
  isInteractionChannel,
  isInteractionOutcome,
} from 'src/modules/lv-interactions/constants/interaction-vocabulary';

// The accept/reject decision for one "Add interaction" submission. Pure, so
// the same rule runs in the browser for fast feedback and again on the server
// as the decision that counts. Identity is deliberately absent: the actor is
// never part of the input — the route takes it from the session.

export type InteractionInput = {
  leadId: string;
  channel: InteractionChannel;
  direction: InteractionDirection;
  occurredAt: string;
  durationMinutes: number | null;
  purpose: InteractionPurpose | null;
  summary: string | null;
  sentiment: InteractionSentiment | null;
  outcome: InteractionOutcome | null;
  objections: string | null;
  commitments: string | null;
  nextAction: string | null;
  nextFollowUpAt: string | null;
  // The one-line label shown in lists and the timeline.
  name: string;
};

export type InteractionValidation =
  | { ok: true; input: InteractionInput }
  | { ok: false; errors: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT = 2000;
const MAX_SHORT_TEXT = 500;
// A logged call may be back-dated freely, but not dated in the future beyond
// clock skew — a future contact is a follow-up, not an interaction.
const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed.slice(0, max) : null;
};

const isoOrNull = (value: unknown): string | null | 'INVALID' => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return 'INVALID';
  }

  return new Date(value).toISOString();
};

export const validateInteractionInput = (raw: Record<string, unknown>, now: string): InteractionValidation => {
  const errors: string[] = [];

  if (typeof raw.leadId !== 'string' || !UUID.test(raw.leadId)) {
    errors.push('leadId is required.');
  }

  const channel = typeof raw.channel === 'string' && isInteractionChannel(raw.channel) ? raw.channel : null;

  if (channel === null) {
    errors.push('Choose a channel.');
  }

  const direction =
    typeof raw.direction === 'string' && (INTERACTION_DIRECTIONS as readonly string[]).includes(raw.direction)
      ? (raw.direction as InteractionDirection)
      : null;

  if (direction === null) {
    errors.push('Choose a direction (inbound or outbound).');
  }

  const occurredAtParsed = isoOrNull(raw.occurredAt);
  const occurredAt = occurredAtParsed === null ? now : occurredAtParsed;

  if (occurredAt === 'INVALID') {
    errors.push('Date and time is not valid.');
  } else if (Date.parse(occurredAt) > Date.parse(now) + FUTURE_TOLERANCE_MS) {
    errors.push('An interaction cannot be dated in the future. Use a follow-up task for planned contact.');
  }

  let durationMinutes: number | null = null;

  if (raw.durationMinutes !== null && raw.durationMinutes !== undefined && raw.durationMinutes !== '') {
    const parsed = typeof raw.durationMinutes === 'number' ? raw.durationMinutes : Number.parseInt(String(raw.durationMinutes), 10);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1440) {
      errors.push('Duration must be a whole number of minutes between 0 and 1440.');
    } else if (channel !== null && !channelSupportsDuration(channel)) {
      // Silently dropped rather than refused: a coordinator who typed a
      // duration on an email has not made a mistake worth blocking on.
      durationMinutes = null;
    } else {
      durationMinutes = parsed;
    }
  }

  const purpose = typeof raw.purpose === 'string' && (INTERACTION_PURPOSES as readonly string[]).includes(raw.purpose) ? (raw.purpose as InteractionPurpose) : null;

  if (typeof raw.purpose === 'string' && raw.purpose.length > 0 && purpose === null) {
    errors.push('Purpose is not one of the known values.');
  }

  const sentiment = typeof raw.sentiment === 'string' && (INTERACTION_SENTIMENTS as readonly string[]).includes(raw.sentiment) ? (raw.sentiment as InteractionSentiment) : null;

  if (typeof raw.sentiment === 'string' && raw.sentiment.length > 0 && sentiment === null) {
    errors.push('Sentiment is not one of the known values.');
  }

  const outcome = typeof raw.outcome === 'string' && isInteractionOutcome(raw.outcome) ? raw.outcome : null;

  if (typeof raw.outcome === 'string' && raw.outcome.length > 0 && outcome === null) {
    errors.push('Outcome is not one of the known values.');
  }

  const nextFollowUpAt = isoOrNull(raw.nextFollowUpAt);

  if (nextFollowUpAt === 'INVALID') {
    errors.push('Next follow-up date is not valid.');
  }

  const summary = text(raw.summary, MAX_TEXT);
  const nextAction = text(raw.nextAction, MAX_SHORT_TEXT);

  if (summary === null && nextAction === null && outcome === null) {
    errors.push('Record at least a summary, an outcome or a next action — an empty interaction tells the next person nothing.');
  }

  if (errors.length > 0 || channel === null || direction === null || occurredAt === 'INVALID' || nextFollowUpAt === 'INVALID') {
    return { ok: false, errors };
  }

  const providedName = text(raw.name, 160);
  const name =
    providedName ??
    [INTERACTION_CHANNEL_LABELS[channel], purpose ? INTERACTION_PURPOSE_LABELS[purpose] : outcome ? INTERACTION_OUTCOME_LABELS[outcome] : null]
      .filter((part): part is string => Boolean(part))
      .join(' · ');

  return {
    ok: true,
    input: {
      leadId: raw.leadId as string,
      channel,
      direction,
      occurredAt,
      durationMinutes,
      purpose,
      summary,
      sentiment,
      outcome,
      objections: text(raw.objections, MAX_SHORT_TEXT),
      commitments: text(raw.commitments, MAX_SHORT_TEXT),
      nextAction,
      nextFollowUpAt,
      name,
    },
  };
};
