import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  LEAD_OBJECT_ID,
  NOTIFICATIONS_ON_LEAD_FIELD_ID,
  NOTIFICATION_LEAD_FIELD_ID,
  NOTIFICATION_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// Reverse side of lvNotification.lead.

export default defineField({
  universalIdentifier: NOTIFICATIONS_ON_LEAD_FIELD_ID,
  objectUniversalIdentifier: LEAD_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'notifications',
  label: 'Notifications',
  icon: 'IconBell',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: NOTIFICATION_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: NOTIFICATION_LEAD_FIELD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
