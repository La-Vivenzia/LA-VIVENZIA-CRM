import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { NAV_FOLDER_WORK_ID, NAV_QUICK_ADD_ID, PL_QUICK_ADD_ID } from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: NAV_QUICK_ADD_ID,
  name: 'Quick add lead',
  icon: 'IconUserPlus',
  color: 'green',
  position: 3,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  folderUniversalIdentifier: NAV_FOLDER_WORK_ID,
  pageLayoutUniversalIdentifier: PL_QUICK_ADD_ID,
});
