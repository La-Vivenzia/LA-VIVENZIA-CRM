import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AppPath, navigate, useColorScheme } from 'twenty-sdk/front-component';

import { FC_COPILOT_ID } from 'src/constants/universal-identifiers';
import { ErrorState, InlineNotice, InversePanel, LoadingState, LvBadge, LvButton, LvCard, LvPage, PageHeader, Provenance, RecordList, RecordRow, Section } from 'src/modules/lv-core/ui/kit';
import { type LvTheme, layout, themeFor } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';
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
  <LvBadge theme={theme} tone={tone}>
    {children}
  </LvBadge>
);

// KNOWN / INFERRED / SUGGESTED, each visibly a different kind of statement.
const AnswerBlock = ({ theme, label, tone, items, caption }: { theme: LvTheme; label: string; tone: 'info' | 'warning' | 'success'; items: string[]; caption: string }) =>
  items.length === 0 ? null : (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4, paddingLeft: theme.space(3), borderLeft: `3px solid ${tone === 'info' ? theme.color.info : tone === 'warning' ? theme.color.warning : theme.color.success}` }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Badge theme={theme} tone={tone}>{label}</Badge>
        <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>{caption}</span>
      </div>
      <ul style={{ ...theme.type.body, margin: 0, paddingLeft: 18 }}>
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
    <LvPage theme={theme} maxWidth={1100} className="lv-copilot">
      <PageHeader
        theme={theme}
        eyebrow="Intelligence"
        title="Copilot"
        subtitle="Ask about your CRM in plain language. Answers come from structured queries run under your own permissions."
        right={briefing ? briefing.ai.available ? <Provenance theme={theme} source="ai" detail={`Model narrative via ${briefing.ai.provider}`} /> : <Badge theme={theme} tone="neutral">AI UNAVAILABLE · rules only</Badge> : null}
      />

      <div style={{ display: 'grid', gap: theme.space(4) }}>
        {/* The briefing: the dark anchor of the page. */}
        <InversePanel theme={theme}>
          {briefingLoading && !briefing && <LoadingState theme={theme} rows={3} label="Loading briefing" />}
          {briefingError && <ErrorState theme={theme} text={briefingError} onRetry={() => void loadBriefing()} />}
          {briefing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'baseline' }}>
                <span style={{ ...theme.type.label, color: theme.color.accent }}>Today · {briefing.lens.toLowerCase()} lens</span>
                <span style={{ ...theme.type.caption, color: 'rgba(243,239,231,0.7)' }}>{briefing.generatedAt.slice(11, 16)} UTC</span>
              </div>
              <div style={{ ...theme.type.title, color: theme.color.surfaceInverseText }}>{briefing.headline}</div>
              {briefing.today.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
                  {briefing.today.map((line) => (
                    <button
                      key={line.key}
                      type="button"
                      onClick={() => line.link && void navigate(AppPath.RecordIndexPage, { objectNamePlural: line.link.object === 'lvLead' ? 'lvLeads' : line.link.object === 'task' ? 'tasks' : `${line.link.object}s` })}
                      style={{ background: 'rgba(243,239,231,0.07)', border: '1px solid rgba(243,239,231,0.14)', borderRadius: theme.radius.md, padding: `${theme.space(2)}px ${theme.space(3)}px`, cursor: line.link ? 'pointer' : 'default', textAlign: 'left', fontFamily: theme.font.body, color: theme.color.surfaceInverseText, display: 'flex', alignItems: 'baseline', gap: 8, minHeight: 44 }}
                    >
                      <span style={{ ...theme.type.figure, fontSize: 22, color: theme.color.accent }}>{line.count}</span>
                      <span style={{ ...theme.type.bodySmall }}>{line.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ ...theme.type.bodySmall, margin: 0, color: 'rgba(243,239,231,0.78)' }}>Nothing overdue, breached or waiting in your queue.</p>
              )}
              <div>
                <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', marginBottom: theme.space(1), flexWrap: 'wrap' }}>
                  <span style={{ ...theme.type.label, color: 'rgba(243,239,231,0.7)' }}>Top actions</span>
                  <Provenance theme={theme} inverse source={briefing.narrative.status === 'MODEL' ? 'ai' : 'rules'} label={briefing.narrative.status === 'MODEL' ? 'AI GENERATED · prioritised by the model' : 'COMPUTED · fixed ranking'} />
                </div>
                {briefing.topActions.length === 0 && <p style={{ ...theme.type.bodySmall, margin: 0, color: 'rgba(243,239,231,0.78)' }}>No action is waiting on you.</p>}
                <ol style={{ ...theme.type.body, margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, color: theme.color.surfaceInverseText }}>
                  {briefing.topActions.map((action, index) => (
                    <li key={`${index}-${action.title}`}>
                      {action.ref ? (
                        <button type="button" onClick={() => openTarget(action.ref?.target)} style={{ background: 'none', border: 'none', padding: 0, color: theme.color.accent, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', font: 'inherit' }}>
                          {action.title}
                        </button>
                      ) : (
                        <span>{action.title}</span>
                      )}
                      <span style={{ color: 'rgba(243,239,231,0.7)' }}> — {action.why}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center' }}>
                <LvButton theme={theme} variant="gold" size="sm" onClick={() => void loadBriefing()} disabled={briefingLoading} busy={briefingLoading}>
                  Refresh briefing
                </LvButton>
                <span style={{ ...theme.type.caption, color: 'rgba(243,239,231,0.6)' }}>{briefing.notes.join(' ')}</span>
              </div>
            </div>
          )}
        </InversePanel>

        <Section theme={theme} title="Ask">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(question);
            }}
            style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}
          >
            <label htmlFor="lv-copilot-q" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              Question
            </label>
            <input id="lv-copilot-q" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder="e.g. Which leads are waiting for a response?" style={{ ...s.input, flex: '1 1 260px' }} />
            <LvButton theme={theme} type="submit" variant="primary" disabled={question.trim().length < 2} busy={asking}>
              Ask
            </LvButton>
          </form>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: theme.space(2) }}>
            {EXAMPLES.map((example) => (
              <button key={example} type="button" onClick={() => void ask(example)} disabled={asking} style={{ ...s.button('ghost'), minHeight: 32, padding: '4px 10px', fontSize: theme.font.size.xs, border: `1px solid ${theme.color.border}`, color: theme.color.text }}>
                {example}
              </button>
            ))}
          </div>
          {asking && (
            <div style={{ marginTop: theme.space(2) }}>
              <LoadingState theme={theme} rows={2} label="Thinking" />
            </div>
          )}
          {history.length === 0 && !asking && (
            <p style={{ ...theme.type.bodySmall, margin: `${theme.space(3)}px 0 0`, color: theme.color.textMuted }}>Ask a question or pick an example. Answers always separate what is known from what is inferred and suggested.</p>
          )}
        </Section>

        {history.map((entry, index) => (
          <Section
            key={`${index}-${entry.question}`}
            theme={theme}
            title={entry.question}
            actions={entry.response ? <Provenance theme={theme} source={entry.response.intentSource === 'MODEL' ? 'ai' : 'rules'} detail={`${entry.response.intent} · understood by ${entry.response.intentSource === 'MODEL' ? 'the model' : 'rules'}`} /> : undefined}
          >
            {entry.error && <ErrorState theme={theme} text={entry.error} onRetry={() => void ask(entry.question)} />}
            {entry.response && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
                {entry.response.refusal && (
                  <InlineNotice theme={theme} tone="warning">
                    <Badge theme={theme} tone="warning">NOT PERFORMED</Badge> {entry.response.refusal}
                  </InlineNotice>
                )}
                <AnswerBlock theme={theme} label="KNOWN" tone="info" caption="read from records under your permissions" items={entry.response.answer.known} />
                <AnswerBlock theme={theme} label="INFERRED" tone="warning" caption="a reading of those facts" items={entry.response.answer.inferred} />
                <AnswerBlock theme={theme} label="SUGGESTED" tone="success" caption="a possible next step — yours to decide" items={entry.response.answer.suggested} />
                {entry.response.proposal && !entry.confirmed && (
                  <LvCard theme={theme} tone="warning" padding={theme.space(3)} style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), background: theme.color.surfaceRaised }}>
                    <div style={{ ...theme.type.body }}>
                      <Badge theme={theme} tone="warning">CONFIRM</Badge> {entry.response.proposal.summary}
                    </div>
                    <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
                      <LvButton theme={theme} variant="primary" disabled={confirming !== null} busy={confirming === entry.response.proposal.proposalId} onClick={() => void confirm(entry.response!.proposal!.proposalId)}>
                        Confirm
                      </LvButton>
                      <LvButton theme={theme} variant="ghost" disabled={confirming !== null} onClick={() => void confirm(entry.response!.proposal!.proposalId, true)}>
                        Cancel
                      </LvButton>
                    </div>
                    <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>Expires {entry.response.proposal.expiresAt.slice(11, 16)} UTC. Executed with your permissions only after you confirm.</span>
                  </LvCard>
                )}
                {entry.confirmed && (
                  <div role="status" style={{ ...theme.type.bodySmall }}>
                    <Badge theme={theme} tone="success">DONE</Badge> {entry.confirmed}
                  </div>
                )}
                {entry.response.rows.length > 0 && (
                  <RecordList>
                    {entry.response.rows.map((row) => (
                      <RecordRow key={row.id} theme={theme} primary={row.ref ? `${row.ref} · ${row.title}` : row.title} secondary={row.subtitle ?? undefined} onClick={() => openTarget(row.target)} />
                    ))}
                  </RecordList>
                )}
                {entry.response.totalCount !== null && entry.response.totalCount > entry.response.rows.length && <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>Showing {entry.response.rows.length} of {entry.response.totalCount}.</span>}
                <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>
                  {(entry.confirmed ? entry.response.notes.filter((note) => !note.startsWith('Nothing has been created')) : entry.response.notes).join(' ')}
                  {entry.response.answerOrigin === 'MODEL' ? ' Explanation text: AI generated, grounded in the rows above.' : ''}
                </span>
              </div>
            )}
          </Section>
        ))}
      </div>
    </LvPage>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_COPILOT_ID,
  name: 'lv-copilot',
  description: 'Permission-aware CRM Copilot with the morning briefing: natural-language questions answered from structured queries; writes only after confirmation',
  component: Copilot,
});
