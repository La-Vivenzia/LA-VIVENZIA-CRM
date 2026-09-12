import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  NAV_FOLDER_WORK_ID,
  NAV_SLAS_ID,
  SLA_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// Minimal SLA visibility for Day 4B: the object list, scoped by CM-004. The
// Control Tower view of the same data is Day 5.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_SLAS_ID,
  name: 'SLAs',
  icon: 'IconClockExclamation',
  position: 6,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_WORK_ID,
  targetObjectUniversalIdentifier: SLA_OBJECT_ID,
});
