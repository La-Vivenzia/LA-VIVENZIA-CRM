import { defineTimelineActivityType } from 'twenty-sdk/define';

import {
  INTERACTIONS_ON_LEAD_ID,
  INTERACTION_LEAD_ID,
  INTERACTION_OBJECT_ID,
} from 'src/constants/universal-identifiers';

// The lead timeline is Twenty's own `timelineActivity` — this app builds no
// parallel history. Declaring the type is all that is needed: `emit.through`
// tells Twenty to write the entry onto the LEAD when an interaction is created
// on it.
//
// happensAtField is NOT set: the server rejects it when the event arrives
// through a relation, so timeline entries sort by when the interaction was
// logged rather than by occurredAt. A back-dated interaction therefore appears
// at the top of the timeline. Worth revisiting upstream.

export default defineTimelineActivityType({
  universalIdentifier: '3d0f5b7a-9c21-4e88-b0a4-6f1c2d3e4a5b',
  name: 'lvInteractionLogged',
  label: 'Interaction logged',
  icon: 'IconMessageDots',
  emit: {
    on: 'created',
    objectUniversalIdentifier: INTERACTION_OBJECT_ID,
    through: {
      relationFieldUniversalIdentifier: INTERACTION_LEAD_ID,
    },
  },
});

// Kept referenced so a future rename of the reverse relation cannot silently
// orphan the emit path above.
export const INTERACTION_TIMELINE_RELATION = INTERACTIONS_ON_LEAD_ID;
