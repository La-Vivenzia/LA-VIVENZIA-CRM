import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  EXPERIENCE_OBJECT_ID,
  NAV_EXPERIENCES_ID,
  NAV_FOLDER_CRM_ID,
} from 'src/constants/universal-identifiers';

// Sidebar entry.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_EXPERIENCES_ID,
  name: 'Experiences',
  icon: 'IconCompass',
  color: 'green',
  position: 5,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_CRM_ID,
  targetObjectUniversalIdentifier: EXPERIENCE_OBJECT_ID,
});
