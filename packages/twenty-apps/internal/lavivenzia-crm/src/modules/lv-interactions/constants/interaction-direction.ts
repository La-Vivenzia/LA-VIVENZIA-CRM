import { type SelectOption } from 'src/modules/lv-core/constants/select-options.generated';

// Who initiated an interaction. An INBOUND entry is the lead reaching out —
// the one case where the owner must be told, because a reply that sits
// unanswered is how a warm lead goes cold.
//
// Not part of the generated vocabulary file: the direction is a Day 4 addition
// and lives with the module that owns it. Ids are fixed so re-applying the
// manifest never orphans a stored value.

export const INTERACTION_DIRECTIONS = ['OUTBOUND', 'INBOUND'] as const;

export type InteractionDirection = (typeof INTERACTION_DIRECTIONS)[number];

export const INTERACTION_DIRECTION_OPTIONS: SelectOption[] = [
  {
    id: 'a4e8cbb8-1d6d-40f3-8cfa-84fe6d261684',
    value: 'OUTBOUND',
    label: 'Outbound',
    position: 0,
    color: 'blue',
  },
  {
    id: '3835b85b-34ee-4d5a-834d-bc194c6e9823',
    value: 'INBOUND',
    label: 'Inbound',
    position: 1,
    color: 'green',
  },
];

export const isInboundInteraction = (
  direction: string | null | undefined,
): boolean => direction === 'INBOUND';
