import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_EXPIRE_DOCUMENTS_ID } from 'src/constants/universal-identifiers';
import { createCoreApiDocumentPort } from 'src/modules/lv-onboarding/services/core-api-document-port';
import { expireIfDue } from 'src/modules/lv-onboarding/utils/transition-document';

// Nightly sweep for documents whose expiry date has passed.
//
// This is the one verification transition the system applies without a human,
// and it is defensible for a narrow reason: a date passing is a fact, not a
// judgement. Every other outcome — verified, rejected, needs replacement —
// still requires a named reviewer.
//
// REMINDER POLICY IS NOT IMPLEMENTED. ONBOARDING.md defines no lead time for
// warning a partner before a document lapses ("30 days before", "on the day",
// or otherwise), and inventing a schedule would be inventing a business rule.
// So this detects expiry and records it; it does not send advance warnings.
// See ONBOARDING.md for the decision that is still outstanding.

export const handler = async (): Promise<Record<string, unknown>> => {
  // System side-effect: runs as the application, not as whoever triggered the
  // event. The default (delegated) token acts as the triggering person, whose
  // role usually cannot write history, notifications or other people's leads —
  // exactly the writes this function exists to make. The human-facing routes
  // stay delegated, so authorization still binds where a person is acting.
  const client = new CoreApiClient({ runAs: 'application' });
  const port = createCoreApiDocumentPort(client);

  const now = new Date().toISOString();
  const candidates = await port.listExpiringDocuments(now);

  let expired = 0;
  const expiredIds: string[] = [];

  for (const document of candidates) {
    const outcome = expireIfDue({
      state: document.verificationState,
      expiresAt: document.expiresAt,
      now,
    });

    // expireIfDue returns null when the document is not actually due. The
    // query already narrowed to VERIFIED-and-past-due, so this mostly guards
    // against an unparseable date rather than re-filtering.
    if (!outcome?.ok) {
      continue;
    }

    await port.applyDocumentState({
      documentId: document.id,
      state: outcome.state,
      // Expiry is not a reviewer decision, so the reviewer is left as it was
      // rather than being overwritten by the system.
      reviewerWorkspaceMemberId: document.reviewerId,
      rejectionReason: null,
      verificationFlags: ['EXPIRED'],
      verifiedAt: null,
      existingAudit: document.auditTrail,
      audit: outcome.audit,
    });

    expired += 1;
    expiredIds.push(document.id);
  }

  return { ok: true, checked: candidates.length, expired, expiredIds, at: now };
};

export default defineLogicFunction({
  universalIdentifier: FN_EXPIRE_DOCUMENTS_ID,
  name: 'lv-expire-documents',
  description:
    'Nightly sweep that moves verified onboarding documents to Expired once their expiry date has passed. Detection only — no reminder policy is defined.',
  timeoutSeconds: 120,
  handler,
  // 02:15 daily. Off-peak, and after midnight so a document expiring "today"
  // is caught on the day it lapses rather than the day after.
  cronTriggerSettings: { pattern: '15 2 * * *' },
});
