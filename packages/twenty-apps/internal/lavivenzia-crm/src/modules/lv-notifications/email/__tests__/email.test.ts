import nodemailer from 'nodemailer';
import { describe, expect, it } from 'vitest';

import { composeNotificationEmail } from 'src/modules/lv-notifications/email/compose-notification-email';
import {
  deliverNotificationEmail,
  type MailTransport,
} from 'src/modules/lv-notifications/email/deliver-notification-email';
import { readSmtpConfig } from 'src/modules/lv-notifications/email/smtp-config';

const NOW = '2026-09-11T10:00:00.000Z';

const aNotification = () => ({
  id: 'n-1',
  type: 'SLA_BREACH' as const,
  title: 'SLA breached: New lead contact — Forest Table',
  body: 'Was due 2026-09-10 10:00 UTC and has not been actioned.',
  priority: 'HIGH' as const,
  deepLink: '/object/lvLead/lead-1',
  createdAt: NOW,
});

describe('readSmtpConfig', () => {
  it('reports exactly which variables are missing', () => {
    const result = readSmtpConfig({});

    expect(result).toEqual({ ok: false, missing: ['LV_SMTP_HOST', 'LV_EMAIL_FROM'] });
  });

  it('builds a config with sensible defaults', () => {
    const result = readSmtpConfig({
      LV_SMTP_HOST: 'smtp.example.com',
      LV_EMAIL_FROM: 'crm@lavivenzia.com',
    });

    expect(result).toEqual({
      ok: true,
      config: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: null,
        from: 'crm@lavivenzia.com',
        appBaseUrl: null,
      },
    });
  });

  it('infers implicit TLS on 465 and honours an explicit override', () => {
    const base = { LV_SMTP_HOST: 'h', LV_EMAIL_FROM: 'f' };

    expect(readSmtpConfig({ ...base, LV_SMTP_PORT: '465' })).toMatchObject({
      config: { port: 465, secure: true },
    });
    expect(readSmtpConfig({ ...base, LV_SMTP_PORT: '465', LV_SMTP_SECURE: 'false' })).toMatchObject({
      config: { secure: false },
    });
  });

  it('only sets auth when both user and password are present', () => {
    const base = { LV_SMTP_HOST: 'h', LV_EMAIL_FROM: 'f' };

    expect(readSmtpConfig({ ...base, LV_SMTP_USER: 'u' })).toMatchObject({
      config: { auth: null },
    });
    expect(readSmtpConfig({ ...base, LV_SMTP_USER: 'u', LV_SMTP_PASSWORD: 'p' })).toMatchObject({
      config: { auth: { user: 'u', pass: 'p' } },
    });
  });

  it('strips a trailing slash from the app URL', () => {
    expect(
      readSmtpConfig({ LV_SMTP_HOST: 'h', LV_EMAIL_FROM: 'f', LV_APP_BASE_URL: 'https://crm.x/' }),
    ).toMatchObject({ config: { appBaseUrl: 'https://crm.x' } });
  });
});

describe('composeNotificationEmail', () => {
  it('produces subject, text and html with an absolute deep link', () => {
    const email = composeNotificationEmail({
      notification: aNotification(),
      recipientFirstName: 'Tim',
      appBaseUrl: 'https://crm.lavivenzia.com',
    });

    expect(email.subject).toBe(
      '[Action needed] SLA breach: SLA breached: New lead contact — Forest Table',
    );
    expect(email.text).toContain('Hi Tim,');
    expect(email.text).toContain('https://crm.lavivenzia.com/object/lvLead/lead-1');
    expect(email.html).toContain('href="https://crm.lavivenzia.com/object/lvLead/lead-1"');
  });

  it('does not flag ordinary priority as action needed', () => {
    const email = composeNotificationEmail({
      notification: { ...aNotification(), priority: 'MEDIUM' },
      recipientFirstName: null,
      appBaseUrl: null,
    });

    expect(email.subject.startsWith('[Action needed]')).toBe(false);
    expect(email.text).toContain('Hello,');
  });

  it('escapes html in user-supplied text', () => {
    const email = composeNotificationEmail({
      notification: { ...aNotification(), title: '<script>x</script>' },
      recipientFirstName: null,
      appBaseUrl: null,
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });
});

describe('deliverNotificationEmail', () => {
  const recipient = { email: 'tim@apple.dev', firstName: 'Tim' };

  it('does not fake a send when SMTP is not configured', async () => {
    let transportCreated = false;

    const result = await deliverNotificationEmail({
      notification: aNotification(),
      recipient,
      smtp: readSmtpConfig({}),
      createTransport: () => {
        transportCreated = true;

        throw new Error('must not be called');
      },
      now: NOW,
    });

    expect(result.status).toBe('SKIPPED_NO_PROVIDER');
    expect(transportCreated).toBe(false);
  });

  it('fails cleanly when the recipient has no email', async () => {
    const result = await deliverNotificationEmail({
      notification: aNotification(),
      recipient: { email: null, firstName: null },
      smtp: readSmtpConfig({ LV_SMTP_HOST: 'h', LV_EMAIL_FROM: 'f' }),
      createTransport: () => {
        throw new Error('must not be called');
      },
      now: NOW,
    });

    expect(result).toEqual({ status: 'FAILED', error: 'Recipient has no email address.' });
  });

  it('quarantines delivery when recipient email is in sandbox domain', async () => {
    let transportCreated = false;

    const result = await deliverNotificationEmail({
      notification: aNotification(),
      recipient: { email: 'contact@neonbyte.sandbox.lavivenzia.internal', firstName: 'Neon' },
      smtp: readSmtpConfig({ LV_SMTP_HOST: 'h', LV_EMAIL_FROM: 'f' }),
      createTransport: () => {
        transportCreated = true;
        throw new Error('must not be called');
      },
      now: NOW,
    });

    expect(result.status).toBe('SKIPPED_NO_PROVIDER');
    if (result.status === 'SKIPPED_NO_PROVIDER') {
      expect(result.error).toContain('Sandbox email recipient');
    }
    expect(transportCreated).toBe(false);
  });

  it('passes a real nodemailer message through the transport (jsonTransport, no network)', async () => {
    const captured: unknown[] = [];
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const wrapped: MailTransport = {
      sendMail: async (options) => {
        const info = await transport.sendMail(options);

        captured.push(JSON.parse(info.message as string));

        return info;
      },
    };

    const result = await deliverNotificationEmail({
      notification: aNotification(),
      recipient,
      smtp: readSmtpConfig({ LV_SMTP_HOST: 'h', LV_EMAIL_FROM: 'La Vivenzia <crm@lavivenzia.com>' }),
      createTransport: () => wrapped,
      now: NOW,
    });

    expect(result).toEqual({ status: 'SENT', sentAt: NOW });
    expect(captured[0]).toMatchObject({
      to: [{ address: 'tim@apple.dev' }],
      from: { address: 'crm@lavivenzia.com', name: 'La Vivenzia' },
      subject: expect.stringContaining('SLA breach'),
      headers: { 'X-LV-Notification-Id': 'n-1' },
    });
  });

  it('reports a transport error as FAILED with the message', async () => {
    const result = await deliverNotificationEmail({
      notification: aNotification(),
      recipient,
      smtp: readSmtpConfig({ LV_SMTP_HOST: 'h', LV_EMAIL_FROM: 'f' }),
      createTransport: () => ({
        sendMail: async () => {
          throw new Error('ECONNREFUSED 127.0.0.1:587');
        },
      }),
      now: NOW,
    });

    expect(result).toEqual({ status: 'FAILED', error: 'ECONNREFUSED 127.0.0.1:587' });
  });

  it('treats zero accepted recipients as a failure, not a send', async () => {
    const result = await deliverNotificationEmail({
      notification: aNotification(),
      recipient,
      smtp: readSmtpConfig({ LV_SMTP_HOST: 'h', LV_EMAIL_FROM: 'f' }),
      createTransport: () => ({ sendMail: async () => ({ accepted: [], rejected: ['x'] }) }),
      now: NOW,
    });

    expect(result.status).toBe('FAILED');
  });
});
