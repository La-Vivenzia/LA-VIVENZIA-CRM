import { type CoreApiClient } from 'twenty-client-sdk/core';

import { priorityOrDefault } from 'src/modules/lv-core/constants/lead-lifecycle';
import { isUniqueViolation } from 'src/modules/lv-core/services/lead-id-allocator';
import { isOutwardContact, isInteractionChannel } from 'src/modules/lv-interactions/constants/interaction-vocabulary';
import { createCoreApiNotificationPort } from 'src/modules/lv-notifications/services/core-api-notification-port';
import { findMember } from 'src/modules/lv-notifications/services/member-lookup';
import {
  BREACH_GRACE_HOURS,
  isSlaRule,
  isSlaStatus,
  type SlaStatus,
} from 'src/modules/lv-sla/constants/sla-rules';
import {
  type SlaAuditEntry,
  type SlaRecord,
  type TargetFacts,
} from 'src/modules/lv-sla/services/sla-engine';
import { type SlaPort } from 'src/modules/lv-sla/services/sla-port';

// CoreApiClient-backed SlaPort. Constructed with the application role by the
// evaluator and the event hooks. Every claim is a filtered batch update —
// `updateLvSlas(filter: {id, <precondition>}, data)` — which Twenty executes as
// one UPDATE … WHERE, returning the rows it changed. Zero rows back means the
// precondition no longer held: another run got there first.

export const ESCALATION_OWNER_VARIABLE = 'LV_ESCALATION_OWNER_EMAIL';

const SLA_FIELDS = {
  id: true,
  name: true,
  rule: true,
  status: true,
  priority: true,
  ownerId: true,
  escalationOwnerId: true,
  escalationTaskId: true,
  targetObject: true,
  targetRecordId: true,
  leadId: true,
  onboardingId: true,
  documentId: true,
  startedAt: true,
  dueSoonAt: true,
  dueAt: true,
  breachedAt: true,
  escalatedAt: true,
  resolvedAt: true,
  auditTrail: true,
} as const;

type SlaRow = {
  id: string;
  name?: string | null;
  rule?: string | null;
  status?: string | null;
  priority?: string | null;
  ownerId?: string | null;
  escalationOwnerId?: string | null;
  escalationTaskId?: string | null;
  targetObject?: string | null;
  targetRecordId?: string | null;
  leadId?: string | null;
  onboardingId?: string | null;
  documentId?: string | null;
  startedAt?: string | null;
  dueSoonAt?: string | null;
  dueAt?: string | null;
  breachedAt?: string | null;
  escalatedAt?: string | null;
  resolvedAt?: string | null;
  auditTrail?: unknown;
};

const asTrail = (value: unknown): SlaAuditEntry[] =>
  Array.isArray(value) ? (value as SlaAuditEntry[]) : [];

const plusHours = (isoTimestamp: string, hours: number): string =>
  new Date(Date.parse(isoTimestamp) + hours * 60 * 60 * 1000).toISOString();

export const toSlaRecord = (row: SlaRow): SlaRecord | null => {
  if (!row.id || !isSlaRule(row.rule) || !isSlaStatus(row.status) || !row.dueAt || !row.startedAt) {
    return null;
  }

  const targetObject = row.targetObject;

  if (
    targetObject !== 'lvLead' &&
    targetObject !== 'lvOnboarding' &&
    targetObject !== 'lvOnboardingDocument'
  ) {
    return null;
  }

  return {
    id: row.id,
    name: row.name ?? '',
    rule: row.rule,
    status: row.status,
    priority: priorityOrDefault(row.priority),
    ownerWorkspaceMemberId: row.ownerId ?? null,
    escalationOwnerWorkspaceMemberId: row.escalationOwnerId ?? null,
    escalationTaskId: row.escalationTaskId ?? null,
    targetObject,
    targetRecordId: row.targetRecordId ?? '',
    leadId: row.leadId ?? null,
    onboardingId: row.onboardingId ?? null,
    documentId: row.documentId ?? null,
    startedAt: row.startedAt,
    dueSoonAt: row.dueSoonAt ?? row.dueAt,
    dueAt: row.dueAt,
    breachAt: plusHours(row.dueAt, BREACH_GRACE_HOURS),
    breachedAt: row.breachedAt ?? null,
    escalatedAt: row.escalatedAt ?? null,
    resolvedAt: row.resolvedAt ?? null,
    auditTrail: asTrail(row.auditTrail),
  };
};

const edgesOf = <T>(result: unknown, key: string): T[] =>
  ((result as Record<string, { edges?: { node?: T }[] }>)[key]?.edges ?? [])
    .map((edge) => edge.node)
    .filter((node): node is T => Boolean(node));

// Twenty's findOne throws "Record not found" for a soft-deleted or destroyed
// record rather than returning null. For the engine that IS the fact: the
// target is gone.
const isNotFound = (error: unknown): boolean =>
  error instanceof Error && /not found/i.test(error.message);

const OUTWARD_CHANNELS = [
  'PHONE',
  'EMAIL',
  'WHATSAPP',
  'INSTAGRAM',
  'LINKEDIN',
  'VIDEO_CALL',
  'MEETING',
  'EVENT',
  'DOCUMENT',
].filter((channel) => isInteractionChannel(channel) && isOutwardContact(channel));

export const createCoreApiSlaPort = (client: CoreApiClient): SlaPort => {
  const claim = async (
    filter: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Promise<boolean> => {
    const result = await client.mutation({
      updateLvSlas: { __args: { filter, data }, id: true },
    });

    return ((result as { updateLvSlas?: { id: string }[] }).updateLvSlas ?? []).length > 0;
  };

  const readTrail = async (slaId: string): Promise<SlaAuditEntry[]> => {
    const result = await client.query({
      lvSla: { __args: { filter: { id: { eq: slaId } } }, auditTrail: true },
    });

    return asTrail((result as { lvSla?: { auditTrail?: unknown } }).lvSla?.auditTrail);
  };

  const leadFacts = async (leadId: string, since: string): Promise<TargetFacts> => {
    let result: unknown;

    try {
      result = await client.query({
      lvLead: {
        __args: { filter: { id: { eq: leadId } } },
        id: true,
        name: true,
        status: true,
        ownerId: true,
      },
      lvInteractions: {
        __args: {
          first: 1,
          filter: {
            leadId: { eq: leadId },
            occurredAt: { gte: since },
            channel: { in: OUTWARD_CHANNELS },
          },
        },
        totalCount: true,
      },
      taskTargets: {
        __args: { first: 50, filter: { targetLvLeadId: { eq: leadId } } },
        edges: { node: { task: { status: true, updatedAt: true } } },
      },
    });
    } catch (error) {
      if (isNotFound(error)) {
        return { kind: 'GONE' };
      }

      throw error;
    }

    const typed = result as {
      lvLead?: { id: string; name?: string | null; status?: string | null; ownerId?: string | null } | null;
      lvInteractions?: { totalCount?: number };
      taskTargets?: { edges?: { node?: { task?: { status?: string; updatedAt?: string } | null } }[] };
    };

    if (!typed.lvLead) {
      return { kind: 'GONE' };
    }

    const followUpCompletedSinceStart = (typed.taskTargets?.edges ?? []).some(
      (edge) =>
        edge.node?.task?.status === 'DONE' &&
        typeof edge.node.task.updatedAt === 'string' &&
        edge.node.task.updatedAt >= since,
    );

    return {
      kind: 'LEAD',
      name: typed.lvLead.name ?? '',
      status: typed.lvLead.status ?? null,
      ownerWorkspaceMemberId: typed.lvLead.ownerId ?? null,
      outwardContactSinceStart: (typed.lvInteractions?.totalCount ?? 0) > 0,
      followUpCompletedSinceStart,
    };
  };

  const onboardingFacts = async (onboardingId: string, since: string): Promise<TargetFacts> => {
    let result: unknown;

    try {
      result = await client.query({
      lvOnboarding: {
        __args: { filter: { id: { eq: onboardingId } } },
        id: true,
        name: true,
        status: true,
        reviewerId: true,
        lead: { ownerId: true },
      },
      lvOnboardingDocuments: {
        __args: {
          first: 1,
          filter: {
            onboardingId: { eq: onboardingId },
            verificationState: { neq: 'PENDING' },
            updatedAt: { gte: since },
          },
        },
        totalCount: true,
      },
    });
    } catch (error) {
      if (isNotFound(error)) {
        return { kind: 'GONE' };
      }

      throw error;
    }

    const typed = result as {
      lvOnboarding?: {
        name?: string | null;
        status?: string | null;
        reviewerId?: string | null;
        lead?: { ownerId?: string | null } | null;
      } | null;
      lvOnboardingDocuments?: { totalCount?: number };
    };

    if (!typed.lvOnboarding) {
      return { kind: 'GONE' };
    }

    return {
      kind: 'ONBOARDING',
      name: typed.lvOnboarding.name ?? '',
      status: typed.lvOnboarding.status ?? null,
      reviewerWorkspaceMemberId: typed.lvOnboarding.reviewerId ?? null,
      leadOwnerWorkspaceMemberId: typed.lvOnboarding.lead?.ownerId ?? null,
      documentReviewedSinceStart: (typed.lvOnboardingDocuments?.totalCount ?? 0) > 0,
    };
  };

  const documentFacts = async (documentId: string): Promise<TargetFacts> => {
    let result: unknown;

    try {
      result = await client.query({
        lvOnboardingDocument: {
          __args: { filter: { id: { eq: documentId } } },
          id: true,
          name: true,
          verificationState: true,
          onboardingId: true,
          replacedBy: { edges: { node: { id: true } } },
        },
      });
    } catch (error) {
      if (isNotFound(error)) {
        return { kind: 'GONE' };
      }

      throw error;
    }

    const document = (
      result as {
        lvOnboardingDocument?: {
          name?: string | null;
          verificationState?: string | null;
          onboardingId?: string | null;
          replacedBy?: { edges?: { node?: { id: string } }[] };
        } | null;
      }
    ).lvOnboardingDocument;

    if (!document) {
      return { kind: 'GONE' };
    }

    // Two hops read separately: the API does not resolve document → onboarding
    // → lead in one query, and an unresolved lead must not read as "no owner".
    let onboardingStatus: string | null = null;
    let reviewerWorkspaceMemberId: string | null = null;
    let leadOwnerWorkspaceMemberId: string | null = null;

    if (document.onboardingId) {
      const parent = await client
        .query({
          lvOnboarding: {
            __args: { filter: { id: { eq: document.onboardingId } } },
            status: true,
            reviewerId: true,
            lead: { ownerId: true },
          },
        })
        .catch((error: unknown) => {
          if (isNotFound(error)) {
            return {};
          }

          throw error;
        });
      const onboarding = (
        parent as {
          lvOnboarding?: {
            status?: string | null;
            reviewerId?: string | null;
            lead?: { ownerId?: string | null } | null;
          } | null;
        }
      ).lvOnboarding;

      onboardingStatus = onboarding?.status ?? null;
      reviewerWorkspaceMemberId = onboarding?.reviewerId ?? null;
      leadOwnerWorkspaceMemberId = onboarding?.lead?.ownerId ?? null;
    }

    return {
      kind: 'DOCUMENT',
      name: document.name ?? '',
      verificationState: document.verificationState ?? null,
      onboardingStatus,
      reviewerWorkspaceMemberId,
      leadOwnerWorkspaceMemberId,
      replacementRegistered: (document.replacedBy?.edges ?? []).length > 0,
    };
  };

  const list = async (filter: Record<string, unknown>, limit: number): Promise<SlaRecord[]> => {
    const result = await client.query({
      lvSlas: {
        __args: { first: limit, filter, orderBy: [{ dueAt: 'AscNullsLast' }] },
        edges: { node: SLA_FIELDS },
      },
    });

    return edgesOf<SlaRow>(result, 'lvSlas')
      .map(toSlaRecord)
      .filter((record): record is SlaRecord => record !== null);
  };

  return {
    createIfAbsent: async (sla) => {
      try {
        const result = await client.mutation({
          createLvSla: {
            __args: {
              data: {
                name: sla.name,
                rule: sla.rule,
                status: 'ON_TRACK',
                priority: sla.priority,
                ownerId: sla.ownerWorkspaceMemberId,
                targetObject: sla.targetObject,
                targetRecordId: sla.targetRecordId,
                leadId: sla.leadId,
                onboardingId: sla.onboardingId,
                documentId: sla.documentId,
                startedAt: sla.startedAt,
                dueSoonAt: sla.dueSoonAt,
                dueAt: sla.dueAt,
                dedupeKey: sla.dedupeKey,
                sourceEvent: sla.sourceEvent,
                auditTrail: [sla.audit],
                metadata: sla.metadata,
              },
            },
            id: true,
          },
        });
        const id = (result as { createLvSla?: { id?: string } }).createLvSla?.id;

        if (!id) {
          throw new Error('createLvSla returned no id');
        }

        return { outcome: 'CREATED', id };
      } catch (error) {
        if (isUniqueViolation(error)) {
          return { outcome: 'DUPLICATE' };
        }

        throw error;
      }
    },

    listActionable: ({ statuses, limit }) => list({ status: { in: [...statuses] } }, limit),

    listForTarget: ({ leadId, onboardingId, documentId, statuses }) => {
      const or: Record<string, unknown>[] = [];

      if (leadId) {
        or.push({ leadId: { eq: leadId } });
      }

      if (onboardingId) {
        or.push({ onboardingId: { eq: onboardingId } });
      }

      if (documentId) {
        or.push({ documentId: { eq: documentId } });
      }

      if (or.length === 0) {
        return Promise.resolve([]);
      }

      return list({ and: [{ status: { in: [...statuses] } }, { or }] }, 100);
    },

    fetchFacts: (sla) => {
      switch (sla.targetObject) {
        case 'lvLead':
          return leadFacts(sla.targetRecordId, sla.startedAt);
        case 'lvOnboarding':
          return onboardingFacts(sla.targetRecordId, sla.startedAt);
        default:
          return documentFacts(sla.targetRecordId);
      }
    },

    claimTransition: ({ slaId, from, to, at, patch, audit, knownTrail }) =>
      claim(
        { id: { eq: slaId }, status: { eq: from } },
        {
          status: to,
          ...patch,
          lastEvaluatedAt: at,
          auditTrail: [...knownTrail, audit],
        },
      ),

    claimOwnerChange: ({ slaId, from, to, audit, knownTrail }) =>
      claim(
        { id: { eq: slaId }, ownerId: from === null ? { is: 'NULL' } : { eq: from } },
        { ownerId: to, auditTrail: [...knownTrail, audit] },
      ),

    claimEscalationOwner: ({ slaId, escalationOwnerWorkspaceMemberId, audit, knownTrail }) =>
      claim(
        { id: { eq: slaId }, status: { eq: 'BREACHED' }, escalationOwnerId: { is: 'NULL' } },
        {
          escalationOwnerId: escalationOwnerWorkspaceMemberId,
          escalationBlockedReason: null,
          auditTrail: [...knownTrail, audit],
        },
      ),

    claimEscalationTask: ({ slaId, taskId, at, audit, knownTrail }) =>
      claim(
        { id: { eq: slaId }, escalationTaskId: { is: 'NULL' } },
        {
          escalationTaskId: taskId,
          status: 'ESCALATED',
          previousStatus: 'BREACHED',
          escalatedAt: at,
          auditTrail: [...knownTrail, audit],
        },
      ),

    markEscalationBlocked: async ({ slaId, reason, at }) => {
      await client.mutation({
        updateLvSla: {
          __args: { id: slaId, data: { escalationBlockedReason: reason, lastEvaluatedAt: at } },
          id: true,
        },
      });
    },

    touchEvaluated: async ({ slaId, at }) => {
      await client.mutation({
        updateLvSla: { __args: { id: slaId, data: { lastEvaluatedAt: at } }, id: true },
      });
    },

    appendAudit: async ({ slaId, entry, lastNotifiedAt }) => {
      const trail = await readTrail(slaId);

      await client.mutation({
        updateLvSla: {
          __args: {
            id: slaId,
            data: {
              auditTrail: [...trail, entry],
              ...(lastNotifiedAt ? { lastNotifiedAt } : {}),
            },
          },
          id: true,
        },
      });
    },

    findEscalationTask: async (slaId) => {
      const result = await client.query({
        tasks: {
          __args: { first: 5, filter: { title: { like: `%SLA ${slaId.slice(0, 8)}%` } } },
          edges: { node: { id: true, bodyV2: { markdown: true } } },
        },
      });
      const match = edgesOf<{ id: string; bodyV2?: { markdown?: string | null } | null }>(result, 'tasks').find(
        (task) => (task.bodyV2?.markdown ?? '').includes(slaId),
      );

      return match ? { id: match.id } : null;
    },

    createEscalationTask: async (draft) => {
      const created = await client.mutation({
        createTask: {
          __args: {
            data: {
              title: `${draft.title} · SLA ${draft.slaId.slice(0, 8)}`,
              bodyV2: { markdown: draft.bodyMarkdown },
              dueAt: draft.dueAt,
              status: 'TODO',
              assigneeId: draft.assigneeWorkspaceMemberId,
              lvPriority: 'CRITICAL',
            },
          },
          id: true,
        },
      });
      const taskId = (created as { createTask?: { id?: string } }).createTask?.id;

      if (!taskId) {
        throw new Error('createTask returned no id');
      }

      const targets: Record<string, unknown>[] = [];

      if (draft.leadId) {
        targets.push({ taskId, targetLvLeadId: draft.leadId });
      }

      if (draft.onboardingId) {
        targets.push({ taskId, targetLvOnboardingId: draft.onboardingId });
      }

      for (const data of targets) {
        await client.mutation({ createTaskTarget: { __args: { data }, id: true } });
      }

      return { id: taskId };
    },

    destroyTask: async (taskId) => {
      const targets = await client.query({
        taskTargets: {
          __args: { first: 10, filter: { taskId: { eq: taskId } } },
          edges: { node: { id: true } },
        },
      });

      for (const target of edgesOf<{ id: string }>(targets, 'taskTargets')) {
        await client.mutation({ destroyTaskTarget: { __args: { id: target.id }, id: true } });
      }

      await client.mutation({ destroyTask: { __args: { id: taskId }, id: true } });
    },

    resolveEscalationOwner: async () => {
      const email = process.env[ESCALATION_OWNER_VARIABLE]?.trim();

      if (!email) {
        return null;
      }

      const result = await client.query({
        workspaceMembers: {
          __args: { first: 1, filter: { userEmail: { eq: email } } },
          edges: { node: { id: true, name: { firstName: true, lastName: true } } },
        },
      });
      const member = edgesOf<{ id: string; name?: { firstName?: string | null; lastName?: string | null } | null }>(
        result,
        'workspaceMembers',
      )[0];

      if (!member) {
        return null;
      }

      const displayName = [member.name?.firstName, member.name?.lastName]
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .join(' ');

      return { workspaceMemberId: member.id, displayName: displayName || null };
    },

    memberName: async (workspaceMemberId) =>
      (await findMember(client, workspaceMemberId))?.displayName ?? null,

    notifications: createCoreApiNotificationPort(client),
  };
};

export const ACTIONABLE_FOR_EVALUATION: readonly SlaStatus[] = [
  'ON_TRACK',
  'DUE_SOON',
  'DUE',
  'BREACHED',
  'ESCALATED',
];
