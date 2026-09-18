import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_SLA_SUMMARY_ID } from 'src/constants/universal-identifiers';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import {
  SLA_RULES,
  SLA_RULE_LABELS,
  SLA_STATUSES,
  type SlaRule,
  type SlaStatus,
} from 'src/modules/lv-sla/constants/sla-rules';

// POST /sla/summary — the data the Admin Control Tower (Day 5) will read:
// counts per state and per rule, plus the open SLAs with owner, rule,
// priority and due time.
//
// Deliberately runs DELEGATED (the caller's own token): CM-004 decides which
// rows the caller may see, so a governed member gets their own SLAs and an
// unscoped Main Admin / Operations / Management gets the whole pipeline. No
// argument in the body widens that — the only inputs are which states and how
// many rows.

type SummaryInput = { statuses?: unknown; limit?: unknown };

type SlaRow = {
  id: string;
  name?: string | null;
  rule?: string | null;
  status?: string | null;
  priority?: string | null;
  dueAt?: string | null;
  breachedAt?: string | null;
  escalatedAt?: string | null;
  ownerId?: string | null;
  owner?: { name?: { firstName?: string | null; lastName?: string | null } | null } | null;
  escalationOwnerId?: string | null;
  leadId?: string | null;
  lead?: { name?: string | null; lvLeadId?: string | null } | null;
  onboardingId?: string | null;
  documentId?: string | null;
};

const OPEN: SlaStatus[] = ['DUE_SOON', 'DUE', 'BREACHED', 'ESCALATED'];

export const summarise = (rows: SlaRow[]) => {
  const byStatus = Object.fromEntries(SLA_STATUSES.map((status) => [status, 0])) as Record<SlaStatus, number>;
  const byRule = Object.fromEntries(SLA_RULES.map((rule) => [rule, 0])) as Record<SlaRule, number>;

  for (const row of rows) {
    if (row.status && row.status in byStatus) {
      byStatus[row.status as SlaStatus] += 1;
    }

    if (row.rule && row.rule in byRule) {
      byRule[row.rule as SlaRule] += 1;
    }
  }

  return { byStatus, byRule };
};

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input } = readRouteInput<SummaryInput>(event);

  const statuses = Array.isArray(input.statuses)
    ? input.statuses.filter((value): value is SlaStatus =>
        (SLA_STATUSES as readonly string[]).includes(String(value)),
      )
    : OPEN;
  const limit =
    typeof input.limit === 'number' && input.limit > 0 && input.limit <= 500 ? Math.floor(input.limit) : 200;

  const client = new CoreApiClient();
  const result = await client.query({
    lvSlas: {
      __args: {
        first: limit,
        filter: { status: { in: statuses.length > 0 ? statuses : OPEN } },
        orderBy: [{ dueAt: 'AscNullsLast' }],
      },
      totalCount: true,
      edges: {
        node: {
          id: true,
          name: true,
          rule: true,
          status: true,
          priority: true,
          dueAt: true,
          breachedAt: true,
          escalatedAt: true,
          ownerId: true,
          owner: { name: { firstName: true, lastName: true } },
          escalationOwnerId: true,
          leadId: true,
          lead: { name: true, lvLeadId: true },
          onboardingId: true,
          documentId: true,
        },
      },
    },
  });

  const typed = result as { lvSlas?: { totalCount?: number; edges?: { node?: SlaRow }[] } };
  const rows = (typed.lvSlas?.edges ?? [])
    .map((edge) => edge.node)
    .filter((node): node is SlaRow => Boolean(node?.id));

  return {
    ok: true,
    total: typed.lvSlas?.totalCount ?? rows.length,
    ...summarise(rows),
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      rule: row.rule,
      ruleLabel: row.rule && row.rule in SLA_RULE_LABELS ? SLA_RULE_LABELS[row.rule as SlaRule] : row.rule,
      status: row.status,
      priority: row.priority,
      dueAt: row.dueAt,
      breachedAt: row.breachedAt,
      escalatedAt: row.escalatedAt,
      ownerWorkspaceMemberId: row.ownerId ?? null,
      ownerName:
        [row.owner?.name?.firstName, row.owner?.name?.lastName].filter(Boolean).join(' ') || null,
      escalationOwnerWorkspaceMemberId: row.escalationOwnerId ?? null,
      leadId: row.leadId ?? null,
      leadName: row.lead?.name ?? null,
      lvLeadId: row.lead?.lvLeadId ?? null,
      onboardingId: row.onboardingId ?? null,
      documentId: row.documentId ?? null,
    })),
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_SLA_SUMMARY_ID,
  name: 'lv-sla-summary',
  description:
    'Open SLAs and counts for the caller, scoped by CM-004 — the data feed for the Control Tower',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/sla/summary',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
