import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  ESCALATED_SLAS_ON_MEMBER_ID,
  SLA_ESCALATION_OWNER_ID,
  SLA_OBJECT_ID
} from 'src/constants/universal-identifiers';

// Reverse side of lvSla.escalationOwner.

export default defineField({
  universalIdentifier: ESCALATED_SLAS_ON_MEMBER_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'lvEscalatedSlas',
  label: 'SLAs escalated to',
  icon: 'IconUserUp',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: SLA_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: SLA_ESCALATION_OWNER_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
