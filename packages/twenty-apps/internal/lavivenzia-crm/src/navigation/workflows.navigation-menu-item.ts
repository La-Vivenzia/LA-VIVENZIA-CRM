import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { NAV_FOLDER_AUTOMATION_ID, NAV_WORKFLOWS_ID } from 'src/constants/universal-identifiers';

// Sidebar entry.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_WORKFLOWS_ID,
  name: 'Workflows',
  icon: 'IconSettingsAutomation',
  position: 0,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_AUTOMATION_ID,
  targetObjectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workflow.universalIdentifier,
});
