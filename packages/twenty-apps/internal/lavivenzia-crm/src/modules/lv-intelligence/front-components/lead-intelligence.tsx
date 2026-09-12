import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AppPath, navigate, useColorScheme, useRecordId } from 'twenty-sdk/front-component';

import { type LvTheme, layout, themeFor } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';
import { EmptyState, ErrorState, FocusStyles, LoadingState, Section } from 'src/modules/lv-dashboard/front-components/dashboard-kit';
import { type DataQualityResult } from 'src/modules/lv-intelligence/engines/data-quality';
import { type DuplicateScanResult } from 'src/modules/lv-intelligence/engines/duplicate-scan';
import { type NextBestActionResult } from 'src/modules/lv-intelligence/engines/next-best-action';
import { type OpportunityScoreResult } from 'src/modules/lv-intelligence/engines/opportunity-score';
import { type RelationshipHealthResult } from 'src/modules/lv-intelligence/engines/relationship-health';
import { type InsightRow } from 'src/modules/lv-ai/runtime/insight-store';

// The lead's Intelligence tab. Every section loads on its own, labels its
// origin (COMPUTED by rules vs AI GENERATED / AI SUGGESTION / AI DRAFT), and
// never blocks the rest of the lead page. Nothing shown here is CRM truth
// until a person accepts it, and acceptance goes through the server with
// that person's permissions.

type Availability = { available: boolean; provider: string; model: string | null; reason: string | null };

type InsightsResponse = {
  ok: true;
  lead: { id: string; lvLeadId: string | null; name: string | null; category: string | null; subcategory: string | null; status: string | null };
  ai: Availability;
  facts: { interactionCount: number; daysSinceLastInteraction: number | null; openTasks: number; overdueTasks: number; breachedSlas: number };
  opportunity: OpportunityScoreResult;
  health: RelationshipHealthResult;
  nextBestAction: NextBestActionResult;
  dataQuality: DataQualityResult;
  duplicates: DuplicateScanResult | null;
  insights: Record<string, InsightRow | null>;
  modelInsights: InsightRow[];
  recentInteractions: { id: string; name: string | null; channel: string | null; direction: string | null; occurredAt: string | null; hasNotes: boolean }[];
  onboarding: { id: string; status: string | null } | null;
};

type GenerateResponse = { ok: boolean; status?: string; code?: string | null; message?: string | null; error?: string; insight?: InsightRow | null; output?: Record<string, unknown> | null; label?: string; ai?: Availability };

const DRAFT_KINDS = [
  ['FOLLOW_UP_EMAIL', 'Follow-up email'],
  ['INTRODUCTION_EMAIL', 'Introduction email'],
  ['REMINDER', 'Reminder'],
  ['DOCUMENT_REQUEST', 'Document request'],
  ['ONBOARDING_REMINDER', 'Onboarding reminder'],
  ['MEETING_FOLLOW_UP', 'Meeting follow-up'],
  ['WHATSAPP_FOLLOW_UP', 'WhatsApp message (draft text only)'],
] as const;

const ONBOARDING_FIELDS = [
  ['EXPERIENCE.description', 'Experience description'],
  ['EXPERIENCE.title', 'Experience title'],
  ['ABOUT_YOU.bio', 'About the partner'],
  ['LOCATION.directions', 'How to find it'],
  ['AVAILABILITY.seasonalNotes', 'Seasonal notes'],
] as const;

const open = (target: { object: string; recordId: string } | null | undefined) => {
  if (target) {
    void navigate(AppPath.RecordShowPage, { objectNameSingular: target.object, objectRecordId: target.recordId });
  }
};

const Tag = ({ theme, children, tone = 'neutral' }: { theme: LvTheme; children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) => (
  <span style={{ ...layout(theme).badge(tone), fontFamily: theme.font.body, letterSpacing: '0.04em' }}>{children}</span>
);

const OriginTag = ({ theme, origin }: { theme: LvTheme; origin: 'RULES' | 'MODEL' | 'DRAFT' | 'SUGGESTION' }) => (
  <Tag theme={theme} tone={origin === 'RULES' ? 'info' : origin === 'DRAFT' ? 'warning' : 'neutral'}>
    {origin === 'RULES' ? 'COMPUTED · rules' : origin === 'DRAFT' ? 'AI DRAFT' : origin === 'SUGGESTION' ? 'AI SUGGESTION' : 'AI GENERATED'}
  </Tag>
);

const List = ({ theme, items, tone }: { theme: LvTheme; items: string[]; tone?: 'danger' | 'success' | 'muted' }) => (
  <ul style={{ margin: 0, paddingLeft: 18, fontSize: theme.font.size.sm, color: tone === 'danger' ? theme.color.danger : tone === 'success' ? theme.color.success : tone === 'muted' ? theme.color.textMuted : theme.color.text }}>
    {items.map((item, index) => (
      <li key={`${index}-${item.slice(0, 20)}`}>{item}</li>
    ))}
  </ul>
);

const Unavailable = ({ theme, ai, what }: { theme: LvTheme; ai: Availability | null; what: string }) => (
  <p role="status" style={{ margin: 0, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
    <Tag theme={theme} tone="warning">AI UNAVAILABLE</Tag> {what} needs the AI provider. {ai?.reason ?? 'No provider is configured.'} The rest of the CRM is unaffected.
  </p>
);

const useSection = <T,>(loader: () => Promise<T>) => {
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: T | null }>({ loading: false, error: null, data: null });
  const run = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const data = await loader();

      setState({ loading: false, error: null, data });
    } catch (caught) {
      setState((previous) => ({ ...previous, loading: false, error: caught instanceof Error ? caught.message : 'Request failed.' }));
    }
  }, [loader]);

  return { ...state, run, setData: (data: T | null) => setState((previous) => ({ ...previous, data })) };
};

export const LeadIntelligence = () => {
  const recordId = useRecordId();
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
  const s = useMemo(() => layout(theme), [theme]);
  const [base, setBase] = useState<InsightsResponse | null>(null);
  const [baseError, setBaseError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadBase = useCallback(async () => {
    if (!recordId) {
      return;
    }

    setIsLoading(true);
    setBaseError(null);

    try {
      const response = (await callRoute('/ai/lead/insights', { leadId: recordId })) as InsightsResponse;

      setBase(response);
    } catch (caught) {
      setBaseError(caught instanceof Error ? caught.message : 'Could not load intelligence.');
    } finally {
      setIsLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  const decide = async (insightId: string, decision: string, extra: Record<string, unknown> = {}, successText = 'Recorded.') => {
    setBusy(insightId + decision);
    setNotice(null);

    try {
      await callRoute('/ai/insight/decide', { insightId, decision, ...extra });
      setNotice(successText);
      await loadBase();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'The decision was refused.');
    } finally {
      setBusy(null);
    }
  };

  const ai = base?.ai ?? null;

  return (
    <div style={{ ...s.page, padding: theme.space(3) }} className="lv-intel">
      <FocusStyles theme={theme} />
      <style>{`.lv-intel button:focus-visible, .lv-intel select:focus-visible, .lv-intel textarea:focus-visible, .lv-intel input:focus-visible { outline: 2px solid ${theme.color.accent}; outline-offset: 2px; } .lv-intel textarea { font: inherit; }`}</style>
      <div style={s.stack(3)}>
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: theme.font.display, fontSize: theme.font.size.lg, color: theme.color.brand }}>Intelligence</h2>
            <p style={{ margin: `${theme.space(1)}px 0 0`, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
              Computed from this lead’s own records. AI output is a suggestion until you accept it; nothing here changes the lead on its own.
            </p>
          </div>
          <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
            {ai && (ai.available ? <Tag theme={theme} tone="success">AI · {ai.provider} · {ai.model}</Tag> : <Tag theme={theme} tone="warning">AI UNAVAILABLE</Tag>)}
            <button type="button" onClick={() => void loadBase()} disabled={isLoading} style={{ ...s.button('secondary'), minHeight: 36 }}>
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        {notice && <div role="status" style={{ ...s.card, border: `1px solid ${theme.color.accent}`, padding: theme.space(2), fontSize: theme.font.size.sm }}>{notice}</div>}
        {baseError && <ErrorState theme={theme} text={baseError} onRetry={() => void loadBase()} />}
        {isLoading && !base && <LoadingState theme={theme} rows={4} />}

        {base && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: theme.space(3) }}>
              <OpportunityCard theme={theme} result={base.opportunity} />
              <HealthCard theme={theme} result={base.health} />
            </div>

            <NextBestActionCard theme={theme} result={base.nextBestAction} insight={base.insights.NEXT_BEST_ACTION ?? null} busy={busy} onDecide={decide} />

            <SummaryCard theme={theme} leadId={base.lead.id} ai={ai} stored={base.modelInsights.find((row) => row.insightType === 'LEAD_SUMMARY') ?? null} busy={busy} onDecide={decide} onGenerated={loadBase} />

            <ClassificationCard theme={theme} lead={base.lead} ai={ai} stored={base.modelInsights.find((row) => row.insightType === 'CLASSIFICATION') ?? null} busy={busy} onDecide={decide} onGenerated={loadBase} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: theme.space(3) }}>
              <DataQualityCard theme={theme} result={base.dataQuality} />
              <DuplicateCard theme={theme} result={base.duplicates} insight={base.insights.DUPLICATE ?? null} busy={busy} onDecide={decide} />
            </div>

            <ConversationCard theme={theme} leadId={base.lead.id} ai={ai} interactions={base.recentInteractions} stored={base.modelInsights.filter((row) => row.insightType === 'CONVERSATION_SUMMARY')} problems={base.modelInsights.filter((row) => row.insightType === 'PROBLEM_SUGGESTION')} busy={busy} onDecide={decide} onGenerated={loadBase} />

            <DraftCard theme={theme} leadId={base.lead.id} ai={ai} />

            {base.onboarding && <OnboardingAssistCard theme={theme} leadId={base.lead.id} ai={ai} onboarding={base.onboarding} busy={busy} onDecide={decide} />}

            <p style={{ margin: 0, fontSize: theme.font.size.xs, color: theme.color.textMuted }}>
              Scores and states are computed by documented rules (versions shown on each card). AI text comes from the configured model, is grounded only in this lead’s records, and is stored with its prompt version, model and source record ids. Pricing, availability and certification are never inferred.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------- opportunity
const OpportunityCard = ({ theme, result }: { theme: LvTheme; result: OpportunityScoreResult }) => (
  <Section theme={theme} title="Opportunity" hint={result.rulesVersion}>
    <div style={{ display: 'flex', gap: theme.space(3), alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 96 }}>
        <div style={{ fontFamily: theme.font.display, fontSize: 40, lineHeight: 1, color: result.available ? theme.color.brand : theme.color.textMuted }}>{result.available ? result.score : 'n/a'}</div>
        <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>
          <OriginTag theme={theme} origin="RULES" />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 180, fontSize: theme.font.size.sm }}>
        {result.available ? (
          <>
            {result.positive.length > 0 && (
              <>
                <strong style={{ color: theme.color.success }}>Positive</strong>
                <List theme={theme} items={result.positive.map((factor) => `+${factor.points} ${factor.factor} — ${factor.evidence}`)} />
              </>
            )}
            {result.negative.length > 0 && (
              <>
                <strong style={{ color: theme.color.danger }}>Negative</strong>
                <List theme={theme} items={result.negative.map((factor) => `${factor.points} ${factor.factor} — ${factor.evidence}`)} />
              </>
            )}
            {result.missing.length > 0 && (
              <>
                <strong style={{ color: theme.color.textMuted }}>Missing</strong>
                <List theme={theme} items={result.missing} tone="muted" />
              </>
            )}
          </>
        ) : (
          <>
            <Tag theme={theme} tone="neutral">SCORE_UNAVAILABLE</Tag>
            <p style={{ margin: `${theme.space(1)}px 0 0`, color: theme.color.textMuted }}>{result.detail}</p>
            {result.missing.length > 0 && <List theme={theme} items={result.missing} tone="muted" />}
          </>
        )}
      </div>
    </div>
  </Section>
);

// ------------------------------------------------------------------ health
const HEALTH_TONE: Record<RelationshipHealthResult['state'], 'success' | 'warning' | 'danger' | 'neutral'> = { HEALTHY: 'success', ATTENTION: 'warning', AT_RISK: 'danger', DORMANT: 'neutral', UNKNOWN: 'neutral' };

const HealthCard = ({ theme, result }: { theme: LvTheme; result: RelationshipHealthResult }) => (
  <Section theme={theme} title="Relationship health" hint={result.rulesVersion}>
    <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap', marginBottom: theme.space(2) }}>
      <Tag theme={theme} tone={HEALTH_TONE[result.state]}>{result.state.replace('_', ' ')}</Tag>
      <OriginTag theme={theme} origin="RULES" />
    </div>
    {result.reasons.length > 0 ? <List theme={theme} items={result.reasons.map((reason) => `${reason.reason} — ${reason.evidence}`)} /> : <p style={{ margin: 0, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>No concern detected in the recorded interactions, tasks and SLAs.</p>}
    {result.positives.length > 0 && (
      <div style={{ marginTop: theme.space(2) }}>
        <List theme={theme} items={result.positives.map((reason) => `${reason.reason} — ${reason.evidence}`)} tone="success" />
      </div>
    )}
  </Section>
);

// -------------------------------------------------------- next best action
const NextBestActionCard = ({ theme, result, insight, busy, onDecide }: { theme: LvTheme; result: NextBestActionResult; insight: InsightRow | null; busy: string | null; onDecide: (id: string, decision: string, extra?: Record<string, unknown>, text?: string) => Promise<void> }) => {
  const s = layout(theme);
  const primary = result.primary;
  const decided = insight?.status === 'AI_CONFIRMED' || insight?.status === 'AI_REJECTED';

  return (
    <Section theme={theme} title="Next best action" hint={result.rulesVersion}>
      {!primary && <EmptyState theme={theme} text="No action is recommended for this lead right now." />}
      {primary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
          <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
            <Tag theme={theme} tone={primary.priority === 'CRITICAL' || primary.priority === 'HIGH' ? 'danger' : primary.priority === 'MEDIUM' ? 'warning' : 'neutral'}>{primary.priority}</Tag>
            <Tag theme={theme} tone="info">{primary.action.replace(/_/g, ' ')}</Tag>
            <Tag theme={theme}>confidence {primary.confidence}</Tag>
            <OriginTag theme={theme} origin="RULES" />
          </div>
          <div style={{ fontWeight: theme.font.weight.medium }}>{primary.title}</div>
          <div style={{ fontSize: theme.font.size.sm }}>{primary.reason}</div>
          <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>
            Suggested deadline: {primary.deadlineLabel} ({primary.suggestedDeadline.slice(0, 16).replace('T', ' ')}) · Evidence: {primary.evidence.join('; ')}
          </div>
          <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
            {insight && !decided && primary.proposedTask && (
              <button type="button" disabled={busy !== null} onClick={() => void onDecide(insight.id, 'ACCEPTED', {}, `Task "${primary.proposedTask?.title}" created.`)} style={s.button('primary')}>
                Accept — create task
              </button>
            )}
            {insight && !decided && (
              <button type="button" disabled={busy !== null} onClick={() => void onDecide(insight.id, 'DISMISSED', {}, 'Recommendation dismissed.')} style={s.button('secondary')}>
                Dismiss
              </button>
            )}
            <button type="button" onClick={() => open({ object: primary.targetObject, recordId: primary.targetRecordId })} style={s.button('secondary')}>
              Open target
            </button>
            {decided && <Tag theme={theme} tone={insight?.status === 'AI_CONFIRMED' ? 'success' : 'neutral'}>{insight?.humanDecision ?? insight?.status}</Tag>}
          </div>
          {result.alternatives.length > 0 && (
            <details>
              <summary style={{ cursor: 'pointer', fontSize: theme.font.size.sm, color: theme.color.textMuted }}>{result.alternatives.length} other option(s)</summary>
              <List theme={theme} items={result.alternatives.map((alternative) => `${alternative.action.replace(/_/g, ' ')}: ${alternative.title} — ${alternative.reason}`)} />
            </details>
          )}
        </div>
      )}
    </Section>
  );
};

// ------------------------------------------------------------- AI summary
const SummaryCard = ({ theme, leadId, ai, stored, busy, onDecide, onGenerated }: { theme: LvTheme; leadId: string; ai: Availability | null; stored: InsightRow | null; busy: string | null; onDecide: (id: string, decision: string, extra?: Record<string, unknown>, text?: string) => Promise<void>; onGenerated: () => Promise<void> }) => {
  const s = layout(theme);
  const section = useSection(useCallback(async () => (await callRoute('/ai/lead/generate', { leadId, type: 'LEAD_SUMMARY' })) as GenerateResponse, [leadId]));
  const payload = (stored?.payload ?? null) as Record<string, unknown> | null;
  const failure = section.data && !section.data.ok ? section.data : null;

  useEffect(() => {
    if (section.data?.ok) {
      void onGenerated();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.data]);

  return (
    <Section theme={theme} title="AI summary" hint={stored?.promptVersion ?? undefined}>
      {!ai?.available && !stored && <Unavailable theme={theme} ai={ai} what="The lead summary" />}
      {section.loading && <LoadingState theme={theme} rows={3} />}
      {section.error && <ErrorState theme={theme} text={section.error} onRetry={() => void section.run()} />}
      {failure && <p role="status" style={{ margin: 0, fontSize: theme.font.size.sm, color: theme.color.textMuted }}><Tag theme={theme} tone="warning">{failure.code ?? 'AI_UNAVAILABLE'}</Tag> {failure.message ?? failure.error}</p>}
      {stored && payload && stored.status !== 'UNAVAILABLE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), fontSize: theme.font.size.sm }}>
          <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center' }}>
            <OriginTag theme={theme} origin="MODEL" />
            <span style={{ color: theme.color.textMuted, fontSize: theme.font.size.xs }}>{stored.provider} · {stored.model} · {stored.generatedAt?.slice(0, 16).replace('T', ' ')}</span>
            {stored.status === 'AI_STALE' && <Tag theme={theme} tone="warning">STALE</Tag>}
            {stored.humanDecision && <Tag theme={theme} tone={stored.status === 'AI_CONFIRMED' ? 'success' : 'neutral'}>{stored.humanDecision}</Tag>}
          </div>
          <div><strong>Overview.</strong> {String(payload.overview ?? '')}</div>
          <div><strong>Current relationship.</strong> {String(payload.currentRelationship ?? '')}</div>
          {Array.isArray(payload.recentActivity) && payload.recentActivity.length > 0 && (<div><strong>Recent activity</strong><List theme={theme} items={payload.recentActivity as string[]} /></div>)}
          {Array.isArray(payload.openItems) && payload.openItems.length > 0 && (<div><strong>Open items</strong><List theme={theme} items={payload.openItems as string[]} /></div>)}
          {Array.isArray(payload.risks) && payload.risks.length > 0 && (<div><strong>Risks</strong><List theme={theme} items={payload.risks as string[]} tone="danger" /></div>)}
          <div><strong>Next best action (AI).</strong> {String(payload.nextBestAction ?? '')}</div>
          <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>Sources: {Array.isArray(stored.sourceRecordIds) ? `${(stored.sourceRecordIds as string[]).length} record(s)` : '—'}{Array.isArray(payload.citedRecordIds) && (payload.citedRecordIds as string[]).length > 0 ? ` · cited ${(payload.citedRecordIds as string[]).length}` : ''}</div>
          {stored.status === 'AI_SUGGESTED' && (
            <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
              <button type="button" disabled={busy !== null} onClick={() => void onDecide(stored.id, 'ACCEPTED', {}, 'Summary marked as reviewed.')} style={s.button('secondary')}>Looks right</button>
              <button type="button" disabled={busy !== null} onClick={() => void onDecide(stored.id, 'REJECTED', {}, 'Summary rejected.')} style={s.button('secondary')}>Wrong / unhelpful</button>
            </div>
          )}
        </div>
      )}
      {stored?.status === 'UNAVAILABLE' && !section.loading && <p style={{ margin: 0, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>Last attempt failed ({stored.errorCode ?? 'AI_UNAVAILABLE'}).</p>}
      {ai?.available && (
        <div style={{ marginTop: theme.space(2) }}>
          <button type="button" disabled={section.loading} onClick={() => void section.run()} style={s.button(stored ? 'secondary' : 'primary')}>
            {section.loading ? 'Generating…' : stored ? 'Regenerate summary' : 'Generate AI summary'}
          </button>
        </div>
      )}
    </Section>
  );
};

// --------------------------------------------------------- classification
const ClassificationCard = ({ theme, lead, ai, stored, busy, onDecide, onGenerated }: { theme: LvTheme; lead: InsightsResponse['lead']; ai: Availability | null; stored: InsightRow | null; busy: string | null; onDecide: (id: string, decision: string, extra?: Record<string, unknown>, text?: string) => Promise<void>; onGenerated: () => Promise<void> }) => {
  const s = layout(theme);
  const section = useSection(useCallback(async () => (await callRoute('/ai/lead/generate', { leadId: lead.id, type: 'CLASSIFICATION' })) as GenerateResponse, [lead.id]));
  const payload = (stored?.payload ?? null) as Record<string, unknown> | null;
  const [editCategory, setEditCategory] = useState<string>('');
  const failure = section.data && !section.data.ok ? section.data : null;

  useEffect(() => {
    if (section.data?.ok) {
      void onGenerated();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.data]);

  const reviewRequired = payload?.reviewRequired === true;

  return (
    <Section theme={theme} title="AI classification" hint={stored?.promptVersion ?? undefined}>
      <p style={{ margin: `0 0 ${theme.space(2)}px`, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
        Current: <strong>{lead.category ?? 'no category'}</strong>{lead.subcategory ? ` / ${lead.subcategory}` : ''}
      </p>
      {!ai?.available && !stored && <Unavailable theme={theme} ai={ai} what="Classification" />}
      {section.loading && <LoadingState theme={theme} rows={2} />}
      {section.error && <ErrorState theme={theme} text={section.error} onRetry={() => void section.run()} />}
      {failure && <p role="status" style={{ margin: 0, fontSize: theme.font.size.sm, color: theme.color.textMuted }}><Tag theme={theme} tone="warning">{failure.code ?? 'AI_UNAVAILABLE'}</Tag> {failure.message ?? failure.error}</p>}
      {stored && payload && stored.status !== 'UNAVAILABLE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), fontSize: theme.font.size.sm }}>
          <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center' }}>
            <OriginTag theme={theme} origin="SUGGESTION" />
            {reviewRequired && <Tag theme={theme} tone="warning">REVIEW_REQUIRED</Tag>}
            {stored.humanDecision && <Tag theme={theme} tone={stored.status === 'AI_CONFIRMED' ? 'success' : 'neutral'}>{stored.humanDecision}</Tag>}
          </div>
          <div>
            Suggested: <strong>{String(payload.category ?? 'none')}</strong>{payload.subcategory ? ` / ${String(payload.subcategory)}` : ''} · confidence {typeof stored.confidence === 'number' ? stored.confidence.toFixed(2) : 'n/a'}
          </div>
          <div>{String(payload.reasoning ?? '')}</div>
          {Array.isArray(payload.evidence) && payload.evidence.length > 0 && (<div><strong>Evidence</strong><List theme={theme} items={payload.evidence as string[]} /></div>)}
          {Array.isArray(payload.ambiguity) && payload.ambiguity.length > 0 && (<div><strong>Unresolved</strong><List theme={theme} items={payload.ambiguity as string[]} tone="muted" /></div>)}
          {stored.status === 'AI_SUGGESTED' && (
            <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center' }}>
              {typeof payload.category === 'string' && payload.category.length > 0 && (
                <button type="button" disabled={busy !== null} onClick={() => void onDecide(stored.id, 'ACCEPTED', {}, 'Category applied to the lead.')} style={s.button('primary')}>Accept</button>
              )}
              <label htmlFor="lv-intel-cat" style={{ fontSize: theme.font.size.xs }}>Edit</label>
              <select id="lv-intel-cat" value={editCategory} onChange={(event) => setEditCategory(event.target.value)} style={{ ...s.input, width: 'auto', minHeight: 36 }}>
                <option value="">choose…</option>
                {['EXPERIENCE', 'STAY', 'BUSINESS_PARTNER', 'PEOPLE_COMMUNITY'].map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <button type="button" disabled={busy !== null || !editCategory} onClick={() => void onDecide(stored.id, 'EDITED', { edits: { category: editCategory, subcategory: null } }, 'Edited category applied to the lead.')} style={s.button('secondary')}>Apply edit</button>
              <button type="button" disabled={busy !== null} onClick={() => void onDecide(stored.id, 'REJECTED', {}, 'Classification rejected.')} style={s.button('secondary')}>Reject</button>
            </div>
          )}
        </div>
      )}
      {ai?.available && (
        <div style={{ marginTop: theme.space(2) }}>
          <button type="button" disabled={section.loading} onClick={() => void section.run()} style={s.button(stored ? 'secondary' : 'primary')}>
            {section.loading ? 'Classifying…' : stored ? 'Re-run classification' : 'Suggest a category'}
          </button>
        </div>
      )}
    </Section>
  );
};

// ------------------------------------------------------------ data quality
const DataQualityCard = ({ theme, result }: { theme: LvTheme; result: DataQualityResult }) => (
  <Section theme={theme} title="Data quality" count={result.issues.length} hint={`${result.rulesVersion} · score ${result.score}`}>
    {result.issues.length === 0 && <EmptyState theme={theme} text="No data-quality issue detected." />}
    {result.issues.length > 0 && (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
        {result.issues.map((issue) => (
          <li key={`${issue.code}-${issue.target.recordId}-${issue.target.field ?? ''}`} style={{ fontSize: theme.font.size.sm, borderLeft: `3px solid ${issue.severity === 'HIGH' ? theme.color.danger : issue.severity === 'MEDIUM' ? theme.color.warning : theme.color.border}`, paddingLeft: theme.space(2) }}>
            <div style={{ fontWeight: theme.font.weight.medium }}>{issue.issue} <Tag theme={theme} tone={issue.severity === 'HIGH' ? 'danger' : issue.severity === 'MEDIUM' ? 'warning' : 'neutral'}>{issue.severity}</Tag></div>
            <div style={{ color: theme.color.textMuted }}>{issue.evidence}</div>
            <div>→ {issue.recommendedCorrection}</div>
          </li>
        ))}
      </ul>
    )}
  </Section>
);

// -------------------------------------------------------------- duplicates
const DuplicateCard = ({ theme, result, insight, busy, onDecide }: { theme: LvTheme; result: DuplicateScanResult | null; insight: InsightRow | null; busy: string | null; onDecide: (id: string, decision: string, extra?: Record<string, unknown>, text?: string) => Promise<void> }) => {
  const s = layout(theme);
  const decided = insight?.status === 'AI_CONFIRMED' || insight?.status === 'AI_REJECTED';

  return (
    <Section theme={theme} title="Duplicate signal" count={result?.candidates.length ?? 0} hint={result?.rulesVersion}>
      {!result && <p style={{ margin: 0, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>Duplicate scan not run.</p>}
      {result && result.candidates.length === 0 && <EmptyState theme={theme} text={`No duplicate candidate among the ${result.scanned} similar lead(s) you can see.`} />}
      {result && result.candidates.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
          {result.candidates.map((candidate) => (
            <li key={candidate.leadId} style={{ fontSize: theme.font.size.sm, ...s.card, padding: theme.space(2) }}>
              <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
                <Tag theme={theme} tone={candidate.strength === 'STRONG' ? 'danger' : 'warning'}>{candidate.percent}% similarity</Tag>
                <button type="button" onClick={() => open({ object: 'lvLead', recordId: candidate.leadId })} style={{ ...s.button('secondary'), minHeight: 32, padding: '4px 10px' }}>
                  {candidate.lvLeadId ?? ''} {candidate.name ?? candidate.organisationName ?? 'lead'}
                </button>
              </div>
              <div style={{ color: theme.color.textMuted, marginTop: 4 }}>Matches: {candidate.matchingFields.join(', ')} · {candidate.status ?? ''}{candidate.location ? ` · ${candidate.location}` : ''}</div>
              <div style={{ marginTop: 4 }}>Suggested survivor: {candidate.suggestedMergeTarget === 'CANDIDATE' ? 'the older lead (candidate)' : 'this lead'}. Merge marks the other as DUPLICATE (audited); records are not combined automatically.</div>
              {insight && !decided && (
                <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', marginTop: theme.space(2) }}>
                  <button type="button" disabled={busy !== null} onClick={() => void onDecide(insight.id, 'MERGED', { candidateLeadId: candidate.leadId }, 'Marked as duplicate. Audit entry recorded.')} style={s.button('danger')}>Merge</button>
                  <button type="button" disabled={busy !== null} onClick={() => void onDecide(insight.id, 'CREATED_NEW', {}, 'Kept as a separate lead.')} style={s.button('secondary')}>Create new (keep both)</button>
                  <button type="button" disabled={busy !== null} onClick={() => void onDecide(insight.id, 'IGNORED', {}, 'Duplicate signal ignored.')} style={s.button('secondary')}>Ignore</button>
                </div>
              )}
              {decided && <div style={{ marginTop: theme.space(1) }}><Tag theme={theme} tone="neutral">{insight?.humanDecision}</Tag></div>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};

// ----------------------------------------------------------- conversation
const ConversationCard = ({ theme, leadId, ai, interactions, stored, problems, busy, onDecide, onGenerated }: { theme: LvTheme; leadId: string; ai: Availability | null; interactions: InsightsResponse['recentInteractions']; stored: InsightRow[]; problems: InsightRow[]; busy: string | null; onDecide: (id: string, decision: string, extra?: Record<string, unknown>, text?: string) => Promise<void>; onGenerated: () => Promise<void> }) => {
  const s = layout(theme);
  const [target, setTarget] = useState<string>('');
  const [state, setState] = useState<{ loading: boolean; error: string | null; failure: GenerateResponse | null }>({ loading: false, error: null, failure: null });
  const summarise = async () => {
    if (!target) {
      return;
    }

    setState({ loading: true, error: null, failure: null });

    try {
      const response = (await callRoute('/ai/lead/generate', { leadId, type: 'CONVERSATION_SUMMARY', interactionId: target })) as GenerateResponse;

      setState({ loading: false, error: null, failure: response.ok ? null : response });
      await onGenerated();
    } catch (caught) {
      setState({ loading: false, error: caught instanceof Error ? caught.message : 'Request failed.', failure: null });
    }
  };

  return (
    <Section theme={theme} title="Recent conversation summary" count={stored.length}>
      {interactions.length === 0 && <EmptyState theme={theme} text="No interaction has been recorded on this lead." />}
      {interactions.length > 0 && !ai?.available && <Unavailable theme={theme} ai={ai} what="Conversation summarisation" />}
      {interactions.length > 0 && ai?.available && (
        <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center', marginBottom: theme.space(2) }}>
          <label htmlFor="lv-intel-int" style={{ fontSize: theme.font.size.sm }}>Interaction</label>
          <select id="lv-intel-int" value={target} onChange={(event) => setTarget(event.target.value)} style={{ ...s.input, width: 'auto', minHeight: 36, maxWidth: '100%' }}>
            <option value="">choose…</option>
            {interactions.map((row) => (
              <option key={row.id} value={row.id} disabled={!row.hasNotes}>
                {row.occurredAt?.slice(0, 10)} {row.direction} {row.channel} {row.name ?? ''}{row.hasNotes ? '' : ' (no notes)'}
              </option>
            ))}
          </select>
          <button type="button" disabled={!target || state.loading} onClick={() => void summarise()} style={s.button('primary')}>{state.loading ? 'Summarising…' : 'Summarise'}</button>
        </div>
      )}
      {state.error && <ErrorState theme={theme} text={state.error} onRetry={() => void summarise()} />}
      {state.failure && <p role="status" style={{ margin: `0 0 ${theme.space(2)}px`, fontSize: theme.font.size.sm, color: theme.color.textMuted }}><Tag theme={theme} tone="warning">{state.failure.code ?? 'AI_UNAVAILABLE'}</Tag> {state.failure.message ?? state.failure.error}</p>}
      {stored.filter((row) => row.status !== 'UNAVAILABLE').map((row) => {
        const payload = (row.payload ?? {}) as Record<string, unknown>;
        const relatedProblems = problems.filter((problem) => ((problem.payload ?? {}) as Record<string, unknown>).interactionId === row.targetRecordId);

        return (
          <div key={row.id} style={{ ...s.card, padding: theme.space(2), marginBottom: theme.space(2), fontSize: theme.font.size.sm }}>
            <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center' }}>
              <OriginTag theme={theme} origin="MODEL" />
              <Tag theme={theme} tone={payload.sentiment === 'POSITIVE' ? 'success' : payload.sentiment === 'NEGATIVE' ? 'danger' : 'neutral'}>sentiment (suggested): {String(payload.sentiment ?? 'UNCLEAR')}</Tag>
              <span style={{ color: theme.color.textMuted, fontSize: theme.font.size.xs }}>{row.generatedAt?.slice(0, 16).replace('T', ' ')} · {row.promptVersion}</span>
              {row.humanDecision && <Tag theme={theme} tone={row.status === 'AI_CONFIRMED' ? 'success' : 'neutral'}>{row.humanDecision}</Tag>}
            </div>
            <p style={{ margin: `${theme.space(1)}px 0` }}>{String(payload.summary ?? row.summary ?? '')}</p>
            {Array.isArray(payload.keyPoints) && payload.keyPoints.length > 0 && (<div><strong>Key points</strong><List theme={theme} items={payload.keyPoints as string[]} /></div>)}
            {Array.isArray(payload.commitments) && payload.commitments.length > 0 && (<div><strong>Commitments</strong><List theme={theme} items={(payload.commitments as { text: string; certainty: string }[]).map((item) => `${item.text}${item.certainty === 'UNCERTAIN' ? ' — UNCERTAIN' : ''}`)} /></div>)}
            {Array.isArray(payload.objections) && payload.objections.length > 0 && (<div><strong>Objections</strong><List theme={theme} items={(payload.objections as { category: string; text: string; confidence: number | null }[]).map((item) => `${item.category}: ${item.text}${typeof item.confidence === 'number' ? ` (${item.confidence.toFixed(2)})` : ''}`)} tone="danger" /></div>)}
            {typeof payload.nextAction === 'string' && payload.nextAction && <div><strong>Next action (suggested):</strong> {payload.nextAction}{payload.followUpDateSuggestion ? ` by ${String(payload.followUpDateSuggestion)}` : ''}</div>}
            {Array.isArray(payload.unresolvedQuestions) && payload.unresolvedQuestions.length > 0 && (<div><strong>Unresolved</strong><List theme={theme} items={payload.unresolvedQuestions as string[]} tone="muted" /></div>)}
            {row.status === 'AI_SUGGESTED' && (
              <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', marginTop: theme.space(2) }}>
                <button type="button" disabled={busy !== null} onClick={() => void onDecide(row.id, 'ACCEPTED', {}, 'Applied to the interaction (sentiment, objections, commitments, next action).')} style={s.button('primary')}>Apply to interaction</button>
                <button type="button" disabled={busy !== null} onClick={() => void onDecide(row.id, 'REJECTED', {}, 'Summary rejected.')} style={s.button('secondary')}>Reject</button>
              </div>
            )}
            {relatedProblems.length > 0 && (
              <div style={{ marginTop: theme.space(2) }}>
                <strong>Problem suggestions</strong>
                {relatedProblems.map((problem) => {
                  const suggestion = (problem.payload ?? {}) as Record<string, unknown>;

                  return (
                    <div key={problem.id} style={{ borderLeft: `3px solid ${theme.color.warning}`, paddingLeft: theme.space(2), marginTop: theme.space(1) }}>
                      <div><Tag theme={theme} tone="warning">{String(suggestion.type ?? 'OTHER')} · {String(suggestion.severity ?? 'MEDIUM')}</Tag> {String(suggestion.description ?? '')}</div>
                      {typeof suggestion.rootCauseHypothesis === 'string' && <div style={{ color: theme.color.textMuted }}>Root cause (hypothesis): {suggestion.rootCauseHypothesis}</div>}
                      {typeof suggestion.suggestedResolution === 'string' && <div style={{ color: theme.color.textMuted }}>Suggested resolution: {suggestion.suggestedResolution}</div>}
                      {problem.status === 'AI_SUGGESTED' ? (
                        <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', marginTop: theme.space(1) }}>
                          <button type="button" disabled={busy !== null} onClick={() => void onDecide(problem.id, 'ACCEPTED', {}, 'Problem created.')} style={{ ...s.button('primary'), minHeight: 32 }}>Confirm problem</button>
                          <button type="button" disabled={busy !== null} onClick={() => void onDecide(problem.id, 'REJECTED', {}, 'Problem suggestion rejected.')} style={{ ...s.button('secondary'), minHeight: 32 }}>Not a problem</button>
                        </div>
                      ) : (
                        <Tag theme={theme} tone={problem.status === 'AI_CONFIRMED' ? 'success' : 'neutral'}>{problem.humanDecision ?? problem.status}</Tag>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </Section>
  );
};

// ------------------------------------------------------------------ drafts
const DraftCard = ({ theme, leadId, ai }: { theme: LvTheme; leadId: string; ai: Availability | null }) => {
  const s = layout(theme);
  const [kind, setKind] = useState<string>('FOLLOW_UP_EMAIL');
  const [tone, setTone] = useState<string>('PROFESSIONAL');
  const [instructions, setInstructions] = useState('');
  const [draft, setDraft] = useState<{ subject: string | null; body: string; placeholders: string[]; provider: string; model: string | null } | null>(null);
  const [state, setState] = useState<{ loading: boolean; error: string | null; failure: GenerateResponse | null }>({ loading: false, error: null, failure: null });
  const generate = async () => {
    setState({ loading: true, error: null, failure: null });

    try {
      const response = (await callRoute('/ai/lead/generate', { leadId, type: 'DRAFT', kind, tone, instructions: instructions || undefined })) as GenerateResponse & { output?: { subject: string | null; body: string; placeholders: string[] }; provider?: string; model?: string | null };

      if (response.ok && response.output) {
        setDraft({ subject: response.output.subject, body: response.output.body, placeholders: response.output.placeholders, provider: response.provider ?? '', model: response.model ?? null });
        setState({ loading: false, error: null, failure: null });
      } else {
        setState({ loading: false, error: null, failure: response });
      }
    } catch (caught) {
      setState({ loading: false, error: caught instanceof Error ? caught.message : 'Request failed.', failure: null });
    }
  };

  return (
    <Section theme={theme} title="Draft follow-up" hint="nothing is sent from here">
      {!ai?.available && <Unavailable theme={theme} ai={ai} what="Drafting" />}
      {ai?.available && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
          <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center' }}>
            <label htmlFor="lv-intel-kind" style={{ fontSize: theme.font.size.sm }}>Kind</label>
            <select id="lv-intel-kind" value={kind} onChange={(event) => setKind(event.target.value)} style={{ ...s.input, width: 'auto', minHeight: 36 }}>
              {DRAFT_KINDS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <label htmlFor="lv-intel-tone" style={{ fontSize: theme.font.size.sm }}>Tone</label>
            <select id="lv-intel-tone" value={tone} onChange={(event) => setTone(event.target.value)} style={{ ...s.input, width: 'auto', minHeight: 36 }}>
              {['PROFESSIONAL', 'FRIENDLY', 'SHORTER'].map((value) => (
                <option key={value} value={value}>{value.toLowerCase()}</option>
              ))}
            </select>
            <button type="button" disabled={state.loading} onClick={() => void generate()} style={s.button('primary')}>{state.loading ? 'Drafting…' : 'Draft'}</button>
          </div>
          <input value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={400} placeholder="Optional instructions (e.g. mention the site visit on Friday)" style={s.input} aria-label="Draft instructions" />
          {state.error && <ErrorState theme={theme} text={state.error} onRetry={() => void generate()} />}
          {state.failure && <p role="status" style={{ margin: 0, fontSize: theme.font.size.sm, color: theme.color.textMuted }}><Tag theme={theme} tone="warning">{state.failure.code ?? 'AI_UNAVAILABLE'}</Tag> {state.failure.message ?? state.failure.error}</p>}
          {draft && (
            <div style={{ ...s.card, padding: theme.space(2), display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
              <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center' }}>
                <OriginTag theme={theme} origin="DRAFT" />
                <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>{draft.provider} · {draft.model} · not sent — review, edit, then copy into your email or WhatsApp</span>
              </div>
              {draft.subject !== null && <input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} style={s.input} aria-label="Draft subject" />}
              <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows={10} style={{ ...s.input, minHeight: 160 }} aria-label="Draft body" />
              {draft.placeholders.length > 0 && <div style={{ fontSize: theme.font.size.xs, color: theme.color.warning }}>Fill before sending: {draft.placeholders.join(', ')}</div>}
              <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
                <button type="button" onClick={() => void navigator.clipboard?.writeText(`${draft.subject ? `${draft.subject}\n\n` : ''}${draft.body}`)} style={s.button('secondary')}>Copy draft</button>
                <button type="button" onClick={() => setDraft(null)} style={s.button('secondary')}>Discard</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  );
};

// ---------------------------------------------------- onboarding assistant
const OnboardingAssistCard = ({ theme, leadId, ai, onboarding, busy, onDecide }: { theme: LvTheme; leadId: string; ai: Availability | null; onboarding: { id: string; status: string | null }; busy: string | null; onDecide: (id: string, decision: string, extra?: Record<string, unknown>, text?: string) => Promise<void> }) => {
  const s = layout(theme);
  const [field, setField] = useState<string>('EXPERIENCE.description');
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ insightId: string | null; output: Record<string, unknown> } | null>(null);
  const [edited, setEdited] = useState('');
  const [state, setState] = useState<{ loading: boolean; error: string | null; failure: GenerateResponse | null }>({ loading: false, error: null, failure: null });
  const run = async () => {
    setState({ loading: true, error: null, failure: null });

    try {
      const response = (await callRoute('/ai/lead/generate', { leadId, type: 'ONBOARDING_ASSIST', field: text ? field : undefined, text: text || undefined })) as GenerateResponse;

      if (response.ok && response.output) {
        setResult({ insightId: response.insight?.id ?? null, output: response.output });
        setEdited(typeof response.output.improvedText === 'string' ? response.output.improvedText : '');
        setState({ loading: false, error: null, failure: null });
      } else {
        setState({ loading: false, error: null, failure: response });
      }
    } catch (caught) {
      setState({ loading: false, error: caught instanceof Error ? caught.message : 'Request failed.', failure: null });
    }
  };

  return (
    <Section theme={theme} title="Onboarding assistant" hint={`onboarding ${onboarding.status ?? ''}`}>
      {!ai?.available && <Unavailable theme={theme} ai={ai} what="The onboarding assistant" />}
      {ai?.available && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
          <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center' }}>
            <label htmlFor="lv-intel-field" style={{ fontSize: theme.font.size.sm }}>Field</label>
            <select id="lv-intel-field" value={field} onChange={(event) => setField(event.target.value)} style={{ ...s.input, width: 'auto', minHeight: 36 }}>
              {ONBOARDING_FIELDS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button type="button" disabled={state.loading} onClick={() => void run()} style={s.button('primary')}>{state.loading ? 'Reviewing…' : text ? 'Suggest clearer wording' : 'Review submitted answers'}</button>
          </div>
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} placeholder="Paste the partner’s text to improve (USER PROVIDED). Leave empty to only review what was submitted." style={{ ...s.input, minHeight: 80 }} aria-label="Partner text" />
          {state.error && <ErrorState theme={theme} text={state.error} onRetry={() => void run()} />}
          {state.failure && <p role="status" style={{ margin: 0, fontSize: theme.font.size.sm, color: theme.color.textMuted }}><Tag theme={theme} tone="warning">{state.failure.code ?? 'AI_UNAVAILABLE'}</Tag> {state.failure.message ?? state.failure.error}</p>}
          {result && (
            <div style={{ ...s.card, padding: theme.space(2), display: 'flex', flexDirection: 'column', gap: theme.space(2), fontSize: theme.font.size.sm }}>
              <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center' }}>
                <OriginTag theme={theme} origin="SUGGESTION" />
                <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>Only facts already in the partner’s text; nothing added.</span>
              </div>
              {typeof result.output.improvedText === 'string' && (
                <>
                  <div><Tag theme={theme} tone="neutral">USER PROVIDED</Tag> <span style={{ color: theme.color.textMuted }}>{text.slice(0, 400)}{text.length > 400 ? '…' : ''}</span></div>
                  <div><Tag theme={theme} tone="info">AI SUGGESTED</Tag></div>
                  <textarea value={edited} onChange={(event) => setEdited(event.target.value)} rows={6} style={{ ...s.input, minHeight: 120 }} aria-label="Suggested wording" />
                  {Array.isArray(result.output.changesExplained) && (result.output.changesExplained as string[]).length > 0 && <List theme={theme} items={result.output.changesExplained as string[]} tone="muted" />}
                  {result.insightId && (
                    <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
                      <button type="button" disabled={busy !== null || !edited} onClick={() => void onDecide(result.insightId!, 'EDITED', { edits: { field, text: edited } }, 'Wording saved to the onboarding answers.')} style={s.button('primary')}>Accept wording</button>
                      <button type="button" disabled={busy !== null} onClick={() => void onDecide(result.insightId!, 'REJECTED', {}, 'Suggestion rejected.')} style={s.button('secondary')}>Reject</button>
                    </div>
                  )}
                </>
              )}
              {Array.isArray(result.output.missingInformation) && (result.output.missingInformation as string[]).length > 0 && (<div><strong>Missing information</strong><List theme={theme} items={result.output.missingInformation as string[]} /></div>)}
              {Array.isArray(result.output.inconsistencies) && (result.output.inconsistencies as string[]).length > 0 && (<div><strong>Inconsistencies</strong><List theme={theme} items={result.output.inconsistencies as string[]} tone="danger" /></div>)}
              {Array.isArray(result.output.questions) && (result.output.questions as string[]).length > 0 && (<div><strong>Questions for the partner</strong><List theme={theme} items={result.output.questions as string[]} /></div>)}
            </div>
          )}
        </div>
      )}
    </Section>
  );
};
