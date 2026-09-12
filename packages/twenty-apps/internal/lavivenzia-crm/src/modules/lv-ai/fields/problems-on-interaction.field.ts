import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import { INTERACTION_OBJECT_ID, PROBLEMS_ON_INTERACTION_ID, PROBLEM_INTERACTION_ID, PROBLEM_OBJECT_ID } from 'src/constants/universal-identifiers';

// Reverse side of lvProblem.interaction.

export default defineField({
  universalIdentifier: PROBLEMS_ON_INTERACTION_ID,
  objectUniversalIdentifier: INTERACTION_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'lvProblems',
  label: 'Problems',
  icon: 'IconAlertTriangle',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: PROBLEM_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PROBLEM_INTERACTION_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
