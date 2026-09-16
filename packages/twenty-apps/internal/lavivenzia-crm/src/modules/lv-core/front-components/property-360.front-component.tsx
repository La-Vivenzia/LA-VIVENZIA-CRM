import { defineFrontComponent } from 'twenty-sdk/define';

import { FC_PROPERTY_360_ID } from 'src/constants/universal-identifiers';
import { Property360 } from 'src/modules/lv-core/front-components/ecosystem-360/entry';

// Kept JSX-free on purpose (see lead-intelligence.front-component.tsx): the
// SDK's manifest builder parses this file as plain TypeScript.

export default defineFrontComponent({
  universalIdentifier: FC_PROPERTY_360_ID,
  name: 'lv-property-360',
  description: 'Property 360: type, partner, location, accommodation, amenities, price, availability, policies, media, documents, verification, approval, timeline, audit',
  component: Property360,
});
