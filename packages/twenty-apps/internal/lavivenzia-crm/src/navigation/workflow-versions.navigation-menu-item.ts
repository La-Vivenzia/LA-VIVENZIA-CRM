import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { NAV_FOLDER_AUTOMATION_ID, NAV_WORKFLOW_VERSIONS_ID } from 'src/constants/universal-identifiers';

// Version history for the automations.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_WORKFLOW_VERSIONS_ID,
  name: 'Workflow versions',
  icon: 'IconVersions',
  color: 'green',
  position: 2,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_AUTOMATION_ID,
  targetObjectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workflowVersion.universalIdentifier,
});
