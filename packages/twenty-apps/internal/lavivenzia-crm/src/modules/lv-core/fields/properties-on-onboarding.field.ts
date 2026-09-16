import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  ONBOARDING_OBJECT_ID,
  PROPERTIES_ON_ONBOARDING_FIELD_ID,
  PROPERTY_OBJECT_ID,
  PROPERTY_ONBOARDING_FIELD_ID,
} from 'src/constants/universal-identifiers';

// Day 9 — reverse side of the ecosystem relation (ONE_TO_MANY). The owning
// side (MANY_TO_ONE with its join column) is on the entity object.

export default defineField({
  universalIdentifier: PROPERTIES_ON_ONBOARDING_FIELD_ID,
  objectUniversalIdentifier: ONBOARDING_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'lvProperties',
  label: 'Properties',
  icon: 'IconHome',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: PROPERTY_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PROPERTY_ONBOARDING_FIELD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
