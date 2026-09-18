import 'src/modules/lv-core/runtime/resilient-fetch';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_COPILOT_ASK_ID } from 'src/constants/universal-identifiers';
import { describeAiAvailability, readAiConfig } from 'src/modules/lv-ai/config/ai-config';
import { createAiProvider } from 'src/modules/lv-ai/provider/create-provider';
import { recordRun } from 'src/modules/lv-ai/runtime/ai-runner';
import { applicationClient, delegatedClient } from 'src/modules/lv-ai/runtime/clients';
import { type Answer, answerRecordQuestion, deterministicAnswer, detectOrModelIntent, executePlan, modelNarrative, resolveLeadRef, storeProposal } from 'src/modules/lv-copilot/services/copilot';
import { validatePlan } from 'src/modules/lv-copilot/query/validate-plan';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { buildBriefingFacts } from 'src/modules/lv-intelligence/briefing.logic-function';
import { clampTimeZoneOffset } from 'src/modules/lv-dashboard/metrics/definitions';
import { resolveCaller } from 'src/modules/lv-dashboard/services/caller-context';
import { buildDashboardSummary } from 'src/modules/lv-dashboard/services/dashboard-summary';
import { describeError } from 'src/modules/lv-core/utils/describe-error';

// POST /copilot/ask { question, timeZoneOffsetMinutes? }
//
// Question → intent → validated plan → query as the caller → answer. The
// session is the only identity: "act as admin" in the text changes nothing,
// an ownerId in the text is never used, and every row comes from a query the
// platform ran under the caller's role and CM-004. Consequential requests
// come back as a proposal to confirm, or as a refusal that explains the
// human path.

type Input = { question?: unknown; timeZoneOffsetMinutes?: unknown };

const EMPTY: Answer = { known: [], inferred: [], suggested: [] };

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'The Copilot is for signed-in team members.' };
  }

  const question = typeof input.question === 'string' ? input.question.trim().slice(0, 500) : '';

  if (question.length < 2) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'Ask a question.' };
  }

  const startedAt = new Date().toISOString();
  const started = Date.now();

  try {
    const delegated = delegatedClient();
    const application = applicationClient();
    const config = readAiConfig();
    const availability = describeAiAvailability(config);
    const provider = availability.available ? createAiProvider(config) : null;
    const { intent, source } = await detectOrModelIntent(question, provider, application, actorWorkspaceMemberId);
    const ai = { available: availability.available, reason: availability.reason };
    const audit = async (status: 'SUCCESS' | 'REFUSED' | 'PROPOSED', metadata: Record<string, unknown>, sourceRecordIds: string[] = []) =>
      recordRun(
        application,
        { operation: 'COPILOT_ASK', actorWorkspaceMemberId, targetObject: null, targetRecordId: null, sourceRecordIds, metadata: { intent: intent.kind, intentSource: source, ...metadata } },
        { status, promptVersion: 'copilot-rules-v1', provider: source === 'MODEL' ? provider?.name ?? 'rules' : 'rules', model: source === 'MODEL' ? provider?.model ?? null : null, latencyMs: Date.now() - started, startedAt },
      );
    const base = { ok: true as const, intentSource: source, plan: null, rows: [], totalCount: null, answer: EMPTY, answerOrigin: 'RULES' as const, proposal: null, refusal: null, ai, notes: [] as string[] };

    switch (intent.kind) {
      case 'REFUSED': {
        await audit('REFUSED', { reason: intent.reason });

        return { ...base, intent: 'REFUSED', title: 'Not possible', refusal: intent.reason, answer: { known: ['You are signed in with your own role; the Copilot cannot change that.'], inferred: [], suggested: [] } };
      }
      case 'UNKNOWN': {
        await audit('REFUSED', { reason: 'unrecognised' });

        return {
          ...base,
          intent: 'UNSUPPORTED',
          title: 'I did not understand that',
          answer: {
            known: [],
            inferred: [],
            suggested: [
              'Try: "Show me my overdue leads", "Which leads are waiting for a response?", "Which onboarding records have missing documents?", "What happened with LV-000003?", "Which leads are interested but have no next action?", "Show me SLA breaches", "What should I work on today?", "Show me high-priority leads in Pune".',
              ...(ai.available ? [] : ['Free-form phrasing needs the AI provider, which is not configured; the examples above always work.']),
            ],
          },
        };
      }
      case 'BRIEFING': {
        const caller = await resolveCaller(delegated);
        const summary = await buildDashboardSummary({ client: delegated, caller, lens: caller.lens, now: new Date().toISOString(), timeZoneOffsetMinutes: clampTimeZoneOffset(input.timeZoneOffsetMinutes) });
        const facts = buildBriefingFacts(summary);
        const rows = facts.candidates.slice(0, 10).map((candidate) => ({ id: candidate.ref.target.recordId, ref: null, title: candidate.ref.label, subtitle: candidate.reason, target: candidate.ref.target }));

        await audit('SUCCESS', { lens: summary.lens }, rows.map((row) => row.id));

        return {
          ...base,
          intent: 'BRIEFING',
          title: 'What to work on today',
          rows,
          totalCount: rows.length,
          answer: {
            known: facts.today.slice(0, 6).map((line) => `${line.count} ${line.label}.`),
            inferred: [],
            suggested: rows.slice(0, 3).map((row) => `${row.title}: ${row.subtitle}`),
          },
          notes: ['Ranked by a fixed rule: breaches → overdue → high priority → approvals. The full briefing is on the Copilot page.'],
        };
      }
      case 'RECORD_QUESTION': {
        const context = await resolveLeadRef(delegated, application, intent.recordRef);

        if (!context) {
          await audit('REFUSED', { reason: 'record not accessible', ref: intent.recordRef });

          return { ...base, intent: 'RECORD_QUESTION', title: intent.recordRef, refusal: `${intent.recordRef} was not found among the leads you can read.`, answer: { known: [`No lead ${intent.recordRef} is visible to you.`], inferred: ['It may not exist, or it may belong to another team member’s private pipeline.'], suggested: [] } };
        }

        const answer = answerRecordQuestion(context, intent.question);

        await audit('SUCCESS', { ref: intent.recordRef }, [context.lead.id]);

        return {
          ...base,
          intent: 'RECORD_QUESTION',
          title: `${context.lead.lvLeadId ?? ''} ${context.lead.name ?? ''}`.trim(),
          rows: [{ id: context.lead.id, ref: context.lead.lvLeadId, title: context.lead.name ?? 'Lead', subtitle: context.lead.status, target: { object: 'lvLead', recordId: context.lead.id } }],
          totalCount: 1,
          answer,
          notes: ['Answered from the lead’s own records (facts) and the rules engines (suggestions). Pricing, availability and certification come only from partner-provided data.'],
        };
      }
      case 'ACTION': {
        const action = intent.action;

        if (action.kind === 'UNSUPPORTED_ACTION') {
          await audit('REFUSED', { verb: action.verb });

          return { ...base, intent: 'ACTION', title: 'Needs a person', refusal: action.whyNot, answer: { known: [], inferred: [], suggested: [action.whyNot] } };
        }

        const context = await resolveLeadRef(delegated, application, action.recordRef);

        if (!context) {
          await audit('REFUSED', { reason: 'record not accessible', ref: action.recordRef });

          return { ...base, intent: 'ACTION', title: action.recordRef, refusal: `${action.recordRef} was not found among the leads you can read.` };
        }

        const label = `${context.lead.lvLeadId ?? ''} ${context.lead.name ?? ''}`.trim();
        const summary =
          action.kind === 'CREATE_TASK'
            ? `Create a follow-up task for ${label}, due ${action.dueIn === 'today' ? 'today' : action.dueIn === 'tomorrow' ? 'tomorrow' : `in ${action.dueIn.replace('d', ' days')}`}${action.title ? `, titled "${action.title}"` : ''}, assigned to you.`
            : `Add a note on ${label}${action.title ? `: "${action.title}"` : ''}.`;
        const stored = await storeProposal(application, actorWorkspaceMemberId, action, summary, context.lead.id);

        await audit('PROPOSED', { kind: action.kind, proposalId: stored?.proposalId ?? null }, [context.lead.id]);

        return {
          ...base,
          intent: 'ACTION',
          title: 'Confirm to proceed',
          rows: [{ id: context.lead.id, ref: context.lead.lvLeadId, title: context.lead.name ?? 'Lead', subtitle: context.lead.status, target: { object: 'lvLead', recordId: context.lead.id } }],
          totalCount: 1,
          answer: { known: [], inferred: [], suggested: [summary] },
          proposal: stored ? { proposalId: stored.proposalId, summary, action, expiresAt: stored.expiresAt } : null,
          notes: ['Nothing has been created yet. Confirm and the CRM executes it with your permissions.'],
        };
      }
      case 'QUERY': {
        // Every plan — the rule engine's included — goes through the same
        // allowlist validation, which also resolves relative dates.
        const validation = validatePlan(intent.plan);

        if (!validation.ok) {
          await audit('REFUSED', { reason: validation.reason });

          return { ...base, intent: 'REFUSED', title: 'Not possible', refusal: `That query is outside what the Copilot may run: ${validation.reason}` };
        }

        const plan = validation.plan;
        const { rows, totalCount } = await executePlan(delegated, plan, actorWorkspaceMemberId);
        let answer = deterministicAnswer(plan, rows, totalCount);
        let answerOrigin: 'RULES' | 'MODEL' = 'RULES';

        if (provider && rows.length > 0) {
          const narrative = await modelNarrative(provider, application, question, rows, actorWorkspaceMemberId);

          if (narrative && narrative.known.length > 0) {
            answer = { known: [answer.known[0]!, ...narrative.known].slice(0, 4), inferred: narrative.inferred, suggested: narrative.suggested.length > 0 ? narrative.suggested : answer.suggested };
            answerOrigin = 'MODEL';
          }
        }

        await audit('SUCCESS', { object: plan.object, filters: plan.filters.length, totalCount }, rows.map((row) => row.id));

        return { ...base, intent: source === 'MODEL' ? 'QUERY_MODEL' : 'QUERY', title: intent.title, plan, rows, totalCount, answer, answerOrigin, notes: ['Rows come from a structured query run under your permissions (CM-004 applies at execution).'] };
      }
      default:
        return { ...base, intent: 'UNSUPPORTED', title: 'Unsupported' };
    }
  } catch (error) {
    console.error('[lv-copilot-ask]', describeError(error));

    return { ok: false, error: 'The Copilot could not answer. Please try again.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_COPILOT_ASK_ID,
  name: 'lv-copilot-ask',
  description: 'Permission-aware CRM Copilot: natural language → allowlisted structured query under the caller’s own role; writes only as confirmable proposals',
  timeoutSeconds: 45,
  handler,
  httpRouteTriggerSettings: { path: '/copilot/ask', httpMethod: 'POST', isAuthRequired: true },
});
