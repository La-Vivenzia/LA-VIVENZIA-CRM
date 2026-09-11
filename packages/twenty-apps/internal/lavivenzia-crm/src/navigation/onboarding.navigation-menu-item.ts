import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  NAV_FOLDER_WORK_ID,
  NAV_ONBOARDING_ID,
  ONBOARDING_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// Sidebar entry.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_ONBOARDING_ID,
  name: 'Onboarding',
  icon: 'IconRoute',
  position: 0,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_WORK_ID,
  targetObjectUniversalIdentifier: ONBOARDING_OBJECT_ID,
});
