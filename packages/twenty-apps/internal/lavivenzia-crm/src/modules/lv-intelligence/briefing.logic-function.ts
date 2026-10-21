import 'src/modules/lv-core/runtime/resilient-fetch';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_AI_BRIEFING_ID } from 'src/constants/universal-identifiers';
import { describeAiAvailability, readAiConfig } from 'src/modules/lv-ai/config/ai-config';
import { createAiProvider } from 'src/modules/lv-ai/provider/create-provider';
import { isRecord } from 'src/modules/lv-ai/provider/structured-output';
import { MORNING_BRIEFING_PROMPT } from 'src/modules/lv-ai/prompts/prompt-registry';
import { runPrompt } from 'src/modules/lv-ai/runtime/ai-runner';
import { applicationClient, delegatedClient } from 'src/modules/lv-ai/runtime/clients';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { clampTimeZoneOffset } from 'src/modules/lv-dashboard/metrics/definitions';
import { resolveCaller } from 'src/modules/lv-dashboard/services/caller-context';
import { buildDashboardSummary, type DashboardSummary } from 'src/modules/lv-dashboard/services/dashboard-summary';
import { describeError } from 'src/modules/lv-core/utils/describe-error';

// POST /ai/briefing { timeZoneOffsetMinutes? }
//
// The morning workspace. Numbers come from the Day 5 dashboard engine under
// the caller's own lens and permissions — deterministic, never from a model.
// The model, when configured, is asked only to PRIORITISE: pick the top
// actions from the facts and say why, citing record refs that exist. Without
// a provider the briefing is still complete: the same facts, ranked by a
// fixed rule (breaches, then overdue, then high-priority without a next
// step, then approvals).

// `skipModel` returns the same briefing without asking the model to reorder
// it. The deterministic half takes about a second and a half; the model adds
// twenty-five more, so Today asks for this first, renders it, and then asks
// again without the flag to fold the model's ranking in when it arrives.
// Nothing else about the response changes — same shape, same fields, and
// `narrative.status` still says plainly which produced it.
type Input = { timeZoneOffsetMinutes?: unknown; skipModel?: unknown };

type Ref = { ref: string; label: string; target: { object: string; recordId: string } };

type BriefingLine = { key: string; count: number; label: string; link: { object: string } | null };

const pick = (summary: DashboardSummary, key: string) => summary.actions.find((section) => section.key === key) ?? null;

const rowRef = (prefix: string, row: Record<string, unknown>): Ref | null => {
  const raw = isRecord(row.target) && typeof row.target.object === 'string' && typeof row.target.recordId === 'string' ? { object: row.target.object, recordId: row.target.recordId } : null;

  if (!raw) {
    return null;
  }

  // The app can open a lead, not a task: a follow-up (and any SLA or document
  // action) navigates to the lead it belongs to rather than a record with no
  // page of its own. `row.leadId` is the lead's own id - `row.lvLeadId` is only
  // its human code. The ref string keeps the original record id so two
  // follow-ups on one lead stay distinct.
  const leadId = typeof row.leadId === 'string' && row.leadId !== '' ? row.leadId : null;
  const target = raw.object === 'lvLead' || leadId === null ? raw : { object: 'lvLead', recordId: leadId };

  const label = String(row.lvLeadId ?? '') ? `${String(row.lvLeadId)} ${String(row.name ?? row.leadName ?? row.title ?? '')}`.trim() : String(row.title ?? row.name ?? raw.recordId);

  return { ref: `${prefix}:${raw.recordId}`, label, target };
};

export const buildBriefingFacts = (summary: DashboardSummary): { today: BriefingLine[]; candidates: { ref: Ref; reason: string; rank: number }[] } => {
  const kpi = (key: string) => summary.kpis.find((item) => item.key === key) ?? null;
  const today: BriefingLine[] = [];
  const add = (key: string, label: string) => {
    const item = kpi(key);

    if (item && item.value !== null) {
      today.push({ key, count: item.value, label, link: item.link ?? null });
    }
  };

  add('newToday', 'new leads today');
  add('overdueTasks', 'follow-ups overdue');
  add('overdue', 'follow-ups overdue');
  add('slaBreaches', 'SLA breaches');
  add('breached', 'onboarding SLA breaches');
  add('highPriority', 'high-priority leads');
  add('firstContact', 'leads awaiting first contact');
  add('review', 'onboardings ready for review');
  add('docPending', 'documents pending verification');
  add('awaiting', 'leads waiting for a response');
  add('stuck', 'stuck leads');

  const candidates: { ref: Ref; reason: string; rank: number }[] = [];
  const take = (sectionKey: string, prefix: string, reason: (row: Record<string, unknown>) => string, rank: number, limit = 3) => {
    const section = pick(summary, sectionKey);

    for (const row of section?.rows.slice(0, limit) ?? []) {
      const ref = rowRef(prefix, row);

      if (ref) {
        candidates.push({ ref, reason: reason(row), rank });
      }
    }
  };

  take('slaBreached', 'sla', (row) => `SLA ${String(row.rule ?? '')} is ${String(row.status ?? 'breached')}`, 1);
  take('breached', 'sla', (row) => `Onboarding SLA ${String(row.rule ?? '')} is ${String(row.status ?? 'breached')}`, 1);
  take('overdueFollowUps', 'task', (row) => `Follow-up "${String(row.title ?? '')}" is overdue`, 2);
  take('overdue', 'task', (row) => `Follow-up "${String(row.title ?? '')}" is overdue`, 2);
  take('highNoRecent', 'lead', () => 'High-priority lead with no interaction in 7 days', 3);
  take('noNextAction', 'lead', () => 'Open lead without a next action', 4, 2);
  take('approvals', 'onboarding', () => 'Onboarding waiting for your review', 3);
  take('rejectedDocs', 'document', () => 'Rejected document needs follow-up with the partner', 4, 2);
  take('firstContact', 'lead', () => 'Lead has not had a first contact', 4, 2);
  take('awaiting', 'lead', () => 'Waiting for the partner’s response', 5, 2);
  take('dueToday', 'task', (row) => `Due today: "${String(row.title ?? '')}"`, 3, 3);

  // De-duplicate by ref, keep the best rank.
  const seen = new Map<string, { ref: Ref; reason: string; rank: number }>();

  for (const candidate of candidates) {
    const existing = seen.get(candidate.ref.ref);

    if (!existing || candidate.rank < existing.rank) {
      seen.set(candidate.ref.ref, candidate);
    }
  }

  return { today: today.filter((line) => line.count > 0), candidates: [...seen.values()].sort((a, b) => a.rank - b.rank) };
};

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'The briefing is for signed-in team members.' };
  }

  try {
    const delegated = delegatedClient();
    const application = applicationClient();
    const caller = await resolveCaller(delegated);
    const now = new Date().toISOString();
    const summary = await buildDashboardSummary({ client: delegated, caller, lens: caller.lens, now, timeZoneOffsetMinutes: clampTimeZoneOffset(input.timeZoneOffsetMinutes) });
    const facts = buildBriefingFacts(summary);
    const config = readAiConfig();
    const availability = describeAiAvailability(config);
    type Action = { title: string; why: string; ref: Ref | null; origin: 'RULES' | 'MODEL' };
    const fallbackActions: Action[] = facts.candidates.slice(0, 5).map((candidate) => ({ title: candidate.ref.label, why: candidate.reason, ref: candidate.ref, origin: 'RULES' }));

    let headline = facts.today.length > 0 ? facts.today.slice(0, 4).map((line) => `${line.count} ${line.label}`).join(' · ') : 'Nothing is overdue or breached in your queue.';
    let topActions = fallbackActions;
    let narrative: { provider: string; model: string | null; promptVersion: string; status: string; code: string | null } = { provider: 'rules', model: null, promptVersion: 'briefing-rules-v1', status: 'RULES', code: null };

    if (input.skipModel !== true && availability.available && facts.candidates.length > 0) {
      const provider = createAiProvider(config);
      const contextText = [
        `Lens: ${summary.lens}. Today: ${now.slice(0, 10)}.`,
        'FACTS',
        ...facts.today.map((line) => `- ${line.count} ${line.label}`),
        'CANDIDATE ACTIONS (ref → what)',
        ...facts.candidates.slice(0, 12).map((candidate) => `- ${candidate.ref.ref} → ${candidate.ref.label}: ${candidate.reason}`),
      ].join('\n');
      const { result } = await runPrompt(provider, application, MORNING_BRIEFING_PROMPT, contextText, {
        operation: 'BRIEFING',
        actorWorkspaceMemberId,
        targetObject: 'workspaceMember',
        targetRecordId: actorWorkspaceMemberId,
        sourceRecordIds: facts.candidates.map((candidate) => candidate.ref.target.recordId),
        metadata: { lens: summary.lens },
      });

      if (result.ok) {
        const byRef = new Map(facts.candidates.map((candidate) => [candidate.ref.ref, candidate.ref]));
        const grounded: Action[] = result.value.topActions
          .map((action): Action => ({ title: action.title, why: action.why, ref: action.recordRef ? byRef.get(action.recordRef) ?? null : null, origin: 'MODEL' }))
          .filter((action) => action.ref !== null || !/[A-Z]{2}-\d{6}|#/.test(action.title));

        if (grounded.length > 0) {
          topActions = grounded;
          headline = result.value.headline;
        }

        narrative = { provider: result.provider, model: result.model, promptVersion: MORNING_BRIEFING_PROMPT.id, status: 'MODEL', code: null };
      } else {
        narrative = { provider: result.provider, model: result.model, promptVersion: MORNING_BRIEFING_PROMPT.id, status: 'UNAVAILABLE', code: result.code };
      }
    }

    return {
      ok: true,
      generatedAt: now,
      lens: summary.lens,
      ai: availability,
      today: facts.today,
      headline,
      topActions,
      narrative,
      notes: [
        'Counts and lists are computed by the CRM under your permissions; the model only orders them.',
        narrative.status === 'MODEL' ? 'Top actions were prioritised by the AI model — labelled AI GENERATED.' : 'Top actions are ranked by a fixed rule (breaches → overdue → high priority → approvals).',
      ],
    };
  } catch (error) {
    console.error('[lv-ai-briefing]', describeError(error));

    return { ok: false, error: 'The briefing could not be built. Please try again.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_AI_BRIEFING_ID,
  name: 'lv-ai-briefing',
  description: 'Morning briefing: deterministic dashboard facts under the caller’s permissions, optionally prioritised by the AI model',
  timeoutSeconds: 45,
  handler,
  httpRouteTriggerSettings: { path: '/ai/briefing', httpMethod: 'POST', isAuthRequired: true },
});
