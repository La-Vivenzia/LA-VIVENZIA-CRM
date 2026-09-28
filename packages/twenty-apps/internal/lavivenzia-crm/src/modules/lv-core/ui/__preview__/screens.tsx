import { type ReactNode } from 'react';

import { LvActionRow, LvButton, LvCard, LvCounter, LvProgress, LvTabs, Section } from 'src/modules/lv-core/ui/kit';
import { LvEntryGrid, LvShell, type LvDoor } from 'src/modules/lv-core/ui/shell';
import { type LvTheme } from 'src/modules/lv-core/ui/theme';

// Preview fixtures for `scripts/preview.mjs` — the screens rendered statically
// so they can be compared side by side with the reference boards.
//
// The data here mirrors the boards themselves (Rahul, Neha, Raj) rather than
// production records: the point of the comparison is layout and visual
// language, and using the board's own content makes a mismatch obvious.

const noop = () => {};

// The shell is spelled out on every screen rather than spread from a helper:
// the house lint rule forbids prop spreading, and a preview that cheats on the
// rules is a preview of code we would not ship.
const Shell = ({ theme, active, children }: { theme: LvTheme; active: LvDoor; children: ReactNode }) => (
  <LvShell
    theme={theme}
    active={active}
    onNavigate={noop}
    user={{ name: 'Saumay Deshpande', role: 'Experience Hunter' }}
    search=""
    onSearchChange={noop}
    notificationCount={1}
  >
    {children}
  </LvShell>
);

const Greeting = ({ theme }: { theme: LvTheme }) => (
  <div>
    <h1 style={{ fontFamily: theme.font.body, fontSize: 28, fontWeight: 600, lineHeight: 1.2, color: theme.color.heading, margin: 0 }}>Good morning, Saumay 👋</h1>
    <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0` }}>Here&apos;s what needs your attention today.</p>
  </div>
);

// The six-door home screen (board R2).
export const home = (theme: LvTheme) => (
  <Shell theme={theme} active="today">
    <Greeting theme={theme} />
    <LvEntryGrid theme={theme} />
  </Shell>
);

// Today (boards R1 and R4-1).
export const today = (theme: LvTheme) => (
  <Shell theme={theme} active="today">
    <Greeting theme={theme} />

    <LvCard theme={theme}>
      <h2 style={{ ...theme.type.subheading, fontSize: 18, color: theme.color.heading, margin: `0 0 ${theme.space(4)}px`, display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: theme.color.danger, color: '#fff', ...theme.type.bodySmall, fontWeight: 700 }}>3</span>
        3 things need your attention
      </h2>
      <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
        <LvActionRow
          theme={theme}
          title="Rahul Sharma"
          subtitle="Adventure Host · Lonavala"
          urgent="Follow-up overdue by 1 day"
          action={<LvButton theme={theme} variant="primary" size="sm" icon={<span aria-hidden="true">📞</span>}>Call</LvButton>}
          onOpen={() => {}}
        />
        <LvActionRow
          theme={theme}
          title="Neha Patil"
          subtitle="Boutique Villa · Mulshi"
          urgent="Documents received – needs verification"
          tint="blue"
          action={<LvButton theme={theme} variant="secondary" size="sm">Review</LvButton>}
          onOpen={() => {}}
        />
        <LvActionRow
          theme={theme}
          title="Raj Mehta"
          subtitle="Experience Expert · Pune"
          urgent="Interested but hasn't completed form"
          tint="peach"
          action={<LvButton theme={theme} variant="secondary" size="sm">WhatsApp</LvButton>}
          onOpen={() => {}}
        />
      </ul>
    </LvCard>

    <div className="lv-two-col">
      <Section theme={theme} title="Today's work">
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(1) }}>
          <LvCounter theme={theme} icon="phone" tint="lavender" count={4} label="Calls" />
          <LvCounter theme={theme} icon="whatsapp" tint="mint" count={3} label="WhatsApps" />
          <LvCounter theme={theme} icon="onboarding" tint="peach" count={2} label="Onboardings" />
          <LvCounter theme={theme} icon="clock" tint="pink" count={1} label="Overdue" />
        </div>
      </Section>
      <Section theme={theme} title="✨ AI says">
        <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>
          Your highest priority today is following up with Rahul and completing the two pending onboardings.
        </p>
      </Section>
    </div>
  </Shell>
);

// A fragment of the profile (board R3) — enough to check the tab bar, the
// progress card and the row rhythm before phase 3 builds it properly.
export const profileFragment = (theme: LvTheme) => (
  <Shell theme={theme} active="leads">
    <LvTabs
      theme={theme}
      label="Lead sections"
      value="overview"
      onChange={() => {}}
      tabs={[
        { key: 'overview', label: 'Overview' },
        { key: 'onboarding', label: 'Onboarding' },
        { key: 'conversations', label: 'Conversations' },
        { key: 'documents', label: 'Documents', count: 2 },
        { key: 'timeline', label: 'Timeline' },
      ]}
    />
    <div className="lv-two-col">
      <Section theme={theme} title="Onboarding">
        <LvProgress
          theme={theme}
          percentage={75}
          caption="Documents pending:"
          pending={['PAN', 'Business proof']}
          action={<LvButton theme={theme} variant="secondary" size="sm">Help Complete</LvButton>}
        />
      </Section>
      <Section theme={theme} title="✨ AI insights">
        <p style={{ ...theme.type.body, margin: 0, color: theme.color.text }}>High potential partner. Strong location fit and audience engagement.</p>
      </Section>
    </div>
  </Shell>
);
