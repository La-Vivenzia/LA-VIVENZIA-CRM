import {
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
  ViewFilterOperand,
  ViewSortDirection,
} from 'twenty-sdk/define';

import { TASK_LV_PRIORITY_ID } from 'src/constants/universal-identifiers';

// Shared pieces of the four follow-up views. Deliberately contains no
// defineView() call — the manifest builder collects one view per file from the
// default export, so a combined file would register only the last one.

export const TASK = STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task;
export const TASK_DUE_AT = TASK.fields.dueAt.universalIdentifier;
export const TASK_STATUS = TASK.fields.status.universalIdentifier;

const BASE_COLUMNS = [
  {
    id: '5a1c9d2e-3b47-4f80-9c15-2e6a7b8c9d01',
    field: TASK.fields.title.universalIdentifier,
    size: 280,
  },
  { id: '6b2d0e3f-4c58-4a91-8d26-3f7b8c9d0e12', field: TASK_DUE_AT, size: 160 },
  { id: '7c3e1f40-5d69-4ba2-9e37-4a8c9d0e1f23', field: TASK_LV_PRIORITY_ID, size: 120 },
  {
    id: '8d4f2051-6e7a-4cb3-8f48-5b9d0e1f2a34',
    field: TASK.fields.assignee.universalIdentifier,
    size: 160,
  },
  { id: '9e503162-7f8b-4dc4-9a59-6c0e1f2a3b45', field: TASK_STATUS, size: 120 },
];

// Each view needs its OWN view-field ids. Swapping the leading hex digit for a
// per-view prefix keeps them deterministic and collision-free — an arithmetic
// offset does not, because e.g. 10 and 20 share a last digit.
export const columnsForView = (viewPrefix: string) =>
  BASE_COLUMNS.map((column, index) => ({
    universalIdentifier: viewPrefix + column.id.slice(1),
    fieldMetadataUniversalIdentifier: column.field,
    position: index,
    isVisible: true,
    size: column.size,
  }));

// Not done yet. Every open view shares this so completed work can never leak in.
export const isOpenFilter = (universalIdentifier: string) => ({
  universalIdentifier,
  fieldMetadataUniversalIdentifier: TASK_STATUS,
  operand: ViewFilterOperand.IS_NOT,
  value: ['DONE'],
});

export const dueAtSort = (
  universalIdentifier: string,
  direction: ViewSortDirection = ViewSortDirection.ASC,
) => ({
  universalIdentifier,
  fieldMetadataUniversalIdentifier: TASK_DUE_AT,
  direction,
});

export const dueAtFilter = (
  universalIdentifier: string,
  operand: ViewFilterOperand,
) => ({
  universalIdentifier,
  fieldMetadataUniversalIdentifier: TASK_DUE_AT,
  operand,
  value: '',
});
