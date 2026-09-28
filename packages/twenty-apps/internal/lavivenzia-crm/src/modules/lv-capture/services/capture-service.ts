import { randomUUID } from 'node:crypto';

import { type CoreApiClient } from 'twenty-client-sdk/core';

import { createCoreApiAssignmentPort } from 'src/modules/lv-assignment/services/core-api-assignment-port';
import { type AssignmentDecision } from 'src/modules/lv-assignment/types/assignment.types';
import { selectAssignee } from 'src/modules/lv-assignment/utils/select-assignee';
import { CAPTURE_METHOD_BY_KEY } from 'src/modules/lv-capture/constants/capture-methods';
import { type CaptureInput, type LeadDraft } from 'src/modules/lv-capture/types/capture.types';
import { buildLeadDraft } from 'src/modules/lv-capture/utils/build-lead-draft';
import { createCoreApiLeadIdPort } from 'src/modules/lv-core/services/core-api-lead-id-port';
import { allocateLeadId } from 'src/modules/lv-core/services/lead-id-allocator';
import { type DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';
import { type DuplicateCandidate, scanDuplicates } from 'src/modules/lv-intelligence/engines/duplicate-scan';
import { createCoreApiNotificationPort } from 'src/modules/lv-notifications/services/core-api-notification-port';
import { findMember } from 'src/modules/lv-notifications/services/member-lookup';
import { dispatchNotifications } from 'src/modules/lv-notifications/services/notification-service';
import { notificationsForOwnerChange } from 'src/modules/lv-notifications/utils/build-notification';
import { describeError } from 'src/modules/lv-core/utils/describe-error';

// The capture engine behind the routes. Pure decisions live in the draft
// builder and the assignment engine; this file sequences them against the
// workspace and keeps every write attributable and repeatable.

// ---------------------------------------------------------------------------
// Data quality before creation
// ---------------------------------------------------------------------------
export type DraftQualityHint = { code: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; kind: 'MISSING' | 'INVALID' | 'WARNING'; field: string | null; text: string };

// What the reviewer sees under "Before you create". Missing contact details
// are the loudest, because a lead nobody can reach is not a lead. Nothing
// here blocks a valid lead; the create route only refuses drafts the builder
// itself refuses.
export const assessDraftQuality = (draft: LeadDraft, input: CaptureInput): DraftQualityHint[] => {
  const hints: DraftQualityHint[] = [];

  if (!draft.email && !draft.phone) {
    hints.push({ code: 'MISSING_CONTACT', severity: 'HIGH', kind: 'MISSING', field: 'phone', text: 'No phone or email — nobody can reach this lead yet.' });
  } else {
    if (!draft.phone) {
      hints.push({ code: 'MISSING_PHONE', severity: 'LOW', kind: 'MISSING', field: 'phone', text: 'Phone' });
    }

    if (!draft.email) {
      hints.push({ code: 'MISSING_EMAIL', severity: 'LOW', kind: 'MISSING', field: 'email', text: 'Email' });
    }
  }

  if (input.email && !draft.email) {
    hints.push({ code: 'MALFORMED_EMAIL', severity: 'MEDIUM', kind: 'INVALID', field: 'email', text: `Email "${input.email}" is not a valid address.` });
  }

  if (input.phone && !draft.phone) {
    hints.push({ code: 'MALFORMED_PHONE', severity: 'MEDIUM', kind: 'INVALID', field: 'phone', text: `Phone "${input.phone}" could not be read as a number.` });
  }

  if (input.websiteUrl && !draft.websiteUrl) {
    hints.push({ code: 'MALFORMED_WEBSITE', severity: 'MEDIUM', kind: 'INVALID', field: 'websiteUrl', text: `Website "${input.websiteUrl}" is not a valid address.` });
  }

  if (!draft.websiteUrl && !draft.instagramHandle && !draft.socialProfile) {
    hints.push({ code: 'MISSING_WEB_PRESENCE', severity: 'LOW', kind: 'MISSING', field: 'websiteUrl', text: 'Website or social profile' });
  }

  if (!draft.organisationName) {
    hints.push({ code: 'MISSING_ORGANISATION', severity: 'LOW', kind: 'WARNING', field: 'organisationName', text: 'Organisation not given — the assignment engine matches existing relationships by organisation.' });
  }

  if (!draft.location) {
    hints.push({ code: 'MISSING_LOCATION', severity: 'MEDIUM', kind: 'MISSING', field: 'location', text: 'Location — needed to route by geography.' });
  }

  if (!draft.category) {
    hints.push({ code: 'MISSING_CATEGORY', severity: 'MEDIUM', kind: 'MISSING', field: 'category', text: 'Category — needed to route by expertise.' });
  }

  return hints;
};

// ---------------------------------------------------------------------------
// Duplicates before creation
// ---------------------------------------------------------------------------
// The Day 6 scan wants a lead record; the draft is dressed as one with a
// throw-away id so the "not itself" filter matches nothing. Runs under the
// caller's token, so a Hunter sees only duplicates CM-004 lets them see.
export const scanDraftDuplicates = async (delegated: DelegatedGraphqlClient, draft: LeadDraft, now = new Date().toISOString()): Promise<DuplicateCandidate[]> => {
  const result = await scanDuplicates(
    delegated,
    {
      id: randomUUID(),
      lvLeadId: null,
      name: draft.name,
      organisationName: draft.organisationName,
      category: draft.category,
      subcategory: draft.subcategory,
      location: draft.location,
      source: draft.source,
      captureMode: draft.captureMode,
      status: draft.status,
      priority: draft.priority,
      ownerId: null,
      assignedAt: null,
      emails: draft.email ? { primaryEmail: draft.email } : null,
      phones: draft.phone ? { primaryPhoneNumber: draft.phone } : null,
      website: draft.websiteUrl ? { primaryLinkUrl: draft.websiteUrl } : null,
      instagram: draft.instagramHandle ? { primaryLinkUrl: draft.instagramHandle } : null,
      languages: [...draft.languages],
      opportunityScore: null,
      dataCompleteness: draft.completeness,
      // A freshly captured lead has no photograph, rating or tenure yet.
      photoUrl: null,
      rating: null,
      reviewCount: null,
      yearsOfExperience: null,
      lastInteractionAt: null,
      nextAction: null,
      nextFollowUpAt: null,
      onboardingStatus: null,
      rawCaptureInput: null,
      duplicateKeys: [...draft.duplicateKeys], jobTitle: null, socialProfiles: null, captureProvenance: null, captureFiles: null,
      createdAt: now,
      updatedAt: now,
    },
    now,
  );

  return result.candidates;
};

// ---------------------------------------------------------------------------
// Assignment recommendation (a dry run of the engine)
// ---------------------------------------------------------------------------
export type AssignmentRecommendation = {
  memberId: string | null;
  displayName: string | null;
  strategy: AssignmentDecision['strategy'];
  score: number | null;
  reasons: string[];
  noMatchReason: string | null;
  candidates: { memberId: string; displayName: string; eligible: boolean; reason: string | null; score: number | null }[];
};

export const recommendAssignment = async (application: CoreApiClient, draft: LeadDraft, now = new Date().toISOString()): Promise<AssignmentRecommendation> => {
  const port = createCoreApiAssignmentPort(application);
  const [candidates, rules, existingRelationshipOwnerId] = await Promise.all([
    port.listAssignableMembers(),
    port.listActiveRules(),
    port.findExistingRelationshipOwnerId({ id: randomUUID(), organisationName: draft.organisationName, duplicateKeys: draft.duplicateKeys }),
  ]);
  const decision = selectAssignee({
    lead: { category: draft.category, subcategory: draft.subcategory, location: draft.location, languages: draft.languages, source: draft.source, priority: draft.priority, organisationName: draft.organisationName },
    candidates,
    rules,
    existingRelationshipOwnerId,
    manualAssigneeId: null,
    now,
  });
  const byId = new Map(candidates.map((candidate) => [candidate.workspaceMemberId, candidate]));
  const scoreOf = new Map(decision.scores.map((score) => [score.workspaceMemberId, score]));
  const ineligible = new Map(decision.ineligible.map((row) => [row.workspaceMemberId, row.reason]));
  const chosen = decision.assigneeWorkspaceMemberId ? byId.get(decision.assigneeWorkspaceMemberId) : undefined;
  const chosenScore = decision.assigneeWorkspaceMemberId ? scoreOf.get(decision.assigneeWorkspaceMemberId) : undefined;
  const reasons =
    decision.strategy === 'EXISTING_RELATIONSHIP'
      ? ['Already owns a lead for this organisation']
      : decision.strategy === 'RULE'
        ? [`Routing rule matched${decision.matchedRuleId ? '' : ''}`]
        : decision.strategy === 'ROUND_ROBIN'
          ? ['No member scored above another; the least recently assigned member takes it']
          : (chosenScore?.factors ?? []).filter((factor) => factor.matched).map((factor) => factor.detail);

  if (chosen && chosenScore) {
    reasons.push(`${chosenScore.openLeadCount} open lead${chosenScore.openLeadCount === 1 ? '' : 's'} of ${chosen.capacity} capacity`);
  }

  const INELIGIBLE_TEXT: Record<string, string> = {
    INACTIVE: 'not accepting leads',
    ZERO_CAPACITY: 'capacity set to zero',
    AT_CAPACITY: 'at capacity',
    CAPACITY_RESERVED_FOR_CRITICAL: 'last slot reserved for critical leads',
  };

  return {
    memberId: decision.assigneeWorkspaceMemberId,
    displayName: chosen?.displayName ?? null,
    strategy: decision.strategy,
    score: decision.score,
    reasons: [...new Set(reasons)],
    noMatchReason: decision.assigneeWorkspaceMemberId ? null : (decision.unassignedReason ?? 'No team member matches the current requirements.'),
    candidates: candidates
      .map((candidate) => ({
        memberId: candidate.workspaceMemberId,
        displayName: candidate.displayName,
        eligible: !ineligible.has(candidate.workspaceMemberId) && candidate.isActive,
        reason: ineligible.has(candidate.workspaceMemberId) ? (INELIGIBLE_TEXT[ineligible.get(candidate.workspaceMemberId)!] ?? null) : candidate.isActive ? null : 'inactive',
        score: scoreOf.get(candidate.workspaceMemberId)?.total ?? null,
      }))
      .sort((left, right) => (right.score ?? -1) - (left.score ?? -1)),
  };
};

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------
export type CaptureProvenance = {
  method: string;
  platform: string | null;
  originalUrl: string | null;
  originalHandle: string | null;
  capturedAt: string;
  capturedById: string | null;
  extraction: { status: 'NOT_APPLICABLE' | 'EXTRACTED' | 'UNAVAILABLE' | 'FAILED' | 'SKIPPED'; kind: 'OCR' | 'PAGE_METADATA' | null; runId: string | null; fieldCount: number };
  classification: { status: 'NOT_RUN' | 'AI_SUGGESTED' | 'REVIEW_REQUIRED' | 'UNAVAILABLE' | 'ACCEPTED' | 'EDITED' | 'REJECTED' | 'MANUAL'; runId: string | null };
  verification: 'CONFIRMED_BY_PERSON' | 'UNCONFIRMED';
  duplicateDecision: { decision: 'NONE' | 'CREATE_NEW' | 'IGNORED'; candidateLeadIds: string[] };
  captureKey: string;
};

export const leadCreateData = (draft: LeadDraft, provenance: CaptureProvenance, extra: { ownerId: string | null; attachment: unknown | null }): Record<string, unknown> => ({
  name: draft.name,
  organisationName: draft.organisationName,
  jobTitle: draft.jobTitle,
  location: draft.location,
  category: draft.category,
  subcategory: draft.subcategory,
  source: draft.source,
  captureMode: draft.captureMode,
  status: draft.status,
  priority: draft.priority,
  languages: [...draft.languages],
  rawCaptureInput: draft.rawInput,
  fieldProvenance: draft.provenance,
  duplicateKeys: [...draft.duplicateKeys],
  dataCompleteness: draft.completeness,
  photoUrl: null,
  rating: null,
  reviewCount: null,
  yearsOfExperience: null,
  captureProvenance: provenance,
  captureKey: provenance.captureKey,
  emails: draft.email ? { primaryEmail: draft.email } : undefined,
  phones: draft.phone ? { primaryPhoneNumber: draft.phone } : undefined,
  website: draft.websiteUrl ? { primaryLinkUrl: draft.websiteUrl } : undefined,
  instagram: draft.instagramHandle ? { primaryLinkUrl: draft.instagramHandle } : undefined,
  socialProfiles: draft.socialProfile?.url ? { primaryLinkUrl: draft.socialProfile.url, primaryLinkLabel: draft.socialProfile.platform } : undefined,
  captureFiles: extra.attachment ?? undefined,
  ownerId: extra.ownerId ?? undefined,
});

export type CreateOutcome =
  | { ok: true; leadId: string; lvLeadId: string | null; replayed: boolean }
  | { ok: false; refusal: 'NOT_PERMITTED' | 'INVALID_INPUT'; error: string; detail?: string };

// Idempotent: the capture key is unique on the lead, and it is looked up
// with the application token (which sees every lead) before anything is
// written — so a double-click, a browser retry or a second tab all get the
// lead the first attempt created, never a second one. The write itself is
// made as the caller, so the lead permission and CM-004 still bind.
export const createCapturedLead = async (options: {
  delegated: CoreApiClient;
  application: CoreApiClient;
  draft: LeadDraft;
  provenance: CaptureProvenance;
  ownerId: string | null;
  attachment: unknown | null;
  actorWorkspaceMemberId: string;
  now: string;
}): Promise<CreateOutcome> => {
  const { delegated, application, draft, provenance, actorWorkspaceMemberId, now } = options;
  const existing = await findLeadByCaptureKey(application, provenance.captureKey);

  if (existing) {
    return { ok: true, leadId: existing.id, lvLeadId: existing.lvLeadId, replayed: true };
  }

  let leadId: string | null = null;

  try {
    const created = await delegated.mutation({ createLvLead: { __args: { data: leadCreateData(draft, provenance, { ownerId: options.ownerId, attachment: options.attachment }) }, id: true } });

    leadId = (created as { createLvLead?: { id?: string } }).createLvLead?.id ?? null;
  } catch (error) {
    const message = describeError(error);

    // The unique index on captureKey is the last line of defence when two
    // requests race past the lookup above: the loser reads the winner.
    if (/duplicate|unique|already exists/i.test(message)) {
      const winner = await findLeadByCaptureKey(application, provenance.captureKey);

      if (winner) {
        return { ok: true, leadId: winner.id, lvLeadId: winner.lvLeadId, replayed: true };
      }
    }

    // A permission refusal and a rejected value are different problems for
    // the person on the other end; tell them which.
    const isPermission = /forbidden|not allowed|permission|not permitted|unauthori[sz]ed|403/i.test(message);

    await writeAuditEvent(application, {
      action: 'LEAD_CREATED',
      outcome: 'REFUSED',
      targetObject: 'lvLead',
      targetRecordId: provenance.captureKey,
      targetLabel: draft.name,
      actorWorkspaceMemberId,
      at: now,
      reason: null,
      metadata: { method: provenance.method, error: isPermission ? 'permission' : 'rejected', detail: message.slice(0, 160) },
    });

    return isPermission ? { ok: false, refusal: 'NOT_PERMITTED', error: 'Your role cannot create leads.', detail: message.slice(0, 160) } : { ok: false, refusal: 'INVALID_INPUT', error: 'The lead could not be saved.', detail: message.slice(0, 160) };
  }

  if (!leadId) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'The lead was not created.' };
  }

  // The identifier is allocated here, synchronously, so the person sees it
  // on the success screen; the lvLead.created handler finds it already set
  // and skips its own allocation (allocateLeadId reads the live record).
  const identifier = await allocateLeadId({ lead: { id: leadId, lvLeadId: null }, port: createCoreApiLeadIdPort(application) }).catch(() => null);
  const lvLeadId = identifier?.ok ? identifier.leadId : null;

  await writeAuditEvent(application, {
    action: 'LEAD_CREATED',
    outcome: 'APPLIED',
    targetObject: 'lvLead',
    targetRecordId: leadId,
    targetLabel: `${lvLeadId ?? ''} ${draft.name}`.trim(),
    actorWorkspaceMemberId,
    at: now,
    reason: null,
    metadata: {
      method: provenance.method,
      source: draft.source,
      platform: provenance.platform,
      extraction: provenance.extraction.status,
      classification: provenance.classification.status,
      verification: provenance.verification,
      duplicateDecision: provenance.duplicateDecision.decision,
      ownerId: options.ownerId,
      captureKey: provenance.captureKey,
      completeness: draft.completeness,
    },
  });

  return { ok: true, leadId, lvLeadId, replayed: false };
};

export const findLeadByCaptureKey = async (application: CoreApiClient, captureKey: string): Promise<{ id: string; lvLeadId: string | null; ownerId: string | null } | null> => {
  try {
    const result = await application.query({ lvLeads: { __args: { first: 1, filter: { captureKey: { eq: captureKey } } }, edges: { node: { id: true, lvLeadId: true, ownerId: true } } } });
    const node = (result as { lvLeads?: { edges?: { node?: { id: string; lvLeadId?: string | null; ownerId?: string | null } }[] } }).lvLeads?.edges?.[0]?.node;

    return node?.id ? { id: node.id, lvLeadId: node.lvLeadId ?? null, ownerId: node.ownerId ?? null } : null;
  } catch {
    return null;
  }
};

// Builds a draft or explains why it cannot be built. Thin wrapper so every
// route validates the same way.
export const draftFor = (input: CaptureInput): { ok: true; draft: LeadDraft } | { ok: false; errors: string[] } => {
  const result = buildLeadDraft(input);

  return result.ok ? { ok: true, draft: result.draft } : { ok: false, errors: [...result.errors] };
};

export const methodProvenance = (method: string, draft: LeadDraft): Pick<CaptureProvenance, 'method' | 'platform' | 'originalUrl' | 'originalHandle'> => {
  const definition = CAPTURE_METHOD_BY_KEY[method as keyof typeof CAPTURE_METHOD_BY_KEY];
  const platform = draft.socialProfile?.platform ?? (draft.instagramHandle ? 'INSTAGRAM' : (definition?.platform ?? null));

  return {
    method,
    platform,
    originalUrl: draft.socialProfile?.url ?? (draft.instagramHandle ? `https://instagram.com/${draft.instagramHandle}` : draft.websiteUrl),
    originalHandle: draft.socialProfile?.handle ?? draft.instagramHandle,
  };
};

// An owner set *at creation* (an administrator assigning a colleague on the
// capture screen, or an owner column in an import) never passes through
// lvLead.updated, so the Day 4 producer of LEAD_ASSIGNED never sees it. This
// is the one other place a person is given a lead, and it uses the same
// intents, dispatcher and dedupe keys — a later reassignment still notifies
// exactly once through lv-on-lead-updated. Not called when people assign
// themselves: nobody needs telling what they just did.
export const notifyOwnerAssignedAtCapture = async ({
  application,
  leadId,
  leadName,
  ownerId,
  priority,
  actorWorkspaceMemberId,
  now,
  sourceEvent,
}: {
  application: CoreApiClient;
  leadId: string;
  leadName: string;
  ownerId: string;
  priority: LeadDraft['priority'];
  actorWorkspaceMemberId: string | null;
  now: string;
  sourceEvent: string;
}): Promise<number> => {
  if (ownerId === actorWorkspaceMemberId) {
    return 0;
  }

  const actor = await findMember(application, actorWorkspaceMemberId);
  const intents = notificationsForOwnerChange({
    leadId,
    leadName,
    previousOwnerWorkspaceMemberId: null,
    newOwnerWorkspaceMemberId: ownerId,
    assignedByName: actor === null ? null : (actor.displayName ?? 'a team member'),
    priority,
    changedAt: now,
  });
  const outcome = await dispatchNotifications({ port: createCoreApiNotificationPort(application), intents, sourceEvent, actorWorkspaceMemberId });

  return outcome.created.length;
};
