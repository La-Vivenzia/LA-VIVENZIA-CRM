import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  DOC_OBJECT_ID,
  DOC_REPLACED_BY_ID,
  DOC_REPLACES_ID,
} from 'src/constants/universal-identifiers';

// Reverse side of the replacement chain: the newer documents that superseded
// this one. Self-referential, so a document's whole history is walkable.

export default defineField({
  universalIdentifier: DOC_REPLACED_BY_ID,
  objectUniversalIdentifier: DOC_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'replacedBy',
  label: 'Replaced by',
  icon: 'IconArrowForwardUp',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: DOC_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: DOC_REPLACES_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
