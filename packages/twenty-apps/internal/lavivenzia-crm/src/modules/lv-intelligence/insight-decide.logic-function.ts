import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_AI_INSIGHT_DECIDE_ID } from 'src/constants/universal-identifiers';
import { type HumanDecision } from 'src/modules/lv-ai/objects/ai-insight.object';
import { PROBLEM_SEVERITIES, OBJECTION_CATEGORIES, SENTIMENTS } from 'src/modules/lv-ai/prompts/prompt-registry';
import { applicationClient, delegatedClient } from 'src/modules/lv-ai/runtime/clients';
import { findInsight, type InsightRow, recordDecision } from 'src/modules/lv-ai/runtime/insight-store';
import { isLeadCategory, LEAD_SUBCATEGORIES_BY_CATEGORY } from 'src/modules/lv-core/constants/lead-taxonomy';
import { isLeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';
import { isRecord } from 'src/modules/lv-ai/provider/structured-output';
import { type Recommendation } from 'src/modules/lv-intelligence/engines/next-best-action';
import { loadLeadContext } from 'src/modules/lv-intelligence/services/lead-context';
import { internalError, isUuid } from 'src/modules/lv-intelligence/services/route-support';

// POST /ai/insight/decide { insightId, decision, edits?, note?, candidateLeadId? }
//
// The ONE place an AI suggestion turns into a CRM change — and only by a
// person's explicit decision. What happens per insight type:
//
//   CLASSIFICATION      ACCEPTED / EDITED → lead category/subcategory written
//                       with the reviewer's own token (so their role decides)
//   NEXT_BEST_ACTION    ACCEPTED / EDITED → a task through the task system,
//                       assigned to the reviewer, linked to the lead
//   PROBLEM_SUGGESTION  ACCEPTED / EDITED → an lvProblem row, reporter =
//                       reviewer (application role writes it; the reviewer
//                       has just proven they can open the lead)
//   CONVERSATION_SUMMARY ACCEPTED / EDITED → sentiment / objections /
//                       commitments / next action / next follow-up written on
//                       the interaction with the reviewer's token
//   DUPLICATE           MERGED → the newer lead is marked DUPLICATE (the
//                       existing lifecycle policy; audited); IGNORED /
//                       CREATED_NEW → recorded, nothing changes
//   ONBOARDING_ASSIST   ACCEPTED / EDITED → the improved text saved into the
//                       onboarding answers with the reviewer's token
//   everything else     ACCEPTED / REJECTED / DISMISSED → recorded only
//
// Nothing here deletes, merges records field-by-field, reassigns, approves,
// or sends anything. Every decision is stored on the insight with the
// reviewer and time.

const DECISIONS: readonly HumanDecision[] = ['ACCEPTED', 'EDITED', 'REJECTED', 'DISMISSED', 'MERGED', 'IGNORED', 'CREATED_NEW'];

type Input = { insightId?: unknown; decision?: unknown; edits?: unknown; note?: unknown; candidateLeadId?: unknown };

const payloadOf = (insight: InsightRow): Record<string, unknown> => (isRecord(insight.payload) ? insight.payload : {});

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Decisions require a signed-in team member.' };
  }

  if (!isUuid(input.insightId)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'insightId must be a UUID.' };
  }

  const decision = typeof input.decision === 'string' && DECISIONS.includes(input.decision as HumanDecision) ? (input.decision as HumanDecision) : null;

  if (!decision) {
    return { ok: false, refusal: 'INVALID_INPUT', error: `decision must be one of ${DECISIONS.join(', ')}.` };
  }

  const edits = isRecord(input.edits) ? input.edits : {};
  const note = typeof input.note === 'string' ? input.note.slice(0, 500) : null;

  try {
    const application = applicationClient();
    const delegated = delegatedClient();
    const insight = await findInsight(application, input.insightId);

    if (!insight || !insight.leadId) {
      return { ok: false, refusal: 'NOT_FOUND', error: 'Insight not found.' };
    }

    // The reviewer must be able to open the lead the insight is about.
    const context = await loadLeadContext(delegated, application, insight.leadId);

    if (!context) {
      return { ok: false, refusal: 'NOT_FOUND', error: 'Insight not found or not accessible.' };
    }

    if (insight.status === 'AI_CONFIRMED' || insight.status === 'AI_REJECTED') {
      return { ok: false, refusal: 'ALREADY_DECIDED', error: `This suggestion was already ${insight.humanDecision?.toLowerCase() ?? 'decided'}.` };
    }

    const negative = decision === 'REJECTED' || decision === 'DISMISSED' || decision === 'IGNORED' || decision === 'CREATED_NEW';
    const payload = payloadOf(insight);
    let applied: Record<string, unknown> = {};

    if (!negative) {
      switch (insight.insightType) {
        case 'CLASSIFICATION': {
          const category = String(edits.category ?? payload.category ?? '');
          const subcategoryRaw = edits.subcategory === null ? null : String(edits.subcategory ?? payload.subcategory ?? '') || null;

          if (!isLeadCategory(category)) {
            return { ok: false, refusal: 'INVALID_INPUT', error: 'A valid category is required to accept the classification.' };
          }

          const subcategory = subcategoryRaw && (LEAD_SUBCATEGORIES_BY_CATEGORY[category] as readonly string[]).includes(subcategoryRaw) ? subcategoryRaw : null;
          const { errors } = await delegated.query(`mutation($id: UUID!, $data: LvLeadUpdateInput!) { updateLvLead(id: $id, data: $data) { id } }`, { id: context.lead.id, data: { category, subcategory } });

          if (errors.length > 0) {
            return { ok: false, refusal: 'NOT_PERMITTED', error: 'Your role cannot update this lead.' };
          }

          applied = { category, subcategory, previous: { category: context.lead.category, subcategory: context.lead.subcategory } };
          break;
        }
        case 'NEXT_BEST_ACTION': {
          const primary = isRecord(payload.primary) ? (payload.primary as unknown as Recommendation) : null;
          const proposed = primary?.proposedTask ?? null;
          const title = String(edits.title ?? proposed?.title ?? primary?.title ?? '').slice(0, 200);
          const dueAt = typeof edits.dueAt === 'string' && Number.isFinite(Date.parse(edits.dueAt)) ? new Date(edits.dueAt).toISOString() : proposed?.dueAt ?? primary?.suggestedDeadline ?? null;
          const priority = isLeadPriority(edits.priority) ? edits.priority : proposed?.priority ?? primary?.priority ?? 'MEDIUM';

          if (!title || !dueAt) {
            return { ok: false, refusal: 'INVALID_INPUT', error: 'A title and a due date are required to create the task.' };
          }

          const { data, errors } = await delegated.query<{ createTask?: { id: string } }>(`mutation($data: TaskCreateInput!) { createTask(data: $data) { id } }`, {
            data: { title, status: 'TODO', dueAt, assigneeId: actorWorkspaceMemberId, lvPriority: priority, bodyV2: { markdown: `Created from the AI next-best-action suggestion: ${primary?.reason ?? ''}` } },
          });

          if (!data.createTask) {
            return { ok: false, refusal: 'NOT_PERMITTED', error: errors[0]?.message ?? 'Your role cannot create tasks.' };
          }

          await delegated.query(`mutation($data: TaskTargetCreateInput!) { createTaskTarget(data: $data) { id } }`, { data: { taskId: data.createTask.id, targetLvLeadId: context.lead.id } });
          applied = { taskId: data.createTask.id, title, dueAt, priority };
          break;
        }
        case 'PROBLEM_SUGGESTION': {
          const type = String(edits.type ?? payload.type ?? 'OTHER');
          const severity = String(edits.severity ?? payload.severity ?? 'MEDIUM');
          const description = String(edits.description ?? payload.description ?? '').slice(0, 1_000);

          if (!description) {
            return { ok: false, refusal: 'INVALID_INPUT', error: 'A description is required.' };
          }

          const { data, errors } = await application.query<{ createLvProblem?: { id: string } }>(`mutation($data: LvProblemCreateInput!) { createLvProblem(data: $data) { id } }`, {
            data: {
              name: `${type} · ${description.slice(0, 80)}`,
              problemType: ([...OBJECTION_CATEGORIES, 'DATA_QUALITY'] as string[]).includes(type) ? type : 'OTHER',
              severity: (PROBLEM_SEVERITIES as readonly string[]).includes(severity) ? severity : 'MEDIUM',
              status: 'OPEN',
              description,
              rootCause: typeof (edits.rootCause ?? payload.rootCauseHypothesis) === 'string' ? String(edits.rootCause ?? payload.rootCauseHypothesis).slice(0, 1_000) : null,
              aiRecommendation: typeof payload.suggestedResolution === 'string' ? payload.suggestedResolution : null,
              leadId: context.lead.id,
              interactionId: isUuid(payload.interactionId) ? payload.interactionId : null,
              reporterId: actorWorkspaceMemberId,
              sourceInsightId: insight.id,
            },
          });

          if (!data.createLvProblem) {
            throw new Error(errors[0]?.message ?? 'Problem could not be created.');
          }

          applied = { problemId: data.createLvProblem.id };
          break;
        }
        case 'CONVERSATION_SUMMARY': {
          const interactionId = insight.targetRecordId;
          const interaction = context.interactions.find((row) => row.id === interactionId);

          if (!interaction) {
            return { ok: false, refusal: 'NOT_FOUND', error: 'The interaction is no longer accessible.' };
          }

          const objections = Array.isArray(payload.objections) ? payload.objections.filter(isRecord).map((item) => String(item.text ?? '')).filter(Boolean).join('; ') : '';
          const commitments = Array.isArray(payload.commitments) ? payload.commitments.filter(isRecord).map((item) => `${String(item.text ?? '')}${item.certainty === 'UNCERTAIN' ? ' (uncertain)' : ''}`).filter(Boolean).join('; ') : '';
          const sentiment = String(edits.sentiment ?? payload.sentiment ?? 'UNCLEAR');
          const data: Record<string, unknown> = {
            sentiment: (SENTIMENTS as readonly string[]).includes(sentiment) && sentiment !== 'UNCLEAR' ? sentiment : interaction.sentiment,
            objections: String(edits.objections ?? objections).slice(0, 1_000) || interaction.objections,
            commitments: String(edits.commitments ?? commitments).slice(0, 1_000) || interaction.commitments,
            nextAction: String(edits.nextAction ?? payload.nextAction ?? '').slice(0, 300) || interaction.nextAction,
          };
          const followUp = typeof edits.nextFollowUpAt === 'string' ? edits.nextFollowUpAt : typeof payload.followUpDateSuggestion === 'string' ? `${payload.followUpDateSuggestion}T12:30:00.000Z` : null;

          if (followUp && Number.isFinite(Date.parse(followUp))) {
            data.nextFollowUpAt = new Date(followUp).toISOString();
          }

          const { errors } = await delegated.query(`mutation($id: UUID!, $data: LvInteractionUpdateInput!) { updateLvInteraction(id: $id, data: $data) { id } }`, { id: interaction.id, data });

          if (errors.length > 0) {
            return { ok: false, refusal: 'NOT_PERMITTED', error: 'Your role cannot update this interaction.' };
          }

          applied = { interactionId: interaction.id, ...data };
          break;
        }
        case 'DUPLICATE': {
          if (decision !== 'MERGED') {
            break;
          }

          if (!isUuid(input.candidateLeadId)) {
            return { ok: false, refusal: 'INVALID_INPUT', error: 'candidateLeadId is required to merge.' };
          }

          const candidates = Array.isArray(payload.candidates) ? payload.candidates.filter(isRecord) : [];
          const candidate = candidates.find((item) => item.leadId === input.candidateLeadId) ?? null;

          if (!candidate) {
            return { ok: false, refusal: 'INVALID_INPUT', error: 'That lead is not one of the suggested duplicates.' };
          }

          // Twenty has no record merge for custom objects; "merge" is the
          // existing lifecycle policy — the newer record becomes DUPLICATE
          // pointing at the survivor — performed with the reviewer's token
          // and written to the governance audit like any MARK_DUPLICATE.
          const survivorIsCandidate = candidate.suggestedMergeTarget !== 'THIS';
          const duplicateId = survivorIsCandidate ? context.lead.id : String(candidate.leadId);
          const survivorId = survivorIsCandidate ? String(candidate.leadId) : context.lead.id;
          const { errors } = await delegated.query(`mutation($id: UUID!, $data: LvLeadUpdateInput!) { updateLvLead(id: $id, data: $data) { id } }`, { id: duplicateId, data: { status: 'DUPLICATE' } });

          if (errors.length > 0) {
            return { ok: false, refusal: 'NOT_PERMITTED', error: 'Your role cannot mark that lead as a duplicate.' };
          }

          await writeAuditEvent(new CoreApiClient({ runAs: 'application' }), {
            action: 'MARK_DUPLICATE',
            outcome: 'APPLIED',
            targetObject: 'lvLead',
            targetRecordId: duplicateId,
            targetLabel: duplicateId === context.lead.id ? `${context.lead.lvLeadId ?? ''} ${context.lead.name ?? ''}`.trim() : `${String(candidate.lvLeadId ?? '')} ${String(candidate.name ?? '')}`.trim(),
            actorWorkspaceMemberId,
            at: new Date().toISOString(),
            reason: note ?? `Duplicate of ${survivorId} confirmed from the AI duplicate suggestion (${String(candidate.percent)}%).`,
            metadata: { mergedInto: survivorId, similarity: candidate.percent, matchingFields: candidate.matchingFields, sourceInsightId: insight.id },
          });
          applied = { duplicateId, survivorId, softMerge: true };
          break;
        }
        case 'ONBOARDING_ASSIST': {
          const improved = String(edits.text ?? payload.improvedText ?? '').slice(0, 3_000);
          const field = typeof edits.field === 'string' ? edits.field : typeof (insight.fingerprint ?? '').split('|')[0] === 'string' ? (insight.fingerprint ?? '').split('|')[0] : null;
          const match = field?.match(/^([A-Z_]+)\.([a-zA-Z]+)$/) ?? null;

          if (!context.onboarding || !improved || !match) {
            return { ok: false, refusal: 'INVALID_INPUT', error: 'Accepting requires an onboarding, a field (STEP.field) and the text to save.' };
          }

          const [, step, key] = match;
          const answers = { ...(context.onboarding.answers ?? {}) } as Record<string, Record<string, unknown>>;

          answers[step] = { ...(answers[step] ?? {}), [key]: improved };

          const { errors } = await delegated.query(`mutation($id: UUID!, $data: LvOnboardingUpdateInput!) { updateLvOnboarding(id: $id, data: $data) { id } }`, { id: context.onboarding.id, data: { answers } });

          if (errors.length > 0) {
            return { ok: false, refusal: 'NOT_PERMITTED', error: 'Your role cannot update this onboarding.' };
          }

          applied = { onboardingId: context.onboarding.id, field, previous: context.onboarding.answers?.[step]?.[key] ?? null };
          break;
        }
        default:
          break;
      }
    }

    const status = negative ? 'AI_REJECTED' : 'AI_CONFIRMED';

    await recordDecision(application, insight.id, { humanDecision: decision, status, reviewerId: actorWorkspaceMemberId, note, payload: Object.keys(applied).length > 0 ? { ...payload, applied, edits } : undefined });

    return { ok: true, insightId: insight.id, insightType: insight.insightType, decision, status, applied };
  } catch (error) {
    return internalError('lv-ai-insight-decide', error);
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_AI_INSIGHT_DECIDE_ID,
  name: 'lv-ai-insight-decide',
  description: 'Records a human decision on an AI insight and applies it (classification, task, problem, interaction fields, duplicate) with the reviewer’s own permissions',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: { path: '/ai/insight/decide', httpMethod: 'POST', isAuthRequired: true },
});
