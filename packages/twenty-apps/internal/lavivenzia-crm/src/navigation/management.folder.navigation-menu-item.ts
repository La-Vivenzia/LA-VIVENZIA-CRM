import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { NAV_FOLDER_MANAGEMENT_ID } from 'src/constants/universal-identifiers';

// Management: the Control Tower. Twenty's navigation is shared metadata, so
// the folder is visible to everyone; the page's data is administrator-only
// on the server.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_FOLDER_MANAGEMENT_ID,
  name: 'Management',
  icon: 'IconRadar',
  position: 2,
  type: NavigationMenuItemType.FOLDER,
});
