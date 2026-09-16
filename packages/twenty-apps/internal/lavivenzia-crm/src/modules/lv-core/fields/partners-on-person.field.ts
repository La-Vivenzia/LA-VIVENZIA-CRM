import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  PARTNERS_ON_PERSON_FIELD_ID,
  PARTNER_CONTACT_FIELD_ID,
  PARTNER_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// Day 9 — reverse side of the ecosystem relation (ONE_TO_MANY). The owning
// side (MANY_TO_ONE with its join column) is on the entity object.

export default defineField({
  universalIdentifier: PARTNERS_ON_PERSON_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'lvPartners',
  label: 'Partners (contact for)',
  icon: 'IconHeartHandshake',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: PARTNER_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PARTNER_CONTACT_FIELD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
