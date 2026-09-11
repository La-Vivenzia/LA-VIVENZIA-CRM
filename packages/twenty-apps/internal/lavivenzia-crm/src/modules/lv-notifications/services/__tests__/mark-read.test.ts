import { describe, expect, it, vi } from 'vitest';

import {
  markAllNotificationsRead,
  markNotificationRead,
  type MarkReadPort,
} from 'src/modules/lv-notifications/services/mark-read';

const NOW = '2026-09-11T12:00:00.000Z';

const aPort = (overrides: Partial<MarkReadPort> = {}): MarkReadPort => ({
  findRecipient: vi.fn(async (id: string) => (id === 'n-mine' ? 'wm-me' : id === 'n-theirs' ? 'wm-other' : null)),
  markRead: vi.fn(async ({ notificationIds }) => notificationIds.length),
  listUnreadIds: vi.fn(async () => ['n-1', 'n-2', 'n-3']),
  ...overrides,
});

describe('markNotificationRead', () => {
  it('marks the caller’s own notification', async () => {
    const port = aPort();

    const result = await markNotificationRead({
      port,
      notificationId: 'n-mine',
      actorWorkspaceMemberId: 'wm-me',
      now: NOW,
    });

    expect(result).toEqual({ ok: true, updated: 1 });
    expect(port.markRead).toHaveBeenCalledWith({ notificationIds: ['n-mine'], readAt: NOW });
  });

  it('refuses someone else’s notification without revealing it exists', async () => {
    const port = aPort();

    const result = await markNotificationRead({
      port,
      notificationId: 'n-theirs',
      actorWorkspaceMemberId: 'wm-me',
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, refusal: 'NOT_THE_RECIPIENT' });
    expect(port.markRead).not.toHaveBeenCalled();

    const missing = await markNotificationRead({
      port,
      notificationId: 'n-missing',
      actorWorkspaceMemberId: 'wm-me',
      now: NOW,
    });

    // Same wording for "not yours" and "not there".
    expect(missing.ok ? '' : missing.error).toBe(result.ok ? '' : result.error);
  });

  it('refuses a caller with no session identity (API key)', async () => {
    const port = aPort();

    const result = await markNotificationRead({
      port,
      notificationId: 'n-mine',
      actorWorkspaceMemberId: null,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, refusal: 'NOT_AUTHENTICATED' });
    expect(port.findRecipient).not.toHaveBeenCalled();
  });
});

describe('markAllNotificationsRead', () => {
  it('marks exactly the caller’s unread set', async () => {
    const port = aPort();

    const result = await markAllNotificationsRead({
      port,
      actorWorkspaceMemberId: 'wm-me',
      now: NOW,
    });

    expect(port.listUnreadIds).toHaveBeenCalledWith('wm-me');
    expect(port.markRead).toHaveBeenCalledWith({
      notificationIds: ['n-1', 'n-2', 'n-3'],
      readAt: NOW,
    });
    expect(result).toEqual({ ok: true, updated: 3 });
  });

  it('is a no-op when nothing is unread', async () => {
    const port = aPort({ listUnreadIds: vi.fn(async () => []) });

    const result = await markAllNotificationsRead({
      port,
      actorWorkspaceMemberId: 'wm-me',
      now: NOW,
    });

    expect(result).toEqual({ ok: true, updated: 0 });
    expect(port.markRead).not.toHaveBeenCalled();
  });

  it('refuses without a session identity', async () => {
    const result = await markAllNotificationsRead({
      port: aPort(),
      actorWorkspaceMemberId: null,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, refusal: 'NOT_AUTHENTICATED' });
  });
});
