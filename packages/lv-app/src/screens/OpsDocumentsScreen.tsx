import { useControlTower, type ListSection } from 'src/api/ops';
import { InlineNotice, LvCard } from 'src/design/kit';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';
import { CountBars, DefinitionsCard, OpsShell, OpsState, PartialNotice, RefreshAction, SectionList } from 'src/screens/ops/parts';

// 12.5 — Document verification backlog: what reviewers owe.
//
// `breakdown.documentsByState` is the queue by state, and the `approvals` and
// `expiredDocuments` sections are the records themselves. All of it comes from
// the admin Control Tower route, so a role without it reads the route's own
// refusal rather than an empty queue.

const DOC_STATE_LABELS: Record<string, string> = {
  PENDING: 'Pending review',
  UNDER_REVIEW: 'Under review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  NEEDS_REPLACEMENT: 'Needs replacement',
  EXPIRED: 'Expired',
};

/** What a reviewer still owes, as opposed to what is already settled. */
const OWED = new Set(['PENDING', 'UNDER_REVIEW', 'NEEDS_REPLACEMENT', 'EXPIRED']);

export const OpsDocumentsScreen = ({ theme }: { theme: LvTheme }) => {
  const { data, loading, error, forbidden, reload } = useControlTower();
  const state = OpsState({ theme, loading, error, forbidden, onRetry: reload, label: 'the verification backlog' });

  const byState = data?.breakdown.documentsByState ?? [];
  const owed = byState.filter((row) => OWED.has(row.key)).reduce((sum, row) => sum + row.count, 0);
  const sections = [
    ...(data?.sections ?? []).filter((section) => section.key === 'approvals'),
    ...(data?.ecosystem?.sections ?? []).filter((section) => section.key === 'expiredDocuments'),
  ] as ListSection[];

  return (
    <OpsShell
      theme={theme}
      section="documents"
      title="Verification backlog"
      subtitle="What reviewers owe, and what is already settled."
      actions={<RefreshAction theme={theme} onRefresh={reload} />}
    >
      {state ?? (
        data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(5) }}>
            <PartialNotice theme={theme} partial={[...data.partial, ...(data.ecosystem?.partial ?? [])]} />

            <LvCard theme={theme} tone={owed > 0 ? 'warning' : undefined}>
              <p style={{ ...theme.type.body, margin: 0, color: theme.color.text }}>
                {owed === 0
                  ? 'Nothing is waiting on a reviewer.'
                  : `${owed} document${owed === 1 ? '' : 's'} ${owed === 1 ? 'is' : 'are'} waiting on a reviewer.`}
              </p>
            </LvCard>

            <LvSectionCard theme={theme} title="The queue by state" icon="document">
              <CountBars
                theme={theme}
                caption="Documents by state"
                rows={byState}
                labelFor={(row) => DOC_STATE_LABELS[row.key] ?? row.key}
                toneFor={(row) =>
                  row.key === 'REJECTED' || row.key === 'EXPIRED'
                    ? 'danger'
                    : row.key === 'PENDING' || row.key === 'NEEDS_REPLACEMENT'
                      ? 'warning'
                      : row.key === 'VERIFIED'
                        ? 'success'
                        : 'neutral'
                }
              />
            </LvSectionCard>

            {sections.length > 0 && (
              <div className="lv-ops-grid" style={{ display: 'grid', gap: theme.space(4) }}>
                {sections.map((section) => (
                  <SectionList key={section.key} theme={theme} section={section} tone="warning" />
                ))}
              </div>
            )}

            <LvCard theme={theme}>
              <InlineNotice theme={theme}>
                A decision is made on the record itself, where the file and its history are — this page is the queue, not the review.
              </InlineNotice>
            </LvCard>

            <DefinitionsCard theme={theme} notes={data.notes} generatedAt={data.generatedAt} />
          </div>
        )
      )}
    </OpsShell>
  );
};
