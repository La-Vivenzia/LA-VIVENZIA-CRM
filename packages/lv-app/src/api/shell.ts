import { callRoute, graphql } from 'src/api/client';
import { type LvIconName } from 'src/design/icons';
import { type LvNotification, type LvNotificationKind } from 'src/design/feedback';
import { type LvSearchResult } from 'src/design/search';

// What the shell needs from the server: what a person is looking for, and what
// the CRM wants to tell them.
//
// Both are existing functionality. Search runs against the records the viewer
// is already allowed to read — the server applies the same permissions it
// applies everywhere, so this adds no access. Notifications are the lvNotification
// records the CRM already writes, and marking them read goes through the two
// routes that already own that rule.

// ---------------------------------------------------------------------------
// Global search
// ---------------------------------------------------------------------------

type SearchResponse = {
  lvLeads?: { edges: { node: { id: string; name: string | null; lvLeadId: string | null; location: string | null; status: string | null } }[] };
  people?: { edges: { node: { id: string; name: { firstName: string | null; lastName: string | null } | null; jobTitle: string | null } }[] };
  companies?: { edges: { node: { id: string; name: string | null; address: { addressCity: string | null } | null } }[] };
};

const SEARCH_QUERY = `
  query LvGlobalSearch($term: String!, $limit: Int!) {
    lvLeads(filter: { or: [{ name: { ilike: $term } }, { lvLeadId: { ilike: $term } }, { location: { ilike: $term } }] }, first: $limit) {
      edges { node { id name lvLeadId location status } }
    }
    people(filter: { or: [{ name: { firstName: { ilike: $term } } }, { name: { lastName: { ilike: $term } } }] }, first: $limit) {
      edges { node { id name { firstName lastName } jobTitle } }
    }
    companies(filter: { name: { ilike: $term } }, first: $limit) {
      edges { node { id name address { addressCity } } }
    }
  }
`;

const sentence = (value: string | null | undefined): string | null =>
  value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : null;

/**
 * One search across the three things a person actually looks for by name.
 *
 * It deliberately does not search every object in the CRM: a list that mixes
 * documents, tasks and audit rows with the lead you were looking for is slower
 * to read than the lead list you were trying to avoid opening.
 */
export const searchEverything = async (
  term: string,
  signal: AbortSignal,
  open: { lead: (id: string) => void; person: (id: string) => void; organisation: (id: string) => void },
): Promise<LvSearchResult[]> => {
  const data = await graphql<SearchResponse>(SEARCH_QUERY, { term: `%${term}%`, limit: 5 });

  if (signal.aborted) {
    return [];
  }

  const results: LvSearchResult[] = [];

  for (const edge of data.lvLeads?.edges ?? []) {
    results.push({
      id: `lead-${edge.node.id}`,
      title: edge.node.name ?? 'Unnamed lead',
      subtitle: [edge.node.lvLeadId, edge.node.location, sentence(edge.node.status)].filter(Boolean).join(' · ') || null,
      icon: 'leads',
      group: 'Leads',
      onOpen: () => open.lead(edge.node.id),
    });
  }

  for (const edge of data.people?.edges ?? []) {
    const name = [edge.node.name?.firstName, edge.node.name?.lastName].filter(Boolean).join(' ');

    results.push({
      id: `person-${edge.node.id}`,
      title: name || 'Unnamed person',
      subtitle: edge.node.jobTitle ?? null,
      icon: 'person',
      group: 'People',
      onOpen: () => open.person(edge.node.id),
    });
  }

  for (const edge of data.companies?.edges ?? []) {
    results.push({
      id: `org-${edge.node.id}`,
      title: edge.node.name ?? 'Unnamed organisation',
      subtitle: edge.node.address?.addressCity ?? null,
      icon: 'organisation',
      group: 'Organisations',
      onOpen: () => open.organisation(edge.node.id),
    });
  }

  return results;
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

type NotificationNode = {
  id: string;
  name: string | null;
  body: string | null;
  notificationType: string | null;
  isRead: boolean | null;
  createdAt: string;
  targetObject: string | null;
  targetRecordId: string | null;
  leadId: string | null;
};

const NOTIFICATIONS_QUERY = `
  query LvNotifications($limit: Int!) {
    lvNotifications(orderBy: { createdAt: DescNullsLast }, first: $limit) {
      edges { node { id name body notificationType isRead createdAt targetObject targetRecordId leadId } }
    }
  }
`;

// The CRM writes eighteen kinds of notice; the shell shows five shapes. This
// is the mapping, kept here rather than in the component so the component
// stays a presentation of whatever it is given.
const KIND_BY_TYPE: Record<string, LvNotificationKind> = {
  LEAD_ASSIGNED: 'assignment',
  LEAD_REASSIGNED: 'assignment',
  PARTNER_CREATED: 'assignment',
  FOLLOW_UP_DUE: 'sla',
  FOLLOW_UP_OVERDUE: 'sla',
  SLA_BREACH: 'sla',
  SLA_DUE: 'sla',
  SLA_DUE_SOON: 'sla',
  ESCALATION: 'sla',
  DOCUMENT_REJECTED: 'document',
  APPROVAL_REQUIRED: 'document',
  EXPERIENCE_APPROVAL_REQUIRED: 'document',
  PROPERTY_APPROVAL_REQUIRED: 'document',
  ONBOARDING_STARTED: 'document',
  ONBOARDING_COMPLETED: 'document',
  ACTIVATION_READY: 'document',
  MENTION: 'mention',
  LEAD_REPLIED: 'mention',
};

export const fetchNotifications = async (
  now: string,
  formatWhen: (iso: string, now: string) => string,
  openLead: (id: string) => void,
): Promise<LvNotification[]> => {
  const data = await graphql<{ lvNotifications?: { edges: { node: NotificationNode }[] } }>(NOTIFICATIONS_QUERY, { limit: 20 });

  return (data.lvNotifications?.edges ?? []).map((edge) => ({
    id: edge.node.id,
    kind: KIND_BY_TYPE[edge.node.notificationType ?? ''] ?? 'system',
    title: edge.node.name ?? sentence(edge.node.notificationType) ?? 'Notification',
    detail: edge.node.body,
    when: formatWhen(edge.node.createdAt, now),
    unread: edge.node.isRead !== true,
    // Only a notice that points at a lead can be opened — the rest are read
    // where they stand rather than pretending to lead somewhere.
    onOpen: edge.node.leadId ? () => openLead(edge.node.leadId as string) : undefined,
  }));
};

export const markNotificationRead = (notificationId: string): Promise<unknown> => callRoute('/notifications/mark-read', { notificationId });

export const markAllNotificationsRead = (): Promise<unknown> => callRoute('/notifications/mark-all-read', {});

/** The icon a secondary destination carries, kept beside the data it describes. */
export const SECTION_ICONS: Record<string, LvIconName> = {
  people: 'person',
  organisations: 'organisation',
  experiences: 'experience',
  tasks: 'task',
  analytics: 'chart',
};
