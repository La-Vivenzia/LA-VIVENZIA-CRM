import { useCallback, useEffect, useState } from 'react';

import {
  DECISION_COPY,
  decideInsight,
  fetchInsights,
  insightList,
  type Insight,
  type InsightDecision,
} from 'src/api/ask';
import { LvIcon } from 'src/design/icons';
import {
  EmptyState,
  Field,
  formatWhen,
  InlineNotice,
  isForbiddenMessage,
  LoadingState,
  LvButton,
  LvTextarea,
  Provenance,
  VisuallyHidden,
} from 'src/design/kit';
import { LvAiUnavailable } from 'src/design/intelligence';
import { LvSheet } from 'src/design/overlay';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';

// 10.4 — deciding on a stored AI suggestion.
//
// `/ai/lead/insights` returns what the assistant has already produced for a
// lead; `/ai/insight/decide` is the only place any of it turns into a CRM
// change, and only because a person said so. Nothing is applied by being
// displayed, and a suggestion nobody has decided stays a suggestion.
//
// The decisions offered are exactly the ones the route accepts for that kind
// of insight — a duplicate is merged or kept, everything else is accepted or
// refused — because a button the route would reject is worse than no button.

const TYPE_LABELS: Record<string, string> = {
  LEAD_SUMMARY: 'Summary of the relationship',
  CLASSIFICATION: 'Suggested category',
  NEXT_BEST_ACTION: 'Suggested next step',
  CONVERSATION_SUMMARY: 'Summary of a conversation',
  PROBLEM_SUGGESTION: 'Possible problem',
  DUPLICATE: 'Possible duplicate',
  ONBOARDING_ASSIST: 'Suggested wording',
  DRAFT: 'Drafted message',
};

/** Which decisions the route will accept for a given insight type. */
const decisionsFor = (insightType: string): InsightDecision[] =>
  insightType === 'DUPLICATE' ? ['MERGED', 'IGNORED', 'CREATED_NEW'] : ['ACCEPTED', 'REJECTED', 'DISMISSED'];

const DecisionSheet = ({
  theme,
  insight,
  onClose,
  onDone,
}: {
  theme: LvTheme;
  insight: Insight;
  onClose: () => void;
  onDone: () => void;
}) => {
  const [choice, setChoice] = useState<InsightDecision | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = decisionsFor(insight.insightType);

  const apply = async () => {
    if (choice === null) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await decideInsight({ insightId: insight.id, decision: choice, note: note.trim() === '' ? null : note.trim() });
      onDone();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That decision was not recorded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LvSheet
      theme={theme}
      title={TYPE_LABELS[insight.insightType] ?? 'Suggestion'}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <LvButton theme={theme} variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </LvButton>
          <LvButton
            theme={theme}
            variant={choice === 'REJECTED' || choice === 'MERGED' ? 'danger' : 'primary'}
            disabled={choice === null}
            busy={busy}
            onClick={() => void apply()}
          >
            {choice === null ? 'Choose a decision' : DECISION_COPY[choice].verb}
          </LvButton>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        <p style={{ ...theme.type.body, color: theme.color.heading, margin: 0, overflowWrap: 'anywhere' }}>{insight.summary ?? 'No summary was stored.'}</p>

        <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
          <legend style={{ ...theme.type.label, color: theme.color.textMuted, padding: 0, marginBottom: theme.space(2) }}>Your decision</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
            {options.map((option) => {
              const active = choice === option;

              return (
                <label
                  key={option}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: theme.space(3),
                    minHeight: 44,
                    padding: theme.space(3),
                    borderRadius: theme.radius.md,
                    border: `1px solid ${active ? theme.color.brand : theme.color.border}`,
                    background: active ? theme.tint.mint.wash : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name={`insight-${insight.id}`}
                    value={option}
                    checked={active}
                    onChange={() => setChoice(option)}
                    style={{ marginTop: 3, width: 18, height: 18, flex: '0 0 auto', accentColor: theme.color.brand }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading }}>
                      {DECISION_COPY[option].verb}
                    </span>
                    <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>{DECISION_COPY[option].consequence}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field theme={theme} label="Note" htmlFor={`insight-note-${insight.id}`} help="Optional. Recorded with your decision.">
          <LvTextarea theme={theme} id={`insight-note-${insight.id}`} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>

        {error && (
          <InlineNotice theme={theme} tone="danger">
            {isForbiddenMessage(error) ? `${error} Applying a suggestion uses your own permissions.` : error}
          </InlineNotice>
        )}
      </div>
    </LvSheet>
  );
};

export const InsightDecisions = ({ theme, leadId }: { theme: LvTheme; leadId: string }) => {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<Insight | null>(null);

  // Lazily: this is a second request behind a tab, and the route explicitly
  // never calls the model, so it is cheap but still not worth making until
  // somebody looks.
  const load = useCallback(async () => {
    setError(null);

    try {
      const reply = await fetchInsights(leadId);

      setInsights(insightList(reply));
      setUnavailable(reply.ai?.available === false ? (reply.ai.reason ?? 'The assistant is not configured.') : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The suggestions could not be loaded.');
      setInsights([]);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (insights === null && error === null) {
    return (
      <LvSectionCard theme={theme} title="Suggestions" icon="sparkle">
        <LoadingState theme={theme} rows={2} label="Loading suggestions" />
      </LvSectionCard>
    );
  }

  const undecided = (insights ?? []).filter((insight) => insight.humanDecision === null);
  const decided = (insights ?? []).filter((insight) => insight.humanDecision !== null);

  return (
    <>
      <LvSectionCard
        theme={theme}
        title={`Suggestions (${undecided.length})`}
        icon="sparkle"
        action={
          <LvButton theme={theme} variant="ghost" size="sm" onClick={() => void load()}>
            Refresh
          </LvButton>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
          {error && (
            <InlineNotice theme={theme} tone="danger">
              {isForbiddenMessage(error) ? `${error} Suggestions are shown to the roles that own the pipeline.` : error}
            </InlineNotice>
          )}

          {unavailable && <LvAiUnavailable theme={theme} reason={unavailable} />}

          {undecided.length === 0 && error === null ? (
            <EmptyState
              theme={theme}
              icon="check"
              tint="mint"
              title="Nothing waiting on you"
              text="The assistant has produced no suggestion about this relationship that still needs a decision."
            />
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), margin: 0, padding: 0, listStyle: 'none' }}>
              {undecided.map((insight) => (
                <li
                  key={insight.id}
                  style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), padding: theme.space(4), borderRadius: theme.radius.lg, border: `1px solid ${theme.color.border}` }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(2) }}>
                    <span style={{ ...theme.type.subheading, fontSize: 15, color: theme.color.heading }}>
                      {TYPE_LABELS[insight.insightType] ?? insight.insightType}
                    </span>
                    <Provenance theme={theme} source="ai" label={insight.origin === 'MODEL' ? 'Written by the assistant' : 'Worked out from records'} />
                    {insight.generatedAt && (
                      <span style={{ ...theme.type.caption, color: theme.color.textSubtle, marginLeft: 'auto' }}>
                        {formatWhen(insight.generatedAt, new Date().toISOString())}
                      </span>
                    )}
                  </div>

                  <p style={{ ...theme.type.bodySmall, color: theme.color.text, margin: 0, overflowWrap: 'anywhere' }}>
                    {insight.summary ?? 'No summary was stored with this suggestion.'}
                  </p>

                  {/* Confidence only when the backend actually recorded one. */}
                  {insight.confidence !== null && (
                    <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>Confidence {Math.round(insight.confidence * 100)}%</span>
                  )}

                  <div>
                    <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setDeciding(insight)} icon={<LvIcon name="check" size={15} />}>
                      Decide
                    </LvButton>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {decided.length > 0 && (
            <p style={{ ...theme.type.caption, color: theme.color.textMuted, margin: 0 }}>
              {decided.length} {decided.length === 1 ? 'suggestion has' : 'suggestions have'} already been decided.
            </p>
          )}
        </div>
      </LvSectionCard>

      {deciding && <DecisionSheet theme={theme} insight={deciding} onClose={() => setDeciding(null)} onDone={() => void load()} />}
      <VisuallyHidden aria-live="polite">{`${undecided.length} suggestions await a decision.`}</VisuallyHidden>
    </>
  );
};
