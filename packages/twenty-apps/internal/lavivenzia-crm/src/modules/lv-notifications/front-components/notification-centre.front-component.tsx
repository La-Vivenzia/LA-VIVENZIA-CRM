import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AppPath, navigate, useColorScheme, useUserId } from 'twenty-sdk/front-component';

import { FC_NOTIFICATION_CENTRE_ID } from 'src/constants/universal-identifiers';
import { layout, themeFor } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';
import {
  applyFilter,
  navigationTargetFor,
  priorityTone,
  relativeTime,
  sortNotifications,
  typeLabel,
  unreadCount,
  type Filter,
  type NotificationRow,
} from 'src/modules/lv-notifications/front-components/notification-centre/notification-view';

// The La Vivenzia notification centre.
//
// Reads through the signed-in user's own token, so the list is whatever
// CM-004 lets this person see — for a governed role, exactly their own rows.
// The recipient filter in the query is a convenience for unscoped admins; it
// is not the protection. Read-state changes go through the mark-read routes,
// which derive the actor from the session.

const POLL_MS = 30_000;

export const NotificationCentre = () => {
  const userId = useUserId();
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
  const s = useMemo(() => layout(theme), [theme]);
  const client = useMemo(() => new CoreApiClient(), []);

  const [memberId, setMemberId] = useState<string | null>(null);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date().toISOString());

  const resolveMember = useCallback(async () => {
    if (!userId) {
      return null;
    }

    const result = await client.query({
      workspaceMembers: {
        __args: { first: 1, filter: { userId: { eq: userId } } },
        edges: { node: { id: true } },
      },
    });

    return (
      (result as { workspaceMembers?: { edges?: { node?: { id?: string } }[] } }).workspaceMembers
        ?.edges?.[0]?.node?.id ?? null
    );
  }, [client, userId]);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setIsLoading(true);
      }

      setError(null);

      try {
        const me = memberId ?? (await resolveMember());

        if (!me) {
          setRows([]);

          return;
        }

        if (me !== memberId) {
          setMemberId(me);
        }

        const result = await client.query({
          lvNotifications: {
            __args: {
              first: 100,
              filter: { recipientId: { eq: me } },
              orderBy: [{ createdAt: 'DescNullsLast' }],
            },
            edges: {
              node: {
                id: true,
                name: true,
                body: true,
                notificationType: true,
                priority: true,
                isRead: true,
                readAt: true,
                createdAt: true,
                deepLink: true,
                targetObject: true,
                targetRecordId: true,
                emailStatus: true,
                lead: { id: true, name: true, lvLeadId: true },
              },
            },
          },
        });

        const typed = result as { lvNotifications?: { edges?: { node?: NotificationRow }[] } };

        setRows(
          (typed.lvNotifications?.edges ?? [])
            .map((edge) => edge?.node)
            .filter((node): node is NotificationRow => Boolean(node?.id)),
        );
        setNow(new Date().toISOString());
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load notifications.');
      } finally {
        setIsLoading(false);
      }
    },
    [client, memberId, resolveMember],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Light polling keeps the unread count honest while the page is open. No
  // notification is ever computed here — the server wrote every row.
  useEffect(() => {
    const timer = setInterval(() => void load(true), POLL_MS);

    return () => clearInterval(timer);
  }, [load]);

  const markRead = useCallback(
    async (row: NotificationRow) => {
      if (row.isRead) {
        return;
      }

      setBusyId(row.id);

      try {
        await callRoute('/notifications/mark-read', { notificationId: row.id });
        setRows((current) =>
          current.map((item) =>
            item.id === row.id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item,
          ),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not mark as read.');
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const open = useCallback(
    async (row: NotificationRow) => {
      await markRead(row);

      const target = navigationTargetFor(row);

      if (target) {
        // The record page itself re-checks authorization on the server: a
        // link to something this person cannot open shows "not found".
        await navigate(AppPath.RecordShowPage, target);
      }
    },
    [markRead],
  );

  const markAll = useCallback(async () => {
    setIsMarkingAll(true);
    setError(null);

    try {
      await callRoute('/notifications/mark-all-read', {});
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not mark all as read.');
    } finally {
      setIsMarkingAll(false);
    }
  }, [load]);

  const unread = unreadCount(rows);
  const visible = useMemo(() => sortNotifications(applyFilter(rows, filter)), [rows, filter]);

  const tabStyle = (active: boolean) => ({
    ...s.button('secondary'),
    minHeight: 36,
    padding: `${theme.space(1)}px ${theme.space(3)}px`,
    background: active ? theme.color.brand : theme.color.surfaceRaised,
    color: active ? theme.color.textOnBrand : theme.color.text,
    borderColor: active ? theme.color.brand : theme.color.border,
  });

  return (
    <div style={s.page}>
      <div style={s.container(760)}>
        <div style={{ ...s.row, justifyContent: 'space-between', marginBottom: theme.space(3) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
            <span
              style={{
                fontSize: theme.font.size.xl,
                fontWeight: theme.font.weight.bold,
                color: theme.color.brand,
              }}
            >
              Notifications
            </span>
            <span
              aria-label={`${unread} unread`}
              style={{
                ...s.badge(unread > 0 ? 'warning' : 'neutral'),
                minWidth: 22,
                textAlign: 'center',
                background: unread > 0 ? theme.color.accent : theme.color.brandMuted,
                color: unread > 0 ? '#1A1A1A' : theme.color.textOnBrand,
              }}
            >
              {unread}
            </span>
          </div>
          <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
            <button type="button" style={tabStyle(filter === 'ALL')} onClick={() => setFilter('ALL')}>
              All
            </button>
            <button
              type="button"
              style={tabStyle(filter === 'UNREAD')}
              onClick={() => setFilter('UNREAD')}
            >
              Unread
            </button>
            <button
              type="button"
              style={{ ...s.button('primary'), minHeight: 36, opacity: unread === 0 || isMarkingAll ? 0.6 : 1 }}
              disabled={unread === 0 || isMarkingAll}
              onClick={() => void markAll()}
            >
              {isMarkingAll ? 'Marking…' : 'Mark all read'}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              ...s.card,
              borderColor: theme.color.danger,
              color: theme.color.danger,
              marginBottom: theme.space(3),
            }}
          >
            {error}
          </div>
        )}

        {isLoading ? (
          <div style={s.stack(2)} aria-busy="true">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                style={{
                  ...s.card,
                  height: 72,
                  background: theme.color.surfaceRaised,
                  opacity: 0.7 - index * 0.15,
                }}
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div style={{ ...s.card, textAlign: 'center', padding: theme.space(8) }}>
            <div style={{ fontSize: 28, marginBottom: theme.space(2) }} aria-hidden="true">
              ✓
            </div>
            <div style={{ fontWeight: theme.font.weight.medium, marginBottom: theme.space(1) }}>
              {filter === 'UNREAD' ? 'You are all caught up' : 'Nothing here yet'}
            </div>
            <div style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm }}>
              {filter === 'UNREAD'
                ? 'New assignments, replies, approvals and reminders will appear here.'
                : 'When a lead is assigned to you, a partner replies, or something needs your decision, it will show up here.'}
            </div>
          </div>
        ) : (
          <ul style={{ ...s.stack(2), listStyle: 'none', margin: 0, padding: 0 }}>
            {visible.map((row) => {
              const tone = priorityTone(row.priority);
              const toneColour =
                tone === 'danger'
                  ? theme.color.danger
                  : tone === 'warning'
                    ? theme.color.warning
                    : tone === 'info'
                      ? theme.color.info
                      : theme.color.brandMuted;
              const isBusy = busyId === row.id;

              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void open(row)}
                    disabled={isBusy}
                    aria-label={`${row.isRead ? 'Read' : 'Unread'}: ${row.name ?? ''}`}
                    style={{
                      ...s.card,
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'grid',
                      gridTemplateColumns: '4px 1fr',
                      gap: theme.space(3),
                      padding: 0,
                      overflow: 'hidden',
                      background: row.isRead ? theme.color.surface : theme.color.surfaceRaised,
                      opacity: isBusy ? 0.6 : 1,
                      fontFamily: theme.font.body,
                      color: theme.color.text,
                    }}
                  >
                    <span style={{ background: toneColour }} aria-hidden="true" />
                    <span style={{ padding: theme.space(3), paddingLeft: 0, minWidth: 0 }}>
                      <span style={{ ...s.row, justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ display: 'flex', gap: theme.space(2), alignItems: 'center' }}>
                          <span style={s.badge(tone)}>{typeLabel(row.notificationType)}</span>
                          {row.priority && (
                            <span style={{ fontSize: theme.font.size.xs, color: toneColour, fontWeight: theme.font.weight.medium }}>
                              {row.priority.toLowerCase()}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>
                          {relativeTime(row.createdAt, now)}
                        </span>
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontWeight: row.isRead ? theme.font.weight.regular : theme.font.weight.bold,
                          marginBottom: 2,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {!row.isRead && (
                          <span
                            aria-hidden="true"
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: theme.color.accent,
                              marginRight: theme.space(2),
                              verticalAlign: 'middle',
                            }}
                          />
                        )}
                        {row.name}
                      </span>
                      {row.body && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: theme.font.size.sm,
                            color: theme.color.textMuted,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {row.body}
                        </span>
                      )}
                      {row.lead && (
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: theme.space(1),
                            fontSize: theme.font.size.xs,
                            color: theme.color.brand,
                            fontWeight: theme.font.weight.medium,
                          }}
                        >
                          {row.lead.lvLeadId ? `${row.lead.lvLeadId} · ` : ''}
                          {row.lead.name}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_NOTIFICATION_CENTRE_ID,
  name: 'lv-notification-centre',
  description:
    'The La Vivenzia notification centre: unread count, priority, filters, mark read and deep links, scoped server-side to the signed-in member',
  component: NotificationCentre,
});
