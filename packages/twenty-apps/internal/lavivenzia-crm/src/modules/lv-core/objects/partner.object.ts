import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  PARTNER_CODE_FIELD_ID,
  PARTNER_LEAD_FIELD_ID,
  PARTNER_LOCATION_FIELD_ID,
  PARTNER_NAME_FIELD_ID,
  PARTNER_OBJECT_ID,
  PARTNER_ON_LEAD_FIELD_ID,
  PARTNER_STATUS_FIELD_ID,
  PARTNER_TYPE_FIELD_ID,
  LEAD_OBJECT_ID,
} from 'src/constants/universal-identifiers';
import {
  PARTNER_STATUS_OPTIONS,
  PARTNER_TYPE_OPTIONS,
} from 'src/modules/lv-core/constants/partner-options';

// A partner is what a lead becomes once onboarding is approved: the host,
// business or professional La Vivenzia actually works with.
//
// Deliberately small. DATA-MODEL.md lists far more against the Organisation
// entry, but pricing, availability, quality signals and demand belong to the
// later phases that will use them. Adding empty columns now would be inventing
// a schema rather than building a foundation.
//
// The lead relation is what preserves provenance: every partner can be traced
// back to the enquiry it came from.

export default defineObject({
  universalIdentifier: PARTNER_OBJECT_ID,
  nameSingular: 'lvPartner',
  namePlural: 'lvPartners',
  labelSingular: 'Partner',
  labelPlural: 'Partners',
  description:
    'An approved La Vivenzia partner: the host, business or professional behind experiences and properties.',
  icon: 'IconHeartHandshake',
  labelIdentifierFieldMetadataUniversalIdentifier: PARTNER_NAME_FIELD_ID,
  fields: [
    {
      universalIdentifier: PARTNER_NAME_FIELD_ID,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAbc',
      defaultValue: "''",
    },
    {
      // Human-readable business key, allocated the same way an LV Lead ID is.
      universalIdentifier: PARTNER_CODE_FIELD_ID,
      type: FieldType.TEXT,
      name: 'partnerCode',
      label: 'Partner code',
      description: 'Stable human-readable identifier, e.g. LVP-000042',
      icon: 'IconHash',
      isNullable: true,
      isUnique: true,
    },
    {
      universalIdentifier: PARTNER_STATUS_FIELD_ID,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      icon: 'IconProgressCheck',
      isNullable: true,
      options: PARTNER_STATUS_OPTIONS,
    },
    {
      universalIdentifier: PARTNER_TYPE_FIELD_ID,
      type: FieldType.SELECT,
      name: 'partnerType',
      label: 'Partner type',
      icon: 'IconCategory',
      isNullable: true,
      options: PARTNER_TYPE_OPTIONS,
    },
    {
      universalIdentifier: PARTNER_LOCATION_FIELD_ID,
      type: FieldType.TEXT,
      name: 'location',
      label: 'Location',
      icon: 'IconMapPin',
      isNullable: true,
    },
    {
      // Provenance: which enquiry became this partner.
      universalIdentifier: PARTNER_LEAD_FIELD_ID,
      type: FieldType.RELATION,
      name: 'lead',
      label: 'Lead',
      icon: 'IconTargetArrow',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: LEAD_OBJECT_ID,
      relationTargetFieldMetadataUniversalIdentifier: PARTNER_ON_LEAD_FIELD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'leadId',
      },
    },
  ],
});
