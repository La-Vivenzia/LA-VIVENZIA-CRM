import { type CSSProperties, type ReactNode } from 'react';

import { LvIcon, type LvIconName } from 'src/design/icons';
import { LvAvatar, LvSearchField } from 'src/design/kit';
import { type LvTheme, type LvTint } from 'src/design/theme';

// The La Vivenzia shell — the frame every screen sits in.
//
// The approved reference boards show a product with its own chrome: a light
// 240px sidebar carrying six doors and nothing else, a top bar with one wide
// search, and a content area with no other furniture. This file is that frame.
// It is deliberately dumb: it knows the doors, the person and the search box,
// and renders whatever screen is handed to it.
//
// Spec (from the boards, see docs/UI-EXACT-MATCH-PLAN.md §3):
//   sidebar 240 · items 44 high / 12 radius · active = tinted wash + pine ink
//   top bar 64 · search pill 44 high, max 560 wide · avatar 36
//   content 32 padding · max 1280 · 24 gap

// Served by the host app from packages/twenty-front/public/lv.
export const LV_ASSETS = {
  logo: '/lv/logo-lockup.png',
  logoSmall: '/lv/logo-lockup@1x.png',
  mark: '/lv/mark.png',
  hero: '/lv/hero-ghats.jpg',
  heroSmall: '/lv/hero-ghats@1x.jpg',
} as const;

export const LV_DOORS = ['today', 'leads', 'capture', 'onboarding', 'messages', 'ask'] as const;

export type LvDoor = (typeof LV_DOORS)[number];

export type LvDoorDefinition = {
  key: LvDoor;
  label: string;
  icon: LvIconName;
  tint: LvTint;
  // The one line the entry card shows under its title.
  description: string;
};

// One definition drives the sidebar and the entry cards, so the two can never
// describe the same door differently.
export const LV_DOOR_DEFINITIONS: LvDoorDefinition[] = [
  { key: 'today', label: 'Today', icon: 'today', tint: 'mint', description: 'What needs your attention' },
  { key: 'leads', label: 'My Leads', icon: 'leads', tint: 'blue', description: 'All your relationships' },
  { key: 'capture', label: 'Capture', icon: 'capture', tint: 'peach', description: 'Add anything (in seconds)' },
  { key: 'onboarding', label: 'Onboarding', icon: 'onboarding', tint: 'lavender', description: 'Get partners live on La Vivenzia' },
  { key: 'messages', label: 'Messages', icon: 'messages', tint: 'mint', description: 'All conversations in one place' },
  { key: 'ask', label: 'Ask LV', icon: 'ask', tint: 'pink', description: 'Search. Analyse. Get next steps.' },
];

const railItem = (theme: LvTheme, active: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space(3),
  width: '100%',
  minHeight: 44,
  padding: `0 ${theme.space(3)}px`,
  borderRadius: theme.radius.md,
  border: '1px solid transparent',
  background: active ? theme.tint.mint.wash : 'transparent',
  color: active ? theme.color.brand : theme.color.textMuted,
  fontFamily: theme.font.body,
  fontSize: theme.font.size.md,
  fontWeight: active ? theme.font.weight.bold : theme.font.weight.regular,
  cursor: 'pointer',
  textAlign: 'left',
});

export const LvSidebarItem = ({
  theme,
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  theme: LvTheme;
  icon: LvIconName;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
}) => (
  <li style={{ listStyle: 'none' }}>
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} style={railItem(theme, Boolean(active))}>
      <LvIcon name={icon} size={20} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span style={{ ...theme.type.caption, minWidth: 20, textAlign: 'center', borderRadius: theme.radius.pill, padding: '1px 6px', background: theme.color.danger, color: '#FFFFFF', fontWeight: theme.font.weight.bold }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  </li>
);

// The entry card of the six-door home screen: tinted ground, icon tile, title,
// one line, and a chevron in the door's own ink.
export const LvEntryCard = ({ theme, door, onClick }: { theme: LvTheme; door: LvDoorDefinition; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: theme.space(3),
      alignItems: 'flex-start',
      textAlign: 'left',
      padding: theme.space(5),
      minHeight: 168,
      borderRadius: theme.radius.xl,
      border: '1px solid transparent',
      background: theme.tint[door.tint].wash,
      color: theme.color.heading,
      cursor: 'pointer',
      fontFamily: theme.font.body,
      width: '100%',
    }}
  >
    <span
      aria-hidden="true"
      style={{
        width: 52,
        height: 52,
        flex: '0 0 auto',
        borderRadius: theme.radius.lg,
        // White, not the tint: the card is already the tint, so a tinted tile
        // would vanish into it.
        background: theme.color.surfaceRaised,
        color: theme.tint[door.tint].ink,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: theme.shadow.sm,
      }}
    >
      <LvIcon name={door.icon} size={26} />
    </span>
    <span style={{ flex: 1 }}>
      <span style={{ display: 'block', ...theme.type.subheading, fontSize: 18, color: theme.color.heading }}>{door.label}</span>
      <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted, marginTop: 4 }}>{door.description}</span>
    </span>
    <span aria-hidden="true" style={{ alignSelf: 'flex-end', color: theme.tint[door.tint].ink, display: 'inline-flex' }}>
      <LvIcon name="chevronRight" size={22} />
    </span>
  </button>
);

export const LvEntryGrid = ({ theme, onOpen }: { theme: LvTheme; onOpen?: (door: LvDoor) => void }) => (
  <div className="lv-entry-grid" style={{ display: 'grid', gap: theme.space(5) }}>
    {LV_DOOR_DEFINITIONS.map((door) => (
      <LvEntryCard key={door.key} theme={theme} door={door} onClick={onOpen ? () => onOpen(door.key) : undefined} />
    ))}
  </div>
);

export type LvShellUser = {
  name: string;
  role?: string | null;
  avatarUrl?: string | null;
};

export const LvShell = ({
  theme,
  active,
  onNavigate,
  user,
  search,
  onSearchChange,
  onSearchSubmit,
  notificationCount,
  onNotifications,
  onProfile,
  onSettings,
  onHome,
  badges,
  children,
}: {
  theme: LvTheme;
  active: LvDoor;
  onNavigate: (door: LvDoor) => void;
  user: LvShellUser;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: () => void;
  notificationCount?: number;
  onNotifications?: () => void;
  onProfile?: () => void;
  onSettings?: () => void;
  // The logo goes back to the six entry cards.
  onHome?: () => void;
  // Per-door counts, e.g. unread messages.
  badges?: Partial<Record<LvDoor, number>>;
  children: ReactNode;
}) => (
  <div className="lv-root lv-shell" style={{ display: 'flex', minHeight: '100vh', background: theme.color.page, color: theme.color.text, fontFamily: theme.font.body }}>
    <nav
      className="lv-shell-rail"
      aria-label="La Vivenzia"
      style={{
        width: 240,
        flex: '0 0 240px',
        background: theme.color.surfaceRaised,
        borderRight: `1px solid ${theme.color.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: `${theme.space(4)}px ${theme.space(3)}px`,
        gap: theme.space(2),
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        onClick={onHome}
        aria-label="La Vivenzia home"
        style={{ height: 72, display: 'flex', alignItems: 'center', paddingLeft: theme.space(3), background: 'transparent', border: '1px solid transparent', borderRadius: theme.radius.md, cursor: onHome ? 'pointer' : 'default' }}
      >
        <img
          src={LV_ASSETS.logo}
          srcSet={`${LV_ASSETS.logoSmall} 1x, ${LV_ASSETS.logo} 2x`}
          alt="La Vivenzia"
          height={30}
          style={{ height: 30, width: 'auto', display: 'block' }}
        />
      </button>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {LV_DOOR_DEFINITIONS.map((door) => (
          <LvSidebarItem
            key={door.key}
            theme={theme}
            icon={door.icon}
            label={door.label}
            active={door.key === active}
            badge={badges?.[door.key]}
            onClick={() => onNavigate(door.key)}
          />
        ))}
      </ul>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, borderTop: `1px solid ${theme.color.border}`, paddingTop: theme.space(3) }}>
        <LvSidebarItem theme={theme} icon="profile" label="Profile" onClick={onProfile} />
        <LvSidebarItem theme={theme} icon="settings" label="Settings" onClick={onSettings} />
      </ul>
    </nav>

    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <header
        className="lv-shell-topbar"
        style={{
          height: 64,
          flex: '0 0 64px',
          display: 'flex',
          alignItems: 'center',
          gap: theme.space(4),
          padding: `0 ${theme.space(8)}px`,
          background: theme.color.surfaceRaised,
          borderBottom: `1px solid ${theme.color.border}`,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ flex: 1, maxWidth: 560 }}>
          <LvSearchField
            theme={theme}
            value={search}
            onChange={onSearchChange}
            onSubmit={onSearchSubmit}
            label="Search the CRM"
            placeholder="Search anything… (e.g. villa in Lonavala, Rahul, pending onboarding)"
          />
        </div>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onNotifications}
          aria-label={notificationCount ? `Notifications, ${notificationCount} unread` : 'Notifications'}
          style={{ position: 'relative', width: 40, height: 40, borderRadius: theme.radius.pill, border: '1px solid transparent', background: 'transparent', color: theme.color.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <LvIcon name="bell" size={20} />
          {Boolean(notificationCount) && (
            <span
              aria-hidden="true"
              style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: theme.radius.pill, background: theme.color.danger, color: '#FFFFFF', fontSize: 10, fontWeight: theme.font.weight.bold, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {notificationCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onProfile}
          style={{ display: 'inline-flex', alignItems: 'center', gap: theme.space(2), padding: `${theme.space(1)}px ${theme.space(2)}px`, borderRadius: theme.radius.pill, border: '1px solid transparent', background: 'transparent', cursor: 'pointer', fontFamily: theme.font.body, color: theme.color.text, minHeight: 44 }}
        >
          <LvAvatar theme={theme} name={user.name} src={user.avatarUrl} size={36} />
          <span className="lv-hide-mobile" style={{ textAlign: 'left', minWidth: 0 }}>
            <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted, lineHeight: 1.2 }}>{user.role ?? 'Signed in'}</span>
            <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.bold, color: theme.color.heading, lineHeight: 1.3 }}>{user.name}</span>
          </span>
        </button>
      </header>

      <main className="lv-shell-main" style={{ flex: 1, minWidth: 0, padding: theme.space(8), boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: theme.space(6) }}>{children}</div>
      </main>
    </div>
  </div>
);

// The greeting band of the reference boards: a Western Ghats morning behind
// the welcome, with the left third left hazy so the words stay readable. The
// image is decorative, so it carries no alt text and never blocks the copy —
// if it fails to load, the band is simply the tinted ground.
export const LvHero = ({
  theme,
  greeting,
  subtitle,
  aside,
}: {
  theme: LvTheme;
  greeting: string;
  subtitle: string;
  // The script line the boards set on the right ("More Experiences, A Kinder World").
  aside?: string;
}) => (
  <section
    style={{
      position: 'relative',
      overflow: 'hidden',
      borderRadius: theme.radius.xl,
      background: theme.tint.mint.wash,
      minHeight: 168,
      display: 'flex',
      alignItems: 'center',
    }}
  >
    <img
      src={LV_ASSETS.hero}
      srcSet={`${LV_ASSETS.heroSmall} 1000w, ${LV_ASSETS.hero} 2000w`}
      sizes="100vw"
      alt=""
      aria-hidden="true"
      loading="lazy"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center right' }}
    />
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        // Keeps the copy legible over whatever part of the photograph sits
        // behind it, without washing the image out on the right.
        background: `linear-gradient(90deg, ${theme.color.surfaceRaised} 8%, ${theme.color.surfaceRaised}D9 38%, ${theme.color.surfaceRaised}00 72%)`,
      }}
    />
    <div style={{ position: 'relative', padding: `${theme.space(6)}px ${theme.space(7)}px`, flex: 1, minWidth: 0 }}>
      <h1 style={{ fontFamily: theme.font.body, fontSize: 28, fontWeight: 600, lineHeight: 1.2, color: theme.color.heading, margin: 0 }}>{greeting}</h1>
      <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0`, maxWidth: 460 }}>{subtitle}</p>
    </div>
    {aside && (
      <span className="lv-hide-mobile" style={{ position: 'relative', padding: theme.space(7), ...theme.type.bodySmall, color: theme.color.brand, textAlign: 'right', maxWidth: 200, lineHeight: 1.5 }}>
        {aside}
      </span>
    )}
  </section>
);
