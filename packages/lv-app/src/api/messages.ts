import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { callRoute, graphql } from 'src/api/client';

// Messages.
//
// What a "message" is in this product needs saying plainly, because it is not
// what the word usually means. La Vivenzia does not send or receive anything:
// **no transport is integrated.** An `lvInteraction` is the *record* of a
// contact that already happened — a call, a WhatsApp exchange, a site visit —
// carrying its channel, its direction, what was said and what it means for
// the next step. There is no message body, no delivery state and no inbox
// that fills by itself.
//
// So a conversation here is the run of interactions with one lead, and the
// workflow the backend actually supports is:
//
//   INBOX ─▶ THREAD ─▶ DRAFT ─▶ (you send it yourself) ─▶ LOG
//
// The draft route says so itself: it returns `transport: 'MANUAL_EMAIL'` or
// `'NONE'`. Nothing in this file pretends otherwise, and nothing here will
// ever report a message as sent.

/** `INTERACTION_CHANNELS` in `constants/interaction-vocabulary.ts`. */
export const CHANNELS = [
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

export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<string, string> = {
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

/**
 * An internal note is a record for the team, not contact with the partner —
 * the backend excludes it from "last interaction" and from the SLA clock, so
 * the inbox must not count it as them having heard from us either.
 */
export const OUTWARD_CHANNELS: readonly string[] = ['PHONE', 'EMAIL', 'WHATSAPP', 'INSTAGRAM', 'LINKEDIN', 'VIDEO_CALL', 'MEETING', 'EVENT'];

export const isOutward = (channel: string | null): boolean => channel !== null && OUTWARD_CHANNELS.includes(channel);

/** `DRAFT_KINDS` in `prompts/prompt-registry.ts`. */
export const DRAFT_KINDS = [
  { key: 'FOLLOW_UP_EMAIL', label: 'Follow-up email', hint: 'Picks up where the last contact left off.' },
  { key: 'INTRODUCTION_EMAIL', label: 'Introduction', hint: 'A first approach to someone who has not heard from us.' },
  { key: 'REMINDER', label: 'Reminder', hint: 'A nudge about something already asked for.' },
  { key: 'DOCUMENT_REQUEST', label: 'Document request', hint: 'Asks for the paperwork onboarding still needs.' },
  { key: 'ONBOARDING_REMINDER', label: 'Onboarding reminder', hint: 'Chases a partner who has stalled part-way through.' },
  { key: 'MEETING_FOLLOW_UP', label: 'After a meeting', hint: 'Summarises what was agreed and what happens next.' },
  { key: 'WHATSAPP_FOLLOW_UP', label: 'WhatsApp follow-up', hint: 'Short, for a phone. Written to be pasted into a chat.' },
] as const;

export type DraftKind = (typeof DRAFT_KINDS)[number]['key'];

/** `DRAFT_TONES`. */
export const DRAFT_TONES = [
  { key: 'PROFESSIONAL', label: 'Professional' },
  { key: 'FRIENDLY', label: 'Friendly' },
  { key: 'SHORTER', label: 'Shorter' },
] as const;

export type DraftTone = (typeof DRAFT_TONES)[number]['key'];

/**
 * What `/ai/lead/generate` returns for a DRAFT.
 *
 * The written text is under `output`, not at the top level — the top level
 * carries the run's status, the provider and the stored insight row. Reading
 * `subject` and `body` off the root gives undefined, which is how the draft
 * dialog first crashed.
 */
export type DraftReply = {
  ok: true;
  status: string;
  output: { subject: string | null; body: string; placeholders: string[] } | null;
  label: string;
  /**
   * The server's own word on how this leaves the building. `MANUAL_EMAIL`
   * means you send it from your own mail client; `NONE` means there is no
   * channel at all and it is written to be pasted.
   */
  transport: 'MANUAL_EMAIL' | 'NONE';
  provider?: string | null;
  model?: string | null;
  ai?: { available: boolean; reason?: string | null };
};

export type Draft = {
  subject: string | null;
  body: string;
  placeholders: string[];
  label: string;
  transport: 'MANUAL_EMAIL' | 'NONE';
  model: string | null;
};

export type ConversationMessage = {
  id: string;
  channel: string | null;
  direction: 'INBOUND' | 'OUTBOUND' | null;
  occurredAt: string | null;
  summary: string | null;
  sentiment: string | null;
  outcome: string | null;
  objections: string | null;
  commitments: string | null;
  nextAction: string | null;
  nextFollowUpAt: string | null;
  durationMinutes: number | null;
  purpose: string | null;
  actorName: string | null;
};

export type Conversation = {
  leadId: string;
  leadName: string | null;
  lvLeadId: string | null;
  leadStatus: string | null;
  location: string | null;
  ownerId: string | null;
  ownerName: string | null;
  messages: ConversationMessage[];
  lastAt: string | null;
  lastChannel: string | null;
  lastDirection: 'INBOUND' | 'OUTBOUND' | null;
  lastSummary: string | null;
  /**
   * The most recent contact came from them and nothing has gone back. The
   * backend already treats this as the one case worth telling the owner
   * about, so it is the closest thing to "unread" that honestly exists.
   */
  awaitingReply: boolean;
  count: number;
};

const memberName = (member: { name?: { firstName?: string | null; lastName?: string | null } | null } | null | undefined): string | null => {
  const joined = [member?.name?.firstName, member?.name?.lastName].filter(Boolean).join(' ').trim();

  return joined.length > 0 ? joined : null;
};

type RawInteraction = {
  id: string;
  channel?: string | null;
  direction?: string | null;
  occurredAt?: string | null;
  // RICH_TEXT, so a composite rather than a scalar. Queried as a scalar it
  // comes back as an object and every summary reads as missing.
  summary?: { markdown?: string | null } | string | null;
  sentiment?: string | null;
  outcome?: string | null;
  objections?: string | null;
  commitments?: string | null;
  nextAction?: string | null;
  nextFollowUpAt?: string | null;
  durationMinutes?: number | null;
  purpose?: string | null;
  actor?: { id?: string | null; name?: { firstName?: string | null; lastName?: string | null } | null } | null;
  lead?: {
    id?: string | null;
    name?: string | null;
    lvLeadId?: string | null;
    status?: string | null;
    location?: string | null;
    ownerId?: string | null;
    owner?: { id?: string | null; name?: { firstName?: string | null; lastName?: string | null } | null } | null;
  } | null;
};

const toMessage = (row: RawInteraction): ConversationMessage => ({
  id: row.id,
  channel: row.channel ?? null,
  direction: (row.direction as 'INBOUND' | 'OUTBOUND' | null) ?? null,
  occurredAt: row.occurredAt ?? null,
  summary: typeof row.summary === 'string' ? row.summary : (row.summary?.markdown ?? null),
  sentiment: row.sentiment ?? null,
  outcome: row.outcome ?? null,
  objections: row.objections ?? null,
  commitments: row.commitments ?? null,
  nextAction: row.nextAction ?? null,
  nextFollowUpAt: row.nextFollowUpAt ?? null,
  durationMinutes: typeof row.durationMinutes === 'number' ? row.durationMinutes : null,
  purpose: row.purpose ?? null,
  actorName: memberName(row.actor),
});

// One read for the whole inbox. There is no conversations route and no
// server-side grouping, so the interactions come back newest-first and are
// folded into threads here — which is cheap, and far cheaper than a query per
// lead.
const INBOX_QUERY = `query($first: Int!) {
  lvInteractions(first: $first, orderBy: { occurredAt: DescNullsLast }) {
    edges { node {
      id channel direction occurredAt summary { markdown } sentiment outcome objections commitments
      nextAction nextFollowUpAt durationMinutes purpose
      actor { id name { firstName lastName } }
      lead { id name lvLeadId status location ownerId owner { id name { firstName lastName } } }
    } }
  }
}`;

/** How many interactions the inbox reads. The server caps a page; this is ours. */
export const INBOX_PAGE = 300;

export const foldConversations = (rows: RawInteraction[]): Conversation[] => {
  const byLead = new Map<string, Conversation>();

  for (const row of rows) {
    const leadId = row.lead?.id;

    if (!leadId) {
      // An interaction with no lead has no conversation to belong to.
      continue;
    }

    const message = toMessage(row);
    const existing = byLead.get(leadId);

    if (existing) {
      existing.messages.push(message);
      existing.count += 1;
      continue;
    }

    byLead.set(leadId, {
      leadId,
      leadName: row.lead?.name ?? null,
      lvLeadId: row.lead?.lvLeadId ?? null,
      leadStatus: row.lead?.status ?? null,
      location: row.lead?.location ?? null,
      ownerId: row.lead?.ownerId ?? row.lead?.owner?.id ?? null,
      ownerName: memberName(row.lead?.owner),
      messages: [message],
      lastAt: message.occurredAt,
      lastChannel: message.channel,
      lastDirection: message.direction,
      lastSummary: message.summary,
      // The rows arrive newest first, so the first one seen for a lead is the
      // most recent contact.
      awaitingReply: message.direction === 'INBOUND' && isOutward(message.channel),
      count: 1,
    });
  }

  return [...byLead.values()].sort((left, right) => Date.parse(right.lastAt ?? '') - Date.parse(left.lastAt ?? ''));
};

export const useConversations = () => {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  // A reload replaces a request already in flight rather than racing it.
  const inFlight = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++inFlight.current;

    setLoading(true);
    setError(null);

    try {
      const data = await graphql<{ lvInteractions?: { edges?: { node?: RawInteraction }[] } }>(INBOX_QUERY, { first: INBOX_PAGE });

      if (ticket !== inFlight.current) {
        return;
      }

      const rows = (data.lvInteractions?.edges ?? []).map((edge) => edge.node).filter((node): node is RawInteraction => Boolean(node?.id));

      setTruncated(rows.length >= INBOX_PAGE);
      setConversations(foldConversations(rows));
    } catch (cause) {
      if (ticket === inFlight.current) {
        setError(cause instanceof Error ? cause.message : 'The conversations could not be loaded.');
      }
    } finally {
      if (ticket === inFlight.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { conversations, error, loading, truncated, reload: load };
};

/** One thread, read from the same fold so the inbox and the thread agree. */
export const useConversation = (conversations: Conversation[] | null, leadId: string | undefined): Conversation | null =>
  useMemo(() => conversations?.find((conversation) => conversation.leadId === leadId) ?? null, [conversations, leadId]);

/**
 * `POST /ai/lead/generate { leadId, type: 'DRAFT', kind, tone, instructions }`.
 *
 * Refuses with `AI_UNAVAILABLE` when no provider is configured, and that
 * refusal is passed through rather than replaced with an apology — a draft
 * nobody wrote must never look like one somebody did.
 */
export const generateDraft = async (input: { leadId: string; kind: DraftKind; tone: DraftTone; instructions?: string | null }): Promise<Draft> => {
  const reply = await callRoute<DraftReply>('/ai/lead/generate', {
    leadId: input.leadId,
    type: 'DRAFT',
    kind: input.kind,
    tone: input.tone,
    instructions: input.instructions?.trim() || null,
  });

  // A run can answer ok:true and still have written nothing — a provider that
  // failed every retry reports its status here rather than as a refusal.
  if (reply.output === null || typeof reply.output.body !== 'string' || reply.output.body.trim() === '') {
    throw new Error('The model returned no draft. Nothing was written — try again, or write it yourself.');
  }

  return {
    subject: reply.output.subject ?? null,
    body: reply.output.body,
    placeholders: Array.isArray(reply.output.placeholders) ? reply.output.placeholders : [],
    label: reply.label ?? 'AI DRAFT',
    transport: reply.transport ?? 'MANUAL_EMAIL',
    model: reply.model ?? null,
  };
};

/** What the inbox can be narrowed to. Every one is derived from a real field. */
export type InboxFilter = 'ALL' | 'AWAITING' | 'MINE' | 'INBOUND';

export const matchesFilter = (conversation: Conversation, filter: InboxFilter, viewerId: string | null): boolean => {
  switch (filter) {
    case 'AWAITING':
      return conversation.awaitingReply;
    case 'MINE':
      return viewerId !== null && conversation.ownerId === viewerId;
    case 'INBOUND':
      return conversation.messages.some((message) => message.direction === 'INBOUND');
    default:
      return true;
  }
};
