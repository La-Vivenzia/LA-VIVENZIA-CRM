import { defineApplication } from 'twenty-sdk/define';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'La Vivenzia CRM',
  description:
    'Lead capture, routing and relationship operations for the La Vivenzia experience ecosystem',
  author: 'La Vivenzia',
  category: 'Sales',
});
