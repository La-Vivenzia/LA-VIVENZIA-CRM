import { defineView, ViewFilterOperand } from 'twenty-sdk/define';

import { VIEW_FOLLOWUPS_UPCOMING_ID } from 'src/constants/universal-identifiers';
import {
  columnsForView,
  dueAtFilter,
  dueAtSort,
  isOpenFilter,
  TASK,
} from 'src/modules/lv-followups/views/follow-up-view-shared';

export default defineView({
  universalIdentifier: VIEW_FOLLOWUPS_UPCOMING_ID,
  name: 'Follow-ups · Upcoming',
  objectUniversalIdentifier: TASK.universalIdentifier,
  icon: 'IconCalendarClock',
  position: 12,
  fields: columnsForView('3'),
  filters: [
    dueAtFilter('c1d2e3f4-a5b6-4c70-8d81-9e2f3a4b5c60', ViewFilterOperand.IS_IN_FUTURE),
    isOpenFilter('c2d3e4f5-b6c7-4d81-9e92-0f3a4b5c6d71'),
  ],
  sorts: [dueAtSort('c3d4e5f6-c7d8-4e92-8fa3-1a4b5c6d7e82')],
});
