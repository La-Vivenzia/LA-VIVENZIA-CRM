import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_CAPTURE_PREFLIGHT_ID } from 'src/constants/universal-identifiers';
import { describeAiAvailability, readAiConfig } from 'src/modules/lv-ai/config/ai-config';
import { createAiProvider } from 'src/modules/lv-ai/provider/create-provider';
import { applicationClient, delegatedClient } from 'src/modules/lv-ai/runtime/clients';
import { CAPTURE_METHOD_BY_KEY } from 'src/modules/lv-capture/constants/capture-methods';
import { isCaptureKey, readCaptureInput } from 'src/modules/lv-capture/services/capture-request';
import { assessDraftQuality, draftFor, recommendAssignment, scanDraftDuplicates } from 'src/modules/lv-capture/services/capture-service';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';
import { classifyDraft } from 'src/modules/lv-intelligence/services/model-operations';
import { describeError } from 'src/modules/lv-core/utils/describe-error';

// POST /capture/preflight { captureKey, method, fields, classify?: boolean, recommend?: boolean }
//
// Everything the review screen needs before a lead is created, in one
// round trip: the validated draft, data-quality hints, a classification
// suggestion (AI, when configured — otherwise honestly UNAVAILABLE),
// duplicate candidates the caller is allowed to see, and the assignment the
// engine would make. Nothing is written except audit rows; the employee
// decides on the next screen.

type Input = { captureKey?: unknown; method?: unknown; fields?: unknown; classify?: unknown; recommend?: unknown; stage?: unknown };

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can capture leads.' };
  }

  if (!isCaptureKey(input.captureKey)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'captureKey must be a UUID.' };
  }

  const parsed = readCaptureInput(input);

  if (!parsed.ok) {
    return { ok: false, refusal: 'INVALID_INPUT', error: parsed.error };
  }

  const built = draftFor(parsed.input);

  if (!built.ok) {
    return { ok: false, refusal: 'INVALID_INPUT', errors: built.errors, error: built.errors[0] };
  }

  const { draft } = built;
  const application = new CoreApiClient({ runAs: 'application' });
  const now = new Date().toISOString();
  const method = CAPTURE_METHOD_BY_KEY[parsed.method];

  // "Capture started" is written once per capture key, on the first
  // preflight; later preflights of the same capture (after edits) are
  // "reviewed" — the trail shows how many times the person looked.
  await writeAuditEvent(application, {
    action: input.stage === 'REVIEW' ? 'CAPTURE_REVIEWED' : 'CAPTURE_STARTED',
    outcome: 'APPLIED',
    targetObject: 'lvCapture',
    targetRecordId: input.captureKey,
    targetLabel: `${method.label} · ${draft.name}`.slice(0, 200),
    actorWorkspaceMemberId,
    at: now,
    reason: null,
    metadata: { method: method.key, source: draft.source, completeness: draft.completeness },
  });

  const quality = assessDraftQuality(draft, parsed.input);

  // Duplicates under the caller's token (CM-004 decides what they can see).
  let duplicates: Awaited<ReturnType<typeof scanDraftDuplicates>> = [];
  let duplicateError: string | null = null;

  try {
    duplicates = await scanDraftDuplicates(delegatedClient(), draft, now);
  } catch (error) {
    duplicateError = error instanceof Error ? error.message.slice(0, 160) : 'Duplicate check unavailable.';
  }

  if (duplicates.length > 0) {
    await writeAuditEvent(application, {
      action: 'DUPLICATE_DETECTED',
      outcome: 'APPLIED',
      targetObject: 'lvCapture',
      targetRecordId: input.captureKey,
      targetLabel: draft.name,
      actorWorkspaceMemberId,
      at: now,
      reason: null,
      metadata: { candidates: duplicates.map((candidate) => ({ leadId: candidate.leadId, lvLeadId: candidate.lvLeadId, percent: candidate.percent, fields: candidate.matchingFields })) },
    });
  }

  // Classification: only when asked and when the draft has no category yet.
  const config = readAiConfig();
  const availability = describeAiAvailability(config);
  let classification: Awaited<ReturnType<typeof classifyDraft>> | null = null;

  if (input.classify !== false && !draft.category) {
    try {
      classification = await classifyDraft(
        createAiProvider(config),
        applicationClient(),
        { name: draft.name, organisationName: draft.organisationName, location: draft.location, source: draft.source, websiteUrl: draft.websiteUrl, instagramHandle: draft.instagramHandle, hasEmail: draft.email !== null, hasPhone: draft.phone !== null, languages: draft.languages, notes: null },
        { actorWorkspaceMemberId, captureKey: input.captureKey },
      );
    } catch (error) {
      classification = { status: 'UNAVAILABLE', category: null, subcategory: null, confidence: null, reasoning: null, code: 'AI_UNAVAILABLE', runId: null, provider: 'none', model: null, promptVersion: 'lead-classification-v1' };
      console.warn('[lv-capture] classification failed:', describeError(error));
    }
  }

  // Assignment recommendation: the engine's decision, explained, not applied.
  let recommendation: Awaited<ReturnType<typeof recommendAssignment>> | null = null;
  let recommendationError: string | null = null;

  if (input.recommend !== false) {
    try {
      recommendation = await recommendAssignment(application, draft, now);
      await writeAuditEvent(application, {
        action: 'ASSIGNMENT_RECOMMENDED',
        outcome: 'APPLIED',
        targetObject: 'lvCapture',
        targetRecordId: input.captureKey,
        targetLabel: draft.name,
        actorWorkspaceMemberId,
        at: now,
        reason: null,
        metadata: { memberId: recommendation.memberId, strategy: recommendation.strategy, score: recommendation.score, reasons: recommendation.reasons, noMatchReason: recommendation.noMatchReason },
      });
    } catch (error) {
      recommendationError = error instanceof Error ? error.message.slice(0, 160) : 'Assignment recommendation unavailable.';
    }
  }

  return {
    ok: true,
    captureKey: input.captureKey,
    method: method.key,
    draft: {
      name: draft.name,
      organisationName: draft.organisationName,
      jobTitle: draft.jobTitle,
      email: draft.email,
      phone: draft.phone,
      websiteUrl: draft.websiteUrl,
      instagramHandle: draft.instagramHandle,
      socialProfile: draft.socialProfile,
      location: draft.location,
      category: draft.category,
      subcategory: draft.subcategory,
      languages: draft.languages,
      source: draft.source,
      priority: draft.priority,
      status: draft.status,
      completeness: draft.completeness,
      requiresHumanConfirmation: draft.requiresHumanConfirmation,
      warnings: draft.warnings,
      provenance: draft.provenance,
    },
    quality,
    duplicates,
    duplicateError,
    classification,
    ai: availability,
    recommendation,
    recommendationError,
    generatedAt: now,
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_CAPTURE_PREFLIGHT_ID,
  name: 'lv-capture-preflight',
  description: 'Validates a capture draft and returns data-quality hints, a classification suggestion, duplicate candidates and the assignment recommendation — writes nothing but audit rows',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: { path: '/capture/preflight', httpMethod: 'POST', isAuthRequired: true },
});
