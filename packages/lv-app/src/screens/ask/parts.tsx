import {
  cancelProposal,
  confirmProposal,
  linkFor,
  OBJECT_LABELS,
  type AskReply,
  type Proposal,
  type ResultRow,
} from 'src/api/ask';
import { LvIcon } from 'src/design/icons';
import { EmptyState, formatWhen, InlineNotice, LvBadge, LvButton, Provenance, VisuallyHidden } from 'src/design/kit';
import { LvSheet } from 'src/design/overlay';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';
import { useState } from 'react';

// The pieces of an answer.
//
// The three parts are kept apart on purpose. "Known" came out of records the
// person can see; "inferred" is arithmetic over those records; "suggested" is
// the assistant's opinion. Flattening them into one paragraph is exactly how
// a CRM starts telling people things that are not true.

/** The records an answer was built from, each openable if the app has a screen for it. */
export const ResultRows = ({ theme, rows, totalCount, onOpen }: { theme: LvTheme; rows: ResultRow[]; totalCount: number | null; onOpen: (path: string) => void }) => {
  if (rows.length === 0) {
    return null;
  }

  return (
    <LvSectionCard theme={theme} title={totalCount !== null && totalCount > rows.length ? `Records (${rows.length} of ${totalCount})` : `Records (${rows.length})`} icon="leads">
      <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
        {rows.map((row, index) => {
          const href = linkFor(row.target);
          const body = (
            <>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.space(2), flexWrap: 'wrap' }}>
                  <span style={{ ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading, overflowWrap: 'anywhere' }}>
                    {row.title}
                  </span>
                  {row.ref && <span style={{ ...theme.type.caption, color: theme.color.textSubtle }}>{row.ref}</span>}
                </span>
                {row.subtitle && <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>{row.subtitle}</span>}
              </span>
              <LvBadge theme={theme} tone="neutral">{OBJECT_LABELS[row.target.object] ?? row.target.object}</LvBadge>
            </>
          );

          return (
            <li key={`${row.id}-${index}`}>
              {href ? (
                <button
                  type="button"
                  onClick={() => onOpen(href)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.space(3),
                    width: '100%',
                    minHeight: 48,
                    padding: theme.space(3),
                    borderRadius: theme.radius.md,
                    border: `1px solid ${theme.color.border}`,
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: theme.font.body,
                  }}
                >
                  {body}
                  <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
                    <LvIcon name="chevronRight" size={16} />
                  </span>
                </button>
              ) : (
                // No screen for this object yet, so it is named but not
                // offered as a link that would go nowhere.
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), padding: theme.space(3), borderRadius: theme.radius.md, border: `1px solid ${theme.color.border}` }}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </LvSectionCard>
  );
};

/** Where the answer came from, said quietly rather than badged as magic. */
export const AnswerProvenance = ({ theme, reply }: { theme: LvTheme; reply: AskReply }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(2) }}>
    <Provenance
      theme={theme}
      source={reply.answerOrigin === 'MODEL' ? 'ai' : 'rules'}
      label={reply.answerOrigin === 'MODEL' ? 'Written by the assistant from your records' : 'Read directly from your records'}
    />
    {reply.intentSource === 'MODEL' && (
      <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>The assistant interpreted the question.</span>
    )}
  </div>
);

/**
 * 10.3 — the confirmation.
 *
 * A consequential request never runs when it is asked for. It comes back as a
 * proposal, and this is where a person decides. The summary is the server's
 * own words; the consequence is what the confirm route will actually do.
 */
export const ProposalSheet = ({
  theme,
  proposal,
  onClose,
  onDone,
}: {
  theme: LvTheme;
  proposal: Proposal;
  onClose: () => void;
  onDone: (result: string) => void;
}) => {
  const [busy, setBusy] = useState<'RUN' | 'CANCEL' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const expired = Date.parse(proposal.expiresAt) < Date.now();
  const unsupported = proposal.action.kind === 'UNSUPPORTED_ACTION';

  const run = async (mode: 'RUN' | 'CANCEL') => {
    setBusy(mode);
    setError(null);

    try {
      const result = mode === 'RUN' ? await confirmProposal(proposal.proposalId) : await cancelProposal(proposal.proposalId);

      onDone(result.status === 'CONFIRMED' ? 'Done.' : 'Cancelled — nothing was created.');
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That could not be applied.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <LvSheet
      theme={theme}
      title="Before this runs"
      onClose={busy === null ? onClose : () => undefined}
      footer={
        unsupported ? (
          <LvButton theme={theme} variant="secondary" onClick={onClose}>
            Close
          </LvButton>
        ) : (
          <>
            <LvButton theme={theme} variant="ghost" onClick={() => void run('CANCEL')} busy={busy === 'CANCEL'} disabled={expired}>
              Cancel it
            </LvButton>
            <LvButton theme={theme} variant="primary" onClick={() => void run('RUN')} busy={busy === 'RUN'} disabled={expired}>
              Do it
            </LvButton>
          </>
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        <p style={{ ...theme.type.body, color: theme.color.heading, margin: 0, overflowWrap: 'anywhere' }}>{proposal.summary}</p>

        {unsupported ? (
          <InlineNotice theme={theme} tone="warning">
            {proposal.action.kind === 'UNSUPPORTED_ACTION' ? proposal.action.whyNot : 'Ask LV cannot do that.'}
          </InlineNotice>
        ) : (
          <InlineNotice theme={theme}>
            {proposal.action.kind === 'CREATE_TASK'
              ? 'Creates one task, assigned to you and linked to that record. Nothing else is touched.'
              : 'Adds one note to that record. Nothing else is touched.'}{' '}
            It runs with your own permissions, so anything your role cannot do will still be refused.
          </InlineNotice>
        )}

        {expired ? (
          <InlineNotice theme={theme} tone="warning">
            This proposal has expired — they last fifteen minutes. Ask again to get a fresh one.
          </InlineNotice>
        ) : (
          <p style={{ ...theme.type.caption, color: theme.color.textMuted, margin: 0 }}>
            Expires {formatWhen(proposal.expiresAt, new Date().toISOString())}.
          </p>
        )}

        {error && <InlineNotice theme={theme} tone="danger">{error}</InlineNotice>}
      </div>
    </LvSheet>
  );
};

/** 10.5 — the assistant cannot answer, said without pretending otherwise. */
export const AiUnavailableState = ({ theme, reason, onRetry }: { theme: LvTheme; reason: string; onRetry?: () => void }) => (
  <LvSectionCard theme={theme} title="The assistant is unavailable" icon="info">
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
      <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>{reason}</p>
      <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>
        Questions that a rule recognises are still answered — those read your records directly and need no model at all. Only questions that have to be
        interpreted, and prose the assistant would have written, are affected.
      </p>
      {onRetry && (
        <div>
          <LvButton theme={theme} variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </LvButton>
        </div>
      )}
      <VisuallyHidden>The assistant is unavailable. {reason}</VisuallyHidden>
    </div>
  </LvSectionCard>
);

/** Nothing matched. Distinct from an error and from an unavailable model. */
export const NoResult = ({ theme, question, onAskAgain }: { theme: LvTheme; question: string; onAskAgain: () => void }) => (
  <LvSectionCard theme={theme} title="Nothing to show" icon="search">
    <EmptyState
      theme={theme}
      icon="search"
      tint="blue"
      title="No records matched that"
      text={`Nothing you can see matches “${question}”. Someone else may hold records that do — Ask LV only ever searches what your role can open.`}
      action={
        <LvButton theme={theme} variant="secondary" size="sm" onClick={onAskAgain}>
          Ask something else
        </LvButton>
      }
    />
  </LvSectionCard>
);
