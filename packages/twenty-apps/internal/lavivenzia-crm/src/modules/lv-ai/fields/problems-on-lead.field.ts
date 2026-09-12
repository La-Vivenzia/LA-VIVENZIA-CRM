import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import { LEAD_OBJECT_ID, PROBLEMS_ON_LEAD_ID, PROBLEM_LEAD_ID, PROBLEM_OBJECT_ID } from 'src/constants/universal-identifiers';

// Reverse side of lvProblem.lead.

export default defineField({
  universalIdentifier: PROBLEMS_ON_LEAD_ID,
  objectUniversalIdentifier: LEAD_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'lvProblems',
  label: 'Problems',
  icon: 'IconAlertTriangle',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: PROBLEM_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PROBLEM_LEAD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
