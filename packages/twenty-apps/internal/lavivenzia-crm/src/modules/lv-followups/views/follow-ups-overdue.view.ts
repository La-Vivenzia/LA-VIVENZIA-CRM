import { defineView, ViewFilterOperand } from 'twenty-sdk/define';

import { VIEW_FOLLOWUPS_OVERDUE_ID } from 'src/constants/universal-identifiers';
import {
  columnsForView,
  dueAtFilter,
  dueAtSort,
  isOpenFilter,
  TASK,
} from 'src/modules/lv-followups/views/follow-up-view-shared';

// Missed commitments. This is the view the Admin Control Tower reads for
// follow-up compliance, so it must never include completed work.

export default defineView({
  universalIdentifier: VIEW_FOLLOWUPS_OVERDUE_ID,
  name: 'Follow-ups · Overdue',
  objectUniversalIdentifier: TASK.universalIdentifier,
  icon: 'IconAlertTriangle',
  position: 11,
  fields: columnsForView('2'),
  filters: [
    dueAtFilter('b1c2d3e4-f5a6-4b70-8c81-9d2e3f4a5b60', ViewFilterOperand.IS_IN_PAST),
    isOpenFilter('b2c3d4e5-a6b7-4c81-9d92-0e3f4a5b6c71'),
  ],
  sorts: [dueAtSort('b3c4d5e6-b7c8-4d92-8ea3-1f4a5b6c7d82')],
});
