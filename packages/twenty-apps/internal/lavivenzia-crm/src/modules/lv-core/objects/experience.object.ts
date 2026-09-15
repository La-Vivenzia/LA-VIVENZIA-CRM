import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  EXPERIENCE_CAPACITY_FIELD_ID,
  EXPERIENCE_CATEGORY_FIELD_ID,
  EXPERIENCE_CODE_FIELD_ID,
  EXPERIENCE_DESCRIPTION_FIELD_ID,
  EXPERIENCE_LANGUAGES_FIELD_ID,
  EXPERIENCE_LOCATION_FIELD_ID,
  EXPERIENCE_NAME_FIELD_ID,
  EXPERIENCE_OBJECT_ID,
  EXPERIENCE_ON_PARTNER_FIELD_ID,
  EXPERIENCE_PARTNER_FIELD_ID,
  EXPERIENCE_STATUS_FIELD_ID,
  PARTNER_OBJECT_ID,
} from 'src/constants/universal-identifiers';
import { EXPERIENCE_STATUS_OPTIONS } from 'src/modules/lv-core/constants/partner-options';
import { LEAD_CATEGORY_OPTIONS } from 'src/modules/lv-core/constants/select-options.generated';

// An experience a partner offers.
//
// The Day 1-3 foundation only: what it is, who runs it, where, for how many
// and in which languages. Pricing, availability, images, quality signals and
// operational readiness are named in DATA-MODEL.md but belong to the phases
// that will actually read them.
//
// Category reuses the same vocabulary as the lead, so an enquiry about a STAY
// and the experience it becomes are describable in the same terms.

export default defineObject({
  universalIdentifier: EXPERIENCE_OBJECT_ID,
  nameSingular: 'lvExperience',
  namePlural: 'lvExperiences',
  labelSingular: 'Experience',
  labelPlural: 'Experiences',
  description:
    'An experience offered by a La Vivenzia partner: what it is, who runs it and where.',
  icon: 'IconCompass',
  labelIdentifierFieldMetadataUniversalIdentifier: EXPERIENCE_NAME_FIELD_ID,
  fields: [
    {
      universalIdentifier: EXPERIENCE_NAME_FIELD_ID,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAbc',
      defaultValue: "''",
    },
    {
      universalIdentifier: EXPERIENCE_CODE_FIELD_ID,
      type: FieldType.TEXT,
      name: 'experienceCode',
      label: 'Experience code',
      description: 'Stable human-readable identifier, e.g. LVE-000042',
      icon: 'IconHash',
      isNullable: true,
      isUnique: true,
    },
    {
      universalIdentifier: EXPERIENCE_STATUS_FIELD_ID,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      icon: 'IconProgressCheck',
      isNullable: true,
      options: EXPERIENCE_STATUS_OPTIONS,
    },
    {
      universalIdentifier: EXPERIENCE_CATEGORY_FIELD_ID,
      type: FieldType.SELECT,
      name: 'category',
      label: 'Category',
      icon: 'IconCategory',
      isNullable: true,
      options: LEAD_CATEGORY_OPTIONS,
    },
    {
      universalIdentifier: EXPERIENCE_DESCRIPTION_FIELD_ID,
      type: FieldType.TEXT,
      name: 'description',
      label: 'Description',
      icon: 'IconFileDescription',
      isNullable: true,
    },
    {
      universalIdentifier: EXPERIENCE_LOCATION_FIELD_ID,
      type: FieldType.TEXT,
      name: 'location',
      label: 'Location',
      icon: 'IconMapPin',
      isNullable: true,
    },
    {
      universalIdentifier: EXPERIENCE_CAPACITY_FIELD_ID,
      type: FieldType.NUMBER,
      name: 'capacity',
      label: 'Maximum guests',
      icon: 'IconUsers',
      isNullable: true,
    },
    {
      universalIdentifier: EXPERIENCE_LANGUAGES_FIELD_ID,
      type: FieldType.ARRAY,
      name: 'languages',
      label: 'Languages',
      icon: 'IconLanguage',
      isNullable: true,
    },
    {
      universalIdentifier: EXPERIENCE_PARTNER_FIELD_ID,
      type: FieldType.RELATION,
      name: 'partner',
      label: 'Partner',
      icon: 'IconHeartHandshake',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: PARTNER_OBJECT_ID,
      relationTargetFieldMetadataUniversalIdentifier: EXPERIENCE_ON_PARTNER_FIELD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'partnerId',
      },
    },
  ],
});
