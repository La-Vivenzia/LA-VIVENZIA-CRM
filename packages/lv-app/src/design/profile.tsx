import { type ReactNode } from 'react';

import { channelIcon, LvIcon, type LvIconName } from 'src/design/icons';
import { LvAvatar, LvBadge, LvButton, LvCard, toneColour, type Tone } from 'src/design/kit';
import { type BadgeTone } from 'src/design/status';
import { type LvTheme, type LvTint } from 'src/design/theme';

// The profile, as the reference board draws it: who this is, the one action to
// take and why, and the relationship laid out so nothing has to be hunted for.
// These are the parts the board repeats — the header, the recommendation
// banner, the timeline and the related rail — kept here so the lead, the
// partner and the property pages cannot drift apart.

export const LvChip = ({ theme, children, tint = 'mint' }: { theme: LvTheme; children: ReactNode; tint?: LvTint }) => (
  <span
    style={{
      ...theme.type.bodySmall,
      background: theme.tint[tint].wash,
      color: theme.tint[tint].ink,
      borderRadius: theme.radius.pill,
      padding: `3px ${theme.space(3)}px`,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

export const LvProfileHeader = ({
  theme,
  name,
  status,
  statusTone = 'info',
  subtitle,
  meta,
  photoUrl,
  actions,
  overflow,
}: {
  theme: LvTheme;
  name: string;
  status?: string | null;
  // The badge tone the unified status map decided, not a colour chosen here.
  statusTone?: BadgeTone;
  // "Adventure Host · Lonavala"
  subtitle?: string | null;
  // The small facts under the name: location, experience, rating.
  meta?: { icon: LvIconName; text: string }[];
  photoUrl?: string | null;
  actions?: ReactNode;
  overflow?: ReactNode;
}) => (
  <LvCard theme={theme} style={{ padding: theme.space(5) }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(4) }}>
      <LvAvatar theme={theme} name={name} src={photoUrl} size={72} />
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: theme.font.body, fontSize: 24, fontWeight: 600, color: theme.color.heading, margin: 0 }}>{name}</h1>
          {status && (
            <LvBadge theme={theme} tone={statusTone}>
              {status}
            </LvBadge>
          )}
        </div>
        {subtitle && <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0` }}>{subtitle}</p>}
        {meta && meta.length > 0 && (
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(4), margin: `${theme.space(3)}px 0 0`, padding: 0, listStyle: 'none' }}>
            {meta.map((item) => (
              <li key={item.text} style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), ...theme.type.bodySmall, color: theme.color.textMuted }}>
                <span style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
                  <LvIcon name={item.icon} size={16} />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="lv-profile-actions" style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
        {actions}
        {overflow}
      </div>
    </div>
  </LvCard>
);

// One recommendation, and the reason for it. The reason is not optional: an
// instruction a person cannot check is an instruction they will not trust.
export const LvNextBestAction = ({
  theme,
  action,
  reason,
  icon = 'phone',
  aside,
}: {
  theme: LvTheme;
  action: string;
  reason?: string | null;
  icon?: LvIconName;
  aside?: ReactNode;
}) => (
  <section
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.space(4),
      padding: theme.space(5),
      borderRadius: theme.radius.xl,
      background: theme.tint.mint.wash,
      border: `1px solid ${theme.color.border}`,
    }}
  >
    <span
      aria-hidden="true"
      style={{ width: 44, height: 44, flex: '0 0 auto', borderRadius: theme.radius.md, background: theme.color.surfaceRaised, color: theme.color.brand, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <LvIcon name={icon} size={22} />
    </span>
    <div style={{ flex: '1 1 240px', minWidth: 0 }}>
      <span style={{ ...theme.type.label, color: theme.color.brand, display: 'block' }}>Next best action</span>
      <p style={{ ...theme.type.subheading, fontSize: 17, color: theme.color.heading, margin: `${theme.space(1)}px 0 0` }}>{action}</p>
      {reason && <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0` }}>Reason: {reason}</p>}
    </div>
    {aside && <div style={{ flex: '0 0 auto' }}>{aside}</div>}
  </section>
);

export type LvTimelineEntry = {
  id: string;
  at: string;
  title: string;
  detail?: string | null;
  tone?: Tone;
  // An interaction channel, when the entry is a conversation.
  channel?: string | null;
  kind?: string;
};

const KIND_ICONS: Record<string, LvIconName> = {
  LEAD_CREATED: 'sparkle',
  ASSIGNMENT: 'person',
  TASK: 'task',
  NOTE: 'note',
  SLA: 'clock',
  ONBOARDING: 'onboarding',
  DOCUMENT: 'document',
  STATUS: 'check',
  GOVERNANCE: 'settings',
  AI_DECISION: 'sparkle',
};

// The dot-and-line timeline of the board, with the channel's own glyph so a
// WhatsApp reply and a site visit are told apart at a glance.
export const LvTimeline = ({ theme, entries, formatWhen }: { theme: LvTheme; entries: LvTimelineEntry[]; formatWhen: (iso: string) => string }) => (
  <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
    {entries.map((entry, index) => {
      const colour = toneColour(theme, entry.tone);
      const icon = entry.kind === 'INTERACTION' ? channelIcon(entry.channel) : (KIND_ICONS[entry.kind ?? ''] ?? 'note');

      return (
        <li key={entry.id} style={{ display: 'flex', gap: theme.space(3), alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
            <span
              aria-hidden="true"
              style={{ width: 28, height: 28, borderRadius: theme.radius.pill, background: theme.color.surfaceSunken, color: colour, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <LvIcon name={icon} size={15} />
            </span>
            {index < entries.length - 1 && <span aria-hidden="true" style={{ flex: 1, width: 1, background: theme.color.border, minHeight: 12 }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: theme.space(4) }}>
            <span style={{ ...theme.type.bodySmall, color: theme.color.textSubtle, display: 'block' }}>{formatWhen(entry.at)}</span>
            <span style={{ ...theme.type.body, color: theme.color.heading, display: 'block', overflowWrap: 'anywhere' }}>{entry.title}</span>
            {entry.detail && <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted, display: 'block', overflowWrap: 'anywhere' }}>{entry.detail}</span>}
          </div>
        </li>
      );
    })}
  </ol>
);

// "Experiences · 3 matches" — what else hangs off this relationship.
export const LvRelatedList = ({
  theme,
  items,
}: {
  theme: LvTheme;
  items: { key: string; icon: LvIconName; label: string; detail: string; onOpen?: () => void }[];
}) => (
  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
    {items.map((item) => {
      const inner = (
        <>
          <span
            aria-hidden="true"
            style={{ width: 34, height: 34, flex: '0 0 auto', borderRadius: theme.radius.md, background: theme.color.surfaceSunken, color: theme.color.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <LvIcon name={item.icon} size={17} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ ...theme.type.body, color: theme.color.heading, display: 'block' }}>{item.label}</span>
            <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted, display: 'block' }}>{item.detail}</span>
          </span>
          {item.onOpen && (
            <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
              <LvIcon name="chevronRight" size={18} />
            </span>
          )}
        </>
      );

      return (
        <li key={item.key}>
          {item.onOpen ? (
            <button
              type="button"
              onClick={item.onOpen}
              style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), width: '100%', minHeight: 48, padding: `${theme.space(1)}px ${theme.space(1)}px`, background: 'transparent', border: '1px solid transparent', borderRadius: theme.radius.md, textAlign: 'left', cursor: 'pointer', fontFamily: theme.font.body }}
            >
              {inner}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), minHeight: 48, padding: theme.space(1) }}>{inner}</div>
          )}
        </li>
      );
    })}
  </ul>
);

// The small "label / value" pairs of the About and Relationship cards.
export const LvFactRow = ({ theme, label, children }: { theme: LvTheme; label: string; children: ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.space(3), padding: `${theme.space(2)}px 0`, borderBottom: `1px solid ${theme.color.border}` }}>
    <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{label}</span>
    <span style={{ ...theme.type.bodySmall, color: theme.color.heading, textAlign: 'right', overflowWrap: 'anywhere' }}>{children}</span>
  </div>
);

export const LvSectionCard = ({
  theme,
  title,
  icon,
  action,
  children,
}: {
  theme: LvTheme;
  title: string;
  icon?: LvIconName;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <LvCard theme={theme}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.space(3), marginBottom: theme.space(3) }}>
      <h2 style={{ ...theme.type.subheading, fontSize: 17, color: theme.color.heading, margin: 0, display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
        {icon && (
          <span style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
            <LvIcon name={icon} size={18} />
          </span>
        )}
        {title}
      </h2>
      {action}
    </div>
    {children}
  </LvCard>
);

export const LvGhostButton = ({ theme, children, onClick }: { theme: LvTheme; children: ReactNode; onClick?: () => void }) => (
  <LvButton theme={theme} variant="ghost" size="sm" onClick={onClick}>
    {children}
  </LvButton>
);
