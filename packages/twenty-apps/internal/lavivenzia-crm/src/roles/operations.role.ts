import { defineRole, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS, SystemPermissionFlag } from 'twenty-sdk/define';

import {
  EXPERIENCE_OBJECT_ID,
  INTERACTION_OBJECT_ID,
  LEAD_OBJECT_ID,
  ONBOARDING_OBJECT_ID,
  PARTNER_OBJECT_ID,
  PROPERTY_OBJECT_ID,
  ROLE_OPERATIONS_ID,
} from 'src/constants/universal-identifiers';
import { AI_PRIVATE_OBJECT_PERMISSIONS } from 'src/roles/ai-private-objects';

// Reads workspace-wide, but may only modify the objects listed below.
// canUpdateAllObjectRecords is false, so anything not granted here is refused
// by the server, not merely hidden by the UI.

export default defineRole({
  universalIdentifier: ROLE_OPERATIONS_ID,
  label: 'Operations',
  description:
    'Runs day-to-day pipeline and onboarding operations. No administrative settings and no deletion.',
  canUpdateAllSettings: false,
  canAccessAllTools: false,
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canBeAssignedToUsers: true,
  canBeAssignedToAgents: false,
  canBeAssignedToApiKeys: true,
  // Day 8: capturing a lead from a visiting card or screenshot uploads the
  // photo into the lead's FILES field, and reviewing it later downloads it.
  permissionFlagUniversalIdentifiers: [SystemPermissionFlag.UPLOAD_FILE, SystemPermissionFlag.DOWNLOAD_FILE],
  objectPermissions: [
    ...AI_PRIVATE_OBJECT_PERMISSIONS,
    {
      // Day 9 — ecosystem entity this role operates.
      objectUniversalIdentifier: PARTNER_OBJECT_ID,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      // Day 9 — ecosystem entity this role operates.
      objectUniversalIdentifier: EXPERIENCE_OBJECT_ID,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      // Day 9 — ecosystem entity this role operates.
      objectUniversalIdentifier: PROPERTY_OBJECT_ID,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: LEAD_OBJECT_ID,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: INTERACTION_OBJECT_ID,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: ONBOARDING_OBJECT_ID,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.note.universalIdentifier,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
  ],
});
