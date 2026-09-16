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

// Day 9 — property view "Active". Filtered on status; every field stays reachable through the column picker.

export default defineView({
  universalIdentifier: '119c8dc3-27e2-58c6-bd43-aa22109c50bf',
  name: 'Active',
  objectUniversalIdentifier: PROPERTY_OBJECT_ID,
  icon: 'IconHome',
  position: 3,
  fields: [
    { universalIdentifier: 'e27c9ee0-6cc4-5b6f-8484-2c605ac5881d', fieldMetadataUniversalIdentifier: PROPERTY_NAME_FIELD_ID, position: 0, isVisible: true, size: 200 },
    { universalIdentifier: '6ca8ea4e-cea3-52da-a2a8-d8857421ed71', fieldMetadataUniversalIdentifier: PROPERTY_CODE_FIELD_ID, position: 1, isVisible: true, size: 120 },
    { universalIdentifier: '8632b722-3eea-56ea-8a24-dbba5fc0747c', fieldMetadataUniversalIdentifier: PROPERTY_STATUS_FIELD_ID, position: 2, isVisible: true, size: 150 },
    { universalIdentifier: '52552f7b-de6c-5bf5-91d3-8d416729198c', fieldMetadataUniversalIdentifier: PROPERTY_PARTNER_FIELD_ID, position: 3, isVisible: true, size: 170 },
    { universalIdentifier: '6ae0a673-f346-56bb-9815-518896dd913d', fieldMetadataUniversalIdentifier: PROPERTY_TYPE_FIELD_ID, position: 4, isVisible: true, size: 150 },
    { universalIdentifier: '5ae5d297-257d-54f7-ac19-860a8a3ba8da', fieldMetadataUniversalIdentifier: PROPERTY_LOCATION_FIELD_ID, position: 5, isVisible: true, size: 140 },
    { universalIdentifier: '90b0562c-b57a-5a82-904c-d7a56460e90a', fieldMetadataUniversalIdentifier: PROPERTY_OWNER_FIELD_ID, position: 6, isVisible: true, size: 150 },
    { universalIdentifier: 'ab6a234f-b066-5dfc-8317-c0587346c0cb', fieldMetadataUniversalIdentifier: PROPERTY_CAPACITY_FIELD_ID, position: 7, isVisible: true, size: 100 },
    { universalIdentifier: '608f1ab8-2075-5059-9c49-3bdcc283a668', fieldMetadataUniversalIdentifier: PROPERTY_BASE_PRICE_FIELD_ID, position: 8, isVisible: true, size: 130 },
    { universalIdentifier: '5452290a-0707-5773-a324-6e50d952d362', fieldMetadataUniversalIdentifier: PROPERTY_SUBMITTED_AT_FIELD_ID, position: 9, isVisible: true, size: 150 },
    { universalIdentifier: 'b75006b5-cdd9-547a-832c-9121ec6d35ee', fieldMetadataUniversalIdentifier: PROPERTY_APPROVED_AT_FIELD_ID, position: 10, isVisible: true, size: 150 },
    { universalIdentifier: '0097afd6-33a2-5ab0-a11d-cbf66375ee7c', fieldMetadataUniversalIdentifier: PROPERTY_ACTIVATED_AT_FIELD_ID, position: 11, isVisible: true, size: 150 },
    { universalIdentifier: '8c6bb594-5486-53a0-8b99-99d257a3ee2e', fieldMetadataUniversalIdentifier: PROPERTY_DESTINATION_FIELD_ID, position: 12, isVisible: false, size: 160 },
    { universalIdentifier: '94f919e9-953f-5573-9496-218c168a542f', fieldMetadataUniversalIdentifier: PROPERTY_ROOMS_FIELD_ID, position: 13, isVisible: false, size: 160 },
    { universalIdentifier: 'cdab8485-d916-54b1-aebf-61696afb308f', fieldMetadataUniversalIdentifier: PROPERTY_REVIEWER_FIELD_ID, position: 14, isVisible: false, size: 160 },
    { universalIdentifier: 'a82f654c-a58d-5b4e-aa8c-b1c2ed1a2c2e', fieldMetadataUniversalIdentifier: PROPERTY_MANAGER_FIELD_ID, position: 15, isVisible: false, size: 160 },
    { universalIdentifier: '4c6d3a1c-2ab7-579a-986d-92dfefe55e27', fieldMetadataUniversalIdentifier: PROPERTY_STATUS_REASON_FIELD_ID, position: 16, isVisible: false, size: 160 },
    { universalIdentifier: '2b158204-d4c7-5820-baae-3f6bea20b625', fieldMetadataUniversalIdentifier: PROPERTY_ONBOARDING_FIELD_ID, position: 17, isVisible: false, size: 160 },
  ],
  filters: [
    { universalIdentifier: 'd733f4d5-ab19-5e4d-9fc6-2183d4bf9e5d', fieldMetadataUniversalIdentifier: PROPERTY_STATUS_FIELD_ID, operand: ViewFilterOperand.IS, value: ['LIVE'] },
  ],
  sorts: [
    { universalIdentifier: 'c072c209-a939-5d4a-8824-24cea56e87d9', fieldMetadataUniversalIdentifier: PROPERTY_NAME_FIELD_ID, direction: ViewSortDirection.ASC },
  ],
});
