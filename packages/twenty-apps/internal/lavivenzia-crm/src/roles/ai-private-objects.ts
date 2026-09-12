import { AI_INSIGHT_OBJECT_ID, AI_RUN_OBJECT_ID, PROBLEM_OBJECT_ID } from 'src/constants/universal-identifiers';

// Day 6 — the AI bookkeeping objects are NOT readable by team roles directly.
// CM-004 row scoping does not cover them, so a direct read would let a
// Hunter list another Hunter's lead summaries. Every read goes through a
// route that first loads the parent lead under the caller's token; the
// application role does the actual read/write. The Main Admin role keeps
// full access (it is not in this list) for oversight and audit.
export const AI_PRIVATE_OBJECT_PERMISSIONS = [AI_INSIGHT_OBJECT_ID, AI_RUN_OBJECT_ID, PROBLEM_OBJECT_ID].map((objectUniversalIdentifier) => ({
  objectUniversalIdentifier,
  canReadObjectRecords: false,
  canUpdateObjectRecords: false,
  canSoftDeleteObjectRecords: false,
  canDestroyObjectRecords: false,
}));
