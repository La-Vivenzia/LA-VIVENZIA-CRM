import { useCallback, useEffect, useRef, useState } from 'react';

import { callRoute, graphql } from 'src/api/client';

// Leadership & operations.
//
// Six screens, three sources, nothing computed that the backend does not
// already compute:
//
//   - `/control-tower/summary` — **administrators only**. The route decides
//     that from the platform's view of the caller, not from a flag in the body
//     and not from the sidebar hiding the page, and refuses with
//     'The Control Tower is available to administrators only.'
//   - `/sla/summary` — delegated, so CM-004 scopes the rows. A governed member
//     sees their own clocks; an unscoped admin sees the pipeline.
//   - `lvAuditEvent` and the lead/interaction rows, read through GraphQL as the
//     caller.
//
// Where a figure is counted here rather than by the server, it is counted from
// rows this person can actually read and the screen says how many it read. No
// percentage, trend or projection is invented: the backend computes no such
// thing, so neither does this file.

// ---------------------------------------------------------------------------
// The shapes the Control Tower route actually returns
// ---------------------------------------------------------------------------

export type OpsTone = 'danger' | 'warning' | 'info' | 'neutral' | 'success';

/** A headline figure. `value` is null when the metric could not be read. */
export type Kpi = {
  key: string;
  label: string;
  value: number | string | null;
  emptyText?: string | null;
  tone?: OpsTone | null;
  link?: { object?: string } | null;
};

/** A named list with its own total, of which `rows` is the first page. */
export type ListSection = {
  key: string;
  title: string;
  emptyText: string;
  totalCount: number;
  rows: Record<string, unknown>[];
};

export type CountRow = { key: string; label?: string; count: number };

export type HealthRow = { key: string; label: string; value: string | number | null; detail: string };

export type ControlTower = {
  ok: true;
  generatedAt: string;
  filtered: boolean;
  kpis: Kpi[];
  sections: ListSection[];
  breakdown: {
    slaByStatus: CountRow[];
    slaByRule: CountRow[];
    documentsByState: CountRow[];
    onboardingByStatus: CountRow[];
    leadsByStatus: CountRow[];
  };
  contactBreakdown: Kpi[];
  notificationHealth: Kpi[];
  systemHealth: HealthRow[];
  members: { id: string; name: string }[];
  /** How each metric is defined, in the server's own words. */
  notes: string[];
  /** Anything the route could not read this time. Never hidden. */
  partial: string[];
  ecosystem: {
    partners?: Kpi[];
    experiences?: Kpi[];
    properties?: Kpi[];
    onboarding?: Kpi[];
    sections?: ListSection[];
    partial?: string[];
  };
};

/**
 * How the Control Tower groups its twelve lists, taken from
 * `CONTROL_TOWER_GROUPS` in the legacy front component so the two cannot
 * disagree about what counts as critical.
 */
export const CONTROL_TOWER_GROUPS: { key: string; title: string; eyebrow: string; tone: OpsTone; sections: string[] }[] = [
  { key: 'critical', title: 'Critical', eyebrow: 'Act today', tone: 'danger', sections: ['breached', 'onboardingBreached', 'overdue', 'unowned'] },
  { key: 'attention', title: 'Needs attention', eyebrow: 'This week', tone: 'warning', sections: ['hot', 'stuck', 'stuckOnboardings', 'approvals'] },
  { key: 'flow', title: 'Operational flow', eyebrow: 'Keep moving', tone: 'info', sections: ['backlog'] },
  { key: 'quality', title: 'Quality', eyebrow: 'Data hygiene', tone: 'neutral', sections: ['noContact', 'markedDuplicates', 'flaggedDuplicates'] },
  {
    key: 'ecosystem',
    title: 'Ecosystem',
    eyebrow: 'Partners · experiences · properties',
    tone: 'info',
    sections: ['partnerApprovalBacklog', 'experienceApprovalBacklog', 'propertyApprovalBacklog', 'expiredDocuments', 'unownedPartners'],
  },
];

export type Loadable<T> = { data: T | null; loading: boolean; error: string | null; forbidden: boolean; reload: () => void };

/**
 * `/control-tower/summary` answers a refusal as a normal body, so a role that
 * may not see it is a *state*, not an exception. `callRoute` raises on
 * `ok: false`, which is why the refusal is matched on its own words here.
 */
const FORBIDDEN = /administrators only|not authorized|NOT_AUTHORIZED|forbidden|permission/i;

export const useControlTower = (): Loadable<ControlTower> => {
  const [data, setData] = useState<ControlTower | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;

    const read = async () => {
      setLoading(true);
      setError(null);
      setForbidden(false);

      try {
        const result = await callRoute<ControlTower>('/control-tower/summary', {});

        if (live.current) {
          setData(result);
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'The Control Tower could not be loaded.';

        if (live.current) {
          setForbidden(FORBIDDEN.test(message));
          // The server's own words, kept verbatim — a refusal without its
          // reason is a dead end.
          setError(message);
        }
      } finally {
        if (live.current) {
          setLoading(false);
        }
      }
    };

    void read();

    return () => {
      live.current = false;
    };
  }, [attempt]);

  return { data, loading, error, forbidden, reload: useCallback(() => setAttempt((n) => n + 1), []) };
};

// ---------------------------------------------------------------------------
// 12.3 — the SLA board
// ---------------------------------------------------------------------------

/** `SLA_STATUSES` in `lv-sla/constants/sla-rules.ts`. */
export const SLA_STATUSES = ['ON_TRACK', 'DUE_SOON', 'DUE', 'BREACHED', 'ESCALATED', 'RESOLVED'] as const;

export type SlaStatus = (typeof SLA_STATUSES)[number];

export const SLA_STATUS_LABELS: Record<SlaStatus, string> = {
  ON_TRACK: 'On track',
  DUE_SOON: 'Due soon',
  DUE: 'Due',
  BREACHED: 'Breached',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
};

/** The clocks the inventory names, in the order a reader should scan them. */
export const SLA_BOARD_COLUMNS: SlaStatus[] = ['ON_TRACK', 'DUE_SOON', 'DUE', 'BREACHED', 'ESCALATED'];

export const SLA_STATUS_TONE: Record<SlaStatus, OpsTone> = {
  ON_TRACK: 'success',
  DUE_SOON: 'info',
  DUE: 'warning',
  BREACHED: 'danger',
  ESCALATED: 'danger',
  RESOLVED: 'neutral',
};

/** `SLA_RULES` in the same module. */
export const SLA_RULES = ['NEW_LEAD_CONTACT', 'INTERESTED_FOLLOW_UP', 'ONBOARDING_FIRST_ACTION', 'MISSING_DOCUMENT'] as const;

export type SlaRule = (typeof SLA_RULES)[number];

/** `SLA_RULE_LABELS`, which the route sends per item but not per count. */
export const SLA_RULE_LABELS: Record<SlaRule, string> = {
  NEW_LEAD_CONTACT: 'New lead contact',
  INTERESTED_FOLLOW_UP: 'Interested follow-up',
  ONBOARDING_FIRST_ACTION: 'Onboarding first action',
  MISSING_DOCUMENT: 'Missing document',
};

export type SlaItem = {
  id: string;
  name: string | null;
  rule: string | null;
  ruleLabel: string | null;
  status: string | null;
  priority: string | null;
  dueAt: string | null;
  breachedAt: string | null;
  escalatedAt: string | null;
  ownerWorkspaceMemberId: string | null;
  ownerName: string | null;
  leadId: string | null;
  leadName: string | null;
  leadRef: string | null;
  onboardingId: string | null;
  documentId: string | null;
};

/**
 * `/sla/summary` returns its two breakdowns as **objects** keyed by status and
 * rule — `summarise()` builds them with `Object.fromEntries`. The Control
 * Tower route returns its own breakdowns as arrays of `{ key, label, count }`.
 * The two shapes are genuinely different; assuming the array form here made the
 * SLA board throw on `.find`, which is what the Phase 12 verification caught.
 */
export type SlaSummary = {
  ok: true;
  total: number;
  byStatus: Partial<Record<SlaStatus, number>>;
  byRule: Partial<Record<SlaRule, number>>;
  items: SlaItem[];
};

/**
 * The counts as rows, in the backend's own order rather than object order, and
 * only for the statuses that were actually asked for. Listing a status the
 * query never requested would print a confident zero for a question nobody put.
 */
export const slaStatusRows = (byStatus: SlaSummary['byStatus'] | undefined, statuses: readonly SlaStatus[] = SLA_BOARD_COLUMNS): CountRow[] =>
  statuses.map((key) => ({ key, label: SLA_STATUS_LABELS[key], count: byStatus?.[key] ?? 0 }));

export const slaRuleRows = (byRule: SlaSummary['byRule'] | undefined): CountRow[] =>
  SLA_RULES.map((key) => ({ key, label: SLA_RULE_LABELS[key], count: byRule?.[key] ?? 0 }));

export const slaCountOf = (byStatus: SlaSummary['byStatus'] | undefined, status: SlaStatus): number => byStatus?.[status] ?? 0;

export const useSla = (): Loadable<SlaSummary> => {
  const [data, setData] = useState<SlaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;

    const read = async () => {
      setLoading(true);
      setError(null);
      setForbidden(false);

      try {
        // The route's own default is the *open* clocks only, which leaves
        // ON_TRACK unqueried — and an unqueried status renders as "nothing is
        // on track", which is a claim the data never made. Asking for the five
        // board columns explicitly makes every column a real answer.
        const result = await callRoute<SlaSummary>('/sla/summary', { statuses: [...SLA_BOARD_COLUMNS] });

        if (live.current) {
          setData(result);
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'The SLA board could not be loaded.';

        if (live.current) {
          setForbidden(FORBIDDEN.test(message));
          setError(message);
        }
      } finally {
        if (live.current) {
          setLoading(false);
        }
      }
    };

    void read();

    return () => {
      live.current = false;
    };
  }, [attempt]);

  return { data, loading, error, forbidden, reload: useCallback(() => setAttempt((n) => n + 1), []) };
};

// ---------------------------------------------------------------------------
// 12.4 — channel & activity
// ---------------------------------------------------------------------------

/**
 * Twenty's GraphQL has no GROUP BY, so this reads the rows the caller may see
 * and counts them here. `read` and `total` are both reported, because a figure
 * drawn from a page is not the same claim as a figure drawn from everything.
 */
export type Spread = { key: string; count: number };

export type ChannelMix = {
  leadSources: Spread[];
  leadsRead: number;
  leadsTotal: number | null;
  channels: Spread[];
  directions: Spread[];
  interactionsRead: number;
  interactionsTotal: number | null;
};

export const MIX_PAGE = 300;

const LEAD_SOURCE_QUERY = `query($first: Int!) {
  lvLeads(first: $first, orderBy: { createdAt: DescNullsLast }) {
    totalCount
    edges { node { id source status } }
  }
}`;

const INTERACTION_MIX_QUERY = `query($first: Int!) {
  lvInteractions(first: $first, orderBy: { occurredAt: DescNullsLast }) {
    totalCount
    edges { node { id channel direction } }
  }
}`;

const tally = (values: (string | null | undefined)[]): Spread[] => {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = value ?? 'UNRECORDED';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
};

export const useChannelMix = (): Loadable<ChannelMix> => {
  const [data, setData] = useState<ChannelMix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;

    const read = async () => {
      setLoading(true);
      setError(null);
      setForbidden(false);

      try {
        const [leads, interactions] = await Promise.all([
          graphql<{ lvLeads?: { totalCount?: number; edges?: { node?: { source?: string | null } }[] } }>(LEAD_SOURCE_QUERY, { first: MIX_PAGE }),
          graphql<{ lvInteractions?: { totalCount?: number; edges?: { node?: { channel?: string | null; direction?: string | null } }[] } }>(
            INTERACTION_MIX_QUERY,
            { first: MIX_PAGE },
          ),
        ]);

        const leadRows = (leads.lvLeads?.edges ?? []).map((edge) => edge?.node).filter(Boolean) as { source?: string | null }[];
        const mixRows = (interactions.lvInteractions?.edges ?? []).map((edge) => edge?.node).filter(Boolean) as {
          channel?: string | null;
          direction?: string | null;
        }[];

        if (live.current) {
          setData({
            leadSources: tally(leadRows.map((row) => row.source)),
            leadsRead: leadRows.length,
            leadsTotal: leads.lvLeads?.totalCount ?? null,
            channels: tally(mixRows.map((row) => row.channel)),
            directions: tally(mixRows.map((row) => row.direction)),
            interactionsRead: mixRows.length,
            interactionsTotal: interactions.lvInteractions?.totalCount ?? null,
          });
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Channel activity could not be read.';

        if (live.current) {
          setForbidden(FORBIDDEN.test(message));
          setError(message);
        }
      } finally {
        if (live.current) {
          setLoading(false);
        }
      }
    };

    void read();

    return () => {
      live.current = false;
    };
  }, [attempt]);

  return { data, loading, error, forbidden, reload: useCallback(() => setAttempt((n) => n + 1), []) };
};

// ---------------------------------------------------------------------------
// 12.6 — the audit trail
// ---------------------------------------------------------------------------

/** `ACTION_OPTIONS` on the `lvAuditEvent` object. */
export const AUDIT_ACTIONS = [
  'ARCHIVE', 'CLOSE', 'MARK_DUPLICATE', 'REOPEN', 'TRASH', 'RESTORE', 'PERMANENT_DELETE', 'STATUS_CHANGE', 'OWNER_CHANGE',
  'INTERACTION_LOGGED', 'TASK_CREATED', 'TASK_COMPLETED', 'TASK_RESCHEDULED', 'NOTE_CREATED', 'CAPTURE_STARTED',
  'CAPTURE_EXTRACTED', 'CAPTURE_REVIEWED', 'CLASSIFICATION_ACCEPTED', 'CLASSIFICATION_EDITED', 'CLASSIFICATION_REJECTED',
  'DUPLICATE_DETECTED', 'DUPLICATE_MERGED', 'DUPLICATE_IGNORED', 'DUPLICATE_CREATED_NEW', 'LEAD_CREATED',
  'ASSIGNMENT_RECOMMENDED', 'ASSIGNMENT_ACCEPTED', 'ASSIGNMENT_CHANGED',
] as const;

/** `OUTCOME_OPTIONS` on the same object. A refusal is recorded, not discarded. */
export const AUDIT_OUTCOMES = ['APPLIED', 'REFUSED', 'FAILED'] as const;

export const AUDIT_OUTCOME_TONE: Record<string, OpsTone> = { APPLIED: 'success', REFUSED: 'warning', FAILED: 'danger' };

export type AuditEvent = {
  id: string;
  name: string | null;
  action: string | null;
  outcome: string | null;
  targetObject: string | null;
  targetRecordId: string | null;
  targetLabel: string | null;
  at: string | null;
  reason: string | null;
  actorName: string | null;
};

export type AuditTrail = { events: AuditEvent[]; read: number; total: number | null };

export const AUDIT_PAGE = 100;

/**
 * Audit rows are written by the governance routes with the application role and
 * nobody holds update or delete on them, so this is a read and only a read.
 */
const AUDIT_QUERY = `query($first: Int!) {
  lvAuditEvents(first: $first, orderBy: { at: DescNullsLast }) {
    totalCount
    edges { node {
      id name action outcome targetObject targetRecordId targetLabel at reason
      actor { id name { firstName lastName } }
    } }
  }
}`;

export type AuditFilters = { action: string; outcome: string; query: string };

export const EMPTY_AUDIT_FILTERS: AuditFilters = { action: 'ALL', outcome: 'ALL', query: '' };

export const matchesAudit = (event: AuditEvent, filters: AuditFilters): boolean => {
  if (filters.action !== 'ALL' && event.action !== filters.action) {
    return false;
  }

  if (filters.outcome !== 'ALL' && event.outcome !== filters.outcome) {
    return false;
  }

  const needle = filters.query.trim().toLowerCase();

  if (needle.length === 0) {
    return true;
  }

  return [event.name, event.targetLabel, event.targetObject, event.actorName, event.reason]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => value.toLowerCase().includes(needle));
};

export const useAuditTrail = (): Loadable<AuditTrail> => {
  const [data, setData] = useState<AuditTrail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;

    const read = async () => {
      setLoading(true);
      setError(null);
      setForbidden(false);

      try {
        const result = await graphql<{
          lvAuditEvents?: {
            totalCount?: number;
            edges?: {
              node?: {
                id?: string;
                name?: string | null;
                action?: string | null;
                outcome?: string | null;
                targetObject?: string | null;
                targetRecordId?: string | null;
                targetLabel?: string | null;
                at?: string | null;
                reason?: string | null;
                actor?: { name?: { firstName?: string | null; lastName?: string | null } | null } | null;
              };
            }[];
          };
        }>(AUDIT_QUERY, { first: AUDIT_PAGE });

        const events = (result.lvAuditEvents?.edges ?? [])
          .map((edge) => edge?.node)
          .filter((node): node is NonNullable<typeof node> => Boolean(node?.id))
          .map(
            (node): AuditEvent => ({
              id: node.id ?? '',
              name: node.name?.trim() || null,
              action: node.action ?? null,
              outcome: node.outcome ?? null,
              targetObject: node.targetObject ?? null,
              targetRecordId: node.targetRecordId ?? null,
              targetLabel: node.targetLabel?.trim() || null,
              at: node.at ?? null,
              reason: node.reason?.trim() || null,
              actorName: [node.actor?.name?.firstName, node.actor?.name?.lastName].filter(Boolean).join(' ').trim() || null,
            }),
          );

        if (live.current) {
          setData({ events, read: events.length, total: result.lvAuditEvents?.totalCount ?? null });
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'The audit trail could not be read.';

        if (live.current) {
          setForbidden(FORBIDDEN.test(message));
          setError(message);
        }
      } finally {
        if (live.current) {
          setLoading(false);
        }
      }
    };

    void read();

    return () => {
      live.current = false;
    };
  }, [attempt]);

  return { data, loading, error, forbidden, reload: useCallback(() => setAttempt((n) => n + 1), []) };
};

// ---------------------------------------------------------------------------
// Where a record opens, when this application has a screen for it
// ---------------------------------------------------------------------------

export const OPS_ROUTE_FOR: Record<string, (id: string) => string> = {
  lvLead: (id) => `/leads/${id}`,
  lead: (id) => `/leads/${id}`,
  lvOnboarding: (id) => `/onboarding/${id}`,
  lvPartner: (id) => `/ecosystem/partners/${id}`,
  lvProperty: (id) => `/ecosystem/properties/${id}`,
  lvExperience: (id) => `/ecosystem/experiences/${id}`,
};

export const opsLinkFor = (object: string | null, recordId: string | null): string | null =>
  object && recordId && OPS_ROUTE_FOR[object] ? OPS_ROUTE_FOR[object](recordId) : null;
