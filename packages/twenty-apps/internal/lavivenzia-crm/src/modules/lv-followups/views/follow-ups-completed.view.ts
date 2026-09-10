import { defineView, ViewFilterOperand, ViewSortDirection } from 'twenty-sdk/define';

import { VIEW_FOLLOWUPS_COMPLETED_ID } from 'src/constants/universal-identifiers';
import {
  columnsForView,
  dueAtSort,
  TASK,
  TASK_STATUS,
} from 'src/modules/lv-followups/views/follow-up-view-shared';

// Most recently completed first — this view is read to confirm work happened,
// not to plan it.

export default defineView({
  universalIdentifier: VIEW_FOLLOWUPS_COMPLETED_ID,
  name: 'Follow-ups · Completed',
  objectUniversalIdentifier: TASK.universalIdentifier,
  icon: 'IconCheckbox',
  position: 13,
  fields: columnsForView('4'),
  filters: [
    {
      universalIdentifier: 'd1e2f3a4-b5c6-4d70-8e81-9f2a3b4c5d60',
      fieldMetadataUniversalIdentifier: TASK_STATUS,
      operand: ViewFilterOperand.IS,
      value: ['DONE'],
    },
  ],
  sorts: [
    dueAtSort('d2e3f4a5-c6d7-4e81-9f92-0a3b4c5d6e71', ViewSortDirection.DESC),
  ],
});
