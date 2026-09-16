import { defineFrontComponent } from 'twenty-sdk/define';

import { FC_PARTNER_360_ID } from 'src/constants/universal-identifiers';
import { Partner360 } from 'src/modules/lv-core/front-components/ecosystem-360/partner-360';

// Kept JSX-free on purpose (see lead-intelligence.front-component.tsx): the
// SDK's manifest builder parses this file as plain TypeScript.

export default defineFrontComponent({
  universalIdentifier: FC_PARTNER_360_ID,
  name: 'lv-partner-360',
  description: 'Partner 360: identity, readiness, onboarding, experiences, properties, documents, commercial terms, relationship, timeline, audit and governed actions',
  component: Partner360,
});
