import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createNote, searchLeads, useNotes, type LeadOption, type WorkNote } from 'src/api/work';
import { LvIcon } from 'src/design/icons';
import {
  EmptyState,
  ErrorState,
  Field,
  ForbiddenState,
  formatWhen,
  InlineNotice,
  isForbiddenMessage,
  LoadingState,
  LoadingState as Skeleton,
  LvButton,
  LvCard,
  LvInput,
  LvSearchField,
  LvTextarea,
} from 'src/design/kit';
import { LvSheet } from 'src/design/overlay';
import { LvPageHeader } from 'src/design/page';
import { type LvTheme } from 'src/design/theme';

// 11.6 — notes.
//
// Twenty's own `note` rows, attached to a lead through `noteTarget`, which is
// exactly what the Notes tab on a relationship shows and what `/notes/create`
// writes. This screen is the same rows read across every relationship at once,
// so a team can see what was written without opening each lead in turn.
//
// A note belongs to a relationship — the route requires a `leadId` — so adding
// one starts by naming it.

export const WorkNotesScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const { notes, loading, error, reload } = useNotes();
  const [query, setQuery] = useState('');
  const [writing, setWriting] = useState(false);

  const now = new Date().toISOString();
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (needle.length === 0) {
      return notes;
    }

    return notes.filter((note) =>
      [note.title, note.body, note.leadName, note.leadRef, note.authorName]
        .filter((value): value is string => typeof value === 'string')
        .some((value) => value.toLowerCase().includes(needle)),
    );
  }, [notes, query]);

  const header = (
    <LvPageHeader
      theme={theme}
      variant="panel"
      title="Notes"
      subtitle="Internal notes written across every relationship."
      onBack={() => navigate('/today')}
      backLabel="Back to Today"
      actions={
        <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setWriting(true)} icon={<LvIcon name="note" size={16} />}>
          Write a note
        </LvButton>
      }
    />
  );

  if (error !== null && isForbiddenMessage(error)) {
    return (
      <>
        {header}
        <ForbiddenState theme={theme} text="Your role cannot read notes. Ask an administrator if you need them." />
      </>
    );
  }

  return (
    <>
      {header}

      <LvCard theme={theme}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
          <LvSearchField theme={theme} label="Search notes" placeholder="Relationship, author or what was written" value={query} onChange={setQuery} />

          {loading ? (
            <LoadingState theme={theme} rows={4} label="Loading notes" />
          ) : error !== null ? (
            <ErrorState theme={theme} title="Notes could not be loaded" text={error} onRetry={reload} />
          ) : notes.length === 0 ? (
            <EmptyState
              theme={theme}
              icon="note"
              tint="lavender"
              title="No notes yet"
              text="A note records something the team should know about a relationship. It is never sent to the partner."
              action={
                <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setWriting(true)}>
                  Write the first one
                </LvButton>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              theme={theme}
              icon="filter"
              tint="blue"
              title="Nothing matches that search"
              text="The notes exist — this search just does not match them."
              action={
                <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setQuery('')}>
                  Show everything
                </LvButton>
              }
            />
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
              {visible.map((note) => (
                <NoteRow key={note.id} theme={theme} note={note} now={now} onOpenLead={(leadId) => navigate(`/leads/${leadId}`)} />
              ))}
            </ul>
          )}
        </div>
      </LvCard>

      {writing && (
        <NewNoteSheet
          theme={theme}
          onClose={() => setWriting(false)}
          onWritten={() => {
            setWriting(false);
            reload();
          }}
        />
      )}
    </>
  );
};

const NoteRow = ({ theme, note, now, onOpenLead }: { theme: LvTheme; note: WorkNote; now: string; onOpenLead: (leadId: string) => void }) => (
  <li className="lv-action-row" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, padding: `${theme.space(3)}px 0` }}>
    <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.space(2), flexWrap: 'wrap' }}>
      {note.leadId === null ? (
        <span style={{ ...theme.type.subheading, color: theme.color.textMuted }}>No relationship</span>
      ) : (
        <button
          type="button"
          onClick={() => onOpenLead(note.leadId as string)}
          className="lv-text-button"
          style={{ ...theme.type.subheading, background: 'transparent', border: 'none', padding: 0, color: theme.color.heading, fontFamily: theme.font.body, cursor: 'pointer', textAlign: 'left', overflowWrap: 'anywhere' }}
        >
          {note.leadName ?? 'Open the relationship'}
        </button>
      )}
      <span style={{ ...theme.type.caption, color: theme.color.textSubtle }}>{note.leadRef}</span>
      <span style={{ ...theme.type.caption, color: theme.color.textSubtle, marginLeft: 'auto' }}>{formatWhen(note.createdAt, now)}</span>
    </span>

    {note.title && <span style={{ ...theme.type.body, color: theme.color.heading, fontWeight: theme.font.weight.medium, overflowWrap: 'anywhere' }}>{note.title}</span>}
    {note.body && <span style={{ ...theme.type.body, color: theme.color.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{note.body}</span>}

    <span style={{ ...theme.type.caption, color: theme.color.textSubtle }}>{note.authorName ? `Written by ${note.authorName}` : 'Author not recorded'}</span>
  </li>
);

const NewNoteSheet = ({ theme, onClose, onWritten }: { theme: LvTheme; onClose: () => void; onWritten: () => void }) => {
  const [term, setTerm] = useState('');
  const [options, setOptions] = useState<LeadOption[]>([]);
  const [lead, setLead] = useState<LeadOption | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const look = async (next: string) => {
    setTerm(next);

    if (next.trim().length < 2) {
      setOptions([]);

      return;
    }

    setSearching(true);

    try {
      setOptions(await searchLeads(next));
    } catch {
      setOptions([]);
    } finally {
      setSearching(false);
    }
  };

  const submit = async () => {
    if (lead === null) {
      setError('Choose the relationship this note is about.');

      return;
    }

    setBusy(true);
    setError(null);

    try {
      await createNote(lead.id, body.trim());
      onWritten();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That note could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LvSheet
      theme={theme}
      title="Write a note"
      description="Internal. It is never sent to the partner."
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
          <LvButton theme={theme} variant="primary" busy={busy} disabled={lead === null || body.trim().length < 2} onClick={() => void submit()}>
            Save the note
          </LvButton>
          <LvButton theme={theme} variant="ghost" onClick={onClose}>
            Cancel
          </LvButton>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        {error && <InlineNotice theme={theme} tone="danger">{error}</InlineNotice>}

        {lead === null ? (
          <Field theme={theme} label="Relationship" htmlFor="note-lead" required help="Search by name, reference or place.">
            <LvInput theme={theme} id="note-lead" value={term} placeholder="e.g. Sunset Villa, LV-000003" onChange={(event) => void look(event.target.value)} />
            {searching && <Skeleton theme={theme} rows={1} label="Searching" />}
            {options.length > 0 && (
              <ul style={{ margin: `${theme.space(2)}px 0 0`, padding: 0, listStyle: 'none' }}>
                {options.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => setLead(option)}
                      style={{
                        ...theme.type.body,
                        width: '100%',
                        minHeight: 44,
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `1px solid ${theme.color.border}`,
                        padding: `${theme.space(2)}px 0`,
                        color: theme.color.text,
                        fontFamily: theme.font.body,
                        cursor: 'pointer',
                      }}
                    >
                      {option.name}
                      {option.ref && <span style={{ ...theme.type.caption, color: theme.color.textSubtle, display: 'block' }}>{option.ref}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        ) : (
          <InlineNotice theme={theme} tone="success">
            {lead.name}
            {lead.ref ? ` · ${lead.ref}` : ''}{' '}
            <LvButton
              theme={theme}
              variant="ghost"
              size="sm"
              onClick={() => {
                setLead(null);
                setTerm('');
              }}
            >
              change
            </LvButton>
          </InlineNotice>
        )}

        <Field theme={theme} label="The note" htmlFor="note-body" required help="The first line becomes its title.">
          <LvTextarea theme={theme} id="note-body" rows={6} maxLength={8000} value={body} onChange={(event) => setBody(event.target.value)} />
        </Field>
      </div>
    </LvSheet>
  );
};
