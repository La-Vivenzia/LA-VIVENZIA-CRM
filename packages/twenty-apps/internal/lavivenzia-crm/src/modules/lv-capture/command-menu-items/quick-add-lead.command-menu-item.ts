import { defineCommandMenuItem } from 'twenty-sdk/define';

import { CMI_QUICK_ADD_LEAD_ID, FC_QUICK_ADD_LEAD_ID } from 'src/constants/universal-identifiers';

// ⌘K → "Capture lead" from any page. The same front component as the
// standalone page, so there is exactly one capture form.

export default defineCommandMenuItem({
  universalIdentifier: CMI_QUICK_ADD_LEAD_ID,
  label: 'Capture lead',
  shortLabel: 'Capture lead',
  isPinned: true,
  availabilityType: 'GLOBAL',
  frontComponentUniversalIdentifier: FC_QUICK_ADD_LEAD_ID,
});
