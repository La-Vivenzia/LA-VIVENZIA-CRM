import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  PARTNERS_ON_WORKSPACE_MEMBER_FIELD_ID,
  PARTNER_OBJECT_ID,
  PARTNER_OWNER_FIELD_ID,
} from 'src/constants/universal-identifiers';

// Day 9 — reverse side of the ecosystem relation (ONE_TO_MANY). The owning
// side (MANY_TO_ONE with its join column) is on the entity object.

export default defineField({
  universalIdentifier: PARTNERS_ON_WORKSPACE_MEMBER_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'lvPartnersOwned',
  label: 'Partners owned',
  icon: 'IconHeartHandshake',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: PARTNER_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PARTNER_OWNER_FIELD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
