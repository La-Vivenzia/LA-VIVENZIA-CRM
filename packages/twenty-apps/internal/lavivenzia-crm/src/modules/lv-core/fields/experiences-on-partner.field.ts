import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  EXPERIENCE_OBJECT_ID,
  EXPERIENCE_ON_PARTNER_FIELD_ID,
  EXPERIENCE_PARTNER_FIELD_ID,
  PARTNER_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// Everything this partner offers. A partner with none yet is normal: they are onboarded before they list.

export default defineField({
  universalIdentifier: EXPERIENCE_ON_PARTNER_FIELD_ID,
  objectUniversalIdentifier: PARTNER_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'lvExperiences',
  label: 'Experiences',
  icon: 'IconSparkles',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: EXPERIENCE_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: EXPERIENCE_PARTNER_FIELD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
