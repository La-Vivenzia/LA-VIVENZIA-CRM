import { CHANNEL_LABELS } from 'src/api/messages';
import { useChannelMix, useControlTower } from 'src/api/ops';
import { InlineNotice, LvCard } from 'src/design/kit';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';
import { CountBars, KpiRow, OpsShell, OpsState, RefreshAction } from 'src/screens/ops/parts';

// 12.4 — Channel & activity analytics.
//
// Where relationships come from (`lvLead.source`) and how they move
// (`lvInteraction.channel` and `direction`). Twenty's GraphQL has no GROUP BY,
// so these are counted from the rows the signed-in person may read, and the
// page says how many rows that was next to the figure. A number drawn from a
// page is a different claim from a number drawn from everything, and this
// screen never blurs the two.
//
// The contact-quality figures beside them come from the Control Tower route,
// which an administrator can read and a team member cannot — so that block is
// simply absent for roles without it rather than showing zeroes.

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'Website',
  INSTAGRAM: 'Instagram',
  REFERRAL: 'Referral',
  PARTNER_REFERRAL: 'Partner referral',
  EVENT: 'Event',
  WALK_IN: 'Walk-in',
  PHONE: 'Phone',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  LINKEDIN: 'LinkedIn',
  FORM: 'Form',
  MANUAL: 'Entered by hand',
  IMPORT: 'Import',
  UNRECORDED: 'Not recorded',
};

const DIRECTION_LABELS: Record<string, string> = { INBOUND: 'From them', OUTBOUND: 'From us', UNRECORDED: 'Not recorded' };

export const OpsChannelsScreen = ({ theme }: { theme: LvTheme }) => {
  const mix = useChannelMix();
  const tower = useControlTower();
  const state = OpsState({ theme, loading: mix.loading, error: mix.error, forbidden: mix.forbidden, onRetry: mix.reload, label: 'channel activity' });

  const refresh = () => {
    mix.reload();
    tower.reload();
  };

  return (
    <OpsShell
      theme={theme}
      section="channels"
      title="Channel & activity"
      subtitle="Where relationships come from, and how contact actually happens."
      actions={<RefreshAction theme={theme} onRefresh={refresh} />}
    >
      {state ?? (
        mix.data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(5) }}>
            <div className="lv-ops-grid" style={{ display: 'grid', gap: theme.space(4) }}>
              <LvSectionCard theme={theme} title="Where leads come from" icon="leads">
                <CountBars theme={theme} caption="Lead source" rows={mix.data.leadSources} labelFor={(row) => SOURCE_LABELS[row.key] ?? row.key} />
                <InlineNotice theme={theme}>
                  Counted from the {mix.data.leadsRead} most recent leads you can read
                  {mix.data.leadsTotal !== null ? ` of ${mix.data.leadsTotal}` : ''}.
                </InlineNotice>
              </LvSectionCard>

              <LvSectionCard theme={theme} title="How contact happens" icon="messages">
                <CountBars theme={theme} caption="Interaction channel" rows={mix.data.channels} labelFor={(row) => CHANNEL_LABELS[row.key] ?? row.key} />
                <InlineNotice theme={theme}>
                  Counted from the {mix.data.interactionsRead} most recent interactions you can read
                  {mix.data.interactionsTotal !== null ? ` of ${mix.data.interactionsTotal}` : ''}.
                </InlineNotice>
              </LvSectionCard>
            </div>

            <LvSectionCard theme={theme} title="Which way contact flows" icon="chart">
              <CountBars
                theme={theme}
                caption="Direction"
                rows={mix.data.directions}
                labelFor={(row) => DIRECTION_LABELS[row.key] ?? row.key}
                toneFor={(row) => (row.key === 'INBOUND' ? 'info' : 'neutral')}
              />
            </LvSectionCard>

            {/* Administrator-only, and absent rather than empty for everyone else. */}
            {tower.data && tower.data.contactBreakdown.length > 0 && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
                <header>
                  <span style={{ ...theme.type.label, color: theme.color.textMuted, display: 'block' }}>Data hygiene</span>
                  <h2 style={{ ...theme.type.subheading, fontSize: 19, color: theme.color.heading, margin: 0 }}>What is missing on the record</h2>
                </header>
                <KpiRow theme={theme} kpis={tower.data.contactBreakdown} />
              </section>
            )}

            {tower.data && tower.data.notificationHealth.length > 0 && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
                <header>
                  <span style={{ ...theme.type.label, color: theme.color.textMuted, display: 'block' }}>Reaching the team</span>
                  <h2 style={{ ...theme.type.subheading, fontSize: 19, color: theme.color.heading, margin: 0 }}>Notification health</h2>
                </header>
                <KpiRow theme={theme} kpis={tower.data.notificationHealth} />
              </section>
            )}

            <LvCard theme={theme}>
              <InlineNotice theme={theme}>
                La Vivenzia sends nothing itself — an interaction is the record of a contact that already happened. These figures describe what the team
                logged, not what a platform delivered.
              </InlineNotice>
            </LvCard>
          </div>
        )
      )}
    </OpsShell>
  );
};
