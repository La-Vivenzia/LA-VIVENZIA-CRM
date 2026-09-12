// Deterministic intent detection for the questions the team asks every day.
// These rules run BEFORE any model call, so the Copilot answers the common
// cases with no provider at all and with no interpretation risk; the model is
// only consulted for phrasings the rules do not recognise.
//
// Refusals are detected here too: a request to delete, merge, approve,
// reassign, change owner or send is never turned into a query, and "act as
// admin" is answered with the truth — the session is what it is.

import { type QueryPlan } from 'src/modules/lv-copilot/query/query-schema';

export type ProposedAction =
  | { kind: 'CREATE_TASK'; recordRef: string; dueIn: 'today' | 'tomorrow' | '3d' | '7d'; title: string | null }
  | { kind: 'ADD_NOTE'; recordRef: string; title: string | null }
  | { kind: 'UNSUPPORTED_ACTION'; verb: string; recordRef: string | null; whyNot: string };

export type Intent =
  | { kind: 'QUERY'; plan: QueryPlan; title: string; source: 'RULES' }
  | { kind: 'RECORD_QUESTION'; recordRef: string; question: string; source: 'RULES' }
  | { kind: 'ACTION'; action: ProposedAction; source: 'RULES' }
  | { kind: 'BRIEFING'; source: 'RULES' }
  | { kind: 'REFUSED'; reason: string; source: 'RULES' }
  | { kind: 'UNKNOWN'; source: 'RULES' };

const LEAD_REF = /\b(LV-\d{6})\b/i;

const DESTRUCTIVE = /\b(delete|destroy|remove|erase|purge|wipe)\b/i;
const MERGE = /\bmerge\b/i;
const APPROVE = /\b(approve|reject|activate|deactivate)\b/i;
const OWNER = /\b(change|set|update|reassign|assign|transfer|move)\b[^.]*\b(owner|ownership|assign(ee)?)\b|\breassign\b/i;
const SEND = /\b(send|email|whatsapp|message|text)\b\s+(this|the|an?|to|him|her|them)\b/i;
const PRICE = /\b(change|set|update)\b[^.]*\b(price|pricing|commission|terms|rate)\b/i;
const IMPERSONATE = /\b(act|behave|run|answer|operate)\s+as\s+(an?\s+)?(admin|administrator|main admin|owner|superuser|root)\b|\bignore\s+(your\s+)?(permissions|rules|restrictions)\b|\bsudo\b/i;

// "my" / "mine" / "assigned to me" scope a query to the caller; a bare "me"
// (as in "show me") does not.
const MINE = /\b(my|mine)\b|\b(assigned|owned|belonging)\s+to\s+me\b/i;

const location = (text: string): string | null => {
  const match = text.match(/\b(?:in|from|at|near)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\b/);

  return match?.[1] ?? null;
};

const leadPlan = (filters: QueryPlan['filters'], sort: QueryPlan['sort'] = null, limit = 10): QueryPlan => ({ object: 'lead', filters, sort, limit });

export const detectIntent = (question: string): Intent => {
  const text = question.trim();
  const lower = text.toLowerCase();

  if (text.length === 0) {
    return { kind: 'UNKNOWN', source: 'RULES' };
  }

  if (IMPERSONATE.test(text)) {
    return { kind: 'REFUSED', reason: 'I answer with your own permissions only; there is no way to act as another role from here.', source: 'RULES' };
  }

  const ref = text.match(LEAD_REF)?.[1]?.toUpperCase() ?? null;

  // ---- consequential requests: never queries, never executed here
  if (DESTRUCTIVE.test(text)) {
    return { kind: 'ACTION', action: { kind: 'UNSUPPORTED_ACTION', verb: 'delete', recordRef: ref, whyNot: 'Deleting is not something the Copilot can do. Use Archive or Close on the lead’s Actions tab; permanent deletion is reserved for the Main Admin and is audited.' }, source: 'RULES' };
  }

  if (MERGE.test(text)) {
    return { kind: 'ACTION', action: { kind: 'UNSUPPORTED_ACTION', verb: 'merge', recordRef: ref, whyNot: 'Merging is a human decision on the lead’s Intelligence tab (Duplicate signal → Merge), where your role’s permissions apply.' }, source: 'RULES' };
  }

  if (APPROVE.test(text)) {
    return { kind: 'ACTION', action: { kind: 'UNSUPPORTED_ACTION', verb: 'approve', recordRef: ref, whyNot: 'Approving or rejecting a partner is done by the assigned reviewer on the onboarding record; the Copilot cannot do it.' }, source: 'RULES' };
  }

  if (OWNER.test(text)) {
    return { kind: 'ACTION', action: { kind: 'UNSUPPORTED_ACTION', verb: 'reassign', recordRef: ref, whyNot: 'Ownership changes go through the lead record (Owner field), where the platform checks your permission and the assignment engine records the history. I can only suggest it.' }, source: 'RULES' };
  }

  if (PRICE.test(text)) {
    return { kind: 'ACTION', action: { kind: 'UNSUPPORTED_ACTION', verb: 'commercial', recordRef: ref, whyNot: 'Commercial terms and pricing are never changed by the Copilot.' }, source: 'RULES' };
  }

  if (SEND.test(text)) {
    return { kind: 'ACTION', action: { kind: 'UNSUPPORTED_ACTION', verb: 'send', recordRef: ref, whyNot: 'Nothing is sent automatically. Ask for a draft on the lead’s Intelligence tab and send it yourself after review.' }, source: 'RULES' };
  }

  // ---- write proposals (confirmation required)
  const createTask = lower.match(/\b(create|add|make|set up|schedule)\b[^.]*\b(follow[- ]?up|task|reminder|call)\b/);

  if (createTask && ref) {
    const dueIn: 'today' | 'tomorrow' | '3d' | '7d' = /\btomorrow\b/.test(lower) ? 'tomorrow' : /\btoday\b/.test(lower) ? 'today' : /\bnext week\b|\b7 days\b/.test(lower) ? '7d' : /\b3 days\b|\bin three days\b/.test(lower) ? '3d' : 'tomorrow';
    const titleMatch = text.match(/(?:called|titled|named|:)\s*["“']?([^"”']{3,80})["”']?$/i);

    return { kind: 'ACTION', action: { kind: 'CREATE_TASK', recordRef: ref, dueIn, title: titleMatch?.[1]?.trim() ?? null }, source: 'RULES' };
  }

  if (/\b(add|create|write)\b[^.]*\bnote\b/.test(lower) && ref) {
    const titleMatch = text.match(/note\b[^:]*:\s*(.{3,120})$/i);

    return { kind: 'ACTION', action: { kind: 'ADD_NOTE', recordRef: ref, title: titleMatch?.[1]?.trim() ?? null }, source: 'RULES' };
  }

  // ---- record question
  if (ref && /\b(what happened|status|summary|summarise|summarize|tell me about|what's going on|update on|history|where are we)\b/.test(lower)) {
    return { kind: 'RECORD_QUESTION', recordRef: ref, question: text, source: 'RULES' };
  }

  if (ref && /\b(price|pricing|cost|availability|available|certified|certification|licen[cs]e|insurance)\b/.test(lower)) {
    return { kind: 'RECORD_QUESTION', recordRef: ref, question: text, source: 'RULES' };
  }

  // ---- briefing
  if (/\b(what should i (work on|do|focus on)|my day|today'?s (plan|priorities|briefing)|morning briefing|priorities today)\b/.test(lower)) {
    return { kind: 'BRIEFING', source: 'RULES' };
  }

  // ---- structured queries
  const mine = MINE.test(text);
  const place = location(text);
  const placeFilter = place ? [{ field: 'location', operator: 'contains' as const, value: place }] : [];
  const mineLead = mine ? [{ field: 'owner', operator: 'eq' as const, value: 'me' }] : [];

  if (/\boverdue\b/.test(lower) && /\b(lead|leads)\b/.test(lower)) {
    return {
      kind: 'QUERY',
      title: 'Leads whose next follow-up date has passed',
      plan: leadPlan([...mineLead, { field: 'nextFollowUpAt', operator: 'lt', value: 'now' }, { field: 'status', operator: 'in', value: ['NEW', 'QUALIFYING', 'ASSIGNED', 'CONTACTED', 'ENGAGED', 'INTERESTED', 'NEGOTIATION', 'FOLLOW_UP_LATER'] }, ...placeFilter], { field: 'nextFollowUpAt', direction: 'asc' }),
      source: 'RULES',
    };
  }

  if (/\boverdue\b/.test(lower)) {
    return {
      kind: 'QUERY',
      title: 'Overdue follow-up tasks',
      plan: { object: 'task', filters: [...(mine ? [{ field: 'assignee', operator: 'eq' as const, value: 'me' }] : []), { field: 'status', operator: 'neq', value: 'DONE' }, { field: 'dueAt', operator: 'lt', value: 'now' }], sort: { field: 'dueAt', direction: 'asc' }, limit: 15 },
      source: 'RULES',
    };
  }

  if (/\b(waiting|awaiting)\b[^.]*\b(response|reply|answer)\b/.test(lower)) {
    return {
      kind: 'QUERY',
      title: 'Interactions still awaiting a response',
      plan: { object: 'interaction', filters: [{ field: 'outcome', operator: 'eq', value: 'AWAITING_RESPONSE' }, { field: 'occurredAt', operator: 'gte', value: '30d' }], sort: { field: 'occurredAt', direction: 'desc' }, limit: 15 },
      source: 'RULES',
    };
  }

  if (/\bmissing\b[^.]*\bdocument/.test(lower) || /\bdocuments?\b[^.]*\b(missing|pending|rejected|awaiting)\b/.test(lower)) {
    const states = /\brejected\b/.test(lower) ? ['REJECTED', 'NEEDS_REPLACEMENT'] : ['PENDING', 'UNDER_REVIEW', 'REJECTED', 'NEEDS_REPLACEMENT', 'EXPIRED'];

    return {
      kind: 'QUERY',
      title: 'Onboardings with documents that need attention',
      plan: { object: 'document', filters: [{ field: 'verificationState', operator: 'in', value: states }], sort: { field: 'uploadedAt', direction: 'desc' }, limit: 20 },
      source: 'RULES',
    };
  }

  if (/\bsla\b/.test(lower) && /\b(breach|breached|escalat)/.test(lower)) {
    return {
      kind: 'QUERY',
      title: 'Breached and escalated SLAs',
      plan: { object: 'sla', filters: [{ field: 'status', operator: 'in', value: ['BREACHED', 'ESCALATED'] }], sort: { field: 'dueAt', direction: 'asc' }, limit: 20 },
      source: 'RULES',
    };
  }

  if (/\binterested\b/.test(lower) && /\bno next action\b|\bwithout (a )?next action\b|\bno next step\b/.test(lower)) {
    return {
      kind: 'QUERY',
      title: 'Interested leads without a next action',
      plan: leadPlan([...mineLead, { field: 'status', operator: 'in', value: ['INTERESTED', 'NEGOTIATION'] }, { field: 'nextAction', operator: 'is_null', value: null }, ...placeFilter]),
      source: 'RULES',
    };
  }

  if (/\bnot (been )?contacted\b|\bno contact\b|\bhaven'?t (been )?contacted\b/.test(lower)) {
    return {
      kind: 'QUERY',
      title: 'Open leads with no interaction in the last 14 days',
      plan: leadPlan([...mineLead, { field: 'status', operator: 'in', value: ['ASSIGNED', 'CONTACTED', 'ENGAGED', 'INTERESTED', 'NEGOTIATION', 'FOLLOW_UP_LATER'] }, { field: 'lastInteractionAt', operator: 'lt', value: '14d' }, ...placeFilter], { field: 'lastInteractionAt', direction: 'asc' }),
      source: 'RULES',
    };
  }

  if (/\bhigh[- ]priority\b|\bcritical\b|\bhot leads?\b/.test(lower)) {
    return {
      kind: 'QUERY',
      title: `High-priority leads${place ? ` in ${place}` : ''}`,
      plan: leadPlan([...mineLead, { field: 'priority', operator: 'in', value: ['CRITICAL', 'HIGH'] }, { field: 'status', operator: 'in', value: ['NEW', 'QUALIFYING', 'ASSIGNED', 'CONTACTED', 'ENGAGED', 'INTERESTED', 'NEGOTIATION'] }, ...placeFilter], { field: 'priority', direction: 'asc' }),
      source: 'RULES',
    };
  }

  if (/\binterested\b/.test(lower) && /\blead/.test(lower)) {
    return { kind: 'QUERY', title: 'Interested leads', plan: leadPlan([...mineLead, { field: 'status', operator: 'in', value: ['INTERESTED', 'NEGOTIATION'] }, ...placeFilter]), source: 'RULES' };
  }

  if (/\b(all|show|list|which|my)\b[^.]*\bleads?\b/.test(lower)) {
    return { kind: 'QUERY', title: mine ? 'Your leads' : 'Leads', plan: leadPlan([...mineLead, ...placeFilter], { field: 'updatedAt', direction: 'desc' }, 15), source: 'RULES' };
  }

  if (/\b(all|show|list|which|my)\b[^.]*\b(tasks?|follow[- ]?ups?)\b/.test(lower)) {
    return { kind: 'QUERY', title: 'Open follow-up tasks', plan: { object: 'task', filters: [...(mine ? [{ field: 'assignee', operator: 'eq' as const, value: 'me' }] : []), { field: 'status', operator: 'neq', value: 'DONE' }], sort: { field: 'dueAt', direction: 'asc' }, limit: 15 }, source: 'RULES' };
  }

  return { kind: 'UNKNOWN', source: 'RULES' };
};
