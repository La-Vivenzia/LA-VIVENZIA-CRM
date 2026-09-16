import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  EXPERIENCES_ON_ONBOARDING_FIELD_ID,
  EXPERIENCE_OBJECT_ID,
  EXPERIENCE_ONBOARDING_FIELD_ID,
  ONBOARDING_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// Day 9 — reverse side of the ecosystem relation (ONE_TO_MANY). The owning
// side (MANY_TO_ONE with its join column) is on the entity object.

export default defineField({
  universalIdentifier: EXPERIENCES_ON_ONBOARDING_FIELD_ID,
  objectUniversalIdentifier: ONBOARDING_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'lvExperiences',
  label: 'Experiences',
  icon: 'IconCompass',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: EXPERIENCE_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: EXPERIENCE_ONBOARDING_FIELD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
