import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  EXPERIENCES_ON_PERSON_FIELD_ID,
  EXPERIENCE_HOST_FIELD_ID,
  EXPERIENCE_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// Day 9 — reverse side of the ecosystem relation (ONE_TO_MANY). The owning
// side (MANY_TO_ONE with its join column) is on the entity object.

export default defineField({
  universalIdentifier: EXPERIENCES_ON_PERSON_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'lvExperiencesHosted',
  label: 'Experiences hosted',
  icon: 'IconCompass',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: EXPERIENCE_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: EXPERIENCE_HOST_FIELD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
