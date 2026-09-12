import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  AI_INSIGHTS_ON_LEAD_ID,
  AI_INSIGHTS_ON_MEMBER_ID,
  AI_INSIGHT_CONFIDENCE_ID,
  AI_INSIGHT_DECISION_ID,
  AI_INSIGHT_DECISION_NOTE_ID,
  AI_INSIGHT_ERROR_CODE_ID,
  AI_INSIGHT_FINGERPRINT_ID,
  AI_INSIGHT_GENERATED_AT_ID,
  AI_INSIGHT_LEAD_ID,
  AI_INSIGHT_MODEL_ID,
  AI_INSIGHT_NAME_ID,
  AI_INSIGHT_OBJECT_ID,
  AI_INSIGHT_ORIGIN_ID,
  AI_INSIGHT_PAYLOAD_ID,
  AI_INSIGHT_PROMPT_VERSION_ID,
  AI_INSIGHT_PROVIDER_ID,
  AI_INSIGHT_REVIEWED_AT_ID,
  AI_INSIGHT_REVIEWER_ID,
  AI_INSIGHT_SOURCE_RECORDS_ID,
  AI_INSIGHT_STATUS_ID,
  AI_INSIGHT_SUMMARY_ID,
  AI_INSIGHT_TARGET_OBJECT_ID,
  AI_INSIGHT_TARGET_RECORD_ID,
  AI_INSIGHT_TYPE_ID,
  LEAD_OBJECT_ID,
} from 'src/constants/universal-identifiers';
import { type SelectOption, type SelectOptionColor } from 'src/modules/lv-core/constants/select-options.generated';

// One AI (or rules-engine) insight about one record, with its provenance.
//
// This is where AI output lives — never on the source record. A suggestion
// becomes CRM truth only when a person accepts it through a route that then
// writes the real field with that person's own permissions, and the decision
// is recorded here (reviewer, reviewedAt, humanDecision). `origin` says
// whether a language model or a deterministic rule set produced the row, so
// the UI can label AI GENERATED versus computed.
//
// Team roles have no direct read permission on this object: every read goes
// through a route that first loads the parent lead under CM-004, so an
// insight is exactly as visible as the record it describes.

export const AI_INSIGHT_TYPES = [
  'LEAD_SUMMARY',
  'CLASSIFICATION',
  'OPPORTUNITY_SCORE',
  'RELATIONSHIP_HEALTH',
  'NEXT_BEST_ACTION',
  'DATA_QUALITY',
  'DUPLICATE',
  'CONVERSATION_SUMMARY',
  'PROBLEM_SUGGESTION',
  'DRAFT',
  'ONBOARDING_ASSIST',
  'BRIEFING',
] as const;

export type AiInsightType = (typeof AI_INSIGHT_TYPES)[number];

export const AI_INSIGHT_STATUSES = ['AI_SUGGESTED', 'AI_CONFIRMED', 'AI_REJECTED', 'AI_STALE', 'UNAVAILABLE'] as const;

export type AiInsightStatus = (typeof AI_INSIGHT_STATUSES)[number];

export const AI_INSIGHT_ORIGINS = ['MODEL', 'RULES'] as const;

export type AiInsightOrigin = (typeof AI_INSIGHT_ORIGINS)[number];

export const HUMAN_DECISIONS = ['ACCEPTED', 'EDITED', 'REJECTED', 'DISMISSED', 'MERGED', 'IGNORED', 'CREATED_NEW'] as const;

export type HumanDecision = (typeof HUMAN_DECISIONS)[number];

const option = (group: string, index: number, value: string, label: string, color: SelectOptionColor): SelectOption => ({
  id: `d6a${group}0000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  value,
  label,
  position: index,
  color,
});

const TYPE_OPTIONS: SelectOption[] = AI_INSIGHT_TYPES.map((value, index) =>
  option('1', index + 1, value, value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), 'gray'),
);

const STATUS_OPTIONS: SelectOption[] = [
  option('2', 1, 'AI_SUGGESTED', 'AI suggested', 'yellow'),
  option('2', 2, 'AI_CONFIRMED', 'AI confirmed', 'green'),
  option('2', 3, 'AI_REJECTED', 'AI rejected', 'red'),
  option('2', 4, 'AI_STALE', 'AI stale', 'gray'),
  option('2', 5, 'UNAVAILABLE', 'Unavailable', 'orange'),
];

const ORIGIN_OPTIONS: SelectOption[] = [option('3', 1, 'MODEL', 'Language model', 'purple'), option('3', 2, 'RULES', 'Rules engine', 'blue')];

const DECISION_OPTIONS: SelectOption[] = HUMAN_DECISIONS.map((value, index) =>
  option('4', index + 1, value, value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), 'gray'),
);

export default defineObject({
  universalIdentifier: AI_INSIGHT_OBJECT_ID,
  nameSingular: 'lvAiInsight',
  namePlural: 'lvAiInsights',
  labelSingular: 'AI insight',
  labelPlural: 'AI insights',
  description: 'AI-generated or rules-computed insight about a CRM record, with provenance and the human decision',
  icon: 'IconSparkles',
  isSearchable: false,
  labelIdentifierFieldMetadataUniversalIdentifier: AI_INSIGHT_NAME_ID,
  fields: [
    { universalIdentifier: AI_INSIGHT_NAME_ID, type: FieldType.TEXT, name: 'name', label: 'Insight', icon: 'IconSparkles', defaultValue: "''" },
    { universalIdentifier: AI_INSIGHT_TYPE_ID, type: FieldType.SELECT, name: 'insightType', label: 'Type', icon: 'IconCategory', isNullable: true, options: TYPE_OPTIONS },
    { universalIdentifier: AI_INSIGHT_STATUS_ID, type: FieldType.SELECT, name: 'status', label: 'Status', icon: 'IconCircleDot', isNullable: true, options: STATUS_OPTIONS },
    { universalIdentifier: AI_INSIGHT_ORIGIN_ID, type: FieldType.SELECT, name: 'origin', label: 'Origin', icon: 'IconCpu', isNullable: true, options: ORIGIN_OPTIONS },
    { universalIdentifier: AI_INSIGHT_TARGET_OBJECT_ID, type: FieldType.TEXT, name: 'targetObject', label: 'Target object', icon: 'IconTarget', isNullable: true },
    { universalIdentifier: AI_INSIGHT_TARGET_RECORD_ID, type: FieldType.UUID, name: 'targetRecordId', label: 'Target record', icon: 'IconTarget', isNullable: true },
    {
      universalIdentifier: AI_INSIGHT_LEAD_ID,
      type: FieldType.RELATION,
      name: 'lead',
      label: 'Lead',
      icon: 'IconUserSearch',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: LEAD_OBJECT_ID,
      relationTargetFieldMetadataUniversalIdentifier: AI_INSIGHTS_ON_LEAD_ID,
      universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.CASCADE, joinColumnName: 'leadId' },
    },
    { universalIdentifier: AI_INSIGHT_PROVIDER_ID, type: FieldType.TEXT, name: 'provider', label: 'Provider', icon: 'IconPlug', isNullable: true },
    { universalIdentifier: AI_INSIGHT_MODEL_ID, type: FieldType.TEXT, name: 'model', label: 'Model', icon: 'IconCpu', isNullable: true },
    { universalIdentifier: AI_INSIGHT_PROMPT_VERSION_ID, type: FieldType.TEXT, name: 'promptVersion', label: 'Prompt / rules version', icon: 'IconVersions', isNullable: true },
    { universalIdentifier: AI_INSIGHT_GENERATED_AT_ID, type: FieldType.DATE_TIME, name: 'generatedAt', label: 'Generated at', icon: 'IconClock', isNullable: true },
    { universalIdentifier: AI_INSIGHT_CONFIDENCE_ID, type: FieldType.NUMBER, name: 'confidence', label: 'Confidence (0–1)', icon: 'IconPercentage', isNullable: true },
    { universalIdentifier: AI_INSIGHT_SOURCE_RECORDS_ID, type: FieldType.RAW_JSON, name: 'sourceRecordIds', label: 'Source records', description: 'The record ids that were in the model context', icon: 'IconListDetails', isNullable: true },
    { universalIdentifier: AI_INSIGHT_PAYLOAD_ID, type: FieldType.RAW_JSON, name: 'payload', label: 'Payload', description: 'Bounded structured output', icon: 'IconBraces', isNullable: true },
    { universalIdentifier: AI_INSIGHT_SUMMARY_ID, type: FieldType.TEXT, name: 'summary', label: 'Summary', icon: 'IconAlignLeft', isNullable: true },
    { universalIdentifier: AI_INSIGHT_FINGERPRINT_ID, type: FieldType.TEXT, name: 'fingerprint', label: 'Source fingerprint', description: 'Changes when the source records change; used to mark insights stale', icon: 'IconFingerprint', isNullable: true },
    {
      universalIdentifier: AI_INSIGHT_REVIEWER_ID,
      type: FieldType.RELATION,
      name: 'reviewer',
      label: 'Reviewed by',
      icon: 'IconUserCheck',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier: AI_INSIGHTS_ON_MEMBER_ID,
      universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'reviewerId' },
    },
    { universalIdentifier: AI_INSIGHT_REVIEWED_AT_ID, type: FieldType.DATE_TIME, name: 'reviewedAt', label: 'Reviewed at', icon: 'IconClock', isNullable: true },
    { universalIdentifier: AI_INSIGHT_DECISION_ID, type: FieldType.SELECT, name: 'humanDecision', label: 'Human decision', icon: 'IconGavel', isNullable: true, options: DECISION_OPTIONS },
    { universalIdentifier: AI_INSIGHT_DECISION_NOTE_ID, type: FieldType.TEXT, name: 'decisionNote', label: 'Decision note', icon: 'IconMessage', isNullable: true },
    { universalIdentifier: AI_INSIGHT_ERROR_CODE_ID, type: FieldType.TEXT, name: 'errorCode', label: 'Error code', description: 'Set when the row records an unavailable / failed generation', icon: 'IconAlertTriangle', isNullable: true },
  ],
});
