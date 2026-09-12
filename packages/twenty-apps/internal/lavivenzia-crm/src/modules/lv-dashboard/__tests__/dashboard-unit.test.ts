import { describe, expect, it } from 'vitest';

import {
  hasAnyFilter,
  leadScope,
  onboardingScope,
  ownerScope,
  parseControlTowerFilters,
  slaScope,
} from 'src/modules/lv-dashboard/metrics/control-tower-filters';
import {
  bucketForChannel,
  clampTimeZoneOffset,
  dayBounds,
  leadFilters,
  onboardingHealthFor,
  slaFilters,
  taskFilters,
  THRESHOLDS,
} from 'src/modules/lv-dashboard/metrics/definitions';
import { deriveLens } from 'src/modules/lv-dashboard/services/caller-context';
import { OBJECTS, packFields, QueryBatch } from 'src/modules/lv-dashboard/services/query-batch';

const NOW = '2026-09-11T12:00:00.000Z';

describe('metric definitions', () => {
  it('overdue follow-up = open task with dueAt in the past', () => {
    expect(taskFilters.overdue(NOW)).toEqual({ and: [{ status: { neq: 'DONE' } }, { dueAt: { lt: NOW } }] });
  });

  it('stuck lead = open workload, older than 14 days, no contact within 14 days', () => {
    const filter = leadFilters.stuck(NOW) as { and: Record<string, unknown>[] };

    expect(filter.and[0]).toEqual({ status: { in: expect.arrayContaining(['NEW', 'ASSIGNED', 'INTERESTED']) } });
    expect(JSON.stringify(filter.and[0])).not.toContain('LOST');
    expect(filter.and[1]).toEqual({
      createdAt: { lt: '2026-08-28T12:00:00.000Z' },
      or: [{ lastInteractionAt: { is: 'NULL' } }, { lastInteractionAt: { lt: '2026-08-28T12:00:00.000Z' } }],
    });
    expect(THRESHOLDS.STUCK_LEAD_DAYS).toBe(14);
  });

  it('hot without follow-up = open, HIGH/CRITICAL, no next follow-up', () => {
    expect(JSON.stringify(leadFilters.hotWithoutFollowUp())).toContain('"priority":{"in":["CRITICAL","HIGH"]}');
    expect(JSON.stringify(leadFilters.hotWithoutFollowUp())).toContain('"nextFollowUpAt":{"is":"NULL"}');
  });

  it('incomplete contact = open lead with neither email nor phone', () => {
    expect(JSON.stringify(leadFilters.noContactChannel())).toContain('"emails":{"primaryEmail":{"is":"NULL"}}');
    expect(JSON.stringify(leadFilters.noContactChannel())).toContain('"phones":{"primaryPhoneNumber":{"is":"NULL"}}');
  });

  it('SLA breach filter covers BREACHED and ESCALATED only', () => {
    expect(slaFilters.breached()).toEqual({ status: { in: ['BREACHED', 'ESCALATED'] } });
    expect(slaFilters.due()).toEqual({ status: { in: ['DUE_SOON', 'DUE'] } });
  });

  it('buckets coordinator tasks by the channel of their source interaction', () => {
    expect(bucketForChannel('PHONE')).toBe('calls');
    expect(bucketForChannel('EMAIL')).toBe('emails');
    expect(bucketForChannel('WHATSAPP')).toBe('whatsapp');
    expect(bucketForChannel('VIDEO_CALL')).toBe('meetings');
    expect(bucketForChannel('MEETING')).toBe('meetings');
    expect(bucketForChannel(null)).toBe('other');
    expect(bucketForChannel('INTERNAL_NOTE')).toBe('other');
  });

  it('derives onboarding health only from real facts', () => {
    const base = { hasBlockingDocument: false, hasBreachedSla: false, hasDueSla: false, updatedAt: NOW, now: NOW };

    expect(onboardingHealthFor(base)).toBe('HEALTHY');
    expect(onboardingHealthFor({ ...base, hasDueSla: true })).toBe('NEEDS_ATTENTION');
    expect(onboardingHealthFor({ ...base, updatedAt: '2026-09-01T00:00:00.000Z' })).toBe('NEEDS_ATTENTION');
    expect(onboardingHealthFor({ ...base, hasBlockingDocument: true })).toBe('BLOCKED');
    expect(onboardingHealthFor({ ...base, hasBreachedSla: true, hasDueSla: true })).toBe('BLOCKED');
  });

  it('computes "today" in the viewer timezone and clamps the offset', () => {
    expect(dayBounds('2026-09-11T20:30:00.000Z', 330)).toEqual({ start: '2026-09-11T18:30:00.000Z', end: '2026-09-12T18:30:00.000Z' });
    expect(dayBounds('2026-09-11T02:00:00.000Z', 0)).toEqual({ start: '2026-09-11T00:00:00.000Z', end: '2026-09-12T00:00:00.000Z' });
    expect(clampTimeZoneOffset(99999)).toBe(840);
    expect(clampTimeZoneOffset('x')).toBe(0);
  });
});

describe('control tower filters', () => {
  it('drops everything it does not recognise', () => {
    const parsed = parseControlTowerFilters({
      ownerIds: ['not-a-uuid', '9b19969e-7fc3-46e8-8e43-bf80685b699a', 42],
      categories: ['STAY', 'NOT_A_CATEGORY'],
      statuses: ['NEW', 'HACKED'],
      priorities: ['HIGH', 'ULTRA'],
      slaStatuses: ['BREACHED', 'x'],
      onboardingStatuses: ['INITIATED', 'y'],
      sources: ['WEBSITE', 'z'],
      location: '  Lonavala%_ ',
      createdFrom: 'yesterday',
      createdTo: '2026-09-11',
      unownedOnly: 'yes',
      isAdmin: true,
      recipientId: 'x',
    });

    expect(parsed.ownerIds).toEqual(['9b19969e-7fc3-46e8-8e43-bf80685b699a']);
    expect(parsed.categories).toEqual(['STAY']);
    expect(parsed.statuses).toEqual(['NEW']);
    expect(parsed.priorities).toEqual(['HIGH']);
    expect(parsed.slaStatuses).toEqual(['BREACHED']);
    expect(parsed.onboardingStatuses).toEqual(['INITIATED']);
    expect(parsed.sources).toEqual(['WEBSITE']);
    expect(parsed.location).toBe('Lonavala%_');
    expect(parsed.createdFrom).toBeNull();
    expect(parsed.createdTo).toBe('2026-09-11T00:00:00.000Z');
    expect(parsed.unownedOnly).toBe(false);
    expect('isAdmin' in parsed).toBe(false);
  });

  it('builds AND-ed lead scope and strips SQL wildcards from the location', () => {
    const scope = leadScope(parseControlTowerFilters({ location: 'Lona%vala', priorities: ['HIGH'], unownedOnly: true }));

    expect(scope).toEqual({ and: [{ ownerId: { is: 'NULL' } }, { location: { ilike: '%Lonavala%' } }, { priority: { in: ['HIGH'] } }] });
  });

  it('carries owner filters onto SLAs, tasks and onboardings under their own columns', () => {
    const filters = parseControlTowerFilters({ ownerIds: ['9b19969e-7fc3-46e8-8e43-bf80685b699a'], slaStatuses: ['ESCALATED'], onboardingStatuses: ['INTERNAL_REVIEW'] });

    expect(ownerScope(filters, 'assigneeId')).toEqual({ assigneeId: { in: ['9b19969e-7fc3-46e8-8e43-bf80685b699a'] } });
    expect(slaScope(filters)).toEqual({ and: [{ ownerId: { in: ['9b19969e-7fc3-46e8-8e43-bf80685b699a'] } }, { status: { in: ['ESCALATED'] } }] });
    expect(onboardingScope(filters)).toEqual({ and: [{ reviewerId: { in: ['9b19969e-7fc3-46e8-8e43-bf80685b699a'] } }, { status: { in: ['INTERNAL_REVIEW'] } }] });
    expect(hasAnyFilter(filters)).toBe(true);
    expect(hasAnyFilter(parseControlTowerFilters({}))).toBe(false);
  });
});

describe('lens derivation (from the caller’s own permissions, never the body)', () => {
  const perms = (updates: string[]) =>
    Object.fromEntries(updates.map((name) => [name, { read: true, update: true, softDelete: false, destroy: false }]));

  it('administrators get ADMIN and may switch to every lens', () => {
    expect(deriveLens({ isAdmin: true, objectPermissions: {} })).toEqual({ lens: 'ADMIN', availableLenses: ['ADMIN', 'HUNTER', 'COORDINATOR', 'ONBOARDING'] });
  });

  it('maps the team roles by what they may update', () => {
    expect(deriveLens({ isAdmin: false, objectPermissions: perms(['lvLead', 'task', 'note']) }).lens).toBe('HUNTER');
    expect(deriveLens({ isAdmin: false, objectPermissions: perms(['lvLead', 'lvInteraction', 'task', 'note']) }).lens).toBe('COORDINATOR');
    expect(deriveLens({ isAdmin: false, objectPermissions: perms(['lvOnboarding', 'lvOnboardingDocument', 'task', 'note']) }).lens).toBe('ONBOARDING');
    expect(deriveLens({ isAdmin: false, objectPermissions: perms(['lvLead', 'lvInteraction', 'lvOnboarding']) })).toEqual({ lens: 'COORDINATOR', availableLenses: ['COORDINATOR', 'HUNTER', 'ONBOARDING'] });
  });

  it('read-only roles get the oversight lens and no Control Tower', () => {
    expect(deriveLens({ isAdmin: false, objectPermissions: perms(['note']) })).toEqual({ lens: 'OVERSIGHT', availableLenses: ['OVERSIGHT'] });
  });
});

describe('query batch', () => {
  it('packs fields so no document repeats a root resolver or exceeds the limit', () => {
    const fields = [
      { root: 'lvLeads' }, { root: 'lvLeads' }, { root: 'tasks' }, { root: 'lvLeadsGroupBy' }, { root: 'lvLeads' }, { root: 'tasks' },
    ];
    const chunks = packFields(fields, 18);

    expect(chunks.length).toBe(3);
    for (const chunk of chunks) {
      expect(new Set(chunk.map((field) => field.root)).size).toBe(chunk.length);
    }
    expect(packFields(Array.from({ length: 40 }, (_, index) => ({ root: `r${index}` })), 18).length).toBe(3);
  });

  it('turns many aggregations into one document with typed variables', async () => {
    const batch = new QueryBatch();
    const readCount = batch.count(OBJECTS.lead, { ownerId: { is: 'NULL' } });
    const readGroup = batch.groupBy(OBJECTS.sla, 'status', {});
    const readList = batch.list<{ id: string }>(OBJECTS.task, { filter: { status: { neq: 'DONE' } }, first: 500, selection: 'id' });
    let captured: { document: string; variables: Record<string, unknown> } | null = null;

    const { data } = await batch.run({
      query: async (document: string, variables: Record<string, unknown>) => {
        captured = { document, variables };

        return {
          data: {
            count_0: { totalCount: 2 },
            group_1: [{ groupByDimensionValues: ['BREACHED'], totalCount: 1 }, { groupByDimensionValues: [null], totalCount: 3 }],
            list_2: { totalCount: 7, edges: [{ node: { id: 'a' } }, { node: null }] },
          },
          errors: [],
        };
      },
    } as never);

    expect(captured).not.toBeNull();
    expect(batch.requestCount).toBe(1);
    expect(captured!.document).toContain('query Dashboard($v0: LvLeadFilterInput, $v1: LvSlaFilterInput, $v2: TaskFilterInput)');
    expect(captured!.document).toContain('count_0: lvLeads(first: 1, filter: $v0) { totalCount }');
    expect(captured!.document).toContain('group_1: lvSlasGroupBy(groupBy: [{ status: true }], filter: $v1)');
    // Lists are bounded regardless of what the caller asked for.
    expect(captured!.document).toContain('list_2: tasks(first: 100, filter: $v2)');
    expect(captured!.variables).toEqual({ v0: { ownerId: { is: 'NULL' } }, v1: {}, v2: { status: { neq: 'DONE' } } });
    expect(readCount(data)).toBe(2);
    expect(readGroup(data)).toEqual({ BREACHED: 1, __null: 3 });
    expect(readList(data)).toEqual({ totalCount: 7, rows: [{ id: 'a' }] });
  });
});
