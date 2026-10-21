import { type ReactNode } from 'react';

import {
  groupReasons,
  KIND_LABELS,
  statusLabel,
  type Capabilities,
  type DocumentView,
  type EcosystemKind,
  type ListingSummary,
  type Readiness,
} from 'src/api/ecosystem';
import { LvIcon } from 'src/design/icons';
import { EmptyState, formatWhen, InlineNotice, LvBadge, LvButton, LvProgress, VisuallyHidden, type Tone } from 'src/design/kit';
import { LvRelatedList, LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';

// The ecosystem's own surfaces: whether a record can go live and why not,
// what it is connected to, and the paperwork behind it.

export const STATUS_TONE: Record<string, Tone> = {
  // Partner
  PROSPECTIVE: 'neutral',
  ONBOARDING: 'info',
  APPROVED: 'info',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  OFFBOARDED: 'neutral',
  // Listing
  DRAFT: 'neutral',
  IN_REVIEW: 'info',
  CHANGES_REQUIRED: 'warning',
  READY: 'info',
  LIVE: 'success',
  RETIRED: 'neutral',
  // Shared
  PAUSED: 'warning',
  SUSPENDED: 'danger',
};

export const EcosystemStatus = ({ theme, kind, status }: { theme: LvTheme; kind: EcosystemKind; status: string | null }) => (
  <LvBadge theme={theme} tone={STATUS_TONE[status ?? ''] ?? 'neutral'}>
    {statusLabel(kind, status)}
  </LvBadge>
);

/**
 * 8.7 — activation readiness.
 *
 * The server computes this and returns a reason for every check that failed,
 * each already carrying the area it belongs to. Nothing is assessed here;
 * the reasons are grouped and shown in full, because a record that cannot go
 * live is only useful if it says what to fix and where.
 */
export const LvReadinessPanel = ({
  theme,
  kind,
  readiness,
  onFix,
  compact,
}: {
  theme: LvTheme;
  kind: EcosystemKind;
  readiness: Readiness;
  onFix?: (area: string) => void;
  /** Inside another card, without its own heading. */
  compact?: boolean;
}) => {
  const ready = readiness.status === 'READY';
  const groups = groupReasons(readiness);
  const passed = Math.max(0, readiness.checks - readiness.reasons.length);

  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(3) }}>
        <span
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            flex: '0 0 auto',
            borderRadius: theme.radius.pill,
            background: ready ? theme.tint.mint.wash : theme.color.surfaceSunken,
            color: ready ? theme.color.success : theme.color.warning,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LvIcon name={ready ? 'check' : 'warning'} size={21} />
        </span>
        <span style={{ minWidth: 0, flex: '1 1 200px' }}>
          <span style={{ display: 'block', ...theme.type.subheading, fontSize: 16, color: theme.color.heading }}>
            {ready ? `Ready to go live` : `${readiness.reasons.length} thing${readiness.reasons.length === 1 ? '' : 's'} in the way`}
          </span>
          <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted }}>
            {passed} of {readiness.checks} checks pass · checked {formatWhen(readiness.checkedAt, new Date().toISOString())}
          </span>
        </span>
      </div>

      {readiness.checks > 0 && <LvProgress theme={theme} percentage={Math.round((passed / readiness.checks) * 100)} caption="Activation checks passing" />}

      {ready ? (
        <InlineNotice theme={theme} tone="success">
          Every activation check passes. Going live is still a decision somebody makes — this only says nothing is stopping it.
        </InlineNotice>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
          {groups.map((group) => (
            <div key={group.area}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.space(2), flexWrap: 'wrap', marginBottom: theme.space(2) }}>
                <span style={{ ...theme.type.label, color: theme.color.heading }}>{group.label}</span>
                <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>{group.meaning}</span>
                {onFix && group.area === 'DOCUMENTS' && (
                  <LvButton theme={theme} variant="ghost" size="sm" onClick={() => onFix(group.area)}>
                    Open documents
                  </LvButton>
                )}
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
                {group.reasons.map((reason) => (
                  <li key={reason.code} style={{ display: 'flex', gap: theme.space(2) }}>
                    <span aria-hidden="true" style={{ color: theme.color.warning, display: 'inline-flex', flex: '0 0 auto', marginTop: 2 }}>
                      <LvIcon name="warning" size={15} />
                    </span>
                    <span style={{ ...theme.type.bodySmall, color: theme.color.text, minWidth: 0, overflowWrap: 'anywhere' }}>{reason.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <VisuallyHidden>
        {ready ? `This ${KIND_LABELS[kind].one.toLowerCase()} is ready to go live.` : `${readiness.reasons.length} checks are failing.`}
      </VisuallyHidden>
    </div>
  );

  return compact ? body : (
    <LvSectionCard theme={theme} title="Activation readiness" icon="check">
      {body}
    </LvSectionCard>
  );
};

/** The listings a partner has put up, each with its own readiness. */
export const LvListings = ({
  theme,
  title,
  kind,
  listings,
  onOpen,
  emptyText,
  action,
}: {
  theme: LvTheme;
  title: string;
  kind: 'property' | 'experience';
  listings: ListingSummary[];
  onOpen: (id: string) => void;
  emptyText: string;
  /** "Add a property" — offered only where the server says the caller may. */
  action?: ReactNode;
}) => (
  <LvSectionCard theme={theme} title={`${title} (${listings.length})`} icon={kind === 'property' ? 'property' : 'experience'} action={action}>
    {listings.length === 0 ? (
      <EmptyState theme={theme} icon={kind === 'property' ? 'property' : 'experience'} tint="blue" text={emptyText} />
    ) : (
      <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
        {listings.map((listing) => (
          <li key={listing.id}>
            <button
              type="button"
              onClick={() => onOpen(listing.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.space(3),
                width: '100%',
                minHeight: 56,
                padding: theme.space(3),
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.color.border}`,
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: theme.font.body,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ flex: '1 1 160px', minWidth: 0 }}>
                <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading, overflowWrap: 'anywhere' }}>
                  {listing.name ?? 'Unnamed'}
                </span>
                <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>
                  {[listing.code, listing.location, listing.capacity === null ? null : `${listing.capacity} guests`].filter(Boolean).join(' · ') || '—'}
                </span>
              </span>
              <EcosystemStatus theme={theme} kind={kind} status={listing.status} />
              {listing.readiness.status === 'NOT_READY' && (
                <LvBadge theme={theme} tone="warning">{listing.readiness.reasons.length} blocking</LvBadge>
              )}
            </button>
          </li>
        ))}
      </ul>
    )}
  </LvSectionCard>
);

/**
 * Who and what this record is attached to. Only links the payload actually
 * carries: no relationship is inferred, and nothing is drawn as a graph
 * because the backend returns records, not edges.
 */
export const LvConnections = ({
  theme,
  items,
}: {
  theme: LvTheme;
  items: { key: string; icon: Parameters<typeof LvRelatedList>[0]['items'][number]['icon']; label: string; detail: string; onOpen?: () => void }[];
}) => (
  <LvSectionCard theme={theme} title="Connected to" icon="partner">
    {items.length === 0 ? (
      <EmptyState theme={theme} icon="info" tint="blue" text="Nothing is linked to this record yet." />
    ) : (
      <LvRelatedList theme={theme} items={items} />
    )}
  </LvSectionCard>
);

/** The verification paperwork, read-only here — it is decided in Onboarding. */
export const LvDocumentSummary = ({ theme, documents, onOpenOnboarding }: { theme: LvTheme; documents: DocumentView[]; onOpenOnboarding?: () => void }) => {
  const buckets = [
    { key: 'VERIFIED', label: 'Verified', tone: 'success' as Tone },
    { key: 'PENDING', label: 'Waiting', tone: 'info' as Tone },
    { key: 'REJECTED', label: 'Rejected', tone: 'danger' as Tone },
    { key: 'EXPIRED', label: 'Expired', tone: 'warning' as Tone },
  ].map((bucket) => ({ ...bucket, count: documents.filter((doc) => doc.bucket === bucket.key).length }));

  return (
    <LvSectionCard
      theme={theme}
      title={`Documents (${documents.length})`}
      icon="document"
      action={
        onOpenOnboarding && (
          <LvButton theme={theme} variant="ghost" size="sm" onClick={onOpenOnboarding}>
            Review in Onboarding
          </LvButton>
        )
      }
    >
      {documents.length === 0 ? (
        <EmptyState theme={theme} icon="document" tint="blue" text="No documents have been uploaded against this record." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
            {buckets
              .filter((bucket) => bucket.count > 0)
              .map((bucket) => (
                <LvBadge key={bucket.key} theme={theme} tone={bucket.tone}>
                  {bucket.count} {bucket.label.toLowerCase()}
                </LvBadge>
              ))}
          </div>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
            {documents.map((doc) => (
              <li key={doc.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(2), paddingBottom: theme.space(2), borderBottom: `1px solid ${theme.color.border}` }}>
                <span style={{ ...theme.type.bodySmall, color: theme.color.heading, flex: '1 1 160px', minWidth: 0, overflowWrap: 'anywhere' }}>
                  {doc.documentType ?? doc.name ?? 'Document'}
                </span>
                <LvBadge theme={theme} tone={doc.bucket === 'VERIFIED' ? 'success' : doc.bucket === 'REJECTED' ? 'danger' : doc.bucket === 'EXPIRED' ? 'warning' : 'info'}>
                  {doc.verificationState ?? doc.bucket}
                </LvBadge>
                {doc.rejectionReason && (
                  <span style={{ flex: '1 0 100%', ...theme.type.caption, color: theme.color.danger, overflowWrap: 'anywhere' }}>{doc.rejectionReason}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </LvSectionCard>
  );
};

/** What this person is allowed to do, said once so screens need not guess. */
export const describeCapabilities = (capabilities: Capabilities): string[] => {
  const notes: string[] = [];

  if (!capabilities.canChangeStatus) {
    notes.push('Your role cannot change this record’s status.');
  } else if (!capabilities.canGovern && capabilities.isOwner) {
    notes.push('You own this record, so approving or activating it is somebody else’s decision.');
  }

  if (!capabilities.canChangeOwner) {
    notes.push('Changing the owner is limited to the owner and administrators.');
  }

  return notes;
};
