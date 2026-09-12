import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  FC_MY_DASHBOARD_ID,
  PL_MY_DASHBOARD_ID,
  PL_MY_DASHBOARD_TAB_ID,
  PL_MY_DASHBOARD_WIDGET_ID,
} from 'src/constants/universal-identifiers';

// "My Dashboard" — the operational workspace, first entry in the Work folder.
// One tab, one widget: the front component IS the page; the server decides
// which role lens it shows.

export default definePageLayout({
  universalIdentifier: PL_MY_DASHBOARD_ID,
  name: 'My Dashboard',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: PL_MY_DASHBOARD_TAB_ID,
      title: 'My Dashboard',
      position: 0,
      icon: 'IconLayoutDashboard',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: PL_MY_DASHBOARD_WIDGET_ID,
          title: 'My Dashboard',
          type: 'FRONT_COMPONENT',
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: FC_MY_DASHBOARD_ID,
          },
        },
      ],
    },
  ],
});
