import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  SLA_ESCALATION_TASK_ID,
  SLA_OBJECT_ID,
  SLA_ON_TASK_ID
} from 'src/constants/universal-identifiers';

// Reverse side of lvSla.escalationTask.

export default defineField({
  universalIdentifier: SLA_ON_TASK_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.RELATION,
  name: 'lvEscalatedSlas',
  label: 'Escalated SLAs',
  icon: 'IconClockExclamation',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: SLA_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: SLA_ESCALATION_TASK_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
