import { defineFrontComponent } from 'twenty-sdk/define';

import { FC_EXPERIENCE_360_ID } from 'src/constants/universal-identifiers';
import { Experience360 } from 'src/modules/lv-core/front-components/ecosystem-360/entry';

// Kept JSX-free on purpose (see lead-intelligence.front-component.tsx): the
// SDK's manifest builder parses this file as plain TypeScript.

export default defineFrontComponent({
  universalIdentifier: FC_EXPERIENCE_360_ID,
  name: 'lv-experience-360',
  description: 'Experience 360: what, who, where, price, availability, media, policies, verification, approval, readiness, timeline, audit',
  component: Experience360,
});
