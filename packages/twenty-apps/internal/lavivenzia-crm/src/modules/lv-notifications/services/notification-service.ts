import {
  deepLinkFor,
  type NotificationIntent,
} from 'src/modules/lv-notifications/utils/build-notification';

// The one place notifications are written.
//
// Every producer — assignment, reassignment, follow-up sweep, onboarding,
// document review, mentions, and the SLA engine — hands this service a list of
// intents built by the catalogue and lets it decide what actually gets stored.
// The service:
//
//   - drops the actor: nobody is notified about their own action
//   - drops intents with no recipient (an unowned lead has nobody to tell)
//   - de-duplicates within the batch on dedupeKey
//   - inserts each row and treats a unique violation on dedupeKey as
//     "already delivered", which is what makes a retried logic function or a
//     replayed database event a no-op rather than a second notification
//   - records the audit fields (triggeredBy, sourceEvent) from server-side
//     context, never from a request body
//
// It never resolves recipients itself. That is deliberate: the producer read the
// recipient off the record (owner, reviewer, assignee, mention), and the
// notification links the recipient to a record CM-004 lets them open.

export type NotificationRecord = {
  name: string;
  recipientId: string;
  notificationType: NotificationIntent['type'];
  body: string;
  deepLink: string;
  priority: NotificationIntent['priority'];
  isRead: false;
  dedupeKey: string;
  targetObject: NotificationIntent['target']['object'];
  targetRecordId: string;
  leadId: string | null;
  triggeredById: string | null;
  sourceEvent: string;
  emailStatus: 'NOT_APPLICABLE' | 'QUEUED';
  metadata: Record<string, unknown>;
};

export type NotificationWriteResult =
  | { outcome: 'CREATED'; id: string }
  | { outcome: 'DUPLICATE' };

export type NotificationPort = {
  // Inserts the row. MUST return DUPLICATE (not throw) when the dedupeKey
  // already exists, and MUST NOT update the existing row — an upsert would
  // reset isRead on a replay.
  createIfAbsent(record: NotificationRecord): Promise<NotificationWriteResult>;
};

export type DispatchInput = {
  port: NotificationPort;
  intents: readonly NotificationIntent[];
  // The server-derived event name, stored for audit ("lvLead.updated",
  // "cron:lv-follow-up-reminders").
  sourceEvent: string;
  // The workspace member whose action caused this, resolved server-side from
  // the database event or route context. Null for the system. This member is
  // never notified about their own action.
  actorWorkspaceMemberId: string | null;
};

export type DispatchOutcome = {
  created: { id: string; dedupeKey: string; recipientWorkspaceMemberId: string }[];
  duplicates: string[];
  // Intents the service refused to store, with the reason, so a caller can
  // report exactly what happened rather than a count.
  suppressed: { dedupeKey: string; reason: 'ACTOR_IS_RECIPIENT' | 'NO_RECIPIENT' | 'DUPLICATE_IN_BATCH' }[];
};

export const toNotificationRecord = ({
  intent,
  sourceEvent,
  actorWorkspaceMemberId,
}: {
  intent: NotificationIntent;
  sourceEvent: string;
  actorWorkspaceMemberId: string | null;
}): NotificationRecord => ({
  name: intent.title,
  recipientId: intent.recipientWorkspaceMemberId,
  notificationType: intent.type,
  body: intent.body,
  deepLink: deepLinkFor(intent.target),
  priority: intent.priority,
  isRead: false,
  dedupeKey: intent.dedupeKey,
  targetObject: intent.target.object,
  targetRecordId: intent.target.recordId,
  leadId: intent.leadId,
  triggeredById: actorWorkspaceMemberId,
  sourceEvent,
  emailStatus: intent.email ? 'QUEUED' : 'NOT_APPLICABLE',
  metadata: intent.metadata,
});

export const dispatchNotifications = async ({
  port,
  intents,
  sourceEvent,
  actorWorkspaceMemberId,
}: DispatchInput): Promise<DispatchOutcome> => {
  const outcome: DispatchOutcome = { created: [], duplicates: [], suppressed: [] };
  const seen = new Set<string>();

  for (const intent of intents) {
    if (!intent.recipientWorkspaceMemberId) {
      outcome.suppressed.push({ dedupeKey: intent.dedupeKey, reason: 'NO_RECIPIENT' });
      continue;
    }

    if (
      actorWorkspaceMemberId !== null &&
      intent.recipientWorkspaceMemberId === actorWorkspaceMemberId
    ) {
      outcome.suppressed.push({ dedupeKey: intent.dedupeKey, reason: 'ACTOR_IS_RECIPIENT' });
      continue;
    }

    if (seen.has(intent.dedupeKey)) {
      outcome.suppressed.push({ dedupeKey: intent.dedupeKey, reason: 'DUPLICATE_IN_BATCH' });
      continue;
    }

    seen.add(intent.dedupeKey);

    const result = await port.createIfAbsent(
      toNotificationRecord({ intent, sourceEvent, actorWorkspaceMemberId }),
    );

    if (result.outcome === 'CREATED') {
      outcome.created.push({
        id: result.id,
        dedupeKey: intent.dedupeKey,
        recipientWorkspaceMemberId: intent.recipientWorkspaceMemberId,
      });
    } else {
      outcome.duplicates.push(intent.dedupeKey);
    }
  }

  return outcome;
};
