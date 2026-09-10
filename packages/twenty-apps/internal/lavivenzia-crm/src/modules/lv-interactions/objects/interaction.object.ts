import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  INTERACTIONS_ON_LEAD_ID,
  INTERACTIONS_ON_MEMBER_ID,
  INTERACTION_ACTOR_ID,
  INTERACTION_CHANNEL_ID,
  INTERACTION_COMMITMENTS_ID,
  INTERACTION_DURATION_ID,
  INTERACTION_LEAD_ID,
  INTERACTION_NAME_ID,
  INTERACTION_NEXT_ACTION_ID,
  INTERACTION_NEXT_FOLLOW_UP_ID,
  INTERACTION_OBJECTIONS_ID,
  INTERACTION_OBJECT_ID,
  INTERACTION_OCCURRED_AT_ID,
  INTERACTION_OUTCOME_ID,
  INTERACTION_PURPOSE_ID,
  INTERACTION_SENTIMENT_ID,
  INTERACTION_SUMMARY_ID,
  LEAD_OBJECT_ID,
} from 'src/constants/universal-identifiers';
import {
  INTERACTION_CHANNEL_OPTIONS,
  INTERACTION_OUTCOME_OPTIONS,
  INTERACTION_PURPOSE_OPTIONS,
  INTERACTION_SENTIMENT_OPTIONS,
} from 'src/modules/lv-core/constants/select-options.generated';

// The interaction log from PRODUCT-REQUIREMENTS.md "Interactions" — one row per
// contact, across all eleven channels.
//
// This is NOT a duplicate of Twenty's activity system, and the boundary is
// deliberate:
//   - `timelineActivity` stays the automatic what-changed history, and renders
//     these rows on the lead for free through its `targetCustom` relation.
//   - `note` stays free-form team writing.
//   - `task` IS the follow-up — no follow-up object exists here.
// What none of them carry is channel, duration, sentiment, outcome, objections
// and commitments, which is exactly what the founder's interaction log is made
// of, so those live here.

export default defineObject({
  universalIdentifier: INTERACTION_OBJECT_ID,
  nameSingular: 'lvInteraction',
  namePlural: 'lvInteractions',
  labelSingular: 'Interaction',
  labelPlural: 'Interactions',
  description:
    'A single recorded contact with a lead: channel, what happened, and what comes next',
  icon: 'IconMessageDots',
  isSearchable: true,
  labelIdentifierFieldMetadataUniversalIdentifier: INTERACTION_NAME_ID,
  fields: [
    {
      // Auto-composed by the logic function as "<Channel> · <date>" so a
      // timeline row is readable without opening it.
      universalIdentifier: INTERACTION_NAME_ID,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Summary line',
      icon: 'IconTag',
      defaultValue: "''",
    },
    {
      universalIdentifier: INTERACTION_LEAD_ID,
      type: FieldType.RELATION,
      name: 'lead',
      label: 'Lead',
      icon: 'IconUserSearch',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: LEAD_OBJECT_ID,
      relationTargetFieldMetadataUniversalIdentifier: INTERACTIONS_ON_LEAD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'leadId',
      },
    },
    {
      universalIdentifier: INTERACTION_CHANNEL_ID,
      type: FieldType.SELECT,
      name: 'channel',
      label: 'Channel',
      icon: 'IconDeviceMobileMessage',
      isNullable: false,
      defaultValue: "'PHONE'",
      options: INTERACTION_CHANNEL_OPTIONS,
    },
    {
      universalIdentifier: INTERACTION_OCCURRED_AT_ID,
      type: FieldType.DATE_TIME,
      name: 'occurredAt',
      label: 'Date and time',
      icon: 'IconCalendarTime',
      isNullable: true,
    },
    {
      universalIdentifier: INTERACTION_ACTOR_ID,
      type: FieldType.RELATION,
      name: 'actor',
      label: 'Team member',
      icon: 'IconUserCircle',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier: INTERACTIONS_ON_MEMBER_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'actorId',
      },
    },
    {
      // Only meaningful for phone, video, meeting and event — see
      // channelSupportsDuration. Left empty elsewhere rather than zero, so
      // "no duration" and "zero minutes" stay distinguishable.
      universalIdentifier: INTERACTION_DURATION_ID,
      type: FieldType.NUMBER,
      name: 'durationMinutes',
      label: 'Duration (minutes)',
      icon: 'IconClock',
      isNullable: true,
    },
    {
      universalIdentifier: INTERACTION_PURPOSE_ID,
      type: FieldType.SELECT,
      name: 'purpose',
      label: 'Purpose',
      icon: 'IconTargetArrow',
      isNullable: true,
      options: INTERACTION_PURPOSE_OPTIONS,
    },
    {
      universalIdentifier: INTERACTION_SUMMARY_ID,
      type: FieldType.RICH_TEXT,
      name: 'summary',
      label: 'Summary',
      description: 'What was actually said or agreed',
      icon: 'IconFileText',
      isNullable: true,
    },
    {
      universalIdentifier: INTERACTION_SENTIMENT_ID,
      type: FieldType.SELECT,
      name: 'sentiment',
      label: 'Sentiment',
      description:
        'Recorded by the team member. AI-assisted sentiment arrives in Phase 2.',
      icon: 'IconMoodSmile',
      isNullable: true,
      options: INTERACTION_SENTIMENT_OPTIONS,
    },
    {
      universalIdentifier: INTERACTION_OUTCOME_ID,
      type: FieldType.SELECT,
      name: 'outcome',
      label: 'Outcome',
      description: 'Drives whether and how urgently a follow-up is created',
      icon: 'IconFlagCheck',
      isNullable: true,
      options: INTERACTION_OUTCOME_OPTIONS,
    },
    {
      universalIdentifier: INTERACTION_OBJECTIONS_ID,
      type: FieldType.TEXT,
      name: 'objections',
      label: 'Objections / problems',
      description: 'Raised by the lead. Feeds the Lead Problem Database.',
      icon: 'IconAlertTriangle',
      isNullable: true,
    },
    {
      universalIdentifier: INTERACTION_COMMITMENTS_ID,
      type: FieldType.TEXT,
      name: 'commitments',
      label: 'Commitments',
      description: 'What either side promised to do',
      icon: 'IconHandshake',
      isNullable: true,
    },
    {
      universalIdentifier: INTERACTION_NEXT_ACTION_ID,
      type: FieldType.TEXT,
      name: 'nextAction',
      label: 'Next action',
      description: 'Becomes the follow-up task title when set',
      icon: 'IconArrowRight',
      isNullable: true,
    },
    {
      universalIdentifier: INTERACTION_NEXT_FOLLOW_UP_ID,
      type: FieldType.DATE_TIME,
      name: 'nextFollowUpAt',
      label: 'Next follow-up',
      description:
        'Overrides the due date the follow-up engine would derive from priority',
      icon: 'IconCalendarClock',
      isNullable: true,
    },
  ],
});
