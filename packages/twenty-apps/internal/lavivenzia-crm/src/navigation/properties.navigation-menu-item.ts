import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  NAV_FOLDER_CRM_ID,
  NAV_PROPERTIES_ID,
  PROPERTY_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// Sidebar entry.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_PROPERTIES_ID,
  name: 'Properties',
  icon: 'IconMapPin',
  color: 'green',
  position: 6,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_CRM_ID,
  targetObjectUniversalIdentifier: PROPERTY_OBJECT_ID,
});
