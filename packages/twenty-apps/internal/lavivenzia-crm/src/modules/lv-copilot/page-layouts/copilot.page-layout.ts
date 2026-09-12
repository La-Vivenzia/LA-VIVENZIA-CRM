import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import { FC_COPILOT_ID, PL_COPILOT_ID, PL_COPILOT_TAB_ID, PL_COPILOT_WIDGET_ID } from 'src/constants/universal-identifiers';

// The Copilot page (Work → Copilot): the morning briefing and the question
// box. One tab, one widget; every answer is computed server-side under the
// caller's own permissions.

export default definePageLayout({
  universalIdentifier: PL_COPILOT_ID,
  name: 'Copilot',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: PL_COPILOT_TAB_ID,
      title: 'Copilot',
      position: 0,
      icon: 'IconSparkles',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: PL_COPILOT_WIDGET_ID,
          title: 'Copilot',
          type: 'FRONT_COMPONENT',
          configuration: { configurationType: 'FRONT_COMPONENT', frontComponentUniversalIdentifier: FC_COPILOT_ID },
        },
      ],
    },
  ],
});
