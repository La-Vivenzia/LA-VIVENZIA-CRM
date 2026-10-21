import { useState } from 'react';

import {
  createListing,
  duplicatesFromRefusal,
  emptyListingDraft,
  KIND_LABELS,
  listingDraftReady,
  propertyTypeLabel,
  PROPERTY_TYPES,
  statusLabel,
  type CreatedListing,
  type DuplicateMatch,
  type ListingDraft,
  type ListingKind,
} from 'src/api/ecosystem';
import { LvIcon } from 'src/design/icons';
import { Field, InlineNotice, isForbiddenMessage, LvBadge, LvButton, LvInput, LvSelect, LvTextarea } from 'src/design/kit';
import { LvSheet } from 'src/design/overlay';
import { type LvTheme } from 'src/design/theme';

// 8.9 — adding a property or an experience to a partner.
//
// A listing belongs to a partner, so this is reached from the partner and
// never from a list of its own: `/ecosystem/create` requires a partnerId and
// the capability that permits it (`canCreateListing`) is only computed for a
// partner record.
//
// The form asks for exactly what the route reads. It does not ask who the
// host or manager is, because the server takes the partner's own contact; it
// does not ask for a code, because the server allocates one; and it does not
// ask for a status, because a new listing is always a draft that then goes
// through review. Offering any of those would be a control that does nothing.
//
// The duplicate check runs on the server before the write. When it matches,
// the route refuses and hands back what it found — so the person sees the
// records and decides, which is the one thing a merge must never do silently.

const DUPLICATE_NOTE = 'Your decision is recorded in the audit trail.';

export const CreateListingSheet = ({
  theme,
  kind,
  partnerId,
  partnerName,
  partnerLocation,
  onClose,
  onCreated,
}: {
  theme: LvTheme;
  kind: ListingKind;
  partnerId: string;
  partnerName: string | null;
  partnerLocation: string | null;
  onClose: () => void;
  onCreated: (created: CreatedListing) => void;
}) => {
  const [draft, setDraft] = useState<ListingDraft>(() => emptyListingDraft(kind, partnerLocation));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);

  const one = KIND_LABELS[kind].one.toLowerCase();
  const field = <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);

    // A duplicate decision belongs to the name it was shown for. Changing the
    // name makes it a different record, so the warning — and the licence to
    // override it — is withdrawn rather than carried over.
    if (key === 'name') {
      setDuplicates(null);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      onCreated(await createListing({ kind, partnerId, draft, createAnyway: duplicates !== null }));
      onClose();
    } catch (cause) {
      const matches = duplicatesFromRefusal(cause);

      if (matches !== null) {
        setDuplicates(matches);
      }

      setError(cause instanceof Error ? cause.message : `The ${one} could not be created.`);
    } finally {
      setBusy(false);
    }
  };

  const id = (name: string) => `lv-create-${kind}-${name}`;

  return (
    <LvSheet
      theme={theme}
      title={`Add ${kind === 'experience' ? 'an experience' : 'a property'}`}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <LvButton theme={theme} variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </LvButton>
          <LvButton theme={theme} variant="primary" disabled={!listingDraftReady(draft)} busy={busy} onClick={() => void submit()}>
            {duplicates !== null ? 'Create it anyway' : `Add the ${one}`}
          </LvButton>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>
          A draft {one} under <strong style={{ color: theme.color.heading }}>{partnerName ?? 'this partner'}</strong>, with a code allocated by the server. It goes
          through review and approval before it can go live, so nothing here is final.
        </p>

        <div className="lv-field-grid">
          <Field theme={theme} label="Name" htmlFor={id('name')} required help="At least two characters.">
            <LvInput theme={theme} id={id('name')} value={draft.name} maxLength={200} required onChange={(event) => field('name', event.target.value)} />
          </Field>

          <Field theme={theme} label="Location" htmlFor={id('location')} help="Left empty, it takes the partner's.">
            <LvInput theme={theme} id={id('location')} value={draft.location} maxLength={200} onChange={(event) => field('location', event.target.value)} />
          </Field>

          {kind === 'property' ? (
            <Field theme={theme} label="Property type" htmlFor={id('type')}>
              <LvSelect theme={theme} id={id('type')} value={draft.propertyType} onChange={(event) => field('propertyType', event.target.value)}>
                {PROPERTY_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {propertyTypeLabel(option)}
                  </option>
                ))}
              </LvSelect>
            </Field>
          ) : (
            <Field theme={theme} label="Host" htmlFor={id('host')} help="The name it is hosted under, if it differs from the partner.">
              <LvInput theme={theme} id={id('host')} value={draft.hostName} maxLength={120} onChange={(event) => field('hostName', event.target.value)} />
            </Field>
          )}

          <Field theme={theme} label={kind === 'experience' ? 'Maximum participants' : 'Sleeps'} htmlFor={id('capacity')}>
            <LvInput theme={theme} id={id('capacity')} type="number" min={0} value={draft.capacity} onChange={(event) => field('capacity', event.target.value)} />
          </Field>

          <Field theme={theme} label={kind === 'experience' ? 'Duration in minutes' : 'Rooms or units'} htmlFor={id('extra')}>
            <LvInput theme={theme} id={id('extra')} type="number" min={0} value={draft.extra} onChange={(event) => field('extra', event.target.value)} />
          </Field>

          <Field theme={theme} label="Base price in rupees" htmlFor={id('price')}>
            <LvInput theme={theme} id={id('price')} type="number" min={0} value={draft.basePrice} onChange={(event) => field('basePrice', event.target.value)} />
          </Field>

          <Field theme={theme} label="Priced per" htmlFor={id('unit')} help="How the price is counted — per night, per person, per group.">
            <LvInput theme={theme} id={id('unit')} value={draft.priceUnit} maxLength={60} onChange={(event) => field('priceUnit', event.target.value)} />
          </Field>

          <Field theme={theme} label="Description" htmlFor={id('description')} span help="What it is, in a sentence or two. It can be written later.">
            <LvTextarea theme={theme} id={id('description')} rows={3} value={draft.description} maxLength={4000} onChange={(event) => field('description', event.target.value)} />
          </Field>
        </div>

        {duplicates !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
            <InlineNotice theme={theme} tone="warning">
              {duplicates.length === 0
                ? `This partner already has a similar ${one}. Check the list on their page first. ${DUPLICATE_NOTE}`
                : `This partner already has ${duplicates.length === 1 ? `a ${one} that looks like this one` : `${duplicates.length} ${KIND_LABELS[kind].many.toLowerCase()} that look like this one`}. Open it instead, or add this one as well. ${DUPLICATE_NOTE}`}
            </InlineNotice>

            {duplicates.map((match) => (
              <div
                key={match.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.space(3),
                  padding: theme.space(3),
                  borderRadius: theme.radius.md,
                  border: `1px solid ${theme.color.border}`,
                  minWidth: 0,
                }}
              >
                <span aria-hidden="true" style={{ color: theme.color.warning, display: 'inline-flex', flex: '0 0 auto' }}>
                  <LvIcon name="warning" size={16} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading, overflowWrap: 'anywhere' }}>
                    {match.name ?? 'Unnamed'}
                  </span>
                  <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>
                    {[match.code, match.status === null ? null : statusLabel(kind, match.status), match.location].filter(Boolean).join(' · ') || '—'}
                    {match.reasons !== undefined && match.reasons.length > 0 ? ` · ${match.reasons.join(', ')}` : ''}
                  </span>
                </span>
                {match.percent > 0 && (
                  <LvBadge theme={theme} tone="warning" title="How alike the two are">
                    {Math.round(match.percent)}%
                  </LvBadge>
                )}
              </div>
            ))}
          </div>
        )}

        {error !== null && duplicates === null && (
          <InlineNotice theme={theme} tone="danger">
            {isForbiddenMessage(error) ? `${error} Adding a listing needs write access to it.` : error}
          </InlineNotice>
        )}
      </div>
    </LvSheet>
  );
};
