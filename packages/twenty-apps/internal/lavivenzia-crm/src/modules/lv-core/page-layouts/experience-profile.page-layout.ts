import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import { EXPERIENCE_OBJECT_ID, FC_EXPERIENCE_360_ID, PL_EXPERIENCE_360_TAB_ID, PL_EXPERIENCE_360_WIDGET_ID, PL_EXPERIENCE_DETAILS_TAB_ID, PL_EXPERIENCE_DETAILS_WIDGET_ID, PL_EXPERIENCE_PROFILE_ID } from 'src/constants/universal-identifiers';

// The Experience record page: the La Vivenzia Experience 360 as the main tab
// (Day 9), Twenty's field editor kept as Details so nothing the platform
// offers is lost behind the LV surface. Position 1 for the 360: Twenty
// renders a record page's first tab as the narrow left column.

export default definePageLayout({
  universalIdentifier: PL_EXPERIENCE_PROFILE_ID,
  name: 'Experience profile',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: EXPERIENCE_OBJECT_ID,
  defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier: PL_EXPERIENCE_360_TAB_ID,
  tabs: [
    {
      universalIdentifier: PL_EXPERIENCE_360_TAB_ID,
      title: 'Experience 360',
      position: 1,
      icon: 'IconCompass',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: PL_EXPERIENCE_360_WIDGET_ID,
          title: 'Experience 360',
          type: 'FRONT_COMPONENT',
          configuration: { configurationType: 'FRONT_COMPONENT', frontComponentUniversalIdentifier: FC_EXPERIENCE_360_ID },
        },
      ],
    },
    {
      universalIdentifier: PL_EXPERIENCE_DETAILS_TAB_ID,
      title: 'Details',
      position: 0,
      icon: 'IconListDetails',
      widgets: [
        {
          universalIdentifier: PL_EXPERIENCE_DETAILS_WIDGET_ID,
          title: 'Experience',
          type: 'FIELDS',
          configuration: { configurationType: 'FIELDS' },
        },
      ],
    },
  ],
});
