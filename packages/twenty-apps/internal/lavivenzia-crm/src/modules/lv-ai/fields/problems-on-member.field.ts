import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { PROBLEMS_ON_MEMBER_ID, PROBLEM_OBJECT_ID, PROBLEM_REPORTER_ID } from 'src/constants/universal-identifiers';

// Reverse side of lvProblem.reporter.

export default defineField({
  universalIdentifier: PROBLEMS_ON_MEMBER_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'lvReportedProblems',
  label: 'Reported problems',
  icon: 'IconAlertTriangle',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: PROBLEM_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PROBLEM_REPORTER_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
