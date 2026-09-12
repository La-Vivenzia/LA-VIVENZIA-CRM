import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import { AI_INSIGHTS_ON_LEAD_ID, AI_INSIGHT_LEAD_ID, AI_INSIGHT_OBJECT_ID, LEAD_OBJECT_ID } from 'src/constants/universal-identifiers';

// Reverse side of lvAiInsight.lead.

export default defineField({
  universalIdentifier: AI_INSIGHTS_ON_LEAD_ID,
  objectUniversalIdentifier: LEAD_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'lvAiInsights',
  label: 'AI insights',
  icon: 'IconSparkles',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: AI_INSIGHT_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: AI_INSIGHT_LEAD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
