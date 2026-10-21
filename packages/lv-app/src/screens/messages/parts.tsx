import {
  CHANNEL_LABELS,
  isOutward,
  type Conversation,
  type ConversationMessage,
} from 'src/api/messages';
import { LvIcon, type LvIconName } from 'src/design/icons';
import { EmptyState, formatWhen, LvBadge, LvButton, VisuallyHidden, type Tone } from 'src/design/kit';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';

// The pieces Messages is made of. A logged contact is not a chat bubble: it
// carries a channel, a direction, what was said and what it changed, so it is
// drawn as a record with a spine rather than a speech balloon.

const CHANNEL_ICON: Record<string, LvIconName> = {
  PHONE: 'phone',
  EMAIL: 'email',
  WHATSAPP: 'whatsapp',
  INSTAGRAM: 'instagram',
  LINKEDIN: 'partner',
  VIDEO_CALL: 'meeting',
  MEETING: 'meeting',
  EVENT: 'meeting',
  WEBSITE: 'website',
  INTERNAL_NOTE: 'note',
  DOCUMENT: 'document',
  FORM: 'note',
};

export const channelIconFor = (channel: string | null): LvIconName => CHANNEL_ICON[channel ?? ''] ?? 'messages';

const SENTIMENT_TONE: Record<string, Tone> = { POSITIVE: 'success', NEUTRAL: 'neutral', NEGATIVE: 'danger', MIXED: 'warning' };

const sentence = (value: string | null): string | null => (value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : null);

/** One conversation in the inbox. */
export const ConversationRow = ({
  theme,
  conversation,
  active,
  now,
  onOpen,
}: {
  theme: LvTheme;
  conversation: Conversation;
  active: boolean;
  now: string;
  onOpen: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={onOpen}
      aria-current={active ? 'true' : undefined}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: theme.space(3),
        width: '100%',
        minHeight: 64,
        padding: theme.space(3),
        borderRadius: theme.radius.md,
        border: `1px solid ${active ? theme.color.brand : theme.color.border}`,
        background: active ? theme.tint.mint.wash : 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: theme.font.body,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          flex: '0 0 auto',
          borderRadius: theme.radius.pill,
          background: theme.color.surfaceSunken,
          color: conversation.awaitingReply ? theme.color.warning : theme.color.textMuted,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LvIcon name={channelIconFor(conversation.lastChannel)} size={18} />
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.space(2), flexWrap: 'wrap' }}>
          <span
            style={{
              ...theme.type.bodySmall,
              // Weight, not a dot: the thing that needs answering should read
              // differently, not just be decorated.
              fontWeight: conversation.awaitingReply ? theme.font.weight.bold : theme.font.weight.medium,
              color: theme.color.heading,
              overflowWrap: 'anywhere',
            }}
          >
            {conversation.leadName ?? 'Unnamed lead'}
          </span>
          <span style={{ ...theme.type.caption, color: theme.color.textSubtle, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {formatWhen(conversation.lastAt, now)}
          </span>
        </span>

        <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>
          {[CHANNEL_LABELS[conversation.lastChannel ?? ''] ?? 'Contact', conversation.lastDirection === 'INBOUND' ? 'from them' : 'from us', `${conversation.count} logged`]
            .filter(Boolean)
            .join(' · ')}
        </span>

        {conversation.lastSummary && (
          <span
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              ...theme.type.bodySmall,
              color: theme.color.text,
              marginTop: 4,
            }}
          >
            {conversation.lastSummary}
          </span>
        )}

        {conversation.awaitingReply && (
          <span style={{ display: 'inline-flex', marginTop: 6 }}>
            <LvBadge theme={theme} tone="warning">Waiting on us</LvBadge>
          </span>
        )}
      </span>
      <VisuallyHidden>{conversation.awaitingReply ? 'They contacted us last and nothing has gone back.' : ''}</VisuallyHidden>
    </button>
  </li>
);

/**
 * One logged contact.
 *
 * Direction is shown by which side the spine sits on and by the label, never
 * by colour alone — and the record's own fields (what was agreed, what was
 * objected to, what happens next) are the point of the entry, not decoration
 * beneath a bubble.
 */
export const MessageEntry = ({ theme, message, now }: { theme: LvTheme; message: ConversationMessage; now: string }) => {
  const inbound = message.direction === 'INBOUND';
  const internal = message.channel === 'INTERNAL_NOTE';
  const accent = internal ? theme.color.textSubtle : inbound ? theme.color.info : theme.color.brand;

  return (
    <li
      className="lv-msg-row"
      style={{
        padding: `${theme.space(3)}px ${theme.space(4)}px`,
        borderLeft: `3px solid ${accent}`,
        background: internal ? theme.color.surfaceSunken : theme.color.surface,
        borderRadius: `0 ${theme.radius.md}px ${theme.radius.md}px 0`,
      }}
    >
      <div className="lv-msg-meta">
        <span aria-hidden="true" style={{ color: accent, display: 'inline-flex' }}>
          <LvIcon name={channelIconFor(message.channel)} size={16} />
        </span>
        <span style={{ ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading }}>
          {CHANNEL_LABELS[message.channel ?? ''] ?? 'Contact'}
        </span>
        <LvBadge theme={theme} tone={internal ? 'neutral' : inbound ? 'info' : 'neutral'}>
          {internal ? 'Internal' : inbound ? 'From them' : 'From us'}
        </LvBadge>
        {message.durationMinutes !== null && <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>{message.durationMinutes} min</span>}
        {message.sentiment && (
          <LvBadge theme={theme} tone={SENTIMENT_TONE[message.sentiment] ?? 'neutral'}>{sentence(message.sentiment)}</LvBadge>
        )}
        <span style={{ ...theme.type.caption, color: theme.color.textSubtle, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {formatWhen(message.occurredAt, now)}
        </span>
      </div>

      {message.summary ? (
        <p style={{ ...theme.type.body, color: theme.color.text, margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.summary}</p>
      ) : (
        <p style={{ ...theme.type.bodySmall, color: theme.color.textSubtle, margin: 0 }}>No summary was written for this contact.</p>
      )}

      {/* The fields that make this a record rather than a message. Each is
          shown only when it holds something. */}
      {[
        ['Outcome', sentence(message.outcome)],
        ['Purpose', sentence(message.purpose)],
        ['They raised', message.objections],
        ['We committed to', message.commitments],
        ['Next', message.nextAction],
      ]
        .filter(([, value]) => Boolean(value))
        .map(([label, value]) => (
          <p key={label as string} style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0, overflowWrap: 'anywhere' }}>
            <strong style={{ color: theme.color.heading, fontWeight: theme.font.weight.medium }}>{label}:</strong> {value}
          </p>
        ))}

      {message.actorName && <span style={{ ...theme.type.caption, color: theme.color.textSubtle }}>Logged by {message.actorName}</span>}
    </li>
  );
};

/**
 * 9.4 — nothing to show.
 *
 * Deliberately not "no conversation has been logged yet". Interactions are
 * record-scoped: an Onboarding Expert sees none of them, and an Experience
 * Hunter sees only those on the leads they work. An empty list therefore does
 * not mean an empty CRM, and saying it does would be a lie to most roles. It
 * also must not say how many exist elsewhere — that would leak exactly what
 * the scoping is there to withhold.
 */
export const NothingYet = ({ theme, onCapture }: { theme: LvTheme; onCapture?: () => void }) => (
  <LvSectionCard theme={theme} title="Messages" icon="messages">
    <EmptyState
      theme={theme}
      icon="messages"
      tint="mint"
      title="No conversations to show"
      text="Messages are the record of contact that has already happened — a call, a WhatsApp exchange, a site visit. Nothing is sent or received here. You see conversations for the relationships you can work, so a colleague may be seeing ones you are not."
      action={
        onCapture && (
          <LvButton theme={theme} variant="secondary" size="sm" onClick={onCapture}>
            Go to My Leads
          </LvButton>
        )
      }
    />
  </LvSectionCard>
);

/** The channels actually used, so the inbox can say what it is made of. */
export const channelSpread = (conversations: Conversation[]): { channel: string; count: number }[] => {
  const counts = new Map<string, number>();

  for (const conversation of conversations) {
    for (const message of conversation.messages) {
      if (isOutward(message.channel) && message.channel !== null) {
        counts.set(message.channel, (counts.get(message.channel) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()].map(([channel, count]) => ({ channel, count })).sort((left, right) => right.count - left.count);
};
