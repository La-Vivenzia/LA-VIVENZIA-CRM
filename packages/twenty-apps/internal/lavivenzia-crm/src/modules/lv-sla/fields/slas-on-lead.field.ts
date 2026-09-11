import {
  defineField,
  FieldType,
  RelationType,
} from 'twenty-sdk/define';

import {
  LEAD_OBJECT_ID,
  SLAS_ON_LEAD_ID,
  SLA_LEAD_ID,
  SLA_OBJECT_ID
} from 'src/constants/universal-identifiers';

// Reverse side of lvSla.lead.

export default defineField({
  universalIdentifier: SLAS_ON_LEAD_ID,
  objectUniversalIdentifier: LEAD_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'slas',
  label: 'SLAs',
  icon: 'IconClockExclamation',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: SLA_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: SLA_LEAD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
