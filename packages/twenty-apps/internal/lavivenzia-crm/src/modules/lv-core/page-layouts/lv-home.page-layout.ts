import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  FC_LV_HOME_ID,
  PL_LV_HOME_ID,
  PL_LV_HOME_TAB_ID,
  PL_LV_HOME_WIDGET_ID,
} from 'src/constants/universal-identifiers';

// The La Vivenzia workspace. One tab, one widget: the front component is the
// whole screen — sidebar, top bar and content — as the approved reference
// boards show it (docs/UI-EXACT-MATCH-PLAN.md).

export default definePageLayout({
  universalIdentifier: PL_LV_HOME_ID,
  name: 'La Vivenzia',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: PL_LV_HOME_TAB_ID,
      title: 'La Vivenzia',
      position: 0,
      icon: 'IconHome',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: PL_LV_HOME_WIDGET_ID,
          title: 'La Vivenzia',
          type: 'FRONT_COMPONENT',
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: FC_LV_HOME_ID,
          },
        },
      ],
    },
  ],
});
