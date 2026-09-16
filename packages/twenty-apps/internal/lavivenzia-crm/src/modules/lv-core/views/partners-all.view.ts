import { defineView, getSystemViewFieldUniversalIdentifier, getSystemViewUniversalIdentifier, SYSTEM_VIEW_KEYS, ViewSortDirection } from 'twenty-sdk/define';

import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  PARTNER_ACTIVATED_AT_FIELD_ID,
  PARTNER_APPROVED_AT_FIELD_ID,
  PARTNER_CATEGORY_FIELD_ID,
  PARTNER_CODE_FIELD_ID,
  PARTNER_CONTACT_FIELD_ID,
  PARTNER_EMAILS_FIELD_ID,
  PARTNER_GEOGRAPHY_FIELD_ID,
  PARTNER_INSTAGRAM_FIELD_ID,
  PARTNER_LANGUAGES_FIELD_ID,
  PARTNER_LEAD_FIELD_ID,
  PARTNER_LOCATION_FIELD_ID,
  PARTNER_NAME_FIELD_ID,
  PARTNER_OBJECT_ID,
  PARTNER_ONBOARDING_FIELD_ID,
  PARTNER_ORGANISATION_FIELD_ID,
  PARTNER_OWNER_FIELD_ID,
  PARTNER_PHONES_FIELD_ID,
  PARTNER_SOURCE_KEY_FIELD_ID,
  PARTNER_STATUS_FIELD_ID,
  PARTNER_STATUS_REASON_FIELD_ID,
  PARTNER_SUBCATEGORY_FIELD_ID,
  PARTNER_TYPE_FIELD_ID,
  PARTNER_WEBSITE_FIELD_ID,
} from 'src/constants/universal-identifiers';

const VIEW_ID = getSystemViewUniversalIdentifier({
  objectMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: PARTNER_OBJECT_ID,
  viewKey: SYSTEM_VIEW_KEYS.INDEX,
});

// Day 9 — partner view "All partners". The object's own index view, under its deterministic identifier, so the platform's auto-generated every-column version is replaced by an intentional one.

export default defineView({
  universalIdentifier: VIEW_ID,
  name: 'All partners',
  objectUniversalIdentifier: PARTNER_OBJECT_ID,
  icon: 'IconHeartHandshake',
  position: 0,
  fields: [
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_NAME_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_NAME_FIELD_ID, position: 0, isVisible: true, size: 200 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_CODE_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_CODE_FIELD_ID, position: 1, isVisible: true, size: 120 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_STATUS_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_STATUS_FIELD_ID, position: 2, isVisible: true, size: 140 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_CATEGORY_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_CATEGORY_FIELD_ID, position: 3, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_SUBCATEGORY_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_SUBCATEGORY_FIELD_ID, position: 4, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_LOCATION_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_LOCATION_FIELD_ID, position: 5, isVisible: true, size: 140 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_OWNER_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_OWNER_FIELD_ID, position: 6, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_TYPE_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_TYPE_FIELD_ID, position: 7, isVisible: true, size: 130 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_APPROVED_AT_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_APPROVED_AT_FIELD_ID, position: 8, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_ACTIVATED_AT_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_ACTIVATED_AT_FIELD_ID, position: 9, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_LEAD_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_LEAD_FIELD_ID, position: 10, isVisible: true, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_ONBOARDING_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_ONBOARDING_FIELD_ID, position: 11, isVisible: true, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_GEOGRAPHY_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_GEOGRAPHY_FIELD_ID, position: 12, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_EMAILS_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_EMAILS_FIELD_ID, position: 13, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_PHONES_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_PHONES_FIELD_ID, position: 14, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_WEBSITE_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_WEBSITE_FIELD_ID, position: 15, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_INSTAGRAM_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_INSTAGRAM_FIELD_ID, position: 16, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_CONTACT_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_CONTACT_FIELD_ID, position: 17, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_ORGANISATION_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_ORGANISATION_FIELD_ID, position: 18, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_LANGUAGES_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_LANGUAGES_FIELD_ID, position: 19, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_STATUS_REASON_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_STATUS_REASON_FIELD_ID, position: 20, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PARTNER_SOURCE_KEY_FIELD_ID }), fieldMetadataUniversalIdentifier: PARTNER_SOURCE_KEY_FIELD_ID, position: 21, isVisible: false, size: 160 },
  ],
  sorts: [
    { universalIdentifier: 'bbc7b086-45e6-5d44-98e4-c023a4376d8c', fieldMetadataUniversalIdentifier: PARTNER_NAME_FIELD_ID, direction: ViewSortDirection.ASC },
  ],
});
