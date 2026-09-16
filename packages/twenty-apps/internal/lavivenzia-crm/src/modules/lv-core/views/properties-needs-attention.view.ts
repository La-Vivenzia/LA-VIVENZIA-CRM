import { defineView, ViewFilterOperand, ViewSortDirection } from 'twenty-sdk/define';

import {
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

// Day 9 — property view "Needs attention". Filtered on status; every field stays reachable through the column picker.

export default defineView({
  universalIdentifier: 'ea1ea735-567c-5974-9ab8-70137a33a52e',
  name: 'Needs attention',
  objectUniversalIdentifier: PROPERTY_OBJECT_ID,
  icon: 'IconHome',
  position: 4,
  fields: [
    { universalIdentifier: '6a8384e1-a5cd-5ebf-858e-e7ca39c2ac19', fieldMetadataUniversalIdentifier: PROPERTY_NAME_FIELD_ID, position: 0, isVisible: true, size: 200 },
    { universalIdentifier: '7d8b64b9-67a4-5796-93e4-83f698de2bcc', fieldMetadataUniversalIdentifier: PROPERTY_CODE_FIELD_ID, position: 1, isVisible: true, size: 120 },
    { universalIdentifier: '7de0600a-4489-5196-a8a0-50de7b46609c', fieldMetadataUniversalIdentifier: PROPERTY_STATUS_FIELD_ID, position: 2, isVisible: true, size: 150 },
    { universalIdentifier: '4015c643-8a0e-5c97-b8d1-d1cd9e266f4e', fieldMetadataUniversalIdentifier: PROPERTY_PARTNER_FIELD_ID, position: 3, isVisible: true, size: 170 },
    { universalIdentifier: '2629d3dc-8d01-5946-96c0-1bc316c42295', fieldMetadataUniversalIdentifier: PROPERTY_TYPE_FIELD_ID, position: 4, isVisible: true, size: 150 },
    { universalIdentifier: '962d8917-92bc-5d0a-bbfa-917a1140c7e5', fieldMetadataUniversalIdentifier: PROPERTY_LOCATION_FIELD_ID, position: 5, isVisible: true, size: 140 },
    { universalIdentifier: '86b5dd9a-c0b4-5e9c-9748-bd554f7ea441', fieldMetadataUniversalIdentifier: PROPERTY_OWNER_FIELD_ID, position: 6, isVisible: true, size: 150 },
    { universalIdentifier: '51c88b95-611d-51e3-8807-6f72370dbe47', fieldMetadataUniversalIdentifier: PROPERTY_CAPACITY_FIELD_ID, position: 7, isVisible: true, size: 100 },
    { universalIdentifier: 'ef165afa-69fc-5249-b3a3-1e0d53147a6f', fieldMetadataUniversalIdentifier: PROPERTY_BASE_PRICE_FIELD_ID, position: 8, isVisible: true, size: 130 },
    { universalIdentifier: '90fc519e-dd83-5884-835b-2a6d094b6a36', fieldMetadataUniversalIdentifier: PROPERTY_SUBMITTED_AT_FIELD_ID, position: 9, isVisible: true, size: 150 },
    { universalIdentifier: '101de477-f5d2-512d-a0d6-28f3cbd291e3', fieldMetadataUniversalIdentifier: PROPERTY_APPROVED_AT_FIELD_ID, position: 10, isVisible: true, size: 150 },
    { universalIdentifier: '38b5d807-ddd1-5ffa-8d64-0d0f342ec845', fieldMetadataUniversalIdentifier: PROPERTY_ACTIVATED_AT_FIELD_ID, position: 11, isVisible: true, size: 150 },
    { universalIdentifier: 'eecf6281-82de-58aa-bb27-a945e063996f', fieldMetadataUniversalIdentifier: PROPERTY_DESTINATION_FIELD_ID, position: 12, isVisible: false, size: 160 },
    { universalIdentifier: '9d03b13b-8593-57cc-847e-02c3bda42dee', fieldMetadataUniversalIdentifier: PROPERTY_ROOMS_FIELD_ID, position: 13, isVisible: false, size: 160 },
    { universalIdentifier: '09860f3b-08ab-5686-8f34-b9162451ef96', fieldMetadataUniversalIdentifier: PROPERTY_REVIEWER_FIELD_ID, position: 14, isVisible: false, size: 160 },
    { universalIdentifier: '6e23f8c3-5762-5839-a59c-bf8858452b1f', fieldMetadataUniversalIdentifier: PROPERTY_MANAGER_FIELD_ID, position: 15, isVisible: false, size: 160 },
    { universalIdentifier: '7c5a7e5a-078a-5e73-b7cf-555aeb1bc4d2', fieldMetadataUniversalIdentifier: PROPERTY_STATUS_REASON_FIELD_ID, position: 16, isVisible: false, size: 160 },
    { universalIdentifier: 'f3af37c3-a188-51a3-bc60-02b0abc09776', fieldMetadataUniversalIdentifier: PROPERTY_ONBOARDING_FIELD_ID, position: 17, isVisible: false, size: 160 },
  ],
  filters: [
    { universalIdentifier: '0f5dbf6e-a550-512f-8f72-a55106303927', fieldMetadataUniversalIdentifier: PROPERTY_STATUS_FIELD_ID, operand: ViewFilterOperand.IS, value: ['IN_REVIEW','CHANGES_REQUIRED','SUSPENDED','READY'] },
  ],
  sorts: [
    { universalIdentifier: '84c589cb-8fa3-57c2-bada-6b175063abb1', fieldMetadataUniversalIdentifier: PROPERTY_NAME_FIELD_ID, direction: ViewSortDirection.ASC },
  ],
});
