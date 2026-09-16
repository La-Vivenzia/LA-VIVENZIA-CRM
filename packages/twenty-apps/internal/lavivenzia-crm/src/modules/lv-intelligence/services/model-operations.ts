import { type AiInsightType } from 'src/modules/lv-ai/objects/ai-insight.object';
import { type AiProvider, type AiResult } from 'src/modules/lv-ai/provider/ai-provider';
import {
  CONVERSATION_SUMMARY_PROMPT,
  type ConversationSummaryOutput,
  DRAFT_PROMPT,
  type DraftKind,
  type DraftOutput,
  LEAD_CLASSIFICATION_PROMPT,
  LEAD_SUMMARY_PROMPT,
  type ClassificationOutput,
  type LeadSummaryOutput,
  ONBOARDING_ASSIST_PROMPT,
  type OnboardingAssistOutput,
  type PromptDefinition,
} from 'src/modules/lv-ai/prompts/prompt-registry';
import { runPrompt } from 'src/modules/lv-ai/runtime/ai-runner';
import { type GraphqlClient } from 'src/modules/lv-ai/runtime/clients';
import { fingerprintOf, type InsightRow, listInsightsForLead, upsertInsight } from 'src/modules/lv-ai/runtime/insight-store';
import { isLeadCategory, LEAD_SUBCATEGORIES_BY_CATEGORY } from 'src/modules/lv-core/constants/lead-taxonomy';
import { type InteractionRecord, type LeadContext, sourceRecordIds } from 'src/modules/lv-intelligence/services/lead-context';
import { classificationContext, conversationContext, draftContext, onboardingAssistContext, summaryContext } from 'src/modules/lv-intelligence/services/model-context';

// The language-model half of lead intelligence. Each operation: minimise the
// context → run the versioned prompt → validate → check provenance → store
// as a MODEL-origin insight (or an UNAVAILABLE row carrying the failure
// code). Nothing here writes to a CRM record; that happens only in the decide
// route, with the reviewer's permissions.

export type ModelOperationResult<T> = {
  ok: boolean;
  status: 'AI_SUGGESTED' | 'UNAVAILABLE' | 'REVIEW_REQUIRED';
  code: string | null;
  message: string | null;
  insight: InsightRow | null;
  output: T | null;
  provider: string;
  model: string | null;
  promptVersion: string;
};

type Common = {
  provider: AiProvider;
  application: GraphqlClient;
  context: LeadContext;
  actorWorkspaceMemberId: string | null;
};

const CLASSIFICATION_REVIEW_THRESHOLD = 0.6;

const store = async <T>(
  common: Common,
  type: AiInsightType,
  result: AiResult<T>,
  prompt: PromptDefinition<T>,
  details: { targetObject: string; targetRecordId: string; summary: string | null; confidence: number | null; payload: unknown; discriminator?: string; extraSources?: string[]; status?: 'AI_SUGGESTED' | 'UNAVAILABLE' },
): Promise<InsightRow | null> => {
  try {
    const existing = await listInsightsForLead(common.application, common.context.lead.id, [type]);
    const sources = [...sourceRecordIds(common.context), ...(details.extraSources ?? [])];

    return await upsertInsight(common.application, existing, {
      insightType: type,
      status: details.status ?? (result.ok ? 'AI_SUGGESTED' : 'UNAVAILABLE'),
      origin: 'MODEL',
      targetObject: details.targetObject,
      targetRecordId: details.targetRecordId,
      leadId: common.context.lead.id,
      provider: result.provider,
      model: result.model,
      promptVersion: prompt.id,
      generatedAt: new Date().toISOString(),
      confidence: details.confidence,
      sourceRecordIds: sources,
      payload: details.payload,
      summary: details.summary,
      fingerprint: fingerprintOf([prompt.id, sources]),
      errorCode: result.ok ? null : result.code,
      discriminator: details.discriminator,
    });
  } catch (caught) {
    console.warn('[lv-ai] insight not stored:', caught instanceof Error ? caught.message : String(caught));

    return null;
  }
};

const failed = <T>(result: Extract<AiResult<T>, { ok: false }>, insight: InsightRow | null, promptVersion: string): ModelOperationResult<T> => ({
  ok: false,
  status: 'UNAVAILABLE',
  code: result.code,
  message: result.message,
  insight,
  output: null,
  provider: result.provider,
  model: result.model,
  promptVersion,
});

// ------------------------------------------------------------ lead summary
export const generateLeadSummary = async (common: Common): Promise<ModelOperationResult<LeadSummaryOutput>> => {
  const { context } = common;
  const sources = new Set(sourceRecordIds(context));
  const { result } = await runPrompt(common.provider, common.application, LEAD_SUMMARY_PROMPT, summaryContext(context), {
    operation: 'LEAD_SUMMARY',
    actorWorkspaceMemberId: common.actorWorkspaceMemberId,
    targetObject: 'lvLead',
    targetRecordId: context.lead.id,
    sourceRecordIds: [...sources],
  });

  if (!result.ok) {
    const insight = await store(common, 'LEAD_SUMMARY', result, LEAD_SUMMARY_PROMPT, { targetObject: 'lvLead', targetRecordId: context.lead.id, summary: null, confidence: null, payload: { error: result.code } });

    return failed(result, insight, LEAD_SUMMARY_PROMPT.id);
  }

  // Provenance check: a citation that is not in the context is dropped and
  // flagged, never shown as if it were a source.
  const allowed = new Set([...sources, context.lead.lvLeadId ?? ''].filter(Boolean));
  const cited = result.value.citedRecordIds.filter((id) => allowed.has(id.replace(/^#/, '')));
  const dropped = result.value.citedRecordIds.length - cited.length;
  const output: LeadSummaryOutput = { ...result.value, citedRecordIds: cited };
  const insight = await store(common, 'LEAD_SUMMARY', result, LEAD_SUMMARY_PROMPT, {
    targetObject: 'lvLead',
    targetRecordId: context.lead.id,
    summary: output.overview,
    confidence: null,
    payload: { ...output, uncitedReferencesDropped: dropped },
  });

  return { ok: true, status: 'AI_SUGGESTED', code: null, message: null, insight, output, provider: result.provider, model: result.model, promptVersion: LEAD_SUMMARY_PROMPT.id };
};

// ---------------------------------------------------------- classification
export const generateClassification = async (common: Common): Promise<ModelOperationResult<ClassificationOutput & { reviewRequired: boolean; validCategory: boolean }>> => {
  const { context } = common;
  const { result } = await runPrompt(common.provider, common.application, LEAD_CLASSIFICATION_PROMPT, classificationContext(context), {
    operation: 'CLASSIFICATION',
    actorWorkspaceMemberId: common.actorWorkspaceMemberId,
    targetObject: 'lvLead',
    targetRecordId: context.lead.id,
    sourceRecordIds: sourceRecordIds(context),
  });

  if (!result.ok) {
    const insight = await store(common, 'CLASSIFICATION', result, LEAD_CLASSIFICATION_PROMPT, { targetObject: 'lvLead', targetRecordId: context.lead.id, summary: null, confidence: null, payload: { error: result.code } });

    return failed(result, insight, LEAD_CLASSIFICATION_PROMPT.id);
  }

  // The model may only pick from the allowed vocabulary; anything else is
  // treated as "no suggestion" and flagged for review.
  const category = result.value.category && isLeadCategory(result.value.category) ? result.value.category : null;
  const subcategory = category && result.value.subcategory && (LEAD_SUBCATEGORIES_BY_CATEGORY[category] as readonly string[]).includes(result.value.subcategory) ? result.value.subcategory : null;
  const validCategory = category !== null;
  const reviewRequired = !validCategory || (result.value.confidence ?? 0) < CLASSIFICATION_REVIEW_THRESHOLD;
  const output = { ...result.value, category, subcategory, reviewRequired, validCategory };
  const insight = await store(common, 'CLASSIFICATION', result, LEAD_CLASSIFICATION_PROMPT, {
    targetObject: 'lvLead',
    targetRecordId: context.lead.id,
    summary: category ? `Suggested ${category}${subcategory ? ` / ${subcategory}` : ''}${reviewRequired ? ' (review required)' : ''}` : 'No confident classification',
    confidence: result.value.confidence,
    payload: output,
  });

  return { ok: true, status: reviewRequired ? 'REVIEW_REQUIRED' : 'AI_SUGGESTED', code: null, message: null, insight, output, provider: result.provider, model: result.model, promptVersion: LEAD_CLASSIFICATION_PROMPT.id };
};

// Day 8: the same classification for a lead that does not exist yet (the
// capture review screen). The draft is dressed as a lead context — the same
// minimiser applies, so email and phone values never reach the model and
// raw capture input is excluded — and the run is audited against the
// capture key. No insight row is stored: the decision (accept / edit /
// reject) is recorded on the lead at creation, in captureProvenance and
// the CLASSIFICATION_* audit rows.
export type DraftClassification = {
  status: 'AI_SUGGESTED' | 'REVIEW_REQUIRED' | 'UNAVAILABLE';
  category: string | null;
  subcategory: string | null;
  confidence: number | null;
  reasoning: string | null;
  code: string | null;
  runId: string | null;
  provider: string;
  model: string | null;
  promptVersion: string;
};

export const classifyDraft = async (
  provider: AiProvider,
  application: GraphqlClient,
  draft: { name: string; organisationName: string | null; location: string | null; source: string | null; websiteUrl: string | null; instagramHandle: string | null; hasEmail: boolean; hasPhone: boolean; languages: readonly string[]; notes: string | null },
  context: { actorWorkspaceMemberId: string | null; captureKey: string },
): Promise<DraftClassification> => {
  const now = new Date().toISOString();
  const leadContext: LeadContext = {
    lead: {
      id: context.captureKey,
      lvLeadId: null,
      name: draft.name,
      organisationName: draft.organisationName,
      category: null,
      subcategory: null,
      location: draft.location,
      source: draft.source,
      captureMode: null,
      status: 'NEW',
      priority: null,
      ownerId: null,
      assignedAt: null,
      emails: draft.hasEmail ? { primaryEmail: 'on-file' } : null,
      phones: draft.hasPhone ? { primaryPhoneNumber: 'on-file' } : null,
      website: draft.websiteUrl ? { primaryLinkUrl: draft.websiteUrl } : null,
      instagram: draft.instagramHandle ? { primaryLinkUrl: draft.instagramHandle } : null,
      languages: [...draft.languages],
      opportunityScore: null,
      dataCompleteness: null,
      lastInteractionAt: null,
      nextAction: null,
      nextFollowUpAt: null,
      onboardingStatus: null,
      rawCaptureInput: null,
      duplicateKeys: null, jobTitle: null, socialProfiles: null, captureProvenance: null, captureFiles: null,
      createdAt: now,
      updatedAt: now,
    },
    interactions: [],
    tasks: [],
    notes: draft.notes ? [{ id: 'capture-notes', title: 'Capture notes', body: draft.notes.slice(0, 300), updatedAt: now }] : [],
    slas: [],
    onboarding: null,
    problems: [],
    loadedAt: now,
  };

  if (!provider.available) {
    return { status: 'UNAVAILABLE', category: null, subcategory: null, confidence: null, reasoning: null, code: 'AI_UNAVAILABLE', runId: null, provider: provider.name, model: provider.model, promptVersion: LEAD_CLASSIFICATION_PROMPT.id };
  }

  const { result, runId } = await runPrompt(provider, application, LEAD_CLASSIFICATION_PROMPT, classificationContext(leadContext), {
    operation: 'CLASSIFICATION',
    actorWorkspaceMemberId: context.actorWorkspaceMemberId,
    targetObject: 'lvCapture',
    targetRecordId: null,
    sourceRecordIds: [],
    metadata: { captureKey: context.captureKey },
  });

  if (!result.ok) {
    return { status: 'UNAVAILABLE', category: null, subcategory: null, confidence: null, reasoning: null, code: result.code, runId, provider: result.provider, model: result.model, promptVersion: LEAD_CLASSIFICATION_PROMPT.id };
  }

  const category = result.value.category && isLeadCategory(result.value.category) ? result.value.category : null;
  const subcategory = category && result.value.subcategory && (LEAD_SUBCATEGORIES_BY_CATEGORY[category] as readonly string[]).includes(result.value.subcategory) ? result.value.subcategory : null;
  const reviewRequired = category === null || (result.value.confidence ?? 0) < CLASSIFICATION_REVIEW_THRESHOLD;

  return { status: reviewRequired ? 'REVIEW_REQUIRED' : 'AI_SUGGESTED', category, subcategory, confidence: result.value.confidence, reasoning: result.value.reasoning || null, code: null, runId, provider: result.provider, model: result.model, promptVersion: LEAD_CLASSIFICATION_PROMPT.id };
};

// --------------------------------------------------- conversation summary
export const summarizeConversation = async (common: Common, interaction: InteractionRecord): Promise<ModelOperationResult<ConversationSummaryOutput>> => {
  const { context } = common;
  const hasText = Boolean(interaction.summary && interaction.summary.trim().length >= 20);

  if (!hasText) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      code: 'INSUFFICIENT_DATA',
      message: 'The interaction has no notes to summarise.',
      insight: null,
      output: null,
      provider: common.provider.name,
      model: common.provider.model,
      promptVersion: CONVERSATION_SUMMARY_PROMPT.id,
    };
  }

  const { result } = await runPrompt(common.provider, common.application, CONVERSATION_SUMMARY_PROMPT, conversationContext(context, interaction), {
    operation: 'CONVERSATION_SUMMARY',
    actorWorkspaceMemberId: common.actorWorkspaceMemberId,
    targetObject: 'lvInteraction',
    targetRecordId: interaction.id,
    sourceRecordIds: [context.lead.id, interaction.id, ...context.interactions.slice(0, 5).map((row) => row.id)],
  });

  if (!result.ok) {
    const insight = await store(common, 'CONVERSATION_SUMMARY', result, CONVERSATION_SUMMARY_PROMPT, { targetObject: 'lvInteraction', targetRecordId: interaction.id, summary: null, confidence: null, payload: { error: result.code }, discriminator: interaction.id });

    return failed(result, insight, CONVERSATION_SUMMARY_PROMPT.id);
  }

  const insight = await store(common, 'CONVERSATION_SUMMARY', result, CONVERSATION_SUMMARY_PROMPT, {
    targetObject: 'lvInteraction',
    targetRecordId: interaction.id,
    summary: result.value.summary,
    confidence: null,
    payload: result.value,
    discriminator: interaction.id,
    extraSources: [interaction.id],
  });

  // Problem candidates become their own suggestion rows (one per candidate)
  // so a human can confirm each independently.
  for (const [index, suggestion] of result.value.problemSuggestions.entries()) {
    await store(common, 'PROBLEM_SUGGESTION', result, CONVERSATION_SUMMARY_PROMPT, {
      targetObject: 'lvInteraction',
      targetRecordId: interaction.id,
      summary: `${suggestion.type} · ${suggestion.severity}: ${suggestion.description}`,
      confidence: null,
      payload: { ...suggestion, interactionId: interaction.id },
      discriminator: `${interaction.id}#${index}`,
      extraSources: [interaction.id],
    });
  }

  return { ok: true, status: 'AI_SUGGESTED', code: null, message: null, insight, output: result.value, provider: result.provider, model: result.model, promptVersion: CONVERSATION_SUMMARY_PROMPT.id };
};

// ------------------------------------------------------------------ drafts
export const generateDraft = async (
  common: Common,
  options: { kind: DraftKind; tone: string; senderFirstName: string | null; instructions: string | null },
): Promise<ModelOperationResult<DraftOutput & { kind: DraftKind; tone: string; label: 'AI DRAFT' }>> => {
  const { context } = common;
  const { result } = await runPrompt(common.provider, common.application, DRAFT_PROMPT, draftContext(context, options), {
    operation: `DRAFT_${options.kind}`,
    actorWorkspaceMemberId: common.actorWorkspaceMemberId,
    targetObject: 'lvLead',
    targetRecordId: context.lead.id,
    sourceRecordIds: sourceRecordIds(context),
    metadata: { kind: options.kind, tone: options.tone },
  });

  if (!result.ok) {
    return failed(result, null, DRAFT_PROMPT.id);
  }

  const output = { ...result.value, kind: options.kind, tone: options.tone, label: 'AI DRAFT' as const };
  const insight = await store(common, 'DRAFT', result, DRAFT_PROMPT, {
    targetObject: 'lvLead',
    targetRecordId: context.lead.id,
    summary: `${options.kind} draft${output.subject ? `: ${output.subject}` : ''}`,
    confidence: null,
    payload: output,
    discriminator: options.kind,
  });

  return { ok: true, status: 'AI_SUGGESTED', code: null, message: null, insight, output, provider: result.provider, model: result.model, promptVersion: DRAFT_PROMPT.id };
};

// -------------------------------------------------------- onboarding assist
export const assistOnboarding = async (common: Common, request: { field: string | null; text: string | null }): Promise<ModelOperationResult<OnboardingAssistOutput & { userProvidedText: string | null; label: 'AI SUGGESTED' }>> => {
  const { context } = common;

  if (!context.onboarding) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      code: 'NO_ONBOARDING',
      message: 'This lead has no onboarding record yet.',
      insight: null,
      output: null,
      provider: common.provider.name,
      model: common.provider.model,
      promptVersion: ONBOARDING_ASSIST_PROMPT.id,
    };
  }

  const { result } = await runPrompt(common.provider, common.application, ONBOARDING_ASSIST_PROMPT, onboardingAssistContext(context, request), {
    operation: 'ONBOARDING_ASSIST',
    actorWorkspaceMemberId: common.actorWorkspaceMemberId,
    targetObject: 'lvOnboarding',
    targetRecordId: context.onboarding.id,
    sourceRecordIds: [context.lead.id, context.onboarding.id],
    metadata: { field: request.field },
  });

  if (!result.ok) {
    return failed(result, null, ONBOARDING_ASSIST_PROMPT.id);
  }

  const output = { ...result.value, userProvidedText: request.text, label: 'AI SUGGESTED' as const };
  const insight = await store(common, 'ONBOARDING_ASSIST', result, ONBOARDING_ASSIST_PROMPT, {
    targetObject: 'lvOnboarding',
    targetRecordId: context.onboarding.id,
    summary: request.field ? `Suggested wording for ${request.field}` : 'Onboarding review',
    confidence: null,
    payload: output,
    discriminator: request.field ?? 'review',
    extraSources: [context.onboarding.id],
  });

  return { ok: true, status: 'AI_SUGGESTED', code: null, message: null, insight, output, provider: result.provider, model: result.model, promptVersion: ONBOARDING_ASSIST_PROMPT.id };
};
