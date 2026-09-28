import { type GraphqlClient } from 'src/modules/lv-ai/runtime/clients';

// Loads everything the intelligence layer may look at for one lead, under the
// CALLER's token — so a lead the caller cannot open yields nothing, and the
// interactions / tasks / notes / SLAs are exactly those CM-004 lets them see.
//
// Bounded on purpose: the last 12 interactions, 15 tasks, 6 notes, 20 SLAs,
// one onboarding with its documents. This is the whole universe an insight
// may cite; `sourceRecordIds` is derived from it and nothing else.

export type LeadRecord = {
  id: string;
  lvLeadId: string | null;
  name: string | null;
  organisationName: string | null;
  category: string | null;
  subcategory: string | null;
  location: string | null;
  source: string | null;
  captureMode: string | null;
  status: string | null;
  priority: string | null;
  ownerId: string | null;
  assignedAt: string | null;
  emails: { primaryEmail?: string | null } | null;
  phones: { primaryPhoneNumber?: string | null } | null;
  website: { primaryLinkUrl?: string | null } | null;
  instagram: { primaryLinkUrl?: string | null } | null;
  languages: string[] | null;
  opportunityScore: number | null;
  dataCompleteness: number | null;
  // Profile header facts the approved boards show; all optional.
  photoUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  yearsOfExperience: number | null;
  lastInteractionAt: string | null;
  nextAction: string | null;
  nextFollowUpAt: string | null;
  onboardingStatus: string | null;
  rawCaptureInput: string | null;
  duplicateKeys: string[] | null;
  jobTitle: string | null;
  socialProfiles: { primaryLinkUrl?: string | null; primaryLinkLabel?: string | null } | null;
  // Day 8: how the lead entered the CRM (method, platform, original link,
  // extraction / classification / duplicate decisions). Written once by
  // capture; never sent to the model.
  captureProvenance: Record<string, unknown> | null;
  captureFiles: { fileId: string; label?: string | null }[] | null;
  createdAt: string;
  updatedAt: string;
};

export type InteractionRecord = {
  id: string;
  name: string | null;
  channel: string | null;
  direction: string | null;
  occurredAt: string | null;
  actorId: string | null;
  purpose: string | null;
  summary: string | null;
  sentiment: string | null;
  outcome: string | null;
  objections: string | null;
  commitments: string | null;
  nextAction: string | null;
  nextFollowUpAt: string | null;
  durationMinutes: number | null;
};

export type TaskRecord = { id: string; title: string | null; status: string | null; dueAt: string | null; assigneeId: string | null; lvPriority: string | null; lvSourceInteractionId: string | null; createdAt: string };
export type NoteRecord = { id: string; title: string | null; body: string | null; updatedAt: string };
export type SlaRecord = { id: string; name: string | null; rule: string | null; status: string | null; dueAt: string | null; breachedAt: string | null; resolvedAt: string | null; escalationBlockedReason: string | null };
export type DocumentRecord = { id: string; name: string | null; documentType: string | null; verificationState: string | null; expiresAt: string | null; rejectionReason: string | null };
export type OnboardingRecord = {
  id: string;
  name: string | null;
  status: string | null;
  currentStep: string | null;
  progressPercentage: number | null;
  reviewerId: string | null;
  submittedAt: string | null;
  updatedAt: string;
  answers: Record<string, Record<string, unknown>> | null;
  documents: DocumentRecord[];
};
export type ProblemRecord = { id: string; name: string | null; problemType: string | null; severity: string | null; status: string | null };

export type LeadContext = {
  lead: LeadRecord;
  interactions: InteractionRecord[];
  tasks: TaskRecord[];
  notes: NoteRecord[];
  slas: SlaRecord[];
  onboarding: OnboardingRecord | null;
  problems: ProblemRecord[];
  loadedAt: string;
};

const LEAD_FIELDS =
  'id lvLeadId name organisationName category subcategory location source captureMode status priority ownerId assignedAt emails { primaryEmail } phones { primaryPhoneNumber } website { primaryLinkUrl } instagram { primaryLinkUrl } languages opportunityScore dataCompleteness photoUrl rating reviewCount yearsOfExperience lastInteractionAt nextAction nextFollowUpAt onboardingStatus rawCaptureInput duplicateKeys jobTitle socialProfiles { primaryLinkUrl primaryLinkLabel } captureProvenance captureFiles createdAt updatedAt';

// `summary` is a RICH_TEXT field; only its markdown is read.
const INTERACTION_FIELDS = 'id name channel direction occurredAt actorId purpose summary { markdown } sentiment outcome objections commitments nextAction nextFollowUpAt durationMinutes';

export const LIMITS = { interactions: 12, tasks: 15, notes: 6, slas: 20, documents: 20, problems: 10 } as const;

export const loadLeadContext = async (
  delegated: GraphqlClient,
  application: GraphqlClient,
  leadId: string,
): Promise<LeadContext | null> => {
  const { data } = await delegated.query<{
    lvLeads?: { edges: { node: LeadRecord }[] };
    lvInteractions?: { edges: { node: Omit<InteractionRecord, 'summary'> & { summary?: { markdown?: string | null } | null } }[] };
    taskTargets?: { edges: { node: { task?: TaskRecord | null } }[] };
    noteTargets?: { edges: { node: { note?: { id: string; title: string | null; updatedAt: string; bodyV2?: { markdown?: string | null } | null } | null } }[] };
    lvSlas?: { edges: { node: SlaRecord }[] };
    lvOnboardings?: { edges: { node: Omit<OnboardingRecord, 'documents'> & { documents?: { edges: { node: DocumentRecord }[] } } }[] };
  }>(
    `query($id: UUID!, $lead: LvLeadFilterInput!, $interaction: LvInteractionFilterInput!, $taskTarget: TaskTargetFilterInput!, $noteTarget: NoteTargetFilterInput!, $sla: LvSlaFilterInput!, $onboarding: LvOnboardingFilterInput!) {
      lvLeads(first: 1, filter: $lead) { edges { node { ${LEAD_FIELDS} } } }
      lvInteractions(first: ${LIMITS.interactions}, filter: $interaction, orderBy: [{ occurredAt: DescNullsLast }]) { edges { node { ${INTERACTION_FIELDS} } } }
      taskTargets(first: ${LIMITS.tasks}, filter: $taskTarget, orderBy: [{ createdAt: DescNullsLast }]) { edges { node { task { id title status dueAt assigneeId lvPriority lvSourceInteractionId createdAt } } } }
      noteTargets(first: ${LIMITS.notes}, filter: $noteTarget, orderBy: [{ createdAt: DescNullsLast }]) { edges { node { note { id title updatedAt bodyV2 { markdown } } } } }
      lvSlas(first: ${LIMITS.slas}, filter: $sla, orderBy: [{ startedAt: DescNullsLast }]) { edges { node { id name rule status dueAt breachedAt resolvedAt escalationBlockedReason } } }
      lvOnboardings(first: 1, filter: $onboarding, orderBy: [{ createdAt: DescNullsLast }]) { edges { node { id name status currentStep progressPercentage reviewerId submittedAt updatedAt answers documents(first: ${LIMITS.documents}) { edges { node { id name documentType verificationState expiresAt rejectionReason } } } } } }
    }`,
    {
      id: leadId,
      lead: { id: { eq: leadId } },
      interaction: { leadId: { eq: leadId } },
      taskTarget: { targetLvLeadId: { eq: leadId } },
      noteTarget: { targetLvLeadId: { eq: leadId } },
      sla: { leadId: { eq: leadId } },
      onboarding: { leadId: { eq: leadId } },
    },
  );

  const lead = data.lvLeads?.edges?.[0]?.node;

  if (!lead) {
    return null;
  }

  const onboardingNode = data.lvOnboardings?.edges?.[0]?.node ?? null;
  const onboarding: OnboardingRecord | null = onboardingNode
    ? { ...onboardingNode, documents: (onboardingNode.documents?.edges ?? []).map((edge) => edge.node) }
    : null;

  // Problems are not readable by team roles directly (no CM-004 scoping on
  // the object); read them with the application role, but ONLY for the lead
  // the caller has just proven they can open.
  let problems: ProblemRecord[] = [];

  try {
    const { data: problemData } = await application.query<{ lvProblems?: { edges: { node: ProblemRecord }[] } }>(
      `query($filter: LvProblemFilterInput) { lvProblems(first: ${LIMITS.problems}, filter: $filter, orderBy: [{ createdAt: DescNullsLast }]) { edges { node { id name problemType severity status } } } }`,
      { filter: { leadId: { eq: leadId } } },
    );

    problems = (problemData.lvProblems?.edges ?? []).map((edge) => edge.node);
  } catch {
    problems = [];
  }

  return {
    lead,
    interactions: (data.lvInteractions?.edges ?? []).map((edge) => ({ ...edge.node, summary: edge.node.summary?.markdown ?? null })),
    tasks: (data.taskTargets?.edges ?? []).map((edge) => edge.node.task).filter((task): task is TaskRecord => Boolean(task)),
    notes: (data.noteTargets?.edges ?? [])
      .map((edge) => edge.node.note)
      .filter((note): note is NonNullable<typeof note> => Boolean(note))
      .map((note) => ({ id: note.id, title: note.title, body: note.bodyV2?.markdown ?? null, updatedAt: note.updatedAt })),
    slas: (data.lvSlas?.edges ?? []).map((edge) => edge.node),
    onboarding,
    problems,
    loadedAt: new Date().toISOString(),
  };
};

export const sourceRecordIds = (context: LeadContext): string[] => [
  context.lead.id,
  ...context.interactions.map((row) => row.id),
  ...context.tasks.map((row) => row.id),
  ...context.notes.map((row) => row.id),
  ...context.slas.map((row) => row.id),
  ...(context.onboarding ? [context.onboarding.id, ...context.onboarding.documents.map((row) => row.id)] : []),
  ...context.problems.map((row) => row.id),
];

export const leadLabel = (lead: Pick<LeadRecord, 'lvLeadId' | 'name'>): string =>
  [lead.lvLeadId, lead.name].filter((part): part is string => Boolean(part)).join(' ') || 'this lead';
