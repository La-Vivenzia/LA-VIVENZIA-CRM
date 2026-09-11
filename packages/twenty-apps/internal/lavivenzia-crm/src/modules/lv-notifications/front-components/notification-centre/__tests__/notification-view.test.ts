import { describe, expect, it } from 'vitest';

import {
  applyFilter,
  navigationTargetFor,
  priorityTone,
  relativeTime,
  sortNotifications,
  typeLabel,
  unreadCount,
  type NotificationRow,
} from 'src/modules/lv-notifications/front-components/notification-centre/notification-view';

const NOW = '2026-09-11T12:00:00.000Z';

const aRow = (overrides: Partial<NotificationRow> = {}): NotificationRow => ({
  id: 'n',
  name: 'New lead',
  body: '',
  notificationType: 'LEAD_ASSIGNED',
  priority: 'MEDIUM',
  isRead: false,
  readAt: null,
  createdAt: NOW,
  deepLink: '/object/lvLead/lead-1',
  targetObject: 'lvLead',
  targetRecordId: 'lead-1',
  lead: null,
  emailStatus: null,
  ...overrides,
});

describe('sortNotifications', () => {
  it('puts unread before read, then urgency, then newest', () => {
    const rows = [
      aRow({ id: 'read-critical', isRead: true, priority: 'CRITICAL' }),
      aRow({ id: 'unread-low-old', priority: 'LOW', createdAt: '2026-09-10T00:00:00.000Z' }),
      aRow({ id: 'unread-low-new', priority: 'LOW', createdAt: '2026-09-11T00:00:00.000Z' }),
      aRow({ id: 'unread-high', priority: 'HIGH' }),
    ];

    expect(sortNotifications(rows).map((row) => row.id)).toEqual([
      'unread-high',
      'unread-low-new',
      'unread-low-old',
      'read-critical',
    ]);
  });

  it('does not mutate the input', () => {
    const rows = [aRow({ id: 'b', isRead: true }), aRow({ id: 'a' })];

    sortNotifications(rows);

    expect(rows.map((row) => row.id)).toEqual(['b', 'a']);
  });
});

describe('filters and counts', () => {
  const rows = [aRow({ id: '1' }), aRow({ id: '2', isRead: true }), aRow({ id: '3' })];

  it('counts unread', () => {
    expect(unreadCount(rows)).toBe(2);
  });

  it('filters to unread', () => {
    expect(applyFilter(rows, 'UNREAD').map((row) => row.id)).toEqual(['1', '3']);
    expect(applyFilter(rows, 'ALL')).toHaveLength(3);
  });
});

describe('labels', () => {
  it('names every known type and falls back for unknown', () => {
    expect(typeLabel('SLA_BREACH')).toBe('SLA breach');
    expect(typeLabel('MENTION')).toBe('Mention');
    expect(typeLabel('SOMETHING_ELSE')).toBe('Notification');
    expect(typeLabel(null)).toBe('Notification');
  });

  it('maps priority to a tone', () => {
    expect(priorityTone('CRITICAL')).toBe('danger');
    expect(priorityTone('HIGH')).toBe('warning');
    expect(priorityTone('MEDIUM')).toBe('info');
    expect(priorityTone('LOW')).toBe('neutral');
    expect(priorityTone(null)).toBe('neutral');
  });
});

describe('relativeTime', () => {
  it('reads naturally at each scale', () => {
    expect(relativeTime('2026-09-11T11:59:50.000Z', NOW)).toBe('just now');
    expect(relativeTime('2026-09-11T11:55:00.000Z', NOW)).toBe('5 min ago');
    expect(relativeTime('2026-09-11T09:00:00.000Z', NOW)).toBe('3 h ago');
    expect(relativeTime('2026-09-09T12:00:00.000Z', NOW)).toBe('2 d ago');
    expect(relativeTime('2026-08-01T12:00:00.000Z', NOW)).toBe('2026-08-01');
    expect(relativeTime('garbage', NOW)).toBe('');
  });
});

describe('navigationTargetFor', () => {
  it('prefers the typed target fields', () => {
    expect(navigationTargetFor(aRow())).toEqual({
      objectNameSingular: 'lvLead',
      objectRecordId: 'lead-1',
    });
  });

  it('falls back to parsing the deep link', () => {
    expect(
      navigationTargetFor(aRow({ targetObject: null, targetRecordId: null, deepLink: '/object/task/t-1' })),
    ).toEqual({ objectNameSingular: 'task', objectRecordId: 't-1' });
  });

  it('returns null when there is nowhere to go', () => {
    expect(navigationTargetFor(aRow({ targetObject: null, targetRecordId: null, deepLink: null }))).toBeNull();
  });
});
