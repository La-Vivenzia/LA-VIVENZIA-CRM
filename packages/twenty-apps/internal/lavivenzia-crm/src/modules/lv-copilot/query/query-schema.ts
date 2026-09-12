import { LEAD_CATEGORIES, LEAD_SOURCES } from 'src/modules/lv-core/constants/lead-taxonomy';
import { LEAD_PRIORITIES, LEAD_STATUSES } from 'src/modules/lv-core/constants/lead-lifecycle';
import { INTERACTION_DIRECTIONS } from 'src/modules/lv-interactions/constants/interaction-direction';
import { INTERACTION_CHANNELS, INTERACTION_OUTCOMES } from 'src/modules/lv-interactions/constants/interaction-vocabulary';
import { ONBOARDING_STATUSES } from 'src/modules/lv-onboarding/constants/onboarding-status';
import { DOCUMENT_VERIFICATION_STATES } from 'src/modules/lv-onboarding/constants/document-verification';
import { SLA_RULES, SLA_STATUSES } from 'src/modules/lv-sla/constants/sla-rules';

// The Copilot's allowlisted query schema. A plan may only name what is here:
// these objects, these fields, these operators, these sort fields, a limit of
// at most 25. Nothing else is expressible — no joins, no raw filters, no
// arbitrary GraphQL, and certainly no SQL. Owner / assignee / reviewer filters
// accept only the sentinel "me" (resolved server-side to the caller) or
// "none"; a client can never name another member.

export const COPILOT_OBJECTS = ['lead', 'task', 'interaction', 'onboarding', 'document', 'sla'] as const;

export type CopilotObject = (typeof COPILOT_OBJECTS)[number];

export const OPERATORS = ['eq', 'neq', 'in', 'gt', 'gte', 'lt', 'lte', 'is_null', 'is_not_null', 'contains'] as const;

export type Operator = (typeof OPERATORS)[number];

export type FieldKind = 'enum' | 'text' | 'number' | 'date' | 'member' | 'bool' | 'composite_text';

export type FieldSpec = {
  kind: FieldKind;
  graphql: string; // GraphQL filter field path
  values?: readonly string[]; // enum vocabulary
  sortable?: boolean;
  // For composite_text: the sub-field used in the filter.
  sub?: string;
};

export type ObjectSpec = {
  plural: string;
  type: string;
  label: string;
  selection: string;
  fields: Record<string, FieldSpec>;
  defaultSort: { field: string; direction: 'asc' | 'desc' };
  refField: string | null; // human ref, e.g. lvLeadId
};

const PRIORITIES = LEAD_PRIORITIES;
const CATEGORIES = LEAD_CATEGORIES;
const SOURCES = LEAD_SOURCES;
const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
const CHANNELS = INTERACTION_CHANNELS;
const DIRECTIONS = INTERACTION_DIRECTIONS;
const OUTCOMES = INTERACTION_OUTCOMES;
const DOC_STATES = DOCUMENT_VERIFICATION_STATES;

export const SCHEMA: Record<CopilotObject, ObjectSpec> = {
  lead: {
    plural: 'lvLeads',
    type: 'LvLead',
    label: 'lead',
    selection: 'id lvLeadId name organisationName status priority category location source ownerId nextAction nextFollowUpAt lastInteractionAt opportunityScore createdAt',
    refField: 'lvLeadId',
    defaultSort: { field: 'updatedAt', direction: 'desc' },
    fields: {
      status: { kind: 'enum', graphql: 'status', values: LEAD_STATUSES, sortable: true },
      priority: { kind: 'enum', graphql: 'priority', values: PRIORITIES, sortable: true },
      category: { kind: 'enum', graphql: 'category', values: CATEGORIES },
      source: { kind: 'enum', graphql: 'source', values: SOURCES },
      location: { kind: 'text', graphql: 'location' },
      name: { kind: 'text', graphql: 'name' },
      organisationName: { kind: 'text', graphql: 'organisationName' },
      lvLeadId: { kind: 'text', graphql: 'lvLeadId' },
      owner: { kind: 'member', graphql: 'ownerId' },
      nextAction: { kind: 'text', graphql: 'nextAction' },
      nextFollowUpAt: { kind: 'date', graphql: 'nextFollowUpAt', sortable: true },
      lastInteractionAt: { kind: 'date', graphql: 'lastInteractionAt', sortable: true },
      createdAt: { kind: 'date', graphql: 'createdAt', sortable: true },
      updatedAt: { kind: 'date', graphql: 'updatedAt', sortable: true },
      opportunityScore: { kind: 'number', graphql: 'opportunityScore', sortable: true },
      email: { kind: 'composite_text', graphql: 'emails', sub: 'primaryEmail' },
      phone: { kind: 'composite_text', graphql: 'phones', sub: 'primaryPhoneNumber' },
    },
  },
  task: {
    plural: 'tasks',
    type: 'Task',
    label: 'follow-up task',
    selection: 'id title status dueAt assigneeId lvPriority createdAt taskTargets { edges { node { targetLvLeadId } } }',
    refField: null,
    defaultSort: { field: 'dueAt', direction: 'asc' },
    fields: {
      status: { kind: 'enum', graphql: 'status', values: TASK_STATUSES, sortable: true },
      title: { kind: 'text', graphql: 'title' },
      dueAt: { kind: 'date', graphql: 'dueAt', sortable: true },
      assignee: { kind: 'member', graphql: 'assigneeId' },
      priority: { kind: 'enum', graphql: 'lvPriority', values: PRIORITIES },
      createdAt: { kind: 'date', graphql: 'createdAt', sortable: true },
    },
  },
  interaction: {
    plural: 'lvInteractions',
    type: 'LvInteraction',
    label: 'interaction',
    selection: 'id name channel direction outcome sentiment occurredAt leadId actorId nextAction nextFollowUpAt',
    refField: null,
    defaultSort: { field: 'occurredAt', direction: 'desc' },
    fields: {
      channel: { kind: 'enum', graphql: 'channel', values: CHANNELS },
      direction: { kind: 'enum', graphql: 'direction', values: DIRECTIONS },
      outcome: { kind: 'enum', graphql: 'outcome', values: OUTCOMES },
      occurredAt: { kind: 'date', graphql: 'occurredAt', sortable: true },
      actor: { kind: 'member', graphql: 'actorId' },
      leadId: { kind: 'text', graphql: 'leadId' },
    },
  },
  onboarding: {
    plural: 'lvOnboardings',
    type: 'LvOnboarding',
    label: 'onboarding',
    selection: 'id name status currentStep progressPercentage reviewerId leadId submittedAt updatedAt',
    refField: null,
    defaultSort: { field: 'updatedAt', direction: 'desc' },
    fields: {
      status: { kind: 'enum', graphql: 'status', values: ONBOARDING_STATUSES, sortable: true },
      reviewer: { kind: 'member', graphql: 'reviewerId' },
      updatedAt: { kind: 'date', graphql: 'updatedAt', sortable: true },
      submittedAt: { kind: 'date', graphql: 'submittedAt', sortable: true },
      progressPercentage: { kind: 'number', graphql: 'progressPercentage', sortable: true },
    },
  },
  document: {
    plural: 'lvOnboardingDocuments',
    type: 'LvOnboardingDocument',
    label: 'onboarding document',
    selection: 'id name documentType verificationState expiresAt onboardingId reviewerId uploadedAt',
    refField: null,
    defaultSort: { field: 'uploadedAt', direction: 'desc' },
    fields: {
      verificationState: { kind: 'enum', graphql: 'verificationState', values: DOC_STATES, sortable: true },
      documentType: { kind: 'text', graphql: 'documentType' },
      expiresAt: { kind: 'date', graphql: 'expiresAt', sortable: true },
      uploadedAt: { kind: 'date', graphql: 'uploadedAt', sortable: true },
      reviewer: { kind: 'member', graphql: 'reviewerId' },
    },
  },
  sla: {
    plural: 'lvSlas',
    type: 'LvSla',
    label: 'SLA',
    selection: 'id name rule status dueAt breachedAt leadId onboardingId ownerId',
    refField: null,
    defaultSort: { field: 'dueAt', direction: 'asc' },
    fields: {
      status: { kind: 'enum', graphql: 'status', values: SLA_STATUSES, sortable: true },
      rule: { kind: 'enum', graphql: 'rule', values: SLA_RULES },
      dueAt: { kind: 'date', graphql: 'dueAt', sortable: true },
      owner: { kind: 'member', graphql: 'ownerId' },
    },
  },
};

export const MAX_LIMIT = 25;
export const DEFAULT_LIMIT = 10;

export type PlanFilter = { field: string; operator: Operator; value: unknown };

export type QueryPlan = {
  object: CopilotObject;
  filters: PlanFilter[];
  sort: { field: string; direction: 'asc' | 'desc' } | null;
  limit: number;
};

// The schema as text for the intent prompt — the model sees only this.
export const schemaForPrompt = (): string =>
  COPILOT_OBJECTS.map((object) => {
    const spec = SCHEMA[object];
    const fields = Object.entries(spec.fields)
      .map(([name, field]) => `${name} (${field.kind}${field.values ? `: ${field.values.join('|')}` : field.kind === 'member' ? ': "me" | "none"' : ''})`)
      .join(', ');

    return `- ${object}: ${fields}`;
  })
    .concat([
      `Operators: ${OPERATORS.join(', ')}. Dates accept ISO dates or the words today, yesterday, tomorrow, "7d" (7 days ago), "-7d". Limit ≤ ${MAX_LIMIT}.`,
      'Actions (intent ACTION): kind CREATE_TASK {recordRef: lead ref like LV-000003, dueIn: "today"|"tomorrow"|"3d", title}; kind ADD_NOTE {recordRef, title}; anything else (delete, merge, approve, reject, reassign, change owner, send) → kind UNSUPPORTED_ACTION.',
    ])
    .join('\n');
