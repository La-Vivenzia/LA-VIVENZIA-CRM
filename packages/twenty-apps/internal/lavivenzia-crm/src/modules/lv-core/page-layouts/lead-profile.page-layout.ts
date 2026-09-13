import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  FC_LEAD_360_ID,
  FC_LEAD_GOVERNANCE_ID,
  INTERACTIONS_ON_LEAD_ID,
  INTERACTION_OBJECT_ID,
  LEAD_OBJECT_ID,
  FC_LEAD_INTELLIGENCE_ID,
  LEAD_PROFILE_360_TAB_ID,
  LEAD_PROFILE_360_WIDGET_ID,
  LEAD_PROFILE_GOVERNANCE_TAB_ID,
  LEAD_PROFILE_INTELLIGENCE_TAB_ID,
  LEAD_PROFILE_INTELLIGENCE_WIDGET_ID,
  LEAD_PROFILE_GOVERNANCE_WIDGET_ID,
} from 'src/constants/universal-identifiers';

// The Lead Profile — the central relationship workspace.
//
// Laid out so a coordinator opening a lead cold can answer the eight questions
// from the brief without clicking away. Each widget below is the answer to one
// of them, in the order someone actually asks them:
//
//   Who is this? / What do they offer?      -> Overview: identity + category fields
//   Who owns them?                          -> Overview: owner, assigned at
//   What is the current status?             -> Overview: status, priority
//   What is the next action?                -> Next action + Follow-ups
//   When is the next follow-up?             -> Follow-ups (Twenty tasks)
//   What happened?                          -> Timeline + Interactions
//   Why might this lead be valuable?        -> Signals: completeness, source, score
//
// Every widget is a Twenty widget type. The relationship history is Twenty's
// own TIMELINE and TASKS widgets — this app contributes the data, not a
// replacement surface.

export default definePageLayout({
  universalIdentifier: 'b338200f-6366-5aa7-a58a-697bec2e5168',
  name: 'Lead profile',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: LEAD_OBJECT_ID,
  defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier: LEAD_PROFILE_360_TAB_ID,
  tabs: [
    {
      // Day 7 — Lead 360: the employee workspace. Header, permission-aware
      // actions, next action, overview + data quality, rules intelligence,
      // merged relationship timeline, tasks, SLAs, onboarding, documents,
      // notes, ownership and lifecycle — all from one server composition.
      universalIdentifier: LEAD_PROFILE_360_TAB_ID,
      title: 'Lead 360',
      // Position 1, not 0: Twenty renders a record page's first tab as the
      // narrow left column (the fields panel). The 360 needs the main area.
      position: 1,
      icon: 'IconUserSearch',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: LEAD_PROFILE_360_WIDGET_ID,
          title: 'Lead 360',
          type: 'FRONT_COMPONENT',
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: FC_LEAD_360_ID,
          },
        },
      ],
    },
    {
      // Twenty's native field editor for every lead field, kept as its own
      // tab so nothing the platform offers is lost behind the LV surface.
      universalIdentifier: '6b4b0dee-076b-56e5-bba9-0cbf160cac70',
      title: 'Details',
      position: 0,
      icon: 'IconListDetails',
      widgets: [
        {
          // Who is this, what do they offer, who owns them, what is the status.
          universalIdentifier: '1a2b3c4d-5e6f-4a70-8b81-9c0d1e2f3a41',
          title: 'Lead',
          type: 'FIELDS',
          configuration: { configurationType: 'FIELDS' },
        },
        {
          // What is the next action, and when. These are Twenty tasks created
          // by the follow-up engine, not a bespoke list.
          universalIdentifier: '2b3c4d5e-6f7a-4b81-9c92-0d1e2f3a4b52',
          title: 'Follow-ups',
          type: 'TASKS',
          configuration: { configurationType: 'TASKS' },
        },
      ],
    },
    {
      universalIdentifier: 'e3f0d02e-7bc2-54b1-b4a9-23bee6f2177d',
      title: 'Relationship',
      position: 2,
      icon: 'IconMessageDots',
      widgets: [
        {
          // What happened, in the lead's own words: every recorded contact with
          // channel, sentiment, outcome, objections and commitments.
          universalIdentifier: '3c4d5e6f-7a8b-4c92-8da3-1e2f3a4b5c63',
          title: 'Interactions',
          // FIELD over the `interactions` relation, not a standalone VIEW
          // widget: a view would list every interaction in the workspace,
          // whereas this scopes to the lead being looked at.
          type: 'FIELD',
          objectUniversalIdentifier: INTERACTION_OBJECT_ID,
          configuration: {
            configurationType: 'FIELD',
            fieldMetadataId: INTERACTIONS_ON_LEAD_ID,
            fieldDisplayMode: 'TABLE',
          },
        },
        {
          // Twenty's automatic history: field changes, links, lifecycle events,
          // and the typed lvInteractionLogged entries this app emits.
          universalIdentifier: '4d5e6f7a-8b9c-4da3-8eb4-2f3a4b5c6d74',
          title: 'Timeline',
          type: 'TIMELINE',
          configuration: { configurationType: 'TIMELINE' },
        },
      ],
    },
    {
      universalIdentifier: '5e6f7a8b-9c0d-4eb4-8fc5-3a4b5c6d7e85',
      title: 'Notes & files',
      position: 3,
      icon: 'IconPaperclip',
      widgets: [
        {
          // Free-form team writing stays Twenty's `note`. INTERNAL_NOTE exists
          // as an interaction channel for logged conversations; this is for
          // everything else.
          universalIdentifier: '6f7a8b9c-0d1e-4fc5-8ad6-4b5c6d7e8f96',
          title: 'Notes',
          type: 'NOTES',
          configuration: { configurationType: 'NOTES' },
        },
        {
          universalIdentifier: '7a8b9c0d-1e2f-4ad6-8be7-5c6d7e8f9a07',
          title: 'Files',
          type: 'FILES',
          configuration: { configurationType: 'FILES' },
        },
      ],
    },
    {
      // Day 6 — intelligence: score, health, next best action, AI summary,
      // classification, data quality, duplicates, conversation summaries,
      // drafts and onboarding assistance. Loads on its own; the core tabs
      // never wait for it.
      universalIdentifier: LEAD_PROFILE_INTELLIGENCE_TAB_ID,
      title: 'Intelligence',
      position: 4,
      icon: 'IconSparkles',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: LEAD_PROFILE_INTELLIGENCE_WIDGET_ID,
          title: 'Intelligence',
          type: 'FRONT_COMPONENT',
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: FC_LEAD_INTELLIGENCE_ID,
          },
        },
      ],
    },
    {
      // Day 5 — lifecycle & governance. Archive / close / mark duplicate /
      // reopen for the team; audited permanent delete for the Main Admin.
      universalIdentifier: LEAD_PROFILE_GOVERNANCE_TAB_ID,
      title: 'Actions',
      position: 5,
      icon: 'IconShieldLock',
      // A vertical list gives the single widget the whole tab; the default
      // grid would confine it to a small cell.
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: LEAD_PROFILE_GOVERNANCE_WIDGET_ID,
          title: 'Lifecycle & governance',
          type: 'FRONT_COMPONENT',
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: FC_LEAD_GOVERNANCE_ID,
          },
        },
      ],
    },
  ],
});
