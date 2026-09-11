import nodemailer from 'nodemailer';
import { CoreApiClient } from 'twenty-client-sdk/core';
import {
  defineLogicFunction,
  type DatabaseEventPayload,
  type ObjectRecordCreateEvent,
} from 'twenty-sdk/define';

import { FN_ON_NOTIFICATION_CREATED_ID } from 'src/constants/universal-identifiers';
import { priorityOrDefault } from 'src/modules/lv-core/constants/lead-lifecycle';
import {
  deliverNotificationEmail,
  type MailTransport,
} from 'src/modules/lv-notifications/email/deliver-notification-email';
import { readSmtpConfig, type SmtpConfig } from 'src/modules/lv-notifications/email/smtp-config';
import { findMember } from 'src/modules/lv-notifications/services/member-lookup';
import { isNotificationType } from 'src/modules/lv-notifications/utils/build-notification';

// Fires on lvNotification.created. The email channel.
//
// The service that created the row already decided whether email is
// warranted (emailStatus QUEUED). This function delivers it and writes the
// real outcome back — SENT, FAILED with the error, or SKIPPED_NO_PROVIDER when
// the workspace has no SMTP settings. A replay of the event finds the status
// no longer QUEUED and stops, so a retried worker cannot send twice.

type NotificationRow = {
  id: string;
  name?: string | null;
  body?: string | null;
  notificationType?: string | null;
  priority?: string | null;
  deepLink?: string | null;
  recipientId?: string | null;
  emailStatus?: string | null;
  createdAt?: string | null;
};

const createSmtpTransport = (config: SmtpConfig): MailTransport =>
  nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth ?? undefined,
    connectionTimeout: 10_000,
  }) as unknown as MailTransport;

export const handler = async (
  payload: DatabaseEventPayload<ObjectRecordCreateEvent<NotificationRow>>,
): Promise<Record<string, unknown>> => {
  const row = payload.properties.after;

  if (!row?.id) {
    return { delivered: false, reason: 'No record.' };
  }

  if (row.emailStatus !== 'QUEUED') {
    return { delivered: false, reason: 'Email not queued for this notification.' };
  }

  const client = new CoreApiClient({ runAs: 'application' });

  // Re-read the live status: a replayed event carries the original QUEUED
  // snapshot, but the row may already say SENT.
  const live = await client.query({
    lvNotification: {
      __args: { filter: { id: { eq: row.id } } },
      emailStatus: true,
    },
  });

  if ((live as { lvNotification?: { emailStatus?: string } }).lvNotification?.emailStatus !== 'QUEUED') {
    return { delivered: false, reason: 'Already handled.' };
  }

  const recipient = await findMember(client, row.recipientId);
  const type = row.notificationType && isNotificationType(row.notificationType)
    ? row.notificationType
    : 'ESCALATION';
  const now = new Date().toISOString();

  const result = await deliverNotificationEmail({
    notification: {
      id: row.id,
      type,
      title: row.name ?? '',
      body: row.body ?? '',
      priority: priorityOrDefault(row.priority),
      deepLink: row.deepLink ?? '/',
      createdAt: row.createdAt ?? now,
    },
    recipient: { email: recipient?.email ?? null, firstName: recipient?.firstName ?? null },
    smtp: readSmtpConfig(process.env),
    createTransport: createSmtpTransport,
    now,
  });

  await client.mutation({
    updateLvNotification: {
      __args: {
        id: row.id,
        data:
          result.status === 'SENT'
            ? { emailStatus: 'SENT', emailSentAt: result.sentAt, emailError: null }
            : { emailStatus: result.status, emailError: result.error },
      },
      id: true,
    },
  });

  return {
    delivered: result.status === 'SENT',
    status: result.status,
    error: result.status === 'SENT' ? null : result.error,
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_ON_NOTIFICATION_CREATED_ID,
  name: 'lv-on-notification-created',
  description:
    'Delivers the email channel for notifications the service queued for email, recording the real outcome on the row',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvNotification.created' },
});
