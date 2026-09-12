import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  NAV_FOLDER_WORK_ID,
  NAV_NOTIFICATIONS_ID,
  PL_NOTIFICATION_CENTRE_ID,
} from 'src/constants/universal-identifiers';

// Sidebar entry for the notification centre, first in the Work folder — the
// place a team member starts the day.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_NOTIFICATIONS_ID,
  name: 'Notifications',
  icon: 'IconBell',
  position: 1,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  folderUniversalIdentifier: NAV_FOLDER_WORK_ID,
  pageLayoutUniversalIdentifier: PL_NOTIFICATION_CENTRE_ID,
});
