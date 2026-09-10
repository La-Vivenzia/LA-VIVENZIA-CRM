import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  LEAD_OBJECT_ID,
  ONBOARDINGS_ON_LEAD_ID,
  ONBOARDINGS_ON_MEMBER_ID,
  ONBOARDING_ACTIVATED_AT_ID,
  ONBOARDING_AUDIT_ID,
  ONBOARDING_CURRENT_STEP_ID,
  ONBOARDING_DATA_ID,
  ONBOARDING_DECIDED_AT_ID,
  ONBOARDING_HEALTH_ID,
  ONBOARDING_INTERNAL_NOTES_ID,
  ONBOARDING_INVITED_AT_ID,
  ONBOARDING_LEAD_ID,
  ONBOARDING_NAME_ID,
  ONBOARDING_OBJECT_ID,
  ONBOARDING_PROGRESS_ID,
  ONBOARDING_REJECTION_REASON_ID,
  ONBOARDING_REVIEWER_ID,
  ONBOARDING_STATUS_ID,
  ONBOARDING_SUBMITTED_AT_ID,
} from 'src/constants/universal-identifiers';
import {
  ONBOARDING_STATUS_OPTIONS,
  ONBOARDING_STEP_OPTIONS,
} from 'src/modules/lv-core/constants/select-options.generated';

// External partner onboarding.
//
// This is NOT Twenty's `core-modules/onboarding`, which walks a new *workspace
// user* through creating a workspace. This object tracks a villa owner or chef
// completing their own ten-step profile, and the two never interact.
//
// The partner's answers live in one RAW_JSON column rather than ~40 columns.
// The step definitions are versioned code (onboarding-steps.ts), the answers
// are data; splitting them into columns would mean a migration every time a
// question changes, which ONBOARDING.md explicitly wants to avoid.

export default defineObject({
  universalIdentifier: ONBOARDING_OBJECT_ID,
  nameSingular: 'lvOnboarding',
  namePlural: 'lvOnboardings',
  labelSingular: 'Partner onboarding',
  labelPlural: 'Partner onboardings',
  description:
    'A partner completing the ten-step La Vivenzia onboarding, and its review',
  icon: 'IconRoute',
  isSearchable: true,
  labelIdentifierFieldMetadataUniversalIdentifier: ONBOARDING_NAME_ID,
  fields: [
    {
      universalIdentifier: ONBOARDING_NAME_ID,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Partner',
      icon: 'IconTag',
      defaultValue: "''",
    },
    {
      universalIdentifier: ONBOARDING_LEAD_ID,
      type: FieldType.RELATION,
      name: 'lead',
      label: 'Lead',
      icon: 'IconUserSearch',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: LEAD_OBJECT_ID,
      relationTargetFieldMetadataUniversalIdentifier: ONBOARDINGS_ON_LEAD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'leadId',
      },
    },
    {
      universalIdentifier: ONBOARDING_STATUS_ID,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      icon: 'IconProgressCheck',
      isNullable: false,
      defaultValue: "'NOT_STARTED'",
      options: ONBOARDING_STATUS_OPTIONS,
    },
    {
      universalIdentifier: ONBOARDING_CURRENT_STEP_ID,
      type: FieldType.SELECT,
      name: 'currentStep',
      label: 'Current step',
      description: 'Where the partner resumes',
      icon: 'IconListNumbers',
      isNullable: true,
      options: ONBOARDING_STEP_OPTIONS,
    },
    {
      universalIdentifier: ONBOARDING_PROGRESS_ID,
      type: FieldType.NUMBER,
      name: 'progressPercentage',
      label: 'Progress',
      description: 'Share of the nine data-bearing steps completed',
      icon: 'IconPercentage',
      isNullable: true,
    },
    {
      universalIdentifier: ONBOARDING_HEALTH_ID,
      type: FieldType.NUMBER,
      name: 'healthScore',
      label: 'Health score',
      description:
        'Readiness out of 100: required completeness, detail, photographs, verified documents. Arithmetic, not a prediction.',
      icon: 'IconHeartRateMonitor',
      isNullable: true,
    },
    {
      // The partner's answers, keyed by step. See onboarding-steps.ts.
      universalIdentifier: ONBOARDING_DATA_ID,
      type: FieldType.RAW_JSON,
      name: 'answers',
      label: 'Submitted answers',
      description: 'Partner-supplied answers, keyed by step',
      icon: 'IconForms',
      isNullable: true,
    },
    {
      universalIdentifier: ONBOARDING_REVIEWER_ID,
      type: FieldType.RELATION,
      name: 'reviewer',
      label: 'Reviewer',
      description: 'The person accountable for the approval decision',
      icon: 'IconUserCheck',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier: ONBOARDINGS_ON_MEMBER_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'reviewerId',
      },
    },
    {
      universalIdentifier: ONBOARDING_REJECTION_REASON_ID,
      type: FieldType.TEXT,
      name: 'decisionReason',
      label: 'Decision reason',
      description:
        'Required for rejection and for requesting changes. Shown to the partner.',
      icon: 'IconMessageExclamation',
      isNullable: true,
    },
    {
      universalIdentifier: ONBOARDING_INTERNAL_NOTES_ID,
      type: FieldType.RICH_TEXT,
      name: 'internalNotes',
      label: 'Internal notes',
      description: 'Never shown to the partner',
      icon: 'IconLock',
      isNullable: true,
    },
    {
      // Append-only trail of every status change: from, to, when, who, why.
      // SECURITY-RBAC.md requires approvals and rejections to be traceable.
      universalIdentifier: ONBOARDING_AUDIT_ID,
      type: FieldType.RAW_JSON,
      name: 'auditTrail',
      label: 'Audit trail',
      description: 'Append-only record of every status change and its reason',
      icon: 'IconHistory',
      isNullable: true,
    },
    {
      universalIdentifier: ONBOARDING_INVITED_AT_ID,
      type: FieldType.DATE_TIME,
      name: 'invitedAt',
      label: 'Invited at',
      icon: 'IconMailForward',
      isNullable: true,
    },
    {
      universalIdentifier: ONBOARDING_SUBMITTED_AT_ID,
      type: FieldType.DATE_TIME,
      name: 'submittedAt',
      label: 'Submitted at',
      icon: 'IconSend',
      isNullable: true,
    },
    {
      universalIdentifier: ONBOARDING_DECIDED_AT_ID,
      type: FieldType.DATE_TIME,
      name: 'decidedAt',
      label: 'Decided at',
      icon: 'IconGavel',
      isNullable: true,
    },
    {
      universalIdentifier: ONBOARDING_ACTIVATED_AT_ID,
      type: FieldType.DATE_TIME,
      name: 'activatedAt',
      label: 'Activated at',
      icon: 'IconRocket',
      isNullable: true,
    },
  ],
});
