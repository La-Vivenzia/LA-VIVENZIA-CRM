import { describe, expect, it } from 'vitest';

import { parseControlTowerFilters } from 'src/modules/lv-dashboard/metrics/control-tower-filters';
import { type CallerContext, type DashboardLens } from 'src/modules/lv-dashboard/services/caller-context';
import { buildControlTowerSummary } from 'src/modules/lv-dashboard/services/control-tower-summary';
import { buildDashboardSummary } from 'src/modules/lv-dashboard/services/dashboard-summary';
import { type DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';

// A GraphQL client that answers every aliased root field with an empty
// result and records how many documents were sent. It proves the summaries
// are a fixed, small number of packed requests — never one request per row.
const fakeClient = () => {
  const documents: string[] = [];
  const client = {
    query: async (document: string) => {
      documents.push(document);
      const data: Record<string, unknown> = {};

      for (const match of document.matchAll(/(\w+):\s*(\w+)\(/g)) {
        const [, alias, root] = match;

        if (root === 'currentUser' || root === 'objects') {
          continue;
        }
        data[alias] = root.endsWith('GroupBy') ? [] : { totalCount: 0, edges: [] };
      }

      return { data, errors: [] };
    },
  } as unknown as DelegatedGraphqlClient;

  return { client, documents };
};

const caller = (lens: DashboardLens, isAdmin = false): CallerContext => ({
  workspaceMemberId: '11111111-1111-4111-8111-111111111111', displayName: 'Asha Rao', firstName: 'Asha',
  userId: null,
  isAdmin,
  permissionFlags: isAdmin ? ['WORKSPACE'] : [],
  objectPermissions: {},
  lens,
  availableLenses: [lens],
});

const NOW = '2026-09-11T12:00:00.000Z';
const REQUEST_BUDGET = 14;
// Day 9: the Control Tower gained the ecosystem section (partners, experiences,
// properties, onboarding pipeline, expired documents) — one GROUP BY per object
// plus five bounded lists, packed by root into three more documents. Still a
// fixed number of requests regardless of data volume (no N+1).
const CONTROL_TOWER_BUDGET = REQUEST_BUDGET + 3;

describe('request budget (no N+1)', () => {
  it.each<DashboardLens>(['HUNTER', 'COORDINATOR', 'ONBOARDING', 'ADMIN', 'OVERSIGHT'])('%s dashboard is a handful of packed documents', async (lens) => {
    const { client, documents } = fakeClient();

    const summary = await buildDashboardSummary({ client, caller: caller(lens, lens === 'ADMIN'), lens, now: NOW, timeZoneOffsetMinutes: 330 });

    expect(summary.lens).toBe(lens);
    expect(documents.length).toBeGreaterThan(0);
    expect(documents.length).toBeLessThanOrEqual(REQUEST_BUDGET);
    for (const document of documents) {
      const roots = [...document.matchAll(/\w+:\s*(\w+)\(/g)].map((match) => match[1]);

      expect(roots.length).toBeLessThanOrEqual(18);
      expect(new Set(roots).size).toBe(roots.length);
    }
    // Every KPI explains its zero and no metric is invented.
    for (const kpi of summary.kpis) {
      expect(kpi.value === null ? kpi.unavailableReason : kpi.emptyText).toBeTruthy();
    }
  });

  it('the Control Tower, with and without filters, stays within the same budget', async () => {
    for (const raw of [{}, { ownerIds: ['22222222-2222-4222-8222-222222222222'], statuses: ['NEW'], slaStatuses: ['BREACHED'] }]) {
      const { client, documents } = fakeClient();
      const summary = await buildControlTowerSummary({ client, filters: parseControlTowerFilters(raw), now: NOW });

      expect(documents.length).toBeLessThanOrEqual(CONTROL_TOWER_BUDGET);
      expect(summary.ecosystem.partners.length + summary.ecosystem.experiences.length + summary.ecosystem.properties.length + summary.ecosystem.onboarding.length).toBeGreaterThan(0);
      expect(summary.ecosystem.sections).toHaveLength(5);
      expect(summary.sections.length).toBeGreaterThanOrEqual(12);
      expect(summary.sections.every((section) => section.rows.length === 0 && section.emptyText.length > 0)).toBe(true);
    }
  });
});
