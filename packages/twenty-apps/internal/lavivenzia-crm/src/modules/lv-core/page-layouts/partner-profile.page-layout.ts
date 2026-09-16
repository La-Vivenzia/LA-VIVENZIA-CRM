import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import { FC_PARTNER_360_ID, PARTNER_OBJECT_ID, PL_PARTNER_360_TAB_ID, PL_PARTNER_360_WIDGET_ID, PL_PARTNER_DETAILS_TAB_ID, PL_PARTNER_DETAILS_WIDGET_ID, PL_PARTNER_PROFILE_ID } from 'src/constants/universal-identifiers';

// The Partner record page: the La Vivenzia Partner 360 as the main tab
// (Day 9), Twenty's field editor kept as Details so nothing the platform
// offers is lost behind the LV surface. Position 1 for the 360: Twenty
// renders a record page's first tab as the narrow left column.

export default definePageLayout({
  universalIdentifier: PL_PARTNER_PROFILE_ID,
  name: 'Partner profile',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: PARTNER_OBJECT_ID,
  defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier: PL_PARTNER_360_TAB_ID,
  tabs: [
    {
      universalIdentifier: PL_PARTNER_360_TAB_ID,
      title: 'Partner 360',
      position: 1,
      icon: 'IconHeartHandshake',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: PL_PARTNER_360_WIDGET_ID,
          title: 'Partner 360',
          type: 'FRONT_COMPONENT',
          configuration: { configurationType: 'FRONT_COMPONENT', frontComponentUniversalIdentifier: FC_PARTNER_360_ID },
        },
      ],
    },
    {
      universalIdentifier: PL_PARTNER_DETAILS_TAB_ID,
      title: 'Details',
      position: 0,
      icon: 'IconListDetails',
      widgets: [
        {
          universalIdentifier: PL_PARTNER_DETAILS_WIDGET_ID,
          title: 'Partner',
          type: 'FIELDS',
          configuration: { configurationType: 'FIELDS' },
        },
      ],
    },
  ],
});
