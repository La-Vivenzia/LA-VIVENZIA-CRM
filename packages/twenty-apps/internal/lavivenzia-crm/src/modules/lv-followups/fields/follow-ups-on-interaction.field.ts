import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  FOLLOWUPS_ON_INTERACTION_ID,
  INTERACTION_OBJECT_ID,
  TASK_LV_SOURCE_INTERACTION_ID,
} from 'src/constants/universal-identifiers';

// Reverse side: the follow-ups an interaction produced. These are Twenty tasks
// — this application defines no follow-up object of its own.

export default defineField({
  universalIdentifier: FOLLOWUPS_ON_INTERACTION_ID,
  objectUniversalIdentifier: INTERACTION_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'followUps',
  label: 'Follow-ups',
  icon: 'IconCheckbox',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: TASK_LV_SOURCE_INTERACTION_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
