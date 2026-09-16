import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  PROPERTIES_MANAGED_ON_PERSON_FIELD_ID,
  PROPERTY_MANAGER_FIELD_ID,
  PROPERTY_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// Day 9 — reverse side of the ecosystem relation (ONE_TO_MANY). The owning
// side (MANY_TO_ONE with its join column) is on the entity object.

export default defineField({
  universalIdentifier: PROPERTIES_MANAGED_ON_PERSON_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'lvPropertiesManaged',
  label: 'Properties managed',
  icon: 'IconHome',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: PROPERTY_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PROPERTY_MANAGER_FIELD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
