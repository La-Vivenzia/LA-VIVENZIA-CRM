import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  NAV_FOLDER_CRM_ID,
  NAV_PARTNERS_ID,
  PARTNER_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// Sidebar entry.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_PARTNERS_ID,
  name: 'Partners',
  icon: 'IconHeartHandshake',
  color: 'green',
  position: 2,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_CRM_ID,
  targetObjectUniversalIdentifier: PARTNER_OBJECT_ID,
});
