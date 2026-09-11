import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  NOTIFICATION_OBJECT_ID,
  NOTIFICATION_TRIGGERED_BY_FIELD_ID,
  TRIGGERED_NOTIFICATIONS_ON_MEMBER_FIELD_ID,
} from 'src/constants/universal-identifiers';

// Reverse side of lvNotification.triggeredBy.

export default defineField({
  universalIdentifier: TRIGGERED_NOTIFICATIONS_ON_MEMBER_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'lvTriggeredNotifications',
  label: 'Triggered notifications',
  icon: 'IconBellRinging',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: NOTIFICATION_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: NOTIFICATION_TRIGGERED_BY_FIELD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
