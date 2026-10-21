import { useState } from 'react';

import { LvBarChart, LvDonut, LvRing, LvSparkline } from 'src/design/charts';
import { LvBreadcrumbs, LvDataTable, LvFilterBar, LvPagination } from 'src/design/data';
import { LvDocumentList, LvUploadItem, LvUploadZone } from 'src/design/documents';
import { LvBanner, LvNotificationList, LvToastStack, useLvToasts, type LvNotification } from 'src/design/feedback';
import { LvIcon } from 'src/design/icons';
import { LvAiAnswer, LvAiPanel, LvAiUnavailable, LvConfidence } from 'src/design/intelligence';
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  LvOfflineBanner,
  RefusalNotice,
  Field,
  InlineNotice,
  LvBadge,
  LvButton,
  LvInput,
  LvSelect,
  LvSkeletonCard,
  LvSteps,
  LvTabs,
  LvTextarea,
  PageHeader,
  Segmented,
  LvProgress,
} from 'src/design/kit';
import { LvConfirm, LvDrawer, LvMenu, LvModal, LvModalFooter, LvSheet } from 'src/design/overlay';
import { LvActivityCard, LvSectionCard } from 'src/design/profile';
import { LV_RESPONSIVE_CONTRACT, LV_TIERS } from 'src/design/responsive';
import { type LvTheme } from 'src/design/theme';
import { useLvTier } from 'src/design/use-tier';

// The design system, rendered.
//
// Every shared component appears here once, so the system can be reviewed as a
// whole rather than screen by screen, and so a component nobody has wired into
// a product screen yet still gets compiled, type-checked and bundled. The page
// also prints the responsive contract, and names the width it is currently
// being viewed at — resize the window and the components and the table of
// promises change together.
//
// It carries no business logic and calls no route.

type Row = { id: string; name: string; owner: string; status: string; updated: string };

const ROWS: Row[] = [
  { id: 'LV-000005', name: 'Tiger Valley Farmstay', owner: 'Tim Apple', status: 'Assigned', updated: '2 h ago' },
  { id: 'LV-000003', name: 'Sunset Villa Lonavala', owner: 'Tim Apple', status: 'Contacted', updated: '1 d ago' },
  { id: 'LV-000002', name: 'Aaranya Trails & Stays', owner: 'Unassigned', status: 'Qualified', updated: '3 d ago' },
];

const DOCUMENTS = [
  { id: 'a', name: 'PAN card.pdf', typeLabel: 'Identity', state: 'VERIFIED', sizeLabel: '240 KB' },
  { id: 'b', name: 'Electricity bill.pdf', typeLabel: 'Address proof', state: 'PENDING', expiry: 'expires in 12 d' },
  {
    id: 'c',
    name: 'Fire safety certificate.pdf',
    typeLabel: 'Compliance',
    state: 'REJECTED',
    rejectionReason: 'The certificate expired in March; a renewed copy is needed before the property can be activated.',
  },
];

const NOTIFICATIONS: LvNotification[] = [
  { id: '1', kind: 'assignment', title: 'Tiger Valley Farmstay was assigned to you', when: '15 min ago', unread: true },
  { id: '2', kind: 'sla', title: 'First response due in 40 minutes', detail: 'Sunset Villa Lonavala', when: '1 h ago', unread: true },
  { id: '3', kind: 'document', title: 'A document is waiting for review', detail: 'Fire safety certificate', when: 'Yesterday' },
];

const Block = ({ theme, title, children }: { theme: LvTheme; title: string; children: React.ReactNode }) => (
  <LvSectionCard theme={theme} title={title} icon="sparkle">
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>{children}</div>
  </LvSectionCard>
);

export const DesignSystemScreen = ({ theme }: { theme: LvTheme }) => {
  const tier = useLvTier();
  const { toasts, push, dismiss } = useLvToasts();
  const [tab, setTab] = useState('components');
  const [segment, setSegment] = useState('all');
  const [overlay, setOverlay] = useState<'modal' | 'drawer' | 'sheet' | 'confirm' | null>(null);
  const [channel, setChannel] = useState('PHONE');
  const [note, setNote] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [files, setFiles] = useState<string[]>([]);

  return (
    <>
      <PageHeader theme={theme} title="Design system" subtitle={`The La Vivenzia component system. You are viewing it at ${LV_TIERS[tier].label}.`} />

      <LvBreadcrumbs
        theme={theme}
        trail={[
          { key: 'home', label: 'La Vivenzia', onNavigate: () => undefined },
          { key: 'ds', label: 'Design system' },
        ]}
      />

      <LvTabs
        theme={theme}
        label="Design system sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'components', label: 'Components' },
          { key: 'contract', label: 'Responsive contract', count: LV_RESPONSIVE_CONTRACT.length },
        ]}
      />

      {tab === 'contract' && (
        <LvDataTable
          theme={theme}
          caption="What every shared component does at each width"
          rowKey={(row) => row.family}
          rows={LV_RESPONSIVE_CONTRACT}
          columns={[
            { key: 'family', label: 'Family', primary: true, render: (row) => row.family },
            { key: 'desktop', label: 'Desktop', render: (row) => row.desktop },
            { key: 'tablet', label: 'Tablet', secondary: true, render: (row) => row.tablet },
            { key: 'mobile', label: 'Mobile', render: (row) => row.mobile },
            { key: 'touch', label: 'Touch', align: 'right', secondary: true, render: (row) => (row.touchTarget ? `${row.touchTarget}px` : '—') },
          ]}
        />
      )}

      {tab === 'components' && (
        <>
          <Block theme={theme} title="Buttons">
            <div className="lv-action-row" style={{ display: 'flex', gap: theme.space(2), alignItems: 'center' }}>
              <LvButton theme={theme} variant="primary" onClick={() => push({ tone: 'success', text: 'That worked.' })}>
                Primary
              </LvButton>
              <LvButton theme={theme} variant="secondary">
                Secondary
              </LvButton>
              <LvButton theme={theme} variant="ghost">
                Ghost
              </LvButton>
              <LvButton theme={theme} variant="danger">
                Danger
              </LvButton>
              <LvMenu
                theme={theme}
                label="More actions"
                items={[
                  { key: 'a', label: 'Log an interaction', icon: 'note', onSelect: () => push({ tone: 'neutral', text: 'Interaction logged.' }) },
                  { key: 'b', label: 'Delete', icon: 'trash', tone: 'danger', onSelect: () => setOverlay('confirm') },
                ]}
              />
            </div>
          </Block>

          <Block theme={theme} title="Inputs">
            <div className="lv-field-grid">
              <Field theme={theme} label="Lead name" htmlFor="ds-name" required>
                <LvInput theme={theme} id="ds-name" value="Tiger Valley Farmstay" onChange={() => undefined} />
              </Field>
              <Field theme={theme} label="Channel" htmlFor="ds-channel">
                <LvSelect theme={theme} id="ds-channel" value={channel} onChange={(event) => setChannel(event.target.value)}>
                  <option value="PHONE">Phone</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                </LvSelect>
              </Field>
            </div>
            <Field theme={theme} label="What was said" htmlFor="ds-note" help="A short summary; the assistant uses it later.">
              <LvTextarea theme={theme} id="ds-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </Block>

          <Block theme={theme} title="Filters, table and pagination">
            <LvFilterBar
              theme={theme}
              label="Filter leads"
              active={onlyMine ? [{ key: 'mine', label: 'Only mine', onRemove: () => setOnlyMine(false) }] : []}
              onClearAll={onlyMine ? () => setOnlyMine(false) : undefined}
            >
              <Segmented
                theme={theme}
                label="Status"
                value={segment}
                onChange={setSegment}
                options={[
                  { key: 'all', label: 'All', count: 3 },
                  { key: 'open', label: 'Open', count: 2 },
                  { key: 'closed', label: 'Closed', count: 1 },
                ]}
              />
              <LvButton theme={theme} variant={onlyMine ? 'primary' : 'secondary'} size="sm" onClick={() => setOnlyMine((value) => !value)}>
                Only mine
              </LvButton>
            </LvFilterBar>

            <LvDataTable
              theme={theme}
              caption="Leads"
              rows={ROWS}
              rowKey={(row) => row.id}
              onRowClick={() => push({ tone: 'neutral', text: 'A row opens the record.' })}
              columns={[
                { key: 'name', label: 'Name', primary: true, render: (row) => row.name },
                { key: 'id', label: 'Reference', render: (row) => row.id },
                { key: 'owner', label: 'Owner', secondary: true, render: (row) => row.owner },
                { key: 'status', label: 'Status', render: (row) => <LvBadge theme={theme}>{row.status}</LvBadge> },
                { key: 'updated', label: 'Updated', align: 'right', secondary: true, render: (row) => row.updated },
              ]}
            />
            <LvPagination theme={theme} from={1} to={3} total={3} />
          </Block>

          <Block theme={theme} title="Overlays">
            <div className="lv-action-row" style={{ display: 'flex', gap: theme.space(2) }}>
              <LvButton theme={theme} variant="secondary" onClick={() => setOverlay('modal')}>
                Modal
              </LvButton>
              <LvButton theme={theme} variant="secondary" onClick={() => setOverlay('drawer')}>
                Drawer
              </LvButton>
              <LvButton theme={theme} variant="secondary" onClick={() => setOverlay('sheet')}>
                Sheet
              </LvButton>
              <LvButton theme={theme} variant="danger" onClick={() => setOverlay('confirm')}>
                Confirmation
              </LvButton>
            </div>
          </Block>

          <Block theme={theme} title="Progress and steps">
            <LvProgress theme={theme} percentage={70} caption="Current step: About you" pending={['Fire safety certificate', 'Bank details']} />
            <LvSteps
              theme={theme}
              label="Onboarding steps"
              steps={[
                { key: '1', label: 'Basic information', state: 'done' },
                { key: '2', label: 'About you', state: 'current', detail: 'Waiting on the partner since Tuesday' },
                { key: '3', label: 'Documents', state: 'todo' },
                { key: '4', label: 'Final review', state: 'todo' },
              ]}
            />
          </Block>

          <Block theme={theme} title="Documents and upload">
            <LvDocumentList theme={theme} documents={DOCUMENTS} />
            <LvUploadZone theme={theme} label="Add a document" hint="PDF or an image, up to 10 MB." onFiles={(picked) => setFiles(picked.map((file) => file.name))} />
            {files.map((name) => (
              <LvUploadItem key={name} theme={theme} name={name} percentage={100} />
            ))}
          </Block>

          <Block theme={theme} title="Activity">
            <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), margin: 0, padding: 0, listStyle: 'none' }}>
              <LvActivityCard
                theme={theme}
                channel="Phone"
                direction="Outbound"
                when="15 d ago"
                outcome="Interested"
                sentiment="POSITIVE"
                summary="Walked through the onboarding steps and agreed to send the fire safety certificate this week."
                objection="Wants to understand the commission split before signing."
              />
            </ul>
          </Block>

          <Block theme={theme} title="Intelligence">
            <LvAiPanel theme={theme} title="What the assistant sees">
              <LvAiAnswer
                theme={theme}
                known="Three interactions in the last fortnight, all by phone, all positive."
                inferred="The relationship is warm but stalled on one document."
                suggested="Call and offer to walk through the certificate renewal."
                citations={[
                  { key: 'a', label: 'LV-000005', onOpen: () => undefined },
                  { key: 'b', label: 'Interaction · 15 d ago', onOpen: () => undefined },
                ]}
                onAccept={() => push({ tone: 'success', text: 'Suggestion accepted and recorded.' })}
                onReject={() => push({ tone: 'neutral', text: 'Marked as not useful.' })}
              />
            </LvAiPanel>
            <div style={{ display: 'flex', gap: theme.space(4), flexWrap: 'wrap', alignItems: 'center' }}>
              <LvConfidence theme={theme} value={0.92} label="the phone number" />
              <LvConfidence theme={theme} value={0.61} label="the category" />
              <LvConfidence theme={theme} value={0.24} label="the address" />
            </div>
            <LvAiUnavailable theme={theme} reason="The assistant is out of quota until tomorrow." fallback="Scores and SLA clocks are computed from records and are unaffected." />
          </Block>

          <Block theme={theme} title="Charts">
            <LvBarChart
              theme={theme}
              caption="Where relationships came from"
              data={[
                { key: 'ig', label: 'Instagram', value: 24 },
                { key: 'ref', label: 'Referral', value: 18 },
                { key: 'web', label: 'Website', value: 11 },
                { key: 'walk', label: 'Walk-in', value: 4 },
              ]}
            />
            <LvDonut
              theme={theme}
              caption="Onboarding by stage"
              data={[
                { key: 'a', label: 'In progress', value: 8 },
                { key: 'b', label: 'Waiting', value: 5 },
                { key: 'c', label: 'Approved', value: 12 },
              ]}
            />
            <div style={{ display: 'flex', gap: theme.space(5), alignItems: 'center', flexWrap: 'wrap' }}>
              <LvRing theme={theme} percentage={70} label="Onboarding" />
              <LvSparkline theme={theme} label="Leads per week" values={[4, 6, 5, 9, 12, 11, 15]} />
            </div>
          </Block>

          <Block theme={theme} title="Notifications and messages">
            <LvBanner theme={theme} tone="warning" title="Two documents are waiting for review">
              They have been pending for more than three days.
            </LvBanner>
            <InlineNotice theme={theme} tone="danger">
              The server refused that status change: a lead cannot move from Closed to Qualified.
            </InlineNotice>
            <LvNotificationList theme={theme} notifications={NOTIFICATIONS} />
            <LvButton theme={theme} variant="secondary" size="sm" onClick={() => push({ tone: 'success', text: 'Interaction logged.', action: { label: 'Undo', onSelect: () => undefined } })}>
              Raise a toast
            </LvButton>
          </Block>

          <Block theme={theme} title="14.1 Loading — every screen's first paint">
            <LoadingState theme={theme} rows={3} label="Loading" />
            <LvSkeletonCard theme={theme} />
          </Block>

          <Block theme={theme} title="14.2 Empty — a list with nothing in it">
            <EmptyState theme={theme} title="No lead matches this view" text="Clear the filters, or capture someone new." action={<LvButton theme={theme} variant="primary" size="sm" icon={<LvIcon name="capture" size={16} />}>Capture a lead</LvButton>} />
          </Block>

          <Block theme={theme} title="14.3 Error — a route failed, with a way back">
            <ErrorState theme={theme} text="That lead could not be opened: the record was not found or you do not have access to it." onRetry={() => undefined} />
          </Block>

          <Block theme={theme} title="14.4 Forbidden — the role may not see this">
            {/* The server's own sentence, from /control-tower/summary. */}
            <ForbiddenState theme={theme} title="Not available for your role" text="The Control Tower is available to administrators only." />
          </Block>

          <Block theme={theme} title="14.5 Refusal — the server declined, and said why">
            {/* Also the server's own words, from /tasks/update. Nothing broke:
                the answer was no, and the reason is the point. */}
            <RefusalNotice theme={theme} reason="That task is not attached to this lead, or is not visible to you." />
            <RefusalNotice theme={theme} title="That follow-up could not be created" reason="A task needs a title." action={<LvButton theme={theme} variant="secondary" size="sm">Edit it</LvButton>} />
          </Block>

          <Block theme={theme} title="14.6 Offline — the server cannot be reached">
            {/* In the application this is fixed to the top of the window; here
                it sits in flow so it can be read beside the others. */}
            <div style={{ position: 'relative' }}>
              <LvOfflineBanner theme={theme} onRetry={() => undefined} />
            </div>
          </Block>

          <Block theme={theme} title="14.7 Search — nothing matched">
            {/* The real thing lives inside the ⌘K panel; this is the same copy. */}
            <div style={{ padding: theme.space(5), textAlign: 'center', border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md }} role="status">
              <p style={{ ...theme.type.body, color: theme.color.heading, margin: 0 }}>Nothing matches “lonavla”</p>
              <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0` }}>
                Try a name, a reference like LV-000005, a place, or a phone number.
              </p>
            </div>
          </Block>
        </>
      )}

      {overlay === 'modal' && (
        <LvModal
          theme={theme}
          title="Log an interaction"
          description="What happened, and what it means for the next step."
          onClose={() => setOverlay(null)}
          footer={<LvModalFooter theme={theme} onCancel={() => setOverlay(null)} onConfirm={() => setOverlay(null)} confirmLabel="Log it" />}
        >
          <Field theme={theme} label="Summary" htmlFor="ds-modal-note">
            <LvTextarea theme={theme} id="ds-modal-note" rows={3} value="" onChange={() => undefined} />
          </Field>
        </LvModal>
      )}

      {overlay === 'drawer' && (
        <LvDrawer theme={theme} title="Tiger Valley Farmstay" description="LV-000005 · Lonavala" onClose={() => setOverlay(null)}>
          <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>
            A drawer shows a record without costing you your place in the list. On a phone it becomes a tall bottom sheet.
          </p>
        </LvDrawer>
      )}

      {overlay === 'sheet' && (
        <LvSheet theme={theme} title="Choose a view" onClose={() => setOverlay(null)}>
          <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>A sheet on a phone, a centred panel anywhere else.</p>
        </LvSheet>
      )}

      {overlay === 'confirm' && (
        <LvConfirm
          theme={theme}
          title="Delete this lead?"
          consequence="The relationship, its seven interactions and its four documents are removed. This cannot be undone."
          confirmLabel="Delete the lead"
          onCancel={() => setOverlay(null)}
          onConfirm={() => {
            setOverlay(null);
            push({ tone: 'danger', text: 'Nothing was deleted — this is the design system.' });
          }}
        />
      )}

      <LvToastStack theme={theme} toasts={toasts} onDismiss={dismiss} />
    </>
  );
};
