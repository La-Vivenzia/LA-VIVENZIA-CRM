import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { NAV_FOLDER_AUTOMATION_ID, NAV_WORKFLOW_RUNS_ID } from 'src/constants/universal-identifiers';

// Run history for the automations, next to the workflows themselves.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_WORKFLOW_RUNS_ID,
  name: 'Workflow runs',
  icon: 'IconHistory',
  color: 'green',
  position: 1,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_AUTOMATION_ID,
  targetObjectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workflowRun.universalIdentifier,
});
