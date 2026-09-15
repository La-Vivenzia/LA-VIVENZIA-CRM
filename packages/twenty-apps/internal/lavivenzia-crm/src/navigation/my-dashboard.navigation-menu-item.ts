import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  NAV_FOLDER_WORK_ID,
  NAV_MY_DASHBOARD_ID,
  PL_MY_DASHBOARD_ID,
} from 'src/constants/universal-identifiers';

// First entry in Work: the place a team member starts. Role-specific landing
// is not forced (that would mean changing Twenty's sign-in flow); the
// dashboard is the primary Work entry instead — see DAY_5_DASHBOARDS.md.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_MY_DASHBOARD_ID,
  name: 'My Dashboard',
  icon: 'IconLayoutDashboard',
  color: 'green',
  position: 0,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  folderUniversalIdentifier: NAV_FOLDER_WORK_ID,
  pageLayoutUniversalIdentifier: PL_MY_DASHBOARD_ID,
});
