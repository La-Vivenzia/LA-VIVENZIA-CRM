import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { NAV_FOLDER_CRM_ID, NAV_OPPORTUNITIES_ID } from 'src/constants/universal-identifiers';

// Twenty's standard opportunity object, kept reachable under Relationships rather than as an orphan root item.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_OPPORTUNITIES_ID,
  name: 'Opportunities',
  icon: 'IconTargetArrow',
  color: 'green',
  position: 7,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_CRM_ID,
  targetObjectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
});
