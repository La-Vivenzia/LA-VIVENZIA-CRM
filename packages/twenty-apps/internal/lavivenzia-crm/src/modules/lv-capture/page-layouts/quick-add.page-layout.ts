import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import { FC_QUICK_ADD_LEAD_ID, PL_QUICK_ADD_ID, PL_QUICK_ADD_TAB_ID, PL_QUICK_ADD_WIDGET_ID } from 'src/constants/universal-identifiers';

// Quick Add Lead as a page of its own (Work → Quick add), so capture is one
// click from anywhere and under thirty seconds from name to LV Lead ID.

export default definePageLayout({
  universalIdentifier: PL_QUICK_ADD_ID,
  name: 'Quick add lead',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: PL_QUICK_ADD_TAB_ID,
      title: 'Quick add lead',
      position: 0,
      icon: 'IconUserPlus',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: PL_QUICK_ADD_WIDGET_ID,
          title: 'Quick add lead',
          type: 'FRONT_COMPONENT',
          configuration: { configurationType: 'FRONT_COMPONENT', frontComponentUniversalIdentifier: FC_QUICK_ADD_LEAD_ID },
        },
      ],
    },
  ],
});
