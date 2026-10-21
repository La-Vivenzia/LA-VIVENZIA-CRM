import { useCallback, useRef, useState } from 'react';

import { callRoute } from 'src/api/client';

// Ask LV.
//
// Not a chatbot. A question goes to `/copilot/ask`, which turns it into an
// intent, validates a query plan, and **runs that plan as the person asking**
// — so every row comes back through their own role and record scoping. The
// route's own comment is the security model in one line:
//
//   "The session is the only identity: 'act as admin' in the text changes
//    nothing, an ownerId in the text is never used."
//
// The answer is returned in three separately labelled parts — known, inferred
// and suggested — because they carry different weight and the backend already
// keeps them apart. Nothing here merges them, and nothing here writes.
//
// A request with consequences does not run. It comes back as a *proposal*
// with a fifteen-minute life, which `/copilot/confirm` executes exactly once,
// with the same person's token.

export type ResultRow = {
  id: string;
  ref: string | null;
  title: string;
  subtitle: string | null;
  target: { object: string; recordId: string };
};

export type Answer = { known: string[]; inferred: string[]; suggested: string[] };

export type ProposedAction =
  | { kind: 'CREATE_TASK'; recordRef: string; dueIn: 'today' | 'tomorrow' | '3d' | '7d'; title: string | null }
  | { kind: 'ADD_NOTE'; recordRef: string; title: string | null }
  | { kind: 'UNSUPPORTED_ACTION'; verb: string; recordRef: string | null; whyNot: string };

export type Proposal = { proposalId: string; summary: string; action: ProposedAction; expiresAt: string };

/** `CopilotResponse` in `services/copilot.ts`. */
export type AskReply = {
  ok: true;
  intent: string;
  /** Whether a rule recognised the question, or the model had to read it. */
  intentSource: 'RULES' | 'MODEL';
  title: string;
  plan: unknown;
  rows: ResultRow[];
  totalCount: number | null;
  answer: Answer;
  /** Whether the prose was assembled from the rows, or written by the model. */
  answerOrigin: 'RULES' | 'MODEL';
  proposal: Proposal | null;
  refusal: string | null;
  ai: { available: boolean; reason: string | null };
  notes: string[];
};

export type ConfirmReply = {
  ok: true;
  status: 'CONFIRMED' | 'CANCELLED';
  created?: { object: string; recordId: string; title?: string | null; dueAt?: string | null };
  target?: { object: string; recordId: string };
};

/**
 * Where a result row can be opened. Only objects this application has a
 * screen for are linkable; anything else is shown without a link rather than
 * sent somewhere that does not exist.
 */
export const ROUTE_FOR: Record<string, (id: string) => string> = {
  lvLead: (id) => `/leads/${id}`,
  lvInteraction: (id) => `/messages/${id}`,
  lvOnboarding: (id) => `/onboarding/${id}`,
  lvOnboardingDocument: (id) => `/onboarding/${id}/documents`,
  lvPartner: (id) => `/ecosystem/partners/${id}`,
  lvProperty: (id) => `/ecosystem/properties/${id}`,
  lvExperience: (id) => `/ecosystem/experiences/${id}`,
};

export const linkFor = (target: { object: string; recordId: string }): string | null =>
  ROUTE_FOR[target.object] ? ROUTE_FOR[target.object](target.recordId) : null;

export const OBJECT_LABELS: Record<string, string> = {
  lvLead: 'Lead',
  lvInteraction: 'Conversation',
  lvOnboarding: 'Onboarding',
  lvOnboardingDocument: 'Document',
  lvPartner: 'Partner',
  lvProperty: 'Property',
  lvExperience: 'Experience',
  task: 'Task',
  note: 'Note',
};

/**
 * What the question box offers as a starting point.
 *
 * Every one of these matches a rule in `query/intent-rules.ts`, so each is a
 * question the backend can genuinely answer without the model. They are
 * examples of the shape of question that works — not decoration, and not a
 * wall of chips.
 */
export const EXAMPLE_QUESTIONS = [
  // Each of these was checked against `query/intent-rules.ts` and then run:
  // the first matches the BRIEFING rule, the rest match structured query
  // rules. Two earlier examples — "What needs my attention today?" and
  // "Which onboardings are waiting on documents?" — matched no rule and came
  // back UNSUPPORTED, which is the one thing an example must never do.
  { text: 'What should I work on?', why: 'The same briefing Today is built from.' },
  { text: 'Show me my open leads', why: 'Queries the leads you can see.' },
  { text: 'Which documents are missing?', why: 'Queries onboarding documents by verification state.' },
  { text: 'What tasks are overdue?', why: 'Queries follow-up tasks past their due date.' },
] as const;

export type AskPhase = 'IDLE' | 'ASKING' | 'ANSWERED' | 'FAILED';

export const useAsk = () => {
  const [phase, setPhase] = useState<AskPhase>('IDLE');
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [reply, setReply] = useState<AskReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Only the newest question may land. An older answer arriving late would
  // otherwise overwrite a newer one.
  const ticket = useRef(0);

  const ask = useCallback(async (text: string) => {
    const trimmed = text.trim();

    if (trimmed.length < 2) {
      setError('Ask a question.');
      setPhase('FAILED');

      return;
    }

    const mine = ++ticket.current;

    setPhase('ASKING');
    setAsked(trimmed);
    setError(null);
    setReply(null);

    try {
      const result = await callRoute<AskReply>('/copilot/ask', {
        question: trimmed,
        timeZoneOffsetMinutes: new Date().getTimezoneOffset(),
      });

      if (mine !== ticket.current) {
        return;
      }

      setReply(result);
      setPhase('ANSWERED');
    } catch (cause) {
      if (mine !== ticket.current) {
        return;
      }

      setError(cause instanceof Error ? cause.message : 'That question could not be answered.');
      setPhase('FAILED');
    }
  }, []);

  /** Abandons whatever is in flight and goes back to the question box. */
  const reset = useCallback(() => {
    ticket.current += 1;
    setPhase('IDLE');
    setQuestion('');
    setAsked(null);
    setReply(null);
    setError(null);
  }, []);

  return { phase, question, setQuestion, asked, reply, error, ask, reset, retry: () => (asked ? ask(asked) : undefined) };
};

/** `/copilot/confirm` — runs one proposal, or cancels it. */
export const confirmProposal = (proposalId: string, edits?: Record<string, unknown>) =>
  callRoute<ConfirmReply>('/copilot/confirm', { proposalId, ...(edits ? { edits } : {}) });

export const cancelProposal = (proposalId: string) => callRoute<ConfirmReply>('/copilot/confirm', { proposalId, cancel: true });

// ---------------------------------------------------------------------------
// 10.4 — deciding on a stored AI insight
// ---------------------------------------------------------------------------

/** `HumanDecision` in the insight-decide route. */
export const INSIGHT_DECISIONS = ['ACCEPTED', 'EDITED', 'REJECTED', 'DISMISSED', 'MERGED', 'IGNORED', 'CREATED_NEW'] as const;

export type InsightDecision = (typeof INSIGHT_DECISIONS)[number];

export type Insight = {
  id: string;
  insightType: string;
  status: string | null;
  origin: string | null;
  summary: string | null;
  payload: Record<string, unknown> | null;
  confidence: number | null;
  generatedAt: string | null;
  provider: string | null;
  model: string | null;
  humanDecision: string | null;
  reviewedAt: string | null;
  targetRecordId: string | null;
  sourceRecordIds: string[];
};

/**
 * `/ai/lead/insights` returns `insights` as an **object keyed by insightType**
 * — `{ OPPORTUNITY_SCORE: {...}, DUPLICATE: {...} }` — not as an array, and it
 * has no `deterministic` key: the computed parts come back as `facts`,
 * `opportunity`, `health`, `nextBestAction`, `dataQuality` and `duplicates`.
 * Typing it as an array made the Intelligence tab call `.filter` on an object
 * and render nothing at all; verified against the route on 2026-10-05.
 */
export type InsightsReply = {
  ok: true;
  insights?: Record<string, Insight>;
  ai?: { available: boolean; reason: string | null; provider?: string | null; model?: string | null };
};

/** The suggestions as a list, in the order the route returned them. */
export const insightList = (reply: InsightsReply | null | undefined): Insight[] =>
  Object.values(reply?.insights ?? {}).filter((insight): insight is Insight => Boolean(insight?.id));

/**
 * What each decision does, in the reviewer's terms. Taken from the route's
 * own description of what it writes per insight type — nothing here promises
 * an effect the route does not have.
 */
export const DECISION_COPY: Record<string, { verb: string; consequence: string }> = {
  ACCEPTED: { verb: 'Accept', consequence: 'Applies the suggestion with your own permissions, and records that you decided it.' },
  REJECTED: { verb: 'Reject', consequence: 'Records that this was wrong. Nothing is written to the record.' },
  DISMISSED: { verb: 'Dismiss', consequence: 'Sets it aside without judging it. Nothing is written.' },
  EDITED: { verb: 'Accept with changes', consequence: 'Applies what you changed rather than what was suggested.' },
  MERGED: { verb: 'Merge', consequence: 'Marks the newer lead as a duplicate of the older one.' },
  IGNORED: { verb: 'Not a duplicate', consequence: 'Records that these are different. Nothing changes.' },
  CREATED_NEW: { verb: 'Keep both', consequence: 'Records that both should exist. Nothing changes.' },
};

export const fetchInsights = (leadId: string, includeDuplicates = true) =>
  callRoute<InsightsReply>('/ai/lead/insights', { leadId, includeDuplicates });

export const decideInsight = (input: { insightId: string; decision: InsightDecision; note?: string | null; edits?: Record<string, unknown>; candidateLeadId?: string }) =>
  callRoute<{ ok: true; decision: string; insightId: string }>('/ai/insight/decide', {
    insightId: input.insightId,
    decision: input.decision,
    note: input.note ?? null,
    ...(input.edits ? { edits: input.edits } : {}),
    ...(input.candidateLeadId ? { candidateLeadId: input.candidateLeadId } : {}),
  });
