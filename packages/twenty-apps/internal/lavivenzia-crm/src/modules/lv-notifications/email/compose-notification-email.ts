import { BRAND } from 'src/modules/lv-core/ui/theme';
import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';
import { type NotificationType } from 'src/modules/lv-notifications/utils/build-notification';

// Renders one notification as an email. Plain HTML with inline styles and a
// text alternative — the safest thing to send to an unknown mail client, and
// small enough to live in a bundled function. Colours are the LV brand tokens
// so the mail is recognisably ours and not a generic Twenty template.

export type EmailableNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  priority: LeadPriority;
  deepLink: string;
  createdAt: string;
};

export type ComposedEmail = {
  subject: string;
  text: string;
  html: string;
};

const TYPE_LABEL: Record<NotificationType, string> = {
  LEAD_ASSIGNED: 'Lead assigned',
  LEAD_REASSIGNED: 'Lead reassigned',
  FOLLOW_UP_DUE: 'Follow-up due',
  FOLLOW_UP_OVERDUE: 'Follow-up overdue',
  SLA_BREACH: 'SLA breach',
  LEAD_REPLIED: 'Lead replied',
  ONBOARDING_STARTED: 'Onboarding started',
  ONBOARDING_COMPLETED: 'Onboarding completed',
  DOCUMENT_REJECTED: 'Document rejected',
  APPROVAL_REQUIRED: 'Approval required',
  MENTION: 'Mention',
  ESCALATION: 'Escalation',
  SLA_DUE_SOON: 'SLA due soon',
  SLA_DUE: 'SLA due',
};

const PRIORITY_COLOUR: Record<LeadPriority, string> = {
  CRITICAL: '#A32020',
  HIGH: '#B57A0B',
  MEDIUM: BRAND.sage,
  LOW: '#5C5C5C',
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const composeNotificationEmail = ({
  notification,
  recipientFirstName,
  appBaseUrl,
}: {
  notification: EmailableNotification;
  recipientFirstName: string | null;
  appBaseUrl: string | null;
}): ComposedEmail => {
  const label = TYPE_LABEL[notification.type];
  const link = appBaseUrl ? `${appBaseUrl}${notification.deepLink}` : notification.deepLink;
  const greeting = recipientFirstName ? `Hi ${recipientFirstName},` : 'Hello,';
  const urgent = notification.priority === 'CRITICAL' || notification.priority === 'HIGH';
  const subject = `${urgent ? '[Action needed] ' : ''}${label}: ${notification.title}`;

  const text = [
    greeting,
    '',
    `${label} — ${notification.title}`,
    notification.body,
    '',
    `Open in La Vivenzia CRM: ${link}`,
    '',
    'You are receiving this because it needs your attention. Everything else stays in the in-app notification centre.',
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:${BRAND.sand};font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:${BRAND.charcoal};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E4DFD4;border-radius:12px;">
    <tr><td style="padding:20px 24px;border-bottom:3px solid ${BRAND.warmGold};">
      <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.pineGreen};font-weight:600;">La Vivenzia CRM</div>
    </td></tr>
    <tr><td style="padding:24px;">
      <p style="margin:0 0 16px 0;">${escapeHtml(greeting)}</p>
      <div style="display:inline-block;padding:2px 10px;border-radius:999px;background:${PRIORITY_COLOUR[notification.priority]};color:#ffffff;font-size:11px;font-weight:600;">${escapeHtml(label)} · ${escapeHtml(notification.priority.toLowerCase())}</div>
      <h1 style="font-size:18px;margin:12px 0 8px 0;color:${BRAND.pineGreen};">${escapeHtml(notification.title)}</h1>
      <p style="margin:0 0 20px 0;line-height:1.5;">${escapeHtml(notification.body)}</p>
      <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:${BRAND.pineGreen};color:#ffffff;text-decoration:none;font-weight:500;">Open in La Vivenzia CRM</a>
    </td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid #E4DFD4;font-size:12px;color:#5C5C5C;">
      You are receiving this because it needs your attention. Everything else stays in the in-app notification centre.
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
};
