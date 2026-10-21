import { useEffect, useRef, useState, type ReactNode } from 'react';

import { LvIcon, type LvIconName } from 'src/design/icons';
import { LvButton } from 'src/design/kit';
import { type LvTheme } from 'src/design/theme';
import { useIsPhone } from 'src/design/use-tier';

// Overlays: the dialog every action opens, the drawer that shows a record
// without losing your place in the list, the sheet a phone gets instead of a
// popover, the overflow menu, and the pause before something irreversible.
//
// All of them are written for the keyboard first — Escape closes, focus moves
// in and comes back where it started, and the backdrop is a real button rather
// than a div with a click handler. On a phone every one of them docks to the
// bottom of the screen, which is where a thumb is.

// ---------------------------------------------------------------------------
// The scaffolding all four overlays share: Escape, a locked page behind them,
// focus moved in and then restored to whatever opened them.
// ---------------------------------------------------------------------------
const useOverlayShell = (onClose: () => void) => {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return panel;
};

const Backdrop = ({ onClose }: { onClose: () => void }) => (
  <button
    type="button"
    aria-label="Close"
    onClick={onClose}
    style={{ position: 'absolute', inset: 0, background: 'rgba(22, 38, 30, 0.35)', border: 'none', cursor: 'pointer' }}
  />
);

const CloseButton = ({ theme, onClose }: { theme: LvTheme; onClose: () => void }) => (
  <button
    type="button"
    onClick={onClose}
    aria-label="Close"
    // The shared close for every overlay. 36px is right from 768px up, but on a
    // phone it is below the touch floor, so the height comes from
    // .lv-icon-button (44px phone / 36px md) rather than this inline pair —
    // min-width/min-height clamp the values below, so the disc keeps its shape.
    className="lv-icon-button"
    style={{
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      border: '1px solid transparent',
      background: 'transparent',
      color: theme.color.textMuted,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
    }}
  >
    <LvIcon name="plus" size={18} style={{ transform: 'rotate(45deg)' }} />
  </button>
);

const OverlayHeader = ({ theme, title, description, onClose }: { theme: LvTheme; title: string; description?: string; onClose: () => void }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.space(3), marginBottom: theme.space(4) }}>
    <div>
      <h2 style={{ ...theme.type.subheading, fontSize: 19, color: theme.color.heading, margin: 0 }}>{title}</h2>
      {description && <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0` }}>{description}</p>}
    </div>
    <CloseButton theme={theme} onClose={onClose} />
  </div>
);

// The grab handle a sheet carries so it reads as something you can dismiss.
// Its `display` is left to the stylesheet — set inline it would survive the
// media query and leave a handle floating on a centred desktop dialog.
const SheetHandle = ({ theme }: { theme: LvTheme }) => (
  <span
    aria-hidden="true"
    className="lv-sheet-handle"
    style={{ width: 40, height: 4, borderRadius: theme.radius.pill, background: theme.color.borderStrong, margin: `0 auto ${theme.space(3)}px` }}
  />
);

// ---------------------------------------------------------------------------
// Modal — one decision or one short form. Centred on desktop, docked to the
// bottom edge on a phone.
// ---------------------------------------------------------------------------
export const LvModal = ({
  theme,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'compact',
}: {
  theme: LvTheme;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * 'compact' is one decision or a couple of fields — a bottom sheet on a
   * phone. 'full' is a workflow with enough in it that a sheet would leave the
   * commit under the keyboard: it takes the whole phone screen, with the
   * header and the footer pinned and only the body scrolling.
   */
  size?: 'compact' | 'full';
}) => {
  const panel = useOverlayShell(onClose);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }}>
      <Backdrop onClose={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={size === 'full' ? 'lv-modal-panel lv-modal-full' : 'lv-modal-panel'}
        style={{
          position: 'relative',
          margin: 'auto',
          background: theme.color.surfaceRaised,
          border: `1px solid ${theme.color.border}`,
          boxShadow: theme.shadow.lg,
        }}
      >
        <SheetHandle theme={theme} />
        <OverlayHeader theme={theme} title={title} description={description} onClose={onClose} />
        <div className="lv-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>{children}</div>
        {footer && <div className="lv-overlay-footer" style={{ display: 'flex', gap: theme.space(2), marginTop: theme.space(6) }}>{footer}</div>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Drawer — detail without leaving the list. A right-hand panel on desktop, a
// tall bottom sheet on a phone, because there is nothing to sit beside.
// ---------------------------------------------------------------------------
export const LvDrawer = ({
  theme,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  theme: LvTheme;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) => {
  const panel = useOverlayShell(onClose);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }}>
      <Backdrop onClose={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="lv-drawer-panel"
        style={{
          position: 'relative',
          background: theme.color.surfaceRaised,
          border: `1px solid ${theme.color.border}`,
          boxShadow: theme.shadow.lg,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <SheetHandle theme={theme} />
        <OverlayHeader theme={theme} title={title} description={description} onClose={onClose} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>{children}</div>
        {footer && <div className="lv-overlay-footer" style={{ display: 'flex', gap: theme.space(2), marginTop: theme.space(5) }}>{footer}</div>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sheet — the phone form of a picker or a filter set. On a wider screen the
// same content renders as a plain centred panel.
// ---------------------------------------------------------------------------
export const LvSheet = ({
  theme,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  theme: LvTheme;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) => {
  const panel = useOverlayShell(onClose);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }}>
      <Backdrop onClose={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="lv-sheet-panel"
        style={{
          position: 'relative',
          background: theme.color.surfaceRaised,
          border: `1px solid ${theme.color.border}`,
          boxShadow: theme.shadow.lg,
          maxHeight: '88vh',
          overflowY: 'auto',
        }}
      >
        <SheetHandle theme={theme} />
        <OverlayHeader theme={theme} title={title} description={description} onClose={onClose} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>{children}</div>
        {footer && <div className="lv-overlay-footer" style={{ display: 'flex', gap: theme.space(2), marginTop: theme.space(5) }}>{footer}</div>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Confirmation — the pause before something that cannot be taken back. The
// confirm button says the verb, never "OK", and it is not what receives focus.
// ---------------------------------------------------------------------------
export const LvConfirm = ({
  theme,
  title,
  consequence,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = 'danger',
  busy,
}: {
  theme: LvTheme;
  title: string;
  /** What will actually happen, named plainly. */
  consequence: string;
  /** The verb — "Delete the lead", "Archive", "Send" — never "OK". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'danger' | 'primary';
  busy?: boolean;
}) => (
  <LvSheet
    theme={theme}
    title={title}
    onClose={onCancel}
    footer={
      <>
        <LvButton theme={theme} variant="ghost" onClick={onCancel}>
          Cancel
        </LvButton>
        <LvButton theme={theme} variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} busy={busy}>
          {confirmLabel}
        </LvButton>
      </>
    }
  >
    <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>{consequence}</p>
  </LvSheet>
);

// ---------------------------------------------------------------------------
// Menu — a popover beside its trigger on a wider screen, a bottom sheet on a
// phone. The markup genuinely differs, so this is one of the few places that
// reads the viewport rather than leaving it to the stylesheet.
// ---------------------------------------------------------------------------
export type LvMenuItem = { key: string; label: string; icon?: LvIconName; onSelect: () => void; disabled?: boolean; tone?: 'default' | 'danger' };

const menuItemStyle = (theme: LvTheme, item: LvMenuItem) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space(3),
  width: '100%',
  minHeight: 44,
  padding: `0 ${theme.space(3)}px`,
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: theme.radius.md,
  textAlign: 'left' as const,
  cursor: item.disabled ? ('not-allowed' as const) : ('pointer' as const),
  opacity: item.disabled ? 0.5 : 1,
  fontFamily: theme.font.body,
  fontSize: theme.font.size.md,
  color: item.tone === 'danger' ? theme.color.danger : theme.color.text,
});

export const LvMenu = ({ theme, label, items }: { theme: LvTheme; label: string; items: LvMenuItem[] }) => {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const isPhone = useIsPhone();

  useEffect(() => {
    if (!open || isPhone) {
      return;
    }

    const onPointer = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, isPhone]);

  const choose = (item: LvMenuItem) => {
    setOpen(false);
    item.onSelect();
  };

  return (
    <div ref={wrapper} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        style={{
          width: 44,
          height: 44,
          borderRadius: theme.radius.pill,
          border: `1px solid ${theme.color.border}`,
          background: theme.color.surfaceRaised,
          color: theme.color.textMuted,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LvIcon name="more" size={20} />
      </button>

      {open && isPhone && (
        <LvSheet theme={theme} title={label} onClose={() => setOpen(false)}>
          {/* Same menu semantics as the popover: the sheet is how it looks on
              a phone, not a different control. */}
          <div role="menu" aria-label={label} style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((item) => (
              <button key={item.key} type="button" role="menuitem" disabled={item.disabled} onClick={() => choose(item)} style={menuItemStyle(theme, item)}>
                {item.icon && <LvIcon name={item.icon} size={17} />}
                {item.label}
              </button>
            ))}
          </div>
        </LvSheet>
      )}

      {open && !isPhone && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            minWidth: 220,
            zIndex: 50,
            background: theme.color.surfaceRaised,
            border: `1px solid ${theme.color.border}`,
            borderRadius: theme.radius.lg,
            boxShadow: theme.shadow.md,
            padding: theme.space(1),
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {items.map((item) => (
            <button key={item.key} type="button" role="menuitem" disabled={item.disabled} onClick={() => choose(item)} style={menuItemStyle(theme, item)}>
              {item.icon && <LvIcon name={item.icon} size={17} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// The footer every dialog shares: cancel on the left of the commit, and the
// commit carries the busy state so a slow route cannot be double-submitted.
export const LvModalFooter = ({
  theme,
  onCancel,
  onConfirm,
  confirmLabel,
  busy,
  disabled,
}: {
  theme: LvTheme;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  busy?: boolean;
  disabled?: boolean;
}) => (
  <>
    <LvButton theme={theme} variant="ghost" onClick={onCancel}>
      Cancel
    </LvButton>
    <LvButton theme={theme} variant="primary" onClick={onConfirm} busy={busy} disabled={disabled}>
      {confirmLabel}
    </LvButton>
  </>
);
