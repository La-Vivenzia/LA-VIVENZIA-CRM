import { defineView, ViewFilterOperand } from 'twenty-sdk/define';

import { VIEW_FOLLOWUPS_TODAY_ID } from 'src/constants/universal-identifiers';
import {
  columnsForView,
  dueAtFilter,
  dueAtSort,
  isOpenFilter,
  TASK,
} from 'src/modules/lv-followups/views/follow-up-view-shared';

// Today's commitments. Twenty already ships the IS_TODAY operand and the task
// list UI, so this whole requirement is one declaration.

export default defineView({
  universalIdentifier: VIEW_FOLLOWUPS_TODAY_ID,
  name: 'Follow-ups · Today',
  objectUniversalIdentifier: TASK.universalIdentifier,
  icon: 'IconSun',
  position: 10,
  fields: columnsForView('1'),
  filters: [
    dueAtFilter('a1b2c3d4-e5f6-4a70-8b81-9c2d3e4f5a60', ViewFilterOperand.IS_TODAY),
    isOpenFilter('a2b3c4d5-f6a7-4b81-9c92-0d3e4f5a6b71'),
  ],
  sorts: [dueAtSort('a3b4c5d6-a7b8-4c92-8da3-1e4f5a6b7c82')],
});
