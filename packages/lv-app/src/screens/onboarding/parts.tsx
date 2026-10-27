import {
  blockersFor,
  DOCUMENT_STATE_LABELS,
  ONBOARDING_JOURNEY,
  ONBOARDING_STATUS_LABELS,
  PARTNER_EDITABLE,
  stageOf,
  summariseDocuments,
  UNDER_REVIEW,
  type OnboardingRecord,
  type OnboardingStatus,
} from 'src/api/onboarding';
import { DOCUMENT_STATE_TONE } from 'src/design/onboarding';
import { LvIcon, type LvIconName } from 'src/design/icons';
import { formatWhen, KpiTile, LvBadge, LvButton, LvProgress, LvSteps, type LvStep, type Tone } from 'src/design/kit';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme, type LvTint } from 'src/design/theme';

// The three questions every onboarding screen has to answer at a glance:
// where is this partner, what is blocking them, and what happens next.

export const STATUS_TONE: Record<OnboardingStatus, Tone> = {
  NOT_STARTED: 'neutral',
  INVITED: 'info',
  INITIATED: 'info',
  IN_PROGRESS: 'info',
  WAITING_FOR_PARTNER: 'warning',
  VERIFICATION: 'info',
  INTERNAL_REVIEW: 'info',
  CHANGES_REQUESTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  ACTIVATED: 'success',
};

/**
 * Computes the visual steps for the five-stage onboarding journey.
 * A stage is marked done if earlier than current; blocked if current and has
 * stopping blockers; current if active without blockers; todo if future.
 */
export const journeyStepsFor = (record: OnboardingRecord, onOpenBlockers?: () => void): LvStep[] => {
  const current = stageOf(record.status);
  const blockers = blockersFor(record);
  // A blocker that stops the partner moving on is the stage's problem; one
  // that only says "they can still edit" is not, it is the stage working.
  const stopping = blockers.filter((blocker) => blocker.kind !== 'PARTNER');

  return ONBOARDING_JOURNEY.map((stage, index) => {
    const isCurrent = index === current;
    const state: LvStep['state'] = index < current ? 'done' : isCurrent ? (stopping.length > 0 ? 'blocked' : 'current') : 'todo';

    return {
      key: stage.key,
      label: stage.label,
      state,
      detail: isCurrent ? (stopping.length > 0 ? stopping[0].text : stage.meaning) : null,
      onOpen: isCurrent && stopping.length > 0 && onOpenBlockers ? onOpenBlockers : undefined,
    };
  });
};

/**
 * The journey, drawn from the status the record actually holds.
 *
 * A stage is blocked rather than merely current when the server would refuse
 * the move out of it — an unverified document, a missing required answer, no
 * named reviewer. Nothing is marked done that the data does not say is done.
 */
export const LvJourney = ({ theme, record, onOpenBlockers }: { theme: LvTheme; record: OnboardingRecord; onOpenBlockers?: () => void }) => {
  const steps = journeyStepsFor(record, onOpenBlockers);

  // Rejected is not a stage: the machine lets a rejected partner reapply, so
  // it is said beside the journey rather than drawn as its end.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
      <LvSteps theme={theme} label="Onboarding journey" steps={steps} />
      {record.status === 'REJECTED' && (
        <p style={{ ...theme.type.bodySmall, color: theme.color.danger, margin: 0 }}>
          This onboarding was rejected{record.decidedAt ? ` ${formatWhen(record.decidedAt, new Date().toISOString())}` : ''}. It is not closed — the partner can
          be put back in progress and the history is kept.
        </p>
      )}
    </div>
  );
};

/** Where this partner is, in one line, with the words the backend uses. */
export const LvStatusLine = ({ theme, record }: { theme: LvTheme; record: OnboardingRecord }) => {
  const stage = ONBOARDING_JOURNEY[stageOf(record.status)];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(2) }}>
      <LvBadge theme={theme} tone={STATUS_TONE[record.status]}>
        {ONBOARDING_STATUS_LABELS[record.status]}
      </LvBadge>
      {stage && <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{stage.meaning}</span>}
      {PARTNER_EDITABLE.includes(record.status) && (
        <LvBadge theme={theme} tone="neutral">Partner can edit</LvBadge>
      )}
      {UNDER_REVIEW.includes(record.status) && <LvBadge theme={theme} tone="info">Locked for review</LvBadge>}
    </div>
  );
};

/**
 * Readiness. Progress and health are numbers the server stored; the document
 * counts are read off the documents themselves. None of it is predicted and
 * none of it is described as intelligence.
 */
export const LvReadiness = ({ theme, record }: { theme: LvTheme; record: OnboardingRecord }) => {
  const documents = summariseDocuments(record.documents);

  return (
    <LvSectionCard theme={theme} title="Readiness" icon="chart">
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        <div>
          <span style={{ ...theme.type.label, color: theme.color.textMuted, display: 'block', marginBottom: 6 }}>Form completed</span>
          {record.progressPercentage === null ? (
            <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>The server has not recorded a progress figure for this onboarding.</p>
          ) : (
            <LvProgress theme={theme} percentage={record.progressPercentage} caption="Share of the nine steps that carry answers" />
          )}
        </div>

        <div>
          <span style={{ ...theme.type.label, color: theme.color.textMuted, display: 'block', marginBottom: 6 }}>Health score</span>
          {record.healthScore === null ? (
            <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>Not scored yet.</p>
          ) : (
            <LvProgress theme={theme} percentage={record.healthScore} caption="Required answers, detail, photographs and verified documents" />
          )}
        </div>

        <div>
          <span style={{ ...theme.type.label, color: theme.color.textMuted, display: 'block', marginBottom: 6 }}>Documents</span>
          {documents.total === 0 ? (
            <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>None uploaded yet.</p>
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: 0, padding: 0, listStyle: 'none' }}>
              {(
                [
                  ['VERIFIED', documents.verified],
                  ['UNDER_REVIEW', documents.underReview],
                  ['PENDING', documents.pending],
                  ['REJECTED', documents.rejected],
                  ['EXPIRED', documents.expired],
                  ['NEEDS_REPLACEMENT', documents.needsReplacement],
                ] as const
              )
                .filter(([, count]) => count > 0)
                .map(([state, count]) => (
                  <li key={state} style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), ...theme.type.bodySmall, color: theme.color.text }}>
                    <LvBadge theme={theme} tone={DOCUMENT_STATE_TONE[state]}>{DOCUMENT_STATE_LABELS[state]}</LvBadge>
                    <span>{count}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </LvSectionCard>
  );
};

/**
 * What is in the way, and what would clear it. Every entry mirrors a refusal
 * the server would actually give, so nothing here is a warning invented by
 * the screen.
 */
export const LvBlockers = ({ theme, record, onFix }: { theme: LvTheme; record: OnboardingRecord; onFix?: (kind: string) => void }) => {
  const blockers = blockersFor(record);

  if (blockers.length === 0) {
    return null;
  }

  return (
    <LvSectionCard theme={theme} title="What is holding this up" icon="warning">
      <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), margin: 0, padding: 0, listStyle: 'none' }}>
        {blockers.map((blocker, index) => (
          <li key={`${blocker.kind}-${index}`} style={{ display: 'flex', gap: theme.space(3) }}>
            <span
              aria-hidden="true"
              style={{ color: blocker.kind === 'PARTNER' ? theme.color.textSubtle : theme.color.warning, display: 'inline-flex', flex: '0 0 auto', marginTop: 2 }}
            >
              <LvIcon name={blocker.kind === 'PARTNER' ? 'info' : 'warning'} size={17} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.heading, overflowWrap: 'anywhere' }}>{blocker.text}</span>
              <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>{blocker.fix}</span>
            </span>
            {onFix && blocker.kind === 'DOCUMENT' && (
              <LvButton theme={theme} variant="ghost" size="sm" onClick={() => onFix(blocker.kind)}>
                Documents
              </LvButton>
            )}
          </li>
        ))}
      </ul>
    </LvSectionCard>
  );
};

/** The counts a manager scans the queue by. */
export const LvQueueCounts = ({
  theme,
  counts,
  onPick,
}: {
  theme: LvTheme;
  counts: { label: string; value: number; tone?: Tone; hint?: string; key: string; icon?: LvIconName; tint?: LvTint }[];
  onPick?: (key: string) => void;
}) => (
  <div className="lv-kpi-grid">
    {counts.map((count) => (
      <KpiTile
        key={count.key}
        theme={theme}
        label={count.label}
        value={count.value}
        emptyText="None"
        tone={count.tone}
        hint={count.hint}
        icon={count.icon}
        tint={count.tint}
        onClick={onPick ? () => onPick(count.key) : undefined}
      />
    ))}
  </div>
);
