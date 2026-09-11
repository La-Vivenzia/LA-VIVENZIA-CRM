import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  PARTNER_OBJECT_ID,
  PROPERTY_CAPACITY_FIELD_ID,
  PROPERTY_CODE_FIELD_ID,
  PROPERTY_LOCATION_FIELD_ID,
  PROPERTY_NAME_FIELD_ID,
  PROPERTY_OBJECT_ID,
  PROPERTY_ON_PARTNER_FIELD_ID,
  PROPERTY_PARTNER_FIELD_ID,
  PROPERTY_STATUS_FIELD_ID,
  PROPERTY_TYPE_FIELD_ID,
} from 'src/constants/universal-identifiers';
import {
  PROPERTY_STATUS_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from 'src/modules/lv-core/constants/partner-options';

// A place a partner offers: villa, homestay, farmstay, venue.
//
// Kept to the Day 1-3 foundation for the same reason as Experience. Pricing,
// availability and images are real requirements, but they are read by phases
// that do not exist yet, and empty columns are not a foundation.
//
// Documents deliberately stay on the onboarding rather than being duplicated
// here: verification is a property of the submission, not of the listing.

export default defineObject({
  universalIdentifier: PROPERTY_OBJECT_ID,
  nameSingular: 'lvProperty',
  namePlural: 'lvProperties',
  labelSingular: 'Property',
  labelPlural: 'Properties',
  description:
    'A place offered by a La Vivenzia partner: villa, homestay, farmstay or venue.',
  icon: 'IconHome',
  labelIdentifierFieldMetadataUniversalIdentifier: PROPERTY_NAME_FIELD_ID,
  fields: [
    {
      universalIdentifier: PROPERTY_NAME_FIELD_ID,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAbc',
      defaultValue: "''",
    },
    {
      universalIdentifier: PROPERTY_CODE_FIELD_ID,
      type: FieldType.TEXT,
      name: 'propertyCode',
      label: 'Property code',
      description: 'Stable human-readable identifier, e.g. LVR-000042',
      icon: 'IconHash',
      isNullable: true,
      isUnique: true,
    },
    {
      universalIdentifier: PROPERTY_STATUS_FIELD_ID,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      icon: 'IconProgressCheck',
      isNullable: true,
      options: PROPERTY_STATUS_OPTIONS,
    },
    {
      universalIdentifier: PROPERTY_TYPE_FIELD_ID,
      type: FieldType.SELECT,
      name: 'propertyType',
      label: 'Property type',
      icon: 'IconCategory',
      isNullable: true,
      options: PROPERTY_TYPE_OPTIONS,
    },
    {
      universalIdentifier: PROPERTY_LOCATION_FIELD_ID,
      type: FieldType.TEXT,
      name: 'location',
      label: 'Location',
      icon: 'IconMapPin',
      isNullable: true,
    },
    {
      universalIdentifier: PROPERTY_CAPACITY_FIELD_ID,
      type: FieldType.NUMBER,
      name: 'capacity',
      label: 'Maximum guests',
      icon: 'IconUsers',
      isNullable: true,
    },
    {
      universalIdentifier: PROPERTY_PARTNER_FIELD_ID,
      type: FieldType.RELATION,
      name: 'partner',
      label: 'Partner',
      icon: 'IconHeartHandshake',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: PARTNER_OBJECT_ID,
      relationTargetFieldMetadataUniversalIdentifier: PROPERTY_ON_PARTNER_FIELD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'partnerId',
      },
    },
  ],
});
