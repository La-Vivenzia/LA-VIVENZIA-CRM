// SMTP settings for notification email, read from the application variables
// Twenty injects into logic functions. These are the workspace's own settings
// (Settings → Applications → La Vivenzia CRM), the mechanism Twenty provides
// for an application's configuration and secrets — not a parallel config
// system, and never committed.
//
// Why not Twenty's built-in mailer: the server's EmailService is an internal
// Nest provider that an application function cannot reach, and the workflow
// "send email" step requires a connected Gmail/Microsoft/IMAP mailbox per
// user. Neither is available to background automation, so the application
// speaks SMTP itself with the same library the server uses (nodemailer).

export const SMTP_VARIABLE_NAMES = {
  host: 'LV_SMTP_HOST',
  port: 'LV_SMTP_PORT',
  secure: 'LV_SMTP_SECURE',
  user: 'LV_SMTP_USER',
  password: 'LV_SMTP_PASSWORD',
  from: 'LV_EMAIL_FROM',
  appBaseUrl: 'LV_APP_BASE_URL',
} as const;

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string } | null;
  from: string;
  // Prefix for deep links in the email body. Falls back to a relative path
  // (still correct inside the app) when unset.
  appBaseUrl: string | null;
};

export type SmtpConfigResult =
  | { ok: true; config: SmtpConfig }
  | { ok: false; missing: string[] };

const REQUIRED: (keyof typeof SMTP_VARIABLE_NAMES)[] = ['host', 'from'];

export const readSmtpConfig = (
  env: Record<string, string | undefined>,
): SmtpConfigResult => {
  const read = (key: keyof typeof SMTP_VARIABLE_NAMES): string | null => {
    const value = env[SMTP_VARIABLE_NAMES[key]];

    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  };

  const missing = REQUIRED.filter((key) => read(key) === null).map(
    (key) => SMTP_VARIABLE_NAMES[key],
  );

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const port = Number.parseInt(read('port') ?? '587', 10);
  const user = read('user');
  const password = read('password');
  const secureRaw = read('secure');

  return {
    ok: true,
    config: {
      host: read('host') as string,
      port: Number.isFinite(port) && port > 0 ? port : 587,
      // Default: implicit TLS on 465, STARTTLS otherwise — nodemailer's own
      // convention, made explicit so a misconfiguration is one line to read.
      secure: secureRaw === null ? port === 465 : secureRaw.toLowerCase() === 'true',
      auth: user !== null && password !== null ? { user, pass: password } : null,
      from: read('from') as string,
      appBaseUrl: read('appBaseUrl')?.replace(/\/+$/, '') ?? null,
    },
  };
};
