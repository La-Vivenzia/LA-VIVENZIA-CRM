import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  FOLLOWUPS_ON_INTERACTION_ID,
  INTERACTION_OBJECT_ID,
  TASK_LV_SOURCE_INTERACTION_ID,
} from 'src/constants/universal-identifiers';

// Links a follow-up task back to the interaction that produced it, so the Lead
// Profile can answer "why does this task exist?" without guesswork.

export default defineField({
  universalIdentifier: TASK_LV_SOURCE_INTERACTION_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.RELATION,
  name: 'lvSourceInteraction',
  label: 'From interaction',
  icon: 'IconMessageDots',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: INTERACTION_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: FOLLOWUPS_ON_INTERACTION_ID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'lvSourceInteractionId',
  },
});
