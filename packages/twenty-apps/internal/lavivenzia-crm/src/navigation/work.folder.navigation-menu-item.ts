import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { NAV_FOLDER_WORK_ID } from 'src/constants/universal-identifiers';

// Sidebar section. The workspace should read as a La Vivenzia CRM, not as a
// default Twenty install with objects listed in creation order.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_FOLDER_WORK_ID,
  name: 'Work',
  icon: 'IconChecklist',
  position: 1,
  type: NavigationMenuItemType.FOLDER,
});
