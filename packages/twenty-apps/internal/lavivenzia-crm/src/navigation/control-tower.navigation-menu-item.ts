import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  NAV_CONTROL_TOWER_ID,
  NAV_FOLDER_MANAGEMENT_ID,
  PL_CONTROL_TOWER_ID,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: NAV_CONTROL_TOWER_ID,
  name: 'Control Tower',
  icon: 'IconRadar',
  color: 'green',
  position: 0,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  folderUniversalIdentifier: NAV_FOLDER_MANAGEMENT_ID,
  pageLayoutUniversalIdentifier: PL_CONTROL_TOWER_ID,
});
