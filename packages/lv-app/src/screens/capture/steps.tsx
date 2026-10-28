import { useState } from 'react';

import {
  CAPTURE_SOURCES,
  FIELD_GROUPS,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  readImage,
  type CaptureMethod,
  type CaptureState,
  type DuplicateCandidate,
} from 'src/api/capture';
import { LvIcon, type LvIconName } from 'src/design/icons';
import { LvBanner } from 'src/design/feedback';
import { LvUploadZone } from 'src/design/documents';
import { LvAiUnavailable, LvConfidence } from 'src/design/intelligence';
import { EmptyState, Field, formatWhen, LvBadge, LvButton, LvCard, LvInput, LvSkeletonRow, LvTextarea, Provenance, VisuallyHidden } from 'src/design/kit';
import { LvSectionCard } from 'src/design/profile';
import { describeStatus } from 'src/design/status';
import { type LvTheme, type LvTint } from 'src/design/theme';

// The steps of capture. Each one is a real state of the three routes behind
// it; none animates while nothing is happening, and none shows a field the
// extractor did not return.

const sentence = (value: string | null | undefined): string =>
  value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '';

const ICON_FOR: Record<string, LvIconName> = {
  VISITING_CARD: 'camera',
  SCREENSHOT: 'image',
  BROCHURE: 'document',
  IMAGE: 'image',
  WEBSITE_URL: 'website',
  INSTAGRAM: 'instagram',
  LINKEDIN_PROFILE: 'organisation',
  SOCIAL_HANDLE: 'messages',
  REFERRAL: 'person',
  PARTNER_REFERRAL: 'partner',
  EVENT: 'meeting',
  WALK_IN: 'leads',
  PHONE: 'phone',
  MANUAL: 'note',
  OTHER: 'messages',
};

const TINTS: LvTint[] = ['mint', 'blue', 'peach', 'lavender', 'pink'];

// ---------------------------------------------------------------------------
// 5.1 CHOOSE — the method tiles
// ---------------------------------------------------------------------------

// One tile. Shared so that the spreadsheet route, which is a different
// workflow behind a different set of routes, still arrives as one of the ways
// a lead gets in rather than as a separate product.
const SourceTile = ({
  theme,
  tint,
  icon,
  label,
  hint,
  promise,
  onClick,
}: {
  theme: LvTheme;
  tint: LvTint;
  icon: LvIconName;
  label: string;
  hint: string;
  promise: string;
  onClick: () => void;
}) => (
  <li style={{ listStyle: 'none' }}>
    <button
      type="button"
      onClick={onClick}
      className="lv-source-card"
      style={{
        background: theme.tint[tint].wash,
        border: '1px solid transparent',
        borderRadius: theme.radius.xl,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: theme.font.body,
        width: '100%',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 42,
          height: 42,
          flex: '0 0 auto',
          borderRadius: theme.radius.pill,
          background: theme.color.surfaceRaised,
          color: theme.tint[tint].ink,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: theme.shadow.sm,
        }}
      >
        <LvIcon name={icon} size={21} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', ...theme.type.subheading, fontSize: 16, color: theme.color.heading }}>{label}</span>
        <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted }}>{hint}</span>
        {/* What La Vivenzia will do with it, said before anyone commits to
            going and gathering it. */}
        <span style={{ display: 'block', ...theme.type.caption, color: theme.color.text, marginTop: 6 }}>{promise}</span>
      </span>
    </button>
  </li>
);

export const ChooseStep = ({ theme, capture, onImport }: { theme: LvTheme; capture: CaptureState; onImport: () => void }) => (
  <>
    {CAPTURE_SOURCES.map((group, groupIndex) => (
      <LvSectionCard
        key={group.key}
        theme={theme}
        title={group.title}
        icon={group.key === 'message' ? 'messages' : group.key === 'image' ? 'camera' : group.key === 'link' ? 'website' : 'person'}
      >
        <ul className="lv-source-grid">
          {group.methods.map((entry, index) => (
            <SourceTile
              key={entry.key}
              theme={theme}
              tint={TINTS[(groupIndex * 3 + index) % TINTS.length]}
              icon={ICON_FOR[entry.key] ?? 'capture'}
              label={entry.label}
              hint={entry.hint}
              promise={entry.promise}
              onClick={() => capture.chooseMethod(entry)}
            />
          ))}
        </ul>
      </LvSectionCard>
    ))}

    {/* Many at once. A different workflow — the file is read by the server
        and every row is decided on — so it leads somewhere of its own rather
        than into the steps below. */}
    <LvSectionCard theme={theme} title="From a spreadsheet" icon="document">
      <ul className="lv-source-grid">
        <SourceTile
          theme={theme}
          tint="peach"
          icon="upload"
          label="Import a CSV"
          hint="A list you already have"
          promise="Every row is read, checked against the leads already here, and shown to you before anything is created."
          onClick={onImport}
        />
      </ul>
    </LvSectionCard>
  </>
);

// ---------------------------------------------------------------------------
// 5.2 INPUT — a picture, a link or a handle
// ---------------------------------------------------------------------------
export const InputStep = ({ theme, capture, method }: { theme: LvTheme; capture: CaptureState; method: CaptureMethod }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const take = (files: File[]) => {
    const picked = files[0];

    if (!picked) {
      return;
    }

    if (!IMAGE_MIME_TYPES.includes(picked.type)) {
      setFileError('That has to be a JPEG, PNG or WebP image.');

      return;
    }

    if (picked.size > MAX_IMAGE_BYTES) {
      setFileError(`That image is ${(picked.size / 1024 / 1024).toFixed(1)} MB. The limit is 6 MB.`);

      return;
    }

    setFileError(null);
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  };

  const send = async () => {
    if (method.input === 'IMAGE') {
      if (!file) {
        return;
      }

      setReading(true);

      try {
        const image = await readImage(file);

        await capture.extract({ image });
      } catch (cause) {
        setFileError(cause instanceof Error ? cause.message : 'That file could not be read.');
      } finally {
        setReading(false);
      }

      return;
    }

    if (method.input === 'TEXT') {
      await capture.extract({ text: text.trim() });

      return;
    }

    if (method.input === 'URL') {
      await capture.extract({ url: text.trim() });

      return;
    }

    await capture.extract({ handle: text.trim() });
  };

  const ready = method.input === 'IMAGE' ? file !== null : text.trim().length > 2;

  return (
    <LvSectionCard theme={theme} title={method.label} icon={ICON_FOR[method.key] ?? 'capture'}>
      <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: 0 }}>{method.promise}</p>

      {method.input === 'IMAGE' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
          {preview === null ? (
            <LvUploadZone theme={theme} label="Add the picture" accept="image/jpeg,image/png,image/webp" hint="JPEG, PNG or WebP, up to 6 MB." onFiles={take} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
              {/* The real picked file, at a size where a person can tell
                  whether they photographed the right thing. */}
              <img
                src={preview}
                alt="The picture you are about to have read"
                style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: theme.radius.lg, background: theme.color.surfaceSunken }}
              />
              <div className="lv-action-row" style={{ display: 'flex', alignItems: 'center', gap: theme.space(3) }}>
                <span className="lv-action-row-body" style={{ ...theme.type.bodySmall, color: theme.color.textMuted, minWidth: 0, overflowWrap: 'anywhere' }}>
                  {file?.name} · {((file?.size ?? 0) / 1024).toFixed(0)} KB
                </span>
                <span className="lv-action-row-cta" style={{ display: 'flex', gap: theme.space(2) }}>
                  <LvButton
                    theme={theme}
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                      setFileError(null);
                    }}
                  >
                    Replace it
                  </LvButton>
                </span>
              </div>
            </div>
          )}
          {fileError && (
            <p role="alert" style={{ ...theme.type.bodySmall, color: theme.color.danger, margin: 0 }}>
              {fileError}
            </p>
          )}
        </div>
      ) : method.input === 'TEXT' ? (
        <Field
          theme={theme}
          label="Message or conversation text"
          htmlFor="lv-capture-input"
          required
          help="Paste the WhatsApp chat, enquiry message or email thread. Contact details and requirements will be parsed."
        >
          <LvTextarea
            theme={theme}
            id="lv-capture-input"
            rows={7}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={'e.g.\n[10/24/26, 2:45 PM] Rajesh Sharma: Hi team, looking for a 3BHK villa in Lonavala. Budget 3.5 Cr. Contact: +91 98765 43210, rajesh@example.com'}
          />
        </Field>
      ) : (
        <Field
          theme={theme}
          label={method.input === 'URL' ? 'Website address' : 'Profile link or handle'}
          htmlFor="lv-capture-input"
          required
          help={method.input === 'URL' ? 'The full address, including https://' : 'A profile link, or the @handle on its own.'}
        >
          <LvInput
            theme={theme}
            id="lv-capture-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={method.input === 'URL' ? 'https://example.com' : '@thewildnest'}
          />
        </Field>
      )}

      <div className="lv-action-row" style={{ display: 'flex', gap: theme.space(2), justifyContent: 'flex-end' }}>
        <LvButton theme={theme} variant="ghost" onClick={() => capture.setPhase('CHOOSE')}>
          Choose a different source
        </LvButton>
        <LvButton theme={theme} variant="primary" disabled={!ready} busy={reading} onClick={() => void send()}>
          {method.input === 'IMAGE' ? 'Read this picture' : method.input === 'TEXT' ? 'Extract details' : 'Read this link'}
        </LvButton>
      </div>
    </LvSectionCard>
  );
};

// ---------------------------------------------------------------------------
// 5.3 EXTRACTING — the real wait, described
// ---------------------------------------------------------------------------
export const ExtractingStep = ({ theme, method }: { theme: LvTheme; method: CaptureMethod }) => (
  <LvCard theme={theme} padding={7}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: theme.space(3) }} aria-busy="true">
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 56,
          height: 56,
          borderRadius: theme.radius.pill,
          background: theme.tint.lavender.wash,
          color: theme.tint.lavender.ink,
        }}
      >
        <LvIcon name="sparkle" size={26} />
      </span>
      <p style={{ ...theme.type.subheading, fontSize: 18, color: theme.color.heading, margin: 0 }}>
        {method.input === 'IMAGE' ? 'Reading the picture' : method.input === 'TEXT' ? 'Reading the message' : 'Reading the page'}
      </p>
      <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: 0, maxWidth: 420 }}>
        {method.input === 'IMAGE'
          ? 'Looking for a name, an organisation, a phone number, an email and an address. You will see everything it finds before anything is created.'
          : method.input === 'TEXT'
            ? 'Extracting contact details, location and requirements from the message. You will see everything it finds before anything is created.'
            : 'Reading what the page publishes about itself. Nothing is scraped, and nothing is created until you have reviewed it.'}
      </p>
      <VisuallyHidden>Extraction in progress</VisuallyHidden>
      {/* The shape of what is coming. The route reports no percentage, so no
          percentage is shown. */}
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: theme.space(2), marginTop: theme.space(2) }}>
        <LvSkeletonRow theme={theme} width="55%" />
        <LvSkeletonRow theme={theme} />
        <LvSkeletonRow theme={theme} width="78%" />
      </div>
    </div>
  </LvCard>
);

// ---------------------------------------------------------------------------
// 5.4 / 5.5 / 5.6 / 5.10 REVIEW
// ---------------------------------------------------------------------------
export const ReviewStep = ({ theme, capture, method }: { theme: LvTheme; capture: CaptureState; method: CaptureMethod }) => {
  const { draft, extraction, preflight } = capture;
  const byField = new Map((extraction?.fields ?? []).map((entry) => [entry.field, entry]));
  const found = (extraction?.fields ?? []).filter((entry) => entry.value !== null).length;
  const lowConfidence = (extraction?.fields ?? []).filter((entry) => entry.value !== null && entry.label === 'LOW');
  const missing = FIELD_GROUPS.flatMap((group) => group.fields).filter((field) => {
    const value = draft[field.key];

    return value === null || value === '';
  });

  const set = (key: string, value: string) => capture.setDraft((current) => ({ ...current, [key]: value === '' ? null : value }));

  return (
    <>
      {/* Early duplicate warning if background preflight or prior check found duplicates */}
      {(capture.preflight?.duplicates ?? []).length > 0 && (
        <LvBanner
          theme={theme}
          tone="warning"
          title={`${capture.preflight!.duplicates.length} likely duplicate${capture.preflight!.duplicates.length === 1 ? '' : 's'} found in CRM`}
        >
          An existing record matches this contact ({capture.preflight!.duplicates.map((d) => d.name || d.lvLeadId).filter(Boolean).join(', ')}). You will be able to merge with the existing lead or create a new lead on the next step.
        </LvBanner>
      )}

      {/* 5.10 — the read did not happen, said plainly, with what is still usable. */}
      {extraction && extraction.status !== 'EXTRACTED' && (
        <LvAiUnavailable
          theme={theme}
          reason={extraction.status === 'FAILED' ? 'That could not be read automatically.' : (extraction.reason ?? 'There is nothing to read automatically from this source.')}
          fallback={
            (extraction.fields ?? []).some((entry) => entry.value !== null)
              ? 'What was recognisable has been kept below. Add the rest by hand — everything else about this capture works the same.'
              : 'Fill the fields in below. Everything else about this capture works the same.'
          }
        />
      )}

      {extraction?.status === 'EXTRACTED' && (
        <LvCard theme={theme}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), flexWrap: 'wrap' }}>
            <span
              aria-hidden="true"
              style={{
                width: 38,
                height: 38,
                borderRadius: theme.radius.md,
                background: theme.tint.mint.wash,
                color: theme.tint.mint.ink,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 auto',
              }}
            >
              <LvIcon name="check" size={19} />
            </span>
            <span style={{ flex: 1, minWidth: 180 }}>
              <span style={{ display: 'block', ...theme.type.subheading, fontSize: 16, color: theme.color.heading }}>
                {found} field{found === 1 ? '' : 's'} read from the {method.input === 'IMAGE' ? 'picture' : method.input === 'TEXT' ? 'message' : 'page'}
              </span>
              <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted }}>
                {lowConfidence.length > 0 ? `${lowConfidence.length} of them need a look — they are marked below.` : 'Check them over and correct anything that is wrong.'}
              </span>
            </span>
            <Provenance theme={theme} source="ai" />
          </div>
        </LvCard>
      )}

      {FIELD_GROUPS.map((group) => (
        <LvSectionCard key={group.key} theme={theme} title={group.title} icon={group.key === 'reach' ? 'phone' : group.key === 'where' ? 'location' : 'person'}>
          <div className="lv-field-grid">
            {group.fields.map((field) => {
              const extracted = byField.get(String(field.key));
              const value = (draft[field.key] as string | null) ?? '';
              const needsLook = extracted && extracted.value !== null && extracted.label === 'LOW';

              return (
                <Field key={String(field.key)} theme={theme} label={field.label} htmlFor={`lv-capture-${String(field.key)}`} required={field.key === 'name'} help={field.help}>
                  <LvInput
                    theme={theme}
                    id={`lv-capture-${String(field.key)}`}
                    type={field.type ?? 'text'}
                    value={value}
                    onChange={(event) => set(String(field.key), event.target.value)}
                  />
                  {/* Confidence only where the extractor actually reported it. */}
                  {extracted && extracted.value !== null && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.space(2), marginTop: 4, flexWrap: 'wrap' }}>
                      <LvConfidence theme={theme} value={extracted.confidence} label={field.label} />
                      {needsLook && (
                        <LvBadge theme={theme} tone="warning">
                          Check this
                        </LvBadge>
                      )}
                    </span>
                  )}
                </Field>
              );
            })}
          </div>
        </LvSectionCard>
      ))}

      <LvSectionCard theme={theme} title="Requirements & Notes" icon="note">
        <Field theme={theme} label="Requirements summary" htmlFor="lv-capture-notes" help="Extracted from the message or added by hand.">
          <LvTextarea
            theme={theme}
            id="lv-capture-notes"
            rows={3}
            value={(draft.notes as string | null) ?? ''}
            onChange={(event) => set('notes', event.target.value)}
            placeholder="e.g. Looking for a 3BHK luxury villa with pool in Lonavala, budget 2-3 Cr"
          />
          {byField.get('notes') && byField.get('notes')?.value !== null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.space(2), marginTop: 4, flexWrap: 'wrap' }}>
              <LvConfidence theme={theme} value={byField.get('notes')!.confidence} label="the requirements" />
            </span>
          )}
        </Field>
      </LvSectionCard>

      {/* 5.6 — the classification suggestion, once preflight has run. */}
      {preflight?.classification && (
        <LvSectionCard theme={theme} title="Suggested category" icon="sparkle">
          {preflight.classification.status === 'SUGGESTED' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), flexWrap: 'wrap' }}>
                <LvBadge theme={theme} tone="info">
                  {sentence(preflight.classification.category)}
                </LvBadge>
                {preflight.classification.subcategory && <LvBadge theme={theme}>{sentence(preflight.classification.subcategory)}</LvBadge>}
                {typeof preflight.classification.confidence === 'number' && <LvConfidence theme={theme} value={preflight.classification.confidence} label="the category" />}
                <Provenance theme={theme} source="ai" />
              </div>
              {preflight.classification.reasoning && (
                <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(2)}px 0 0` }}>{preflight.classification.reasoning}</p>
              )}
            </>
          ) : (
            <LvAiUnavailable theme={theme} reason="No category could be suggested." fallback="The lead is created without one; it can be set on the profile." />
          )}
        </LvSectionCard>
      )}

      {missing.length > 0 && (
        <LvCard theme={theme}>
          <h3 style={{ ...theme.type.label, color: theme.color.textMuted, margin: `0 0 ${theme.space(2)}px` }}>Still empty</h3>
          <p style={{ ...theme.type.bodySmall, color: theme.color.text, margin: 0 }}>
            {missing.map((field) => field.label).join(', ')}. A lead can be created without them — they simply lower how complete the record is.
          </p>
        </LvCard>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// 5.7 / 5.8 DECIDE
// ---------------------------------------------------------------------------
const MatchCard = ({
  theme,
  candidate,
  now,
  onOpen,
  onMerge,
}: {
  theme: LvTheme;
  candidate: DuplicateCandidate;
  now: string;
  onOpen: () => void;
  onMerge?: () => void;
}) => (
  <li
    className="lv-action-row"
    style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: theme.space(3), border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.lg, padding: theme.space(4) }}
  >
    <span className="lv-action-row-body" style={{ minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), flexWrap: 'wrap' }}>
        <span style={{ ...theme.type.subheading, fontSize: 16, color: theme.color.heading, overflowWrap: 'anywhere' }}>{candidate.name ?? 'Existing lead'}</span>
        {candidate.lvLeadId && <span style={{ ...theme.type.caption, color: theme.color.textSubtle, fontFamily: theme.font.mono }}>{candidate.lvLeadId}</span>}
        <LvBadge theme={theme} tone={candidate.percent >= 85 ? 'danger' : 'warning'}>
          {Math.round(candidate.percent)}% match
        </LvBadge>
      </span>
      <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted, marginTop: 2 }}>
        {[candidate.location, candidate.status ? describeStatus('lead', candidate.status).label : null, candidate.ownerName].filter(Boolean).join(' · ')}
        {candidate.lastInteractionAt ? ` · last contact ${formatWhen(candidate.lastInteractionAt, now)}` : ''}
      </span>
      {/* Why it was flagged — the server's own list of matching fields. */}
      {(candidate.matchingFields ?? []).length > 0 && (
        <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.text, marginTop: 4 }}>Same {(candidate.matchingFields ?? []).join(', ')}.</span>
      )}
    </span>
    <span className="lv-action-row-cta" style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
      {onMerge && (
        <LvButton theme={theme} variant="primary" size="sm" onClick={onMerge}>
          Merge Existing
        </LvButton>
      )}
      <LvButton theme={theme} variant="secondary" size="sm" onClick={onOpen}>
        Open it
      </LvButton>
    </span>
  </li>
);

const Choice = ({
  theme,
  name,
  chosen,
  title,
  detail,
  onChoose,
}: {
  theme: LvTheme;
  name: string;
  chosen: boolean;
  title: string;
  detail: string;
  onChoose: () => void;
}) => (
  <label
    style={{
      display: 'flex',
      gap: theme.space(3),
      alignItems: 'flex-start',
      padding: theme.space(3),
      borderRadius: theme.radius.lg,
      border: `1px solid ${chosen ? theme.color.brand : theme.color.border}`,
      background: chosen ? theme.tint.mint.wash : 'transparent',
      cursor: 'pointer',
    }}
  >
    <input type="radio" name={name} checked={chosen} onChange={onChoose} style={{ marginTop: 3, width: 18, height: 18, accentColor: theme.color.brand, flex: '0 0 auto' }} />
    <span style={{ minWidth: 0 }}>
      <span style={{ display: 'block', ...theme.type.body, color: theme.color.heading }}>{title}</span>
      <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted }}>{detail}</span>
    </span>
  </label>
);

export const DecideStep = ({ theme, capture, onOpenLead }: { theme: LvTheme; capture: CaptureState; onOpenLead: (leadId: string) => void }) => {
  const { preflight, draft } = capture;
  const duplicates = preflight?.duplicates ?? [];
  const now = new Date().toISOString();
  const recommendation = preflight?.recommendation ?? null;

  return (
    <>
      {/* 5.7 — duplicates, or the plain statement that there are none. */}
      <LvSectionCard theme={theme} title="Duplicate check" icon="search">
        {preflight?.duplicateError ? (
          <LvAiUnavailable theme={theme} reason={preflight.duplicateError} fallback="You can still create the lead; the check simply did not run." />
        ) : duplicates.length === 0 ? (
          <EmptyState theme={theme} quiet={false} icon="check" title="No existing record matches this" text="Nothing in the CRM looks like the same person or business." />
        ) : (
          <>
            <LvBanner
              theme={theme}
              tone="warning"
              title={`${duplicates.length} likely duplicate lead${duplicates.length === 1 ? '' : 's'} found`}
            >
              A lead with matching details already exists in the CRM. You can merge this captured information into the existing record or create a new separate lead.
            </LvBanner>

            <p style={{ ...theme.type.body, color: theme.color.text, margin: `${theme.space(3)}px 0 ${theme.space(3)}px` }}>
              {duplicates.length} possible match{duplicates.length === 1 ? '' : 'es'}. Open one to check, merge directly, or choose what to do below.
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), margin: 0, padding: 0, listStyle: 'none' }}>
              {duplicates.map((candidate) => (
                <MatchCard
                  key={candidate.leadId}
                  theme={theme}
                  candidate={candidate}
                  now={now}
                  onOpen={() => onOpenLead(candidate.leadId)}
                  onMerge={() => {
                    capture.setSelectedDuplicateLeadId(candidate.leadId);
                    capture.setDuplicateDecision('MERGE_EXISTING');
                    void capture.merge(candidate.leadId);
                  }}
                />
              ))}
            </ul>

            <fieldset style={{ border: 'none', margin: `${theme.space(4)}px 0 0`, padding: 0 }}>
              <legend style={{ ...theme.type.label, color: theme.color.textMuted, marginBottom: theme.space(2) }}>What would you like to do?</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
                <Choice
                  theme={theme}
                  name="lv-duplicate-decision"
                  chosen={capture.duplicateDecision === 'MERGE_EXISTING'}
                  title="Merge Existing"
                  detail="Attach these captured details, source, and notes to the existing lead record rather than creating a duplicate."
                  onChoose={() => capture.setDuplicateDecision('MERGE_EXISTING')}
                />
                <Choice
                  theme={theme}
                  name="lv-duplicate-decision"
                  chosen={capture.duplicateDecision === 'CREATE_NEW'}
                  title="Create New"
                  detail="They are different contacts or businesses. Create a separate lead record and record the match as reviewed."
                  onChoose={() => capture.setDuplicateDecision('CREATE_NEW')}
                />
                <Choice
                  theme={theme}
                  name="lv-duplicate-decision"
                  chosen={capture.duplicateDecision === 'IGNORED'}
                  title="Ignore match"
                  detail="The match is wrong. Create the lead and this match will not be raised against it again."
                  onChoose={() => capture.setDuplicateDecision('IGNORED')}
                />
              </div>
            </fieldset>
          </>
        )}
      </LvSectionCard>

      {/* 5.8 — who will own it. */}
      <LvSectionCard theme={theme} title="Who will own it" icon="person">
        {recommendation?.memberId ? (
          <>
            {/* The route returns the chosen member's id and its reasons, but
                no display name — and the reasons already name them. So the
                sentence states the decision and lets the reasons say who. */}
            <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>
              {recommendation.memberName ? (
                <>
                  The assignment engine would give this to <strong style={{ color: theme.color.heading }}>{recommendation.memberName}</strong>
                  {typeof recommendation.score === 'number' ? ` (${recommendation.score} of 100)` : ''}.
                </>
              ) : (
                <>
                  The assignment engine has already chosen an owner for this
                  {typeof recommendation.score === 'number' ? `, scoring them ${recommendation.score} of 100` : ''}:
                </>
              )}
            </p>
            {(recommendation.reasons ?? []).length > 0 && (
              <ul style={{ margin: `${theme.space(2)}px 0 0`, paddingLeft: theme.space(4), display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(recommendation.reasons ?? []).map((reason) => (
                  <li key={reason} style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>
                    {reason}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: 0 }}>
            {preflight?.recommendationError ?? recommendation?.noMatchReason ?? 'No particular colleague is a better fit; the engine will decide when it is created.'}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), marginTop: theme.space(4) }}>
          <Choice
            theme={theme}
            name="lv-assignment-mode"
            chosen={capture.assignmentMode === 'ENGINE'}
            title="Let the engine decide"
            detail="The same routing every captured lead gets, recorded with its reason."
            onChoose={() => capture.setAssignmentMode('ENGINE')}
          />
          <Choice
            theme={theme}
            name="lv-assignment-mode"
            chosen={capture.assignmentMode === 'SELF'}
            title="I will take it"
            detail="You become the owner and it appears in your queue immediately."
            onChoose={() => capture.setAssignmentMode('SELF')}
          />
        </div>
      </LvSectionCard>

      {/* The server will not create from an extracted draft until someone
          says they checked it. That rule deserves a real statement, not a
          flag the screen sets on their behalf. */}
      {capture.method?.requiresConfirmation && (
        <LvSectionCard theme={theme} title="Your confirmation" icon="check">
          <label style={{ display: 'flex', gap: theme.space(3), alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={capture.confirmed}
              onChange={(event) => capture.setConfirmed(event.target.checked)}
              style={{ marginTop: 3, width: 20, height: 20, accentColor: theme.color.brand, flex: '0 0 auto' }}
            />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', ...theme.type.body, color: theme.color.heading }}>I have checked these details</span>
              <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted }}>
                They were read off a {capture.method.input === 'IMAGE' ? 'picture' : capture.method.input === 'TEXT' ? 'message' : 'link'}, so they are proposals until you say otherwise. The CRM will not create the lead without this.
              </span>
            </span>
          </label>
        </LvSectionCard>
      )}

      {/* What is about to be created, one last time. */}
      <LvSectionCard theme={theme} title="About to be created" icon="capture">
        <p style={{ ...theme.type.subheading, fontSize: 17, color: theme.color.heading, margin: 0 }}>{draft.name}</p>
        <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0` }}>
          {[draft.organisationName, draft.location, draft.phone, draft.email].filter(Boolean).join(' · ') || 'No other details recorded.'}
        </p>
        {draft.notes && (
          <p style={{ ...theme.type.bodySmall, color: theme.color.text, margin: `${theme.space(1)}px 0 0` }}>
            {draft.notes}
          </p>
        )}
        {(preflight?.draft.warnings ?? []).length > 0 && (
          <ul style={{ margin: `${theme.space(3)}px 0 0`, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(1) }}>
            {(preflight?.draft.warnings ?? []).map((warning) => (
              <li key={warning} style={{ display: 'flex', gap: theme.space(2), ...theme.type.bodySmall, color: theme.color.warning }}>
                <LvIcon name="warning" size={15} />
                {warning}
              </li>
            ))}
          </ul>
        )}
      </LvSectionCard>
    </>
  );
};

// ---------------------------------------------------------------------------
// 5.9 SUCCESS
// ---------------------------------------------------------------------------
export const SuccessStep = ({ theme, capture, onOpenLead }: { theme: LvTheme; capture: CaptureState; onOpenLead: (leadId: string) => void }) => {
  const created = capture.created;

  if (!created) {
    return null;
  }

  const isMerged = created.merged === true;

  return (
    <LvCard theme={theme} padding={7}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: theme.space(3) }} role="status">
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: theme.radius.pill,
            background: theme.tint.mint.wash,
            color: theme.tint.mint.ink,
          }}
        >
          <LvIcon name="check" size={30} />
        </span>
        <p style={{ ...theme.type.title, color: theme.color.heading, margin: 0 }}>
          {isMerged ? 'Merged into existing lead' : created.replayed ? 'Already captured' : 'Lead captured'}
        </p>
        <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: 0, maxWidth: 460 }}>
          {isMerged
            ? `Captured details for ${capture.draft.name || 'this contact'} were attached to the existing lead${created.ownerName ? `, owned by ${created.ownerName}` : ''}.`
            : created.replayed
            ? 'This capture had already been created, so the existing record is shown rather than a second copy.'
            : `${capture.draft.name} is in the CRM${created.ownerName ? `, owned by ${created.ownerName}` : ''}.`}
        </p>

        <div style={{ display: 'flex', gap: theme.space(3), flexWrap: 'wrap', justifyContent: 'center', marginTop: theme.space(2) }}>
          {created.lvLeadId && (
            <span
              style={{
                ...theme.type.bodySmall,
                color: theme.color.heading,
                fontFamily: theme.font.mono,
                background: theme.color.surfaceSunken,
                borderRadius: theme.radius.pill,
                padding: `4px ${theme.space(3)}px`,
              }}
            >
              {created.lvLeadId}
            </span>
          )}
          {created.assignment?.reason && <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{created.assignment.reason}</span>}
        </div>

        {created.task && (
          <div style={{ marginTop: theme.space(3), padding: theme.space(4), borderRadius: theme.radius.lg, background: theme.color.surfaceSunken, width: '100%', maxWidth: 460 }}>
            <span style={{ display: 'block', ...theme.type.label, color: theme.color.textMuted }}>First next step</span>
            <span style={{ display: 'block', ...theme.type.body, color: theme.color.heading, marginTop: 2 }}>{created.task.title}</span>
            {created.task.dueAt && (
              <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted }}>Due {formatWhen(created.task.dueAt, new Date().toISOString())}</span>
            )}
          </div>
        )}

        {created.taskError && (
          <p style={{ ...theme.type.bodySmall, color: theme.color.warning, margin: 0 }}>The lead was created, but its first follow-up was not: {created.taskError}</p>
        )}

        <div className="lv-action-row" style={{ display: 'flex', gap: theme.space(2), justifyContent: 'center', marginTop: theme.space(4), flexWrap: 'wrap' }}>
          <LvButton theme={theme} variant="secondary" onClick={capture.reset}>
            Capture another
          </LvButton>
          <LvButton theme={theme} variant="primary" onClick={() => onOpenLead(created.leadId)}>
            Open the lead
          </LvButton>
        </div>
      </div>
    </LvCard>
  );
};
