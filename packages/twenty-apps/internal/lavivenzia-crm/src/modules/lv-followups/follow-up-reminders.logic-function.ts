import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_FOLLOW_UP_REMINDERS_ID } from 'src/constants/universal-identifiers';
import {
  FOLLOW_UP_DUE_WINDOW_HOURS,
  followUpReminders,
  type ReminderCandidate,
} from 'src/modules/lv-followups/utils/follow-up-reminders';
import { createCoreApiNotificationPort } from 'src/modules/lv-notifications/services/core-api-notification-port';
import { dispatchNotifications } from 'src/modules/lv-notifications/services/notification-service';

// Every 15 minutes: FOLLOW_UP_DUE for open tasks entering their due window and
// FOLLOW_UP_OVERDUE for open tasks past it. Follow-ups are Twenty tasks, so
// this reads `task`, not a bespoke table.
//
// Safe to run as often as you like: the notification dedupe key is
// (type, task, dueAt), so a re-run, a restarted worker or two overlapping
// sweeps produce exactly one reminder per state per due time. Rescheduling a
// task moves dueAt and legitimately earns a fresh reminder.

type TaskRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  dueAt?: string | null;
  assigneeId?: string | null;
  lvPriority?: string | null;
  taskTargets?: { edges?: { node?: { targetLvLeadId?: string | null } }[] } | null;
};

const PAGE = 200;

export const handler = async (): Promise<Record<string, unknown>> => {
  const client = new CoreApiClient({ runAs: 'application' });
  const now = new Date().toISOString();
  const horizon = new Date(
    Date.parse(now) + FOLLOW_UP_DUE_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  // Open, assigned, and due before the far edge of the window. Anything later
  // cannot need a reminder yet; anything DONE never does.
  const result = await client.query({
    tasks: {
      __args: {
        first: PAGE,
        filter: {
          status: { neq: 'DONE' },
          dueAt: { lte: horizon },
          assigneeId: { is: 'NOT_NULL' },
        },
        orderBy: [{ dueAt: 'AscNullsLast' }],
      },
      edges: {
        node: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          assigneeId: true,
          lvPriority: true,
          taskTargets: { edges: { node: { targetLvLeadId: true } } },
        },
      },
    },
  });

  const rows =
    (result as { tasks?: { edges?: { node?: TaskRow }[] } }).tasks?.edges
      ?.map((edge) => edge.node)
      .filter((node): node is TaskRow => Boolean(node?.id)) ?? [];

  const leadIdOf = (row: TaskRow): string | null =>
    row.taskTargets?.edges
      ?.map((edge) => edge.node?.targetLvLeadId)
      .find((id): id is string => typeof id === 'string') ?? null;

  const leadIds = [...new Set(rows.map(leadIdOf).filter((id): id is string => id !== null))];
  const leadNames = new Map<string, string>();

  if (leadIds.length > 0) {
    const leads = await client.query({
      lvLeads: {
        __args: { first: leadIds.length, filter: { id: { in: leadIds } } },
        edges: { node: { id: true, name: true } },
      },
    });

    for (const edge of (leads as { lvLeads?: { edges?: { node?: { id: string; name?: string | null } }[] } })
      .lvLeads?.edges ?? []) {
      if (edge.node?.id) {
        leadNames.set(edge.node.id, edge.node.name ?? '');
      }
    }
  }

  const candidates: ReminderCandidate[] = rows.map((row) => {
    const leadId = leadIdOf(row);

    return {
      id: row.id,
      title: row.title ?? 'Follow-up',
      status: row.status ?? null,
      dueAt: row.dueAt ?? null,
      assigneeWorkspaceMemberId: row.assigneeId ?? null,
      lvPriority: row.lvPriority ?? null,
      leadId,
      leadName: leadId ? (leadNames.get(leadId) ?? null) : null,
    };
  });

  const intents = followUpReminders({ tasks: candidates, now });

  const outcome = await dispatchNotifications({
    port: createCoreApiNotificationPort(client),
    intents,
    sourceEvent: 'cron:lv-follow-up-reminders',
    actorWorkspaceMemberId: null,
  });

  return {
    scanned: rows.length,
    candidates: intents.length,
    notified: outcome.created.length,
    duplicates: outcome.duplicates.length,
    truncated: rows.length === PAGE,
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_FOLLOW_UP_REMINDERS_ID,
  name: 'lv-follow-up-reminders',
  description:
    'Reminds assignees of follow-up tasks entering their due window or overdue; idempotent per task and due time',
  timeoutSeconds: 60,
  handler,
  cronTriggerSettings: { pattern: '*/15 * * * *' },
});
