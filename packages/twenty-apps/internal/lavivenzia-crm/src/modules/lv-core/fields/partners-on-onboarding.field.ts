import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  ONBOARDING_OBJECT_ID,
  PARTNER_OBJECT_ID,
  PARTNER_ONBOARDING_FIELD_ID,
  PARTNER_ON_ONBOARDING_FIELD_ID,
} from 'src/constants/universal-identifiers';

// Day 9 — reverse side of the ecosystem relation (ONE_TO_MANY). The owning
// side (MANY_TO_ONE with its join column) is on the entity object.

export default defineField({
  universalIdentifier: PARTNER_ON_ONBOARDING_FIELD_ID,
  objectUniversalIdentifier: ONBOARDING_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'lvPartners',
  label: 'Partners',
  icon: 'IconHeartHandshake',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: PARTNER_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PARTNER_ONBOARDING_FIELD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
