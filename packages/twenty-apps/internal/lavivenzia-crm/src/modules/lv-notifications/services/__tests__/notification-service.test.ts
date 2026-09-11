import { describe, expect, it } from 'vitest';

import {
  dispatchNotifications,
  toNotificationRecord,
  type NotificationPort,
  type NotificationRecord,
} from 'src/modules/lv-notifications/services/notification-service';
import { type NotificationIntent } from 'src/modules/lv-notifications/utils/build-notification';

// A port with the same semantics as the real one: a unique dedupeKey index,
// insert-or-DUPLICATE, never update.
const aPort = () => {
  const rows = new Map<string, NotificationRecord & { id: string }>();
  let next = 0;

  const port: NotificationPort = {
    createIfAbsent: async (record) => {
      if (rows.has(record.dedupeKey)) {
        return { outcome: 'DUPLICATE' };
      }

      const id = `n-${++next}`;

      rows.set(record.dedupeKey, { ...record, id });

      return { outcome: 'CREATED', id };
    },
  };

  return { port, rows };
};

const anIntent = (overrides: Partial<NotificationIntent> = {}): NotificationIntent => ({
  type: 'LEAD_ASSIGNED',
  recipientWorkspaceMemberId: 'wm-owner',
  title: 'New lead: Forest Table',
  body: 'Assigned automatically.',
  priority: 'MEDIUM',
  target: { object: 'lvLead', recordId: 'lead-1' },
  leadId: 'lead-1',
  dedupeKey: 'LEAD_ASSIGNED:lead-1:wm-owner:1',
  email: false,
  metadata: {},
  ...overrides,
});

const dispatch = (
  port: NotificationPort,
  intents: NotificationIntent[],
  actorWorkspaceMemberId: string | null = null,
) =>
  dispatchNotifications({
    port,
    intents,
    sourceEvent: 'lvLead.updated',
    actorWorkspaceMemberId,
  });

describe('dispatchNotifications', () => {
  it('stores a well-formed row for a fresh intent', async () => {
    const { port, rows } = aPort();

    const outcome = await dispatch(port, [anIntent()], 'wm-admin');

    expect(outcome.created).toHaveLength(1);
    expect(rows.get('LEAD_ASSIGNED:lead-1:wm-owner:1')).toMatchObject({
      name: 'New lead: Forest Table',
      recipientId: 'wm-owner',
      notificationType: 'LEAD_ASSIGNED',
      deepLink: '/object/lvLead/lead-1',
      priority: 'MEDIUM',
      isRead: false,
      targetObject: 'lvLead',
      targetRecordId: 'lead-1',
      leadId: 'lead-1',
      triggeredById: 'wm-admin',
      sourceEvent: 'lvLead.updated',
      emailStatus: 'NOT_APPLICABLE',
    });
  });

  it('queues email only when the intent asks for it', () => {
    expect(
      toNotificationRecord({
        intent: anIntent({ email: true }),
        sourceEvent: 'x',
        actorWorkspaceMemberId: null,
      }).emailStatus,
    ).toBe('QUEUED');
  });

  describe('idempotency', () => {
    it('is a no-op the second time the same event is dispatched', async () => {
      const { port, rows } = aPort();

      const first = await dispatch(port, [anIntent()]);
      const replay = await dispatch(port, [anIntent()]);

      expect(first.created).toHaveLength(1);
      expect(replay.created).toHaveLength(0);
      expect(replay.duplicates).toEqual(['LEAD_ASSIGNED:lead-1:wm-owner:1']);
      expect(rows.size).toBe(1);
    });

    it('never touches the stored row on replay — a read notification stays read', async () => {
      const { port, rows } = aPort();

      await dispatch(port, [anIntent()]);

      const stored = rows.get('LEAD_ASSIGNED:lead-1:wm-owner:1');

      if (!stored) {
        throw new Error('row missing');
      }

      // Simulate the recipient having read it in the meantime.
      (stored as { isRead: boolean }).isRead = true;

      await dispatch(port, [anIntent()]);

      expect(rows.get('LEAD_ASSIGNED:lead-1:wm-owner:1')?.isRead).toBe(true);
    });

    it('collapses duplicates inside one batch before touching the port', async () => {
      const { port, rows } = aPort();

      const outcome = await dispatch(port, [anIntent(), anIntent()]);

      expect(outcome.created).toHaveLength(1);
      expect(outcome.suppressed).toEqual([
        expect.objectContaining({ reason: 'DUPLICATE_IN_BATCH' }),
      ]);
      expect(rows.size).toBe(1);
    });
  });

  describe('recipient rules', () => {
    it('never notifies the actor about their own action', async () => {
      const { port, rows } = aPort();

      const outcome = await dispatch(
        port,
        [anIntent({ recipientWorkspaceMemberId: 'wm-owner' })],
        'wm-owner',
      );

      expect(outcome.created).toHaveLength(0);
      expect(outcome.suppressed).toEqual([
        expect.objectContaining({ reason: 'ACTOR_IS_RECIPIENT' }),
      ]);
      expect(rows.size).toBe(0);
    });

    it('drops an intent with no recipient rather than storing an orphan', async () => {
      const { port, rows } = aPort();

      const outcome = await dispatch(port, [anIntent({ recipientWorkspaceMemberId: '' })]);

      expect(outcome.suppressed).toEqual([expect.objectContaining({ reason: 'NO_RECIPIENT' })]);
      expect(rows.size).toBe(0);
    });

    it('lets the system (no actor) notify anyone', async () => {
      const { port } = aPort();

      const outcome = await dispatch(port, [anIntent()], null);

      expect(outcome.created).toHaveLength(1);
    });

    it('delivers to each distinct recipient in a batch', async () => {
      const { port, rows } = aPort();

      await dispatch(port, [
        anIntent({ recipientWorkspaceMemberId: 'a', dedupeKey: 'k:a' }),
        anIntent({ recipientWorkspaceMemberId: 'b', dedupeKey: 'k:b' }),
      ]);

      expect([...rows.values()].map((row) => row.recipientId).sort()).toEqual(['a', 'b']);
    });
  });

  it('surfaces port failures other than duplicates', async () => {
    const port: NotificationPort = {
      createIfAbsent: async () => {
        throw new Error('connection refused');
      },
    };

    await expect(dispatch(port, [anIntent()])).rejects.toThrow('connection refused');
  });
});
