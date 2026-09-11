import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  LEAD_OBJECT_ID,
  PARTNER_LEAD_FIELD_ID,
  PARTNER_OBJECT_ID,
  PARTNER_ON_LEAD_FIELD_ID,
} from 'src/constants/universal-identifiers';

// A lead can produce more than one partner record — a business and its owner may onboard separately from the same enquiry.

export default defineField({
  universalIdentifier: PARTNER_ON_LEAD_FIELD_ID,
  objectUniversalIdentifier: LEAD_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'lvPartners',
  label: 'Partners',
  icon: 'IconHeartHandshake',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: PARTNER_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PARTNER_LEAD_FIELD_ID,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
