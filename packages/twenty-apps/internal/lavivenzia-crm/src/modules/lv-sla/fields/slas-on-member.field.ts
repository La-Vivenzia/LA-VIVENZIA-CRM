import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  SLAS_ON_MEMBER_ID,
  SLA_OBJECT_ID,
  SLA_OWNER_ID
} from 'src/constants/universal-identifiers';

// Reverse side of lvSla.owner.

export default defineField({
  universalIdentifier: SLAS_ON_MEMBER_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'lvSlas',
  label: 'SLAs owned',
  icon: 'IconClockExclamation',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: SLA_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: SLA_OWNER_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
