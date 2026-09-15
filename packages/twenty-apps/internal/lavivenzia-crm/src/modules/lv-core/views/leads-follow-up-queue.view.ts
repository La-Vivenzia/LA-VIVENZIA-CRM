import { defineView, ViewSortDirection } from 'twenty-sdk/define';

import {
  LEAD_LV_ID_FIELD_ID,
  LEAD_NAME_FIELD_ID,
  LEAD_NEXT_ACTION_FIELD_ID,
  LEAD_NEXT_FOLLOW_UP_FIELD_ID,
  LEAD_OBJECT_ID,
  LEAD_ORGANISATION_FIELD_ID,
  LEAD_OWNER_FIELD_ID,
  LEAD_PRIORITY_FIELD_ID,
  LEAD_STATUS_FIELD_ID,
  VIEW_LEADS_ALL_ID,
} from 'src/constants/universal-identifiers';

// The follow-up queue: the same leads ordered by when they are next due,
// showing only what a coordinator needs to work the queue — who, what next,
// when, how urgent. Uses the identifier the former "All leads" view held so
// the platform updates it in place.

export default defineView({
  universalIdentifier: VIEW_LEADS_ALL_ID,
  name: 'Follow-up queue',
  objectUniversalIdentifier: LEAD_OBJECT_ID,
  icon: 'IconClockExclamation',
  position: 1,
  fields: [
    { universalIdentifier: '5753cbbf-4544-4770-be81-b10332997eee', fieldMetadataUniversalIdentifier: LEAD_NAME_FIELD_ID, position: 0, isVisible: true, size: 200 },
    { universalIdentifier: 'd32639ba-8ca0-4454-80db-ef7840cbda6a', fieldMetadataUniversalIdentifier: LEAD_LV_ID_FIELD_ID, position: 1, isVisible: true, size: 110 },
    { universalIdentifier: 'ea624e8e-1481-4f74-9526-acc67d0a8221', fieldMetadataUniversalIdentifier: LEAD_NEXT_FOLLOW_UP_FIELD_ID, position: 2, isVisible: true, size: 170 },
    { universalIdentifier: 'ae6e8836-29f9-40eb-a6c8-c449809241c0', fieldMetadataUniversalIdentifier: LEAD_NEXT_ACTION_FIELD_ID, position: 3, isVisible: true, size: 240 },
    { universalIdentifier: '7af41d54-4aeb-4876-898a-0c4a36d798e8', fieldMetadataUniversalIdentifier: LEAD_PRIORITY_FIELD_ID, position: 4, isVisible: true, size: 110 },
    { universalIdentifier: '7a2e25a4-83b5-4fc2-bcc8-44b0ea7e11ff', fieldMetadataUniversalIdentifier: LEAD_STATUS_FIELD_ID, position: 5, isVisible: true, size: 150 },
    { universalIdentifier: '37bc2fbd-77a7-4847-8cfb-19c92f81b207', fieldMetadataUniversalIdentifier: LEAD_OWNER_FIELD_ID, position: 6, isVisible: true, size: 150 },
    { universalIdentifier: '13ad08c6-dd59-444d-8cc6-b1e7c4a9d9c9', fieldMetadataUniversalIdentifier: LEAD_ORGANISATION_FIELD_ID, position: 7, isVisible: true, size: 180 },
  ],
  sorts: [
    {
      universalIdentifier: '1aaa8815-542d-4ba6-afdd-4cb86934d698',
      fieldMetadataUniversalIdentifier: LEAD_NEXT_FOLLOW_UP_FIELD_ID,
      direction: ViewSortDirection.ASC,
    },
  ],
});
