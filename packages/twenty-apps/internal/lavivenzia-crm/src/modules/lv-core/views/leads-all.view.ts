import { defineView, ViewSortDirection } from 'twenty-sdk/define';

import {
  LEAD_CATEGORY_FIELD_ID,
  LEAD_LOCATION_FIELD_ID,
  LEAD_LV_ID_FIELD_ID,
  LEAD_NAME_FIELD_ID,
  LEAD_NEXT_FOLLOW_UP_FIELD_ID,
  LEAD_OBJECT_ID,
  LEAD_ORGANISATION_FIELD_ID,
  LEAD_OWNER_FIELD_ID,
  LEAD_PRIORITY_FIELD_ID,
  LEAD_SOURCE_FIELD_ID,
  LEAD_STATUS_FIELD_ID,
  VIEW_LEADS_ALL_ID,
} from 'src/constants/universal-identifiers';

// The leads list employees actually search. Global search indexes only a
// lead's name (the platform's label identifier; there is no app-level way to
// add more), so finding a lead by LV ID, organisation, category, location,
// owner, status or source happens here through Twenty's own column filters —
// which is why every one of those is a visible column.

export default defineView({
  universalIdentifier: VIEW_LEADS_ALL_ID,
  name: 'All leads',
  objectUniversalIdentifier: LEAD_OBJECT_ID,
  icon: 'IconTargetArrow',
  position: 0,
  fields: [
    { universalIdentifier: '5753cbbf-4544-4770-be81-b10332997eee', fieldMetadataUniversalIdentifier: LEAD_NAME_FIELD_ID, position: 0, isVisible: true, size: 200 },
    { universalIdentifier: 'd32639ba-8ca0-4454-80db-ef7840cbda6a', fieldMetadataUniversalIdentifier: LEAD_LV_ID_FIELD_ID, position: 1, isVisible: true, size: 110 },
    { universalIdentifier: '13ad08c6-dd59-444d-8cc6-b1e7c4a9d9c9', fieldMetadataUniversalIdentifier: LEAD_ORGANISATION_FIELD_ID, position: 2, isVisible: true, size: 180 },
    { universalIdentifier: '7a2e25a4-83b5-4fc2-bcc8-44b0ea7e11ff', fieldMetadataUniversalIdentifier: LEAD_STATUS_FIELD_ID, position: 3, isVisible: true, size: 150 },
    { universalIdentifier: '37bc2fbd-77a7-4847-8cfb-19c92f81b207', fieldMetadataUniversalIdentifier: LEAD_OWNER_FIELD_ID, position: 4, isVisible: true, size: 150 },
    { universalIdentifier: 'bf9fb449-7026-4888-a974-c21775ea98cb', fieldMetadataUniversalIdentifier: LEAD_CATEGORY_FIELD_ID, position: 5, isVisible: true, size: 150 },
    { universalIdentifier: 'f4f19c91-327b-4012-bf14-320fc5c7060b', fieldMetadataUniversalIdentifier: LEAD_LOCATION_FIELD_ID, position: 6, isVisible: true, size: 150 },
    { universalIdentifier: '44057340-dc54-4aea-9adf-2aaad94376ec', fieldMetadataUniversalIdentifier: LEAD_SOURCE_FIELD_ID, position: 7, isVisible: true, size: 130 },
    { universalIdentifier: '7af41d54-4aeb-4876-898a-0c4a36d798e8', fieldMetadataUniversalIdentifier: LEAD_PRIORITY_FIELD_ID, position: 8, isVisible: true, size: 110 },
    { universalIdentifier: 'ea624e8e-1481-4f74-9526-acc67d0a8221', fieldMetadataUniversalIdentifier: LEAD_NEXT_FOLLOW_UP_FIELD_ID, position: 9, isVisible: true, size: 170 },
  ],
  sorts: [
    {
      universalIdentifier: '1aaa8815-542d-4ba6-afdd-4cb86934d698',
      fieldMetadataUniversalIdentifier: LEAD_NEXT_FOLLOW_UP_FIELD_ID,
      direction: ViewSortDirection.ASC,
    },
  ],
});
