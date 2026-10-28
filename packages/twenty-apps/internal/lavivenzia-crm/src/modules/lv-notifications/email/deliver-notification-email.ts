import {
  composeNotificationEmail,
  type EmailableNotification,
} from 'src/modules/lv-notifications/email/compose-notification-email';
import {
  type SmtpConfig,
  type SmtpConfigResult,
} from 'src/modules/lv-notifications/email/smtp-config';
import { describeError } from 'src/modules/lv-core/utils/describe-error';

// Delivery of one queued notification email, with the outcome reported
// honestly. Three results are possible and each is written back to the row:
//
//   SENT                 the SMTP server accepted the message for the recipient
//   FAILED               transport error or the server rejected the address
//   SKIPPED_NO_PROVIDER  no SMTP configuration in this workspace — the mail
//                        was composed but nothing was sent, and the row says so
//
// The transport is injected so the pipeline can be exercised end-to-end in
// tests with nodemailer's own in-memory transports, without pretending a
// network send happened.

export type MailTransport = {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    headers?: Record<string, string>;
  }): Promise<{ accepted?: (string | { address: string })[]; rejected?: unknown[] }>;
};

export type EmailDeliveryResult =
  | { status: 'SENT'; sentAt: string }
  | { status: 'FAILED'; error: string }
  | { status: 'SKIPPED_NO_PROVIDER'; error: string };

export const deliverNotificationEmail = async ({
  notification,
  recipient,
  smtp,
  createTransport,
  now,
}: {
  notification: EmailableNotification;
  recipient: { email: string | null; firstName: string | null };
  smtp: SmtpConfigResult;
  createTransport: (config: SmtpConfig) => MailTransport;
  now: string;
}): Promise<EmailDeliveryResult> => {
  if (!smtp.ok) {
    return {
      status: 'SKIPPED_NO_PROVIDER',
      error: `SMTP not configured: set ${smtp.missing.join(', ')} in the application variables.`,
    };
  }

  if (!recipient.email) {
    return { status: 'FAILED', error: 'Recipient has no email address.' };
  }

  if (recipient.email.toLowerCase().includes('.sandbox.lavivenzia.internal') || recipient.email.toLowerCase().endsWith('.internal')) {
    return { status: 'SKIPPED_NO_PROVIDER', error: 'Sandbox email recipient: outbound delivery quarantined.' };
  }

  const composed = composeNotificationEmail({
    notification,
    recipientFirstName: recipient.firstName,
    appBaseUrl: smtp.config.appBaseUrl,
  });

  try {
    const transport = createTransport(smtp.config);
    const info = await transport.sendMail({
      from: smtp.config.from,
      to: recipient.email,
      subject: composed.subject,
      text: composed.text,
      html: composed.html,
      // Lets a mail admin trace a message back to the exact notification row.
      headers: { 'X-LV-Notification-Id': notification.id },
    });

    // A real SMTP transport reports per-recipient accepted/rejected lists. An
    // empty accepted list with the address rejected is a failure even though
    // sendMail resolved. Transports that report neither (stream/json in tests)
    // are trusted when they resolve.
    const rejected = info.rejected ?? [];
    const accepted = info.accepted;

    if (rejected.length > 0 || (Array.isArray(accepted) && accepted.length === 0)) {
      return { status: 'FAILED', error: 'SMTP server did not accept the recipient.' };
    }

    return { status: 'SENT', sentAt: now };
  } catch (error) {
    return {
      status: 'FAILED',
      error: (describeError(error)).slice(0, 500),
    };
  }
};
