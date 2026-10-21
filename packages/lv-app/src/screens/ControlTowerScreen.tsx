import { useMemo } from 'react';

import { CONTROL_TOWER_GROUPS, useControlTower, type ListSection } from 'src/api/ops';
import { formatWhen, LvCard } from 'src/design/kit';
import { type LvTheme } from 'src/design/theme';
import { DefinitionsCard, HealthList, KpiRow, OpsShell, OpsState, PartialNotice, RefreshAction, SectionList } from 'src/screens/ops/parts';

// 12.1 — Control Tower.
//
// Administrators only, and the route decides that, not this screen: it refuses
// with 'The Control Tower is available to administrators only.' and that
// sentence is what a non-admin reads.
//
// The grouping — Critical, Needs attention, Operational flow, Quality,
// Ecosystem — is `CONTROL_TOWER_GROUPS`, taken from the legacy front component
// so the management view does not change its mind about what counts as
// critical depending on which screen you open.

export const ControlTowerScreen = ({ theme }: { theme: LvTheme }) => {
  const { data, loading, error, forbidden, reload } = useControlTower();
  const now = new Date().toISOString();

  const groups = useMemo(() => {
    const byKey = new Map<string, ListSection>(
      [...(data?.sections ?? []), ...(data?.ecosystem?.sections ?? [])].map((section) => [section.key, section]),
    );

    return CONTROL_TOWER_GROUPS.map((group) => ({
      ...group,
      sections: group.sections.map((key) => byKey.get(key)).filter((section): section is ListSection => Boolean(section)),
    })).filter((group) => group.sections.length > 0);
  }, [data]);

  const state = OpsState({ theme, loading, error, forbidden, onRetry: reload, label: 'the Control Tower' });

  return (
    <OpsShell
      theme={theme}
      section="tower"
      title="Control Tower"
      subtitle={
        data
          ? `Team workload, backlog, ecosystem and system health. Read ${formatWhen(data.generatedAt, now)}.`
          : 'Team workload, backlog, ecosystem and system health.'
      }
      actions={<RefreshAction theme={theme} onRefresh={reload} />}
    >
      {state ?? (
        data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(5) }}>
            <PartialNotice theme={theme} partial={[...data.partial, ...(data.ecosystem?.partial ?? [])]} />

            <KpiRow theme={theme} kpis={data.kpis} />

            {groups.map((group) => (
              <section key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
                <header>
                  <span style={{ ...theme.type.label, color: theme.color.textMuted, display: 'block' }}>{group.eyebrow}</span>
                  <h2 style={{ ...theme.type.subheading, fontSize: 19, color: theme.color.heading, margin: 0 }}>{group.title}</h2>
                </header>
                <div className="lv-ops-grid" style={{ display: 'grid', gap: theme.space(4) }}>
                  {group.sections.map((section) => (
                    <SectionList key={section.key} theme={theme} section={section} tone={group.tone} />
                  ))}
                </div>
              </section>
            ))}

            <section style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
              <header>
                <span style={{ ...theme.type.label, color: theme.color.textMuted, display: 'block' }}>Behind the scenes</span>
                <h2 style={{ ...theme.type.subheading, fontSize: 19, color: theme.color.heading, margin: 0 }}>System health</h2>
              </header>
              <LvCard theme={theme}>
                <HealthList theme={theme} rows={data.systemHealth} />
              </LvCard>
            </section>

            <DefinitionsCard theme={theme} notes={data.notes} generatedAt={data.generatedAt} />
          </div>
        )
      )}
    </OpsShell>
  );
};
