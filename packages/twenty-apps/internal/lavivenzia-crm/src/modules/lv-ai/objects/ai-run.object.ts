import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  AI_RUNS_ON_MEMBER_ID,
  AI_RUN_ACTOR_ID,
  AI_RUN_ERROR_CODE_ID,
  AI_RUN_INPUT_TOKENS_ID,
  AI_RUN_LATENCY_ID,
  AI_RUN_METADATA_ID,
  AI_RUN_MODEL_ID,
  AI_RUN_NAME_ID,
  AI_RUN_OBJECT_ID,
  AI_RUN_OPERATION_ID,
  AI_RUN_OUTPUT_TOKENS_ID,
  AI_RUN_PROMPT_VERSION_ID,
  AI_RUN_PROVIDER_ID,
  AI_RUN_SOURCE_RECORDS_ID,
  AI_RUN_STARTED_AT_ID,
  AI_RUN_STATUS_ID,
  AI_RUN_TARGET_OBJECT_ID,
  AI_RUN_TARGET_RECORD_ID,
} from 'src/constants/universal-identifiers';
import { type SelectOption } from 'src/modules/lv-core/constants/select-options.generated';

// The AI operations audit: one row per model call or Copilot request — actor
// (from the session, never the body), operation, target, provider, model,
// prompt version, latency, token usage, success or failure code, and the ids
// of the records that were in the context. Prompts and responses are NOT
// stored here; the bounded output lives on the insight when there is one.
//
// Copilot write proposals also live here (status PROPOSED → CONFIRMED /
// EXPIRED / REFUSED) so that "confirm" can only execute what the same person
// was shown, within its expiry.

export const AI_RUN_STATUSES = ['SUCCESS', 'FAILED', 'UNAVAILABLE', 'SKIPPED', 'PROPOSED', 'CONFIRMED', 'EXPIRED', 'REFUSED'] as const;

export type AiRunStatus = (typeof AI_RUN_STATUSES)[number];

const STATUS_OPTIONS: SelectOption[] = AI_RUN_STATUSES.map((value, index) => ({
  id: `d6a50000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  value,
  label: value.charAt(0) + value.slice(1).toLowerCase(),
  position: index,
  color: value === 'SUCCESS' || value === 'CONFIRMED' ? 'green' : value === 'FAILED' || value === 'REFUSED' ? 'red' : value === 'PROPOSED' ? 'yellow' : 'gray',
}));

export default defineObject({
  universalIdentifier: AI_RUN_OBJECT_ID,
  nameSingular: 'lvAiRun',
  namePlural: 'lvAiRuns',
  labelSingular: 'AI run',
  labelPlural: 'AI runs',
  description: 'Audit of AI operations: who asked for what, which model answered, how long it took, and whether it succeeded',
  icon: 'IconActivity',
  isSearchable: false,
  labelIdentifierFieldMetadataUniversalIdentifier: AI_RUN_NAME_ID,
  fields: [
    { universalIdentifier: AI_RUN_NAME_ID, type: FieldType.TEXT, name: 'name', label: 'Run', icon: 'IconActivity', defaultValue: "''" },
    { universalIdentifier: AI_RUN_OPERATION_ID, type: FieldType.TEXT, name: 'operation', label: 'Operation', icon: 'IconBolt', isNullable: true },
    { universalIdentifier: AI_RUN_PROMPT_VERSION_ID, type: FieldType.TEXT, name: 'promptVersion', label: 'Prompt / rules version', icon: 'IconVersions', isNullable: true },
    { universalIdentifier: AI_RUN_PROVIDER_ID, type: FieldType.TEXT, name: 'provider', label: 'Provider', icon: 'IconPlug', isNullable: true },
    { universalIdentifier: AI_RUN_MODEL_ID, type: FieldType.TEXT, name: 'model', label: 'Model', icon: 'IconCpu', isNullable: true },
    { universalIdentifier: AI_RUN_STATUS_ID, type: FieldType.SELECT, name: 'status', label: 'Status', icon: 'IconCircleDot', isNullable: true, options: STATUS_OPTIONS },
    { universalIdentifier: AI_RUN_ERROR_CODE_ID, type: FieldType.TEXT, name: 'errorCode', label: 'Error code', icon: 'IconAlertTriangle', isNullable: true },
    { universalIdentifier: AI_RUN_LATENCY_ID, type: FieldType.NUMBER, name: 'latencyMs', label: 'Latency (ms)', icon: 'IconClock', isNullable: true },
    { universalIdentifier: AI_RUN_INPUT_TOKENS_ID, type: FieldType.NUMBER, name: 'inputTokens', label: 'Input tokens', icon: 'IconArrowDown', isNullable: true },
    { universalIdentifier: AI_RUN_OUTPUT_TOKENS_ID, type: FieldType.NUMBER, name: 'outputTokens', label: 'Output tokens', icon: 'IconArrowUp', isNullable: true },
    { universalIdentifier: AI_RUN_TARGET_OBJECT_ID, type: FieldType.TEXT, name: 'targetObject', label: 'Target object', icon: 'IconTarget', isNullable: true },
    { universalIdentifier: AI_RUN_TARGET_RECORD_ID, type: FieldType.UUID, name: 'targetRecordId', label: 'Target record', icon: 'IconTarget', isNullable: true },
    {
      universalIdentifier: AI_RUN_ACTOR_ID,
      type: FieldType.RELATION,
      name: 'actor',
      label: 'Actor',
      icon: 'IconUser',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier: AI_RUNS_ON_MEMBER_ID,
      universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'actorId' },
    },
    { universalIdentifier: AI_RUN_SOURCE_RECORDS_ID, type: FieldType.RAW_JSON, name: 'sourceRecordIds', label: 'Source records', icon: 'IconListDetails', isNullable: true },
    { universalIdentifier: AI_RUN_STARTED_AT_ID, type: FieldType.DATE_TIME, name: 'startedAt', label: 'Started at', icon: 'IconClock', isNullable: true },
    { universalIdentifier: AI_RUN_METADATA_ID, type: FieldType.RAW_JSON, name: 'metadata', label: 'Metadata', description: 'Bounded operation details (never prompts, keys or personal data)', icon: 'IconBraces', isNullable: true },
  ],
});
