import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { TASK_LV_PRIORITY_ID } from 'src/constants/universal-identifiers';
import { LEAD_PRIORITY_OPTIONS } from 'src/modules/lv-core/constants/select-options.generated';

// Follow-up priority from PRODUCT-REQUIREMENTS.md "Smart follow-up":
// Critical / High / Medium / Low.
//
// Added to Twenty's standard `task` rather than to a new object, because task
// already provides title, body, dueAt, status and assignee, and `taskTarget`
// attaches it to lvLead through its `custom` relation. Priority is the one
// concept Twenty's task does not carry.

export default defineField({
  universalIdentifier: TASK_LV_PRIORITY_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.SELECT,
  name: 'lvPriority',
  label: 'Priority',
  description:
    'Drives the due-date window and the ordering of the Today and Overdue views',
  icon: 'IconFlag',
  isNullable: true,
  options: LEAD_PRIORITY_OPTIONS,
});
