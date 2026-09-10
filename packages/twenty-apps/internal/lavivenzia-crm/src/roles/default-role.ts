import { defineApplicationRole } from 'twenty-sdk/define';

import { DEFAULT_ROLE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// The role this application's logic functions execute as.
//
// It can read and write records because the assignment engine has to set an
// owner and write history and notification rows. It deliberately cannot
// permanently destroy anything: SECURITY-RBAC.md reserves destructive actions
// for a Main Admin, and an automated routine should never be the thing that
// erases a lead or rewrites its audit trail.
//
// This is NOT the role a human gets. The nine La Vivenzia team roles from
// SECURITY-RBAC.md are configured in the workspace against these objects.

export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'La Vivenzia CRM automation',
  description:
    'Runs lead capture, assignment and notification logic functions. Cannot permanently delete records.',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
});
