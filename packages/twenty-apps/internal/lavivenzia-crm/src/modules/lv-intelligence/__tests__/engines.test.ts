import { describe, expect, it } from 'vitest';

import { type AiProvider, type AiResult } from 'src/modules/lv-ai/provider/ai-provider';
import { type GraphqlClient } from 'src/modules/lv-ai/runtime/clients';
import { fingerprintOf } from 'src/modules/lv-ai/runtime/insight-store';
import { assessDataQuality } from 'src/modules/lv-intelligence/engines/data-quality';
import { scanDuplicates } from 'src/modules/lv-intelligence/engines/duplicate-scan';
import { deriveLeadFacts } from 'src/modules/lv-intelligence/engines/lead-facts';
import { recommendNextBestAction } from 'src/modules/lv-intelligence/engines/next-best-action';
import { isHighOpportunity, scoreOpportunity, STAGE_POINTS } from 'src/modules/lv-intelligence/engines/opportunity-score';
import { assessRelationshipHealth } from 'src/modules/lv-intelligence/engines/relationship-health';
import { type InteractionRecord, type LeadContext, sourceRecordIds } from 'src/modules/lv-intelligence/services/lead-context';
import { computeDeterministicInsights } from 'src/modules/lv-intelligence/services/lead-intelligence';
import { classificationContext, summaryContext } from 'src/modules/lv-intelligence/services/model-context';
import { generateLeadSummary } from 'src/modules/lv-intelligence/services/model-operations';

// The deterministic engines against hand-built contexts, and the two
// properties the brief cares most about: nothing is invented, and a page
// view of an unchanged lead costs no writes.

const NOW = '2026-09-12T10:00:00.000Z';
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.parse(NOW) - days * DAY).toISOString();

const lead = (overrides: Partial<LeadContext['lead']> = {}): LeadContext['lead'] => ({
  id: 'lead-1',
  lvLeadId: 'LV-000101',
  name: 'Hilltop Retreat',
  organisationName: 'Hilltop Retreat',
  category: 'STAY',
  subcategory: null,
  location: 'Lonavala',
  source: 'WEBSITE',
  captureMode: 'MANUAL',
  status: 'INTERESTED',
  priority: 'HIGH',
  ownerId: 'member-1',
  assignedAt: ago(20),
  emails: { primaryEmail: 'host@hilltop.in' },
  phones: { primaryPhoneNumber: '+919999999999' },
  website: null,
  instagram: null,
  languages: null,
  opportunityScore: null,
  dataCompleteness: 80,
  lastInteractionAt: ago(2),
  nextAction: 'Send proposal',
  nextFollowUpAt: new Date(Date.parse(NOW) + 2 * DAY).toISOString(),
  onboardingStatus: null,
  rawCaptureInput: null,
  duplicateKeys: ['email:host@hilltop.in', 'name:hilltop retreat|lonavala'],
  createdAt: ago(30),
  updatedAt: ago(1),
  ...overrides,
});

const interaction = (overrides: Partial<InteractionRecord> = {}): InteractionRecord => ({
  id: 'int-1',
  name: 'Call',
  channel: 'PHONE',
  direction: 'INBOUND',
  occurredAt: ago(2),
  actorId: 'member-1',
  purpose: null,
  summary: 'Partner is keen, asked about commission and wants a site visit next week.',
  sentiment: 'POSITIVE',
  outcome: 'INTERESTED',
  objections: null,
  commitments: null,
  nextAction: null,
  nextFollowUpAt: null,
  durationMinutes: 15,
  ...overrides,
});

const context = (overrides: Partial<LeadContext> = {}): LeadContext => ({
  lead: lead(),
  interactions: [interaction(), interaction({ id: 'int-0', direction: 'OUTBOUND', occurredAt: ago(9), summary: 'Intro call', sentiment: 'NEUTRAL', outcome: 'INFORMATION_SHARED' })],
  tasks: [],
  notes: [],
  slas: [],
  onboarding: null,
  problems: [],
  loadedAt: NOW,
  ...overrides,
});

describe('opportunity score v1', () => {
  it('scores an engaged, complete lead from documented factors and explains every point', () => {
    const result = scoreOpportunity(deriveLeadFacts(context(), NOW));

    expect(result.available).toBe(true);

    if (result.available) {
      // stage 28 + responsiveness 12 (one inbound) + recency 15 + qualification 12 + follow-up 6 = 73
      expect(result.score).toBe(73);
      expect(result.positive.map((factor) => factor.factor)).toEqual(['Funnel stage', 'Responsiveness', 'Recency', 'Qualification data', 'Next follow-up scheduled']);
      expect(result.negative).toEqual([]);
      expect(result.missing).toEqual([]);
      expect(result.rulesVersion).toBe('opportunity-score-v1');
      expect(isHighOpportunity(result.score)).toBe(true);
    }
  });

  it('refuses to score a bare lead (no interaction, no completeness) — SCORE_UNAVAILABLE', () => {
    const result = scoreOpportunity(deriveLeadFacts(context({ lead: lead({ status: 'NEW', dataCompleteness: null, nextFollowUpAt: null, lastInteractionAt: null }), interactions: [] }), NOW));

    expect(result).toMatchObject({ available: false, reason: 'SCORE_UNAVAILABLE' });
    expect(result.available ? [] : result.missing).toContain('first interaction');
  });

  it('does not score closed or archived leads', () => {
    expect(scoreOpportunity(deriveLeadFacts(context({ lead: lead({ status: 'LOST' }) }), NOW))).toMatchObject({ available: false });
    expect(scoreOpportunity(deriveLeadFacts(context({ lead: lead({ status: 'DORMANT' }) }), NOW))).toMatchObject({ available: false });
  });

  it('penalises breached SLAs, overdue follow-ups, silence and missing contact, capped at 25', () => {
    const facts = deriveLeadFacts(
      context({
        lead: lead({ emails: null, phones: null, nextFollowUpAt: ago(3) }),
        interactions: [interaction({ direction: 'OUTBOUND', outcome: 'AWAITING_RESPONSE', occurredAt: ago(10) })],
        tasks: [{ id: 't1', title: 'Call back', status: 'TODO', dueAt: ago(4), assigneeId: 'member-1', lvPriority: 'HIGH', lvSourceInteractionId: null, createdAt: ago(6) }],
        slas: [{ id: 's1', name: 'x', rule: 'INTERESTED_FOLLOW_UP', status: 'BREACHED', dueAt: ago(1), breachedAt: ago(1), resolvedAt: null, escalationBlockedReason: null }],
      }),
      NOW,
    );
    const result = scoreOpportunity(facts);

    expect(result.available).toBe(true);

    if (result.available) {
      expect(result.negative.map((factor) => factor.factor)).toEqual(['SLA breached', 'Overdue follow-up', 'Waiting for response', 'No contact channel']);
      // 28 + 4 + 7 + 12 + 0 − 25 = 26
      expect(result.score).toBe(26);
      expect(result.missing).toContain('email or phone');
    }
  });

  it('never exceeds 100 or drops below 0', () => {
    for (const status of Object.keys(STAGE_POINTS)) {
      const result = scoreOpportunity(deriveLeadFacts(context({ lead: lead({ status, dataCompleteness: 100 }), interactions: [interaction(), interaction({ id: 'i2' })] }), NOW));

      if (result.available) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('relationship health v1', () => {
  it('UNKNOWN with no interaction — silence is not a diagnosis', () => {
    const result = assessRelationshipHealth(deriveLeadFacts(context({ interactions: [] }), NOW));

    expect(result.state).toBe('UNKNOWN');
    expect(result.reasons[0]?.reason).toMatch(/No interaction/);
  });

  it('HEALTHY with recent positive engagement and a plan', () => {
    const result = assessRelationshipHealth(deriveLeadFacts(context(), NOW));

    expect(result.state).toBe('HEALTHY');
    expect(result.positives.map((reason) => reason.reason)).toContain('Recent positive interaction');
  });

  it('AT_RISK on a breached SLA or recorded negative sentiment, with the evidence ids', () => {
    const breached = assessRelationshipHealth(deriveLeadFacts(context({ slas: [{ id: 's1', name: 'x', rule: 'NEW_LEAD_CONTACT', status: 'ESCALATED', dueAt: ago(2), breachedAt: ago(2), resolvedAt: null, escalationBlockedReason: null }] }), NOW));

    expect(breached.state).toBe('AT_RISK');
    expect(breached.reasons[0]).toMatchObject({ reason: 'SLA breached', recordIds: ['s1'] });

    const negative = assessRelationshipHealth(deriveLeadFacts(context({ interactions: [interaction({ sentiment: 'NEGATIVE' })] }), NOW));

    expect(negative.state).toBe('AT_RISK');
  });

  it('ATTENTION on overdue follow-up or long wait; DORMANT after 60 days or when closed', () => {
    const overdue = assessRelationshipHealth(deriveLeadFacts(context({ tasks: [{ id: 't1', title: 'Call', status: 'TODO', dueAt: ago(2), assigneeId: 'm', lvPriority: null, lvSourceInteractionId: null, createdAt: ago(5) }] }), NOW));

    expect(overdue.state).toBe('ATTENTION');

    const quiet = assessRelationshipHealth(deriveLeadFacts(context({ interactions: [interaction({ occurredAt: ago(75) })], lead: lead({ lastInteractionAt: ago(75) }) }), NOW));

    expect(quiet.state).toBe('DORMANT');
    expect(assessRelationshipHealth(deriveLeadFacts(context({ lead: lead({ status: 'NOT_INTERESTED' }) }), NOW)).state).toBe('DORMANT');
  });
});

describe('next best action v1', () => {
  it('a breached SLA outranks everything', () => {
    const result = recommendNextBestAction(deriveLeadFacts(context({ slas: [{ id: 's1', name: 'x', rule: 'NEW_LEAD_CONTACT', status: 'BREACHED', dueAt: ago(1), breachedAt: ago(1), resolvedAt: null, escalationBlockedReason: null }] }), NOW));

    expect(result.primary).toMatchObject({ action: 'ESCALATE', priority: 'CRITICAL', confidence: 'HIGH', targetRecordId: 's1' });
  });

  it('overdue task → FOLLOW_UP on that task with HIGH confidence and today as deadline', () => {
    const result = recommendNextBestAction(deriveLeadFacts(context({ tasks: [{ id: 't1', title: 'Send brochure', status: 'TODO', dueAt: ago(3), assigneeId: 'm', lvPriority: 'MEDIUM', lvSourceInteractionId: null, createdAt: ago(5) }] }), NOW));

    expect(result.primary).toMatchObject({ action: 'FOLLOW_UP', targetObject: 'task', targetRecordId: 't1', confidence: 'HIGH', deadlineLabel: 'Today' });
    expect(result.primary?.evidenceRecordIds).toEqual(['t1']);
  });

  it('partner replied and nothing is planned → FOLLOW_UP (MEDIUM) with a proposed task', () => {
    const result = recommendNextBestAction(deriveLeadFacts(context({ lead: lead({ nextFollowUpAt: null, nextAction: null }) }), NOW));

    expect(result.primary).toMatchObject({ action: 'FOLLOW_UP', confidence: 'MEDIUM' });
    expect(result.primary?.proposedTask?.title).toMatch(/Follow up with LV-000101/);
  });

  it('never contacted → CONTACT_LEAD; no contact data → UPDATE_CONTACT_DATA first', () => {
    const fresh = recommendNextBestAction(deriveLeadFacts(context({ lead: lead({ status: 'ASSIGNED', lastInteractionAt: null }), interactions: [] }), NOW));

    expect(fresh.primary?.action).toBe('CONTACT_LEAD');

    const noContact = recommendNextBestAction(deriveLeadFacts(context({ lead: lead({ status: 'ASSIGNED', emails: null, phones: null, lastInteractionAt: null }), interactions: [] }), NOW));

    expect(noContact.primary?.action).toBe('UPDATE_CONTACT_DATA');
    expect(noContact.alternatives.map((alternative) => alternative.action)).toContain('CONTACT_LEAD');
  });

  it('waits when a response is pending only a few days; nudges after five', () => {
    const waiting = recommendNextBestAction(deriveLeadFacts(context({ lead: lead({ nextFollowUpAt: null }), interactions: [interaction({ direction: 'OUTBOUND', outcome: 'AWAITING_RESPONSE', occurredAt: ago(2) })] }), NOW));

    expect(waiting.primary?.action).toBe('WAIT_FOR_RESPONSE');

    const nudge = recommendNextBestAction(deriveLeadFacts(context({ lead: lead({ nextFollowUpAt: null }), interactions: [interaction({ direction: 'OUTBOUND', outcome: 'AWAITING_RESPONSE', occurredAt: ago(8) })] }), NOW));

    expect(nudge.primary).toMatchObject({ action: 'FOLLOW_UP', title: expect.stringMatching(/no reply/i) });
  });

  it('onboarding documents drive REQUEST_DOCUMENT / REVIEW_DOCUMENT; closed leads get nothing', () => {
    const onboarding: LeadContext['onboarding'] = { id: 'ob1', name: 'x', status: 'INTERNAL_REVIEW', currentStep: null, progressPercentage: 80, reviewerId: 'r', submittedAt: ago(1), updatedAt: ago(1), answers: null, documents: [{ id: 'd1', name: 'ID', documentType: 'IDENTITY', verificationState: 'PENDING', expiresAt: null, rejectionReason: null }] };
    const review = recommendNextBestAction(deriveLeadFacts(context({ onboarding }), NOW));

    expect(review.primary?.action).toBe('REVIEW_DOCUMENT');
    expect(recommendNextBestAction(deriveLeadFacts(context({ lead: lead({ status: 'LOST' }) }), NOW)).primary).toBeNull();
  });
});

describe('data quality v1', () => {
  it('flags missing contact, malformed website, stale lead and contradictions with corrections', () => {
    const ctx = context({
      lead: lead({ emails: { primaryEmail: 'not-an-email' }, phones: null, website: { primaryLinkUrl: 'htp:/broken' }, organisationName: ' Hilltop  Retreat ', status: 'ENGAGED', lastInteractionAt: ago(40), nextFollowUpAt: null, nextAction: null }),
      interactions: [interaction({ occurredAt: ago(40) })],
    });
    const result = assessDataQuality(ctx, deriveLeadFacts(ctx, NOW));
    const codes = result.issues.map((issue) => issue.code);

    expect(codes).toEqual(expect.arrayContaining(['MISSING_PHONE', 'MALFORMED_EMAIL', 'MALFORMED_WEBSITE', 'INCONSISTENT_ORGANISATION', 'STALE_LEAD', 'MISSING_NEXT_ACTION', 'MISSING_NEXT_FOLLOW_UP']));
    expect(result.issues.every((issue) => issue.target.recordId && issue.evidence && issue.recommendedCorrection)).toBe(true);
    expect(result.score).toBeLessThan(50);

    const live = context({ lead: lead({ status: 'LIVE_ACTIVE' }) });

    expect(assessDataQuality(live, deriveLeadFacts(live, NOW)).issues.map((issue) => issue.code)).toContain('CONTRADICTORY_STATUS');
  });

  it('a clean lead has no issues and a score of 100', () => {
    const ctx = context();

    expect(assessDataQuality(ctx, deriveLeadFacts(ctx, NOW))).toMatchObject({ issues: [], score: 100 });
  });
});

describe('duplicate intelligence v1', () => {
  it('shortlists by duplicate keys / name and ranks with the Day 1 engine; older record is the merge target', async () => {
    const delegated: GraphqlClient = {
      query: async <T,>(): Promise<{ data: T; errors: never[] }> => ({
        data: {
          lvLeads: {
            edges: [
              { node: { id: 'lead-2', lvLeadId: 'LV-000050', name: 'Hilltop Retreat Lonavala', organisationName: null, location: 'Lonavala', status: 'NEW', ownerId: 'm2', createdAt: ago(90), emails: { primaryEmail: 'host@hilltop.in' }, phones: null, website: null, instagram: null } },
              { node: { id: 'lead-3', lvLeadId: 'LV-000051', name: 'Hill Station Tours', organisationName: null, location: 'Pune', status: 'NEW', ownerId: 'm2', createdAt: ago(10), emails: null, phones: null, website: null, instagram: null } },
            ],
          },
        } as T,
        errors: [],
      }),
    };
    const result = await scanDuplicates(delegated, lead(), NOW);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ leadId: 'lead-2', strength: 'STRONG', suggestedMergeTarget: 'CANDIDATE' });
    expect(result.candidates[0]?.matchingFields).toContain('email');
    expect(result.candidates[0]?.percent).toBe(100);
  });
});

// A minimal in-memory application client for the insight store and run
// audit, so the persistence rules can be tested without a database.
const fakeApplication = () => {
  const insights: Record<string, unknown>[] = [];
  const runs: Record<string, unknown>[] = [];
  const leadUpdates: unknown[] = [];
  let seq = 0;
  const client: GraphqlClient = {
    query: async <T,>(document: string, variables: Record<string, unknown> = {}): Promise<{ data: T; errors: never[] }> => {
      if (document.includes('lvAiInsights(')) {
        return { data: { lvAiInsights: { edges: insights.map((node) => ({ node })) } } as T, errors: [] };
      }

      if (document.includes('createLvAiInsight(')) {
        const row = { id: `ins-${(seq += 1)}`, ...(variables.data as Record<string, unknown>) };

        insights.push(row);

        return { data: { createLvAiInsight: row } as T, errors: [] };
      }

      if (document.includes('updateLvAiInsight(')) {
        const row = insights.find((item) => item.id === variables.id)!;

        Object.assign(row, variables.data as Record<string, unknown>);

        return { data: { updateLvAiInsight: row } as T, errors: [] };
      }

      if (document.includes('createLvAiRun(')) {
        runs.push(variables.data as Record<string, unknown>);

        return { data: { createLvAiRun: { id: `run-${runs.length}` } } as T, errors: [] };
      }

      if (document.includes('updateLvLead(')) {
        leadUpdates.push(variables.data);

        return { data: { updateLvLead: { id: 'lead-1' } } as T, errors: [] };
      }

      return { data: {} as T, errors: [] };
    },
  };

  return { client, insights, runs, leadUpdates };
};

describe('deterministic insight persistence (cost control)', () => {
  it('writes once, mirrors the score, then costs nothing while the facts are unchanged', async () => {
    const app = fakeApplication();
    const ctx = context();
    const first = await computeDeterministicInsights({ context: ctx, delegated: app.client, application: app.client, actorWorkspaceMemberId: 'member-1', includeDuplicates: false, now: NOW });

    expect(first.persisted.sort()).toEqual(['DATA_QUALITY', 'NEXT_BEST_ACTION', 'OPPORTUNITY_SCORE', 'RELATIONSHIP_HEALTH']);
    expect(app.runs).toHaveLength(4);
    expect(app.runs[0]).toMatchObject({ provider: 'rules', status: 'SUCCESS', actorId: 'member-1' });
    expect(app.leadUpdates).toEqual([{ opportunityScore: 73 }]);
    expect(app.insights.every((row) => row.origin === 'RULES' && row.promptVersion && row.sourceRecordIds)).toBe(true);

    const second = await computeDeterministicInsights({ context: { ...ctx, lead: { ...ctx.lead, opportunityScore: 73 } }, delegated: app.client, application: app.client, actorWorkspaceMemberId: 'member-1', includeDuplicates: false, now: NOW });

    expect(second.persisted).toEqual([]);
    expect(app.runs).toHaveLength(4);
    expect(app.leadUpdates).toHaveLength(1);
  });

  it('a confirmed insight is never overwritten: it goes STALE and a fresh suggestion is written', async () => {
    const app = fakeApplication();
    const ctx = context();

    await computeDeterministicInsights({ context: ctx, delegated: app.client, application: app.client, actorWorkspaceMemberId: 'm', includeDuplicates: false, now: NOW });
    const nba = app.insights.find((row) => row.insightType === 'NEXT_BEST_ACTION')!;

    nba.status = 'AI_CONFIRMED';
    nba.humanDecision = 'ACCEPTED';

    const changed = { ...ctx, tasks: [{ id: 't9', title: 'New overdue', status: 'TODO', dueAt: ago(1), assigneeId: 'm', lvPriority: null, lvSourceInteractionId: null, createdAt: ago(2) }] };

    await computeDeterministicInsights({ context: changed, delegated: app.client, application: app.client, actorWorkspaceMemberId: 'm', includeDuplicates: false, now: NOW });
    const rows = app.insights.filter((row) => row.insightType === 'NEXT_BEST_ACTION');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ status: 'AI_STALE', humanDecision: 'ACCEPTED' });
    expect(rows[1]).toMatchObject({ status: 'AI_SUGGESTED' });
  });

  it('fingerprints are stable for equal facts and differ otherwise', () => {
    expect(fingerprintOf(['a', 1])).toBe(fingerprintOf(['a', 1]));
    expect(fingerprintOf(['a', 1])).not.toBe(fingerprintOf(['a', 2]));
  });
});

describe('model context and provenance', () => {
  it('the model context never carries email or phone values, tokens or raw capture text', () => {
    const text = summaryContext(context({ lead: lead({ rawCaptureInput: 'SECRET-PASTE token=abc' }) }));

    expect(text).not.toContain('host@hilltop.in');
    expect(text).not.toContain('+91');
    expect(text).not.toContain('SECRET-PASTE');
    expect(text).toContain('email on file');
    expect(text).toContain('interaction #int-1');
  });

  it('the classification context excludes raw capture input — even when it holds an email, phone, URL or handle — and keeps the safe evidence', () => {
    const pasted = 'Contact Priya priya@lakeview.example +91 98765 43210 https://lakeview.example @lakeview_stays — boutique lake villa';
    const text = classificationContext(context({ lead: lead({ rawCaptureInput: pasted, website: { primaryLinkUrl: 'https://hilltop.in' }, instagram: { primaryLinkUrl: 'https://instagram.com/hilltop' } }) }));

    // Nothing from the paste reaches the model.
    for (const fragment of ['priya@lakeview.example', '98765', 'https://lakeview.example', '@lakeview_stays', 'boutique lake villa', 'Capture text']) {
      expect(text).not.toContain(fragment);
    }

    // The safe structured evidence is still all there for the classifier.
    expect(text).toContain('ALLOWED CATEGORIES');
    expect(text).toContain('STAY (Stay ecosystem)');
    expect(text).toContain('Name: Hilltop Retreat');
    expect(text).toContain('Organisation: Hilltop Retreat');
    expect(text).toContain('Location: Lonavala');
    expect(text).toContain('Source: WEBSITE');
    expect(text).toContain('Website: on file');
    expect(text).toContain('Instagram: on file');
    expect(text).toContain('Interaction #int-1 notes: Partner is keen');
    expect(text).not.toContain('host@hilltop.in');
    expect(text).not.toContain('+919999999999');
  });

  it('citations to records outside the context are dropped, not shown as sources', async () => {
    const app = fakeApplication();
    const ctx = context();
    const provider: AiProvider = {
      name: 'openai',
      model: 'test',
      available: true,
      generateText: async () => ({ ok: false } as unknown as AiResult<string>),
      summarize: async () => ({ ok: false } as unknown as AiResult<string>),
      classify: async () => ({ ok: false } as unknown as never),
      structuredOutput: async <T,>(): Promise<AiResult<T>> => ({
        ok: true,
        value: { overview: 'Keen partner.', currentRelationship: 'warm', recentActivity: [], openItems: [], risks: [], nextBestAction: 'Visit', insufficientData: false, citedRecordIds: ['int-1', 'ghost-999', 'LV-000101'] } as T,
        rawText: '',
        provider: 'openai',
        model: 'test',
        usage: { inputTokens: 1, outputTokens: 1 },
        latencyMs: 5,
        attempts: 1,
      }),
    };
    const result = await generateLeadSummary({ provider, application: app.client, context: ctx, actorWorkspaceMemberId: 'm' });

    expect(result.ok).toBe(true);
    expect(result.output?.citedRecordIds).toEqual(['int-1', 'LV-000101']);
    expect((app.insights[0]?.payload as { uncitedReferencesDropped: number }).uncitedReferencesDropped).toBe(1);
    expect(app.insights[0]).toMatchObject({ origin: 'MODEL', promptVersion: 'lead-summary-v1', provider: 'openai', model: 'test' });
    expect(app.insights[0]?.sourceRecordIds).toEqual(sourceRecordIds(ctx));
    expect(app.runs[0]).toMatchObject({ operation: 'LEAD_SUMMARY', status: 'SUCCESS', promptVersion: 'lead-summary-v1' });
  });

  it('a failed model call is stored as UNAVAILABLE with its code and no content', async () => {
    const app = fakeApplication();
    const provider: AiProvider = {
      name: 'openai',
      model: 'test',
      available: true,
      generateText: async () => ({ ok: false } as unknown as AiResult<string>),
      summarize: async () => ({ ok: false } as unknown as AiResult<string>),
      classify: async () => ({ ok: false } as unknown as never),
      structuredOutput: async () => ({ ok: false, code: 'AI_TIMEOUT', message: 'slow', provider: 'openai', model: 'test', latencyMs: 20_000, attempts: 3, retryable: true }),
    };
    const result = await generateLeadSummary({ provider, application: app.client, context: context(), actorWorkspaceMemberId: 'm' });

    expect(result).toMatchObject({ ok: false, status: 'UNAVAILABLE', code: 'AI_TIMEOUT', output: null });
    expect(app.insights[0]).toMatchObject({ status: 'UNAVAILABLE', errorCode: 'AI_TIMEOUT', summary: null });
    expect(app.runs[0]).toMatchObject({ status: 'FAILED', errorCode: 'AI_TIMEOUT' });
  });
});
