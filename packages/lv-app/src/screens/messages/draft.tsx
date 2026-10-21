import { useState } from 'react';

import { DRAFT_KINDS, DRAFT_TONES, generateDraft, type Conversation, type Draft, type DraftKind, type DraftTone } from 'src/api/messages';
import { LvIcon } from 'src/design/icons';
import { Field, InlineNotice, isForbiddenMessage, LvButton, LvInput, LvSelect, LvStageWait, LvTextarea, Provenance, VisuallyHidden } from 'src/design/kit';
import { LvAiUnavailable } from 'src/design/intelligence';
import { LvModal, LvModalFooter } from 'src/design/overlay';
import { type LvTheme } from 'src/design/theme';

// 9.3 — the AI draft.
//
// The model writes it; a person edits it; and then **that person sends it
// themselves**, because no transport is integrated. The route says as much in
// its own reply (`transport: 'MANUAL_EMAIL' | 'NONE'`), so this screen says it
// too rather than offering a Send button that would be a lie.
//
// The honest end of this workflow is: copy the text out, send it from wherever
// you actually send things, then log what you sent.

const PLACEHOLDER = /\[([^\]]+)\]/g;

export const DraftDialog = ({
  theme,
  conversation,
  onClose,
  onLogIt,
}: {
  theme: LvTheme;
  conversation: Conversation;
  onClose: () => void;
  /** Hands over to Phase 4's "log an interaction", which is where a sent message is recorded. */
  onLogIt: () => void;
}) => {
  const [kind, setKind] = useState<DraftKind>('FOLLOW_UP_EMAIL');
  const [tone, setTone] = useState<DraftTone>('PROFESSIONAL');
  const [instructions, setInstructions] = useState('');
  const [phase, setPhase] = useState<'SETUP' | 'WRITING' | 'READY'>('SETUP');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'subject' | 'body' | null>(null);

  const chosen = DRAFT_KINDS.find((entry) => entry.key === kind);
  // The model is told to leave square-bracketed gaps where it does not know
  // something. Anything still bracketed is a gap the person must close.
  const remaining = [...(body ?? '').matchAll(PLACEHOLDER)].map((match) => match[1]);

  const write = async () => {
    setPhase('WRITING');
    setError(null);

    try {
      const result = await generateDraft({ leadId: conversation.leadId, kind, tone, instructions });

      setDraft(result);
      setSubject(result.subject ?? '');
      setBody(result.body);
      setPhase('READY');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The draft could not be written.');
      setPhase('SETUP');
    }
  };

  const copy = async (what: 'subject' | 'body') => {
    try {
      await navigator.clipboard.writeText(what === 'subject' ? subject : body);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('This browser would not let the page copy. Select the text and copy it by hand.');
    }
  };

  const unavailable = error !== null && /AI_UNAVAILABLE/.test(error);

  return (
    <LvModal
      theme={theme}
      size="full"
      title={`Draft a message to ${conversation.leadName ?? 'this lead'}`}
      onClose={phase === 'WRITING' ? () => undefined : onClose}
      footer={
        phase === 'READY' ? (
          <LvModalFooter theme={theme} onCancel={onClose} onConfirm={onLogIt} confirmLabel="I have sent it — log it" />
        ) : (
          <LvModalFooter theme={theme} onCancel={onClose} onConfirm={() => void write()} confirmLabel="Write the draft" busy={phase === 'WRITING'} />
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        {phase !== 'READY' && (
          <>
            <Field theme={theme} label="What kind of message" htmlFor="draft-kind" required help={chosen?.hint}>
              <LvSelect theme={theme} id="draft-kind" value={kind} onChange={(event) => setKind(event.target.value as DraftKind)}>
                {DRAFT_KINDS.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label}
                  </option>
                ))}
              </LvSelect>
            </Field>

            <Field theme={theme} label="Tone" htmlFor="draft-tone">
              <LvSelect theme={theme} id="draft-tone" value={tone} onChange={(event) => setTone(event.target.value as DraftTone)}>
                {DRAFT_TONES.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label}
                  </option>
                ))}
              </LvSelect>
            </Field>

            <Field
              theme={theme}
              label="Anything it should know"
              htmlFor="draft-instructions"
              help="Optional. Up to 400 characters — the route trims anything longer."
            >
              <LvTextarea
                theme={theme}
                id="draft-instructions"
                rows={3}
                maxLength={400}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="They asked about the terrace in September."
              />
            </Field>

            <InlineNotice theme={theme}>
              The draft is written from this lead&apos;s own record and its recent contact. Nothing is sent: La Vivenzia has no mail or chat transport, so
              you send it yourself and log it afterwards.
            </InlineNotice>
          </>
        )}

        {phase === 'WRITING' && (
          <LvStageWait
            theme={theme}
            icon="sparkle"
            tint="lavender"
            title="Writing the draft"
            detail="Reading the relationship and the last few contacts, then writing something you can edit. Nothing is sent by this."
            announce="Writing the draft"
          />
        )}

        {/* An unavailable model is not an error to apologise for — it is a
            fact about the provider, said in the system's own words. */}
        {unavailable && <LvAiUnavailable theme={theme} reason={error ?? 'No model provider is configured.'} />}
        {error !== null && !unavailable && (
          <InlineNotice theme={theme} tone="danger">
            {isForbiddenMessage(error) ? `${error} Drafting uses the lead you must already be able to open.` : error}
          </InlineNotice>
        )}

        {phase === 'READY' && draft && (
          <>
            <Provenance theme={theme} source="ai" label={draft.label} />

            {draft.transport === 'MANUAL_EMAIL' ? (
              <InlineNotice theme={theme}>
                Send this from your own mail client. La Vivenzia does not send email — it wrote the words, you send the message.
              </InlineNotice>
            ) : (
              <InlineNotice theme={theme}>Written to be pasted into a chat. There is no channel to send it down from here.</InlineNotice>
            )}

            {draft.subject !== null && (
              <Field theme={theme} label="Subject" htmlFor="draft-subject">
                <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <LvInput theme={theme} id="draft-subject" value={subject} onChange={(event) => setSubject(event.target.value)} style={{ flex: '1 1 220px' }} />
                  <LvButton theme={theme} variant="secondary" onClick={() => void copy('subject')}>
                    {copied === 'subject' ? 'Copied' : 'Copy'}
                  </LvButton>
                </div>
              </Field>
            )}

            <Field theme={theme} label="Message" htmlFor="draft-body" help="Edit it freely. What you copy is what you send.">
              <LvTextarea theme={theme} id="draft-body" rows={12} value={body} onChange={(event) => setBody(event.target.value)} />
            </Field>

            {/* A bracketed gap left in the text is the model saying it did not
                know something. Sending one is how "[their name]" reaches a
                partner. */}
            {remaining.length > 0 && (
              <InlineNotice theme={theme} tone="warning">
                {remaining.length === 1 ? 'One gap is' : `${remaining.length} gaps are`} still to fill in: {remaining.map((entry) => `[${entry}]`).join(', ')}.
                The model left these because it did not know them.
              </InlineNotice>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
              <LvButton theme={theme} variant="primary" onClick={() => void copy('body')} icon={<LvIcon name="document" size={16} />}>
                {copied === 'body' ? 'Copied the message' : 'Copy the message'}
              </LvButton>
              <LvButton theme={theme} variant="ghost" onClick={() => setPhase('SETUP')}>
                Write a different one
              </LvButton>
            </div>

            <VisuallyHidden aria-live="polite">{copied ? `${copied} copied to the clipboard` : ''}</VisuallyHidden>
          </>
        )}
      </div>
    </LvModal>
  );
};
