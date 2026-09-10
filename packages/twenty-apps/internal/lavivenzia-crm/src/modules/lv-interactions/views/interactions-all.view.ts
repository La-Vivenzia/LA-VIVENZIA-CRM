import { defineView, ViewSortDirection } from 'twenty-sdk/define';

import {
  INTERACTION_CHANNEL_ID,
  INTERACTION_NAME_ID,
  INTERACTION_OBJECT_ID,
  INTERACTION_OCCURRED_AT_ID,
  INTERACTION_OUTCOME_ID,
  INTERACTION_SENTIMENT_ID,
  VIEW_INTERACTIONS_ALL_ID,
} from 'src/constants/universal-identifiers';

// The interaction history, newest first. Used standalone and as the
// Relationship tab widget on the Lead Profile.

export default defineView({
  universalIdentifier: VIEW_INTERACTIONS_ALL_ID,
  name: 'All interactions',
  objectUniversalIdentifier: INTERACTION_OBJECT_ID,
  icon: 'IconMessageDots',
  position: 0,
  fields: [
    {
      universalIdentifier: 'f1a2b3c4-d5e6-4f70-8a81-9b0c1d2e3f41',
      fieldMetadataUniversalIdentifier: INTERACTION_NAME_ID,
      position: 0,
      isVisible: true,
      size: 160,
    },
    {
      universalIdentifier: 'f2b3c4d5-e6f7-4a81-9b92-0c1d2e3f4a52',
      fieldMetadataUniversalIdentifier: INTERACTION_CHANNEL_ID,
      position: 1,
      isVisible: true,
      size: 130,
    },
    {
      universalIdentifier: 'f3c4d5e6-f7a8-4b92-8ca3-1d2e3f4a5b63',
      fieldMetadataUniversalIdentifier: INTERACTION_OCCURRED_AT_ID,
      position: 2,
      isVisible: true,
      size: 260,
    },
    {
      universalIdentifier: 'f4d5e6f7-a8b9-4ca3-8db4-2e3f4a5b6c74',
      fieldMetadataUniversalIdentifier: INTERACTION_OUTCOME_ID,
      position: 3,
      isVisible: true,
      size: 150,
    },
    {
      universalIdentifier: 'f5e6f7a8-b9c0-4db4-8ec5-3f4a5b6c7d85',
      fieldMetadataUniversalIdentifier: INTERACTION_SENTIMENT_ID,
      position: 4,
      isVisible: true,
      size: 120,
    },
  ],
  sorts: [
    {
      universalIdentifier: 'f6f7a8b9-c0d1-4ec5-8fd6-4a5b6c7d8e96',
      fieldMetadataUniversalIdentifier: INTERACTION_OCCURRED_AT_ID,
      direction: ViewSortDirection.DESC,
    },
  ],
});
