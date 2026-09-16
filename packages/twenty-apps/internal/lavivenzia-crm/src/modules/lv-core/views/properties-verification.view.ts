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

// Day 9 — property view "Verification". Filtered on status; every field stays reachable through the column picker.

export default defineView({
  universalIdentifier: 'b1926c81-7ca3-5ae8-ab21-d6376d68af6d',
  name: 'Verification',
  objectUniversalIdentifier: PROPERTY_OBJECT_ID,
  icon: 'IconHome',
  position: 1,
  fields: [
    { universalIdentifier: '5554a0ad-253b-5b59-8777-86ebcdf64613', fieldMetadataUniversalIdentifier: PROPERTY_NAME_FIELD_ID, position: 0, isVisible: true, size: 200 },
    { universalIdentifier: '71751838-7e1b-5f72-98d8-9a3d084f217a', fieldMetadataUniversalIdentifier: PROPERTY_CODE_FIELD_ID, position: 1, isVisible: true, size: 120 },
    { universalIdentifier: '30317a71-90ab-5ed6-a0e2-308b5f256129', fieldMetadataUniversalIdentifier: PROPERTY_STATUS_FIELD_ID, position: 2, isVisible: true, size: 150 },
    { universalIdentifier: '7fec7e6d-c94b-53db-9276-5caeaf97dd09', fieldMetadataUniversalIdentifier: PROPERTY_PARTNER_FIELD_ID, position: 3, isVisible: true, size: 170 },
    { universalIdentifier: '9dd88425-cf4a-5d46-9848-25c22c7a3326', fieldMetadataUniversalIdentifier: PROPERTY_TYPE_FIELD_ID, position: 4, isVisible: true, size: 150 },
    { universalIdentifier: 'f4008995-4ffe-5c53-8b28-8005aa376229', fieldMetadataUniversalIdentifier: PROPERTY_LOCATION_FIELD_ID, position: 5, isVisible: true, size: 140 },
    { universalIdentifier: 'df5a921d-238e-5ddc-a14a-0202260a5fe3', fieldMetadataUniversalIdentifier: PROPERTY_OWNER_FIELD_ID, position: 6, isVisible: true, size: 150 },
    { universalIdentifier: '7d948853-fc29-58e6-9971-7017dfe156ab', fieldMetadataUniversalIdentifier: PROPERTY_CAPACITY_FIELD_ID, position: 7, isVisible: true, size: 100 },
    { universalIdentifier: '26d3e379-f40a-5e50-92e3-6204ea494007', fieldMetadataUniversalIdentifier: PROPERTY_BASE_PRICE_FIELD_ID, position: 8, isVisible: true, size: 130 },
    { universalIdentifier: 'eb652f8b-6f5c-5c11-bac3-3f8c11925185', fieldMetadataUniversalIdentifier: PROPERTY_SUBMITTED_AT_FIELD_ID, position: 9, isVisible: true, size: 150 },
    { universalIdentifier: '14705b88-6aa2-5e53-a836-564b2f227a97', fieldMetadataUniversalIdentifier: PROPERTY_APPROVED_AT_FIELD_ID, position: 10, isVisible: true, size: 150 },
    { universalIdentifier: 'dfb2fa25-3243-5d86-96ef-c610d6115f3b', fieldMetadataUniversalIdentifier: PROPERTY_ACTIVATED_AT_FIELD_ID, position: 11, isVisible: true, size: 150 },
    { universalIdentifier: '599bf57a-68c1-5f14-bfbc-b6d53941236c', fieldMetadataUniversalIdentifier: PROPERTY_DESTINATION_FIELD_ID, position: 12, isVisible: false, size: 160 },
    { universalIdentifier: '5ab17b70-ae61-5dfd-9fbe-b3081605f187', fieldMetadataUniversalIdentifier: PROPERTY_ROOMS_FIELD_ID, position: 13, isVisible: false, size: 160 },
    { universalIdentifier: '7d27cc3e-b97d-5b40-9bfc-0ab653a2e2c8', fieldMetadataUniversalIdentifier: PROPERTY_REVIEWER_FIELD_ID, position: 14, isVisible: false, size: 160 },
    { universalIdentifier: '1e8213ac-92d3-5265-9551-16ed9ba4edf2', fieldMetadataUniversalIdentifier: PROPERTY_MANAGER_FIELD_ID, position: 15, isVisible: false, size: 160 },
    { universalIdentifier: '2ce40510-cfcf-5c52-a438-ef4871fac49a', fieldMetadataUniversalIdentifier: PROPERTY_STATUS_REASON_FIELD_ID, position: 16, isVisible: false, size: 160 },
    { universalIdentifier: '709f2702-22ef-5b04-aa48-d2d03599bb36', fieldMetadataUniversalIdentifier: PROPERTY_ONBOARDING_FIELD_ID, position: 17, isVisible: false, size: 160 },
  ],
  filters: [
    { universalIdentifier: 'df13db59-6209-5e70-a94a-c153bceca139', fieldMetadataUniversalIdentifier: PROPERTY_STATUS_FIELD_ID, operand: ViewFilterOperand.IS, value: ['IN_REVIEW'] },
  ],
  sorts: [
    { universalIdentifier: '246113be-bfd6-50fc-bc97-aa83ceb2b011', fieldMetadataUniversalIdentifier: PROPERTY_NAME_FIELD_ID, direction: ViewSortDirection.ASC },
  ],
});
