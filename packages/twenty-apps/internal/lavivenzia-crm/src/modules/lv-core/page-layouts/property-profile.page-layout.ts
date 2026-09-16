import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import { FC_PROPERTY_360_ID, PL_PROPERTY_360_TAB_ID, PL_PROPERTY_360_WIDGET_ID, PL_PROPERTY_DETAILS_TAB_ID, PL_PROPERTY_DETAILS_WIDGET_ID, PL_PROPERTY_PROFILE_ID, PROPERTY_OBJECT_ID } from 'src/constants/universal-identifiers';

// The Property record page: the La Vivenzia Property 360 as the main tab
// (Day 9), Twenty's field editor kept as Details so nothing the platform
// offers is lost behind the LV surface. Position 1 for the 360: Twenty
// renders a record page's first tab as the narrow left column.

export default definePageLayout({
  universalIdentifier: PL_PROPERTY_PROFILE_ID,
  name: 'Property profile',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: PROPERTY_OBJECT_ID,
  defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier: PL_PROPERTY_360_TAB_ID,
  tabs: [
    {
      universalIdentifier: PL_PROPERTY_360_TAB_ID,
      title: 'Property 360',
      position: 1,
      icon: 'IconHome',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: PL_PROPERTY_360_WIDGET_ID,
          title: 'Property 360',
          type: 'FRONT_COMPONENT',
          configuration: { configurationType: 'FRONT_COMPONENT', frontComponentUniversalIdentifier: FC_PROPERTY_360_ID },
        },
      ],
    },
    {
      universalIdentifier: PL_PROPERTY_DETAILS_TAB_ID,
      title: 'Details',
      position: 0,
      icon: 'IconListDetails',
      widgets: [
        {
          universalIdentifier: PL_PROPERTY_DETAILS_WIDGET_ID,
          title: 'Property',
          type: 'FIELDS',
          configuration: { configurationType: 'FIELDS' },
        },
      ],
    },
  ],
});
