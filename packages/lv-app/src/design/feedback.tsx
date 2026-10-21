import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { LvIcon, type LvIconName } from 'src/design/icons';
import { EmptyState, LvButton, toneColour, toneWash, type Tone } from 'src/design/kit';
import { LvSheet } from 'src/design/overlay';
import { type LvTheme } from 'src/design/theme';
import { useLvTier } from 'src/design/use-tier';

// Telling someone what happened: the notices the CRM raises on its own
// (assignment, an SLA about to breach, a document to review, a mention), and
// the short confirmation that follows something you just did.
//
// A toast is never the only record of anything. It repeats what the screen
// already shows, so missing one costs nothing.

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export type LvNotificationKind = 'assignment' | 'sla' | 'document' | 'mention' | 'system';

const NOTIFICATION_ICON: Record<LvNotificationKind, LvIconName> = {
  assignment: 'leads',
  sla: 'clock',
  document: 'document',
  mention: 'messages',
  system: 'info',
};

const NOTIFICATION_TONE: Record<LvNotificationKind, Tone> = {
  assignment: 'info',
  sla: 'warning',
  document: 'neutral',
  mention: 'info',
  system: 'neutral',
};

export type LvNotification = {
  id: string;
  kind: LvNotificationKind;
  title: string;
  detail?: string | null;
  /** Already formatted — "15 min ago". The list does no date arithmetic. */
  when: string;
  unread?: boolean;
  onOpen?: () => void;
};

export const LvNotificationItem = ({ theme, notification }: { theme: LvTheme; notification: LvNotification }) => {
  const tone = NOTIFICATION_TONE[notification.kind];

  const body = (
    <>
      <span
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          flex: '0 0 auto',
          borderRadius: theme.radius.md,
          background: toneWash(theme, tone),
          color: toneColour(theme, tone),
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LvIcon name={NOTIFICATION_ICON[notification.kind]} size={18} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...theme.type.body, color: theme.color.heading, display: 'block', overflowWrap: 'anywhere' }}>{notification.title}</span>
        {notification.detail && (
          <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted, display: 'block', overflowWrap: 'anywhere' }}>{notification.detail}</span>
        )}
        <span style={{ ...theme.type.caption, color: theme.color.textSubtle, display: 'block' }}>{notification.when}</span>
      </span>
      {notification.unread && (
        <span aria-label="Unread" style={{ width: 8, height: 8, borderRadius: theme.radius.pill, background: theme.color.brand, flex: '0 0 auto', marginTop: 6 }} />
      )}
    </>
  );

  const frame = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.space(3),
    width: '100%',
    minHeight: 44,
    padding: theme.space(3),
    borderRadius: theme.radius.md,
    textAlign: 'left' as const,
    background: notification.unread ? theme.color.surfaceSunken : 'transparent',
    // An unread notice is marked by a brand accent down its leading edge
    // rather than only a filled ground — quieter, and it reads as "new".
    borderStyle: 'solid',
    borderWidth: notification.unread ? '1px 1px 1px 3px' : '1px',
    borderColor: notification.unread ? `transparent transparent transparent ${theme.color.brand}` : 'transparent',
  };

  return (
    <li style={{ listStyle: 'none' }}>
      {notification.onOpen ? (
        <button type="button" className="lv-notif-item" onClick={notification.onOpen} style={{ ...frame, cursor: 'pointer', fontFamily: theme.font.body }}>
          {body}
        </button>
      ) : (
        <div style={frame}>{body}</div>
      )}
    </li>
  );
};

export const LvNotificationList = ({ theme, notifications }: { theme: LvTheme; notifications: LvNotification[] }) =>
  notifications.length === 0 ? (
    <EmptyState theme={theme} text="Nothing needs you right now." />
  ) : (
    <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(1), margin: 0, padding: 0, listStyle: 'none' }}>
      {notifications.map((notification) => (
        <LvNotificationItem key={notification.id} theme={theme} notification={notification} />
      ))}
    </ul>
  );

/**
 * The bell's panel: a popover where there is room beside the bar, a bottom
 * sheet on a phone — the same list either way.
 */
export const LvNotificationPanel = ({
  theme,
  notifications,
  onClose,
  onMarkAllRead,
}: {
  theme: LvTheme;
  notifications: LvNotification[];
  onClose: () => void;
  onMarkAllRead?: () => void;
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

  if (tier === 'mobile') {
    return (
      <LvSheet
        theme={theme}
        title="Notifications"
        onClose={onClose}
        footer={
          onMarkAllRead ? (
            <LvButton theme={theme} variant="secondary" onClick={onMarkAllRead}>
              Mark all as read
            </LvButton>
          ) : undefined
        }
      >
        <LvNotificationList theme={theme} notifications={notifications} />
      </LvSheet>
    );
  }

  return (
    <div
      ref={wrapper}
      role="dialog"
      aria-label="Notifications"
      style={{
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 8px)',
        width: 380,
        maxHeight: '70vh',
        overflowY: 'auto',
        zIndex: 60,
        background: theme.color.surfaceRaised,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.lg,
        boxShadow: theme.shadow.md,
        padding: theme.space(3),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.space(3), marginBottom: theme.space(2) }}>
        <h2 style={{ ...theme.type.heading, color: theme.color.heading, margin: 0 }}>Notifications</h2>
        {onMarkAllRead && (
          <LvButton theme={theme} variant="ghost" size="sm" onClick={onMarkAllRead}>
            Mark all read
          </LvButton>
        )}
      </div>
      <LvNotificationList theme={theme} notifications={notifications} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
export type LvToastMessage = { id: string; tone: Tone; text: string; action?: { label: string; onSelect: () => void } };

/** At most three are shown; the rest wait, so a burst cannot bury the screen. */
const MAX_VISIBLE_TOASTS = 3;

export const useLvToasts = (timeoutMs = 5000) => {
  const [toasts, setToasts] = useState<LvToastMessage[]>([]);

  const dismiss = useCallback((id: string) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const push = useCallback(
    (toast: Omit<LvToastMessage, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => dismiss(id), timeoutMs);

      return id;
    },
    [dismiss, timeoutMs],
  );

  return { toasts: toasts.slice(0, MAX_VISIBLE_TOASTS), push, dismiss };
};

export const LvToast = ({ theme, toast, onDismiss }: { theme: LvTheme; toast: LvToastMessage; onDismiss: () => void }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: theme.space(3),
      padding: `${theme.space(3)}px ${theme.space(4)}px`,
      borderRadius: theme.radius.lg,
      background: theme.color.surfaceRaised,
      border: `1px solid ${toneColour(theme, toast.tone)}`,
      boxShadow: theme.shadow.md,
      pointerEvents: 'auto',
    }}
  >
    <span aria-hidden="true" style={{ color: toneColour(theme, toast.tone), display: 'inline-flex' }}>
      <LvIcon name={toast.tone === 'danger' || toast.tone === 'warning' ? 'warning' : 'check'} size={18} />
    </span>
    <span style={{ ...theme.type.body, color: theme.color.text, flex: 1, minWidth: 0 }}>{toast.text}</span>
    {toast.action && (
      <LvButton theme={theme} variant="ghost" size="sm" onClick={toast.action.onSelect}>
        {toast.action.label}
      </LvButton>
    )}
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss"
      style={{
        width: 32,
        height: 32,
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
      <LvIcon name="plus" size={16} style={{ transform: 'rotate(45deg)' }} />
    </button>
  </div>
);

/**
 * Bottom-right on a wide screen; on a phone, full width just above the
 * navigation bar, so a confirmation never covers the six doors.
 */
export const LvToastStack = ({ theme, toasts, onDismiss }: { theme: LvTheme; toasts: LvToastMessage[]; onDismiss: (id: string) => void }) => (
  <div className="lv-toast-stack" role="status" aria-live="polite" style={{ position: 'fixed', zIndex: 120, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
    {toasts.map((toast) => (
      <LvToast key={toast.id} theme={theme} toast={toast} onDismiss={() => onDismiss(toast.id)} />
    ))}
  </div>
);

/** A banner for a state the page is in, rather than an event that just passed. */
export const LvBanner = ({ theme, tone = 'info', title, children }: { theme: LvTheme; tone?: Tone; title: string; children?: ReactNode }) => (
  <div
    role="status"
    style={{
      display: 'flex',
      gap: theme.space(3),
      padding: theme.space(4),
      borderRadius: theme.radius.lg,
      background: toneWash(theme, tone),
      border: `1px solid ${toneColour(theme, tone)}33`,
    }}
  >
    <span aria-hidden="true" style={{ color: toneColour(theme, tone), display: 'inline-flex', flex: '0 0 auto' }}>
      <LvIcon name={tone === 'danger' || tone === 'warning' ? 'warning' : 'info'} size={20} />
    </span>
    <span style={{ minWidth: 0 }}>
      <span style={{ ...theme.type.subheading, fontSize: 15, color: theme.color.heading, display: 'block' }}>{title}</span>
      {children && <span style={{ ...theme.type.bodySmall, color: theme.color.text, display: 'block', marginTop: 2 }}>{children}</span>}
    </span>
  </div>
);
