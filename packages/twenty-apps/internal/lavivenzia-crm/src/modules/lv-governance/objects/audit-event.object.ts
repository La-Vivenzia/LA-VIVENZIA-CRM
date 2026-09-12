import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  AUDIT_EVENTS_ON_MEMBER_ID,
  AUDIT_EVENT_ACTION_ID,
  AUDIT_EVENT_ACTOR_ID,
  AUDIT_EVENT_AT_ID,
  AUDIT_EVENT_METADATA_ID,
  AUDIT_EVENT_NAME_ID,
  AUDIT_EVENT_OBJECT_ID,
  AUDIT_EVENT_OUTCOME_ID,
  AUDIT_EVENT_REASON_ID,
  AUDIT_EVENT_TARGET_LABEL_ID,
  AUDIT_EVENT_TARGET_OBJECT_ID,
  AUDIT_EVENT_TARGET_RECORD_ID,
} from 'src/constants/universal-identifiers';
import { type SelectOption } from 'src/modules/lv-core/constants/select-options.generated';

// The governance audit log: one row per destructive or lifecycle action a
// person takes on a record — archive, close, mark duplicate, reopen (the
// lifecycle route), and trash / restore / permanent delete (captured from
// Twenty's own database events, whichever path performed them).
//
// Why a separate object: the existing audit trails live ON the record
// (onboarding.auditTrail, sla.auditTrail) or in Twenty's timeline, and both
// disappear with the record. A permanent delete must leave a trace that
// survives the deletion, with the actor, the target's identity, the time and
// the reason. Rows are written only by the governance routes with the
// application role, from a server-derived actor; nobody has update or delete
// permission on them through a team role.

export const GOVERNANCE_ACTIONS = [
  'ARCHIVE',
  'CLOSE',
  'MARK_DUPLICATE',
  'REOPEN',
  'TRASH',
  'RESTORE',
  'PERMANENT_DELETE',
] as const;

export type GovernanceAction = (typeof GOVERNANCE_ACTIONS)[number];

const ACTION_OPTIONS: SelectOption[] = [
  { id: 'a1b2c3d4-0001-4a00-8000-000000000001', value: 'ARCHIVE', label: 'Archive', position: 0, color: 'gray' },
  { id: 'a1b2c3d4-0001-4a00-8000-000000000002', value: 'CLOSE', label: 'Close', position: 1, color: 'orange' },
  { id: 'a1b2c3d4-0001-4a00-8000-000000000003', value: 'MARK_DUPLICATE', label: 'Mark duplicate', position: 2, color: 'yellow' },
  { id: 'a1b2c3d4-0001-4a00-8000-000000000004', value: 'REOPEN', label: 'Reopen', position: 3, color: 'green' },
  { id: 'a1b2c3d4-0001-4a00-8000-000000000007', value: 'TRASH', label: 'Moved to trash', position: 4, color: 'orange' },
  { id: 'a1b2c3d4-0001-4a00-8000-000000000005', value: 'RESTORE', label: 'Restored from trash', position: 5, color: 'blue' },
  { id: 'a1b2c3d4-0001-4a00-8000-000000000006', value: 'PERMANENT_DELETE', label: 'Permanently deleted', position: 6, color: 'red' },
];

const OUTCOME_OPTIONS: SelectOption[] = [
  { id: 'a1b2c3d4-0002-4a00-8000-000000000001', value: 'APPLIED', label: 'Applied', position: 0, color: 'green' },
  { id: 'a1b2c3d4-0002-4a00-8000-000000000002', value: 'REFUSED', label: 'Refused', position: 1, color: 'red' },
  { id: 'a1b2c3d4-0002-4a00-8000-000000000003', value: 'FAILED', label: 'Failed', position: 2, color: 'orange' },
];

export default defineObject({
  universalIdentifier: AUDIT_EVENT_OBJECT_ID,
  nameSingular: 'lvAuditEvent',
  namePlural: 'lvAuditEvents',
  labelSingular: 'Audit event',
  labelPlural: 'Audit events',
  description: 'Governance audit log: who did what to which record, when, and why',
  icon: 'IconShieldLock',
  isSearchable: false,
  labelIdentifierFieldMetadataUniversalIdentifier: AUDIT_EVENT_NAME_ID,
  fields: [
    {
      universalIdentifier: AUDIT_EVENT_NAME_ID,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Event',
      icon: 'IconTag',
      defaultValue: "''",
    },
    {
      universalIdentifier: AUDIT_EVENT_ACTION_ID,
      type: FieldType.SELECT,
      name: 'action',
      label: 'Action',
      icon: 'IconBolt',
      isNullable: true,
      options: ACTION_OPTIONS,
    },
    {
      universalIdentifier: AUDIT_EVENT_OUTCOME_ID,
      type: FieldType.SELECT,
      name: 'outcome',
      label: 'Outcome',
      icon: 'IconCircleCheck',
      isNullable: true,
      options: OUTCOME_OPTIONS,
    },
    {
      universalIdentifier: AUDIT_EVENT_TARGET_OBJECT_ID,
      type: FieldType.TEXT,
      name: 'targetObject',
      label: 'Target object',
      icon: 'IconTarget',
      isNullable: true,
    },
    {
      universalIdentifier: AUDIT_EVENT_TARGET_RECORD_ID,
      type: FieldType.UUID,
      name: 'targetRecordId',
      label: 'Target record',
      icon: 'IconTarget',
      isNullable: true,
    },
    {
      // Kept as text: after a permanent delete this is the only surviving
      // description of what was removed.
      universalIdentifier: AUDIT_EVENT_TARGET_LABEL_ID,
      type: FieldType.TEXT,
      name: 'targetLabel',
      label: 'Target',
      icon: 'IconLabel',
      isNullable: true,
    },
    {
      universalIdentifier: AUDIT_EVENT_ACTOR_ID,
      type: FieldType.RELATION,
      name: 'actor',
      label: 'Actor',
      icon: 'IconUser',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier: AUDIT_EVENTS_ON_MEMBER_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'actorId',
      },
    },
    {
      universalIdentifier: AUDIT_EVENT_AT_ID,
      type: FieldType.DATE_TIME,
      name: 'at',
      label: 'At',
      icon: 'IconClock',
      isNullable: true,
    },
    {
      universalIdentifier: AUDIT_EVENT_REASON_ID,
      type: FieldType.TEXT,
      name: 'reason',
      label: 'Reason',
      icon: 'IconMessage',
      isNullable: true,
    },
    {
      universalIdentifier: AUDIT_EVENT_METADATA_ID,
      type: FieldType.RAW_JSON,
      name: 'metadata',
      label: 'Metadata',
      description: 'Dependent record counts, previous values, refusal reasons',
      icon: 'IconBraces',
      isNullable: true,
    },
  ],
});
