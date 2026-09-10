import { type CoreApiClient } from 'twenty-client-sdk/core';

import {
  type AssignmentCandidate,
  type AssignmentRule,
} from 'src/modules/lv-assignment/types/assignment.types';
import { type AssignmentPort } from 'src/modules/lv-assignment/services/assignment-orchestrator';
import { isUniqueViolation } from 'src/modules/lv-core/services/lead-id-allocator';
import { type AssignmentHistoryEntry } from 'src/modules/lv-assignment/utils/build-assignment-history';
import { isOpenWorkloadStatus, isLeadStatus } from 'src/modules/lv-core/constants/lead-lifecycle';
import { type NotificationDraft } from 'src/modules/lv-notifications/utils/build-notification';

// The CoreApiClient-backed AssignmentPort. All workspace I/O for assignment
// lives here and nowhere else, so the decision logic stays pure and testable.

const DEFAULT_LEAD_CAPACITY = 25;

type MemberRow = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  lvRegions?: string[] | null;
  lvCategories?: string[] | null;
  lvExpertise?: string[] | null;
  lvLanguages?: string[] | null;
  lvLeadCapacity?: number | null;
  lvAcceptsLeads?: boolean | null;
  lvLeads?: { status?: string | null; updatedAt?: string | null }[] | null;
};

const displayNameOf = (member: MemberRow): string =>
  [member.name?.firstName, member.name?.lastName]
    .filter((part) => typeof part === 'string' && part.length > 0)
    .join(' ') || member.id;

// Only leads in a live workload-bearing status count against capacity, so a
// long history of closed leads never starves a coordinator.
const openLeadCountOf = (member: MemberRow): number =>
  (member.lvLeads ?? []).filter((lead) => {
    const status = lead.status;

    return (
      typeof status === 'string' && isLeadStatus(status) && isOpenWorkloadStatus(status)
    );
  }).length;

const lastAssignedAtOf = (member: MemberRow): string | null => {
  const timestamps = (member.lvLeads ?? [])
    .map((lead) => lead.updatedAt)
    .filter((value): value is string => typeof value === 'string');

  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.sort().at(-1) ?? null;
};

export const toAssignmentCandidate = (member: MemberRow): AssignmentCandidate => ({
  workspaceMemberId: member.id,
  displayName: displayNameOf(member),
  // A member is assignable unless an admin has explicitly turned them off.
  isActive: member.lvAcceptsLeads !== false,
  regions: member.lvRegions ?? [],
  categories: member.lvCategories ?? [],
  subcategories: member.lvExpertise ?? [],
  languages: member.lvLanguages ?? [],
  capacity: member.lvLeadCapacity ?? DEFAULT_LEAD_CAPACITY,
  openLeadCount: openLeadCountOf(member),
  lastAssignedAt: lastAssignedAtOf(member),
});

type RuleRow = {
  id: string;
  name?: string | null;
  isActive?: boolean | null;
  evaluationOrder?: number | null;
  whenCategory?: string | null;
  whenSubcategory?: string | null;
  whenRegion?: string | null;
  whenLanguage?: string | null;
  assigneeId?: string | null;
};

export const toAssignmentRule = (rule: RuleRow): AssignmentRule | null => {
  if (!rule.assigneeId) {
    return null;
  }

  return {
    id: rule.id,
    name: rule.name ?? rule.id,
    isActive: rule.isActive !== false,
    priority: rule.evaluationOrder ?? 0,
    whenCategory: rule.whenCategory ?? null,
    whenSubcategory: rule.whenSubcategory ?? null,
    whenRegion: rule.whenRegion ?? null,
    whenLanguage: rule.whenLanguage ?? null,
    assigneeWorkspaceMemberId: rule.assigneeId,
  };
};

export const createCoreApiAssignmentPort = (
  client: CoreApiClient,
): AssignmentPort => ({
  listAssignableMembers: async () => {
    const result = await client.query({
      workspaceMembers: {
        __args: { first: 200 },
        edges: {
          node: {
            id: true,
            name: { firstName: true, lastName: true },
            lvRegions: true,
            lvCategories: true,
            lvExpertise: true,
            lvLanguages: true,
            lvLeadCapacity: true,
            lvAcceptsLeads: true,
            lvLeads: {
              __args: { first: 500 },
              edges: { node: { status: true, updatedAt: true } },
            },
          },
        },
      },
    });

    const edges = (result as { workspaceMembers?: { edges?: { node?: unknown }[] } })
      .workspaceMembers?.edges;

    return (edges ?? [])
      .map((edge) => edge?.node as (MemberRow & { lvLeads?: unknown }) | undefined)
      .filter((node): node is MemberRow => Boolean(node?.id))
      .map((node) => {
        // Flatten the nested lead connection before scoring.
        const connection = node.lvLeads as
          | { edges?: { node?: { status?: string; updatedAt?: string } }[] }
          | undefined;

        return toAssignmentCandidate({
          ...node,
          lvLeads: (connection?.edges ?? [])
            .map((edge) => edge?.node)
            .filter((lead): lead is { status?: string; updatedAt?: string } =>
              Boolean(lead),
            ),
        });
      });
  },

  listActiveRules: async () => {
    const result = await client.query({
      lvAssignmentRules: {
        __args: { first: 200 },
        edges: {
          node: {
            id: true,
            name: true,
            isActive: true,
            evaluationOrder: true,
            whenCategory: true,
            whenSubcategory: true,
            whenRegion: true,
            whenLanguage: true,
            assigneeId: true,
          },
        },
      },
    });

    const edges = (result as { lvAssignmentRules?: { edges?: { node?: RuleRow }[] } })
      .lvAssignmentRules?.edges;

    return (edges ?? [])
      .map((edge) => edge?.node)
      .filter((node): node is RuleRow => Boolean(node?.id))
      .map(toAssignmentRule)
      .filter((rule): rule is AssignmentRule => rule !== null);
  },

  findExistingRelationshipOwnerId: async (lead) => {
    const organisationName = lead.organisationName;

    if (!organisationName) {
      return null;
    }

    // Continuity is keyed on the organisation: the same business coming back
    // should reach the person who already knows them.
    const result = await client.query({
      lvLeads: {
        __args: {
          first: 1,
          filter: {
            organisationName: { eq: organisationName },
            id: { neq: lead.id },
          },
          orderBy: [{ createdAt: 'DescNullsLast' }],
        },
        edges: { node: { ownerId: true } },
      },
    });

    const edges = (result as { lvLeads?: { edges?: { node?: { ownerId?: string } }[] } })
      .lvLeads?.edges;

    return edges?.[0]?.node?.ownerId ?? null;
  },

  applyOwner: async ({ leadId, ownerWorkspaceMemberId, status, assignedAt }) => {
    await client.mutation({
      updateLvLead: {
        __args: {
          id: leadId,
          data: { ownerId: ownerWorkspaceMemberId, status, assignedAt },
        },
        id: true,
      },
    });
  },

  recordHistory: async (entry: AssignmentHistoryEntry) => {
    try {
      await client.mutation({
        createLvAssignmentHistory: {
          __args: {
            data: {
              name: `${entry.strategy} → ${entry.toWorkspaceMemberId ?? 'unassigned'}`,
              leadId: entry.leadId,
              fromOwnerId: entry.fromWorkspaceMemberId,
              toOwnerId: entry.toWorkspaceMemberId,
              strategy: entry.strategy,
              score: entry.score,
              reason: entry.reason,
              assignedAt: entry.assignedAt,
              eventKey: entry.eventKey,
            },
          },
          id: true,
        },
      });

      return true;
    } catch (error) {
      // The unique index on eventKey rejecting the insert means this event has
      // already been recorded. That is the idempotency guarantee working, not
      // a failure — but only for that one error. Everything else must surface.
      if (entry.eventKey !== null && isUniqueViolation(error)) {
        return false;
      }

      throw error;
    }
  },

  upsertNotifications: async (drafts: readonly NotificationDraft[]) => {
    if (drafts.length === 0) {
      return;
    }

    // Upsert on dedupeKey so a retried invocation or a replayed database event
    // cannot notify the same person twice for the same assignment.
    await client.mutation({
      createLvNotifications: {
        __args: {
          data: drafts.map((draft) => ({
            name: draft.title,
            recipientId: draft.recipientWorkspaceMemberId,
            // The column is notificationType, not type: "type" is reserved by
            // Twenty and the manifest sync rejects it. Writing "type" here was
            // silently producing no notification at all.
            notificationType: draft.type,
            body: draft.body,
            deepLink: draft.deepLink,
            isRead: draft.isRead,
            dedupeKey: draft.dedupeKey,
          })),
          upsert: true,
        },
        id: true,
      },
    });
  },
});
