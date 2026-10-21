import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { EXAMPLE_QUESTIONS, useAsk } from 'src/api/ask';
import { LvIcon, type LvIconName } from 'src/design/icons';
import {
  ErrorState,
  InlineNotice,
  isForbiddenMessage,
  LvButton,
  LvCard,
  LvStageWait,
  VisuallyHidden,
} from 'src/design/kit';
import { LvAiAnswer } from 'src/design/intelligence';
import { LvPageHeader } from 'src/design/page';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme, type LvTint } from 'src/design/theme';
import { AiUnavailableState, AnswerProvenance, NoResult, ProposalSheet, ResultRows } from 'src/screens/ask/parts';

// Ask LV — 10.1 the question, 10.2 the answer, 10.3 the confirmation,
// 10.5 the unavailable state. (10.4, deciding on a stored suggestion, lives
// on the relationship it belongs to — see `screens/ask/insights.tsx`.)
//
// This is not a chat. There is no transcript, no persona and no typing
// indicator, because the backend has no conversation: each question is
// answered on its own from records the asker can see, and the answer is the
// screen. Turning that into a chat log would imply a memory that does not
// exist. What the redesign changes is the *surface* — a focused assistant
// composer rather than a page of form controls — while keeping that honesty:
// the composer replaces its own answer rather than stacking a history.
//
// The three parts of an answer stay apart. Known came out of records;
// inferred is arithmetic over them; suggested is an opinion. `LvAiAnswer`
// has laid them out that way since Phase 0.

// A tint and a glyph per prompt starter, zipped by position with
// EXAMPLE_QUESTIONS. Decorative: the question already says it.
const STARTER_ICONS: LvIconName[] = ['today', 'leads', 'document', 'clock'];
const STARTER_TINTS: LvTint[] = ['mint', 'blue', 'lavender', 'peach'];

// The composer. One rounded surface holding the field and the send control
// together — the modern assistant shape — carrying its own focus glow from
// `.lv-ask-composer:focus-within`. It is the same box in every phase, because
// the next question is always the most likely next action.
const AskComposer = ({
  theme,
  question,
  setQuestion,
  onSubmit,
  onClear,
  busy,
  showClear,
}: {
  theme: LvTheme;
  question: string;
  setQuestion: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  busy: boolean;
  showClear: boolean;
}) => {
  const composing = useRef(false);
  const canSend = question.trim().length >= 2 && !busy;

  // Enter sends; Shift+Enter is a newline. Guard the IME composition so a
  // half-finished character does not submit.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !composing.current) {
      event.preventDefault();
      if (canSend) onSubmit();
    }
  };

  return (
    <form
      className="lv-ask-composer"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <label htmlFor="ask-question" style={{ ...theme.type.label, color: theme.color.textMuted, padding: `0 ${theme.space(1)}px` }}>
        Your question
      </label>
      <textarea
        id="ask-question"
        className="lv-ask-input"
        rows={2}
        maxLength={500}
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={onKeyDown}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        placeholder="Ask about your leads, onboardings, documents or work…"
        disabled={busy}
        aria-label="Your question"
      />
      <div className="lv-ask-composer-foot">
        <span style={{ ...theme.type.caption, color: theme.color.textSubtle }}>
          {busy ? 'Reading your records…' : `${question.length}/500`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
          {showClear && (
            <button
              type="button"
              className="lv-text-button"
              onClick={onClear}
              disabled={busy}
              style={{ ...theme.type.bodySmall, background: 'transparent', border: 'none', color: theme.color.textMuted, cursor: 'pointer', fontWeight: theme.font.weight.medium }}
            >
              Clear
            </button>
          )}
          <button type="submit" className="lv-ask-send" disabled={!canSend} aria-label="Ask" title="Ask (Enter)">
            <LvIcon name="chevronUp" size={20} weight={2.4} />
          </button>
        </div>
      </div>
    </form>
  );
};

// Prompt starters — elegant entry points, each matching a rule the backend
// can answer. Not a wall of chips: four cards, a tinted glyph, the question,
// and the reason it is safe to show.
const PromptStarters = ({ theme, onPick }: { theme: LvTheme; onPick: (text: string) => void }) => (
  <section aria-label="Things Ask LV can answer" style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), padding: `0 ${theme.space(1)}px` }}>
      <LvIcon name="sparkle" size={15} colour={theme.color.accentInk} />
      <span style={{ ...theme.type.label, color: theme.color.textMuted }}>Try asking</span>
    </div>
    <div className="lv-ask-starter-grid">
      {EXAMPLE_QUESTIONS.map((example, index) => {
        const tint = theme.tint[STARTER_TINTS[index % STARTER_TINTS.length]];
        return (
          <button key={example.text} type="button" className="lv-ask-starter" onClick={() => onPick(example.text)}>
            <span
              aria-hidden="true"
              style={{
                width: 40,
                height: 40,
                flex: '0 0 auto',
                borderRadius: theme.radius.md,
                background: tint.wash,
                color: tint.ink,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LvIcon name={STARTER_ICONS[index % STARTER_ICONS.length]} size={19} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ ...theme.type.bodySmall, color: theme.color.heading, fontWeight: theme.font.weight.bold }}>{example.text}</span>
              <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>{example.why}</span>
            </span>
            <LvIcon name="chevronRight" size={18} style={{ marginLeft: 'auto', flex: '0 0 auto' }} />
          </button>
        );
      })}
    </div>
  </section>
);

export const AskScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const { phase, question, setQuestion, asked, reply, error, ask, reset, retry } = useAsk();
  const [proposalOpen, setProposalOpen] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  const unavailable = reply?.ai.available === false;
  const empty = reply !== null && reply.rows.length === 0 && reply.answer.known.length === 0 && reply.answer.inferred.length === 0 && reply.answer.suggested.length === 0;

  const lines = (values: string[]) =>
    values.length === 1 ? (
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{values[0]}</p>
    ) : (
      <ul style={{ margin: 0, paddingLeft: theme.space(4), display: 'flex', flexDirection: 'column', gap: 4 }}>
        {values.map((value, index) => (
          <li key={index} style={{ whiteSpace: 'pre-wrap' }}>
            {value}
          </li>
        ))}
      </ul>
    );

  return (
    <div className="lv-ask-shell">
      {/* The entrance. A calm, centred assistant greeting on the empty state;
          once a question is asked the header becomes the answer's title with a
          way back to a fresh question. */}
      {phase === 'IDLE' ? (
        <div className="lv-ask-hero">
          <span
            aria-hidden="true"
            style={{
              width: 60,
              height: 60,
              borderRadius: theme.radius.xl,
              background: `linear-gradient(140deg, ${theme.color.brand}, ${theme.color.brandHover})`,
              color: theme.color.accent,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: theme.shadow.md,
            }}
          >
            <LvIcon name="sparkle" size={28} />
          </span>
          <h1 style={{ ...theme.type.display, color: theme.color.heading, margin: 0 }}>Ask LV</h1>
          <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: 0, maxWidth: 520 }}>
            Ask about your leads, onboardings, documents and work. Answers are read from the records you can already open — never from anywhere
            else.
          </p>
        </div>
      ) : (
        <LvPageHeader theme={theme} variant="panel" title={reply?.title ?? 'Ask LV'} onBack={reset} backLabel="Ask something else" />
      )}

      {/* 10.1 — the composer, present in every phase. */}
      <AskComposer
        theme={theme}
        question={question}
        setQuestion={setQuestion}
        onSubmit={() => void ask(question)}
        onClear={reset}
        busy={phase === 'ASKING'}
        showClear={phase !== 'IDLE'}
      />

      {phase === 'IDLE' && <PromptStarters theme={theme} onPick={(text) => void ask(text)} />}

      {phase === 'ASKING' && (
        <LvCard theme={theme} padding={7}>
          <LvStageWait
            theme={theme}
            icon="search"
            tint="lavender"
            title="Reading your records"
            detail={`Working out what “${asked}” is asking for, then running it against the records your role can open. Nothing is changed by asking.`}
            announce="Working on your question"
          />
        </LvCard>
      )}

      {phase === 'FAILED' && error !== null && (
        <ErrorState
          theme={theme}
          title={isForbiddenMessage(error) ? 'Your role cannot ask that' : 'That question could not be answered'}
          text={error}
          onRetry={isForbiddenMessage(error) ? undefined : retry}
        />
      )}

      {outcome && <InlineNotice theme={theme} tone="success">{outcome}</InlineNotice>}

      {phase === 'ANSWERED' && reply && (
        <>
          {/* A refusal is the server declining to do something, and it says
              what the human path is. It is not an error. */}
          {reply.refusal && <InlineNotice theme={theme} tone="warning">{reply.refusal}</InlineNotice>}

          {/* 10.5 — said where it matters, without blanking the answer: a
              rules-answered question is still perfectly good. */}
          {unavailable && <AiUnavailableState theme={theme} reason={reply.ai.reason ?? 'The assistant is not configured.'} onRetry={retry} />}

          {empty && !reply.refusal ? (
            <NoResult theme={theme} question={asked ?? ''} onAskAgain={reset} />
          ) : (
            (reply.answer.known.length > 0 || reply.answer.inferred.length > 0 || reply.answer.suggested.length > 0) && (
              <LvSectionCard theme={theme} title="The answer" icon="sparkle">
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
                  <AnswerProvenance theme={theme} reply={reply} />
                  <LvAiAnswer
                    theme={theme}
                    known={reply.answer.known.length > 0 ? lines(reply.answer.known) : <span style={{ color: theme.color.textMuted }}>Nothing was found in your records.</span>}
                    inferred={reply.answer.inferred.length > 0 ? lines(reply.answer.inferred) : undefined}
                    suggested={reply.answer.suggested.length > 0 ? lines(reply.answer.suggested) : undefined}
                  />
                </div>
              </LvSectionCard>
            )
          )}

          <ResultRows theme={theme} rows={reply.rows} totalCount={reply.totalCount} onOpen={(path) => navigate(path)} />

          {/* 10.3 — a consequential request came back as a proposal rather
              than running. */}
          {reply.proposal && (
            <LvSectionCard theme={theme} title="This one needs your say-so" icon="warning">
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
                <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>{reply.proposal.summary}</p>
                <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>
                  Ask LV does not act on its own. Nothing has been created; this is waiting for you.
                </p>
                <div>
                  <LvButton theme={theme} variant="primary" onClick={() => setProposalOpen(true)}>
                    Look at it
                  </LvButton>
                </div>
              </div>
            </LvSectionCard>
          )}

          {/* Whatever the route wanted to tell the person about how it
              answered — truncation, fallbacks, caveats. */}
          {reply.notes.length > 0 && (
            <LvSectionCard theme={theme} title="Worth knowing" icon="info">
              <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(1), margin: 0, paddingLeft: theme.space(4) }}>
                {reply.notes.map((note, index) => (
                  <li key={index} style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>
                    {note}
                  </li>
                ))}
              </ul>
            </LvSectionCard>
          )}

          <VisuallyHidden aria-live="polite">{`Answered: ${reply.title}`}</VisuallyHidden>
        </>
      )}

      {proposalOpen && reply?.proposal && (
        <ProposalSheet
          theme={theme}
          proposal={reply.proposal}
          onClose={() => setProposalOpen(false)}
          onDone={(message) => {
            setOutcome(message);
            // The proposal is spent, so the answer that carried it is stale.
            reset();
          }}
        />
      )}

      {phase === 'IDLE' && (
        <p style={{ ...theme.type.caption, color: theme.color.textSubtle, margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center' }}>
          <LvIcon name="info" size={13} /> Ask LV reads only what your own role can open — it cannot be talked into seeing more.
        </p>
      )}
    </div>
  );
};
