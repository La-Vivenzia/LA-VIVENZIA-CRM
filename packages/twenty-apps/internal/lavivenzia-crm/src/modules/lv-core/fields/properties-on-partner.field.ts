import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  PARTNER_OBJECT_ID,
  PROPERTY_OBJECT_ID,
  PROPERTY_ON_PARTNER_FIELD_ID,
  PROPERTY_PARTNER_FIELD_ID,
} from 'src/constants/universal-identifiers';

// Places this partner operates. Separate from experiences because a venue can host many experiences and an experience need not have a venue.

export default defineField({
  universalIdentifier: PROPERTY_ON_PARTNER_FIELD_ID,
  objectUniversalIdentifier: PARTNER_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'lvProperties',
  label: 'Properties',
  icon: 'IconHome',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: PROPERTY_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PROPERTY_PARTNER_FIELD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
