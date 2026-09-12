import { defineFrontComponent } from 'twenty-sdk/define';

import { FC_LEAD_INTELLIGENCE_ID } from 'src/constants/universal-identifiers';
import { LeadIntelligence } from 'src/modules/lv-intelligence/front-components/lead-intelligence';

// Kept JSX-free on purpose: the SDK's manifest builder parses this file as
// plain TypeScript to find the default definition export, and the
// component's JSX confused that parse. The component itself lives next door
// in lead-intelligence.tsx.

export default defineFrontComponent({
  universalIdentifier: FC_LEAD_INTELLIGENCE_ID,
  name: 'lv-lead-intelligence',
  description: 'Lead intelligence: opportunity score, relationship health, next best action, AI summary, classification, data quality, duplicates, conversation summaries, drafts, onboarding assistance',
  component: LeadIntelligence,
});
