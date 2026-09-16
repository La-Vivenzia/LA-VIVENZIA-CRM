import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  LEAD_OBJECT_ID,
  NOTIFICATIONS_ON_LEAD_FIELD_ID,
  NOTIFICATIONS_ON_MEMBER_FIELD_ID,
  NOTIFICATION_BODY_FIELD_ID,
  NOTIFICATION_DEDUPE_KEY_FIELD_ID,
  NOTIFICATION_EMAIL_ERROR_FIELD_ID,
  NOTIFICATION_EMAIL_SENT_AT_FIELD_ID,
  NOTIFICATION_EMAIL_STATUS_FIELD_ID,
  NOTIFICATION_LEAD_FIELD_ID,
  NOTIFICATION_LINK_FIELD_ID,
  NOTIFICATION_METADATA_FIELD_ID,
  NOTIFICATION_NAME_FIELD_ID,
  NOTIFICATION_OBJECT_ID,
  NOTIFICATION_PRIORITY_FIELD_ID,
  NOTIFICATION_READ_AT_FIELD_ID,
  NOTIFICATION_READ_FIELD_ID,
  NOTIFICATION_RECIPIENT_FIELD_ID,
  NOTIFICATION_SOURCE_EVENT_FIELD_ID,
  NOTIFICATION_TARGET_OBJECT_FIELD_ID,
  NOTIFICATION_TARGET_RECORD_FIELD_ID,
  NOTIFICATION_TRIGGERED_BY_FIELD_ID,
  NOTIFICATION_TYPE_FIELD_ID,
  TRIGGERED_NOTIFICATIONS_ON_MEMBER_FIELD_ID,
} from 'src/constants/universal-identifiers';
import {
  LEAD_PRIORITY_OPTIONS,
  type SelectOption,
} from 'src/modules/lv-core/constants/select-options.generated';

// Twenty ships no notification system — only ephemeral toasts and transactional
// email templates. This object is the foundation of lv-notifications.
//
// Every row is written by the central notification service
// (services/notification-service.ts), never by a producer directly. The
// `dedupeKey` is the idempotency guarantee ASSIGNMENT-SLA-NOTIFICATIONS.md asks
// for: the service inserts and treats a unique violation as "already sent", so a
// retried logic function or a replayed database event cannot notify twice — and
// cannot flip an already-read notification back to unread, which an upsert
// would have done.
//
// Who may read a row is decided server-side by CM-004: a governed role only
// ever sees notifications where it is the recipient.

// Email is a second channel behind in-app, and only for the handful of types
// where interrupting someone outside the CRM is warranted. The status records
// what actually happened to the message — a row never claims SENT unless the
// SMTP server accepted it.
const EMAIL_STATUS_OPTIONS: SelectOption[] = [
  { id: '2a7c1e3b-4d5f-4a6b-8c7d-9e0f1a2b3c4d', value: 'NOT_APPLICABLE', label: 'Not applicable', position: 0, color: 'gray' },
  { id: '3b8d2f4c-5e6a-4b7c-9d8e-0f1a2b3c4d5e', value: 'QUEUED', label: 'Queued', position: 1, color: 'yellow' },
  { id: '4c9e3a5d-6f7b-4c8d-8e9f-1a2b3c4d5e6f', value: 'SENT', label: 'Sent', position: 2, color: 'green' },
  { id: '5daf4b6e-7a8c-4d9e-9fa0-2b3c4d5e6f7a', value: 'FAILED', label: 'Failed', position: 3, color: 'red' },
  { id: '6eb05c7f-8b9d-4eaf-8ab1-3c4d5e6f7a8b', value: 'SKIPPED_NO_PROVIDER', label: 'Skipped (no provider)', position: 4, color: 'orange' },
];

const TYPE_OPTIONS: SelectOption[] = [
  { id: 'c1d2e3f4-a5b6-4c71-8d92-1e2f3a4b5c60', value: 'LEAD_ASSIGNED', label: 'Lead assigned', position: 0, color: 'green' },
  { id: 'd2e3f4a5-b6c7-4d82-9ea3-2f3a4b5c6d71', value: 'LEAD_REASSIGNED', label: 'Lead reassigned', position: 1, color: 'turquoise' },
  { id: 'e3f4a5b6-c7d8-4e93-8fb4-3a4b5c6d7e82', value: 'FOLLOW_UP_DUE', label: 'Follow-up due', position: 2, color: 'yellow' },
  { id: 'f4a5b6c7-d8e9-4fa4-9ac5-4b5c6d7e8f93', value: 'FOLLOW_UP_OVERDUE', label: 'Follow-up overdue', position: 3, color: 'orange' },
  { id: 'a5b6c7d8-e9fa-4ab5-8bd6-5c6d7e8f9a04', value: 'SLA_BREACH', label: 'SLA breach', position: 4, color: 'red' },
  { id: 'b6c7d8e9-fa0b-4bc6-9ce7-6d7e8f9a0b15', value: 'LEAD_REPLIED', label: 'Lead replied', position: 5, color: 'blue' },
  { id: 'c7d8e9fa-0b1c-4cd7-8df8-7e8f9a0b1c26', value: 'ONBOARDING_STARTED', label: 'Onboarding started', position: 6, color: 'purple' },
  { id: 'd8e9fa0b-1c2d-4de8-9ea9-8f9a0b1c2d37', value: 'ONBOARDING_COMPLETED', label: 'Onboarding completed', position: 7, color: 'green' },
  { id: 'e9fa0b1c-2d3e-4ef9-8fba-9a0b1c2d3e48', value: 'DOCUMENT_REJECTED', label: 'Document rejected', position: 8, color: 'red' },
  { id: 'fa0b1c2d-3e4f-4a0a-9acb-0b1c2d3e4f59', value: 'APPROVAL_REQUIRED', label: 'Approval required', position: 9, color: 'orange' },
  { id: '0b1c2d3e-4f5a-4b1b-8bdc-1c2d3e4f5a6a', value: 'MENTION', label: 'Mention', position: 10, color: 'sky' },
  { id: '1c2d3e4f-5a6b-4c2c-9ced-2d3e4f5a6b7b', value: 'ESCALATION', label: 'Escalation', position: 11, color: 'red' },
  { id: '2d3e4f5a-6b7c-4d3d-8dfe-3e4f5a6b7c8c', value: 'SLA_DUE_SOON', label: 'SLA due soon', position: 12, color: 'yellow' },
  { id: '3e4f5a6b-7c8d-4e4e-9eaf-4f5a6b7c8d9d', value: 'SLA_DUE', label: 'SLA due', position: 13, color: 'orange' },
  { id: '4f5a6b7c-8d9e-4f5f-8fb0-5a6b7c8d9eae', value: 'EXPERIENCE_APPROVAL_REQUIRED', label: 'Experience approval required', position: 14, color: 'orange' },
  { id: '5a6b7c8d-9eaf-4a6a-9ac1-6b7c8d9eafbf', value: 'PROPERTY_APPROVAL_REQUIRED', label: 'Property approval required', position: 15, color: 'orange' },
  { id: '6b7c8d9e-afb0-4b7b-8bd2-7c8d9eafb0c0', value: 'ACTIVATION_READY', label: 'Activation ready', position: 16, color: 'green' },
  { id: '7c8d9eaf-b0c1-4c8c-9ce3-8d9eafb0c1d1', value: 'PARTNER_CREATED', label: 'Partner created', position: 17, color: 'green' },
];

export default defineObject({
  universalIdentifier: NOTIFICATION_OBJECT_ID,
  nameSingular: 'lvNotification',
  namePlural: 'lvNotifications',
  labelSingular: 'Notification',
  labelPlural: 'Notifications',
  description: 'In-app notification for a team member',
  icon: 'IconBell',
  isSearchable: false,
  labelIdentifierFieldMetadataUniversalIdentifier: NOTIFICATION_NAME_FIELD_ID,
  fields: [
    {
      universalIdentifier: NOTIFICATION_NAME_FIELD_ID,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Title',
      icon: 'IconTag',
      defaultValue: "''",
    },
    {
      universalIdentifier: NOTIFICATION_RECIPIENT_FIELD_ID,
      type: FieldType.RELATION,
      name: 'recipient',
      label: 'Recipient',
      icon: 'IconUser',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        NOTIFICATIONS_ON_MEMBER_FIELD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'recipientId',
      },
    },
    {
      universalIdentifier: NOTIFICATION_TYPE_FIELD_ID,
      type: FieldType.SELECT,
      // `type` is reserved by the metadata engine, which would otherwise
      // silently append a "Custom" suffix.
      name: 'notificationType',
      label: 'Type',
      icon: 'IconCategory',
      isNullable: true,
      options: TYPE_OPTIONS,
    },
    {
      universalIdentifier: NOTIFICATION_BODY_FIELD_ID,
      type: FieldType.TEXT,
      name: 'body',
      label: 'Body',
      icon: 'IconMessage',
      isNullable: true,
    },
    {
      universalIdentifier: NOTIFICATION_LINK_FIELD_ID,
      type: FieldType.TEXT,
      name: 'deepLink',
      label: 'Link',
      description: 'Relative path the notification centre routes to',
      icon: 'IconLink',
      isNullable: true,
    },
    {
      universalIdentifier: NOTIFICATION_PRIORITY_FIELD_ID,
      type: FieldType.SELECT,
      name: 'priority',
      label: 'Priority',
      icon: 'IconFlag',
      isNullable: true,
      // Same four levels as a lead, so the centre can sort them together.
      options: LEAD_PRIORITY_OPTIONS,
    },
    {
      universalIdentifier: NOTIFICATION_READ_FIELD_ID,
      type: FieldType.BOOLEAN,
      name: 'isRead',
      label: 'Read',
      icon: 'IconEye',
      defaultValue: false,
    },
    {
      universalIdentifier: NOTIFICATION_READ_AT_FIELD_ID,
      type: FieldType.DATE_TIME,
      name: 'readAt',
      label: 'Read at',
      icon: 'IconEyeCheck',
      isNullable: true,
    },
    {
      universalIdentifier: NOTIFICATION_TARGET_OBJECT_FIELD_ID,
      type: FieldType.TEXT,
      name: 'targetObject',
      label: 'Target object',
      description:
        'nameSingular of the record the notification is about (lvLead, lvOnboarding, task, note)',
      icon: 'IconTarget',
      isNullable: true,
    },
    {
      universalIdentifier: NOTIFICATION_TARGET_RECORD_FIELD_ID,
      type: FieldType.UUID,
      name: 'targetRecordId',
      label: 'Target record',
      icon: 'IconTarget',
      isNullable: true,
    },
    {
      // Real relation for the common case, so a lead can list its own
      // notifications and the centre can show the lead's name without a second
      // query. targetObject/targetRecordId stay the generic pointer for
      // notifications about tasks, notes and onboardings.
      universalIdentifier: NOTIFICATION_LEAD_FIELD_ID,
      type: FieldType.RELATION,
      name: 'lead',
      label: 'Lead',
      icon: 'IconUserSearch',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: LEAD_OBJECT_ID,
      relationTargetFieldMetadataUniversalIdentifier: NOTIFICATIONS_ON_LEAD_FIELD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        // Notifications are history. Deleting a lead should not erase who was
        // told what, so the pointer is cleared rather than the row removed.
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'leadId',
      },
    },
    {
      // Audit: who caused this notification. Resolved server-side from the
      // triggering event, never from a request body. Null for the system.
      universalIdentifier: NOTIFICATION_TRIGGERED_BY_FIELD_ID,
      type: FieldType.RELATION,
      name: 'triggeredBy',
      label: 'Triggered by',
      icon: 'IconUserBolt',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        TRIGGERED_NOTIFICATIONS_ON_MEMBER_FIELD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'triggeredById',
      },
    },
    {
      universalIdentifier: NOTIFICATION_SOURCE_EVENT_FIELD_ID,
      type: FieldType.TEXT,
      name: 'sourceEvent',
      label: 'Source event',
      description: 'The server-side event that produced this notification',
      icon: 'IconBolt',
      isNullable: true,
    },
    {
      universalIdentifier: NOTIFICATION_EMAIL_STATUS_FIELD_ID,
      type: FieldType.SELECT,
      name: 'emailStatus',
      label: 'Email',
      icon: 'IconMail',
      isNullable: true,
      options: EMAIL_STATUS_OPTIONS,
    },
    {
      universalIdentifier: NOTIFICATION_EMAIL_SENT_AT_FIELD_ID,
      type: FieldType.DATE_TIME,
      name: 'emailSentAt',
      label: 'Email sent at',
      icon: 'IconMailCheck',
      isNullable: true,
    },
    {
      universalIdentifier: NOTIFICATION_EMAIL_ERROR_FIELD_ID,
      type: FieldType.TEXT,
      name: 'emailError',
      label: 'Email error',
      icon: 'IconMailX',
      isNullable: true,
    },
    {
      universalIdentifier: NOTIFICATION_METADATA_FIELD_ID,
      type: FieldType.RAW_JSON,
      name: 'metadata',
      label: 'Metadata',
      description: 'Event-specific detail (reason, previous owner, due time)',
      icon: 'IconBraces',
      isNullable: true,
    },
    {
      universalIdentifier: NOTIFICATION_DEDUPE_KEY_FIELD_ID,
      type: FieldType.TEXT,
      name: 'dedupeKey',
      label: 'Dedupe key',
      description:
        'Idempotency key. Writers upsert on this so a retry never notifies twice.',
      icon: 'IconFingerprint',
      isNullable: true,
      isUnique: true,
    },
  ],
});
