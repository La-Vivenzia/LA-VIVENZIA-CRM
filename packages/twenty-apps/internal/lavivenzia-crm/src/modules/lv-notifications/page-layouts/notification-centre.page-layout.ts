import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  FC_NOTIFICATION_CENTRE_ID,
  PL_NOTIFICATION_CENTRE_ID,
  PL_NOTIFICATION_CENTRE_TAB_ID,
  PL_NOTIFICATION_CENTRE_WIDGET_ID,
} from 'src/constants/universal-identifiers';

// A standalone page hosting the notification centre. One tab, one widget: the
// front component is the page. Reached from the "Notifications" entry in the
// Work folder of the sidebar.

export default definePageLayout({
  universalIdentifier: PL_NOTIFICATION_CENTRE_ID,
  name: 'Notifications',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: PL_NOTIFICATION_CENTRE_TAB_ID,
      title: 'Notifications',
      position: 0,
      icon: 'IconBell',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: PL_NOTIFICATION_CENTRE_WIDGET_ID,
          title: 'Notification centre',
          type: 'FRONT_COMPONENT',
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: FC_NOTIFICATION_CENTRE_ID,
          },
        },
      ],
    },
  ],
});
