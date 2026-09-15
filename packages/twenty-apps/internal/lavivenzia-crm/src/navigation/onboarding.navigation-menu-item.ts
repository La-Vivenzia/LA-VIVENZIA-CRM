import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  NAV_FOLDER_CRM_ID,
  NAV_ONBOARDING_ID,
  ONBOARDING_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// Sidebar entry.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_ONBOARDING_ID,
  name: 'Partner onboardings',
  icon: 'IconRoute',
  color: 'green',
  position: 1,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_CRM_ID,
  targetObjectUniversalIdentifier: ONBOARDING_OBJECT_ID,
});
