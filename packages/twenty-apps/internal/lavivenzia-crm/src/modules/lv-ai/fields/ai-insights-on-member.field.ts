import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { AI_INSIGHTS_ON_MEMBER_ID, AI_INSIGHT_OBJECT_ID, AI_INSIGHT_REVIEWER_ID } from 'src/constants/universal-identifiers';

// Reverse side of lvAiInsight.reviewer.

export default defineField({
  universalIdentifier: AI_INSIGHTS_ON_MEMBER_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'lvReviewedAiInsights',
  label: 'Reviewed AI insights',
  icon: 'IconSparkles',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: AI_INSIGHT_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: AI_INSIGHT_REVIEWER_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
