import { defineFrontComponent } from 'twenty-sdk/define';

import { FC_QUICK_ADD_LEAD_ID } from 'src/constants/universal-identifiers';
import { CaptureLead } from 'src/modules/lv-capture/front-components/capture-lead/capture-lead';

// Kept JSX-free on purpose (see lead-intelligence.front-component.tsx): the
// SDK's manifest builder parses this file as plain TypeScript. The capture
// experience itself lives in capture-lead/.
//
// Same universal identifier as the Day 1 Quick Add component — this is its
// successor, so the page layout, command-menu item and navigation entry
// keep pointing at the one capture surface.

export default defineFrontComponent({
  universalIdentifier: FC_QUICK_ADD_LEAD_ID,
  name: 'lv-capture-lead',
  description: 'Capture lead: manual, visiting card / image (OCR), URL, social profile, referral, event, walk-in, phone, CSV import — review, duplicate check, assignment, next action',
  component: CaptureLead,
});
