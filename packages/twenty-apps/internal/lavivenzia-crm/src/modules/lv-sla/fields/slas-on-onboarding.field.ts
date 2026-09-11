import {
  defineField,
  FieldType,
  RelationType,
} from 'twenty-sdk/define';

import {
  ONBOARDING_OBJECT_ID,
  SLAS_ON_ONBOARDING_ID,
  SLA_OBJECT_ID,
  SLA_ONBOARDING_ID
} from 'src/constants/universal-identifiers';

// Reverse side of lvSla.onboarding.

export default defineField({
  universalIdentifier: SLAS_ON_ONBOARDING_ID,
  objectUniversalIdentifier: ONBOARDING_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'slas',
  label: 'SLAs',
  icon: 'IconClockExclamation',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: SLA_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: SLA_ONBOARDING_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
