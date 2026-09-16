import { defineView, getSystemViewFieldUniversalIdentifier, getSystemViewUniversalIdentifier, SYSTEM_VIEW_KEYS, ViewSortDirection } from 'twenty-sdk/define';

import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  EXPERIENCE_ACTIVATED_AT_FIELD_ID,
  EXPERIENCE_APPROVED_AT_FIELD_ID,
  EXPERIENCE_BASE_PRICE_FIELD_ID,
  EXPERIENCE_CAPACITY_FIELD_ID,
  EXPERIENCE_CATEGORY_FIELD_ID,
  EXPERIENCE_CODE_FIELD_ID,
  EXPERIENCE_DESTINATION_FIELD_ID,
  EXPERIENCE_DIFFICULTY_FIELD_ID,
  EXPERIENCE_DURATION_FIELD_ID,
  EXPERIENCE_HOST_FIELD_ID,
  EXPERIENCE_LANGUAGES_FIELD_ID,
  EXPERIENCE_LOCATION_FIELD_ID,
  EXPERIENCE_NAME_FIELD_ID,
  EXPERIENCE_OBJECT_ID,
  EXPERIENCE_ONBOARDING_FIELD_ID,
  EXPERIENCE_OWNER_FIELD_ID,
  EXPERIENCE_PARTNER_FIELD_ID,
  EXPERIENCE_REVIEWER_FIELD_ID,
  EXPERIENCE_STATUS_FIELD_ID,
  EXPERIENCE_STATUS_REASON_FIELD_ID,
  EXPERIENCE_SUBCATEGORY_FIELD_ID,
  EXPERIENCE_SUBMITTED_AT_FIELD_ID,
} from 'src/constants/universal-identifiers';

const VIEW_ID = getSystemViewUniversalIdentifier({
  objectMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: EXPERIENCE_OBJECT_ID,
  viewKey: SYSTEM_VIEW_KEYS.INDEX,
});

// Day 9 — experience view "All experiences". The object's own index view, under its deterministic identifier, so the platform's auto-generated every-column version is replaced by an intentional one.

export default defineView({
  universalIdentifier: VIEW_ID,
  name: 'All experiences',
  objectUniversalIdentifier: EXPERIENCE_OBJECT_ID,
  icon: 'IconCompass',
  position: 0,
  fields: [
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_NAME_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_NAME_FIELD_ID, position: 0, isVisible: true, size: 200 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_CODE_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_CODE_FIELD_ID, position: 1, isVisible: true, size: 120 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_STATUS_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_STATUS_FIELD_ID, position: 2, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_PARTNER_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_PARTNER_FIELD_ID, position: 3, isVisible: true, size: 170 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_CATEGORY_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_CATEGORY_FIELD_ID, position: 4, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_LOCATION_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_LOCATION_FIELD_ID, position: 5, isVisible: true, size: 140 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_OWNER_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_OWNER_FIELD_ID, position: 6, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_CAPACITY_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_CAPACITY_FIELD_ID, position: 7, isVisible: true, size: 110 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_BASE_PRICE_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_BASE_PRICE_FIELD_ID, position: 8, isVisible: true, size: 130 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_SUBMITTED_AT_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_SUBMITTED_AT_FIELD_ID, position: 9, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_APPROVED_AT_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_APPROVED_AT_FIELD_ID, position: 10, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_ACTIVATED_AT_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_ACTIVATED_AT_FIELD_ID, position: 11, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_SUBCATEGORY_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_SUBCATEGORY_FIELD_ID, position: 12, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_DESTINATION_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_DESTINATION_FIELD_ID, position: 13, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_DURATION_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_DURATION_FIELD_ID, position: 14, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_REVIEWER_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_REVIEWER_FIELD_ID, position: 15, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_HOST_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_HOST_FIELD_ID, position: 16, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_DIFFICULTY_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_DIFFICULTY_FIELD_ID, position: 17, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_LANGUAGES_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_LANGUAGES_FIELD_ID, position: 18, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_STATUS_REASON_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_STATUS_REASON_FIELD_ID, position: 19, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: EXPERIENCE_ONBOARDING_FIELD_ID }), fieldMetadataUniversalIdentifier: EXPERIENCE_ONBOARDING_FIELD_ID, position: 20, isVisible: false, size: 160 },
  ],
  sorts: [
    { universalIdentifier: 'fa4c767b-de12-5854-a894-402675c9d57e', fieldMetadataUniversalIdentifier: EXPERIENCE_NAME_FIELD_ID, direction: ViewSortDirection.ASC },
  ],
});
