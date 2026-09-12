import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { AI_RUNS_ON_MEMBER_ID, AI_RUN_ACTOR_ID, AI_RUN_OBJECT_ID } from 'src/constants/universal-identifiers';

// Reverse side of lvAiRun.actor.

export default defineField({
  universalIdentifier: AI_RUNS_ON_MEMBER_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'lvAiRuns',
  label: 'AI runs',
  icon: 'IconActivity',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: AI_RUN_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: AI_RUN_ACTOR_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
