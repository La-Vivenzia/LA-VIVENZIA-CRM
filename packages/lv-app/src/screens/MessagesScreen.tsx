import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  CHANNEL_LABELS,
  matchesFilter,
  useConversation,
  useConversations,
  type InboxFilter,
} from 'src/api/messages';
import { LvIcon } from 'src/design/icons';
import {
  EmptyState,
  ErrorState,
  formatWhen,
  InlineNotice,
  isForbiddenMessage,
  LoadingState,
  LvBadge,
  LvButton,
  LvCard,
  LvSearchField,
  Segmented,
  VisuallyHidden,
} from 'src/design/kit';
import { LvContextualActions, LvPageHeader } from 'src/design/page';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';
import { useLvTier } from 'src/design/use-tier';
import { DraftDialog } from 'src/screens/messages/draft';
import { ConversationRow, MessageEntry, NothingYet } from 'src/screens/messages/parts';

// 9.1 the conversations list, 9.2 the thread, 9.3 the draft, 9.4 nothing yet.
//
// One route pair drives both columns: `/messages` is the inbox and
// `/messages/:leadId` is a thread. On a phone those are two screens and the
// browser's Back button moves between them, which is the only inbox model
// that works on a phone. From 1024px both are on screen at once and the same
// URLs still address them, so a colleague can be sent straight to a thread.
//
// There is no composer, because there is nothing to send: La Vivenzia has no
// mail or chat transport. What a person does here is draft a message, send it
// themselves, and log what happened — and the screen says so rather than
// offering a Send button that would do nothing.

export const MessagesScreen = ({ theme, viewerId }: { theme: LvTheme; viewerId: string | null }) => {
  const navigate = useNavigate();
  const { leadId } = useParams<{ leadId?: string }>();
  const tier = useLvTier();
  const { conversations, error, loading, truncated, reload } = useConversations();
  const [filter, setFilter] = useState<InboxFilter>('ALL');
  const [query, setQuery] = useState('');
  const [drafting, setDrafting] = useState(false);
  const now = new Date().toISOString();

  const active = useConversation(conversations, leadId);
  const wide = tier === 'desktop';

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return (conversations ?? [])
      .filter((conversation) => matchesFilter(conversation, filter, viewerId))
      .filter(
        (conversation) =>
          needle === '' ||
          `${conversation.leadName ?? ''} ${conversation.lvLeadId ?? ''} ${conversation.location ?? ''} ${conversation.lastSummary ?? ''}`
            .toLowerCase()
            .includes(needle),
      );
  }, [conversations, filter, query, viewerId]);

  const awaiting = (conversations ?? []).filter((conversation) => conversation.awaitingReply).length;

  // ---------------------------------------------------------------- states
  if (error !== null && conversations === null) {
    return (
      <>
        <LvPageHeader theme={theme} variant="hero" title="Messages" />
        <ErrorState
          theme={theme}
          title={isForbiddenMessage(error) ? 'Your role cannot see conversations' : 'The conversations could not be loaded'}
          text={error}
          onRetry={isForbiddenMessage(error) ? undefined : () => void reload()}
        />
      </>
    );
  }

  if (conversations === null) {
    return (
      <>
        <LvPageHeader theme={theme} variant="hero" title="Messages" />
        <LoadingState theme={theme} rows={5} label="Loading conversations" />
      </>
    );
  }

  if (conversations.length === 0) {
    return (
      <>
        <LvPageHeader
          theme={theme}
          variant="hero"
          title="Messages"
          subtitle="Every contact with a relationship, in one place. Nothing is sent or received here — this is the record of what happened."
        />
        <NothingYet theme={theme} onCapture={() => navigate('/leads')} />
      </>
    );
  }

  // 9.2 on a phone: the thread is its own screen.
  const showList = wide || active === null;
  const showThread = wide || active !== null;

  const inbox = (
    <LvSectionCard theme={theme} title={`Conversations · ${visible.length} of ${conversations.length}`} icon="messages">
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
        <LvSearchField theme={theme} value={query} onChange={setQuery} label="Search conversations" placeholder="Name, reference or what was said" />
        <Segmented
          theme={theme}
          label="Which conversations"
          value={filter}
          onChange={(next) => setFilter(next as InboxFilter)}
          options={[
            { key: 'ALL', label: 'Everything', count: conversations.length },
            { key: 'AWAITING', label: 'Waiting on us', count: awaiting },
            { key: 'MINE', label: 'Mine', count: conversations.filter((conversation) => viewerId !== null && conversation.ownerId === viewerId).length },
            { key: 'INBOUND', label: 'Had a reply', count: conversations.filter((conversation) => conversation.messages.some((m) => m.direction === 'INBOUND')).length },
          ]}
        />

        {visible.length === 0 ? (
          <EmptyState
            theme={theme}
            icon="filter"
            tint="blue"
            title="Nothing matches this view"
            text="The conversations exist — this filter or search just does not match them."
            action={
              <LvButton
                theme={theme}
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFilter('ALL');
                  setQuery('');
                }}
              >
                Show everything
              </LvButton>
            }
          />
        ) : (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
            {visible.map((conversation) => (
              <ConversationRow
                key={conversation.leadId}
                theme={theme}
                conversation={conversation}
                active={conversation.leadId === leadId}
                now={now}
                onOpen={() => navigate(`/messages/${conversation.leadId}`)}
              />
            ))}
          </ul>
        )}

        {truncated && (
          <InlineNotice theme={theme}>
            Showing the most recent contacts only. Older conversations are on each lead&apos;s own timeline.
          </InlineNotice>
        )}
      </div>
    </LvSectionCard>
  );

  const thread = active ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
      {/* A compact context header: who, why it matters, and the way into the
          full record. Not a second copy of the lead page. */}
      <LvCard theme={theme} padding={4}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(2) }}>
            <span style={{ ...theme.type.subheading, fontSize: 18, color: theme.color.heading, minWidth: 0, overflowWrap: 'anywhere' }}>
              {active.leadName ?? 'Unnamed lead'}
            </span>
            {active.awaitingReply && <LvBadge theme={theme} tone="warning">Waiting on us</LvBadge>}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: `2px ${theme.space(4)}px` }}>
            {[
              ['Reference', active.lvLeadId],
              ['Where', active.location],
              ['Owner', active.ownerName],
              ['Contacts logged', String(active.count)],
              ['Last', formatWhen(active.lastAt, now)],
            ]
              .filter(([, value]) => Boolean(value))
              .map(([label, value]) => (
                <span key={label as string} style={{ display: 'flex', gap: theme.space(1), minWidth: 0 }}>
                  <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>{label}</span>
                  <span style={{ ...theme.type.bodySmall, color: theme.color.heading, overflowWrap: 'anywhere' }}>{value}</span>
                </span>
              ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
            <LvButton theme={theme} variant="ghost" size="sm" onClick={() => navigate(`/leads/${active.leadId}`)} icon={<LvIcon name="leads" size={15} />}>
              Open the relationship
            </LvButton>
            <LvButton theme={theme} variant="ghost" size="sm" onClick={() => navigate(`/leads/${active.leadId}/timeline`)}>
              Full timeline
            </LvButton>
          </div>
        </div>
      </LvCard>

      <LvSectionCard theme={theme} title={`What has been said (${active.count})`} icon="clock">
        <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), margin: 0, padding: 0, listStyle: 'none' }}>
          {active.messages.map((message) => (
            <MessageEntry key={message.id} theme={theme} message={message} now={now} />
          ))}
        </ul>
      </LvSectionCard>

      {/* Said once, at the foot of the exchange, where somebody would look for
          a reply box and not find one. */}
      <InlineNotice theme={theme}>
        There is no reply box because La Vivenzia sends nothing. Draft a message here, send it from{' '}
        {CHANNEL_LABELS[active.lastChannel ?? ''] ? `${CHANNEL_LABELS[active.lastChannel ?? '']} or wherever suits` : 'wherever suits'}, then log what
        happened so the record stays true.
      </InlineNotice>
    </div>
  ) : (
    <LvSectionCard theme={theme} title="Choose a conversation" icon="messages">
      <EmptyState theme={theme} icon="messages" tint="blue" text="Pick a relationship on the left to see every contact logged with them." />
    </LvSectionCard>
  );

  return (
    <>
      <LvPageHeader
        theme={theme}
        variant={active && !wide ? 'panel' : 'hero'}
        title={active && !wide ? (active.leadName ?? 'Conversation') : 'Messages'}
        subtitle={
          active && !wide
            ? undefined
            : `Every contact with a relationship, in one place.${awaiting > 0 ? ` ${awaiting} ${awaiting === 1 ? 'is' : 'are'} waiting on us.` : ''}`
        }
        onBack={active && !wide ? () => navigate('/messages') : undefined}
        backLabel="Back to conversations"
        actions={
          <LvButton theme={theme} variant="secondary" onClick={() => void reload()}>
            Refresh
          </LvButton>
        }
      />

      {error !== null && <InlineNotice theme={theme} tone="danger">{error}</InlineNotice>}
      {loading && <VisuallyHidden aria-live="polite">Refreshing conversations</VisuallyHidden>}

      <div className="lv-messages">
        {showList && <div className="lv-messages-list">{inbox}</div>}
        {showThread && <div className="lv-messages-thread">{thread}</div>}
      </div>

      {/* The two things a person can actually do about a conversation. */}
      {active && (
        <LvContextualActions theme={theme}>
          <LvButton theme={theme} variant="primary" onClick={() => setDrafting(true)} icon={<LvIcon name="sparkle" size={16} />}>
            Draft a message
          </LvButton>
          <LvButton theme={theme} variant="secondary" onClick={() => navigate(`/leads/${active.leadId}?action=interaction`)}>
            Log a contact
          </LvButton>
        </LvContextualActions>
      )}

      {drafting && active && (
        <DraftDialog
          theme={theme}
          conversation={active}
          onClose={() => setDrafting(false)}
          onLogIt={() => {
            setDrafting(false);
            navigate(`/leads/${active.leadId}?action=interaction`);
          }}
        />
      )}
    </>
  );
};
