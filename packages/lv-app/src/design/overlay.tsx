import { useEffect, useRef, useState, type ReactNode } from 'react';

import { LvIcon, type LvIconName } from 'src/design/icons';
import { LvButton } from 'src/design/kit';
import { type LvTheme } from 'src/design/theme';

// Overlays: the dialog every action opens, and the overflow menu the reference
// board puts beside the primary buttons.
//
// Both are written for the keyboard first — Escape closes, focus moves into
// the dialog and comes back where it started, and the backdrop is a real
// button rather than a div with a click handler. On a phone the dialog docks
// to the bottom of the screen, which is where a thumb is.

export const LvModal = ({
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(22, 38, 30, 0.35)', border: 'none', cursor: 'pointer' }}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="lv-modal-panel"
        style={{
          position: 'relative',
          margin: 'auto',
          width: 'min(560px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: theme.color.surfaceRaised,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.xl,
          boxShadow: theme.shadow.lg,
          padding: theme.space(6),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.space(3), marginBottom: theme.space(4) }}>
          <div>
            <h2 style={{ ...theme.type.subheading, fontSize: 19, color: theme.color.heading, margin: 0 }}>{title}</h2>
            {description && <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0` }}>{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 36, height: 36, borderRadius: theme.radius.pill, border: '1px solid transparent', background: 'transparent', color: theme.color.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}
          >
            <LvIcon name="plus" size={18} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.space(2), marginTop: theme.space(6), flexWrap: 'wrap' }}>{footer}</div>}
      </div>
    </div>
  );
};

export type LvMenuItem = { key: string; label: string; icon?: LvIconName; onSelect: () => void; disabled?: boolean; tone?: 'default' | 'danger' };

export const LvMenu = ({ theme, label, items }: { theme: LvTheme; label: string; items: LvMenuItem[] }) => {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
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
  }, [open]);

  return (
    <div ref={wrapper} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        style={{ width: 44, height: 44, borderRadius: theme.radius.pill, border: `1px solid ${theme.color.border}`, background: theme.color.surfaceRaised, color: theme.color.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <LvIcon name="more" size={20} />
      </button>
      {open && (
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
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.space(3),
                minHeight: 44,
                padding: `0 ${theme.space(3)}px`,
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: theme.radius.md,
                textAlign: 'left',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? 0.5 : 1,
                fontFamily: theme.font.body,
                fontSize: theme.font.size.md,
                color: item.tone === 'danger' ? theme.color.danger : theme.color.text,
              }}
            >
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
