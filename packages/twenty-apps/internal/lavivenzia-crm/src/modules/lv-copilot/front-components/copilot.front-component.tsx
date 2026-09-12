import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AppPath, navigate, useColorScheme } from 'twenty-sdk/front-component';

import { FC_COPILOT_ID } from 'src/constants/universal-identifiers';
import { type LvTheme, layout, themeFor } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';
import { ErrorState, FocusStyles, LoadingState, PageHeader, RecordRow, Section } from 'src/modules/lv-dashboard/front-components/dashboard-kit';
import { type CopilotResponse } from 'src/modules/lv-copilot/services/copilot';

// The Copilot page: today's briefing on top (deterministic facts, optionally
// prioritised by the model), then the question box. Every answer separates
// KNOWN (read from records under your permissions), INFERRED (a reading of
// those facts) and SUGGESTED (a next step). Writes are proposals: the server
// executes nothing until "Confirm" is pressed.

type Briefing = {
  ok: true;
  generatedAt: string;
  lens: string;
  ai: { available: boolean; provider: string; model: string | null; reason: string | null };
  today: { key: string; count: number; label: string; link: { object: string } | null }[];
  headline: string;
  topActions: { title: string; why: string; ref: { ref: string; label: string; target: { object: string; recordId: string } } | null; origin: 'RULES' | 'MODEL' }[];
  narrative: { status: string; provider: string; model: string | null; promptVersion: string; code: string | null };
  notes: string[];
};

const EXAMPLES = [
  'Show me my overdue leads',
  'Which leads are waiting for a response?',
  'Which onboarding records have missing documents?',
  'What happened with LV-000003?',
  'Which leads are interested but have no next action?',
  'Show me SLA breaches',
  'What should I work on today?',
  'Which partners have not been contacted recently?',
  'Show me high-priority leads in Pune',
  'Create a follow-up task for LV-000003 tomorrow',
];

const openTarget = (target: { object: string; recordId: string } | null | undefined) => {
  if (target) {
    void navigate(AppPath.RecordShowPage, { objectNameSingular: target.object, objectRecordId: target.recordId });
  }
};

const Badge = ({ theme, tone, children }: { theme: LvTheme; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; children: ReactNode }) => (
  <span style={{ ...layout(theme).badge(tone), fontFamily: theme.font.body, letterSpacing: '0.04em' }}>{children}</span>
);

const AnswerBlock = ({ theme, label, tone, items }: { theme: LvTheme; label: string; tone: 'info' | 'warning' | 'success'; items: string[] }) =>
  items.length === 0 ? null : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      <Badge theme={theme} tone={tone}>{label}</Badge>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: theme.font.size.sm }}>
        {items.map((item, index) => (
          <li key={`${label}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );

export const Copilot = () => {
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
  const s = useMemo(() => layout(theme), [theme]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<{ question: string; response: CopilotResponse | null; error: string | null; confirmed?: string | null }[]>([]);
  const [asking, setAsking] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const loadBriefing = useCallback(async () => {
    setBriefingLoading(true);
    setBriefingError(null);

    try {
      setBriefing((await callRoute('/ai/briefing', { timeZoneOffsetMinutes: -new Date().getTimezoneOffset() })) as Briefing);
    } catch (caught) {
      setBriefingError(caught instanceof Error ? caught.message : 'Could not load the briefing.');
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBriefing();
  }, [loadBriefing]);

  const ask = async (text: string) => {
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    setAsking(true);
    setQuestion('');

    try {
      const response = (await callRoute('/copilot/ask', { question: trimmed, timeZoneOffsetMinutes: -new Date().getTimezoneOffset() })) as CopilotResponse;

      setHistory((previous) => [{ question: trimmed, response, error: null }, ...previous].slice(0, 10));
    } catch (caught) {
      setHistory((previous) => [{ question: trimmed, response: null, error: caught instanceof Error ? caught.message : 'The Copilot could not answer.' }, ...previous].slice(0, 10));
    } finally {
      setAsking(false);
    }
  };

  const confirm = async (proposalId: string, cancel = false) => {
    setConfirming(proposalId);

    try {
      const result = (await callRoute('/copilot/confirm', { proposalId, cancel })) as { ok: boolean; status?: string; created?: { object: string; recordId: string; title?: string }; error?: string };

      setHistory((previous) => previous.map((entry) => (entry.response?.proposal?.proposalId === proposalId ? { ...entry, confirmed: cancel ? 'Cancelled — nothing was created.' : result.created ? `Created ${result.created.object} "${result.created.title ?? ''}".` : result.status ?? 'Done.' } : entry)));
    } catch (caught) {
      setHistory((previous) => previous.map((entry) => (entry.response?.proposal?.proposalId === proposalId ? { ...entry, confirmed: caught instanceof Error ? caught.message : 'Refused.' } : entry)));
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div style={s.page} className="lv-copilot">
      <FocusStyles theme={theme} />
      <style>{`.lv-copilot input:focus-visible, .lv-copilot button:focus-visible { outline: 2px solid ${theme.color.accent}; outline-offset: 2px; }`}</style>
      <div style={s.container(1100)}>
        <PageHeader theme={theme} title="Copilot" subtitle="Ask about your CRM in plain language. Answers come from structured queries run under your own permissions." right={briefing ? (briefing.ai.available ? <Badge theme={theme} tone="success">AI · {briefing.ai.provider}</Badge> : <Badge theme={theme} tone="warning">AI UNAVAILABLE · rules only</Badge>) : null} />

        <div style={{ display: 'grid', gap: theme.space(4) }}>
          <Section theme={theme} title="Today" hint={briefing ? `${briefing.lens.toLowerCase()} lens · ${briefing.generatedAt.slice(11, 16)} UTC` : undefined}>
            {briefingLoading && !briefing && <LoadingState theme={theme} rows={3} />}
            {briefingError && <ErrorState theme={theme} text={briefingError} onRetry={() => void loadBriefing()} />}
            {briefing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
                <div style={{ fontFamily: theme.font.display, fontSize: theme.font.size.lg, color: theme.color.brand }}>{briefing.headline}</div>
                {briefing.today.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
                    {briefing.today.map((line) => (
                      <button key={line.key} type="button" onClick={() => line.link && void navigate(AppPath.RecordIndexPage, { objectNamePlural: line.link.object === 'lvLead' ? 'lvLeads' : line.link.object === 'task' ? 'tasks' : `${line.link.object}s` })} style={{ ...s.card, padding: `${theme.space(2)}px ${theme.space(3)}px`, cursor: line.link ? 'pointer' : 'default', textAlign: 'left', fontFamily: theme.font.body }}>
                        <span style={{ fontFamily: theme.font.display, fontSize: theme.font.size.lg, color: theme.color.brand, marginRight: 8 }}>{line.count}</span>
                        <span style={{ fontSize: theme.font.size.sm }}>{line.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>Nothing overdue, breached or waiting in your queue.</p>
                )}
                <div>
                  <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', marginBottom: theme.space(1) }}>
                    <strong style={{ fontSize: theme.font.size.sm }}>Top actions</strong>
                    <Badge theme={theme} tone={briefing.narrative.status === 'MODEL' ? 'neutral' : 'info'}>{briefing.narrative.status === 'MODEL' ? 'AI GENERATED · prioritised by the model' : 'COMPUTED · fixed ranking'}</Badge>
                  </div>
                  {briefing.topActions.length === 0 && <p style={{ margin: 0, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>No action is waiting on you.</p>}
                  <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {briefing.topActions.map((action, index) => (
                      <li key={`${index}-${action.title}`} style={{ fontSize: theme.font.size.sm }}>
                        {action.ref ? (
                          <button type="button" onClick={() => openTarget(action.ref?.target)} style={{ background: 'none', border: 'none', padding: 0, color: theme.color.brand, textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>
                            {action.title}
                          </button>
                        ) : (
                          <span>{action.title}</span>
                        )}
                        <span style={{ color: theme.color.textMuted }}> — {action.why}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => void loadBriefing()} disabled={briefingLoading} style={{ ...s.button('secondary'), minHeight: 36 }}>{briefingLoading ? 'Refreshing…' : 'Refresh'}</button>
                </div>
                <p style={{ margin: 0, fontSize: theme.font.size.xs, color: theme.color.textMuted }}>{briefing.notes.join(' ')}</p>
              </div>
            )}
          </Section>

          <Section theme={theme} title="Ask">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void ask(question);
              }}
              style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}
            >
              <label htmlFor="lv-copilot-q" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Question</label>
              <input id="lv-copilot-q" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder="e.g. Which leads are waiting for a response?" style={{ ...s.input, flex: '1 1 260px' }} />
              <button type="submit" disabled={asking || question.trim().length < 2} style={s.button('primary')}>{asking ? 'Thinking…' : 'Ask'}</button>
            </form>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: theme.space(2) }}>
              {EXAMPLES.map((example) => (
                <button key={example} type="button" onClick={() => void ask(example)} disabled={asking} style={{ ...s.button('secondary'), minHeight: 30, padding: '4px 10px', fontSize: theme.font.size.xs }}>
                  {example}
                </button>
              ))}
            </div>
            {asking && <div style={{ marginTop: theme.space(2) }}><LoadingState theme={theme} rows={2} /></div>}
          </Section>

          {history.map((entry, index) => (
            <Section key={`${index}-${entry.question}`} theme={theme} title={entry.question} hint={entry.response ? `${entry.response.intent} · ${entry.response.intentSource === 'MODEL' ? 'understood by the model' : 'understood by rules'}` : undefined}>
              {entry.error && <ErrorState theme={theme} text={entry.error} onRetry={() => void ask(entry.question)} />}
              {entry.response && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
                  {entry.response.refusal && (
                    <div role="status" style={{ ...s.card, border: `1px solid ${theme.color.warning}`, padding: theme.space(2), fontSize: theme.font.size.sm }}>
                      <Badge theme={theme} tone="warning">NOT PERFORMED</Badge> {entry.response.refusal}
                    </div>
                  )}
                  <AnswerBlock theme={theme} label="KNOWN" tone="info" items={entry.response.answer.known} />
                  <AnswerBlock theme={theme} label="INFERRED" tone="warning" items={entry.response.answer.inferred} />
                  <AnswerBlock theme={theme} label="SUGGESTED" tone="success" items={entry.response.answer.suggested} />
                  {entry.response.proposal && !entry.confirmed && (
                    <div style={{ ...s.card, border: `1px solid ${theme.color.accent}`, padding: theme.space(2), display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
                      <div style={{ fontSize: theme.font.size.sm }}><Badge theme={theme} tone="warning">CONFIRM</Badge> {entry.response.proposal.summary}</div>
                      <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
                        <button type="button" disabled={confirming !== null} onClick={() => void confirm(entry.response!.proposal!.proposalId)} style={s.button('primary')}>{confirming === entry.response.proposal.proposalId ? 'Working…' : 'Confirm'}</button>
                        <button type="button" disabled={confirming !== null} onClick={() => void confirm(entry.response!.proposal!.proposalId, true)} style={s.button('secondary')}>Cancel</button>
                      </div>
                      <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>Expires {entry.response.proposal.expiresAt.slice(11, 16)} UTC. Executed with your permissions only after you confirm.</span>
                    </div>
                  )}
                  {entry.confirmed && <div role="status" style={{ fontSize: theme.font.size.sm }}><Badge theme={theme} tone="success">DONE</Badge> {entry.confirmed}</div>}
                  {entry.response.rows.length > 0 && (
                    <ul style={{ margin: 0, padding: 0 }}>
                      {entry.response.rows.map((row) => (
                        <RecordRow key={row.id} theme={theme} primary={row.ref ? `${row.ref} · ${row.title}` : row.title} secondary={row.subtitle ?? undefined} onClick={() => openTarget(row.target)} />
                      ))}
                    </ul>
                  )}
                  {entry.response.totalCount !== null && entry.response.totalCount > entry.response.rows.length && <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>Showing {entry.response.rows.length} of {entry.response.totalCount}.</span>}
                  <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>{(entry.confirmed ? entry.response.notes.filter((note) => !note.startsWith('Nothing has been created')) : entry.response.notes).join(' ')}{entry.response.answerOrigin === 'MODEL' ? ' Explanation text: AI GENERATED, grounded in the rows above.' : ''}</span>
                </div>
              )}
            </Section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_COPILOT_ID,
  name: 'lv-copilot',
  description: 'Permission-aware CRM Copilot with the morning briefing: natural-language questions answered from structured queries; writes only after confirmation',
  component: Copilot,
});
