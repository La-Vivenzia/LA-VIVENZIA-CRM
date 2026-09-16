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

// Day 9 — property view "Pending approval" (In review, awaiting a decision). Filtered on status; every field stays reachable through the column picker.

export default defineView({
  universalIdentifier: '2d0ad543-e52f-50ea-9944-c28138fb149a',
  name: 'Pending approval',
  objectUniversalIdentifier: PROPERTY_OBJECT_ID,
  icon: 'IconHome',
  position: 2,
  fields: [
    { universalIdentifier: '2f8de959-66f0-56cb-adee-0342167173c5', fieldMetadataUniversalIdentifier: PROPERTY_NAME_FIELD_ID, position: 0, isVisible: true, size: 200 },
    { universalIdentifier: '3340aefe-4d5a-5be3-8968-e67ff388bd92', fieldMetadataUniversalIdentifier: PROPERTY_CODE_FIELD_ID, position: 1, isVisible: true, size: 120 },
    { universalIdentifier: '50d6fc5b-e37b-5cb7-b9ed-6d6959eb5cca', fieldMetadataUniversalIdentifier: PROPERTY_STATUS_FIELD_ID, position: 2, isVisible: true, size: 150 },
    { universalIdentifier: '135b0dac-0f26-5d5e-89d0-651a09f0eefc', fieldMetadataUniversalIdentifier: PROPERTY_PARTNER_FIELD_ID, position: 3, isVisible: true, size: 170 },
    { universalIdentifier: '7a0d8721-901e-59bf-9b40-18f7abd66895', fieldMetadataUniversalIdentifier: PROPERTY_TYPE_FIELD_ID, position: 4, isVisible: true, size: 150 },
    { universalIdentifier: '5aadcebb-5cc9-5a8f-a7ea-afb6126c92ca', fieldMetadataUniversalIdentifier: PROPERTY_LOCATION_FIELD_ID, position: 5, isVisible: true, size: 140 },
    { universalIdentifier: 'f112503b-c606-52b8-9d24-e7b132ee239e', fieldMetadataUniversalIdentifier: PROPERTY_OWNER_FIELD_ID, position: 6, isVisible: true, size: 150 },
    { universalIdentifier: 'b98647fa-bf91-5f5e-9062-82f6d70b443c', fieldMetadataUniversalIdentifier: PROPERTY_CAPACITY_FIELD_ID, position: 7, isVisible: true, size: 100 },
    { universalIdentifier: '239b6f33-cc32-58a4-8c7b-8c42f7974d2c', fieldMetadataUniversalIdentifier: PROPERTY_BASE_PRICE_FIELD_ID, position: 8, isVisible: true, size: 130 },
    { universalIdentifier: '88ec7056-e1c6-5f2a-b494-f3ee15f87c30', fieldMetadataUniversalIdentifier: PROPERTY_SUBMITTED_AT_FIELD_ID, position: 9, isVisible: true, size: 150 },
    { universalIdentifier: '078858fe-6d35-5ba2-8685-262a637e58bf', fieldMetadataUniversalIdentifier: PROPERTY_APPROVED_AT_FIELD_ID, position: 10, isVisible: true, size: 150 },
    { universalIdentifier: 'e5ff4998-8197-5b2b-bb54-da8e9bdbaad9', fieldMetadataUniversalIdentifier: PROPERTY_ACTIVATED_AT_FIELD_ID, position: 11, isVisible: true, size: 150 },
    { universalIdentifier: 'f4c515c8-bec9-505a-b664-c8a6b07dec09', fieldMetadataUniversalIdentifier: PROPERTY_DESTINATION_FIELD_ID, position: 12, isVisible: false, size: 160 },
    { universalIdentifier: '49c72775-da27-5583-b235-3cad9f93242f', fieldMetadataUniversalIdentifier: PROPERTY_ROOMS_FIELD_ID, position: 13, isVisible: false, size: 160 },
    { universalIdentifier: 'a98bcbfa-17b5-52ed-a352-5343ac5469ce', fieldMetadataUniversalIdentifier: PROPERTY_REVIEWER_FIELD_ID, position: 14, isVisible: false, size: 160 },
    { universalIdentifier: '878ea93f-5d53-5174-a673-1dbd3e060672', fieldMetadataUniversalIdentifier: PROPERTY_MANAGER_FIELD_ID, position: 15, isVisible: false, size: 160 },
    { universalIdentifier: 'a5122d5b-150c-5e1a-9fa0-21acec92b0db', fieldMetadataUniversalIdentifier: PROPERTY_STATUS_REASON_FIELD_ID, position: 16, isVisible: false, size: 160 },
    { universalIdentifier: '1b4c811a-40ba-550f-a6db-26112f940bdd', fieldMetadataUniversalIdentifier: PROPERTY_ONBOARDING_FIELD_ID, position: 17, isVisible: false, size: 160 },
  ],
  filters: [
    { universalIdentifier: '28ed4bb5-4d69-5779-92cf-d5687941d89d', fieldMetadataUniversalIdentifier: PROPERTY_STATUS_FIELD_ID, operand: ViewFilterOperand.IS, value: ['IN_REVIEW'] },
  ],
  sorts: [
    { universalIdentifier: '8616a44c-cfe9-5dc1-90b1-73788a23dbb9', fieldMetadataUniversalIdentifier: PROPERTY_NAME_FIELD_ID, direction: ViewSortDirection.ASC },
  ],
});
