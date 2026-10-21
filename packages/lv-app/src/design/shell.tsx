import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { LvIcon, type LvIconName } from 'src/design/icons';
import { LvAvatar } from 'src/design/kit';
import { LvSheet } from 'src/design/overlay';
import { type LvTheme, type LvTint } from 'src/design/theme';
import { useLvTier } from 'src/design/use-tier';

// The La Vivenzia shell — the frame every screen sits in.
//
// The approved screens (new ui ux screens/, studied in docs/PHASE-1-SHELL-NOTES.md)
// establish three things that make this product recognisable in one glance and
// that no generic admin shell does:
//
//   1. There is no flat top bar. A Western Ghats photograph runs behind the
//      whole upper area, and the product sits on it as a rounded panel with the
//      image showing around its edges.
//   2. The sidebar is three groups, not one list: the six doors, a generous
//      gap, the secondary capabilities, then Settings, then an account card
//      anchored at the foot. The six doors stay visually dominant.
//   3. The active door is a filled pine-green pill with white text — not a
//      tint, not a left border.
//
// On a phone none of that is narrowed: the sidebar does not exist, the six
// doors become a bottom bar of their own, and the secondary capabilities move
// into a sheet.

// Served from packages/lv-app/public/lv.
export const LV_ASSETS = {
  logo: '/lv/logo-lockup.png',
  logoSmall: '/lv/logo-lockup@1x.png',
  mark: '/lv/mark.png',
  markSmall: '/lv/mark@1x.png',
  hero: '/lv/hero-ghats.jpg',
  heroSmall: '/lv/hero-ghats@1x.jpg',
} as const;

export const LV_DOORS = ['today', 'leads', 'capture', 'onboarding', 'messages', 'ask'] as const;

export type LvDoor = (typeof LV_DOORS)[number];

export type LvDoorDefinition = {
  key: LvDoor;
  label: string;
  // What the bottom bar calls this door. Six labels have to share 320px, and
  // the honest fix is a shorter *word*, not a cropped one — the full label is
  // still the accessible name.
  shortLabel: string;
  icon: LvIconName;
  tint: LvTint;
  // The one line the entry card shows under its title.
  description: string;
};

// One definition drives the sidebar, the bottom bar and the entry cards, so
// the three can never describe the same door differently.
export const LV_DOOR_DEFINITIONS: LvDoorDefinition[] = [
  { key: 'today', label: 'Today', shortLabel: 'Today', icon: 'today', tint: 'mint', description: 'What needs your attention' },
  { key: 'leads', label: 'My Leads', shortLabel: 'Leads', icon: 'leads', tint: 'blue', description: 'All your relationships' },
  { key: 'capture', label: 'Capture', shortLabel: 'Capture', icon: 'capture', tint: 'peach', description: 'Add anything (in seconds)' },
  { key: 'onboarding', label: 'Onboarding', shortLabel: 'Onboard', icon: 'onboarding', tint: 'lavender', description: 'Get partners live on La Vivenzia' },
  { key: 'messages', label: 'Messages', shortLabel: 'Inbox', icon: 'messages', tint: 'mint', description: 'All conversations in one place' },
  { key: 'ask', label: 'Ask LV', shortLabel: 'Ask LV', icon: 'ask', tint: 'pink', description: 'Search. Analyse. Get next steps.' },
];

// The capabilities the product keeps but does not put in front of anyone. The
// references place them in a quieter second group below the six doors — that
// is how they stay reachable without rebuilding the crowded navigation the CTO
// rejected.
export type LvSecondaryItem = { key: string; label: string; icon: LvIconName; path: string };

/**
 * What sits below the six doors.
 *
 * The reference sidebar carries exactly two entries here — Profile and
 * Settings — and nothing else. Phase 1 had listed People, Organisations,
 * Experiences, Tasks and Analytics; those routes still resolve, so an
 * existing link keeps working, but they are no longer navigation. The doors
 * are the way in, and a sidebar that lists everything is the CRM this product
 * is replacing.
 */
export const LV_SECONDARY_ITEMS: LvSecondaryItem[] = [{ key: 'profile', label: 'Profile', icon: 'person', path: '/profile' }];

export type LvShellUser = { name: string; role?: string | null; avatarUrl?: string | null };

// ---------------------------------------------------------------------------
// Navigation item
// ---------------------------------------------------------------------------

// Only what does not change between the rail, the icon rail and the bottom
// bar. Direction, gap, padding, height and type size belong to the stylesheet,
// because an inline style beats a media query and would pin the desktop shape
// to a phone.
const navItemStyle = (theme: LvTheme, active: boolean, quiet: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
  width: '100%',
  borderRadius: theme.radius.md,
  border: '1px solid transparent',
  // The reference active state: a pale mint pill carrying a pine bar on its
  // leading edge, with the label staying dark. A solid pine fill was built in
  // Phase 1 and corrected here against the reference images.
  background: active ? theme.tint.mint.wash : 'transparent',
  color: active ? theme.color.heading : quiet ? theme.color.textSubtle : theme.color.textMuted,
  fontFamily: theme.font.body,
  fontWeight: active ? theme.font.weight.bold : theme.font.weight.regular,
  cursor: 'pointer',
  textAlign: 'left',
  transition: `background-color ${theme.motion.duration.fast}ms ${theme.motion.easing}, color ${theme.motion.duration.fast}ms ${theme.motion.easing}`,
});

export const LvNavItem = ({
  theme,
  icon,
  label,
  shortLabel,
  active,
  onClick,
  badge,
  quiet,
  disabled,
}: {
  theme: LvTheme;
  icon: LvIconName;
  label: string;
  /** Shown instead of `label` where the bar is narrow; `label` stays the accessible name. */
  shortLabel?: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
  /** The secondary group reads one step quieter than the six doors. */
  quiet?: boolean;
  disabled?: boolean;
}) => (
  <li className="lv-nav-item" style={{ listStyle: 'none' }}>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={label}
      style={navItemStyle(theme, Boolean(active), Boolean(quiet))}
    >
      {active && <span aria-hidden="true" className="lv-nav-accent" style={{ background: theme.color.brand }} />}
      <LvIcon name={icon} size={20} />
      <span className="lv-nav-label" style={{ minWidth: 0 }}>
        {shortLabel ?? label}
      </span>
      {typeof badge === 'number' && badge > 0 && (
        <span
          className="lv-nav-badge"
          style={{
            ...theme.type.caption,
            minWidth: 18,
            textAlign: 'center',
            borderRadius: theme.radius.pill,
            padding: '0 5px',
            background: theme.color.danger,
            color: theme.color.textInverse,
            fontWeight: theme.font.weight.bold,
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  </li>
);

// ---------------------------------------------------------------------------
// Account card — the sidebar's foot, and the account menu behind it
// ---------------------------------------------------------------------------

export type LvAccountAction = { key: string; label: string; icon: LvIconName; onSelect: () => void; tone?: 'default' | 'danger' };

export const LvAccountMenu = ({
  theme,
  user,
  actions,
  onClose,
  anchor = 'up',
}: {
  theme: LvTheme;
  user: LvShellUser;
  actions: LvAccountAction[];
  onClose: () => void;
  /** 'up' opens above the trigger (sidebar foot), 'down' below it (top bar). */
  anchor?: 'up' | 'down';
}) => {
  const tier = useLvTier();
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tier === 'mobile') {
      return;
    }

    const onPointer = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [tier, onClose]);

  const items = actions.map((action) => (
    <button
      key={action.key}
      type="button"
      role="menuitem"
      onClick={() => {
        onClose();
        action.onSelect();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.space(3),
        width: '100%',
        minHeight: 44,
        padding: `0 ${theme.space(3)}px`,
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: theme.radius.md,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: theme.font.body,
        fontSize: theme.font.size.md,
        color: action.tone === 'danger' ? theme.color.danger : theme.color.text,
      }}
    >
      <LvIcon name={action.icon} size={17} />
      {action.label}
    </button>
  ));

  if (tier === 'mobile') {
    return (
      <LvSheet theme={theme} title={user.name} description={user.role ?? undefined} onClose={onClose}>
        {items}
      </LvSheet>
    );
  }

  return (
    <div
      ref={wrapper}
      role="menu"
      aria-label="Account"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        ...(anchor === 'up' ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }),
        zIndex: 60,
        minWidth: 200,
        background: theme.color.surfaceRaised,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.lg,
        boxShadow: theme.shadow.md,
        padding: theme.space(1),
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <span style={{ padding: `${theme.space(2)}px ${theme.space(3)}px`, borderBottom: `1px solid ${theme.color.border}`, marginBottom: theme.space(1) }}>
        <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.bold, color: theme.color.heading }}>{user.name}</span>
        <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>{user.role ?? 'Signed in'}</span>
      </span>
      {items}
    </div>
  );
};

export const LvAccountCard = ({
  theme,
  user,
  actions,
}: {
  theme: LvTheme;
  user: LvShellUser;
  actions: LvAccountAction[];
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', marginTop: 'auto' }}>
      <button
        type="button"
        className="lv-account-card"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${user.name}`}
        onClick={() => setOpen((value) => !value)}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          background: 'transparent',
          border: '1px solid transparent',
          borderRadius: theme.radius.lg,
          cursor: 'pointer',
          fontFamily: theme.font.body,
          textAlign: 'left',
        }}
      >
        <LvAvatar theme={theme} name={user.name} src={user.avatarUrl} size={36} />
        <span className="lv-account-identity" style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.bold, color: theme.color.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.name}
          </span>
          <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.role ?? 'Signed in'}
          </span>
        </span>
        <span className="lv-account-chevron" aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
          <LvIcon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
        </span>
      </button>
      {open && <LvAccountMenu theme={theme} user={user} actions={actions} onClose={() => setOpen(false)} anchor="up" />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sidebar — desktop and tablet only
// ---------------------------------------------------------------------------

export const LvSidebar = ({
  theme,
  active,
  activeSecondary,
  onNavigate,
  onNavigateSecondary,
  onSettings,
  onHome,
  badges,
  user,
  accountActions,
}: {
  theme: LvTheme;
  active: LvDoor | null;
  activeSecondary?: string | null;
  onNavigate: (door: LvDoor) => void;
  onNavigateSecondary: (item: LvSecondaryItem) => void;
  onSettings?: () => void;
  onHome?: () => void;
  badges?: Partial<Record<LvDoor, number>>;
  user: LvShellUser;
  accountActions: LvAccountAction[];
}) => (
  <nav className="lv-sidebar" aria-label="Primary">
    <button
      type="button"
      onClick={onHome}
      aria-label="La Vivenzia home"
      className="lv-sidebar-logo"
      style={{ background: 'transparent', border: '1px solid transparent', borderRadius: theme.radius.md, cursor: onHome ? 'pointer' : 'default' }}
    >
      {/* Two marks, one shown per width. Both are decorative: the button
          carries the accessible name, so neither needs alt text. */}
      <img className="lv-logo-mark" src={LV_ASSETS.mark} srcSet={`${LV_ASSETS.markSmall} 1x, ${LV_ASSETS.mark} 2x`} alt="" height={34} style={{ height: 34, width: 'auto' }} />
      <img className="lv-logo-lockup" src={LV_ASSETS.logo} srcSet={`${LV_ASSETS.logoSmall} 1x, ${LV_ASSETS.logo} 2x`} alt="" height={40} style={{ height: 40, width: 'auto' }} />
    </button>

    {/* The six doors. Everything about this group says "start here". */}
    <ul className="lv-nav-group lv-nav-primary">
      {LV_DOOR_DEFINITIONS.map((door) => (
        <LvNavItem
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

    {/* A generous gap, not a rule: the references separate the groups with
        space so the second one recedes rather than reading as a section. */}
    <ul className="lv-nav-group lv-nav-secondary" aria-label="More">
      {LV_SECONDARY_ITEMS.map((item) => (
        <LvNavItem
          key={item.key}
          theme={theme}
          icon={item.icon}
          label={item.label}
          quiet
          active={item.key === activeSecondary}
          onClick={() => onNavigateSecondary(item)}
        />
      ))}
    </ul>

    <ul className="lv-nav-group lv-nav-settings">
      <LvNavItem theme={theme} icon="settings" label="Settings" quiet active={activeSecondary === 'settings'} onClick={onSettings} />
    </ul>

    <LvAccountCard theme={theme} user={user} actions={accountActions} />
  </nav>
);

// ---------------------------------------------------------------------------
// Mobile bottom navigation — the six doors, and nothing else
// ---------------------------------------------------------------------------

export const LvMobileBottomNav = ({
  theme,
  active,
  onNavigate,
  badges,
}: {
  theme: LvTheme;
  active: LvDoor | null;
  onNavigate: (door: LvDoor) => void;
  badges?: Partial<Record<LvDoor, number>>;
}) => (
  <nav className="lv-bottomnav" aria-label="Primary">
    <ul className="lv-bottomnav-list">
      {LV_DOOR_DEFINITIONS.map((door) => (
        <LvNavItem
          key={door.key}
          theme={theme}
          icon={door.icon}
          label={door.label}
          shortLabel={door.shortLabel}
          active={door.key === active}
          badge={badges?.[door.key]}
          onClick={() => onNavigate(door.key)}
        />
      ))}
    </ul>
  </nav>
);

// ---------------------------------------------------------------------------
// The entry cards of the six-door home
// ---------------------------------------------------------------------------

export const LvEntryCard = ({ theme, door, onClick }: { theme: LvTheme; door: LvDoorDefinition; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="lv-entry-card"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      textAlign: 'left',
      borderRadius: theme.radius.xl,
      border: '1px solid transparent',
      background: theme.tint[door.tint].wash,
      color: theme.color.heading,
      cursor: 'pointer',
      fontFamily: theme.font.body,
      width: '100%',
    }}
  >
    {/* The reference sets the glyph straight on the tint at full size — no
        white tile, no shadow. A tile made the card look like a list row. */}
    <span aria-hidden="true" style={{ color: theme.tint[door.tint].glyph, display: 'inline-flex', flex: '0 0 auto' }}>
      <LvIcon name={door.icon} size={44} />
    </span>

    {/* Title and description on the left, the arrow beside them rather than
        stranded in a corner. */}
    <span style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), width: '100%', minWidth: 0 }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', ...theme.type.subheading, fontSize: 19, color: theme.color.heading }}>{door.label}</span>
        <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted, marginTop: 2 }}>{door.description}</span>
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 50,
          height: 50,
          flex: '0 0 auto',
          borderRadius: theme.radius.pill,
          background: theme.color.surfaceRaised,
          color: theme.tint[door.tint].ink,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LvIcon name="chevronRight" size={22} weight={2.4} />
      </span>
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

// ---------------------------------------------------------------------------
// The application shell
// ---------------------------------------------------------------------------

export const LvAppShell = ({
  theme,
  active,
  activeSecondary,
  onNavigate,
  onNavigateSecondary,
  user,
  accountActions,
  onSettings,
  onHome,
  badges,
  search,
  notifications,
  canvas = 'panel',
  children,
}: {
  theme: LvTheme;
  active: LvDoor | null;
  activeSecondary?: string | null;
  onNavigate: (door: LvDoor) => void;
  onNavigateSecondary: (item: LvSecondaryItem) => void;
  user: LvShellUser;
  accountActions: LvAccountAction[];
  onSettings?: () => void;
  onHome?: () => void;
  badges?: Partial<Record<LvDoor, number>>;
  /** The global search control, rendered into the top bar. */
  search: ReactNode;
  /** The bell and its panel, rendered into the top bar. */
  notifications: ReactNode;
  /**
   * 'panel' lays the page on a rounded surface over the photograph — the flow
   * and record screens. 'open' leaves the page on the tinted ground so a title
   * can sit on the photograph itself — Today, the six-door home, the boards.
   */
  canvas?: 'panel' | 'open';
  children: ReactNode;
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="lv-root lv-shell" style={{ background: theme.color.page, color: theme.color.text, fontFamily: theme.font.body }}>
      <LvSidebar
        theme={theme}
        active={active}
        activeSecondary={activeSecondary}
        onNavigate={onNavigate}
        onNavigateSecondary={onNavigateSecondary}
        onSettings={onSettings}
        onHome={onHome}
        badges={badges}
        user={user}
        accountActions={accountActions}
      />

      <div className="lv-shell-body">
        {/* The photograph the whole product sits on. Decorative: it carries no
            alt text and nothing depends on it loading. */}
        <img
          className="lv-shell-photo"
          src={LV_ASSETS.hero}
          srcSet={`${LV_ASSETS.heroSmall} 1000w, ${LV_ASSETS.hero} 2000w`}
          sizes="100vw"
          alt=""
          aria-hidden="true"
        />
        <span
          className="lv-shell-veil"
          aria-hidden="true"
          style={{
            // Clear across the top so the photograph actually reads behind the
            // greeting, then settling to the page ground by the time the
            // content below it starts.
            background: [
              `linear-gradient(90deg, ${theme.color.page} 0%, ${theme.color.page}E0 30%, ${theme.color.page}00 68%)`,
              `linear-gradient(180deg, ${theme.color.page}00 0%, ${theme.color.page}14 38%, ${theme.color.page}A6 74%, ${theme.color.page} 100%)`,
            ].join(', '),
          }}
        />

        <header className="lv-topbar">
          {/* No logo here on a phone: at 320px the bar has to hold search,
              the bell, the account and the sections, and a mark would cost the
              word "Search". The six-door home is in the sheet below instead. */}
          <div className="lv-topbar-search">{search}</div>

          <div className="lv-topbar-actions">
            {notifications}

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="lv-topbar-account"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-label={`Account: ${user.name}`}
                onClick={() => setAccountOpen((value) => !value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: theme.color.surfaceRaised,
                  border: `1px solid ${theme.color.border}`,
                  borderRadius: theme.radius.pill,
                  cursor: 'pointer',
                  fontFamily: theme.font.body,
                  color: theme.color.text,
                  boxShadow: theme.shadow.sm,
                }}
              >
                <LvAvatar theme={theme} name={user.name} src={user.avatarUrl} size={34} />
                <span className="lv-topbar-identity" style={{ textAlign: 'left', minWidth: 0 }}>
                  <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted, lineHeight: 1.2 }}>{user.role ?? 'Signed in'}</span>
                  <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.bold, color: theme.color.heading, lineHeight: 1.3 }}>{user.name}</span>
                </span>
                <span className="lv-topbar-identity" aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
                  <LvIcon name="chevronDown" size={16} />
                </span>
              </button>
              {accountOpen && <LvAccountMenu theme={theme} user={user} actions={accountActions} onClose={() => setAccountOpen(false)} anchor="down" />}
            </div>

            {/* The secondary capabilities on a phone. They are not in the
                bottom bar, because the bottom bar is the six doors. */}
            <button
              type="button"
              className="lv-topbar-more"
              aria-label="More sections"
              onClick={() => setMoreOpen(true)}
              style={{
                background: theme.color.surfaceRaised,
                border: `1px solid ${theme.color.border}`,
                borderRadius: theme.radius.pill,
                color: theme.color.textMuted,
                cursor: 'pointer',
                boxShadow: theme.shadow.sm,
              }}
            >
              <LvIcon name="more" size={20} />
            </button>
          </div>
        </header>

        <main className={canvas === 'panel' ? 'lv-shell-main lv-shell-panel' : 'lv-shell-main'} style={canvas === 'panel' ? { background: theme.color.surface } : undefined}>
          <div className="lv-shell-content">{children}</div>
        </main>
      </div>

      <LvMobileBottomNav theme={theme} active={active} onNavigate={onNavigate} badges={badges} />

      {moreOpen && (
        <LvSheet theme={theme} title="More" description="Everything else the CRM holds." onClose={() => setMoreOpen(false)}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <LvNavItem
              theme={theme}
              icon="today"
              label="The six doors"
              onClick={() => {
                setMoreOpen(false);
                onHome?.();
              }}
            />
            {LV_SECONDARY_ITEMS.map((item) => (
              <LvNavItem
                key={item.key}
                theme={theme}
                icon={item.icon}
                label={item.label}
                active={item.key === activeSecondary}
                onClick={() => {
                  setMoreOpen(false);
                  onNavigateSecondary(item);
                }}
              />
            ))}
            <LvNavItem
              theme={theme}
              icon="settings"
              label="Settings"
              active={activeSecondary === 'settings'}
              onClick={() => {
                setMoreOpen(false);
                onSettings?.();
              }}
            />
          </ul>
        </LvSheet>
      )}
    </div>
  );
};

// The greeting band of the original boards: a Western Ghats morning behind the
// welcome, with the left third left hazy so the words stay readable.
export const LvHero = ({
  theme,
  greeting,
  subtitle,
  aside,
}: {
  theme: LvTheme;
  greeting: string;
  subtitle: string;
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
        background: `linear-gradient(90deg, ${theme.color.surfaceRaised} 8%, ${theme.color.surfaceRaised}D9 38%, ${theme.color.surfaceRaised}00 72%)`,
      }}
    />
    <div className="lv-hero-body" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <h1 style={{ fontFamily: theme.font.body, fontSize: 28, fontWeight: 600, lineHeight: 1.2, color: theme.color.heading, margin: 0 }}>{greeting}</h1>
      <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0`, maxWidth: 460 }}>{subtitle}</p>
    </div>
    {aside && (
      <span className="lv-hide-mobile lv-hero-aside" style={{ position: 'relative', ...theme.type.bodySmall, color: theme.color.brand, textAlign: 'right', maxWidth: 200, lineHeight: 1.5 }}>
        {aside}
      </span>
    )}
  </section>
);

/** @deprecated The Phase 0 name. `LvAppShell` is the shell the references describe. */
export const LvSidebarItem = LvNavItem;
