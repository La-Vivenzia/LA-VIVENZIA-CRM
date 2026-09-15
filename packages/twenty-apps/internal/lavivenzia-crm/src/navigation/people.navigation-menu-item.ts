import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { NAV_FOLDER_CRM_ID, NAV_PEOPLE_ID } from 'src/constants/universal-identifiers';

// Sidebar entry.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_PEOPLE_ID,
  name: 'People',
  icon: 'IconUsers',
  color: 'green',
  position: 3,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_CRM_ID,
  targetObjectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
});
