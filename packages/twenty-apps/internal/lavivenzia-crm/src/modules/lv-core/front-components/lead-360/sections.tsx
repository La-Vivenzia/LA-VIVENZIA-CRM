import { type ReactNode } from 'react';

import {
  dueLabel,
  groupTimelineByDay,
  headerFields,
  humanize,
  overviewWarnings,
  statusLabel,
  timeOfDay,
} from 'src/modules/lv-core/front-components/lead-360/lead-360-view';
import { type Lead360Model, type TaskSummary, type TimelineEntry } from 'src/modules/lv-core/services/lead-360';
import { type LvTheme } from 'src/modules/lv-core/ui/theme';
import { openCapturePage } from 'src/modules/lv-core/utils/open-capture';
import { EmptyState, Eyebrow, Facts, InversePanel, LvBadge, LvButton, LvStatusBadge, Provenance, Section, formatWhen } from 'src/modules/lv-core/ui/kit';
import { badgeToneOf, describeStatus } from 'src/modules/lv-core/ui/status';

// The read-only building blocks of Lead 360. Each renders one slice of the
// server model and calls back for actions; none of them decides permissions —
// `capabilities` did that on the server — and none loads data of its own.

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const Tag = ({ theme, tone = 'neutral', children }: { theme: LvTheme; tone?: Tone; children: ReactNode }) => (
  <LvBadge theme={theme} tone={tone}>
    {children}
  </LvBadge>
);

export const Highlight = ({ theme, active, children, label }: { theme: LvTheme; active: boolean; children: ReactNode; label: string }) => (
  <div
    data-attention={active ? 'true' : 'false'}
    aria-label={active ? `${label} — needs attention` : undefined}
    style={active ? { borderRadius: theme.radius.lg } : undefined}
  >
    {children}
  </div>
);

// ---------------------------------------------------------------- header
export const Header = ({ theme, model }: { theme: LvTheme; model: Lead360Model }) => {
  const fields = headerFields(model);
  const health = model.intelligence.health.state;
  const healthTone = badgeToneOf(describeStatus('health', health).tone);
  const attention = model.attention.overdueFollowUp || model.attention.slaBreach || model.attention.noNextAction || model.attention.missingDocuments;

  return (
    <InversePanel theme={theme}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(3), alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div style={{ ...theme.type.label, color: theme.color.accent, marginBottom: 4 }}>{model.lead.lvLeadId ?? 'LV ID pending'}</div>
          <h1 style={{ ...theme.type.display, margin: 0, color: theme.color.surfaceInverseText, overflowWrap: 'anywhere' }}>{model.lead.name ?? 'Unnamed lead'}</h1>
          {model.lead.organisationName && <div style={{ ...theme.type.body, color: 'rgba(243,239,231,0.78)', marginTop: 2 }}>{model.lead.organisationName}</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: theme.space(3) }}>
            <LvStatusBadge theme={theme} kind="lead" value={model.lead.status} />
            {model.lead.priority && <LvStatusBadge theme={theme} kind="priority" value={model.lead.priority} />}
            <LvBadge theme={theme} tone={healthTone}>
              Health · {describeStatus('health', health).label}
            </LvBadge>
            {!model.lead.ownerId && (
              <LvBadge theme={theme} tone="warning">
                Unassigned
              </LvBadge>
            )}
            {attention && (
              <LvBadge theme={theme} tone="danger">
                Needs attention
              </LvBadge>
            )}
          </div>
        </div>
        <div style={{ flex: '0 1 320px', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: theme.space(2) }}>
          {[
            { label: 'Opportunity', value: model.intelligence.opportunity.available ? `${model.intelligence.opportunity.score}` : 'n/a', unit: model.intelligence.opportunity.available ? '/ 100' : '', numeric: true },
            { label: 'Last interaction', value: model.lead.lastInteractionAt ? formatWhen(model.lead.lastInteractionAt, model.now) : 'None yet', unit: '', numeric: false },
          ].map((figure) => (
            <div key={figure.label} style={{ background: 'rgba(243,239,231,0.06)', border: '1px solid rgba(243,239,231,0.12)', borderRadius: theme.radius.md, padding: `${theme.space(2)}px ${theme.space(3)}px` }}>
              <div style={{ ...theme.type.label, color: 'rgba(243,239,231,0.7)' }}>{figure.label}</div>
              <div style={{ ...(figure.numeric ? { ...theme.type.figure, fontSize: 'clamp(20px, 2.4vw, 26px)' } : { ...theme.type.subheading, fontSize: 15 }), color: theme.color.surfaceInverseText, marginTop: 2 }}>
                {figure.value}
                {figure.unit && <span style={{ ...theme.type.caption, color: 'rgba(243,239,231,0.7)', marginLeft: 4 }}>{figure.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: theme.space(4), paddingTop: theme.space(3), borderTop: '1px solid rgba(243,239,231,0.14)' }}>
        <Facts
          theme={theme}
          onInverse
          columns={3}
          items={fields
            .filter((field) => !['status', 'priority', 'health', 'opportunity', 'lastInteraction', 'lvLeadId'].includes(field.key))
            .map((field) => ({ label: field.label, value: field.value, tone: field.tone === 'danger' || field.tone === 'warning' ? field.tone : undefined }))}
        />
      </div>
    </InversePanel>
  );
};

// ------------------------------------------------------------ action bar
export type ActionKey = 'EDIT' | 'OWNER' | 'STATUS' | 'PRIORITY' | 'INTERACTION' | 'TASK' | 'NOTE' | 'ONBOARDING' | 'DOCUMENTS' | 'MORE';

export const ActionBar = ({ theme, model, onAction, open }: { theme: LvTheme; model: Lead360Model; onAction: (action: ActionKey) => void; open: ActionKey | null }) => {
  const { capabilities } = model;
  const button = (key: ActionKey, label: string, variant: 'primary' | 'secondary' | 'ghost' = 'secondary') => (
    <LvButton key={key} theme={theme} variant={open === key ? 'primary' : variant} ariaPressed={open === key} onClick={() => onAction(key)}>
      {label}
    </LvButton>
  );
  // Only actions the server said this person can execute are rendered — a
  // disabled button would still advertise a capability they do not have.
  const actions: ReactNode[] = [];

  if (capabilities.canLogInteraction) {
    actions.push(button('INTERACTION', 'Add interaction', 'primary'));
  }

  if (capabilities.canCreateTask) {
    actions.push(button('TASK', 'Create task'));
  }

  if (capabilities.canAddNote) {
    actions.push(button('NOTE', 'Add note'));
  }

  if (capabilities.canChangeStatus) {
    actions.push(button('STATUS', 'Change status'));
  }

  if (capabilities.canEdit) {
    actions.push(button('PRIORITY', 'Change priority'));
  }

  if (capabilities.canChangeOwner) {
    actions.push(button('OWNER', 'Change owner'));
  } else if (capabilities.canClaim) {
    actions.push(button('OWNER', 'Claim lead'));
  }

  if (capabilities.canViewOnboarding || capabilities.canWorkOnboarding) {
    actions.push(button('ONBOARDING', model.onboarding ? 'Continue onboarding' : 'Start onboarding'));
  }

  if (model.onboarding && model.onboarding.documents.length > 0) {
    actions.push(button('DOCUMENTS', 'View documents'));
  }

  if (capabilities.canEdit) {
    actions.push(button('EDIT', 'Edit'));
    actions.push(button('MORE', 'More actions', 'ghost'));
  }

  // Capture is a create, not an edit of this lead: it appears whenever the
  // person can add leads at all, after the lead's own actions.
  if (capabilities.canCapture) {
    actions.push(
      <LvButton key="CAPTURE" theme={theme} variant="ghost" onClick={() => void openCapturePage()}>
        Capture lead
      </LvButton>,
    );
  }

  if (actions.length === 0) {
    return (
      <p role="status" style={{ ...theme.type.bodySmall, margin: 0, color: theme.color.textMuted }}>
        You can view this lead. Your role has no actions here.
      </p>
    );
  }

  return (
    <nav aria-label="Lead actions" style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
      {actions}
    </nav>
  );
};

// ------------------------------------------------------------ next action
export const NextActionPanel = ({ theme, model, onComplete, onReschedule, onAddAction, onLogInteraction, onAcceptSuggestion, busy }: { theme: LvTheme; model: Lead360Model; onComplete: (task: TaskSummary) => void; onReschedule: (task: TaskSummary) => void; onAddAction: () => void; onLogInteraction: () => void; onAcceptSuggestion: () => void; busy: boolean }) => {
  const task = model.nextAction.task;
  const suggestion = model.nextAction.suggestion;
  const due = task ? dueLabel(task.dueAt, model.now) : null;

  return (
    <Highlight theme={theme} active={model.attention.overdueFollowUp || model.attention.noNextAction} label="Next action">
      <Section theme={theme} title="Next action" hint={task ? undefined : 'nothing scheduled'} tone={due?.tone === 'danger' ? 'danger' : !task ? 'warning' : undefined}>
        {task ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
            <div style={{ ...theme.type.title, color: theme.color.heading }}>{task.title ?? 'Untitled task'}</div>
            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: theme.space(2), margin: 0 }}>
              <div>
                <dt style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>Due</dt>
                <dd style={{ margin: 0, color: due?.tone === 'danger' ? theme.color.danger : due?.tone === 'warning' ? theme.color.warning : theme.color.text, fontWeight: theme.font.weight.medium }}>{due?.text}</dd>
              </div>
              <div>
                <dt style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>Owner</dt>
                <dd style={{ margin: 0 }}>{task.assignee?.displayName ?? 'Unassigned'}</dd>
              </div>
              <div>
                <dt style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>Priority</dt>
                <dd style={{ margin: 0 }}>{humanize(task.priority)}</dd>
              </div>
            </dl>
            {model.capabilities.canCreateTask && (
              <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
                <LvButton theme={theme} variant="primary" disabled={busy} onClick={() => onComplete(task)}>Complete</LvButton>
                <LvButton theme={theme} variant="secondary" disabled={busy} onClick={() => onReschedule(task)}>Reschedule / edit</LvButton>
                {model.capabilities.canLogInteraction && (
                  <LvButton theme={theme} variant="ghost" disabled={busy} onClick={onLogInteraction}>Add interaction</LvButton>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
            <p style={{ margin: 0, color: theme.color.textMuted }}>No next action scheduled.</p>
            {model.capabilities.canCreateTask && (
              <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
                <LvButton theme={theme} variant="primary" disabled={busy} onClick={onAddAction}>Add next action</LvButton>
              </div>
            )}
          </div>
        )}
        {suggestion && (
          <div style={{ marginTop: theme.space(3), paddingTop: theme.space(2), borderTop: `1px dashed ${theme.color.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
              <LvStatusBadge theme={theme} kind="priority" value={suggestion.priority} />
              <Provenance theme={theme} source="rules" detail={`Next best action, rules ${model.intelligence.nextBestAction.rulesVersion}`} />
            </div>
            <div style={{ fontWeight: theme.font.weight.medium }}>{suggestion.title}</div>
            <div style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>{suggestion.reason} · suggested {suggestion.deadlineLabel.toLowerCase()}</div>
            {model.capabilities.canCreateTask && suggestion.proposedTask && !task && (
              <div>
                <LvButton theme={theme} variant="secondary" size="sm" disabled={busy} onClick={onAcceptSuggestion}>Make this the next action</LvButton>
              </div>
            )}
          </div>
        )}
      </Section>
    </Highlight>
  );
};

// ---------------------------------------------------------------- overview
export const OverviewSection = ({ theme, model }: { theme: LvTheme; model: Lead360Model }) => {
  const { lead } = model;
  const warnings = overviewWarnings(model.intelligence.dataQuality, model.attention);
  const rows: [string, string | null][] = [
    ['Email', lead.emails?.primaryEmail ?? null],
    ['Phone', lead.phones?.primaryPhoneNumber ?? null],
    ['Website', lead.website?.primaryLinkUrl ?? null],
    ['Instagram', lead.instagram?.primaryLinkUrl ?? null],
    ['Organisation', lead.organisationName],
    ['Job title', lead.jobTitle],
    ['Social profile', lead.socialProfiles?.primaryLinkUrl ?? null],
    ['Category', lead.category ? humanize(lead.category) : null],
    ['Subcategory', lead.subcategory ? humanize(lead.subcategory) : null],
    ['Location', lead.location],
    ['Languages', lead.languages && lead.languages.length > 0 ? lead.languages.join(', ') : null],
    ['Source', lead.source ? humanize(lead.source) : null],
    ['Capture mode', lead.captureMode ? humanize(lead.captureMode) : null],
    ['Lifecycle status', statusLabel(lead.status)],
    ['Priority', lead.priority ? humanize(lead.priority) : null],
    ['Owner', lead.owner?.displayName ?? (lead.ownerId ? 'Team member' : null)],
    ['Assigned', lead.assignedAt ? lead.assignedAt.slice(0, 10) : null],
    ['Created', lead.createdAt.slice(0, 10)],
    ['Last updated', lead.updatedAt.slice(0, 10)],
    ['Last interaction', lead.lastInteractionAt ? lead.lastInteractionAt.slice(0, 10) : null],
    ['Data completeness', typeof lead.dataCompleteness === 'number' ? `${lead.dataCompleteness}%` : null],
  ];

  return (
    <Section theme={theme} title="Overview">
      <Facts theme={theme} columns={3} items={rows.map(([label, value]) => ({ label, value: value ?? <span style={{ color: theme.color.textSubtle }}>Not recorded</span> }))} />
      {model.capture && (
        <div style={{ marginTop: theme.space(3), padding: theme.space(3), background: theme.color.surfaceSunken, borderRadius: theme.radius.md }} data-testid="lv-capture-history">
          <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
            <Eyebrow theme={theme}>Capture history</Eyebrow>
            {model.capture.extraction?.status === 'EXTRACTED' && <Provenance theme={theme} source="ai" label={model.capture.extraction.kind === 'OCR' ? 'AI READ · confirmed by a person' : 'PAGE METADATA · confirmed'} />}
            {model.capture.classification && model.capture.classification.status !== 'NOT_RUN' && model.capture.classification.status !== 'UNAVAILABLE' && <LvBadge theme={theme} tone="neutral">classification {model.capture.classification.status.toLowerCase()}</LvBadge>}
          </div>
          <Facts
            theme={theme}
            columns={3}
            items={[
              { label: 'Method', value: `${model.capture.methodLabel}${model.capture.platformLabel ? ` · ${model.capture.platformLabel}` : ''}` },
              { label: 'Captured by', value: model.capture.capturedBy?.displayName ?? 'Team member' },
              { label: 'Captured at', value: model.capture.capturedAt ? model.capture.capturedAt.replace('T', ' ').slice(0, 16) : lead.createdAt.slice(0, 10) },
              ...(model.capture.originalHandle ? [{ label: 'Original handle', value: `@${model.capture.originalHandle}` }] : []),
              ...(model.capture.originalUrl ? [{ label: 'Original link', value: model.capture.originalUrl }] : []),
              ...(model.capture.extraction && model.capture.extraction.status !== 'NOT_APPLICABLE' ? [{ label: 'Automatic extraction', value: model.capture.extraction.status === 'EXTRACTED' ? `${model.capture.extraction.fieldCount} field${model.capture.extraction.fieldCount === 1 ? '' : 's'} read, reviewed by a person` : humanize(model.capture.extraction.status) }] : []),
              ...(model.capture.duplicateDecision ? [{ label: 'Duplicate check', value: humanize(model.capture.duplicateDecision.decision) }] : []),
              ...(model.capture.files.length > 0 ? [{ label: 'Attached', value: model.capture.files.map((file) => file.label ?? 'file').join(', ') }] : []),
            ]}
          />
        </div>
      )}
      {warnings.length > 0 && (
        <div style={{ marginTop: theme.space(3) }}>
          <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
            <Eyebrow theme={theme} tone="warning">Data quality · {warnings.length} issue{warnings.length === 1 ? '' : 's'}</Eyebrow>
            <Provenance theme={theme} source="rules" detail={`rules ${model.intelligence.dataQuality.rulesVersion}`} />
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: theme.font.size.sm }}>
            {warnings.map((warning) => (
              <li key={warning.code} style={{ color: warning.severity === 'HIGH' ? theme.color.danger : warning.severity === 'MEDIUM' ? theme.color.warning : theme.color.textMuted }}>{warning.text}</li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
};

// ------------------------------------------------------------ intelligence
export const IntelligenceSummary = ({ theme, model, onOpenIntelligence }: { theme: LvTheme; model: Lead360Model; onOpenIntelligence: () => void }) => {
  const { opportunity, health, nextBestAction, dataQuality } = model.intelligence;
  const cell = (label: string, value: ReactNode, tone?: Tone) => (
    <div style={{ background: theme.color.surfaceSunken, borderRadius: theme.radius.md, padding: `${theme.space(2)}px ${theme.space(3)}px`, minWidth: 0 }}>
      <div style={{ ...theme.type.label, color: theme.color.textMuted }}>{label}</div>
      <div style={{ ...theme.type.figure, fontSize: 'clamp(18px, 2vw, 22px)', marginTop: 2, color: tone === 'danger' ? theme.color.danger : tone === 'warning' ? theme.color.warning : tone === 'success' ? theme.color.success : theme.color.heading }}>{value}</div>
    </div>
  );

  return (
    <Section theme={theme} title="Intelligence" actions={<Provenance theme={theme} source="rules" detail="Deterministic engines; AI suggestions live on the Intelligence tab" />}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: theme.space(2) }}>
        {cell('Opportunity score', opportunity.available ? `${opportunity.score} / 100` : 'n/a')}
        {cell('Relationship health', humanize(health.state), health.state === 'HEALTHY' ? 'success' : health.state === 'ATTENTION' ? 'warning' : health.state === 'AT_RISK' ? 'danger' : undefined)}
        {cell('Next best action', nextBestAction.primary ? nextBestAction.primary.priority : 'none', nextBestAction.primary?.priority === 'CRITICAL' || nextBestAction.primary?.priority === 'HIGH' ? 'danger' : undefined)}
        {cell('Data quality', `${dataQuality.issues.length} issue${dataQuality.issues.length === 1 ? '' : 's'}`, dataQuality.issues.length > 0 ? 'warning' : 'success')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: theme.space(3), marginTop: theme.space(3), fontSize: theme.font.size.sm }}>
        <div>
          <strong>Why this score</strong>
          {opportunity.available ? (
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {opportunity.positive.slice(0, 3).map((factor) => (
                <li key={factor.factor} style={{ color: theme.color.success }}>+ {factor.factor}</li>
              ))}
              {opportunity.negative.slice(0, 3).map((factor) => (
                <li key={factor.factor} style={{ color: theme.color.danger }}>− {factor.factor}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: '4px 0 0', color: theme.color.textMuted }}>{opportunity.detail}</p>
          )}
        </div>
        <div>
          <strong>Health reasons</strong>
          {health.reasons.length > 0 ? (
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {health.reasons.slice(0, 3).map((reason) => (
                <li key={reason.reason}>{reason.reason}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: '4px 0 0', color: theme.color.textMuted }}>No concern detected.</p>
          )}
        </div>
      </div>
      <div style={{ marginTop: theme.space(3) }}>
        <LvButton theme={theme} variant="secondary" size="sm" onClick={onOpenIntelligence}>
          Open Intelligence tab — drafts, summary, duplicates
        </LvButton>
      </div>
    </Section>
  );
};

// ---------------------------------------------------------------- timeline
const KIND_LABEL: Record<TimelineEntry['kind'], string> = {
  LEAD_CREATED: 'Lead',
  ASSIGNMENT: 'Assignment',
  INTERACTION: 'Interaction',
  TASK: 'Task',
  NOTE: 'Note',
  STATUS: 'Status',
  ONBOARDING: 'Onboarding',
  DOCUMENT: 'Document',
  SLA: 'SLA',
  AI_DECISION: 'AI decision',
  GOVERNANCE: 'Governance',
};

export const TimelineSection = ({ theme, model, onOpen, onLogInteraction }: { theme: LvTheme; model: Lead360Model; onOpen: (target: { object: string; recordId: string }) => void; onLogInteraction?: () => void }) => {
  const days = groupTimelineByDay(model.timeline, model.now);

  return (
    <Section theme={theme} title="Relationship timeline" count={model.timeline.length}>
      {model.timeline.length <= 1 && (
        <EmptyState
          theme={theme}
          quiet={false}
          title="No interactions yet"
          text="Start building the relationship by logging the first interaction."
          action={onLogInteraction ? <LvButton theme={theme} variant="primary" size="sm" onClick={onLogInteraction}>Log first interaction</LvButton> : undefined}
        />
      )}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
        {days.map((day) => (
          <li key={day.day}>
            <div style={{ ...theme.type.label, color: theme.color.brand, marginBottom: 6 }}>{day.label}</div>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderLeft: `2px solid ${theme.color.border}`, display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
              {day.entries.map((entry) => {
                const body = (
                  <>
                    <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
                      <Tag theme={theme} tone={entry.tone}>{KIND_LABEL[entry.kind]}</Tag>
                      <span style={{ fontWeight: theme.font.weight.medium }}>{entry.title}</span>
                      <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>{timeOfDay(entry.at)}</span>
                    </div>
                    {entry.detail && <div style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, marginTop: 2, overflowWrap: 'anywhere' }}>{entry.detail}</div>}
                  </>
                );

                return (
                  <li key={entry.id} style={{ paddingLeft: theme.space(3), position: 'relative' }}>
                    <span aria-hidden="true" style={{ position: 'absolute', left: -6, top: 8, width: 10, height: 10, borderRadius: 999, border: `2px solid ${theme.color.surface}`, background: entry.tone === 'danger' ? theme.color.danger : entry.tone === 'success' ? theme.color.success : entry.tone === 'warning' ? theme.color.warning : entry.kind === 'AI_DECISION' ? theme.color.accent : theme.color.brandMuted }} />
                    {entry.target ? (
                      <button type="button" onClick={() => onOpen(entry.target!)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box', fontFamily: theme.font.body, color: theme.color.text }}>
                        {body}
                      </button>
                    ) : (
                      <div>{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
    </Section>
  );
};

// ------------------------------------------------------------------- tasks
export const TasksSection = ({ theme, model, onComplete, onReschedule, onCreate, busy }: { theme: LvTheme; model: Lead360Model; onComplete: (task: TaskSummary) => void; onReschedule: (task: TaskSummary) => void; onCreate: () => void; busy: boolean }) => {

  return (
    <Section theme={theme} title="Open tasks & follow-ups" count={model.openTasks.length}>
      {model.openTasks.length === 0 ? <EmptyState theme={theme} text="No open tasks. The next action is clear or still to be set." /> : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
        {model.openTasks.map((task) => {
          const due = dueLabel(task.dueAt, model.now);

          return (
            <li key={task.id} style={{ background: theme.color.surfaceRaised, border: `1px solid ${theme.color.border}`, borderLeft: `3px solid ${due.tone === 'danger' ? theme.color.danger : due.tone === 'warning' ? theme.color.warning : theme.color.border}`, borderRadius: theme.radius.md, padding: theme.space(2), display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: theme.font.weight.medium, color: theme.color.heading }}>{task.title ?? 'Untitled task'}</div>
                <div style={{ ...theme.type.caption, color: due.tone === 'danger' ? theme.color.danger : theme.color.textMuted, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                  <span>{due.text}</span>
                  <span>· {task.assignee?.displayName ?? 'unassigned'}</span>
                  {task.priority && <LvStatusBadge theme={theme} kind="priority" value={task.priority} />}
                </div>
              </div>
              {model.capabilities.canCreateTask && (
                <div style={{ display: 'flex', gap: theme.space(1) }}>
                  <LvButton theme={theme} variant="secondary" size="sm" disabled={busy} onClick={() => onComplete(task)}>Done</LvButton>
                  <LvButton theme={theme} variant="ghost" size="sm" disabled={busy} onClick={() => onReschedule(task)}>Reschedule</LvButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {model.capabilities.canCreateTask && (
        <div style={{ marginTop: theme.space(2) }}><LvButton theme={theme} variant="secondary" size="sm" onClick={onCreate}>Create task</LvButton></div>
      )}
    </Section>
  );
};

// --------------------------------------------------------------------- SLA
export const SlaSection = ({ theme, model, onOpen }: { theme: LvTheme; model: Lead360Model; onOpen: (target: { object: string; recordId: string }) => void }) => {

  return (
    <Highlight theme={theme} active={model.attention.slaBreach} label="Service levels">
      <Section theme={theme} title="Service levels" count={model.slas.length} tone={model.attention.slaBreach ? 'danger' : undefined}>
        {model.slas.length === 0 && <EmptyState theme={theme} text="No open service-level clock on this lead." />}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
          {model.slas.map((sla) => {
            const breached = sla.breachedAt !== null || sla.status === 'BREACHED' || sla.status === 'ESCALATED';

            return (
              <li key={sla.id}>
                <button type="button" className="lv-row-hover" onClick={() => onOpen({ object: 'lvSla', recordId: sla.id })} style={{ background: theme.color.surfaceRaised, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: theme.space(2), width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap', fontFamily: theme.font.body, color: theme.color.text, minHeight: 44 }}>
                  <LvStatusBadge theme={theme} kind="sla" value={sla.status} />
                  <span style={{ flex: 1, minWidth: 160, fontWeight: theme.font.weight.medium }}>{sla.name ?? humanize(sla.rule)}</span>
                  <span style={{ ...theme.type.caption, color: breached ? theme.color.danger : theme.color.textMuted }}>{breached && sla.breachedAt ? `breached ${formatWhen(sla.breachedAt, model.now)}` : sla.dueAt ? `due ${formatWhen(sla.dueAt, model.now)}` : ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
    </Highlight>
  );
};

// ------------------------------------------------------------- onboarding
export const OnboardingSection = ({ theme, model, onOpenOnboarding, onStart, busy }: { theme: LvTheme; model: Lead360Model; onOpenOnboarding: () => void; onStart: () => void; busy: boolean }) => {
  const onboarding = model.onboarding;

  return (
    <Section theme={theme} title="Onboarding" actions={onboarding ? <LvStatusBadge theme={theme} kind="onboarding" value={onboarding.status} /> : undefined} hint={onboarding ? undefined : 'not started'}>
      {!onboarding && (
        <div>
          <p style={{ margin: 0, color: theme.color.textMuted }}>Onboarding has not started for this lead.</p>
          {model.capabilities.canWorkOnboarding && (
            <div style={{ marginTop: theme.space(2) }}><LvButton theme={theme} variant="primary" size="sm" disabled={busy} onClick={onStart}>Start onboarding</LvButton></div>
          )}
        </div>
      )}
      {onboarding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
          <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ ...theme.type.figure, fontSize: 22, color: theme.color.heading }}>{onboarding.completedSteps} / {onboarding.totalSteps}</span>
            <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>steps complete · {onboarding.progressPercentage ?? 0}%{onboarding.reviewer ? ` · reviewer ${onboarding.reviewer.displayName ?? ''}` : ''}</span>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={onboarding.progressPercentage ?? 0} aria-label="Onboarding progress" style={{ height: 6, borderRadius: 999, background: theme.color.surfaceSunken, overflow: 'hidden' }}>
            <div style={{ width: `${onboarding.progressPercentage ?? 0}%`, height: '100%', background: theme.color.brand, borderRadius: 999 }} />
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 4, fontSize: theme.font.size.sm }}>
            {onboarding.steps.map((step) => (
              <li key={step.step} style={{ color: step.isComplete ? theme.color.success : theme.color.textMuted }}>
                {step.isComplete ? '✓' : '○'} {step.label}{!step.isComplete && step.missingCount > 0 ? ` (${step.missingCount} missing)` : ''}
              </li>
            ))}
            <li style={{ color: onboarding.pendingDocuments === 0 && onboarding.documents.length > 0 ? theme.color.success : theme.color.textMuted }}>
              {onboarding.pendingDocuments === 0 && onboarding.documents.length > 0 ? '✓' : '○'} Documents {onboarding.documents.length - onboarding.pendingDocuments}/{onboarding.documents.length}
            </li>
          </ul>
          <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
            <LvButton theme={theme} variant="primary" size="sm" onClick={onOpenOnboarding}>{model.capabilities.canWorkOnboarding ? 'Continue onboarding' : 'View onboarding'}</LvButton>
          </div>
        </div>
      )}
    </Section>
  );
};

// -------------------------------------------------------------- documents
export const DocumentsSection = ({ theme, model, onView, onReview, viewing }: { theme: LvTheme; model: Lead360Model; onView: (documentId: string) => void; onReview: () => void; viewing: { id: string; url: string | null; error: string | null } | null }) => {
  const documents = model.onboarding?.documents ?? [];

  return (
    <Highlight theme={theme} active={model.attention.missingDocuments} label="Documents">
      <Section theme={theme} title="Documents" count={documents.length} tone={model.attention.missingDocuments ? 'warning' : undefined}>
        {documents.length === 0 && <EmptyState theme={theme} text={model.onboarding ? 'No documents uploaded yet.' : 'Documents appear once onboarding starts.'} />}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
          {documents.map((document) => (
            <li key={document.id} style={{ background: theme.color.surfaceRaised, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: theme.space(2) }}>
              <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: theme.font.weight.medium, overflowWrap: 'anywhere' }}>{document.name ?? humanize(document.documentType)}</div>
                  <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>
                    {humanize(document.documentType)}{document.expiresAt ? ` · expires ${document.expiresAt.slice(0, 10)}` : ''}{document.rejectionReason ? ` · ${document.rejectionReason}` : ''}
                  </div>
                </div>
                <LvStatusBadge theme={theme} kind="document" value={document.verificationState ?? 'PENDING'} />
                <LvButton theme={theme} variant="ghost" size="sm" onClick={() => onView(document.id)}>{viewing?.id === document.id ? 'Hide' : 'View'}</LvButton>
              </div>
              {viewing?.id === document.id && (
                <div style={{ marginTop: theme.space(2), fontSize: theme.font.size.sm }}>
                  {viewing.error && <span style={{ color: theme.color.danger }}>{viewing.error}</span>}
                  {!viewing.error && !viewing.url && <span style={{ color: theme.color.textMuted }}>Fetching a short-lived link…</span>}
                  {viewing.url && (
                    <a href={viewing.url} target="_blank" rel="noreferrer" style={{ color: theme.color.brand }}>Open / download (signed link, expires shortly)</a>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {model.onboarding && model.capabilities.canReviewDocuments && documents.length > 0 && (
          <div style={{ marginTop: theme.space(2) }}><LvButton theme={theme} variant="primary" size="sm" onClick={onReview}>Review documents</LvButton></div>
        )}
      </Section>
    </Highlight>
  );
};

// ------------------------------------------------------------------- notes
export const NotesSection = ({ theme, model, onAdd, onOpen }: { theme: LvTheme; model: Lead360Model; onAdd: () => void; onOpen: (target: { object: string; recordId: string }) => void }) => {

  return (
    <Section theme={theme} title="Internal notes" count={model.notes.length}>
      {model.notes.length === 0 && <EmptyState theme={theme} text="No internal notes yet." />}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
        {model.notes.map((note) => (
          <li key={note.id}>
            <button type="button" className="lv-row-hover" onClick={() => onOpen({ object: 'note', recordId: note.id })} style={{ background: theme.color.surfaceRaised, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: theme.space(2), width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: theme.font.body, color: theme.color.text }}>
              <div style={{ fontWeight: theme.font.weight.medium, color: theme.color.heading }}>{note.title ?? 'Untitled note'}</div>
              {note.body && <div style={{ ...theme.type.bodySmall, color: theme.color.textMuted, marginTop: 2, overflowWrap: 'anywhere' }}>{note.body.slice(0, 240)}</div>}
              <div style={{ ...theme.type.caption, color: theme.color.textSubtle, marginTop: 4 }}>{formatWhen(note.updatedAt, model.now)}</div>
            </button>
          </li>
        ))}
      </ul>
      {model.capabilities.canAddNote && (
        <div style={{ marginTop: theme.space(2) }}><LvButton theme={theme} variant="secondary" size="sm" onClick={onAdd}>Add note</LvButton></div>
      )}
    </Section>
  );
};

// -------------------------------------------------------------- ownership
export const AssignmentSection = ({ theme, model, onChange }: { theme: LvTheme; model: Lead360Model; onChange: () => void }) => {
  const owner = model.lead.owner;

  return (
    <Section theme={theme} title="Ownership">
      <div style={{ display: 'flex', gap: theme.space(3), alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: theme.font.weight.medium }}>{owner?.displayName ?? (model.lead.ownerId ? 'Team member' : 'Unassigned')}</div>
          <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>
            {owner?.email ?? ''}{model.lead.assignedAt ? ` · since ${model.lead.assignedAt.slice(0, 10)}` : ''}{model.caller.isOwner ? ' · you' : ''}
          </div>
        </div>
        {(model.capabilities.canChangeOwner || model.capabilities.canClaim) && (
          <LvButton theme={theme} variant="secondary" size="sm" onClick={onChange}>{model.capabilities.canChangeOwner ? 'Change owner' : 'Claim lead'}</LvButton>
        )}
      </div>
      {model.assignment.history.length > 0 && (
        <ul style={{ margin: `${theme.space(2)}px 0 0`, paddingLeft: 18, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
          {model.assignment.history.map((row) => (
            <li key={row.id}>
              {row.assignedAt?.slice(0, 10)} · {row.from?.displayName ?? 'unassigned'} → {row.to?.displayName ?? 'unassigned'} · {humanize(row.strategy)}{row.reason ? ` — ${row.reason}` : ''}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};

// -------------------------------------------------------------- lifecycle
export const LifecycleSection = ({ theme, model, onChangeStatus, onOpenGovernance }: { theme: LvTheme; model: Lead360Model; onChangeStatus: () => void; onOpenGovernance: () => void }) => {

  return (
    <Section theme={theme} title="Lifecycle">
      <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
        <LvStatusBadge theme={theme} kind="lead" value={model.lead.status} />
        <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted, flex: 1, minWidth: 200 }}>Every status change goes through the governed lifecycle route and is audited with your name.</span>
      </div>
      <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', marginTop: theme.space(2) }}>
        {model.capabilities.canChangeStatus && (
          <LvButton theme={theme} variant="primary" size="sm" onClick={onChangeStatus}>Change status</LvButton>
        )}
        {model.capabilities.canGovern && (
          <LvButton theme={theme} variant="ghost" size="sm" onClick={onOpenGovernance}>Archive · Mark duplicate · Reopen (Actions tab)</LvButton>
        )}
      </div>
    </Section>
  );
};
