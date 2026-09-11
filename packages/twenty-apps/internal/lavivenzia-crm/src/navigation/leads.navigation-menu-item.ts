import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  LEAD_OBJECT_ID,
  NAV_FOLDER_CRM_ID,
  NAV_LEADS_ID,
} from 'src/constants/universal-identifiers';

// Sidebar entry.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_LEADS_ID,
  name: 'Leads',
  icon: 'IconTargetArrow',
  position: 0,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_CRM_ID,
  targetObjectUniversalIdentifier: LEAD_OBJECT_ID,
});
