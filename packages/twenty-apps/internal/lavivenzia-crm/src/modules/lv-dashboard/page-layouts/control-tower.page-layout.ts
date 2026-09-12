import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  FC_CONTROL_TOWER_ID,
  PL_CONTROL_TOWER_ID,
  PL_CONTROL_TOWER_TAB_ID,
  PL_CONTROL_TOWER_WIDGET_ID,
} from 'src/constants/universal-identifiers';

// The Admin Control Tower page. The page itself is reachable by anyone who
// can see the sidebar (Twenty navigation is shared metadata); the data behind
// it is refused server-side to non-administrators, and the component shows
// an "administrators only" state instead of an empty dashboard.

export default definePageLayout({
  universalIdentifier: PL_CONTROL_TOWER_ID,
  name: 'Control Tower',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: PL_CONTROL_TOWER_TAB_ID,
      title: 'Control Tower',
      position: 0,
      icon: 'IconRadar',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: PL_CONTROL_TOWER_WIDGET_ID,
          title: 'Control Tower',
          type: 'FRONT_COMPONENT',
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: FC_CONTROL_TOWER_ID,
          },
        },
      ],
    },
  ],
});
