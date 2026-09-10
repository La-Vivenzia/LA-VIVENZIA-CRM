import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  ASSIGNMENT_HISTORY_AT_FIELD_ID,
  ASSIGNMENT_HISTORY_EVENT_KEY_FIELD_ID,
  ASSIGNMENT_HISTORY_FROM_FIELD_ID,
  ASSIGNMENT_HISTORY_FROM_ON_MEMBER_FIELD_ID,
  ASSIGNMENT_HISTORY_LEAD_FIELD_ID,
  ASSIGNMENT_HISTORY_NAME_FIELD_ID,
  ASSIGNMENT_HISTORY_OBJECT_ID,
  ASSIGNMENT_HISTORY_ON_LEAD_FIELD_ID,
  ASSIGNMENT_HISTORY_REASON_FIELD_ID,
  ASSIGNMENT_HISTORY_SCORE_FIELD_ID,
  ASSIGNMENT_HISTORY_STRATEGY_FIELD_ID,
  ASSIGNMENT_HISTORY_TO_FIELD_ID,
  ASSIGNMENT_HISTORY_TO_ON_MEMBER_FIELD_ID,
  LEAD_OBJECT_ID,
} from 'src/constants/universal-identifiers';
import { type SelectOption } from 'src/modules/lv-core/constants/select-options.generated';

// SECURITY-RBAC.md requires ownership changes to be auditable. One row per
// transfer, automatic or manual, stating who lost the lead, who gained it and
// exactly why the engine chose them.
//
// Rows are written by the engine and are never edited: the default role grants
// no update or delete on this object, so the trail cannot be quietly rewritten.

const STRATEGY_OPTIONS: SelectOption[] = [
  { id: '2f0a1e4c-9b3d-4a51-8c72-1d5e6f7a8b90', value: 'MANUAL', label: 'Manual', position: 0, color: 'blue' },
  { id: '3a1b2c5d-8e4f-4b62-9d83-2e6f7a8b9c01', value: 'RULE', label: 'Rule', position: 1, color: 'purple' },
  { id: '4b2c3d6e-7f5a-4c73-8e94-3f7a8b9c0d12', value: 'EXISTING_RELATIONSHIP', label: 'Existing relationship', position: 2, color: 'turquoise' },
  { id: '5c3d4e7f-6a5b-4d84-9fa5-4a8b9c0d1e23', value: 'SCORED', label: 'Scored', position: 3, color: 'green' },
  { id: '6d4e5f8a-5b6c-4e95-8ab6-5b9c0d1e2f34', value: 'ROUND_ROBIN', label: 'Round robin', position: 4, color: 'yellow' },
  { id: '7e5f6a9b-4c7d-4fa6-9bc7-6c0d1e2f3a45', value: 'NONE', label: 'Unassigned', position: 5, color: 'gray' },
];

export default defineObject({
  universalIdentifier: ASSIGNMENT_HISTORY_OBJECT_ID,
  nameSingular: 'lvAssignmentHistory',
  namePlural: 'lvAssignmentHistories',
  labelSingular: 'Assignment history',
  labelPlural: 'Assignment history',
  description: 'Immutable record of every lead ownership change and its reason',
  icon: 'IconHistory',
  isSearchable: false,
  labelIdentifierFieldMetadataUniversalIdentifier: ASSIGNMENT_HISTORY_NAME_FIELD_ID,
  fields: [
    {
      universalIdentifier: ASSIGNMENT_HISTORY_NAME_FIELD_ID,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Summary',
      icon: 'IconTag',
      defaultValue: "''",
    },
    {
      universalIdentifier: ASSIGNMENT_HISTORY_LEAD_FIELD_ID,
      type: FieldType.RELATION,
      name: 'lead',
      label: 'Lead',
      icon: 'IconUserSearch',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: LEAD_OBJECT_ID,
      relationTargetFieldMetadataUniversalIdentifier:
        ASSIGNMENT_HISTORY_ON_LEAD_FIELD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'leadId',
      },
    },
    {
      universalIdentifier: ASSIGNMENT_HISTORY_FROM_FIELD_ID,
      type: FieldType.RELATION,
      name: 'fromOwner',
      label: 'From',
      icon: 'IconUserMinus',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        ASSIGNMENT_HISTORY_FROM_ON_MEMBER_FIELD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'fromOwnerId',
      },
    },
    {
      universalIdentifier: ASSIGNMENT_HISTORY_TO_FIELD_ID,
      type: FieldType.RELATION,
      name: 'toOwner',
      label: 'To',
      icon: 'IconUserPlus',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        ASSIGNMENT_HISTORY_TO_ON_MEMBER_FIELD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'toOwnerId',
      },
    },
    {
      universalIdentifier: ASSIGNMENT_HISTORY_STRATEGY_FIELD_ID,
      type: FieldType.SELECT,
      name: 'strategy',
      label: 'Strategy',
      description: 'Which branch of the assignment engine decided this',
      icon: 'IconRoute',
      isNullable: true,
      options: STRATEGY_OPTIONS,
    },
    {
      universalIdentifier: ASSIGNMENT_HISTORY_SCORE_FIELD_ID,
      type: FieldType.NUMBER,
      name: 'score',
      label: 'Fit score',
      description: 'Weighted factor total out of 100, when scoring decided it',
      icon: 'IconTargetArrow',
      isNullable: true,
    },
    {
      universalIdentifier: ASSIGNMENT_HISTORY_REASON_FIELD_ID,
      type: FieldType.TEXT,
      name: 'reason',
      label: 'Reason',
      description: 'Plain-language explanation of the decision',
      icon: 'IconMessage',
      isNullable: true,
    },
    {
      universalIdentifier: ASSIGNMENT_HISTORY_AT_FIELD_ID,
      type: FieldType.DATE_TIME,
      name: 'assignedAt',
      label: 'Assigned at',
      icon: 'IconCalendarPlus',
      isNullable: true,
    },
    {
      // Idempotency key for the append-only log.
      //
      // History must stay append-only — a reassignment adds a row and never
      // edits the previous one — while a *replayed* event must not add a
      // second row for something that already happened. Those two rules only
      // coexist if the key identifies the triggering event rather than the
      // resulting state, which is what this holds. Automatic writers derive it
      // from the event (e.g. "lvLead.created:<leadId>"); an explicit human
      // reassignment supplies its own, or none, and always appends.
      universalIdentifier: ASSIGNMENT_HISTORY_EVENT_KEY_FIELD_ID,
      type: FieldType.TEXT,
      name: 'eventKey',
      label: 'Event key',
      description:
        'Idempotency key identifying the event that produced this entry.',
      icon: 'IconFingerprint',
      isNullable: true,
      isUnique: true,
    },
  ],
});
