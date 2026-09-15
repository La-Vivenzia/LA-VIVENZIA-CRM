import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { NAV_FOLDER_CRM_ID, NAV_ORGANISATIONS_ID } from 'src/constants/universal-identifiers';

// Twenty's Company object, presented as Organisations. One entity, not two:
// DATA-MODEL.md's Organisation is the same thing, and a parallel object would
// split the relationships People and Leads already have.

export default defineNavigationMenuItem({
  universalIdentifier: NAV_ORGANISATIONS_ID,
  name: 'Organisations',
  icon: 'IconBuilding',
  color: 'green',
  position: 4,
  type: NavigationMenuItemType.OBJECT,
  folderUniversalIdentifier: NAV_FOLDER_CRM_ID,
  targetObjectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
});
