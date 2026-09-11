import { describe, expect, it } from 'vitest';

import {
  type NotificationPort,
  type NotificationRecord,
} from 'src/modules/lv-notifications/services/notification-service';
import { type SlaRecord, type TargetFacts } from 'src/modules/lv-sla/services/sla-engine';
import { evaluateSla } from 'src/modules/lv-sla/services/sla-evaluator';
import { evaluateTarget, startSla } from 'src/modules/lv-sla/services/sla-lifecycle';
import { type SlaPort } from 'src/modules/lv-sla/services/sla-port';

// An in-memory "database" with the same guarantees the real one gives the
// port: a unique index on dedupe keys and atomic conditional updates. Each
// claim is applied synchronously against shared state, so two evaluators
// running "concurrently" (interleaved awaits) race exactly as two workers do.

const T0 = '2026-09-10T08:00:00.000Z';
const plus = (hours: number) => new Date(Date.parse(T0) + hours * 3_600_000).toISOString();

type Db = {
  slas: Map<string, SlaRecord & { escalationBlockedReason: string | null; lastEvaluatedAt: string | null; dedupeKey: string; resolutionReason?: string | null }>;
  notifications: Map<string, NotificationRecord>;
  tasks: Map<string, { id: string; slaId: string; assignee: string }>;
  facts: TargetFacts;
  escalationOwner: { workspaceMemberId: string; displayName: string | null } | null;
  failures: { notify?: number; createTask?: number };
};

const makeDb = (facts: TargetFacts): Db => ({
  slas: new Map(),
  notifications: new Map(),
  tasks: new Map(),
  facts,
  escalationOwner: { workspaceMemberId: 'wm-mgr', displayName: 'Manager' },
  failures: {},
});

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

// Yields to other "workers" between steps, like real network round-trips.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const makePort = (db: Db): SlaPort => {
  const notifications: NotificationPort = {
    createIfAbsent: async (record) => {
      await tick();

      if (db.failures.notify && db.failures.notify > 0) {
        db.failures.notify -= 1;
        throw new Error('notification store unavailable');
      }

      if (db.notifications.has(record.dedupeKey)) {
        return { outcome: 'DUPLICATE' };
      }

      db.notifications.set(record.dedupeKey, record);

      return { outcome: 'CREATED', id: nextId('n') };
    },
  };

  const claim = async (
    slaId: string,
    predicate: (row: NonNullable<ReturnType<Db['slas']['get']>>) => boolean,
    apply: (row: NonNullable<ReturnType<Db['slas']['get']>>) => void,
  ): Promise<boolean> => {
    await tick();
    const row = db.slas.get(slaId);

    if (!row || !predicate(row)) {
      return false;
    }

    apply(row); // synchronous: atomic like UPDATE … WHERE

    return true;
  };

  return {
    createIfAbsent: async (sla) => {
      await tick();

      for (const row of db.slas.values()) {
        if (row.dedupeKey === sla.dedupeKey) {
          return { outcome: 'DUPLICATE' };
        }
      }

      const id = nextId('sla');

      db.slas.set(id, {
        id,
        name: sla.name,
        rule: sla.rule,
        status: 'ON_TRACK',
        priority: sla.priority,
        ownerWorkspaceMemberId: sla.ownerWorkspaceMemberId,
        escalationOwnerWorkspaceMemberId: null,
        escalationTaskId: null,
        targetObject: sla.targetObject,
        targetRecordId: sla.targetRecordId,
        leadId: sla.leadId,
        onboardingId: sla.onboardingId,
        documentId: sla.documentId,
        startedAt: sla.startedAt,
        dueSoonAt: sla.dueSoonAt,
        dueAt: sla.dueAt,
        breachAt: sla.breachAt,
        breachedAt: null,
        escalatedAt: null,
        resolvedAt: null,
        auditTrail: [sla.audit],
        escalationBlockedReason: null,
        lastEvaluatedAt: null,
        dedupeKey: sla.dedupeKey,
      });

      return { outcome: 'CREATED', id };
    },
    listActionable: async ({ statuses }) => [...db.slas.values()].filter((row) => statuses.includes(row.status)),
    listForTarget: async ({ leadId, statuses }) =>
      [...db.slas.values()].filter((row) => statuses.includes(row.status) && (!leadId || row.leadId === leadId)),
    fetchFacts: async () => {
      await tick();

      return db.facts;
    },
    claimTransition: ({ slaId, from, to, patch, audit }) =>
      claim(
        slaId,
        (row) => row.status === from,
        (row) => {
          row.status = to;
          Object.assign(row, patch);
          row.auditTrail = [...row.auditTrail, audit];
        },
      ),
    claimOwnerChange: ({ slaId, from, to, audit }) =>
      claim(
        slaId,
        (row) => row.ownerWorkspaceMemberId === from,
        (row) => {
          row.ownerWorkspaceMemberId = to;
          row.auditTrail = [...row.auditTrail, audit];
        },
      ),
    claimEscalationOwner: ({ slaId, escalationOwnerWorkspaceMemberId, audit }) =>
      claim(
        slaId,
        (row) => row.status === 'BREACHED' && row.escalationOwnerWorkspaceMemberId === null,
        (row) => {
          row.escalationOwnerWorkspaceMemberId = escalationOwnerWorkspaceMemberId;
          row.escalationBlockedReason = null;
          row.auditTrail = [...row.auditTrail, audit];
        },
      ),
    claimEscalationTask: ({ slaId, taskId, at, audit }) =>
      claim(
        slaId,
        (row) => row.escalationTaskId === null,
        (row) => {
          row.escalationTaskId = taskId;
          row.status = 'ESCALATED';
          row.escalatedAt = at;
          row.auditTrail = [...row.auditTrail, audit];
        },
      ),
    markEscalationBlocked: async ({ slaId, reason }) => {
      const row = db.slas.get(slaId);

      if (row) {
        row.escalationBlockedReason = reason;
      }
    },
    touchEvaluated: async ({ slaId, at }) => {
      const row = db.slas.get(slaId);

      if (row) {
        row.lastEvaluatedAt = at;
      }
    },
    appendAudit: async ({ slaId, entry }) => {
      const row = db.slas.get(slaId);

      if (row) {
        row.auditTrail = [...row.auditTrail, entry];
      }
    },
    findEscalationTask: async (slaId) => {
      await tick();

      return [...db.tasks.values()].find((task) => task.slaId === slaId) ?? null;
    },
    createEscalationTask: async (draft) => {
      await tick();

      if (db.failures.createTask && db.failures.createTask > 0) {
        db.failures.createTask -= 1;
        throw new Error('task service unavailable');
      }

      const id = nextId('task');

      db.tasks.set(id, { id, slaId: draft.slaId, assignee: draft.assigneeWorkspaceMemberId });

      return { id };
    },
    destroyTask: async (taskId) => {
      db.tasks.delete(taskId);
    },
    resolveEscalationOwner: async () => db.escalationOwner,
    memberName: async () => 'Tim Apple',
    notifications,
  };
};

const leadFacts = (overrides: Partial<Extract<TargetFacts, { kind: 'LEAD' }>> = {}): TargetFacts => ({
  kind: 'LEAD',
  name: 'Forest Table',
  status: 'ASSIGNED',
  ownerWorkspaceMemberId: 'wm-a',
  outwardContactSinceStart: false,
  followUpCompletedSinceStart: false,
  ...overrides,
});

const seed = async (db: Db, rule: 'NEW_LEAD_CONTACT' | 'INTERESTED_FOLLOW_UP' = 'NEW_LEAD_CONTACT') => {
  const port = makePort(db);
  const created = await startSla({
    port,
    rule,
    subjectName: 'Forest Table',
    priority: 'MEDIUM',
    ownerWorkspaceMemberId: 'wm-a',
    target: { object: 'lvLead', recordId: 'lead-1' },
    leadId: 'lead-1',
    onboardingId: null,
    documentId: null,
    startedAt: T0,
    sourceEvent: 'lvLead.created',
    actorWorkspaceMemberId: null,
  });

  if (created.outcome !== 'CREATED') {
    throw new Error('seed failed');
  }

  return { port, id: created.id, row: () => db.slas.get(created.id)! };
};

const run = async (port: SlaPort, db: Db, id: string, hours: number) =>
  evaluateSla({ sla: db.slas.get(id)!, port, now: plus(hours) });

const notificationTypes = (db: Db) => [...db.notifications.values()].map((n) => n.notificationType).sort();

describe('startSla', () => {
  it('creates once; a replayed trigger is a duplicate, never a second clock', async () => {
    const db = makeDb(leadFacts());
    const { port } = await seed(db);
    const again = await startSla({
      port,
      rule: 'NEW_LEAD_CONTACT',
      subjectName: 'Forest Table',
      priority: 'MEDIUM',
      ownerWorkspaceMemberId: 'wm-a',
      target: { object: 'lvLead', recordId: 'lead-1' },
      leadId: 'lead-1',
      onboardingId: null,
      documentId: null,
      startedAt: T0,
      sourceEvent: 'lvLead.created',
      actorWorkspaceMemberId: null,
    });

    expect(again.outcome).toBe('DUPLICATE');
    expect(db.slas.size).toBe(1);
    expect([...db.slas.values()][0]).toMatchObject({
      status: 'ON_TRACK',
      dueAt: plus(24),
      dedupeKey: `NEW_LEAD_CONTACT:lead-1:${T0.replace(/[^0-9]/g, '')}`,
    });
    expect([...db.slas.values()][0].auditTrail[0]).toMatchObject({ event: 'CREATED', to: 'ON_TRACK' });
  });
});

describe('full lifecycle with a fake clock', () => {
  it('ON_TRACK → DUE_SOON → DUE → BREACHED → ESCALATED, one notification per state, one task', async () => {
    const db = makeDb(leadFacts());
    const { port, id, row } = await seed(db);

    await run(port, db, id, 10);
    expect(row().status).toBe('ON_TRACK');
    expect(db.notifications.size).toBe(0);

    await run(port, db, id, 18);
    expect(row().status).toBe('DUE_SOON');
    expect(notificationTypes(db)).toEqual(['SLA_DUE_SOON']);

    await run(port, db, id, 24);
    expect(row().status).toBe('DUE');
    expect(notificationTypes(db)).toEqual(['SLA_DUE', 'SLA_DUE_SOON']);

    const breach = await run(port, db, id, 25);

    expect(breach.transitionClaimed).toBe(true);
    expect(breach.escalated).toBe(true);
    expect(breach.escalationTaskCreated).toBe(true);
    expect(row().status).toBe('ESCALATED');
    expect(row().breachedAt).toBe(plus(25));
    expect(row().escalatedAt).toBe(plus(25));
    expect(row().escalationOwnerWorkspaceMemberId).toBe('wm-mgr');
    expect(notificationTypes(db)).toEqual(['ESCALATION', 'SLA_BREACH', 'SLA_DUE', 'SLA_DUE_SOON']);
    expect(db.tasks.size).toBe(1);
    expect([...db.tasks.values()][0].assignee).toBe('wm-mgr');

    const recipients = [...db.notifications.values()].map((n) => [n.notificationType, n.recipientId]);

    expect(recipients).toContainEqual(['SLA_BREACH', 'wm-a']);
    expect(recipients).toContainEqual(['ESCALATION', 'wm-mgr']);

    // Audit trail tells the whole story.
    expect(row().auditTrail.map((entry) => entry.event)).toEqual([
      'CREATED',
      'TRANSITION',
      'NOTIFIED',
      'TRANSITION',
      'NOTIFIED',
      'TRANSITION',
      'NOTIFIED',
      'ESCALATED',
      'NOTIFIED',
      'ESCALATION_TASK_CREATED',
    ]);
  });

  it('running the evaluator ten more times after escalation changes nothing', async () => {
    const db = makeDb(leadFacts());
    const { port, id, row } = await seed(db);

    await run(port, db, id, 26);

    const snapshot = JSON.stringify(row());

    for (let index = 0; index < 10; index += 1) {
      const result = await run(port, db, id, 26 + index);

      expect(result.notified).toBe(0);
      expect(result.escalationTaskCreated).toBe(false);
    }

    expect(db.notifications.size).toBe(2); // SLA_BREACH + ESCALATION (clock jumped straight to breach)
    expect(db.tasks.size).toBe(1);
    expect(JSON.stringify({ ...row(), lastEvaluatedAt: null })).toBe(JSON.stringify({ ...JSON.parse(snapshot), lastEvaluatedAt: null }));
  });

  it('resolution before the deadline: RESOLVED, and later runs never breach it', async () => {
    const db = makeDb(leadFacts());
    const { port, id, row } = await seed(db);

    await run(port, db, id, 10);
    db.facts = leadFacts({ outwardContactSinceStart: true });

    const resolved = await run(port, db, id, 12);

    expect(resolved.after).toBe('RESOLVED');
    expect(row()).toMatchObject({ status: 'RESOLVED', resolvedAt: plus(12), resolutionReason: 'CONTACT_LOGGED' });

    await run(port, db, id, 100);

    expect(row().status).toBe('RESOLVED');
    expect(db.notifications.size).toBe(0);
    expect(db.tasks.size).toBe(0);
  });

  it('resolution after the breach: the escalation stops, the SLA resolves', async () => {
    const db = makeDb(leadFacts());
    const { port, id, row } = await seed(db);

    await run(port, db, id, 30);
    expect(row().status).toBe('ESCALATED');

    db.facts = leadFacts({ status: 'CONTACTED' });
    await run(port, db, id, 31);

    expect(row().status).toBe('RESOLVED');
    expect(row().resolutionReason).toBe('LEAD_CONTACTED');
  });

  it('a deleted target resolves the SLA with TARGET_GONE', async () => {
    const db = makeDb(leadFacts());
    const { port, id, row } = await seed(db);

    db.facts = { kind: 'GONE' };
    await run(port, db, id, 5);

    expect(row()).toMatchObject({ status: 'RESOLVED', resolutionReason: 'TARGET_GONE' });
  });
});

describe('reassignment', () => {
  it('moves responsibility; the old owner gets no further notifications, the new one does; deadline unchanged', async () => {
    const db = makeDb(leadFacts());
    const { port, id, row } = await seed(db);
    const dueAt = row().dueAt;

    db.facts = leadFacts({ ownerWorkspaceMemberId: 'wm-b' });
    const result = await run(port, db, id, 19);

    expect(result.reassigned).toBe(true);
    expect(row().ownerWorkspaceMemberId).toBe('wm-b');
    expect(row().dueAt).toBe(dueAt);
    expect([...db.notifications.values()].map((n) => [n.notificationType, n.recipientId])).toEqual([
      ['SLA_DUE_SOON', 'wm-b'],
    ]);
    expect(row().auditTrail.some((entry) => entry.event === 'REASSIGNED' && entry.from === 'wm-a' && entry.to === 'wm-b')).toBe(true);

    await run(port, db, id, 26);

    const breachRecipients = [...db.notifications.values()]
      .filter((n) => n.notificationType === 'SLA_BREACH')
      .map((n) => n.recipientId);

    expect(breachRecipients).toEqual(['wm-b']);
    expect(db.slas.size).toBe(1);
  });

  it('an SLA with no owner still breaches and escalates, but notifies nobody as owner', async () => {
    const db = makeDb(leadFacts({ ownerWorkspaceMemberId: null }));
    const { port, id, row } = await seed(db);

    await run(port, db, id, 30);

    expect(row().status).toBe('ESCALATED');
    expect(notificationTypes(db)).toEqual(['ESCALATION']);
  });
});

describe('concurrency — two workers evaluate the same breached SLA at once', () => {
  it('produces exactly one breach transition, one breach notification, one escalation, one task', async () => {
    const db = makeDb(leadFacts());
    const { id } = await seed(db);
    const snapshot = db.slas.get(id)!;

    const [a, b, c] = await Promise.all([
      evaluateSla({ sla: { ...snapshot }, port: makePort(db), now: plus(26) }),
      evaluateSla({ sla: { ...snapshot }, port: makePort(db), now: plus(26) }),
      evaluateSla({ sla: { ...snapshot }, port: makePort(db), now: plus(26) }),
    ]);

    const claimed = [a, b, c].filter((r) => r.transitionClaimed).length;
    const escalated = [a, b, c].filter((r) => r.escalated).length;
    const tasksCreated = [a, b, c].filter((r) => r.escalationTaskCreated).length;

    expect(claimed).toBe(1);
    expect(escalated).toBe(1);
    expect(tasksCreated).toBe(1);
    expect(db.tasks.size).toBe(1);
    expect(notificationTypes(db)).toEqual(['ESCALATION', 'SLA_BREACH']);
    expect(db.slas.get(id)!.status).toBe('ESCALATED');
    expect([a, b, c].flatMap((r) => r.errors)).toEqual([]);
  });
});

describe('failure handling', () => {
  it('a failed breach notification leaves the row BREACHED; the retry notifies once and escalates', async () => {
    const db = makeDb(leadFacts());
    const { port, id, row } = await seed(db);

    db.failures.notify = 1;
    const first = await run(port, db, id, 26);

    expect(first.errors).toEqual(['notification store unavailable']);
    expect(row().status).toBe('BREACHED');
    expect(db.notifications.size).toBe(0);

    const retry = await run(port, db, id, 26.25);

    expect(retry.errors).toEqual([]);
    expect(notificationTypes(db)).toEqual(['ESCALATION']);
    expect(row().status).toBe('ESCALATED');
    expect(db.tasks.size).toBe(1);
  });

  it('a failed task creation is retried on the next run without a duplicate notification', async () => {
    const db = makeDb(leadFacts());
    const { port, id, row } = await seed(db);

    db.failures.createTask = 1;
    const first = await run(port, db, id, 26);

    expect(first.errors).toEqual(['task service unavailable']);
    expect(row().status).toBe('BREACHED');
    expect(row().escalationOwnerWorkspaceMemberId).toBe('wm-mgr');
    expect(db.tasks.size).toBe(0);

    const retry = await run(port, db, id, 26.25);

    expect(retry.escalated).toBe(true);
    expect(db.tasks.size).toBe(1);
    expect(notificationTypes(db)).toEqual(['ESCALATION', 'SLA_BREACH']);
    expect(row().status).toBe('ESCALATED');
  });

  it('no escalation owner configured: BREACHED, blocked reason recorded, owner still notified, nothing invented', async () => {
    const db = makeDb(leadFacts());
    db.escalationOwner = null;
    const { port, id, row } = await seed(db);

    const result = await run(port, db, id, 26);

    expect(result.escalationBlocked).toBe('NO_ESCALATION_OWNER_CONFIGURED');
    expect(row().status).toBe('BREACHED');
    expect(row().escalationBlockedReason).toBe('NO_ESCALATION_OWNER_CONFIGURED');
    expect(notificationTypes(db)).toEqual(['SLA_BREACH']);
    expect(db.tasks.size).toBe(0);

    // Configure it later: the next run escalates once.
    db.escalationOwner = { workspaceMemberId: 'wm-mgr', displayName: null };
    await run(port, db, id, 27);
    await run(port, db, id, 28);

    expect(row().status).toBe('ESCALATED');
    expect(db.tasks.size).toBe(1);
  });

  it('a restart between the breach and the escalation completes the escalation exactly once', async () => {
    const db = makeDb(leadFacts());
    const { id, row } = await seed(db);
    const port = makePort(db);

    // Simulate the crash: the claim landed, the process died before escalating.
    db.slas.get(id)!.status = 'BREACHED';
    db.slas.get(id)!.breachedAt = plus(25);

    await run(port, db, id, 25.5);
    await run(port, db, id, 25.75);

    expect(row().status).toBe('ESCALATED');
    expect(db.tasks.size).toBe(1);
    expect(notificationTypes(db)).toEqual(['ESCALATION']);
  });
});

describe('evaluateTarget', () => {
  it('evaluates every open SLA on a lead and leaves resolved ones alone', async () => {
    const db = makeDb(leadFacts({ status: 'INTERESTED' }));
    const port = makePort(db);

    await seed(db);
    await startSla({
      port,
      rule: 'INTERESTED_FOLLOW_UP',
      subjectName: 'Forest Table',
      priority: 'MEDIUM',
      ownerWorkspaceMemberId: 'wm-a',
      target: { object: 'lvLead', recordId: 'lead-1' },
      leadId: 'lead-1',
      onboardingId: null,
      documentId: null,
      startedAt: plus(1),
      sourceEvent: 'lvLead.updated',
      actorWorkspaceMemberId: null,
    });

    db.facts = leadFacts({ status: 'INTERESTED', outwardContactSinceStart: true });
    const results = await evaluateTarget({ port, leadId: 'lead-1', now: plus(2) });

    expect(results.map((r) => r.after)).toEqual(['RESOLVED', 'RESOLVED']);
    expect((await evaluateTarget({ port, leadId: 'lead-1', now: plus(3) })).length).toBe(0);
  });
});
