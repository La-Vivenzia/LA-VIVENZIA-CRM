import { describe, expect, it } from 'vitest';

import {
  LEAD_ADDITIONAL_STATUSES,
  LEAD_MAIN_FLOW_STATUSES,
  LEAD_PRIORITIES,
} from 'src/modules/lv-core/constants/lead-lifecycle';
import {
  FIELD_PROVENANCE_OPTIONS,
  INTERACTION_CHANNEL_OPTIONS,
  INTERACTION_OUTCOME_OPTIONS,
  INTERACTION_PURPOSE_OPTIONS,
  INTERACTION_SENTIMENT_OPTIONS,
  LEAD_CAPTURE_MODE_OPTIONS,
  LEAD_CATEGORY_OPTIONS,
  LEAD_PRIORITY_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  LEAD_STATUS_OPTIONS,
  LEAD_SUBCATEGORY_OPTIONS,
  type SelectOption,
} from 'src/modules/lv-core/constants/select-options.generated';
import {
  LEAD_CAPTURE_MODES,
  LEAD_CATEGORIES,
  LEAD_SOURCES,
} from 'src/modules/lv-core/constants/lead-taxonomy';
import {
  INTERACTION_CHANNELS,
  INTERACTION_OUTCOMES,
  INTERACTION_PURPOSES,
  INTERACTION_SENTIMENTS,
} from 'src/modules/lv-interactions/constants/interaction-vocabulary';

// select-options.generated.ts is produced by scripts/generate-select-options.mjs
// from the vocabulary modules. These tests fail if someone edits the vocabulary
// and forgets to regenerate, which would otherwise only surface at install time
// as a missing SELECT option.

const ALL_OPTION_SETS: Array<[string, SelectOption[]]> = [
  ['status', LEAD_STATUS_OPTIONS],
  ['priority', LEAD_PRIORITY_OPTIONS],
  ['category', LEAD_CATEGORY_OPTIONS],
  ['subcategory', LEAD_SUBCATEGORY_OPTIONS],
  ['source', LEAD_SOURCE_OPTIONS],
  ['captureMode', LEAD_CAPTURE_MODE_OPTIONS],
  ['provenance', FIELD_PROVENANCE_OPTIONS],
  ['interactionChannel', INTERACTION_CHANNEL_OPTIONS],
  ['interactionSentiment', INTERACTION_SENTIMENT_OPTIONS],
  ['interactionPurpose', INTERACTION_PURPOSE_OPTIONS],
  ['interactionOutcome', INTERACTION_OUTCOME_OPTIONS],
];

const valuesOf = (options: SelectOption[]) => options.map((option) => option.value);

describe('generated select options', () => {
  it.each(ALL_OPTION_SETS)('%s: option ids are unique', (_name, options) => {
    expect(new Set(options.map((option) => option.id)).size).toBe(options.length);
  });

  it('every option id is unique across every set, since they share one namespace', () => {
    const allIds = ALL_OPTION_SETS.flatMap(([, options]) =>
      options.map((option) => option.id),
    );

    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it.each(ALL_OPTION_SETS)('%s: positions are contiguous from zero', (_name, options) => {
    expect(options.map((option) => option.position)).toEqual(
      options.map((_option, index) => index),
    );
  });

  it.each(ALL_OPTION_SETS)('%s: every option has a label', (_name, options) => {
    expect(options.every((option) => option.label.length > 0)).toBe(true);
  });

  describe('stay in step with the vocabulary', () => {
    it('lead statuses cover the main flow then the additional states, in order', () => {
      expect(valuesOf(LEAD_STATUS_OPTIONS)).toEqual([
        ...LEAD_MAIN_FLOW_STATUSES,
        ...LEAD_ADDITIONAL_STATUSES,
      ]);
    });

    it('priorities match', () => {
      expect(valuesOf(LEAD_PRIORITY_OPTIONS)).toEqual([...LEAD_PRIORITIES]);
    });

    it('categories match', () => {
      expect(valuesOf(LEAD_CATEGORY_OPTIONS)).toEqual([...LEAD_CATEGORIES]);
    });

    it('sources match', () => {
      expect(valuesOf(LEAD_SOURCE_OPTIONS)).toEqual([...LEAD_SOURCES]);
    });

    it('capture modes match', () => {
      expect(valuesOf(LEAD_CAPTURE_MODE_OPTIONS)).toEqual([...LEAD_CAPTURE_MODES]);
    });

    it('interaction channels cover all eleven required channels', () => {
      expect(valuesOf(INTERACTION_CHANNEL_OPTIONS)).toEqual([...INTERACTION_CHANNELS]);
    });

    it('interaction sentiments match', () => {
      expect(valuesOf(INTERACTION_SENTIMENT_OPTIONS)).toEqual([
        ...INTERACTION_SENTIMENTS,
      ]);
    });

    it('interaction purposes match', () => {
      expect(valuesOf(INTERACTION_PURPOSE_OPTIONS)).toEqual([...INTERACTION_PURPOSES]);
    });

    it('interaction outcomes match', () => {
      expect(valuesOf(INTERACTION_OUTCOME_OPTIONS)).toEqual([...INTERACTION_OUTCOMES]);
    });
  });

  it('covers every channel the brief names', () => {
    for (const channel of [
      'PHONE',
      'EMAIL',
      'WHATSAPP',
      'INSTAGRAM',
      'LINKEDIN',
      'VIDEO_CALL',
      'MEETING',
      'EVENT',
      'INTERNAL_NOTE',
      'DOCUMENT',
      'FORM',
    ]) {
      expect(valuesOf(INTERACTION_CHANNEL_OPTIONS)).toContain(channel);
    }
  });
});
