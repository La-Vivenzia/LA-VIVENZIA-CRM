import { useCallback, useEffect, useState } from 'react';

import { callRoute, graphql } from 'src/api/client';
import { type Tone } from 'src/design/kit';

// The Leads module's data.
//
// Two shapes: the list, read straight from GraphQL under the caller's own
// permissions, and the relationship, composed server-side by /leads/360.
//
// The 360 payload is far richer than the profile used to show. It carries the
// notes, the SLA clocks, the assignment history, the capture provenance, the
// scoring factors with their evidence, the health reasons, the data-quality
// issues with their corrections, and the ecosystem the lead became. Phase 3
// types all of it, because a field the UI cannot see is a field the product
// does not have.

export type Member = { id: string; displayName: string | null; email: string | null };
export type Target = { object: string; recordId: string } | null;

export type Lead360Lead = {
  id: string;
  lvLeadId: string | null;
  name: string | null;
  organisationName: string | null;
  category: string | null;
  subcategory: string | null;
  location: string | null;
  source: string | null;
  status: string | null;
  priority: string | null;
  jobTitle: string | null;
  languages: string[] | null;
  emails: { primaryEmail: string | null } | null;
  phones: { primaryPhoneNumber: string | null } | null;
  instagram?: { primaryLinkUrl: string | null } | null;
  website?: { primaryLinkUrl: string | null } | null;
  opportunityScore: number | null;
  dataCompleteness: number | null;
  // Day 1 fields. Approved and kept.
  photoUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  yearsOfExperience: number | null;
  lastInteractionAt: string | null;
  nextAction: string | null;
  nextFollowUpAt: string | null;
  rawCaptureInput: string | null;
  createdAt?: string | null;
  owner: Member | null;
};

export type Interaction = {
  id: string;
  channel: string | null;
  direction: string | null;
  occurredAt: string | null;
  summary: string | null;
  sentiment: string | null;
  outcome: string | null;
  objections: string | null;
  actor?: Member | null;
};

export type Note = { id: string; body: string | null; createdAt: string | null; author?: Member | null; actorId?: string | null };

export type TimelineEntry = { id: string; kind: string; at: string; title: string; detail: string | null; tone: Tone | 'neutral'; target: Target };

export type LeadDocument = {
  id: string;
  name: string | null;
  documentType: string | null;
  verificationState: string | null;
  rejectionReason: string | null;
  expiresAt: string | null;
};

export type Onboarding = {
  id: string;
  status: string | null;
  progressPercentage: number | null;
  currentStep: string | null;
  healthScore?: number | null;
  documents: LeadDocument[];
  pendingDocuments: number;
  rejectedDocuments?: number;
  expiredDocuments?: number;
  verifiedDocuments?: number;
  reviewerId?: string | null;
};

export type ScoreFactor = { factor: string; points: number; evidence: string };
export type HealthReason = { reason: string; evidence: string; recordIds?: string[] };
export type DataQualityIssue = {
  code: string;
  issue: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  evidence: string;
  recommendedCorrection: string;
  target?: { object: string; recordId: string; field: string | null };
};
export type Recommendation = {
  action?: string | null;
  title?: string | null;
  reason?: string | null;
  priority?: string | null;
  deadlineLabel?: string | null;
  suggestedDeadline?: string | null;
  evidence?: string[];
};

export type Intelligence = {
  opportunity:
    | { available: true; score: number; positive: ScoreFactor[]; negative: ScoreFactor[]; missing: string[]; rulesVersion?: string }
    | { available: false; reason?: string; detail?: string; missing?: string[]; rulesVersion?: string; score?: null };
  health: { state: string | null; reasons?: HealthReason[]; positives?: HealthReason[]; rulesVersion?: string };
  nextBestAction: { primary: Recommendation | null; alternatives?: Recommendation[]; rulesVersion?: string };
  dataQuality: { issues: DataQualityIssue[]; score?: number; rulesVersion?: string };
};

export type Readiness = { ready?: boolean; blockers?: { reason: string }[] | string[]; percentage?: number | null } | null;

export type Ecosystem = {
  partner: { id: string; partnerCode: string | null; name: string | null; status: string | null; approvedAt: string | null; activatedAt: string | null; readiness: Readiness } | null;
  experiences: { id: string; code: string | null; name: string | null; status: string | null; readiness: Readiness }[];
  properties: { id: string; code: string | null; name: string | null; status: string | null; readiness: Readiness }[];
};

export type CaptureSummary = {
  method: string;
  methodLabel: string;
  platform: string | null;
  platformLabel: string | null;
  capturedAt?: string | null;
  capturedBy?: Member | null;
  files?: { fileId: string; label: string | null }[];
  raw?: string | null;
} | null;

export type Sla = { id: string; name: string | null; rule: string | null; status: string | null; dueAt: string | null; breachedAt: string | null };

export type AssignmentEntry = { id: string; at?: string | null; createdAt?: string | null; reason?: string | null; from: Member | null; to: Member | null };

export type Lead360 = {
  ok?: boolean;
  now: string;
  lead: Lead360Lead;
  caller: { workspaceMemberId: string | null; lens: string; isAdmin: boolean; isOwner: boolean };
  capabilities: Record<string, boolean>;
  settableStatuses: string[];
  nextAction: { task: { id: string; title: string | null; dueAt: string | null } | null; suggestion: Recommendation | null };
  openTasks: { id: string; title: string | null; dueAt: string | null; isOverdue: boolean }[];
  interactions: Interaction[];
  notes: Note[];
  timeline: TimelineEntry[];
  onboarding: Onboarding | null;
  slas: Sla[];
  intelligence: Intelligence;
  assignment: { history: AssignmentEntry[] };
  members: Member[];
  attention: {
    overdueFollowUp: boolean;
    noNextAction: boolean;
    slaBreach: boolean;
    missingDocuments: boolean;
    noInteraction: boolean;
  };
  capture: CaptureSummary;
  ecosystem: Ecosystem;
};

export const useLead360 = (leadId: string | undefined) => {
  const [data, setData] = useState<Lead360 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  // Opening a different relationship blanks the screen; refreshing the one
  // already open does not. A reload that blanked would unmount whatever
  // dialog asked for it, and an action would never get to show what it did.
  useEffect(() => {
    setData(null);
    setError(null);
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const result = await callRoute<Lead360>('/leads/360', { leadId });

        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'That lead could not be opened.');
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [leadId, reloads]);

  // Bumped after an action succeeds so the whole relationship is re-read from
  // the server rather than patched in the browser — the routes change more
  // than the record they were called on (tasks, SLAs, status, timeline).
  const reload = useCallback(() => setReloads((value) => value + 1), []);

  return { data, error, reload };
};

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

export type LeadListRow = {
  id: string;
  lvLeadId: string | null;
  name: string | null;
  organisationName: string | null;
  location: string | null;
  category: string | null;
  status: string | null;
  priority: string | null;
  nextAction: string | null;
  nextFollowUpAt: string | null;
  lastInteractionAt: string | null;
  opportunityScore: number | null;
  photoUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  owner: { id: string; name: { firstName: string | null; lastName: string | null } | null } | null;
  emails: { primaryEmail: string | null } | null;
  phones: { primaryPhoneNumber: string | null } | null;
};

const LIST_QUERY = `
  query LvLeadList($first: Int!) {
    lvLeads(orderBy: { lastInteractionAt: DescNullsLast }, first: $first) {
      edges { node {
        id lvLeadId name organisationName location category status priority
        nextAction nextFollowUpAt lastInteractionAt opportunityScore
        photoUrl rating reviewCount
        owner { id name { firstName lastName } }
        emails { primaryEmail }
        phones { primaryPhoneNumber }
      } }
    }
  }
`;

export const useLeadList = () => {
  const [rows, setRows] = useState<LeadListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setError(null);

    const load = async () => {
      try {
        const result = await graphql<{ lvLeads: { edges: { node: LeadListRow }[] } }>(LIST_QUERY, { first: 200 });

        if (!cancelled) {
          setRows(result.lvLeads.edges.map((edge) => edge.node));
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Your leads could not be loaded.');
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloads]);

  return { rows, error, reload: useCallback(() => setReloads((value) => value + 1), []) };
};

// The statuses that decide which saved view a lead belongs to. They mirror the
// lifecycle the server enforces; nothing here decides anything, it only sorts
// what the server already returned.
export const CLOSED_STATUSES = new Set(['LOST', 'NOT_INTERESTED', 'NOT_ELIGIBLE', 'DUPLICATE', 'WRONG_CONTACT', 'REJECTED']);
export const ONBOARDING_STATUSES = new Set(['ONBOARDING_INITIATED', 'ONBOARDING_IN_PROGRESS', 'VERIFICATION', 'APPROVED', 'LIVE_ACTIVE', 'GROWTH']);

export type LeadView = 'all' | 'followups' | 'open' | 'onboarding' | 'closed';

export const LEAD_VIEWS: { key: LeadView; label: string; description: string }[] = [
  { key: 'all', label: 'All', description: 'Every relationship you can see.' },
  { key: 'followups', label: 'Follow-ups', description: 'A follow-up is scheduled for today or is already overdue.' },
  { key: 'open', label: 'Open', description: 'Still in play — not closed or rejected.' },
  { key: 'onboarding', label: 'Onboarding', description: 'Being taken live on La Vivenzia.' },
  { key: 'closed', label: 'Closed', description: 'Lost, rejected or otherwise finished.' },
];

export const isOverdue = (row: LeadListRow, now: number): boolean => row.nextFollowUpAt !== null && Date.parse(row.nextFollowUpAt) < now;

export const inView = (row: LeadListRow, view: LeadView, now: number): boolean => {
  const status = row.status ?? '';

  switch (view) {
    case 'followups':
      // Due today counts as due: a follow-up you have not done yet is work.
      return row.nextFollowUpAt !== null && Date.parse(row.nextFollowUpAt) < now + 86_400_000 && !CLOSED_STATUSES.has(status);
    case 'open':
      return !CLOSED_STATUSES.has(status);
    case 'onboarding':
      return ONBOARDING_STATUSES.has(status);
    case 'closed':
      return CLOSED_STATUSES.has(status);
    default:
      return true;
  }
};

export type LeadSort = 'recent' | 'urgent' | 'name' | 'score';

export const LEAD_SORTS: { key: LeadSort; label: string }[] = [
  { key: 'urgent', label: 'Most urgent' },
  { key: 'recent', label: 'Recently touched' },
  { key: 'name', label: 'Name' },
  { key: 'score', label: 'Opportunity score' },
];

const time = (value: string | null): number => (value ? Date.parse(value) : 0);

export const sortLeads = (rows: LeadListRow[], sort: LeadSort, now: number): LeadListRow[] =>
  [...rows].sort((a, b) => {
    switch (sort) {
      case 'urgent': {
        // Overdue first, then the soonest follow-up, then the coldest.
        const overdueDiff = Number(isOverdue(b, now)) - Number(isOverdue(a, now));

        if (overdueDiff !== 0) {
          return overdueDiff;
        }

        const due = (row: LeadListRow) => (row.nextFollowUpAt ? Date.parse(row.nextFollowUpAt) : Number.MAX_SAFE_INTEGER);

        return due(a) - due(b) || time(a.lastInteractionAt) - time(b.lastInteractionAt);
      }
      case 'name':
        return (a.name ?? '').localeCompare(b.name ?? '');
      case 'score':
        return (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1);
      default:
        return time(b.lastInteractionAt) - time(a.lastInteractionAt);
    }
  });
