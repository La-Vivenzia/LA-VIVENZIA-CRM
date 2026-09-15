import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { NAV_FOLDER_INTELLIGENCE_ID } from 'src/constants/universal-identifiers';

// Sidebar section: what the system has worked out for you — the Copilot
// briefing today; scoring, health and next-best-action live on each lead.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_FOLDER_INTELLIGENCE_ID,
  name: 'Intelligence',
  icon: 'IconBulb',
  color: 'green',
  position: 2,
  type: NavigationMenuItemType.FOLDER,
});
