import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  NOTIFICATIONS_ON_MEMBER_FIELD_ID,
  NOTIFICATION_BODY_FIELD_ID,
  NOTIFICATION_DEDUPE_KEY_FIELD_ID,
  NOTIFICATION_LINK_FIELD_ID,
  NOTIFICATION_NAME_FIELD_ID,
  NOTIFICATION_OBJECT_ID,
  NOTIFICATION_READ_FIELD_ID,
  NOTIFICATION_RECIPIENT_FIELD_ID,
  NOTIFICATION_TYPE_FIELD_ID,
} from 'src/constants/universal-identifiers';
import { type SelectOption } from 'src/modules/lv-core/constants/select-options.generated';

// Twenty ships no notification system — only ephemeral toasts and transactional
// email templates. This object is the foundation of lv-notifications.
//
// Phase 1 writes IN_APP records only. The `dedupeKey` is the idempotency
// guarantee ASSIGNMENT-SLA-NOTIFICATIONS.md asks for: writers upsert on it, so a
// retried logic function or a replayed database event cannot notify twice.

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
      universalIdentifier: NOTIFICATION_READ_FIELD_ID,
      type: FieldType.BOOLEAN,
      name: 'isRead',
      label: 'Read',
      icon: 'IconEye',
      defaultValue: false,
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
