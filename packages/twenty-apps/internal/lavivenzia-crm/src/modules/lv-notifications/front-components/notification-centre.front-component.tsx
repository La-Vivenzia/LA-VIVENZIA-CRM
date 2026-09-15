import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AppPath, navigate, useColorScheme, useUserId } from 'twenty-sdk/front-component';

import { FC_NOTIFICATION_CENTRE_ID } from 'src/constants/universal-identifiers';
import { EmptyState, ErrorState, Eyebrow, LoadingState, LvBadge, LvButton, LvPage, LvStatusBadge, PageHeader, Segmented } from 'src/modules/lv-core/ui/kit';
import { themeFor } from 'src/modules/lv-core/ui/theme';
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

  // Today / Earlier: what arrived since midnight in the viewer's zone, then
  // everything older. Sorted unread-first within each group by the view
  // helper.
  const groups = useMemo(() => {
    const startOfToday = new Date();

    startOfToday.setHours(0, 0, 0, 0);
    const today = visible.filter((row) => Date.parse(row.createdAt) >= startOfToday.getTime());
    const earlier = visible.filter((row) => Date.parse(row.createdAt) < startOfToday.getTime());

    return [
      { key: 'today', label: 'Today', rows: today },
      { key: 'earlier', label: 'Earlier', rows: earlier },
    ].filter((group) => group.rows.length > 0);
  }, [visible]);

  const renderRow = (row: NotificationRow) => {
    const tone = priorityTone(row.priority);
    const toneColour = tone === 'danger' ? theme.color.danger : tone === 'warning' ? theme.color.warning : tone === 'info' ? theme.color.info : theme.color.brandMuted;
    const isBusy = busyId === row.id;

    return (
      <li key={row.id}>
        <button
          type="button"
          className="lv-row-hover"
          onClick={() => void open(row)}
          disabled={isBusy}
          aria-label={`${row.isRead ? 'Read' : 'Unread'}: ${row.name ?? ''}`}
          style={{
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'grid',
            gridTemplateColumns: '3px 1fr',
            gap: theme.space(3),
            padding: 0,
            overflow: 'hidden',
            background: row.isRead ? theme.color.surface : theme.color.surfaceRaised,
            border: `1px solid ${row.isRead ? theme.color.border : theme.color.borderStrong}`,
            borderRadius: theme.radius.md,
            boxShadow: row.isRead ? 'none' : theme.shadow.sm,
            opacity: isBusy ? 0.6 : 1,
            fontFamily: theme.font.body,
            color: theme.color.text,
            minHeight: 56,
          }}
        >
          <span style={{ background: row.isRead ? 'transparent' : toneColour }} aria-hidden="true" />
          <span style={{ padding: theme.space(3), paddingLeft: 0, minWidth: 0 }}>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <LvBadge theme={theme} tone={tone}>
                  {typeLabel(row.notificationType)}
                </LvBadge>
                {row.priority && <LvStatusBadge theme={theme} kind="priority" value={row.priority} />}
              </span>
              <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>{relativeTime(row.createdAt, now)}</span>
            </span>
            <span style={{ display: 'block', fontWeight: row.isRead ? theme.font.weight.regular : theme.font.weight.bold, color: theme.color.heading, marginBottom: 2, overflowWrap: 'anywhere' }}>
              {!row.isRead && <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: theme.color.accent, marginRight: theme.space(2), verticalAlign: 'middle' }} />}
              {row.name}
            </span>
            {row.body && <span style={{ ...theme.type.bodySmall, display: 'block', color: theme.color.textMuted, overflowWrap: 'anywhere' }}>{row.body}</span>}
            {row.lead && (
              <span style={{ ...theme.type.caption, display: 'inline-block', marginTop: theme.space(1), color: theme.color.brand, fontWeight: theme.font.weight.medium }}>
                {row.lead.lvLeadId ? `${row.lead.lvLeadId} · ` : ''}
                {row.lead.name}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };

  return (
    <LvPage theme={theme} maxWidth={760}>
      <PageHeader
        theme={theme}
        eyebrow="Workspace"
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread. Assignments, replies, approvals and reminders, newest first.` : 'You are all caught up.'}
        right={
          <>
            <Segmented theme={theme} label="Filter" value={filter} onChange={(key) => setFilter(key as Filter)} options={[{ key: 'ALL', label: 'All', count: rows.length }, { key: 'UNREAD', label: 'Unread', count: unread }]} />
            <LvButton theme={theme} variant="secondary" size="sm" disabled={unread === 0 || isMarkingAll} busy={isMarkingAll} onClick={() => void markAll()}>
              Mark all read
            </LvButton>
          </>
        }
      />

      {error && (
        <div style={{ marginBottom: theme.space(3) }}>
          <ErrorState theme={theme} text={error} onRetry={() => void load()} />
        </div>
      )}

      {isLoading ? (
        <LoadingState theme={theme} rows={3} label="Loading notifications" />
      ) : visible.length === 0 ? (
        <EmptyState
          theme={theme}
          quiet={false}
          title={filter === 'UNREAD' ? 'You are all caught up' : 'Nothing here yet'}
          text={filter === 'UNREAD' ? 'New assignments, replies, approvals and reminders will appear here.' : 'When a lead is assigned to you, a partner replies, or something needs your decision, it will show up here.'}
        />
      ) : (
        <div className="lv-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.space(2), marginBottom: theme.space(2) }}>
                <Eyebrow theme={theme}>{group.label}</Eyebrow>
                <span style={{ ...theme.type.caption, color: theme.color.textSubtle }}>{group.rows.length}</span>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>{group.rows.map(renderRow)}</ul>
            </section>
          ))}
        </div>
      )}
    </LvPage>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_NOTIFICATION_CENTRE_ID,
  name: 'lv-notification-centre',
  description:
    'The La Vivenzia notification centre: unread count, priority, filters, mark read and deep links, scoped server-side to the signed-in member',
  component: NotificationCentre,
});
