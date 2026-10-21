import { useState } from 'react';

import { type Lead360 } from 'src/api/leads';
import { LvIcon } from 'src/design/icons';
import { LvDocumentList, verificationLabel, verificationTone, type LvDocument } from 'src/design/documents';
import {
  EmptyState,
  formatWhen,
  LvBadge,
  LvButton,
  LvProgress,
  LvSteps,
  Provenance,
  type LvStep,
} from 'src/design/kit';
import { LvDrawer, LvSheet } from 'src/design/overlay';
import { LvActivityCard, LvChip, LvFactRow, LvRelatedList, LvSectionCard, LvTimeline } from 'src/design/profile';
import { type LvTheme, type LvTint } from 'src/design/theme';
import { useLvTier } from 'src/design/use-tier';
import { sentenceCase } from 'src/screens/lead/header';

// The sections of a relationship.
//
// Each one answers a different question — what is the context, what has
// happened, what does the team know, what has to happen next — and none of
// them dumps the record. A field appears when the server sent it and not
// otherwise; there are no placeholder dashes standing in for data that was
// never collected.

type TabProps = { theme: LvTheme; data: Lead360; onAction: (action: 'interaction' | 'task' | 'note' | 'status') => void; onOpenTab: (tab: string) => void };

const TINTS: LvTint[] = ['mint', 'blue', 'peach', 'lavender', 'pink'];

// ---------------------------------------------------------------------------
// Overview — who this is and where the relationship stands
// ---------------------------------------------------------------------------
export const OverviewTab = ({ theme, data, onAction, onOpenTab }: TabProps) => {
  const { lead, capabilities, intelligence, onboarding, capture, ecosystem } = data;
  const lastInteraction = data.interactions[0];
  const chips = [lead.category, lead.subcategory, ...(lead.languages ?? [])].filter(Boolean);

  return (
    <>
      <LvSectionCard theme={theme} title="About" icon="person">
        <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>
          {lead.rawCaptureInput ?? `${lead.name ?? 'This lead'} came in from ${sentenceCase(lead.source) || 'an unrecorded source'}.`}
        </p>
        {chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), marginTop: theme.space(3) }}>
            {chips.map((chip, index) => (
              <LvChip key={String(chip)} theme={theme} tint={TINTS[index % TINTS.length]}>
                {sentenceCase(String(chip))}
              </LvChip>
            ))}
          </div>
        )}
        {/* How the lead entered the CRM. Absent for records created before
            capture provenance existed, and then simply not shown. */}
        {capture && (
          <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(3)}px 0 0` }}>
            Captured by {capture.methodLabel}
            {capture.platformLabel ? ` from ${capture.platformLabel}` : ''}
            {capture.capturedBy?.displayName ? `, by ${capture.capturedBy.displayName}` : ''}
            {capture.capturedAt ? ` · ${formatWhen(capture.capturedAt, data.now)}` : ''}.
          </p>
        )}
      </LvSectionCard>

      <LvSectionCard theme={theme} title="How to reach them" icon="phone">
        <LvFactRow theme={theme} label="Phone">{lead.phones?.primaryPhoneNumber ?? 'Not recorded'}</LvFactRow>
        <LvFactRow theme={theme} label="Email">{lead.emails?.primaryEmail ?? 'Not recorded'}</LvFactRow>
        {lead.instagram?.primaryLinkUrl && <LvFactRow theme={theme} label="Instagram">{lead.instagram.primaryLinkUrl}</LvFactRow>}
        {lead.website?.primaryLinkUrl && <LvFactRow theme={theme} label="Website">{lead.website.primaryLinkUrl}</LvFactRow>}
      </LvSectionCard>

      <LvSectionCard
        theme={theme}
        title="Relationship"
        icon="leads"
        action={
          capabilities.canLogInteraction ? (
            <LvButton theme={theme} variant="secondary" size="sm" onClick={() => onAction('interaction')}>
              Log an interaction
            </LvButton>
          ) : undefined
        }
      >
        <LvFactRow theme={theme} label="Last contact">
          {lead.lastInteractionAt ? `${formatWhen(lead.lastInteractionAt, data.now)} · ${sentenceCase(lastInteraction?.channel) || 'unknown channel'}` : 'No contact yet'}
        </LvFactRow>
        <LvFactRow theme={theme} label="Sentiment">{sentenceCase(lastInteraction?.sentiment) || '—'}</LvFactRow>
        <LvFactRow theme={theme} label="Concern">{lastInteraction?.objections ?? '—'}</LvFactRow>
        <LvFactRow theme={theme} label="Owner">{lead.owner?.displayName ?? 'Unassigned'}</LvFactRow>
        <LvFactRow theme={theme} label="Next follow-up">
          {lead.nextFollowUpAt ? formatWhen(lead.nextFollowUpAt, data.now) : 'Not scheduled'}
        </LvFactRow>
        <LvFactRow theme={theme} label="Source">{sentenceCase(lead.source) || '—'}</LvFactRow>
      </LvSectionCard>

      {onboarding && (
        <LvSectionCard
          theme={theme}
          title="Onboarding"
          icon="onboarding"
          action={
            <LvButton theme={theme} variant="ghost" size="sm" onClick={() => onOpenTab('onboarding')}>
              Open
            </LvButton>
          }
        >
          <LvProgress
            theme={theme}
            percentage={onboarding.progressPercentage ?? 0}
            caption={onboarding.pendingDocuments > 0 ? 'Documents still pending:' : `Current step: ${sentenceCase(onboarding.currentStep) || 'not started'}`}
            pending={onboarding.documents.filter((document) => document.verificationState !== 'VERIFIED').map((document) => document.name ?? sentenceCase(document.documentType))}
          />
        </LvSectionCard>
      )}

      {capabilities.canViewIntelligence && (
        <LvSectionCard
          theme={theme}
          title="What the CRM makes of this"
          icon="sparkle"
          action={
            <LvButton theme={theme} variant="ghost" size="sm" onClick={() => onOpenTab('intelligence')}>
              See why
            </LvButton>
          }
        >
          <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>
            {intelligence.opportunity.available
              ? `Opportunity score ${intelligence.opportunity.score} of 100, relationship ${(sentenceCase(intelligence.health.state) || 'unassessed').toLowerCase()}.`
              : 'Not enough has been recorded yet to score this relationship.'}
          </p>
          {intelligence.dataQuality.issues.length > 0 && (
            <p style={{ ...theme.type.bodySmall, color: theme.color.warning, margin: `${theme.space(2)}px 0 0` }}>
              {intelligence.dataQuality.issues.length} data quality issue{intelligence.dataQuality.issues.length === 1 ? '' : 's'} to fix.
            </p>
          )}
          <span style={{ display: 'inline-flex', marginTop: theme.space(3) }}>
            <Provenance theme={theme} source="rules" />
          </span>
        </LvSectionCard>
      )}

      {(ecosystem.partner || ecosystem.properties.length > 0 || ecosystem.experiences.length > 0) && (
        <LvSectionCard theme={theme} title="What this became" icon="partner">
          <LvRelatedList
            theme={theme}
            items={[
              ...(ecosystem.partner ? [{ key: 'partner', icon: 'partner' as const, label: ecosystem.partner.name ?? 'Partner', detail: sentenceCase(ecosystem.partner.status) || 'Partner' }] : []),
              ...ecosystem.properties.map((property) => ({ key: property.id, icon: 'property' as const, label: property.name ?? 'Property', detail: sentenceCase(property.status) })),
              ...ecosystem.experiences.map((experience) => ({ key: experience.id, icon: 'experience' as const, label: experience.name ?? 'Experience', detail: sentenceCase(experience.status) })),
            ]}
          />
        </LvSectionCard>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Conversations — the Day 1 card, kept, with the relationship context around it
// ---------------------------------------------------------------------------
export const ConversationsTab = ({ theme, data, onAction }: TabProps) => (
  <LvSectionCard
    theme={theme}
    title="Conversations"
    icon="messages"
    action={
      data.capabilities.canLogInteraction ? (
        <LvButton theme={theme} variant="secondary" size="sm" icon={<LvIcon name="note" size={15} />} onClick={() => onAction('interaction')}>
          Log an interaction
        </LvButton>
      ) : undefined
    }
  >
    {data.interactions.length === 0 ? (
      <EmptyState
        theme={theme}
        quiet={false}
        icon="messages"
        tint="blue"
        title="Nothing has been logged yet"
        text="Every call, message and meeting recorded here becomes the memory the whole team works from."
        action={
          data.capabilities.canLogInteraction ? (
            <LvButton theme={theme} variant="primary" size="sm" onClick={() => onAction('interaction')}>
              Log the first one
            </LvButton>
          ) : undefined
        }
      />
    ) : (
      <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), margin: 0, padding: 0, listStyle: 'none' }}>
        {data.interactions.map((interaction) => (
          <LvActivityCard
            key={interaction.id}
            theme={theme}
            channel={sentenceCase(interaction.channel) || 'Interaction'}
            direction={sentenceCase(interaction.direction) || '—'}
            when={interaction.occurredAt ? formatWhen(interaction.occurredAt, data.now) : ''}
            outcome={sentenceCase(interaction.outcome) || 'No outcome'}
            sentiment={interaction.sentiment}
            summary={interaction.summary}
            objection={interaction.objections}
          />
        ))}
      </ul>
    )}
  </LvSectionCard>
);

// ---------------------------------------------------------------------------
// Documents — the working verification model, with a real preview
// ---------------------------------------------------------------------------
export const DocumentsTab = ({ theme, data }: TabProps) => {
  const tier = useLvTier();
  const [preview, setPreview] = useState<LvDocument | null>(null);
  const documents = data.onboarding?.documents ?? [];
  const verified = documents.filter((document) => document.verificationState === 'VERIFIED').length;

  const mapped: LvDocument[] = documents.map((document) => ({
    id: document.id,
    name: document.name ?? sentenceCase(document.documentType) ?? 'Document',
    typeLabel: sentenceCase(document.documentType) || 'Document',
    state: document.verificationState,
    expiry: document.expiresAt ? `expires ${formatWhen(document.expiresAt, data.now)}` : null,
    rejectionReason: document.rejectionReason,
  }));

  const body = preview && (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), flexWrap: 'wrap' }}>
        <LvBadge theme={theme} tone={verificationTone(preview.state)}>
          {verificationLabel(preview.state)}
        </LvBadge>
        <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{preview.typeLabel}</span>
        {preview.expiry && <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{preview.expiry}</span>}
      </div>
      {preview.rejectionReason && (
        <p style={{ ...theme.type.body, color: theme.color.danger, margin: 0 }}>{preview.rejectionReason}</p>
      )}
      {/* The file itself is stored by the platform and is not served to this
          screen yet, so the panel says so rather than showing a broken frame. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: theme.space(2),
          padding: theme.space(7),
          borderRadius: theme.radius.lg,
          background: theme.color.surfaceSunken,
          border: `1px dashed ${theme.color.borderStrong}`,
          textAlign: 'center',
        }}
      >
        <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
          <LvIcon name="document" size={28} />
        </span>
        <span style={{ ...theme.type.body, color: theme.color.text }}>{preview.name}</span>
        <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>
          The file is held against the onboarding record. Opening it in place is part of the onboarding module.
        </span>
      </div>
    </>
  );

  return (
    <>
      <LvSectionCard
        theme={theme}
        title="Documents"
        icon="document"
        action={
          documents.length > 0 ? (
            <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>
              {verified} of {documents.length} verified
            </span>
          ) : undefined
        }
      >
        {documents.length === 0 ? (
          <EmptyState
            theme={theme}
            quiet={false}
            icon="document"
            tint="peach"
            title="No document has been uploaded"
            text={
              data.onboarding
                ? 'Documents requested during onboarding will appear here with their verification state.'
                : 'Documents are collected once onboarding starts for this partner.'
            }
          />
        ) : (
          <LvDocumentList
            theme={theme}
            documents={mapped}
            actions={(document) => (
              <LvButton theme={theme} size="sm" variant="ghost" onClick={() => setPreview(document)}>
                View
              </LvButton>
            )}
          />
        )}
      </LvSectionCard>

      {/* A full screen on a phone, a side panel where there is room beside the
          list — the same content either way. */}
      {preview &&
        (tier === 'mobile' ? (
          <LvSheet theme={theme} title={preview.name} onClose={() => setPreview(null)}>
            {body}
          </LvSheet>
        ) : (
          <LvDrawer theme={theme} title={preview.name} description={preview.typeLabel} onClose={() => setPreview(null)}>
            {body}
          </LvDrawer>
        ))}
    </>
  );
};

// ---------------------------------------------------------------------------
// Onboarding — the steps, not a progress bar on its own
// ---------------------------------------------------------------------------
export const OnboardingTab = ({ theme, data, onOpenTab }: TabProps) => {
  const { onboarding, capabilities } = data;

  if (!capabilities.canViewOnboarding || !onboarding) {
    return (
      <LvSectionCard theme={theme} title="Onboarding" icon="onboarding">
        <EmptyState
          theme={theme}
          quiet={false}
          icon="onboarding"
          tint="lavender"
          title="Onboarding has not started"
          text="Once this relationship is qualified, onboarding collects the documents and takes the partner live."
        />
      </LvSectionCard>
    );
  }

  const percentage = onboarding.progressPercentage ?? 0;
  const current = onboarding.currentStep ?? null;
  const pending = onboarding.documents.filter((document) => document.verificationState !== 'VERIFIED');
  const steps: LvStep[] = [
    { key: 'details', label: 'Partner details', state: percentage > 0 ? 'done' : 'current' },
    { key: 'documents', label: 'Document collection', state: percentage >= 40 ? 'done' : percentage > 0 ? 'current' : 'todo', detail: pending.length > 0 ? `${pending.length} still to verify` : null },
    { key: 'review', label: 'Document review', state: percentage >= 70 ? 'done' : percentage >= 40 ? 'current' : 'todo' },
    { key: 'approval', label: 'Approval', state: percentage >= 90 ? 'done' : percentage >= 70 ? 'current' : 'todo' },
    { key: 'live', label: 'Live on La Vivenzia', state: percentage >= 100 ? 'done' : 'todo' },
  ];

  return (
    <>
      <LvSectionCard
        theme={theme}
        title="Onboarding"
        icon="onboarding"
        action={<LvBadge theme={theme}>{sentenceCase(onboarding.status) || 'Not started'}</LvBadge>}
      >
        <LvProgress
          theme={theme}
          percentage={percentage}
          caption={current ? `Current step: ${sentenceCase(current)}` : 'Not started'}
          action={
            capabilities.canWorkOnboarding ? (
              <LvButton theme={theme} variant="secondary" size="sm" onClick={() => onOpenTab('documents')}>
                Help complete
              </LvButton>
            ) : undefined
          }
        />
        <div style={{ marginTop: theme.space(5) }}>
          {/* The stage names come from the percentage the server computed;
              they describe where the partner is, not a client-side workflow. */}
          <LvSteps theme={theme} label="Onboarding stages" steps={steps} />
        </div>
      </LvSectionCard>

      {pending.length > 0 && (
        <LvSectionCard theme={theme} title="Still waiting on" icon="clock">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
            {pending.map((document) => (
              <li key={document.id} style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), ...theme.type.body, color: theme.color.text }}>
                <span aria-hidden="true" style={{ color: theme.color.warning, display: 'inline-flex' }}>
                  <LvIcon name="warning" size={16} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>{document.name ?? sentenceCase(document.documentType)}</span>
                <LvBadge theme={theme} tone={verificationTone(document.verificationState)}>
                  {verificationLabel(document.verificationState)}
                </LvBadge>
              </li>
            ))}
          </ul>
        </LvSectionCard>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Timeline — everything that happened, grouped so it does not read as a log
// ---------------------------------------------------------------------------
const dayLabel = (iso: string, now: string): string => {
  const then = new Date(iso);
  const today = new Date(now);
  const days = Math.floor((Date.parse(now) - Date.parse(iso)) / 86_400_000);

  if (then.toDateString() === today.toDateString()) {
    return 'Today';
  }

  if (days < 2) {
    return 'Yesterday';
  }

  if (days < 7) {
    return 'Earlier this week';
  }

  if (days < 31) {
    return 'Earlier this month';
  }

  return then.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

export const TimelineTab = ({ theme, data, onAction }: TabProps) => {
  const groups: { label: string; entries: Lead360['timeline'] }[] = [];

  for (const entry of data.timeline) {
    const label = dayLabel(entry.at, data.now);
    const last = groups[groups.length - 1];

    if (last && last.label === label) {
      last.entries.push(entry);
    } else {
      groups.push({ label, entries: [entry] });
    }
  }

  return (
    <LvSectionCard
      theme={theme}
      title="Relationship timeline"
      icon="clock"
      action={
        data.capabilities.canAddNote ? (
          <LvButton theme={theme} variant="secondary" size="sm" onClick={() => onAction('note')}>
            Add a note
          </LvButton>
        ) : undefined
      }
    >
      {data.timeline.length === 0 ? (
        <EmptyState theme={theme} quiet={false} icon="clock" title="Nothing has happened yet" text="The moment this lead is contacted, assigned or moved, it is recorded here." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(5) }}>
          {groups.map((group) => (
            <section key={group.label}>
              <h3 style={{ ...theme.type.label, color: theme.color.textMuted, margin: `0 0 ${theme.space(3)}px` }}>{group.label}</h3>
              <LvTimeline theme={theme} formatWhen={(iso) => formatWhen(iso, data.now)} entries={group.entries} />
            </section>
          ))}
        </div>
      )}
    </LvSectionCard>
  );
};

export { TINTS as LEAD_TINTS };
