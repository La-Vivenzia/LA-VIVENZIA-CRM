import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { NAV_FOLDER_MANAGEMENT_ID, NAV_DASHBOARDS_ID } from 'src/constants/universal-identifiers';

// Twenty's dashboard builder, grouped with the other insight surfaces.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_DASHBOARDS_ID,
  name: 'Dashboards',
  icon: 'IconChartDots',
  color: 'green',
  position: 2,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_MANAGEMENT_ID,
  targetObjectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.dashboard.universalIdentifier,
});
