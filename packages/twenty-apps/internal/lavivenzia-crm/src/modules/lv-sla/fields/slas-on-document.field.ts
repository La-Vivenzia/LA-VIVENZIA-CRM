import {
  defineField,
  FieldType,
  RelationType,
} from 'twenty-sdk/define';

import {
  DOC_OBJECT_ID,
  SLAS_ON_DOCUMENT_ID,
  SLA_DOCUMENT_ID,
  SLA_OBJECT_ID
} from 'src/constants/universal-identifiers';

// Reverse side of lvSla.document.

export default defineField({
  universalIdentifier: SLAS_ON_DOCUMENT_ID,
  objectUniversalIdentifier: DOC_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'slas',
  label: 'SLAs',
  icon: 'IconClockExclamation',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: SLA_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: SLA_DOCUMENT_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
