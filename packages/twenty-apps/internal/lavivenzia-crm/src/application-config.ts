import { defineApplication } from 'twenty-sdk/define';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Application variables are the workspace's own settings for this app
// (Settings → Applications → La Vivenzia CRM). Twenty injects them into the
// logic functions as environment variables. They are the supported place for
// an application's configuration and secrets — nothing here is committed, and
// a secret variable's value never leaves the server.
//
// Email is optional: with no SMTP settings the notification system still
// works in-app and records SKIPPED_NO_PROVIDER on rows that would have been
// emailed, rather than pretending they went out.

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'La Vivenzia CRM',
  description:
    'Lead capture, routing and relationship operations for the La Vivenzia experience ecosystem',
  author: 'La Vivenzia',
  category: 'Sales',
  applicationVariables: {
    LV_SMTP_HOST: {
      universalIdentifier: 'a20efc19-004d-4fc5-af31-a8bc92cd0311',
      label: 'SMTP host',
      description: 'Outgoing mail server for notification email. Leave empty to disable email.',
      value: '',
      isSecret: false,
    },
    LV_SMTP_PORT: {
      universalIdentifier: '9758798d-d724-46b2-9d93-cdc18a8a57ca',
      label: 'SMTP port',
      description: '587 for STARTTLS (default), 465 for implicit TLS.',
      value: '587',
      isSecret: false,
    },
    LV_SMTP_SECURE: {
      universalIdentifier: 'b00f189d-0860-4a56-9f1c-75fc1f5048a5',
      label: 'SMTP implicit TLS',
      description: '"true" for implicit TLS. Defaults to true on port 465, false otherwise.',
      value: '',
      isSecret: false,
    },
    LV_SMTP_USER: {
      universalIdentifier: '6a5eb0d5-4900-4feb-bdfe-9912bf152e4d',
      label: 'SMTP username',
      description: 'Leave empty for an unauthenticated relay.',
      value: '',
      isSecret: false,
    },
    LV_SMTP_PASSWORD: {
      universalIdentifier: 'f8f53938-4c40-4a73-844c-eec582f3975d',
      label: 'SMTP password',
      description: 'Stored encrypted; only the logic functions can read it.',
      isSecret: true,
    },
    LV_EMAIL_FROM: {
      universalIdentifier: '51d4581a-4e96-4925-8b20-039fb3b28b3a',
      label: 'Notification sender',
      description: 'From address for notification email, e.g. "La Vivenzia CRM <crm@lavivenzia.com>".',
      value: '',
      isSecret: false,
    },
    LV_ESCALATION_OWNER_EMAIL: {
      universalIdentifier: '33da88e9-0ca6-4fea-9f6b-5c022ab6f839',
      label: 'SLA escalation owner',
      description:
        'Workspace email of the team member who receives SLA escalations (the escalation task and notification). The La Vivenzia role model defines no manager mapping, so this is an explicit workspace decision; while empty, breached SLAs stay BREACHED with escalation blocked.',
      value: '',
      isSecret: false,
    },
    LV_APP_BASE_URL: {
      universalIdentifier: 'ec8485b3-9fbe-458d-9fd6-c4b82a4224de',
      label: 'CRM URL',
      description: 'Public URL of this CRM, used to build links in email (e.g. https://crm.lavivenzia.com).',
      value: '',
      isSecret: false,
    },
  },
});
