import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  ASSIGNMENT_RULES_ON_MEMBER_FIELD_ID,
  ASSIGNMENT_RULE_ACTIVE_FIELD_ID,
  ASSIGNMENT_RULE_ASSIGNEE_FIELD_ID,
  ASSIGNMENT_RULE_CATEGORY_FIELD_ID,
  ASSIGNMENT_RULE_LANGUAGE_FIELD_ID,
  ASSIGNMENT_RULE_NAME_FIELD_ID,
  ASSIGNMENT_RULE_OBJECT_ID,
  ASSIGNMENT_RULE_PRIORITY_FIELD_ID,
  ASSIGNMENT_RULE_REGION_FIELD_ID,
} from 'src/constants/universal-identifiers';
import {
  LEAD_CATEGORY_OPTIONS,
  LEAD_SUBCATEGORY_OPTIONS,
} from 'src/modules/lv-core/constants/select-options.generated';

// Admin-configured deterministic routing, evaluated before the scoring engine.
// PRODUCT-REQUIREMENTS.md "Custom workflows" wants an admin to express
// Trigger -> Condition -> Action without a developer; this is the assignment
// half of that, editable as ordinary records.
//
// An empty condition means "any", so a rule with only an assignee is a
// catch-all. Lower `priority` runs first.

export default defineObject({
  universalIdentifier: ASSIGNMENT_RULE_OBJECT_ID,
  nameSingular: 'lvAssignmentRule',
  namePlural: 'lvAssignmentRules',
  labelSingular: 'Assignment rule',
  labelPlural: 'Assignment rules',
  description:
    'Deterministic lead routing configured by an admin, evaluated before scoring',
  icon: 'IconRouteSquare',
  isSearchable: false,
  labelIdentifierFieldMetadataUniversalIdentifier: ASSIGNMENT_RULE_NAME_FIELD_ID,
  fields: [
    {
      universalIdentifier: ASSIGNMENT_RULE_NAME_FIELD_ID,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconTag',
      defaultValue: "''",
    },
    {
      universalIdentifier: ASSIGNMENT_RULE_ACTIVE_FIELD_ID,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Active',
      icon: 'IconToggleLeft',
      defaultValue: true,
    },
    {
      universalIdentifier: ASSIGNMENT_RULE_PRIORITY_FIELD_ID,
      type: FieldType.NUMBER,
      name: 'evaluationOrder',
      label: 'Evaluation order',
      description: 'Lower numbers are evaluated first',
      icon: 'IconSortAscending',
      isNullable: true,
    },
    {
      universalIdentifier: ASSIGNMENT_RULE_CATEGORY_FIELD_ID,
      type: FieldType.SELECT,
      name: 'whenCategory',
      label: 'When category is',
      description: 'Leave empty to match any category',
      icon: 'IconCategory',
      isNullable: true,
      options: LEAD_CATEGORY_OPTIONS,
    },
    {
      universalIdentifier: ASSIGNMENT_RULE_REGION_FIELD_ID,
      type: FieldType.TEXT,
      name: 'whenRegion',
      label: 'When region is',
      description: 'Leave empty to match any location',
      icon: 'IconMapPin',
      isNullable: true,
    },
    {
      universalIdentifier: ASSIGNMENT_RULE_LANGUAGE_FIELD_ID,
      type: FieldType.TEXT,
      name: 'whenLanguage',
      label: 'When language is',
      description: 'Matches if the lead lists this language',
      icon: 'IconLanguage',
      isNullable: true,
    },
    {
      universalIdentifier: '1c2d3e4f-5a6b-4c71-8d82-9e0f1a2b3c48',
      type: FieldType.SELECT,
      name: 'whenSubcategory',
      label: 'When sub-category is',
      description: 'Leave empty to match any sub-category',
      icon: 'IconTags',
      isNullable: true,
      options: LEAD_SUBCATEGORY_OPTIONS,
    },
    {
      universalIdentifier: ASSIGNMENT_RULE_ASSIGNEE_FIELD_ID,
      type: FieldType.RELATION,
      name: 'assignee',
      label: 'Assign to',
      icon: 'IconUserCheck',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        ASSIGNMENT_RULES_ON_MEMBER_FIELD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'assigneeId',
      },
    },
  ],
});
