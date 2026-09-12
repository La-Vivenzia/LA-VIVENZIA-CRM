import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  AUDIT_EVENTS_ON_MEMBER_ID,
  AUDIT_EVENT_ACTOR_ID,
  AUDIT_EVENT_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// Reverse side of lvAuditEvent.actor.

export default defineField({
  universalIdentifier: AUDIT_EVENTS_ON_MEMBER_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'lvAuditEvents',
  label: 'Audit events',
  icon: 'IconShieldLock',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: AUDIT_EVENT_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: AUDIT_EVENT_ACTOR_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
