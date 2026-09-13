import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  FC_DOCUMENT_REVIEW_ID,
  FC_ONBOARDING_WIZARD_ID,
  ONBOARDING_OBJECT_ID,
  PL_ONBOARDING_RECORD_DOCUMENTS_TAB_ID,
  PL_ONBOARDING_RECORD_DOCUMENTS_WIDGET_ID,
  PL_ONBOARDING_RECORD_FIELDS_TAB_ID,
  PL_ONBOARDING_RECORD_FIELDS_WIDGET_ID,
  PL_ONBOARDING_RECORD_ID,
  PL_ONBOARDING_RECORD_WIZARD_TAB_ID,
  PL_ONBOARDING_RECORD_WIZARD_WIDGET_ID,
} from 'src/constants/universal-identifiers';

// The onboarding record page. Day 3 built the ten-step wizard and the
// document review console but never mounted them anywhere a person could
// reach; Lead 360's "Continue onboarding" and "Review documents" land here.
// Both widgets read the onboarding id from the record page, so the same
// components serve the reviewer and the coordinator with their own
// permissions (the routes they call are delegated).

export default definePageLayout({
  universalIdentifier: PL_ONBOARDING_RECORD_ID,
  name: 'Onboarding',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: ONBOARDING_OBJECT_ID,
  defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier: PL_ONBOARDING_RECORD_WIZARD_TAB_ID,
  tabs: [
    {
      universalIdentifier: PL_ONBOARDING_RECORD_WIZARD_TAB_ID,
      title: 'Onboarding',
      position: 0,
      icon: 'IconListCheck',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: PL_ONBOARDING_RECORD_WIZARD_WIDGET_ID,
          title: 'Onboarding steps',
          type: 'FRONT_COMPONENT',
          configuration: { configurationType: 'FRONT_COMPONENT', frontComponentUniversalIdentifier: FC_ONBOARDING_WIZARD_ID },
        },
      ],
    },
    {
      universalIdentifier: PL_ONBOARDING_RECORD_DOCUMENTS_TAB_ID,
      title: 'Documents',
      position: 1,
      icon: 'IconFileCheck',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: PL_ONBOARDING_RECORD_DOCUMENTS_WIDGET_ID,
          title: 'Document review',
          type: 'FRONT_COMPONENT',
          configuration: { configurationType: 'FRONT_COMPONENT', frontComponentUniversalIdentifier: FC_DOCUMENT_REVIEW_ID },
        },
      ],
    },
    {
      universalIdentifier: PL_ONBOARDING_RECORD_FIELDS_TAB_ID,
      title: 'Details',
      position: 2,
      icon: 'IconListDetails',
      widgets: [
        {
          universalIdentifier: PL_ONBOARDING_RECORD_FIELDS_WIDGET_ID,
          title: 'Onboarding',
          type: 'FIELDS',
          configuration: { configurationType: 'FIELDS' },
        },
      ],
    },
  ],
});
