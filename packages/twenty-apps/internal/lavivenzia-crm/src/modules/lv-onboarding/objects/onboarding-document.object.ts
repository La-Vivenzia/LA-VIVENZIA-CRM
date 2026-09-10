import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  DOCS_ON_MEMBER_ID,
  DOCS_ON_ONBOARDING_ID,
  DOC_EXPIRY_ID,
  DOC_FILE_ID,
  DOC_NAME_ID,
  DOC_OBJECT_ID,
  DOC_ONBOARDING_ID,
  DOC_REJECTION_REASON_ID,
  DOC_REVIEWER_ID,
  DOC_STATE_ID,
  DOC_TYPE_ID,
  DOC_AUDIT_ID,
  DOC_FLAGS_ID,
  DOC_MIME_ID,
  DOC_ORIGINAL_NAME_ID,
  DOC_REPLACED_BY_ID,
  DOC_REPLACES_ID,
  DOC_SIZE_ID,
  DOC_UPLOADED_AT_ID,
  DOC_VERIFIED_AT_ID,
  ONBOARDING_OBJECT_ID,
} from 'src/constants/universal-identifiers';
import {
  DOCUMENT_FLAG_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  DOCUMENT_VERIFICATION_OPTIONS,
} from 'src/modules/lv-core/constants/select-options.generated';

// One uploaded verification document, tracked separately from the onboarding
// answers because each has its own reviewer, verification state, expiry and
// rejection reason — and because approval is gated on all of them being
// verified (see transition-onboarding.ts).
//
// AI document verification (readability, expiry, name mismatch) is Phase 2 per
// AI-INTELLIGENCE.md. This object carries the state a reviewer sets by hand
// today; a Phase 2 extractor would populate the same fields as a SUGGESTION for
// a human to confirm, never as a decision.

export default defineObject({
  universalIdentifier: DOC_OBJECT_ID,
  nameSingular: 'lvOnboardingDocument',
  namePlural: 'lvOnboardingDocuments',
  labelSingular: 'Onboarding document',
  labelPlural: 'Onboarding documents',
  description: 'A verification document uploaded during partner onboarding',
  icon: 'IconFileCertificate',
  isSearchable: false,
  labelIdentifierFieldMetadataUniversalIdentifier: DOC_NAME_ID,
  fields: [
    {
      universalIdentifier: DOC_NAME_ID,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Document',
      icon: 'IconTag',
      defaultValue: "''",
    },
    {
      universalIdentifier: DOC_ONBOARDING_ID,
      type: FieldType.RELATION,
      name: 'onboarding',
      label: 'Onboarding',
      icon: 'IconRoute',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: ONBOARDING_OBJECT_ID,
      relationTargetFieldMetadataUniversalIdentifier: DOCS_ON_ONBOARDING_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'onboardingId',
      },
    },
    {
      universalIdentifier: DOC_TYPE_ID,
      type: FieldType.SELECT,
      name: 'documentType',
      label: 'Type',
      icon: 'IconCategory',
      isNullable: true,
      options: DOCUMENT_TYPE_OPTIONS,
    },
    {
      universalIdentifier: DOC_FILE_ID,
      type: FieldType.FILES,
      name: 'file',
      label: 'File',
      icon: 'IconPaperclip',
      isNullable: true,
      // FILES requires an explicit cap. One document per record keeps the
      // per-document verification state meaningful.
      universalSettings: { maxNumberOfValues: 1 },
    },
    {
      universalIdentifier: DOC_STATE_ID,
      type: FieldType.SELECT,
      name: 'verificationState',
      label: 'Verification',
      description: 'Set by a human reviewer. Approval requires every document verified.',
      icon: 'IconShieldCheck',
      isNullable: false,
      defaultValue: "'PENDING'",
      options: DOCUMENT_VERIFICATION_OPTIONS,
    },
    {
      universalIdentifier: DOC_EXPIRY_ID,
      type: FieldType.DATE,
      name: 'expiresAt',
      label: 'Expires',
      icon: 'IconCalendarX',
      isNullable: true,
    },
    {
      universalIdentifier: DOC_REVIEWER_ID,
      type: FieldType.RELATION,
      name: 'reviewer',
      label: 'Verified by',
      icon: 'IconUserCheck',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier: DOCS_ON_MEMBER_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'reviewerId',
      },
    },
    {
      universalIdentifier: DOC_REJECTION_REASON_ID,
      type: FieldType.TEXT,
      name: 'rejectionReason',
      label: 'Rejection reason',
      description: 'Shown to the partner so they know what to re-upload',
      icon: 'IconMessageExclamation',
      isNullable: true,
    },
    {
      // The specific problems found. A reviewer sets these by hand today; a
      // Phase 2 extractor would raise the same flags as SUGGESTIONS for a
      // person to confirm, never as a decision.
      universalIdentifier: DOC_FLAGS_ID,
      type: FieldType.MULTI_SELECT,
      name: 'verificationFlags',
      label: 'Problems found',
      icon: 'IconAlertTriangle',
      isNullable: true,
      options: DOCUMENT_FLAG_OPTIONS,
    },
    {
      // Append-only trail of every verification decision on this document.
      universalIdentifier: DOC_AUDIT_ID,
      type: FieldType.RAW_JSON,
      name: 'auditTrail',
      label: 'Verification history',
      description: 'Append-only record of every verification decision',
      icon: 'IconHistory',
      isNullable: true,
    },
    {
      universalIdentifier: DOC_ORIGINAL_NAME_ID,
      type: FieldType.TEXT,
      name: 'originalFilename',
      label: 'Original filename',
      description: 'The name the partner uploaded, kept for the reviewer',
      icon: 'IconFileDescription',
      isNullable: true,
    },
    {
      universalIdentifier: DOC_MIME_ID,
      type: FieldType.TEXT,
      name: 'mimeType',
      label: 'File type',
      description: 'Drives whether the reviewer gets an inline preview',
      icon: 'IconFileTypePdf',
      isNullable: true,
    },
    {
      universalIdentifier: DOC_SIZE_ID,
      type: FieldType.NUMBER,
      name: 'fileSizeBytes',
      label: 'Size (bytes)',
      icon: 'IconRuler',
      isNullable: true,
    },
    {
      universalIdentifier: DOC_UPLOADED_AT_ID,
      type: FieldType.DATE_TIME,
      name: 'uploadedAt',
      label: 'Uploaded at',
      icon: 'IconUpload',
      isNullable: true,
    },
    {
      universalIdentifier: DOC_VERIFIED_AT_ID,
      type: FieldType.DATE_TIME,
      name: 'verifiedAt',
      label: 'Verified at',
      icon: 'IconShieldCheck',
      isNullable: true,
    },
    {
      // Replacement chain. The superseded document is never deleted — it is the
      // evidence of what was checked, when, and by whom.
      universalIdentifier: DOC_REPLACES_ID,
      type: FieldType.RELATION,
      name: 'replaces',
      label: 'Replaces',
      icon: 'IconArrowBackUp',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: DOC_OBJECT_ID,
      relationTargetFieldMetadataUniversalIdentifier: DOC_REPLACED_BY_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'replacesId',
      },
    },
  ],
});
