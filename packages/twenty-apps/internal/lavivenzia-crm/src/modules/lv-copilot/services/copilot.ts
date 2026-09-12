import { type AiProvider } from 'src/modules/lv-ai/provider/ai-provider';
import { isRecord } from 'src/modules/lv-ai/provider/structured-output';
import { COPILOT_ANSWER_PROMPT, COPILOT_INTENT_PROMPT } from 'src/modules/lv-ai/prompts/prompt-registry';
import { runPrompt } from 'src/modules/lv-ai/runtime/ai-runner';
import { boundedJson, type GraphqlClient } from 'src/modules/lv-ai/runtime/clients';
import { detectIntent, type Intent, type ProposedAction } from 'src/modules/lv-copilot/query/intent-rules';
import { type QueryPlan, SCHEMA, schemaForPrompt } from 'src/modules/lv-copilot/query/query-schema';
import { toGraphqlFilter, toGraphqlOrderBy, validatePlan } from 'src/modules/lv-copilot/query/validate-plan';
import { deriveLeadFacts } from 'src/modules/lv-intelligence/engines/lead-facts';
import { recommendNextBestAction } from 'src/modules/lv-intelligence/engines/next-best-action';
import { type LeadContext, loadLeadContext } from 'src/modules/lv-intelligence/services/lead-context';

// The Copilot pipeline: question → intent (rules first, model second) →
// validated plan → query under the CALLER's token → deterministic answer
// (KNOWN / INFERRED / SUGGESTED) → optional model narrative grounded in the
// rows. Writes are never executed here; they become PROPOSED runs that the
// same person must confirm.

export type ResultRow = { id: string; ref: string | null; title: string; subtitle: string | null; target: { object: string; recordId: string } };

export type Answer = {
  known: string[];
  inferred: string[];
  suggested: string[];
};

export type CopilotResponse = {
  ok: true;
  intent: Intent['kind'] | 'QUERY_MODEL' | 'UNSUPPORTED';
  intentSource: 'RULES' | 'MODEL';
  title: string;
  plan: QueryPlan | null;
  rows: ResultRow[];
  totalCount: number | null;
  answer: Answer;
  answerOrigin: 'RULES' | 'MODEL';
  proposal: { proposalId: string; summary: string; action: ProposedAction; expiresAt: string } | null;
  refusal: string | null;
  ai: { available: boolean; reason: string | null };
  notes: string[];
};

const PROPOSAL_TTL_MS = 15 * 60_000;

const rowTitle = (object: QueryPlan['object'], row: Record<string, unknown>): ResultRow => {
  switch (object) {
    case 'lead':
      return { id: String(row.id), ref: (row.lvLeadId as string | null) ?? null, title: String(row.name ?? row.organisationName ?? 'Lead'), subtitle: [row.status, row.priority, row.location].filter(Boolean).join(' · ') || null, target: { object: 'lvLead', recordId: String(row.id) } };
    case 'task': {
      const targets = isRecord(row.taskTargets) && Array.isArray(row.taskTargets.edges) ? row.taskTargets.edges : [];
      const leadId = targets.map((edge) => (isRecord(edge) && isRecord(edge.node) ? edge.node.targetLvLeadId : null)).find((value): value is string => typeof value === 'string') ?? null;

      return { id: String(row.id), ref: null, title: String(row.title ?? 'Task'), subtitle: [row.status, row.dueAt ? `due ${String(row.dueAt).slice(0, 10)}` : null, leadId ? 'linked to a lead' : null].filter(Boolean).join(' · ') || null, target: { object: 'task', recordId: String(row.id) } };
    }
    case 'interaction':
      return { id: String(row.id), ref: null, title: String(row.name ?? `${String(row.channel ?? '')} interaction`), subtitle: [row.direction, row.outcome, row.occurredAt ? String(row.occurredAt).slice(0, 10) : null].filter(Boolean).join(' · ') || null, target: row.leadId ? { object: 'lvLead', recordId: String(row.leadId) } : { object: 'lvInteraction', recordId: String(row.id) } };
    case 'onboarding':
      return { id: String(row.id), ref: null, title: String(row.name ?? 'Onboarding'), subtitle: [row.status, row.progressPercentage !== null && row.progressPercentage !== undefined ? `${String(row.progressPercentage)}%` : null].filter(Boolean).join(' · ') || null, target: { object: 'lvOnboarding', recordId: String(row.id) } };
    case 'document':
      return { id: String(row.id), ref: null, title: String(row.name ?? row.documentType ?? 'Document'), subtitle: [row.verificationState, row.expiresAt ? `expires ${String(row.expiresAt).slice(0, 10)}` : null].filter(Boolean).join(' · ') || null, target: { object: 'lvOnboardingDocument', recordId: String(row.id) } };
    case 'sla':
      return { id: String(row.id), ref: null, title: String(row.name ?? row.rule ?? 'SLA'), subtitle: [row.status, row.dueAt ? `due ${String(row.dueAt).slice(0, 10)}` : null].filter(Boolean).join(' · ') || null, target: row.leadId ? { object: 'lvLead', recordId: String(row.leadId) } : row.onboardingId ? { object: 'lvOnboarding', recordId: String(row.onboardingId) } : { object: 'lvSla', recordId: String(row.id) } };
    default:
      return { id: String(row.id), ref: null, title: 'Record', subtitle: null, target: { object: 'lvLead', recordId: String(row.id) } };
  }
};

export const executePlan = async (delegated: GraphqlClient, plan: QueryPlan, callerWorkspaceMemberId: string): Promise<{ rows: ResultRow[]; totalCount: number; raw: Record<string, unknown>[] }> => {
  const spec = SCHEMA[plan.object];
  const { data, errors } = await delegated.query<Record<string, { totalCount: number; edges: { node: Record<string, unknown> }[] }>>(
    `query($filter: ${spec.type}FilterInput, $orderBy: [${spec.type}OrderByInput]) { ${spec.plural}(first: ${plan.limit}, filter: $filter, orderBy: $orderBy) { totalCount edges { node { ${spec.selection} } } } }`,
    { filter: toGraphqlFilter(plan, callerWorkspaceMemberId), orderBy: toGraphqlOrderBy(plan) },
  );

  if (errors.length > 0 && !data[spec.plural]) {
    throw new Error(errors[0]?.message ?? 'Query failed.');
  }

  const raw = (data[spec.plural]?.edges ?? []).map((edge) => edge.node);

  return { rows: raw.map((row) => rowTitle(plan.object, row)), totalCount: data[spec.plural]?.totalCount ?? raw.length, raw };
};

const describePlan = (plan: QueryPlan): string =>
  plan.filters
    .map((filter) => `${filter.field} ${filter.operator}${filter.value === null ? '' : ` ${Array.isArray(filter.value) ? filter.value.join('/') : String(filter.value)}`}`)
    .join(', ');

export const deterministicAnswer = (plan: QueryPlan, rows: ResultRow[], totalCount: number): Answer => {
  const label = SCHEMA[plan.object].label;
  const known = [`${totalCount} ${label}${totalCount === 1 ? '' : 's'} match (${describePlan(plan) || 'no filter'}), under your permissions.`];

  if (rows.length > 0) {
    known.push(`Showing ${rows.length}: ${rows.slice(0, 5).map((row) => (row.ref ? `${row.ref} ${row.title}` : row.title)).join('; ')}${rows.length > 5 ? '…' : ''}.`);
  }

  const inferred: string[] = [];
  const suggested: string[] = [];

  if (totalCount === 0) {
    inferred.push('Either nothing matches, or the matching records are outside what your role can read.');
  }

  if (plan.object === 'task' && totalCount > 0) {
    suggested.push('Work the oldest due date first; each row opens the task.');
  }

  if (plan.object === 'sla' && totalCount > 0) {
    suggested.push('Open the lead behind each breach; the Next Best Action there names the step.');
  }

  if (plan.object === 'lead' && totalCount > 0) {
    suggested.push('Open a lead’s Intelligence tab for its next best action and health.');
  }

  return { known, inferred, suggested };
};

// A question about one record, answered from its context and the
// deterministic engines — the anti-hallucination path: pricing, availability,
// certification and the like come only from partner-provided onboarding
// answers or documents, never from the model.
export const answerRecordQuestion = (context: LeadContext, question: string): Answer => {
  const facts = deriveLeadFacts(context);
  const lower = question.toLowerCase();
  const known: string[] = [];
  const inferred: string[] = [];
  const suggested: string[] = [];
  const answers = context.onboarding?.answers ?? {};
  const pricing = isRecord(answers.PRICING) ? answers.PRICING : null;
  const availability = isRecord(answers.AVAILABILITY) ? answers.AVAILABILITY : null;
  const ref = context.lead.lvLeadId ?? context.lead.id;

  if (/\b(price|pricing|cost|rate)\b/.test(lower)) {
    if (pricing && (pricing.basePrice !== undefined && pricing.basePrice !== null && pricing.basePrice !== '')) {
      known.push(`Partner-provided pricing (onboarding answers, USER PROVIDED): base price ${String(pricing.basePrice)} INR ${pricing.priceUnit ? `per ${String(pricing.priceUnit)}` : ''}.`.trim());
    } else {
      known.push(`Pricing is not available in CRM data for ${ref}.`);
      suggested.push('Ask the partner for pricing on the next call and record it in the interaction.');
    }

    return { known, inferred, suggested };
  }

  if (/\b(availab\w*|when can|open on|season\w*)\b/.test(lower)) {
    if (availability && Array.isArray(availability.availableDays) && availability.availableDays.length > 0) {
      known.push(`Partner-provided availability (USER PROVIDED): ${(availability.availableDays as unknown[]).map(String).join(', ')}${availability.noticePeriodHours ? `, ${String(availability.noticePeriodHours)}h notice` : ''}.`);
    } else {
      known.push(`Availability is not recorded in CRM data for ${ref}.`);
    }

    return { known, inferred, suggested };
  }

  if (/\b(certif\w*|licen[cs]e\w*|insur\w*|registered|registration|compliance)\b/.test(lower)) {
    const docs = context.onboarding?.documents ?? [];

    if (docs.length === 0) {
      known.push(`Certification / compliance status is not available in CRM data for ${ref}: no verification document is on file.`);
    } else {
      known.push(`Documents on file: ${docs.map((doc) => `${doc.documentType ?? 'document'} ${doc.verificationState ?? ''}`).join('; ')}. No other certification is recorded.`);
    }

    return { known, inferred, suggested };
  }

  // General "what happened" summary from facts.
  known.push(`${ref} ${context.lead.name ?? ''} is ${facts.status.toLowerCase().replace(/_/g, ' ')}, priority ${facts.priority.toLowerCase()}${context.lead.location ? `, ${context.lead.location}` : ''}.`);
  known.push(facts.interactionCount === 0 ? 'No interaction has been recorded.' : `${facts.interactionCount} interaction(s); last one ${facts.daysSinceLastInteraction} day(s) ago${facts.lastInteraction ? ` (${facts.lastInteraction.direction ?? ''} ${facts.lastInteraction.channel ?? ''}${facts.lastInteraction.outcome ? `, ${facts.lastInteraction.outcome.toLowerCase().replace(/_/g, ' ')}` : ''})` : ''}.`);

  if (facts.openTasks.length > 0) {
    known.push(`${facts.openTasks.length} open task(s)${facts.overdueTasks.length > 0 ? `, ${facts.overdueTasks.length} overdue` : ''}.`);
  }

  if (facts.breachedSlas.length > 0) {
    known.push(`${facts.breachedSlas.length} SLA(s) breached or escalated.`);
  }

  if (context.onboarding) {
    known.push(`Onboarding ${context.onboarding.status?.toLowerCase().replace(/_/g, ' ')}${context.onboarding.progressPercentage !== null ? `, ${context.onboarding.progressPercentage}% complete` : ''}.`);
  }

  if (facts.awaitingResponseDays !== null) {
    inferred.push(`The partner may still be considering: the last outcome was "awaiting response" ${facts.awaitingResponseDays} day(s) ago.`);
  }

  const nba = recommendNextBestAction(facts);

  if (nba.primary) {
    suggested.push(`${nba.primary.title} — ${nba.primary.reason}`);
  }

  return { known: known.slice(0, 5), inferred: inferred.slice(0, 2), suggested: suggested.slice(0, 2) };
};

export const storeProposal = async (application: GraphqlClient, actorWorkspaceMemberId: string, action: ProposedAction, summary: string, leadId: string | null): Promise<{ proposalId: string; expiresAt: string } | null> => {
  const expiresAt = new Date(Date.now() + PROPOSAL_TTL_MS).toISOString();
  const { data } = await application.query<{ createLvAiRun?: { id: string } }>(`mutation($data: LvAiRunCreateInput!) { createLvAiRun(data: $data) { id } }`, {
    data: {
      name: `COPILOT_PROPOSAL · ${action.kind}`,
      operation: 'COPILOT_PROPOSAL',
      promptVersion: 'copilot-actions-v1',
      provider: 'rules',
      status: 'PROPOSED',
      targetObject: leadId ? 'lvLead' : null,
      targetRecordId: leadId,
      actorId: actorWorkspaceMemberId,
      sourceRecordIds: boundedJson(leadId ? [leadId] : []),
      startedAt: new Date().toISOString(),
      metadata: boundedJson({ action, summary, expiresAt }, 4_000),
    },
  });

  return data.createLvAiRun ? { proposalId: data.createLvAiRun.id, expiresAt } : null;
};

export const resolveLeadRef = async (delegated: GraphqlClient, application: GraphqlClient, ref: string): Promise<LeadContext | null> => {
  const { data } = await delegated.query<{ lvLeads?: { edges: { node: { id: string } }[] } }>(`query($filter: LvLeadFilterInput) { lvLeads(first: 1, filter: $filter) { edges { node { id } } } }`, {
    filter: { lvLeadId: { eq: ref.toUpperCase() } },
  });
  const id = data.lvLeads?.edges?.[0]?.node.id;

  return id ? loadLeadContext(delegated, application, id) : null;
};

// Model fallback for intent: only when the rules did not recognise the
// question, only when a provider exists, and the result is validated like
// any other untrusted plan.
export const modelIntent = async (provider: AiProvider, application: GraphqlClient, question: string, actorWorkspaceMemberId: string): Promise<Intent | null> => {
  const { result } = await runPrompt(provider, application, COPILOT_INTENT_PROMPT, `SCHEMA\n${schemaForPrompt()}\n\nQUESTION\n${question.slice(0, 500)}`, {
    operation: 'COPILOT_INTENT',
    actorWorkspaceMemberId,
    targetObject: null,
    targetRecordId: null,
    sourceRecordIds: [],
  });

  if (!result.ok) {
    return null;
  }

  const value = result.value;

  if (value.intent === 'QUERY' && value.plan) {
    const validation = validatePlan(value.plan);

    return validation.ok ? { kind: 'QUERY', plan: validation.plan, title: value.explanation || 'Results', source: 'RULES' } : { kind: 'REFUSED', reason: `The question maps to something the Copilot cannot query: ${validation.reason}`, source: 'RULES' };
  }

  if (value.intent === 'RECORD_QUESTION' && value.recordRef && /^LV-\d{6}$/i.test(value.recordRef)) {
    return { kind: 'RECORD_QUESTION', recordRef: value.recordRef.toUpperCase(), question, source: 'RULES' };
  }

  if (value.intent === 'ACTION' && isRecord(value.action)) {
    const kind = String(value.action.kind ?? '');
    const recordRef = typeof value.action.recordRef === 'string' && /^LV-\d{6}$/i.test(value.action.recordRef) ? value.action.recordRef.toUpperCase() : null;

    if (kind === 'CREATE_TASK' && recordRef) {
      const dueIn = ['today', 'tomorrow', '3d', '7d'].includes(String(value.action.dueIn)) ? (String(value.action.dueIn) as 'today' | 'tomorrow' | '3d' | '7d') : 'tomorrow';

      return { kind: 'ACTION', action: { kind: 'CREATE_TASK', recordRef, dueIn, title: typeof value.action.title === 'string' ? value.action.title.slice(0, 120) : null }, source: 'RULES' };
    }

    if (kind === 'ADD_NOTE' && recordRef) {
      return { kind: 'ACTION', action: { kind: 'ADD_NOTE', recordRef, title: typeof value.action.title === 'string' ? value.action.title.slice(0, 120) : null }, source: 'RULES' };
    }

    return { kind: 'ACTION', action: { kind: 'UNSUPPORTED_ACTION', verb: kind || 'unknown', recordRef, whyNot: 'That action is not something the Copilot performs; it requires a person acting on the record with their own permissions.' }, source: 'RULES' };
  }

  return { kind: 'REFUSED', reason: value.explanation || 'I could not map that question to a CRM query.', source: 'RULES' };
};

export const modelNarrative = async (provider: AiProvider, application: GraphqlClient, question: string, rows: ResultRow[], actorWorkspaceMemberId: string): Promise<Answer | null> => {
  if (rows.length === 0) {
    return null;
  }

  const context = ['QUESTION', question.slice(0, 500), '', 'RECORDS (returned under the user’s own permissions)', ...rows.slice(0, 15).map((row) => `- ${row.ref ? `${row.ref} ` : ''}${row.title}${row.subtitle ? ` — ${row.subtitle}` : ''}`)].join('\n');
  const { result } = await runPrompt(provider, application, COPILOT_ANSWER_PROMPT, context, {
    operation: 'COPILOT_ANSWER',
    actorWorkspaceMemberId,
    targetObject: null,
    targetRecordId: null,
    sourceRecordIds: rows.map((row) => row.id),
  });

  return result.ok ? result.value : null;
};

// Wraps a question end to end. Exposed for tests.
export const detectOrModelIntent = async (question: string, provider: AiProvider | null, application: GraphqlClient, actorWorkspaceMemberId: string): Promise<{ intent: Intent; source: 'RULES' | 'MODEL' }> => {
  const ruleIntent = detectIntent(question);

  if (ruleIntent.kind !== 'UNKNOWN' || !provider || !provider.available) {
    return { intent: ruleIntent, source: 'RULES' };
  }

  const fromModel = await modelIntent(provider, application, question, actorWorkspaceMemberId);

  return fromModel ? { intent: fromModel, source: 'MODEL' } : { intent: ruleIntent, source: 'RULES' };
};
