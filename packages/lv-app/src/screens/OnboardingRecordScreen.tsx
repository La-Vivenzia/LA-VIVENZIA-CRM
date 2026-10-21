import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  ONBOARDING_STATUS_LABELS,
  ONBOARDING_TRANSITIONS,
  PARTNER_EDITABLE,
  summariseDocuments,
  useOnboardingRecord,
  type OnboardingStatus,
} from 'src/api/onboarding';
import { LvIcon } from 'src/design/icons';
import { ErrorState, formatWhen, InlineNotice, isForbiddenMessage, LoadingState, LvButton, LvCard, LvTabs, VisuallyHidden } from 'src/design/kit';
import { LvContextualActions, LvPageHeader, LvRecordHeader, type LvFact } from 'src/design/page';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';
import { DocumentCollection } from 'src/screens/onboarding/documents';
import { LvBlockers, LvJourney, LvReadiness, LvStatusLine } from 'src/screens/onboarding/parts';
import { ReviewWorkspace } from 'src/screens/onboarding/review';
import { StepsSection } from 'src/screens/onboarding/steps';
import { TransitionDialog } from 'src/screens/onboarding/transition';

// 7.2 the record and its progress, with 7.3, 7.4, 7.6 and 7.9 as its
// sections and 7.8 as the action over all of them.
//
// One partner, one screen: where they are, what is in the way, and the one
// thing to do about it. The section is part of the URL so a colleague can be
// sent straight to the documents.

const SECTIONS = [
  { key: 'progress', label: 'Progress' },
  { key: 'documents', label: 'Documents' },
  { key: 'review', label: 'Review' },
  { key: 'form', label: 'The form' },
] as const;

type Section = (typeof SECTIONS)[number]['key'];

/** The one move that matters from here, if there is an obvious one. */
const primaryFor = (status: OnboardingStatus): OnboardingStatus | null => {
  const allowed = ONBOARDING_TRANSITIONS[status];

  for (const candidate of ['APPROVED', 'INTERNAL_REVIEW', 'VERIFICATION', 'ACTIVATED', 'INVITED'] as const) {
    if (allowed.includes(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const OnboardingRecordScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const { onboardingId, section } = useParams<{ onboardingId: string; section?: string }>();
  const { record, error, reload } = useOnboardingRecord(onboardingId);
  const [moving, setMoving] = useState<OnboardingStatus | null | 'ANY'>(null);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  // One clock per render, shared by everything below it, so a list of
  // relative times cannot disagree with itself. Memoising it would freeze
  // "2 minutes ago" for as long as the screen stays open.
  const now = new Date().toISOString();

  const active: Section = SECTIONS.some((entry) => entry.key === section) ? (section as Section) : 'progress';
  const go = (next: Section) => navigate(`/onboarding/${onboardingId}/${next}`, { replace: true });

  if (error !== null && record === null) {
    return (
      <>
        <LvPageHeader theme={theme} variant="panel" title="Onboarding" onBack={() => navigate('/onboarding')} backLabel="Back to the queue" />
        <ErrorState
          theme={theme}
          title={isForbiddenMessage(error) ? 'Your role cannot open this onboarding' : 'That onboarding could not be opened'}
          text={error}
          onRetry={isForbiddenMessage(error) ? undefined : () => void reload()}
        />
      </>
    );
  }

  if (record === null) {
    return (
      <>
        <LvPageHeader theme={theme} variant="panel" title="Onboarding" onBack={() => navigate('/onboarding')} backLabel="Back to the queue" />
        <LoadingState theme={theme} rows={4} label="Loading the onboarding" />
      </>
    );
  }

  const documents = summariseDocuments(record.documents);
  const primary = primaryFor(record.status);
  // 7.9 — waiting for the partner. Not an error and not an empty state: it is
  // the workflow behaving, and the screen should say so rather than offer
  // actions that belong to somebody else.
  const waiting = record.status === 'WAITING_FOR_PARTNER' || (PARTNER_EDITABLE.includes(record.status) && record.status !== 'CHANGES_REQUESTED');

  const facts: LvFact[] = [
    { key: 'status', label: 'Status', value: ONBOARDING_STATUS_LABELS[record.status] },
    { key: 'form', label: 'Form', value: record.progressPercentage === null ? '—' : `${record.progressPercentage}% complete` },
    { key: 'documents', label: 'Documents', value: record.documents.length === 0 ? 'None' : `${documents.verified} of ${documents.total} verified` },
    { key: 'reviewer', label: 'Reviewer', value: record.reviewerName ?? 'Nobody yet' },
    { key: 'submitted', label: 'Submitted', value: record.submittedAt ? formatWhen(record.submittedAt, now) : 'Not submitted' },
  ];

  return (
    <>
      <LvPageHeader
        theme={theme}
        variant="panel"
        title={record.name ?? record.leadName ?? 'Partner onboarding'}
        onBack={() => navigate('/onboarding')}
        backLabel="Back to the queue"
        actions={
          <>
            {record.leadId && (
              <LvButton theme={theme} variant="ghost" onClick={() => navigate(`/leads/${record.leadId}`)} icon={<LvIcon name="leads" size={16} />}>
                Open the lead
              </LvButton>
            )}
            <LvButton theme={theme} variant="secondary" onClick={() => void reload()}>
              Refresh
            </LvButton>
          </>
        }
      />

      <LvRecordHeader
        theme={theme}
        name={record.name ?? record.leadName ?? 'Partner onboarding'}
        typeLabel={record.leadCategory}
        meta={record.leadLocation ? [{ icon: 'location' as const, text: record.leadLocation }] : undefined}
        facts={facts}
      />

      <LvCard theme={theme} padding={4}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
          <LvStatusLine theme={theme} record={record} />
          <LvJourney theme={theme} record={record} onOpenBlockers={() => go('documents')} />
        </div>
      </LvCard>

      {/* A refusal recorded on the record itself — why it was rejected, or
          what was asked for — belongs at the top, not in a history list. */}
      {record.decisionReason && (record.status === 'REJECTED' || record.status === 'CHANGES_REQUESTED') && (
        <InlineNotice theme={theme} tone={record.status === 'REJECTED' ? 'danger' : 'warning'}>
          <strong style={{ color: theme.color.heading }}>{ONBOARDING_STATUS_LABELS[record.status]}:</strong> {record.decisionReason}
        </InlineNotice>
      )}

      {error !== null && <InlineNotice theme={theme} tone="danger">{error}</InlineNotice>}

      <LvTabs
        theme={theme}
        label="Onboarding sections"
        value={active}
        onChange={(next) => go(next as Section)}
        tabs={SECTIONS.map((entry) => ({
          key: entry.key,
          label: entry.label,
          count: entry.key === 'documents' || entry.key === 'review' ? record.documents.length : undefined,
        }))}
      />

      {active === 'progress' && (
        <>
          {waiting && (
            <LvSectionCard theme={theme} title="Waiting for the partner" icon="clock">
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
                <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>
                  There is nothing for La Vivenzia to do until the partner submits. They can still change their answers, and the form is theirs until they
                  send it for verification.
                </p>
                <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>
                  Last change {formatWhen(record.updatedAt, now)}
                  {record.invitedAt ? ` · invited ${formatWhen(record.invitedAt, now)}` : ''}.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
                  <LvButton theme={theme} variant="secondary" size="sm" onClick={() => go('form')}>
                    See what they have filled in
                  </LvButton>
                  <LvButton theme={theme} variant="ghost" size="sm" onClick={() => setMoving('ANY')}>
                    Move it on anyway
                  </LvButton>
                </div>
              </div>
            </LvSectionCard>
          )}

          <LvBlockers theme={theme} record={record} onFix={() => go('documents')} />
          <LvReadiness theme={theme} record={record} />

          <LvSectionCard theme={theme} title="History" icon="clock">
            {record.auditTrail.length === 0 ? (
              <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>Nothing has been recorded against this onboarding yet.</p>
            ) : (
              <ol style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), margin: 0, padding: 0, listStyle: 'none' }}>
                {record.auditTrail
                  .slice()
                  .reverse()
                  .map((entry, index) => (
                    <li key={index} style={{ display: 'flex', gap: theme.space(3) }}>
                      <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex', flex: '0 0 auto', marginTop: 2 }}>
                        <LvIcon name="clock" size={15} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.heading }}>
                          {entry.from ? `${ONBOARDING_STATUS_LABELS[entry.from as OnboardingStatus] ?? entry.from} → ` : ''}
                          {entry.to ? (ONBOARDING_STATUS_LABELS[entry.to as OnboardingStatus] ?? entry.to) : (entry.event ?? 'Change')}
                        </span>
                        <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>
                          {entry.at ? formatWhen(entry.at, now) : 'No time recorded'}
                        </span>
                        {entry.reason && (
                          <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.text, marginTop: 2, overflowWrap: 'anywhere' }}>
                            {entry.reason}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
              </ol>
            )}
          </LvSectionCard>
        </>
      )}

      {active === 'documents' && (
        <DocumentCollection
          theme={theme}
          record={record}
          now={now}
          onReload={() => void reload()}
          onReview={(documentId) => {
            setSelectedDocument(documentId);
            go('review');
          }}
        />
      )}

      {active === 'review' && (
        <ReviewWorkspace theme={theme} record={record} now={now} selectedId={selectedDocument} onSelect={setSelectedDocument} onReload={() => void reload()} />
      )}

      {active === 'form' && <StepsSection theme={theme} record={record} />}

      {/* The one action that moves this partner on, pinned to the foot of a
          phone. Its label is the real transition, never a generic "continue". */}
      {ONBOARDING_TRANSITIONS[record.status].length > 0 && (
        <LvContextualActions theme={theme}>
          <LvButton theme={theme} variant="primary" onClick={() => setMoving(primary ?? 'ANY')}>
            {primary === null ? 'Move this onboarding on' : `${ONBOARDING_STATUS_LABELS[primary]}…`}
          </LvButton>
          {primary !== null && (
            <LvButton theme={theme} variant="ghost" onClick={() => setMoving('ANY')}>
              Other options
            </LvButton>
          )}
        </LvContextualActions>
      )}

      {moving !== null && (
        <TransitionDialog
          theme={theme}
          record={record}
          initial={moving === 'ANY' ? null : moving}
          onClose={() => setMoving(null)}
          onDone={() => void reload()}
        />
      )}

      <VisuallyHidden>{`${record.name ?? 'This onboarding'} is ${ONBOARDING_STATUS_LABELS[record.status]}.`}</VisuallyHidden>
    </>
  );
};
