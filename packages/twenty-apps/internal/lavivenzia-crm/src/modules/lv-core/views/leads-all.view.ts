import { defineView, getSystemViewUniversalIdentifier, SYSTEM_VIEW_KEYS, ViewSortDirection } from 'twenty-sdk/define';

import {
  AI_INSIGHTS_ON_LEAD_ID,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  ASSIGNMENT_HISTORY_ON_LEAD_FIELD_ID,
  INTERACTIONS_ON_LEAD_ID,
  LEAD_ASSIGNED_AT_FIELD_ID,
  LEAD_CAPTURE_MODE_FIELD_ID,
  LEAD_CATEGORY_FIELD_ID,
  LEAD_COMPLETENESS_FIELD_ID,
  LEAD_DUPLICATE_KEYS_FIELD_ID,
  LEAD_EMAIL_FIELD_ID,
  LEAD_INSTAGRAM_FIELD_ID,
  LEAD_LANGUAGES_FIELD_ID,
  LEAD_LAST_INTERACTION_FIELD_ID,
  LEAD_LOCATION_FIELD_ID,
  LEAD_LV_ID_FIELD_ID,
  LEAD_NAME_FIELD_ID,
  LEAD_NEXT_ACTION_FIELD_ID,
  LEAD_NEXT_FOLLOW_UP_FIELD_ID,
  LEAD_OBJECT_ID,
  LEAD_ONBOARDING_STATUS_FIELD_ID,
  LEAD_OPPORTUNITY_SCORE_FIELD_ID,
  LEAD_ORGANISATION_FIELD_ID,
  LEAD_OWNER_FIELD_ID,
  LEAD_PHONE_FIELD_ID,
  LEAD_PRIORITY_FIELD_ID,
  LEAD_PROVENANCE_FIELD_ID,
  LEAD_RAW_INPUT_FIELD_ID,
  LEAD_RELATIONSHIP_HEALTH_FIELD_ID,
  LEAD_SOURCE_FIELD_ID,
  LEAD_STATUS_FIELD_ID,
  LEAD_SUBCATEGORY_FIELD_ID,
  LEAD_WEBSITE_FIELD_ID,
  NOTIFICATIONS_ON_LEAD_FIELD_ID,
  ONBOARDINGS_ON_LEAD_ID,
  PARTNER_ON_LEAD_FIELD_ID,
  PROBLEMS_ON_LEAD_ID,
  SLAS_ON_LEAD_ID,
} from 'src/constants/universal-identifiers';

// The leads list employees actually search. Global search indexes only a
// lead's name (the platform's label identifier; there is no app-level way to
// add more), so finding a lead by LV ID, organisation, category, location,
// owner, status or source happens here through Twenty's own column filters —
// which is why every one of those is a visible column.
//
// This is the object's own index view — the one the sidebar opens — defined
// under its deterministic identifier so the platform's auto-generated
// "every column" version is replaced by an intentional one (Day 7B). The
// remaining fields stay reachable through the column picker (listed here
// hidden, under the identifiers the platform gave them).

export default defineView({
  universalIdentifier: getSystemViewUniversalIdentifier({
    objectMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier: LEAD_OBJECT_ID,
    viewKey: SYSTEM_VIEW_KEYS.INDEX,
  }),
  name: 'All leads',
  objectUniversalIdentifier: LEAD_OBJECT_ID,
  icon: 'IconTargetArrow',
  position: 0,
  fields: [
    { universalIdentifier: '739562cb-a0fb-5657-8792-7db85ceab42d', fieldMetadataUniversalIdentifier: LEAD_NAME_FIELD_ID, position: 0, isVisible: true, size: 200 },
    { universalIdentifier: '92bb8f4c-95a7-51b4-ad7d-d94609708c0d', fieldMetadataUniversalIdentifier: LEAD_LV_ID_FIELD_ID, position: 1, isVisible: true, size: 110 },
    { universalIdentifier: '6605bb99-bf4c-556a-86b8-adb0419ea71b', fieldMetadataUniversalIdentifier: LEAD_ORGANISATION_FIELD_ID, position: 2, isVisible: true, size: 180 },
    { universalIdentifier: 'b9f66956-81cc-5b43-80b6-62fd4687d2ff', fieldMetadataUniversalIdentifier: LEAD_STATUS_FIELD_ID, position: 3, isVisible: true, size: 150 },
    { universalIdentifier: '13d90ca9-c50d-5e95-80d5-8de05294ab7e', fieldMetadataUniversalIdentifier: LEAD_OWNER_FIELD_ID, position: 4, isVisible: true, size: 150 },
    { universalIdentifier: 'e9430fdf-cbd8-5338-aa40-54fb63a7b38d', fieldMetadataUniversalIdentifier: LEAD_CATEGORY_FIELD_ID, position: 5, isVisible: true, size: 150 },
    { universalIdentifier: 'a39a7e40-2273-5f70-8261-1a91632eb68e', fieldMetadataUniversalIdentifier: LEAD_LOCATION_FIELD_ID, position: 6, isVisible: true, size: 150 },
    { universalIdentifier: 'dab8ab96-b1c8-59a8-96b0-fc38a7020217', fieldMetadataUniversalIdentifier: LEAD_SOURCE_FIELD_ID, position: 7, isVisible: true, size: 130 },
    { universalIdentifier: '5e6d4ce1-a021-524e-b949-72803f6a97bd', fieldMetadataUniversalIdentifier: LEAD_PRIORITY_FIELD_ID, position: 8, isVisible: true, size: 110 },
    { universalIdentifier: '2f8ad27d-c3b4-5647-82cb-e7df5adea38c', fieldMetadataUniversalIdentifier: LEAD_NEXT_FOLLOW_UP_FIELD_ID, position: 9, isVisible: true, size: 170 },
    { universalIdentifier: '83263284-fc21-57ab-aff5-3b5e4dda1c16', fieldMetadataUniversalIdentifier: LEAD_SUBCATEGORY_FIELD_ID, position: 10, isVisible: false, size: 180 },
    { universalIdentifier: 'd910e238-f3bc-5c8a-bc2a-7ff1581e9a21', fieldMetadataUniversalIdentifier: LEAD_CAPTURE_MODE_FIELD_ID, position: 11, isVisible: false, size: 180 },
    { universalIdentifier: '3b4b4ca7-be24-521e-a4a0-ccac35d0c6d5', fieldMetadataUniversalIdentifier: LEAD_ASSIGNED_AT_FIELD_ID, position: 12, isVisible: false, size: 180 },
    { universalIdentifier: '9eb46201-b3b6-585c-bbdb-326feb617542', fieldMetadataUniversalIdentifier: LEAD_EMAIL_FIELD_ID, position: 13, isVisible: false, size: 180 },
    { universalIdentifier: '3cd46e80-f826-5e58-85e5-2914dcc711f6', fieldMetadataUniversalIdentifier: LEAD_PHONE_FIELD_ID, position: 14, isVisible: false, size: 180 },
    { universalIdentifier: '668998fd-bb67-546c-b8c4-ac854689b08c', fieldMetadataUniversalIdentifier: LEAD_WEBSITE_FIELD_ID, position: 15, isVisible: false, size: 180 },
    { universalIdentifier: '6f3e3626-50e3-5f8e-bbe7-b63994186a2f', fieldMetadataUniversalIdentifier: LEAD_INSTAGRAM_FIELD_ID, position: 16, isVisible: false, size: 180 },
    { universalIdentifier: '6c63925f-c19c-5381-ac67-8b317a7b4a28', fieldMetadataUniversalIdentifier: LEAD_LANGUAGES_FIELD_ID, position: 17, isVisible: false, size: 180 },
    { universalIdentifier: '3488d811-05db-5725-a3a9-690974442a69', fieldMetadataUniversalIdentifier: LEAD_OPPORTUNITY_SCORE_FIELD_ID, position: 18, isVisible: false, size: 180 },
    { universalIdentifier: 'dd9f8214-2360-5463-a07c-7d7ad02ff2a8', fieldMetadataUniversalIdentifier: LEAD_COMPLETENESS_FIELD_ID, position: 19, isVisible: false, size: 180 },
    { universalIdentifier: '2a6293eb-afa0-5cae-b805-6e84a4195c2f', fieldMetadataUniversalIdentifier: LEAD_RELATIONSHIP_HEALTH_FIELD_ID, position: 20, isVisible: false, size: 180 },
    { universalIdentifier: 'dba0777c-8990-5447-bd0a-3001c9680e8a', fieldMetadataUniversalIdentifier: LEAD_LAST_INTERACTION_FIELD_ID, position: 21, isVisible: false, size: 180 },
    { universalIdentifier: '0d4c1da3-6ee4-598c-8be4-3ebeb512121b', fieldMetadataUniversalIdentifier: LEAD_NEXT_ACTION_FIELD_ID, position: 22, isVisible: false, size: 180 },
    { universalIdentifier: 'e96abf98-6f51-508b-83c5-2f3530c3dadd', fieldMetadataUniversalIdentifier: LEAD_ONBOARDING_STATUS_FIELD_ID, position: 23, isVisible: false, size: 180 },
    { universalIdentifier: 'a0fa6c27-1acb-59d2-9878-04a4d51221d4', fieldMetadataUniversalIdentifier: LEAD_RAW_INPUT_FIELD_ID, position: 24, isVisible: false, size: 180 },
    { universalIdentifier: '19ff6bc8-4345-5eb7-ab71-dc989789d04a', fieldMetadataUniversalIdentifier: LEAD_PROVENANCE_FIELD_ID, position: 25, isVisible: false, size: 180 },
    { universalIdentifier: '5b323b70-18f3-591e-899c-e4b07335037b', fieldMetadataUniversalIdentifier: LEAD_DUPLICATE_KEYS_FIELD_ID, position: 26, isVisible: false, size: 180 },
    { universalIdentifier: 'ffaa5682-6f13-5079-943e-b2bdd10fdef5', fieldMetadataUniversalIdentifier: INTERACTIONS_ON_LEAD_ID, position: 27, isVisible: false, size: 180 },
    { universalIdentifier: '5f41db16-db5b-5e05-88b3-2b9b8c168fd3', fieldMetadataUniversalIdentifier: ASSIGNMENT_HISTORY_ON_LEAD_FIELD_ID, position: 28, isVisible: false, size: 180 },
    { universalIdentifier: '53a552a7-ee2b-58d4-8488-670fa9caec3e', fieldMetadataUniversalIdentifier: ONBOARDINGS_ON_LEAD_ID, position: 29, isVisible: false, size: 180 },
    { universalIdentifier: '11222e73-aad9-5c24-9902-273a9c4a3419', fieldMetadataUniversalIdentifier: 'f1276048-a61b-5000-b050-a6678dd8a1c9' /* createdAt */, position: 30, isVisible: false, size: 180 },
    { universalIdentifier: 'e9d43c0f-c54e-59f3-b2b9-17fe76147cc5', fieldMetadataUniversalIdentifier: '2baafa8f-eb83-5adc-9517-216376281628' /* createdBy */, position: 31, isVisible: false, size: 180 },
    { universalIdentifier: '72f1b9d3-9430-5b74-93be-8ad2e6ec3eef', fieldMetadataUniversalIdentifier: '8809edb5-14d4-5d00-8315-05d19f4085ad' /* updatedAt */, position: 32, isVisible: false, size: 180 },
    { universalIdentifier: 'a7556354-d4fd-5415-b9c0-e504d73b68fe', fieldMetadataUniversalIdentifier: 'c81f67d2-fd5b-5b2f-bbbf-37453ed5a9de' /* updatedBy */, position: 33, isVisible: false, size: 180 },
    { universalIdentifier: '4e844b69-62ae-5961-9c0f-1eb4533419cf', fieldMetadataUniversalIdentifier: PARTNER_ON_LEAD_FIELD_ID, position: 34, isVisible: false, size: 180 },
    { universalIdentifier: '5ce9df79-8471-5b7a-bd8a-383e1e7602b4', fieldMetadataUniversalIdentifier: NOTIFICATIONS_ON_LEAD_FIELD_ID, position: 35, isVisible: false, size: 180 },
    { universalIdentifier: 'bf410966-5cad-5cc1-b975-5221d3e9fdd7', fieldMetadataUniversalIdentifier: SLAS_ON_LEAD_ID, position: 36, isVisible: false, size: 180 },
    { universalIdentifier: 'efda0334-d07c-5398-b74c-6481ef9072b8', fieldMetadataUniversalIdentifier: AI_INSIGHTS_ON_LEAD_ID, position: 37, isVisible: false, size: 180 },
    { universalIdentifier: 'e90d0411-fe4e-556c-a9e6-b4ded7449eee', fieldMetadataUniversalIdentifier: PROBLEMS_ON_LEAD_ID, position: 38, isVisible: false, size: 180 },
  ],
  sorts: [
    {
      universalIdentifier: '601d84b2-c3f3-496a-9b0b-bb76cc90f4e9',
      fieldMetadataUniversalIdentifier: LEAD_NEXT_FOLLOW_UP_FIELD_ID,
      direction: ViewSortDirection.ASC,
    },
  ],
});
