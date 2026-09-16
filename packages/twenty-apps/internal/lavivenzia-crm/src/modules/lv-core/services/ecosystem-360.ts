import { type CoreApiClient } from 'twenty-client-sdk/core';

import { LISTING_STATUS_LABELS, LISTING_TRANSITIONS, type ListingStatus, PARTNER_STATUS_LABELS, PARTNER_TRANSITIONS, type PartnerStatus, isListingStatus, isPartnerStatus } from 'src/modules/lv-core/constants/ecosystem-lifecycle';
import { type Readiness } from 'src/modules/lv-core/services/activation-readiness';
import { type AuditRow, type EcosystemCapabilities, type ListingRecord, type MemberRef, type OnboardingRef, type PartnerRecord, capabilitiesFor, listingReadiness, loadAuditFor, loadListing, loadListingsForPartner, loadMembers, loadOnboardingWithDocuments, loadPartner, partnerReadiness } from 'src/modules/lv-core/services/ecosystem-service';
import { type CallerContext } from 'src/modules/lv-dashboard/services/caller-context';
import { type DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';
import { ONBOARDING_STEP_LABELS, type OnboardingStep } from 'src/modules/lv-onboarding/constants/onboarding-steps';
import { completedSteps, missingInformation, type OnboardingData } from 'src/modules/lv-onboarding/utils/validate-onboarding';

// One request builds a whole Partner / Experience / Property 360. Records are
// read as the caller (object permissions; CM-004 for the lead, onboarding and
// documents the page reaches into), the readiness engine runs on them without
// persisting anything, and the caller's own permissions decide which actions
// the page may offer. Health and scores appear only where deterministic
// inputs exist — otherwise the model says so (`null` + a reason), never a
// number.

export type TimelineEntry = { id: string; kind: 'CREATED' | 'AUDIT' | 'ONBOARDING' | 'DOCUMENT' | 'INTERACTION' | 'ASSIGNMENT' | 'STATUS'; at: string; title: string; detail: string | null; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'; actor: MemberRef | null; target: { object: string; recordId: string } | null };

export type DocumentView = { id: string; name: string | null; documentType: string | null; verificationState: string | null; expiresAt: string | null; rejectionReason: string | null; verifiedAt: string | null; bucket: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'EXPIRED' };

export type OnboardingView = {
  id: string;
  status: string | null;
  currentStep: string | null;
  currentStepLabel: string | null;
  progressPercentage: number;
  healthScore: number | null;
  reviewer: MemberRef | null;
  decisionReason: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  activatedAt: string | null;
  completedSteps: string[];
  incompleteSteps: string[];
  missing: { step: string; stepLabel: string; field: string; label: string; message: string }[];
};

export type ListingSummary = { id: string; code: string | null; name: string | null; status: string | null; statusLabel: string; location: string | null; capacity: number | null; category: string | null; propertyType: string | null; owner: MemberRef | null; readiness: Readiness };

export type LeadRef = { id: string; lvLeadId: string | null; name: string | null; status: string | null; source: string | null; captureMode: string | null; ownerId: string | null; lastInteractionAt: string | null; nextAction: string | null; nextFollowUpAt: string | null; relationshipHealth: number | null; createdAt: string };

export type Partner360Model = {
  ok: true;
  now: string;
  partner: PartnerRecord & { owner: MemberRef | null; statusLabel: string };
  contact: { id: string; name: string | null; email: string | null; phone: string | null; city: string | null } | null;
  organisation: { id: string; name: string | null; domain: string | null; city: string | null } | null;
  lead: LeadRef | null;
  onboarding: OnboardingView | null;
  documents: DocumentView[];
  experiences: ListingSummary[];
  properties: ListingSummary[];
  readiness: Readiness;
  // Deterministic when the lead's Day 6 health exists; otherwise null with why.
  relationshipHealth: { value: number | null; reason: string | null };
  partnerHealth: { value: number | null; reason: string };
  interactions: { id: string; channel: string | null; occurredAt: string | null; summary: string | null; outcome: string | null; actor: MemberRef | null }[];
  tasks: { id: string; title: string | null; status: string | null; dueAt: string | null; assignee: MemberRef | null }[];
  notes: { id: string; title: string | null; updatedAt: string }[];
  timeline: TimelineEntry[];
  audit: (AuditRow & { actor: MemberRef | null })[];
  caller: { workspaceMemberId: string; isAdmin: boolean };
  capabilities: EcosystemCapabilities;
  settableStatuses: { value: string; label: string; governed: boolean }[];
  members: MemberRef[];
};

const bucketOf = (document: { verificationState: string | null; expiresAt: string | null }, now: string): DocumentView['bucket'] => {
  if (document.verificationState === 'REJECTED' || document.verificationState === 'NEEDS_REPLACEMENT') {
    return 'REJECTED';
  }

  if (document.verificationState === 'EXPIRED' || (document.expiresAt !== null && document.expiresAt <= now)) {
    return 'EXPIRED';
  }

  if (document.verificationState === 'VERIFIED' || document.verificationState === 'APPROVED') {
    return 'VERIFIED';
  }

  return 'PENDING';
};

export const onboardingView = (onboarding: OnboardingRef | null, members: Map<string, MemberRef>): OnboardingView | null => {
  if (!onboarding) {
    return null;
  }

  const data = (onboarding.answers ?? {}) as OnboardingData;
  const done = completedSteps(data);
  const missing = missingInformation(data);
  const steps = Object.keys(ONBOARDING_STEP_LABELS) as OnboardingStep[];

  return {
    id: onboarding.id,
    status: onboarding.status,
    currentStep: onboarding.currentStep,
    currentStepLabel: onboarding.currentStep ? (ONBOARDING_STEP_LABELS[onboarding.currentStep as OnboardingStep] ?? onboarding.currentStep) : null,
    progressPercentage: onboarding.progressPercentage ?? Math.round((done.length / Math.max(1, steps.length - 1)) * 100),
    healthScore: onboarding.healthScore ?? null,
    reviewer: onboarding.reviewerId ? (members.get(onboarding.reviewerId) ?? { id: onboarding.reviewerId, displayName: null, email: null }) : null,
    decisionReason: onboarding.decisionReason,
    submittedAt: onboarding.submittedAt,
    decidedAt: onboarding.decidedAt,
    activatedAt: onboarding.activatedAt,
    completedSteps: [...done],
    incompleteSteps: steps.filter((step) => step !== 'FINAL_REVIEW' && !done.includes(step)),
    missing: missing.map((item) => ({ step: item.step, stepLabel: ONBOARDING_STEP_LABELS[item.step] ?? item.step, field: item.fieldKey, label: item.label, message: item.reason === 'EMPTY' ? 'Not provided' : item.reason === 'TOO_SHORT' ? 'Too short' : item.reason === 'TOO_FEW' ? 'Too few items' : 'Invalid' })),
  };
};

const listingSummary = (kind: 'experience' | 'property', row: ListingRecord, partner: PartnerRecord | null, members: Map<string, MemberRef>, now: string): ListingSummary => ({
  id: row.id,
  code: row.code,
  name: row.name,
  status: row.status,
  statusLabel: isListingStatus(row.status) ? LISTING_STATUS_LABELS[row.status] : (row.status ?? 'Draft'),
  location: row.location,
  capacity: row.capacity,
  category: row.category,
  propertyType: row.propertyType,
  owner: row.ownerId ? (members.get(row.ownerId) ?? null) : null,
  readiness: listingReadiness({ kind, listing: row, partner, now }),
});

const toneForAudit = (action: string, outcome: string | null): TimelineEntry['tone'] => (outcome === 'REFUSED' ? 'danger' : /CREATED|APPROV|READINESS/.test(action) ? 'success' : /SUSPEND|REJECT|EXPIRED|OFFBOARD/.test(action) ? 'warning' : 'info');

const humanise = (value: string): string => value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());

export const buildTimeline = ({ created, audit, onboarding, documents, interactions, members }: { created: { id: string; at: string; title: string; detail: string | null }; audit: AuditRow[]; onboarding: OnboardingView | null; documents: DocumentView[]; interactions: Partner360Model['interactions']; members: Map<string, MemberRef> }): TimelineEntry[] => {
  const entries: TimelineEntry[] = [{ id: `created-${created.id}`, kind: 'CREATED', at: created.at, title: created.title, detail: created.detail, tone: 'neutral', actor: null, target: null }];

  for (const row of audit) {
    if (!row.at) {
      continue;
    }

    const meta = row.metadata ?? {};
    const detail = [row.reason, typeof meta.from === 'string' && typeof meta.to === 'string' ? `${humanise(meta.from)} → ${humanise(meta.to)}` : null, typeof meta.code === 'string' ? meta.code : null].filter(Boolean).join(' · ') || null;

    entries.push({ id: `audit-${row.id}`, kind: /STATUS_CHANGE/.test(row.action) ? 'STATUS' : /OWNER/.test(row.action) ? 'ASSIGNMENT' : 'AUDIT', at: row.at, title: `${humanise(row.action)}${row.outcome && row.outcome !== 'APPLIED' ? ` (${row.outcome.toLowerCase()})` : ''}`, detail, tone: toneForAudit(row.action, row.outcome), actor: row.actorId ? (members.get(row.actorId) ?? null) : null, target: null });
  }

  if (onboarding) {
    if (onboarding.submittedAt) {
      entries.push({ id: `onb-submitted-${onboarding.id}`, kind: 'ONBOARDING', at: onboarding.submittedAt, title: 'Onboarding submitted for review', detail: null, tone: 'info', actor: null, target: { object: 'lvOnboarding', recordId: onboarding.id } });
    }

    if (onboarding.decidedAt) {
      entries.push({ id: `onb-decided-${onboarding.id}`, kind: 'ONBOARDING', at: onboarding.decidedAt, title: `Onboarding ${(onboarding.status ?? 'decided').toLowerCase().replace(/_/g, ' ')}`, detail: onboarding.decisionReason, tone: onboarding.status === 'REJECTED' ? 'danger' : 'success', actor: onboarding.reviewer, target: { object: 'lvOnboarding', recordId: onboarding.id } });
    }

    if (onboarding.activatedAt) {
      entries.push({ id: `onb-activated-${onboarding.id}`, kind: 'ONBOARDING', at: onboarding.activatedAt, title: 'Onboarding activated', detail: null, tone: 'success', actor: null, target: { object: 'lvOnboarding', recordId: onboarding.id } });
    }
  }

  for (const document of documents) {
    if (document.verifiedAt) {
      entries.push({ id: `doc-${document.id}`, kind: 'DOCUMENT', at: document.verifiedAt, title: `Document ${document.bucket.toLowerCase()}: ${document.name ?? document.documentType ?? 'document'}`, detail: document.rejectionReason, tone: document.bucket === 'VERIFIED' ? 'success' : document.bucket === 'REJECTED' ? 'danger' : 'warning', actor: null, target: { object: 'lvOnboardingDocument', recordId: document.id } });
    }
  }

  for (const interaction of interactions) {
    if (interaction.occurredAt) {
      entries.push({ id: `int-${interaction.id}`, kind: 'INTERACTION', at: interaction.occurredAt, title: `${humanise(interaction.channel ?? 'interaction')}${interaction.outcome ? ` · ${humanise(interaction.outcome)}` : ''}`, detail: interaction.summary, tone: 'neutral', actor: interaction.actor, target: { object: 'lvInteraction', recordId: interaction.id } });
    }
  }

  return entries.sort((left, right) => (left.at < right.at ? 1 : left.at > right.at ? -1 : 0)).slice(0, 40);
};

type LeadRow = LeadRef & { interactionsRaw?: unknown };

const loadLeadRef = async (delegated: DelegatedGraphqlClient, leadId: string | null): Promise<{ lead: LeadRef | null; interactions: Partner360Model['interactions']; tasks: Partner360Model['tasks']; notes: Partner360Model['notes'] }> => {
  if (!leadId) {
    return { lead: null, interactions: [], tasks: [], notes: [] };
  }

  const { data } = await delegated.query<{ lvLead?: LeadRow | null; lvInteractions?: { edges: { node: { id: string; channel: string | null; occurredAt: string | null; summary: { markdown?: string | null } | null; outcome: string | null; actorId: string | null } }[] }; taskTargets?: { edges: { node: { task: { id: string; title: string | null; status: string | null; dueAt: string | null; assigneeId: string | null } | null } }[] }; noteTargets?: { edges: { node: { note: { id: string; title: string | null; updatedAt: string } | null } }[] } }>(
    `query($id: UUID!) {
      lvLead(filter: { id: { eq: $id } }) { id lvLeadId name status source captureMode ownerId lastInteractionAt nextAction nextFollowUpAt relationshipHealth createdAt }
      lvInteractions(first: 10, filter: { leadId: { eq: $id } }, orderBy: [{ occurredAt: DescNullsLast }]) { edges { node { id channel occurredAt summary { markdown } outcome actorId } } }
      taskTargets(first: 10, filter: { targetLvLeadId: { eq: $id } }) { edges { node { task { id title status dueAt assigneeId } } } }
      noteTargets(first: 6, filter: { targetLvLeadId: { eq: $id } }) { edges { node { note { id title updatedAt } } } }
    }`,
    { id: leadId },
  );

  return {
    lead: data.lvLead ?? null,
    interactions: (data.lvInteractions?.edges ?? []).map(({ node }) => ({ id: node.id, channel: node.channel, occurredAt: node.occurredAt, summary: node.summary?.markdown ?? null, outcome: node.outcome, actor: null, actorId: node.actorId })) as unknown as Partner360Model['interactions'],
    tasks: (data.taskTargets?.edges ?? []).map(({ node }) => node.task).filter((task): task is NonNullable<typeof task> => task !== null).map((task) => ({ id: task.id, title: task.title, status: task.status, dueAt: task.dueAt, assignee: null, assigneeId: task.assigneeId })) as unknown as Partner360Model['tasks'],
    notes: (data.noteTargets?.edges ?? []).map(({ node }) => node.note).filter((note): note is NonNullable<typeof note> => note !== null),
  };
};

const settable = <S extends string>(table: Record<S, readonly S[]>, labels: Record<S, string>, governed: readonly S[], from: S): { value: string; label: string; governed: boolean }[] => table[from].map((status) => ({ value: status, label: labels[status], governed: governed.includes(status) }));

export const composePartner360 = async ({ delegated, application, caller, partnerId, now }: { delegated: DelegatedGraphqlClient; application: CoreApiClient; caller: CallerContext & { workspaceMemberId: string }; partnerId: string; now: string }): Promise<Partner360Model | { ok: false; refusal: 'NOT_FOUND'; error: string }> => {
  const partner = await loadPartner(delegated, partnerId);

  if (!partner || partner.deletedAt) {
    return { ok: false, refusal: 'NOT_FOUND', error: 'Partner not found.' };
  }

  const [members, { onboarding, documents }, experiencesRaw, propertiesRaw, leadBundle, contactRow, organisationRow] = await Promise.all([
    loadMembers(delegated),
    loadOnboardingWithDocuments(delegated, partner.onboardingId),
    loadListingsForPartner(delegated, 'experience', partner.id),
    loadListingsForPartner(delegated, 'property', partner.id),
    loadLeadRef(delegated, partner.leadId),
    partner.contactId ? delegated.query<{ person?: { id: string; name: { firstName: string | null; lastName: string | null } | null; emails: { primaryEmail: string | null } | null; phones: { primaryPhoneNumber: string | null } | null } | null }>(`query($id: UUID!) { person(filter: { id: { eq: $id } }) { id name { firstName lastName } emails { primaryEmail } phones { primaryPhoneNumber } } }`, { id: partner.contactId }).then((result) => result.data.person ?? null).catch(() => null) : Promise.resolve(null),
    partner.organisationId ? delegated.query<{ company?: { id: string; name: string | null; domainName: { primaryLinkUrl: string | null } | null; address: { addressCity: string | null } | null } | null }>(`query($id: UUID!) { company(filter: { id: { eq: $id } }) { id name domainName { primaryLinkUrl } address { addressCity } } }`, { id: partner.organisationId }).then((result) => result.data.company ?? null).catch(() => null) : Promise.resolve(null),
  ]);
  const listingIds = [...experiencesRaw.map((row) => row.id), ...propertiesRaw.map((row) => row.id)];
  const audit = await loadAuditFor(application, [partner.id, ...listingIds, ...(partner.onboardingId ? [partner.onboardingId] : [])]);
  const member = (id: string | null | undefined): MemberRef | null => (id ? (members.get(id) ?? null) : null);
  const docs: DocumentView[] = documents.map((document) => ({ ...document, bucket: bucketOf(document, now) }));
  const onboardingModel = onboardingView(onboarding, members);
  const experiences = experiencesRaw.map((row) => listingSummary('experience', row, partner, members, now));
  const properties = propertiesRaw.map((row) => listingSummary('property', row, partner, members, now));
  const readiness = partnerReadiness({ partner, onboarding, documents, experiences: experiencesRaw, properties: propertiesRaw, now });
  const interactions = leadBundle.interactions.map((row) => ({ ...row, actor: member((row as unknown as { actorId: string | null }).actorId) }));
  const tasks = leadBundle.tasks.map((row) => ({ ...row, assignee: member((row as unknown as { assigneeId: string | null }).assigneeId) }));
  const status: PartnerStatus = isPartnerStatus(partner.status) ? partner.status : 'PROSPECTIVE';

  return {
    ok: true,
    now,
    partner: { ...partner, owner: member(partner.ownerId), statusLabel: PARTNER_STATUS_LABELS[status] },
    contact: contactRow ? { id: contactRow.id, name: [contactRow.name?.firstName, contactRow.name?.lastName].filter(Boolean).join(' ') || null, email: contactRow.emails?.primaryEmail ?? null, phone: contactRow.phones?.primaryPhoneNumber ?? null, city: null } : null,
    organisation: organisationRow ? { id: organisationRow.id, name: organisationRow.name, domain: organisationRow.domainName?.primaryLinkUrl ?? null, city: organisationRow.address?.addressCity ?? null } : null,
    lead: leadBundle.lead,
    onboarding: onboardingModel,
    documents: docs,
    experiences,
    properties,
    readiness,
    relationshipHealth: leadBundle.lead ? { value: leadBundle.lead.relationshipHealth, reason: leadBundle.lead.relationshipHealth === null ? 'The lead has no relationship-health score yet (needs interactions).' : null } : { value: null, reason: 'No lead is linked; relationship health is computed on the lead from its interactions.' },
    // Partner health (Founder §51) needs revenue, repeat guests and complaints — data the CRM does not hold yet.
    partnerHealth: { value: null, reason: 'Not available: partner health needs bookings, revenue and complaint data the CRM does not yet record. Nothing is estimated.' },
    interactions,
    tasks,
    notes: leadBundle.notes,
    timeline: buildTimeline({ created: { id: partner.id, at: partner.createdAt, title: 'Partner created', detail: partner.provenance && typeof partner.provenance.source === 'string' ? (partner.provenance.source === 'ONBOARDING_APPROVED' ? `From approved onboarding${partner.provenance.lvLeadId ? ` of ${partner.provenance.lvLeadId}` : ''}` : 'Created by hand') : null }, audit, onboarding: onboardingModel, documents: docs, interactions, members }),
    audit: audit.map((row) => ({ ...row, actor: member(row.actorId) })),
    caller: { workspaceMemberId: caller.workspaceMemberId, isAdmin: caller.isAdmin },
    capabilities: capabilitiesFor(caller, 'partner', partner),
    settableStatuses: settable(PARTNER_TRANSITIONS, PARTNER_STATUS_LABELS, ['ACTIVE', 'SUSPENDED', 'OFFBOARDED'], status),
    members: [...members.values()],
  };
};

export type Listing360Model = {
  ok: true;
  now: string;
  kind: 'experience' | 'property';
  listing: ListingRecord & { owner: MemberRef | null; reviewer: MemberRef | null; statusLabel: string };
  partner: (Pick<PartnerRecord, 'id' | 'name' | 'partnerCode' | 'status' | 'category' | 'location' | 'ownerId' | 'emails' | 'phones'> & { owner: MemberRef | null; statusLabel: string }) | null;
  host: { id: string; name: string | null; email: string | null; phone: string | null } | null;
  onboarding: OnboardingView | null;
  documents: DocumentView[];
  readiness: Readiness;
  quality: { value: number | null; reason: string };
  timeline: TimelineEntry[];
  audit: (AuditRow & { actor: MemberRef | null })[];
  caller: { workspaceMemberId: string; isAdmin: boolean };
  capabilities: EcosystemCapabilities;
  settableStatuses: { value: string; label: string; governed: boolean }[];
  members: MemberRef[];
};

export const composeListing360 = async ({ delegated, application, caller, kind, id, now }: { delegated: DelegatedGraphqlClient; application: CoreApiClient; caller: CallerContext & { workspaceMemberId: string }; kind: 'experience' | 'property'; id: string; now: string }): Promise<Listing360Model | { ok: false; refusal: 'NOT_FOUND'; error: string }> => {
  const listing = await loadListing(delegated, kind, id);

  if (!listing || listing.deletedAt) {
    return { ok: false, refusal: 'NOT_FOUND', error: `${kind === 'experience' ? 'Experience' : 'Property'} not found.` };
  }

  const personId = kind === 'experience' ? listing.hostId : listing.managerId;
  const [members, partner, { onboarding, documents }, hostRow] = await Promise.all([
    loadMembers(delegated),
    listing.partnerId ? loadPartner(delegated, listing.partnerId) : Promise.resolve(null),
    loadOnboardingWithDocuments(delegated, listing.onboardingId),
    personId ? delegated.query<{ person?: { id: string; name: { firstName: string | null; lastName: string | null } | null; emails: { primaryEmail: string | null } | null; phones: { primaryPhoneNumber: string | null } | null } | null }>(`query($id: UUID!) { person(filter: { id: { eq: $id } }) { id name { firstName lastName } emails { primaryEmail } phones { primaryPhoneNumber } } }`, { id: personId }).then((result) => result.data.person ?? null).catch(() => null) : Promise.resolve(null),
  ]);
  const audit = await loadAuditFor(application, [listing.id]);
  const member = (memberId: string | null | undefined): MemberRef | null => (memberId ? (members.get(memberId) ?? null) : null);
  const docs: DocumentView[] = documents.map((document) => ({ ...document, bucket: bucketOf(document, now) }));
  const onboardingModel = onboardingView(onboarding, members);
  const status: ListingStatus = isListingStatus(listing.status) ? listing.status : 'DRAFT';
  const partnerStatus: PartnerStatus = partner && isPartnerStatus(partner.status) ? partner.status : 'PROSPECTIVE';

  return {
    ok: true,
    now,
    kind,
    listing: { ...listing, owner: member(listing.ownerId), reviewer: member(listing.reviewerId), statusLabel: LISTING_STATUS_LABELS[status] },
    partner: partner ? { id: partner.id, name: partner.name, partnerCode: partner.partnerCode, status: partner.status, category: partner.category, location: partner.location, ownerId: partner.ownerId, emails: partner.emails, phones: partner.phones, owner: member(partner.ownerId), statusLabel: PARTNER_STATUS_LABELS[partnerStatus] } : null,
    host: hostRow ? { id: hostRow.id, name: [hostRow.name?.firstName, hostRow.name?.lastName].filter(Boolean).join(' ') || null, email: hostRow.emails?.primaryEmail ?? null, phone: hostRow.phones?.primaryPhoneNumber ?? null } : null,
    onboarding: onboardingModel,
    documents: docs,
    readiness: listingReadiness({ kind, listing, partner, now }),
    quality: { value: null, reason: 'Not available: quality needs guest feedback and operational data the CRM does not yet record. Readiness (below) is the deterministic check that exists.' },
    timeline: buildTimeline({ created: { id: listing.id, at: listing.createdAt, title: `${kind === 'experience' ? 'Experience' : 'Property'} created`, detail: listing.sourceKey?.startsWith('onboarding:') ? 'From the approved onboarding' : 'Created by hand' }, audit, onboarding: null, documents: [], interactions: [], members }),
    audit: audit.map((row) => ({ ...row, actor: member(row.actorId) })),
    caller: { workspaceMemberId: caller.workspaceMemberId, isAdmin: caller.isAdmin },
    capabilities: capabilitiesFor(caller, kind, listing),
    settableStatuses: settable(LISTING_TRANSITIONS, LISTING_STATUS_LABELS, ['READY', 'LIVE', 'SUSPENDED', 'RETIRED'], status),
    members: [...members.values()],
  };
};
