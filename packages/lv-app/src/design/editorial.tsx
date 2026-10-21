import { type ReactNode } from 'react';

import { type LvIconName } from 'src/design/icons';
import { type LvTheme } from 'src/design/theme';

// The editorial settings layout, shared by the profile and the workspace
// settings. A page reads as one calm column: an identity band, then sections
// whose rows carry a label on the left and the control on the right, parted by
// hairlines — not a stack of boxed forms. The width behaviour lives in
// LvStyles under `.lv-acct-*`; these components only place the content.

/** The centred, max-width column every editorial page sits in. */
export const EditorialColumn = ({ children }: { children: ReactNode }) => <div className="lv-acct">{children}</div>;

/** A section: a heading, an optional line under it, and its rows. */
export const EditorialSection = ({
  theme,
  title,
  desc,
  action,
  children,
}: {
  theme: LvTheme;
  title: string;
  desc?: string;
  action?: ReactNode;
  // Accepted for drop-in compatibility with the older boxed section card, and
  // intentionally not rendered: an editorial section reads by its heading.
  icon?: LvIconName;
  children: ReactNode;
}) => (
  <section className="lv-acct-section" aria-label={title}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.space(3) }}>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: theme.space(1) }}>
        <h2 style={{ ...theme.type.title, fontSize: 19, color: theme.color.heading, margin: 0 }}>{title}</h2>
        {desc && <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>{desc}</p>}
      </div>
      {action}
    </div>
    <div className="lv-acct-rows">{children}</div>
  </section>
);

/** One row: the label and its help on the left, the control on the right. */
export const EditorialRow = ({
  theme,
  label,
  help,
  htmlFor,
  error,
  children,
}: {
  theme: LvTheme;
  label: string;
  help?: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
}) => (
  <div className="lv-acct-row">
    <div style={{ minWidth: 0 }}>
      <label htmlFor={htmlFor} style={{ ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading, display: 'block' }}>
        {label}
      </label>
      {help && <span style={{ ...theme.type.caption, color: theme.color.textMuted, display: 'block', marginTop: 2 }}>{help}</span>}
    </div>
    <div className="lv-acct-control">
      {children}
      {error && (
        <span id={htmlFor ? `${htmlFor}-error` : undefined} style={{ ...theme.type.caption, color: theme.color.danger, display: 'block', marginTop: 4 }}>
          {error}
        </span>
      )}
    </div>
  </div>
);

/** A plain read-only value, styled to sit where a control would. */
export const EditorialReadOnly = ({ theme, children }: { theme: LvTheme; children: ReactNode }) => (
  <span style={{ ...theme.type.body, color: theme.color.text, overflowWrap: 'anywhere' }}>{children}</span>
);
