// Interaction vocabulary from PRODUCT-REQUIREMENTS.md "Interactions" and
// COMMUNICATIONS.md "Communication record".
//
// Why lvInteraction exists at all: Twenty's `note` is free-form text and its
// `timelineActivity` is an automatic diff. Neither carries channel, duration,
// sentiment, outcome, objections or commitments, which are the fields the
// founder's interaction log is actually made of. Follow-ups, by contrast, are
// NOT a new object — they reuse Twenty's `task`.

export const INTERACTION_CHANNELS = [
  'PHONE',
  'EMAIL',
  'WHATSAPP',
  'INSTAGRAM',
  'LINKEDIN',
  'VIDEO_CALL',
  'MEETING',
  'EVENT',
  'WEBSITE',
  'INTERNAL_NOTE',
  'DOCUMENT',
  'FORM',
] as const;

export type InteractionChannel = (typeof INTERACTION_CHANNELS)[number];

export const INTERACTION_CHANNEL_LABELS: Record<InteractionChannel, string> = {
  PHONE: 'Phone',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn',
  VIDEO_CALL: 'Video call',
  MEETING: 'Meeting',
  EVENT: 'Event',
  WEBSITE: 'Website',
  INTERNAL_NOTE: 'Internal note',
  DOCUMENT: 'Document exchange',
  FORM: 'Form submission',
};

// Channels where a duration is meaningful. A WhatsApp message or a form
// submission has no length, and asking for one produces noise.
const TIMED_CHANNELS = new Set<InteractionChannel>([
  'PHONE',
  'VIDEO_CALL',
  'MEETING',
  'EVENT',
]);

export const channelSupportsDuration = (channel: InteractionChannel): boolean =>
  TIMED_CHANNELS.has(channel);

// Channels that represent contact with the lead. An internal note is a record
// for the team, not an interaction with the partner, so it must not advance
// "last interaction" or reset an SLA contact clock.
const OUTWARD_CHANNELS = new Set<InteractionChannel>([
  'PHONE',
  'EMAIL',
  'WHATSAPP',
  'INSTAGRAM',
  'LINKEDIN',
  'VIDEO_CALL',
  'MEETING',
  'EVENT',
  'DOCUMENT',
]);

export const isOutwardContact = (channel: InteractionChannel): boolean =>
  OUTWARD_CHANNELS.has(channel);

export const INTERACTION_SENTIMENTS = [
  'POSITIVE',
  'NEUTRAL',
  'NEGATIVE',
  'MIXED',
] as const;

export type InteractionSentiment = (typeof INTERACTION_SENTIMENTS)[number];

export const INTERACTION_SENTIMENT_LABELS: Record<InteractionSentiment, string> = {
  POSITIVE: 'Positive',
  NEUTRAL: 'Neutral',
  NEGATIVE: 'Negative',
  MIXED: 'Mixed',
};

export const INTERACTION_PURPOSES = [
  'INTRODUCTION',
  'QUALIFICATION',
  'FOLLOW_UP',
  'INFORMATION_SHARING',
  'NEGOTIATION',
  'ONBOARDING_SUPPORT',
  'DOCUMENT_REQUEST',
  'RELATIONSHIP',
  'ESCALATION',
  'OTHER',
] as const;

export type InteractionPurpose = (typeof INTERACTION_PURPOSES)[number];

export const INTERACTION_PURPOSE_LABELS: Record<InteractionPurpose, string> = {
  INTRODUCTION: 'Introduction',
  QUALIFICATION: 'Qualification',
  FOLLOW_UP: 'Follow-up',
  INFORMATION_SHARING: 'Information sharing',
  NEGOTIATION: 'Negotiation',
  ONBOARDING_SUPPORT: 'Onboarding support',
  DOCUMENT_REQUEST: 'Document request',
  RELATIONSHIP: 'Relationship building',
  ESCALATION: 'Escalation',
  OTHER: 'Other',
};

export const INTERACTION_OUTCOMES = [
  'CONNECTED',
  'NO_ANSWER',
  'RESCHEDULED',
  'INFORMATION_SHARED',
  'INTERESTED',
  'NOT_INTERESTED',
  'OBJECTION_RAISED',
  'COMMITMENT_MADE',
  'DOCUMENT_RECEIVED',
  'AWAITING_RESPONSE',
  'NO_OUTCOME',
] as const;

export type InteractionOutcome = (typeof INTERACTION_OUTCOMES)[number];

export const INTERACTION_OUTCOME_LABELS: Record<InteractionOutcome, string> = {
  CONNECTED: 'Connected',
  NO_ANSWER: 'No answer',
  RESCHEDULED: 'Rescheduled',
  INFORMATION_SHARED: 'Information shared',
  INTERESTED: 'Interested',
  NOT_INTERESTED: 'Not interested',
  OBJECTION_RAISED: 'Objection raised',
  COMMITMENT_MADE: 'Commitment made',
  DOCUMENT_RECEIVED: 'Document received',
  AWAITING_RESPONSE: 'Awaiting response',
  NO_OUTCOME: 'No outcome',
};

export const isInteractionChannel = (value: string): value is InteractionChannel =>
  (INTERACTION_CHANNELS as readonly string[]).includes(value);

export const isInteractionOutcome = (value: string): value is InteractionOutcome =>
  (INTERACTION_OUTCOMES as readonly string[]).includes(value);
