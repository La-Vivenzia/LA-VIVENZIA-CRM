import { describe, expect, it } from 'vitest';

import { notificationsForAssignment } from 'src/modules/lv-notifications/utils/build-notification';

const NOW = '2026-09-09T10:00:00.000Z';

const forAssignment = (
  overrides: Partial<Parameters<typeof notificationsForAssignment>[0]> = {},
) =>
  notificationsForAssignment({
    leadId: 'lead-1',
    leadName: 'Forest Table',
    previousOwnerId: null,
    newOwnerId: 'owner-1',
    assignedByName: null,
    priority: 'MEDIUM',
    now: NOW,
    ...overrides,
  });

describe('notificationsForAssignment', () => {
  it('notifies the new owner', () => {
    const [notification] = forAssignment();

    expect(notification?.recipientWorkspaceMemberId).toBe('owner-1');
    expect(notification?.type).toBe('LEAD_ASSIGNED');
    expect(notification?.title).toContain('Forest Table');
  });

  it('marks a transfer as a reassignment', () => {
    const [notification] = forAssignment({ previousOwnerId: 'owner-0' });

    expect(notification?.type).toBe('LEAD_REASSIGNED');
    expect(notification?.title).toContain('reassigned');
  });

  it('says who assigned it when a human did', () => {
    const [notification] = forAssignment({ assignedByName: 'Tim Apple' });

    expect(notification?.body).toContain('Tim Apple');
  });

  it('says it was automatic when the engine did', () => {
    const [notification] = forAssignment();

    expect(notification?.body).toContain('automatically');
  });

  it('links to the lead record', () => {
    const [notification] = forAssignment();

    expect(notification?.deepLink).toBe('/object/lvLead/lead-1');
  });

  it('emits nothing when the lead could not be assigned', () => {
    expect(forAssignment({ newOwnerId: null })).toEqual([]);
  });

  it('emits nothing when the owner did not actually change', () => {
    expect(forAssignment({ previousOwnerId: 'owner-1', newOwnerId: 'owner-1' })).toEqual(
      [],
    );
  });

  describe('channels', () => {
    it('stays in-app for ordinary work', () => {
      const [notification] = forAssignment({ priority: 'MEDIUM' });

      expect(notification?.channels).toEqual(['IN_APP']);
    });

    it('adds email for critical leads', () => {
      const [notification] = forAssignment({ priority: 'CRITICAL' });

      expect(notification?.channels).toEqual(['IN_APP', 'EMAIL']);
    });
  });

  describe('idempotency', () => {
    it('produces a stable dedupe key for the same event', () => {
      const [first] = forAssignment();
      const [second] = forAssignment({ now: '2026-09-09T11:00:00.000Z' });

      expect(first?.dedupeKey).toBe(second?.dedupeKey);
    });

    it('distinguishes recipients', () => {
      const [a] = forAssignment({ newOwnerId: 'owner-1' });
      const [b] = forAssignment({ newOwnerId: 'owner-2' });

      expect(a?.dedupeKey).not.toBe(b?.dedupeKey);
    });

    it('distinguishes leads', () => {
      const [a] = forAssignment({ leadId: 'lead-1' });
      const [b] = forAssignment({ leadId: 'lead-2' });

      expect(a?.dedupeKey).not.toBe(b?.dedupeKey);
    });

    it('distinguishes an assignment from a later reassignment', () => {
      const [assigned] = forAssignment();
      const [reassigned] = forAssignment({ previousOwnerId: 'owner-0' });

      expect(assigned?.dedupeKey).not.toBe(reassigned?.dedupeKey);
    });
  });

  it('starts unread', () => {
    const [notification] = forAssignment();

    expect(notification?.isRead).toBe(false);
  });
});
