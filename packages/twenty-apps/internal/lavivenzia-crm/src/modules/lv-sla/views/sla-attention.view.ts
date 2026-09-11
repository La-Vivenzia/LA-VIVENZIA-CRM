import { defineView, ViewFilterOperand, ViewSortDirection } from 'twenty-sdk/define';

import {
  SLA_DUE_AT_ID,
  SLA_LEAD_ID,
  SLA_NAME_ID,
  SLA_OBJECT_ID,
  SLA_OWNER_ID,
  SLA_PRIORITY_ID,
  SLA_RULE_ID,
  SLA_STATUS_ID,
  VIEW_SLA_ATTENTION_ID,
} from 'src/constants/universal-identifiers';

// The SLAs that need a human: due soon, due, breached, escalated — soonest
// deadline first. An ordinary Twenty view over lvSla (CM-004 decides whose
// rows appear), and the list the Control Tower will read on Day 5.

const COLUMNS = [
  { id: 'c6435167-58e0-4fe5-bba8-000000000001', field: SLA_NAME_ID, size: 300 },
  { id: 'c6435167-58e0-4fe5-bba8-000000000002', field: SLA_STATUS_ID, size: 120 },
  { id: 'c6435167-58e0-4fe5-bba8-000000000003', field: SLA_RULE_ID, size: 180 },
  { id: 'c6435167-58e0-4fe5-bba8-000000000004', field: SLA_DUE_AT_ID, size: 170 },
  { id: 'c6435167-58e0-4fe5-bba8-000000000005', field: SLA_OWNER_ID, size: 160 },
  { id: 'c6435167-58e0-4fe5-bba8-000000000006', field: SLA_PRIORITY_ID, size: 110 },
  { id: 'c6435167-58e0-4fe5-bba8-000000000007', field: SLA_LEAD_ID, size: 200 },
];

export default defineView({
  universalIdentifier: VIEW_SLA_ATTENTION_ID,
  name: 'SLAs · Attention needed',
  objectUniversalIdentifier: SLA_OBJECT_ID,
  icon: 'IconClockExclamation',
  position: 0,
  fields: COLUMNS.map((column, index) => ({
    universalIdentifier: column.id,
    fieldMetadataUniversalIdentifier: column.field,
    position: index,
    isVisible: true,
    size: column.size,
  })),
  filters: [
    {
      universalIdentifier: 'c6435167-58e0-4fe5-bba8-000000000010',
      fieldMetadataUniversalIdentifier: SLA_STATUS_ID,
      operand: ViewFilterOperand.IS,
      value: ['DUE_SOON', 'DUE', 'BREACHED', 'ESCALATED'],
    },
  ],
  sorts: [
    {
      universalIdentifier: 'c6435167-58e0-4fe5-bba8-000000000011',
      fieldMetadataUniversalIdentifier: SLA_DUE_AT_ID,
      direction: ViewSortDirection.ASC,
    },
  ],
});
