import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { NAV_COPILOT_ID, NAV_FOLDER_WORK_ID, PL_COPILOT_ID } from 'src/constants/universal-identifiers';

// Work → Copilot, right after My Dashboard: the briefing and the question box.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_COPILOT_ID,
  name: 'Copilot',
  icon: 'IconSparkles',
  position: 1,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  folderUniversalIdentifier: NAV_FOLDER_WORK_ID,
  pageLayoutUniversalIdentifier: PL_COPILOT_ID,
});
