import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { NAV_LV_HOME_ID, PL_LV_HOME_ID } from 'src/constants/universal-identifiers';

// The workspace itself, first in the menu. During the UI rebuild it sits
// alongside the existing folders so nothing a team member uses disappears
// while the six doors are being built out; once every door has its screen,
// this becomes the only entry (docs/UI-EXACT-MATCH-PLAN.md §8).

export default defineNavigationMenuItem({
  universalIdentifier: NAV_LV_HOME_ID,
  name: 'La Vivenzia',
  icon: 'IconHome',
  color: 'green',
  position: 0,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: PL_LV_HOME_ID,
});
