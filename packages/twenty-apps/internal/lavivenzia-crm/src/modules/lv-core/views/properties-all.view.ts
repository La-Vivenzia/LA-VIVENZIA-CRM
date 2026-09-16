import { defineView, getSystemViewFieldUniversalIdentifier, getSystemViewUniversalIdentifier, SYSTEM_VIEW_KEYS, ViewSortDirection } from 'twenty-sdk/define';

import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  PROPERTY_ACTIVATED_AT_FIELD_ID,
  PROPERTY_APPROVED_AT_FIELD_ID,
  PROPERTY_BASE_PRICE_FIELD_ID,
  PROPERTY_CAPACITY_FIELD_ID,
  PROPERTY_CODE_FIELD_ID,
  PROPERTY_DESTINATION_FIELD_ID,
  PROPERTY_LOCATION_FIELD_ID,
  PROPERTY_MANAGER_FIELD_ID,
  PROPERTY_NAME_FIELD_ID,
  PROPERTY_OBJECT_ID,
  PROPERTY_ONBOARDING_FIELD_ID,
  PROPERTY_OWNER_FIELD_ID,
  PROPERTY_PARTNER_FIELD_ID,
  PROPERTY_REVIEWER_FIELD_ID,
  PROPERTY_ROOMS_FIELD_ID,
  PROPERTY_STATUS_FIELD_ID,
  PROPERTY_STATUS_REASON_FIELD_ID,
  PROPERTY_SUBMITTED_AT_FIELD_ID,
  PROPERTY_TYPE_FIELD_ID,
} from 'src/constants/universal-identifiers';

const VIEW_ID = getSystemViewUniversalIdentifier({
  objectMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: PROPERTY_OBJECT_ID,
  viewKey: SYSTEM_VIEW_KEYS.INDEX,
});

// Day 9 — property view "All properties". The object's own index view, under its deterministic identifier, so the platform's auto-generated every-column version is replaced by an intentional one.

export default defineView({
  universalIdentifier: VIEW_ID,
  name: 'All properties',
  objectUniversalIdentifier: PROPERTY_OBJECT_ID,
  icon: 'IconHome',
  position: 0,
  fields: [
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_NAME_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_NAME_FIELD_ID, position: 0, isVisible: true, size: 200 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_CODE_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_CODE_FIELD_ID, position: 1, isVisible: true, size: 120 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_STATUS_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_STATUS_FIELD_ID, position: 2, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_PARTNER_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_PARTNER_FIELD_ID, position: 3, isVisible: true, size: 170 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_TYPE_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_TYPE_FIELD_ID, position: 4, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_LOCATION_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_LOCATION_FIELD_ID, position: 5, isVisible: true, size: 140 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_OWNER_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_OWNER_FIELD_ID, position: 6, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_CAPACITY_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_CAPACITY_FIELD_ID, position: 7, isVisible: true, size: 100 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_BASE_PRICE_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_BASE_PRICE_FIELD_ID, position: 8, isVisible: true, size: 130 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_SUBMITTED_AT_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_SUBMITTED_AT_FIELD_ID, position: 9, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_APPROVED_AT_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_APPROVED_AT_FIELD_ID, position: 10, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_ACTIVATED_AT_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_ACTIVATED_AT_FIELD_ID, position: 11, isVisible: true, size: 150 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_DESTINATION_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_DESTINATION_FIELD_ID, position: 12, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_ROOMS_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_ROOMS_FIELD_ID, position: 13, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_REVIEWER_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_REVIEWER_FIELD_ID, position: 14, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_MANAGER_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_MANAGER_FIELD_ID, position: 15, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_STATUS_REASON_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_STATUS_REASON_FIELD_ID, position: 16, isVisible: false, size: 160 },
    { universalIdentifier: getSystemViewFieldUniversalIdentifier({ fieldMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, viewUniversalIdentifier: VIEW_ID, fieldMetadataUniversalIdentifier: PROPERTY_ONBOARDING_FIELD_ID }), fieldMetadataUniversalIdentifier: PROPERTY_ONBOARDING_FIELD_ID, position: 17, isVisible: false, size: 160 },
  ],
  sorts: [
    { universalIdentifier: 'e1ad920a-7350-52a5-bd8e-073b853c1bf4', fieldMetadataUniversalIdentifier: PROPERTY_NAME_FIELD_ID, direction: ViewSortDirection.ASC },
  ],
});
