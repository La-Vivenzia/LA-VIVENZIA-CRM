import { useControlTower } from 'src/api/ops';
import { InlineNotice, LvCard } from 'src/design/kit';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';
import { CountBars, DefinitionsCard, KpiRow, OpsShell, OpsState, PartialNotice, RefreshAction } from 'src/screens/ops/parts';

// 12.2 — Pipeline & conversion.
//
// Lifecycle counts and movement, from the same admin route the Control Tower
// reads: `breakdown.leadsByStatus`, `breakdown.onboardingByStatus` and the
// ecosystem's own pipeline figures.
//
// There is no conversion *rate* here, and that is deliberate. The backend
// stores counts in each state at this moment; it keeps no history of a lead
// moving between states, so a rate or a trend would be a number this product
// cannot stand behind. The movement that is real — what is incomplete, blocked
// or waiting — is shown as the server counts it.

const sentence = (value: string): string => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');

export const OpsPipelineScreen = ({ theme }: { theme: LvTheme }) => {
  const { data, loading, error, forbidden, reload } = useControlTower();
  const state = OpsState({ theme, loading, error, forbidden, onRetry: reload, label: 'the pipeline' });

  return (
    <OpsShell
      theme={theme}
      section="pipeline"
      title="Pipeline & conversion"
      subtitle="How many relationships sit in each lifecycle state right now."
      actions={<RefreshAction theme={theme} onRefresh={reload} />}
    >
      {state ?? (
        data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(5) }}>
            <PartialNotice theme={theme} partial={[...data.partial, ...(data.ecosystem?.partial ?? [])]} />

            <div className="lv-ops-grid" style={{ display: 'grid', gap: theme.space(4) }}>
              <LvSectionCard theme={theme} title="Leads by status" icon="leads">
                <CountBars theme={theme} caption="Leads by status" rows={data.breakdown.leadsByStatus} labelFor={(row) => row.label ?? sentence(row.key)} />
              </LvSectionCard>

              <LvSectionCard theme={theme} title="Onboarding by status" icon="onboarding">
                <CountBars
                  theme={theme}
                  caption="Onboarding by status"
                  rows={data.breakdown.onboardingByStatus}
                  labelFor={(row) => row.label ?? sentence(row.key)}
                  toneFor={(row) => (row.key === 'REJECTED' ? 'danger' : row.key === 'CHANGES_REQUESTED' || row.key === 'WAITING_FOR_PARTNER' ? 'warning' : row.key === 'ACTIVATED' ? 'success' : 'neutral')}
                />
              </LvSectionCard>
            </div>

            {(data.ecosystem?.onboarding ?? []).length > 0 && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
                <header>
                  <span style={{ ...theme.type.label, color: theme.color.textMuted, display: 'block' }}>Where it is stuck</span>
                  <h2 style={{ ...theme.type.subheading, fontSize: 19, color: theme.color.heading, margin: 0 }}>Onboarding movement</h2>
                </header>
                <KpiRow theme={theme} kpis={data.ecosystem.onboarding ?? []} />
              </section>
            )}

            {((data.ecosystem?.partners ?? []).length > 0 || (data.ecosystem?.experiences ?? []).length > 0 || (data.ecosystem?.properties ?? []).length > 0) && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
                <header>
                  <span style={{ ...theme.type.label, color: theme.color.textMuted, display: 'block' }}>Partners · experiences · properties</span>
                  <h2 style={{ ...theme.type.subheading, fontSize: 19, color: theme.color.heading, margin: 0 }}>Ecosystem</h2>
                </header>
                <KpiRow theme={theme} kpis={[...(data.ecosystem.partners ?? []), ...(data.ecosystem.experiences ?? []), ...(data.ecosystem.properties ?? [])]} />
              </section>
            )}

            <LvCard theme={theme}>
              <InlineNotice theme={theme}>
                These are counts in each state as of this read. The CRM keeps no history of a record moving between states, so no conversion rate or trend is
                shown — there is nothing real to compute one from.
              </InlineNotice>
            </LvCard>

            <DefinitionsCard theme={theme} notes={data.notes} generatedAt={data.generatedAt} />
          </div>
        )
      )}
    </OpsShell>
  );
};
