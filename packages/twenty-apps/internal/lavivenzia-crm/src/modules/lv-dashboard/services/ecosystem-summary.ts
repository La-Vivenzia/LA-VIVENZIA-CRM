import { type Kpi, type ListSection } from 'src/modules/lv-dashboard/services/dashboard-summary';
import { type DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';
import { OBJECTS, QueryBatch } from 'src/modules/lv-dashboard/services/query-batch';

// Ecosystem metrics for the Control Tower and the administrator dashboard —
// partners, experiences, properties and the onboarding pipeline that feeds
// them. Every number is a database aggregation over the real objects; the
// queries run delegated, so the caller sees what Twenty lets them see.
//
// "Not active" for listings is a status fact (not yet LIVE), not the
// readiness engine: running the deterministic check over every record would
// be a query per record. The 360 pages run it per record where it belongs.

export type EcosystemSummary = {
  partners: Kpi[];
  experiences: Kpi[];
  properties: Kpi[];
  onboarding: Kpi[];
  sections: ListSection<Record<string, unknown>>[];
  partial: string[];
};

const LIST = 10;
const LISTING_SELECTION = 'id name status location ownerId partnerId createdAt updatedAt';
const PARTNER_SELECTION = 'id name partnerCode status category location ownerId createdAt updatedAt';

export const buildEcosystemSummary = async (client: DelegatedGraphqlClient, now: string): Promise<EcosystemSummary> => {
  // One root resolver per request is the platform's packing rule, so every
  // per-status number comes from a single GROUP BY per object rather than a
  // count per status, and the "unowned" counts ride on the lists' totals.
  const batch = new QueryBatch();
  const partnerByStatus = batch.groupBy(OBJECTS.partner, 'status', {});
  const partnerPendingList = batch.list<Record<string, unknown>>(OBJECTS.partner, { filter: { status: { eq: 'APPROVED' } }, orderBy: [{ approvedAt: 'AscNullsLast' }], first: LIST, selection: PARTNER_SELECTION });
  const partnerUnownedList = batch.list<Record<string, unknown>>(OBJECTS.partner, { filter: { ownerId: { is: 'NULL' }, status: { neq: 'OFFBOARDED' } }, orderBy: [{ createdAt: 'AscNullsLast' }], first: LIST, selection: PARTNER_SELECTION });
  const experienceByStatus = batch.groupBy(OBJECTS.experience, 'status', {});
  const experienceReview = batch.list<Record<string, unknown>>(OBJECTS.experience, { filter: { status: { eq: 'IN_REVIEW' } }, orderBy: [{ submittedAt: 'AscNullsLast' }], first: LIST, selection: LISTING_SELECTION });
  const propertyByStatus = batch.groupBy(OBJECTS.property, 'status', {});
  const propertyReview = batch.list<Record<string, unknown>>(OBJECTS.property, { filter: { status: { eq: 'IN_REVIEW' } }, orderBy: [{ submittedAt: 'AscNullsLast' }], first: LIST, selection: LISTING_SELECTION });
  const onboardingByStatus = batch.groupBy(OBJECTS.onboarding, 'status', {});
  const staleCutoff = new Date(Date.parse(now) - 14 * 86_400_000).toISOString();
  const onbOverdue = batch.count(OBJECTS.onboarding, { status: { in: ['INVITED', 'INITIATED', 'IN_PROGRESS', 'WAITING_FOR_PARTNER', 'CHANGES_REQUESTED'] }, updatedAt: { lt: staleCutoff } });
  const documentsByState = batch.groupBy(OBJECTS.document, 'verificationState', {});
  const docsExpiredList = batch.list<Record<string, unknown>>(OBJECTS.document, { filter: { verificationState: { eq: 'EXPIRED' } }, orderBy: [{ expiresAt: 'AscNullsLast' }], first: LIST, selection: 'id name documentType verificationState expiresAt onboardingId' });

  const { data, errors } = await batch.run(client);
  const partial = errors.length > 0 ? ['Some ecosystem numbers could not be loaded.'] : [];
  const rows = (object: string, list: { rows: Record<string, unknown>[]; totalCount: number }) => ({ totalCount: list.totalCount, rows: list.rows.map((record) => ({ ...record, target: { object, recordId: record.id as string } })) });
  const sum = (counts: Record<string, number>, keys: string[] | null) => (keys === null ? Object.values(counts).reduce((total, count) => total + count, 0) : keys.reduce((total, key) => total + (counts[key] ?? 0), 0));
  const partners = partnerByStatus(data);
  const experiences = experienceByStatus(data);
  const properties = propertyByStatus(data);
  const onboardings = onboardingByStatus(data);
  const documents = documentsByState(data);
  const partnerTotal = () => sum(partners, null);
  const partnerOnboarding = () => sum(partners, ['PROSPECTIVE', 'ONBOARDING']);
  const partnerPending = () => sum(partners, ['APPROVED']);
  const partnerActive = () => sum(partners, ['ACTIVE']);
  const partnerAttention = () => sum(partners, ['SUSPENDED', 'PAUSED', 'INACTIVE']);
  const partnerUnowned = () => partnerUnownedList(data).totalCount;
  const listing = (counts: Record<string, number>, review: typeof experienceReview) => ({
    total: () => sum(counts, null),
    verification: () => sum(counts, ['IN_REVIEW']),
    approved: () => sum(counts, ['READY']),
    active: () => sum(counts, ['LIVE']),
    notReady: () => sum(counts, ['DRAFT', 'IN_REVIEW', 'CHANGES_REQUIRED', 'READY', 'SUSPENDED']),
    reviewList: review,
  });
  const experience = listing(experiences, experienceReview);
  const property = listing(properties, propertyReview);
  const onbIncomplete = () => sum(onboardings, ['INVITED', 'INITIATED', 'IN_PROGRESS']);
  const onbBlocked = () => sum(onboardings, ['WAITING_FOR_PARTNER', 'CHANGES_REQUESTED']);
  const onbAwaiting = () => sum(onboardings, ['VERIFICATION', 'INTERNAL_REVIEW']);
  const onbApprovedNotActive = () => sum(onboardings, ['APPROVED']);
  const docsMissing = () => sum(documents, ['REJECTED', 'NEEDS_REPLACEMENT']);
  const docsExpired = () => sum(documents, ['EXPIRED']);

  return {
    partners: [
      { key: 'partnersTotal', label: 'Partners', value: partnerTotal(), emptyText: 'No partner yet', tone: 'neutral', link: { object: 'lvPartner' } },
      { key: 'partnersOnboarding', label: 'Onboarding', value: partnerOnboarding(), emptyText: 'No partner in onboarding', tone: 'info', link: { object: 'lvPartner' } },
      { key: 'partnersPending', label: 'Approved, not active', value: partnerPending(), emptyText: 'No approved partner awaits activation', tone: 'warning', link: { object: 'lvPartner' } },
      { key: 'partnersActive', label: 'Active', value: partnerActive(), emptyText: 'No active partner yet', tone: 'success', link: { object: 'lvPartner' } },
      { key: 'partnersAttention', label: 'Needs attention', value: partnerAttention(), emptyText: 'No partner is paused, suspended or inactive', tone: 'danger', link: { object: 'lvPartner' } },
      { key: 'partnersUnowned', label: 'Unowned', value: partnerUnowned(), emptyText: 'Every partner has an owner', tone: 'warning', link: { object: 'lvPartner' } },
    ],
    experiences: [
      { key: 'experiencesTotal', label: 'Experiences', value: experience.total(), emptyText: 'No experience yet', tone: 'neutral', link: { object: 'lvExperience' } },
      { key: 'experiencesVerification', label: 'In review', value: experience.verification(), emptyText: 'Nothing in review', tone: 'info', link: { object: 'lvExperience' } },
      { key: 'experiencesApproved', label: 'Approved, not active', value: experience.approved(), emptyText: 'No approved experience awaits activation', tone: 'warning', link: { object: 'lvExperience' } },
      { key: 'experiencesActive', label: 'Active', value: experience.active(), emptyText: 'No active experience yet', tone: 'success', link: { object: 'lvExperience' } },
      { key: 'experiencesNotReady', label: 'Not active', value: experience.notReady(), emptyText: 'Every experience is active or archived', tone: 'neutral', link: { object: 'lvExperience' } },
    ],
    properties: [
      { key: 'propertiesTotal', label: 'Properties', value: property.total(), emptyText: 'No property yet', tone: 'neutral', link: { object: 'lvProperty' } },
      { key: 'propertiesVerification', label: 'In review', value: property.verification(), emptyText: 'Nothing in review', tone: 'info', link: { object: 'lvProperty' } },
      { key: 'propertiesApproved', label: 'Approved, not active', value: property.approved(), emptyText: 'No approved property awaits activation', tone: 'warning', link: { object: 'lvProperty' } },
      { key: 'propertiesActive', label: 'Active', value: property.active(), emptyText: 'No active property yet', tone: 'success', link: { object: 'lvProperty' } },
      { key: 'propertiesNotReady', label: 'Not active', value: property.notReady(), emptyText: 'Every property is active or archived', tone: 'neutral', link: { object: 'lvProperty' } },
    ],
    onboarding: [
      { key: 'onbIncomplete', label: 'Incomplete', value: onbIncomplete(), emptyText: 'No onboarding in progress', tone: 'info', link: { object: 'lvOnboarding' } },
      { key: 'onbBlocked', label: 'Blocked (waiting / changes)', value: onbBlocked(), emptyText: 'No onboarding is waiting on the partner', tone: 'warning', link: { object: 'lvOnboarding' } },
      { key: 'onbMissingDocs', label: 'Rejected / replaceable documents', value: docsMissing(), emptyText: 'No document needs replacing', tone: 'warning', link: { object: 'lvOnboardingDocument' } },
      { key: 'onbAwaiting', label: 'Awaiting review', value: onbAwaiting(), emptyText: 'Nothing awaits review', tone: 'info', link: { object: 'lvOnboarding' } },
      { key: 'onbApproved', label: 'Approved, partner not yet active', value: onbApprovedNotActive(), emptyText: 'Every approved onboarding is activated', tone: 'warning', link: { object: 'lvOnboarding' } },
      { key: 'onbOverdue', label: 'Overdue (no update 14 days)', value: onbOverdue(data), emptyText: 'Every open onboarding moved in the last 14 days', tone: 'danger', link: { object: 'lvOnboarding' } },
      { key: 'docsExpired', label: 'Expired documents', value: docsExpired(), emptyText: 'No document has expired', tone: 'danger', link: { object: 'lvOnboardingDocument' } },
    ],
    sections: [
      { key: 'partnerApprovalBacklog', title: 'E1 · Partners approved, awaiting activation', emptyText: 'No approved partner awaits activation.', ...rows('lvPartner', partnerPendingList(data)) },
      { key: 'experienceApprovalBacklog', title: 'E2 · Experience approval backlog', emptyText: 'No experience is in review.', ...rows('lvExperience', experience.reviewList(data)) },
      { key: 'propertyApprovalBacklog', title: 'E3 · Property approval backlog', emptyText: 'No property is in review.', ...rows('lvProperty', property.reviewList(data)) },
      { key: 'expiredDocuments', title: 'E4 · Expired mandatory documents', emptyText: 'No document has expired.', ...rows('lvOnboardingDocument', docsExpiredList(data)) },
      { key: 'unownedPartners', title: 'E5 · Unowned partners', emptyText: 'Every partner has an owner.', ...rows('lvPartner', partnerUnownedList(data)) },
    ],
    partial,
  };
};
