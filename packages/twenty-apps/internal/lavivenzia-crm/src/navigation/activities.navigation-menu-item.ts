import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  INTERACTION_OBJECT_ID,
  NAV_ACTIVITIES_ID,
  NAV_FOLDER_WORK_ID,
} from 'src/constants/universal-identifiers';

// lvInteraction, presented as Activities — DATA-MODEL.md's own name for it.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_ACTIVITIES_ID,
  name: 'Interactions',
  icon: 'IconMessageCircle',
  color: 'green',
  position: 4,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_WORK_ID,
  targetObjectUniversalIdentifier: INTERACTION_OBJECT_ID,
});
