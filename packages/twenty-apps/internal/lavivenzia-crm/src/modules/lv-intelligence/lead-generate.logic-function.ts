import 'src/modules/lv-core/runtime/resilient-fetch';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_AI_LEAD_GENERATE_ID } from 'src/constants/universal-identifiers';
import { DRAFT_KINDS, DRAFT_TONES, type DraftKind, PROMPT_VERSIONS } from 'src/modules/lv-ai/prompts/prompt-registry';
import { recordRun } from 'src/modules/lv-ai/runtime/ai-runner';
import { assistOnboarding, generateClassification, generateDraft, generateLeadSummary, summarizeConversation } from 'src/modules/lv-intelligence/services/model-operations';
import { beginLeadRoute, internalError, isRefusal, isUuid } from 'src/modules/lv-intelligence/services/route-support';
import { assertOutboundTelephonyAllowed, isSandboxLead } from 'src/modules/lv-core/utils/sandbox-telephony-guard';

// POST /ai/lead/generate { leadId, type, interactionId?, kind?, tone?, instructions?, field?, text? }
//
// The explicit "ask the model" request for one lead. type is one of
// LEAD_SUMMARY, CLASSIFICATION, CONVERSATION_SUMMARY (needs interactionId),
// DRAFT (needs kind), ONBOARDING_ASSIST (field/text optional). The caller must
// be able to open the lead; the interaction must be one of the lead's own.
// With no provider configured the answer is AI_UNAVAILABLE and nothing is
// fabricated.

const TYPES = ['LEAD_SUMMARY', 'CLASSIFICATION', 'CONVERSATION_SUMMARY', 'DRAFT', 'ONBOARDING_ASSIST'] as const;

const PROMPT_KEY: Record<(typeof TYPES)[number], keyof typeof PROMPT_VERSIONS> = { LEAD_SUMMARY: 'leadSummary', CLASSIFICATION: 'classification', CONVERSATION_SUMMARY: 'conversationSummary', DRAFT: 'draft', ONBOARDING_ASSIST: 'onboardingAssist' };

type Input = { leadId?: unknown; type?: unknown; interactionId?: unknown; kind?: unknown; tone?: unknown; instructions?: unknown; field?: unknown; text?: unknown };

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const session = await beginLeadRoute<Input>(event);

  if (isRefusal(session)) {
    return session;
  }

  const { input } = session;
  const type = typeof input.type === 'string' && (TYPES as readonly string[]).includes(input.type) ? (input.type as (typeof TYPES)[number]) : null;

  if (!type) {
    return { ok: false, refusal: 'INVALID_INPUT', error: `type must be one of ${TYPES.join(', ')}.` };
  }

  if (!session.availability.available) {
    // Still audited: the operation was requested and could not run.
    await recordRun(
      session.application,
      { operation: type, actorWorkspaceMemberId: session.actorWorkspaceMemberId, targetObject: 'lvLead', targetRecordId: session.context.lead.id, sourceRecordIds: [session.context.lead.id] },
      { status: 'UNAVAILABLE', promptVersion: PROMPT_VERSIONS[PROMPT_KEY[type]], provider: 'none', model: null, errorCode: 'AI_UNAVAILABLE', latencyMs: 0, startedAt: new Date().toISOString() },
    );

    return { ok: false, refusal: 'AI_UNAVAILABLE', code: 'AI_UNAVAILABLE', error: session.availability.reason, ai: session.availability, type };
  }

  const common = { provider: session.provider, application: session.application, context: session.context, actorWorkspaceMemberId: session.actorWorkspaceMemberId };

  try {
    switch (type) {
      case 'LEAD_SUMMARY': {
        const result = await generateLeadSummary(common);

        return { ...result, type, ai: session.availability, label: 'AI GENERATED' };
      }
      case 'CLASSIFICATION': {
        const result = await generateClassification(common);

        return { ...result, type, ai: session.availability, label: 'AI SUGGESTION' };
      }
      case 'CONVERSATION_SUMMARY': {
        if (!isUuid(input.interactionId)) {
          return { ok: false, refusal: 'INVALID_INPUT', error: 'interactionId must be a UUID.' };
        }

        const interaction = session.context.interactions.find((row) => row.id === input.interactionId) ?? null;

        if (!interaction) {
          return { ok: false, refusal: 'NOT_FOUND', error: 'That interaction is not one of this lead’s recent interactions, or is not accessible.' };
        }

        const result = await summarizeConversation(common, interaction);

        return { ...result, type, interactionId: interaction.id, ai: session.availability, label: 'AI GENERATED' };
      }
      case 'DRAFT': {
        const kind = typeof input.kind === 'string' && (DRAFT_KINDS as readonly string[]).includes(input.kind) ? (input.kind as DraftKind) : null;

        if (!kind) {
          return { ok: false, refusal: 'INVALID_INPUT', error: `kind must be one of ${DRAFT_KINDS.join(', ')}.` };
        }

        const tone = typeof input.tone === 'string' && (DRAFT_TONES as readonly string[]).includes(input.tone) ? input.tone : 'PROFESSIONAL';
        const instructions = typeof input.instructions === 'string' ? input.instructions.slice(0, 400) : null;
        const senderFirstName = await firstNameOf(session.delegated, session.actorWorkspaceMemberId);
        const result = await generateDraft(common, { kind, tone, senderFirstName, instructions });
        const channel = kind === 'WHATSAPP_FOLLOW_UP' ? 'WHATSAPP' : 'EMAIL';
        const telephonyCheck = assertOutboundTelephonyAllowed(session.context.lead, channel);
        const isSandbox = !telephonyCheck.allowed || isSandboxLead(session.context.lead);
        const transport = isSandbox ? 'NONE' : kind === 'WHATSAPP_FOLLOW_UP' ? 'NONE' : 'MANUAL_EMAIL';

        return {
          ...result,
          type,
          ai: session.availability,
          label: 'AI DRAFT',
          transport,
          ...(isSandbox ? { sandboxIsolation: { quarantined: true, reason: telephonyCheck.reason ?? 'Sandbox leads cannot reach external transports.' } } : {}),
        };
      }
      case 'ONBOARDING_ASSIST': {
        const field = typeof input.field === 'string' && /^[A-Z_]+\.[a-zA-Z]+$/.test(input.field) ? input.field : null;
        const text = typeof input.text === 'string' ? input.text.slice(0, 3_000) : null;
        const result = await assistOnboarding(common, { field, text });

        return { ...result, type, ai: session.availability, label: 'AI SUGGESTED' };
      }
      default:
        return { ok: false, refusal: 'INVALID_INPUT', error: 'Unsupported type.' };
    }
  } catch (error) {
    return internalError('lv-ai-lead-generate', error);
  }
};

const firstNameOf = async (delegated: { query: <T>(document: string, variables?: Record<string, unknown>, endpoint?: 'graphql' | 'metadata') => Promise<{ data: T }> }, memberId: string): Promise<string | null> => {
  try {
    const { data } = await delegated.query<{ workspaceMember?: { name?: { firstName?: string | null } | null } | null }>(
      `query($id: UUID!) { workspaceMember(filter: { id: { eq: $id } }) { name { firstName } } }`,
      { id: memberId },
    );

    return data.workspaceMember?.name?.firstName ?? null;
  } catch {
    return null;
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_AI_LEAD_GENERATE_ID,
  name: 'lv-ai-lead-generate',
  description: 'Runs one AI operation for a lead (summary, classification, conversation summary, draft, onboarding assistance) with provenance and audit',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: { path: '/ai/lead/generate', httpMethod: 'POST', isAuthRequired: true },
});
