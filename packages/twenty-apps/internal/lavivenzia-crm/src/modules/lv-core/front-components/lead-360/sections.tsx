import { type ReactNode } from 'react';

import {
  dueLabel,
  groupTimelineByDay,
  headerFields,
  humanize,
  onboardingStatusLabel,
  overviewWarnings,
  statusLabel,
  timeOfDay,
} from 'src/modules/lv-core/front-components/lead-360/lead-360-view';
import { type Lead360Model, type TaskSummary, type TimelineEntry } from 'src/modules/lv-core/services/lead-360';
import { type LvTheme, layout } from 'src/modules/lv-core/ui/theme';
import { EmptyState, Section, formatWhen } from 'src/modules/lv-dashboard/front-components/dashboard-kit';
import { DOCUMENT_VERIFICATION_STATE_LABELS, type DocumentVerificationState } from 'src/modules/lv-onboarding/constants/document-verification';

// The read-only building blocks of Lead 360. Each renders one slice of the
// server model and calls back for actions; none of them decides permissions —
// `capabilities` did that on the server — and none loads data of its own.

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const Tag = ({ theme, tone = 'neutral', children }: { theme: LvTheme; tone?: Tone; children: ReactNode }) => (
  <span style={{ ...layout(theme).badge(tone), fontFamily: theme.font.body, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{children}</span>
);

export const Highlight = ({ theme, active, children, label }: { theme: LvTheme; active: boolean; children: ReactNode; label: string }) => (
  <div
    data-attention={active ? 'true' : 'false'}
    aria-label={active ? `${label} — needs attention` : undefined}
    style={active ? { outline: `2px solid ${theme.color.accent}`, outlineOffset: 2, borderRadius: theme.radius.lg } : undefined}
  >
    {children}
  </div>
);

// ---------------------------------------------------------------- header
export const Header = ({ theme, model }: { theme: LvTheme; model: Lead360Model }) => {
  const s = layout(theme);
  const fields = headerFields(model);

  return (
    <header style={{ ...s.card, padding: theme.space(3), borderTop: `4px solid ${theme.color.brand}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: theme.font.mono, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>{model.lead.lvLeadId ?? 'LV ID pending'}</div>
          <h1 style={{ margin: 0, fontFamily: theme.font.display, fontSize: theme.font.size.xl, color: theme.color.brand, overflowWrap: 'anywhere' }}>{model.lead.name ?? 'Unnamed lead'}</h1>
          {model.lead.organisationName && <div style={{ fontSize: theme.font.size.md, color: theme.color.textMuted }}>{model.lead.organisationName}</div>}
        </div>
        <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
          <Tag theme={theme} tone="info">{statusLabel(model.lead.status)}</Tag>
          {model.lead.priority && <Tag theme={theme} tone={model.lead.priority === 'CRITICAL' || model.lead.priority === 'HIGH' ? 'danger' : 'neutral'}>{humanize(model.lead.priority)} priority</Tag>}
          <Tag theme={theme} tone={model.intelligence.health.state === 'HEALTHY' ? 'success' : model.intelligence.health.state === 'ATTENTION' ? 'warning' : model.intelligence.health.state === 'AT_RISK' ? 'danger' : 'neutral'}>{humanize(model.intelligence.health.state)}</Tag>
        </div>
      </div>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: `${theme.space(2)}px ${theme.space(3)}px`, margin: `${theme.space(3)}px 0 0` }}>
        {fields.map((field) => (
          <div key={field.key} style={{ minWidth: 0 }}>
            <dt style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{field.label}</dt>
            <dd style={{ margin: 0, fontSize: theme.font.size.sm, fontWeight: field.emphasis ? theme.font.weight.bold : theme.font.weight.regular, fontFamily: field.emphasis ? theme.font.mono : theme.font.body, color: field.tone === 'danger' ? theme.color.danger : field.tone === 'warning' ? theme.color.warning : field.tone === 'success' ? theme.color.success : theme.color.text, overflowWrap: 'anywhere' }}>
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
};

// ------------------------------------------------------------ action bar
export type ActionKey = 'EDIT' | 'OWNER' | 'STATUS' | 'PRIORITY' | 'INTERACTION' | 'TASK' | 'NOTE' | 'ONBOARDING' | 'DOCUMENTS' | 'MORE';

export const ActionBar = ({ theme, model, onAction, open }: { theme: LvTheme; model: Lead360Model; onAction: (action: ActionKey) => void; open: ActionKey | null }) => {
  const s = layout(theme);
  const { capabilities } = model;
  const button = (key: ActionKey, label: string, variant: 'primary' | 'secondary' = 'secondary') => (
    <button key={key} type="button" onClick={() => onAction(key)} aria-pressed={open === key} style={{ ...s.button(open === key ? 'primary' : variant), minHeight: 40 }}>
      {label}
    </button>
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
    actions.push(button('MORE', 'More actions'));
  }

  if (actions.length === 0) {
    return (
      <p role="status" style={{ margin: 0, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
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
  const s = layout(theme);
  const task = model.nextAction.task;
  const suggestion = model.nextAction.suggestion;
  const due = task ? dueLabel(task.dueAt, model.now) : null;

  return (
    <Highlight theme={theme} active={model.attention.overdueFollowUp || model.attention.noNextAction} label="Next action">
      <Section theme={theme} title="Next action" hint={task ? undefined : 'nothing scheduled'}>
        {task ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
            <div style={{ fontSize: theme.font.size.lg, fontFamily: theme.font.display, color: theme.color.text }}>{task.title ?? 'Untitled task'}</div>
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
                <button type="button" disabled={busy} onClick={() => onComplete(task)} style={s.button('primary')}>Complete</button>
                <button type="button" disabled={busy} onClick={() => onReschedule(task)} style={s.button('secondary')}>Reschedule / edit</button>
                {model.capabilities.canLogInteraction && (
                  <button type="button" disabled={busy} onClick={onLogInteraction} style={s.button('secondary')}>Create interaction</button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
            <p style={{ margin: 0, color: theme.color.textMuted }}>No next action scheduled.</p>
            {model.capabilities.canCreateTask && (
              <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
                <button type="button" disabled={busy} onClick={onAddAction} style={s.button('primary')}>+ Add next action</button>
              </div>
            )}
          </div>
        )}
        {suggestion && (
          <div style={{ marginTop: theme.space(3), paddingTop: theme.space(2), borderTop: `1px dashed ${theme.color.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
              <Tag theme={theme} tone={suggestion.priority === 'CRITICAL' || suggestion.priority === 'HIGH' ? 'danger' : suggestion.priority === 'MEDIUM' ? 'warning' : 'neutral'}>{suggestion.priority}</Tag>
              <Tag theme={theme} tone="info">Next best action · rules {model.intelligence.nextBestAction.rulesVersion}</Tag>
            </div>
            <div style={{ fontWeight: theme.font.weight.medium }}>{suggestion.title}</div>
            <div style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>{suggestion.reason} · suggested {suggestion.deadlineLabel.toLowerCase()}</div>
            {model.capabilities.canCreateTask && suggestion.proposedTask && !task && (
              <div>
                <button type="button" disabled={busy} onClick={onAcceptSuggestion} style={{ ...s.button('secondary'), minHeight: 36 }}>Make this the next action</button>
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
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: `${theme.space(2)}px ${theme.space(3)}px`, margin: 0 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ minWidth: 0 }}>
            <dt style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</dt>
            <dd style={{ margin: 0, fontSize: theme.font.size.sm, color: value ? theme.color.text : theme.color.textMuted, overflowWrap: 'anywhere' }}>{value ?? 'Not recorded'}</dd>
          </div>
        ))}
      </dl>
      {warnings.length > 0 && (
        <div style={{ marginTop: theme.space(3) }}>
          <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Data quality · {warnings.length} issue{warnings.length === 1 ? '' : 's'} · rules {model.intelligence.dataQuality.rulesVersion}
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
  const s = layout(theme);
  const { opportunity, health, nextBestAction, dataQuality } = model.intelligence;
  const cell = (label: string, value: ReactNode, tone?: Tone) => (
    <div style={{ ...s.card, padding: theme.space(2), minWidth: 0 }}>
      <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontFamily: theme.font.display, fontSize: theme.font.size.lg, color: tone === 'danger' ? theme.color.danger : tone === 'warning' ? theme.color.warning : tone === 'success' ? theme.color.success : theme.color.brand }}>{value}</div>
    </div>
  );

  return (
    <Section theme={theme} title="Intelligence" hint="computed by rules · AI on the Intelligence tab">
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
        <button type="button" onClick={onOpenIntelligence} style={{ ...s.button('secondary'), minHeight: 36 }}>
          Open Intelligence tab — drafts, summary, duplicates
        </button>
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
  const s = layout(theme);
  const days = groupTimelineByDay(model.timeline, model.now);

  return (
    <Section theme={theme} title="Relationship timeline" count={model.timeline.length}>
      {model.timeline.length <= 1 && (
        <div style={{ ...s.card, background: theme.color.surfaceRaised, padding: theme.space(3), marginBottom: theme.space(2) }}>
          <p style={{ margin: 0 }}>No interactions yet.</p>
          <p style={{ margin: '4px 0 0', color: theme.color.textMuted, fontSize: theme.font.size.sm }}>Start building the relationship by logging the first interaction.</p>
          {onLogInteraction && (
            <button type="button" onClick={onLogInteraction} style={{ ...s.button('primary'), marginTop: theme.space(2), minHeight: 36 }}>Log first interaction</button>
          )}
        </div>
      )}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
        {days.map((day) => (
          <li key={day.day}>
            <div style={{ fontFamily: theme.font.display, fontSize: theme.font.size.sm, color: theme.color.brand, letterSpacing: '0.04em', marginBottom: 6 }}>{day.label}</div>
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
                    <span aria-hidden="true" style={{ position: 'absolute', left: -6, top: 8, width: 10, height: 10, borderRadius: 999, background: entry.tone === 'danger' ? theme.color.danger : entry.tone === 'success' ? theme.color.success : entry.tone === 'warning' ? theme.color.warning : theme.color.brandMuted }} />
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
  const s = layout(theme);

  return (
    <Section theme={theme} title="Open tasks & follow-ups" count={model.openTasks.length}>
      {model.openTasks.length === 0 ? <EmptyState theme={theme} text="No open tasks. The next action is clear or still to be set." /> : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
        {model.openTasks.map((task) => {
          const due = dueLabel(task.dueAt, model.now);

          return (
            <li key={task.id} style={{ ...s.card, padding: theme.space(2), display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: theme.font.weight.medium }}>{task.title ?? 'Untitled task'}</div>
                <div style={{ fontSize: theme.font.size.xs, color: due.tone === 'danger' ? theme.color.danger : theme.color.textMuted }}>
                  {due.text} · {task.assignee?.displayName ?? 'unassigned'} · {humanize(task.priority)}
                </div>
              </div>
              {model.capabilities.canCreateTask && (
                <div style={{ display: 'flex', gap: theme.space(1) }}>
                  <button type="button" disabled={busy} onClick={() => onComplete(task)} style={{ ...s.button('secondary'), minHeight: 36, padding: `0 ${theme.space(2)}px` }}>Done</button>
                  <button type="button" disabled={busy} onClick={() => onReschedule(task)} style={{ ...s.button('secondary'), minHeight: 36, padding: `0 ${theme.space(2)}px` }}>Reschedule</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {model.capabilities.canCreateTask && (
        <button type="button" onClick={onCreate} style={{ ...s.button('secondary'), minHeight: 36, marginTop: theme.space(2) }}>+ Create task</button>
      )}
    </Section>
  );
};

// --------------------------------------------------------------------- SLA
export const SlaSection = ({ theme, model, onOpen }: { theme: LvTheme; model: Lead360Model; onOpen: (target: { object: string; recordId: string }) => void }) => {
  const s = layout(theme);

  return (
    <Highlight theme={theme} active={model.attention.slaBreach} label="Service levels">
      <Section theme={theme} title="Service levels" count={model.slas.length}>
        {model.slas.length === 0 && <EmptyState theme={theme} text="No open service-level clock on this lead." />}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
          {model.slas.map((sla) => {
            const breached = sla.breachedAt !== null || sla.status === 'BREACHED' || sla.status === 'ESCALATED';

            return (
              <li key={sla.id}>
                <button type="button" onClick={() => onOpen({ object: 'lvSla', recordId: sla.id })} style={{ ...s.card, padding: theme.space(2), width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap', fontFamily: theme.font.body, color: theme.color.text }}>
                  <Tag theme={theme} tone={breached ? 'danger' : sla.status === 'DUE_SOON' ? 'warning' : 'info'}>{humanize(sla.status)}</Tag>
                  <span style={{ flex: 1, minWidth: 160 }}>{sla.name ?? humanize(sla.rule)}</span>
                  <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>{breached && sla.breachedAt ? `breached ${formatWhen(sla.breachedAt, model.now)}` : sla.dueAt ? `due ${formatWhen(sla.dueAt, model.now)}` : ''}</span>
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
  const s = layout(theme);
  const onboarding = model.onboarding;

  return (
    <Section theme={theme} title="Onboarding" hint={onboarding ? onboardingStatusLabel(onboarding.status) : 'not started'}>
      {!onboarding && (
        <div>
          <p style={{ margin: 0, color: theme.color.textMuted }}>Onboarding has not started for this lead.</p>
          {model.capabilities.canWorkOnboarding && (
            <button type="button" disabled={busy} onClick={onStart} style={{ ...s.button('primary'), marginTop: theme.space(2), minHeight: 36 }}>Start onboarding</button>
          )}
        </div>
      )}
      {onboarding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
          <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: theme.font.display, fontSize: theme.font.size.lg, color: theme.color.brand }}>{onboarding.completedSteps} / {onboarding.totalSteps}</span>
            <span style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>steps complete · {onboarding.progressPercentage ?? 0}%{onboarding.reviewer ? ` · reviewer ${onboarding.reviewer.displayName ?? ''}` : ''}</span>
          </div>
          <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: theme.color.border, overflow: 'hidden' }}>
            <div style={{ width: `${onboarding.progressPercentage ?? 0}%`, height: '100%', background: theme.color.brand }} />
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
            <button type="button" onClick={onOpenOnboarding} style={{ ...s.button('primary'), minHeight: 36 }}>{model.capabilities.canWorkOnboarding ? 'Continue onboarding' : 'View onboarding'}</button>
          </div>
        </div>
      )}
    </Section>
  );
};

// -------------------------------------------------------------- documents
export const DocumentsSection = ({ theme, model, onView, onReview, viewing }: { theme: LvTheme; model: Lead360Model; onView: (documentId: string) => void; onReview: () => void; viewing: { id: string; url: string | null; error: string | null } | null }) => {
  const s = layout(theme);
  const documents = model.onboarding?.documents ?? [];
  const tone = (state: string | null): Tone => (state === 'VERIFIED' ? 'success' : state === 'REJECTED' || state === 'EXPIRED' ? 'danger' : state === 'NEEDS_REPLACEMENT' ? 'warning' : 'info');

  return (
    <Highlight theme={theme} active={model.attention.missingDocuments} label="Documents">
      <Section theme={theme} title="Documents" count={documents.length}>
        {documents.length === 0 && <EmptyState theme={theme} text={model.onboarding ? 'No documents uploaded yet.' : 'Documents appear once onboarding starts.'} />}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
          {documents.map((document) => (
            <li key={document.id} style={{ ...s.card, padding: theme.space(2) }}>
              <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: theme.font.weight.medium, overflowWrap: 'anywhere' }}>{document.name ?? humanize(document.documentType)}</div>
                  <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted }}>
                    {humanize(document.documentType)}{document.expiresAt ? ` · expires ${document.expiresAt.slice(0, 10)}` : ''}{document.rejectionReason ? ` · ${document.rejectionReason}` : ''}
                  </div>
                </div>
                <Tag theme={theme} tone={tone(document.verificationState)}>{document.verificationState ? DOCUMENT_VERIFICATION_STATE_LABELS[document.verificationState as DocumentVerificationState] ?? humanize(document.verificationState) : 'Pending'}</Tag>
                <button type="button" onClick={() => onView(document.id)} style={{ ...s.button('secondary'), minHeight: 36, padding: `0 ${theme.space(2)}px` }}>{viewing?.id === document.id ? 'Hide' : 'View'}</button>
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
          <button type="button" onClick={onReview} style={{ ...s.button('primary'), minHeight: 36, marginTop: theme.space(2) }}>Review documents</button>
        )}
      </Section>
    </Highlight>
  );
};

// ------------------------------------------------------------------- notes
export const NotesSection = ({ theme, model, onAdd, onOpen }: { theme: LvTheme; model: Lead360Model; onAdd: () => void; onOpen: (target: { object: string; recordId: string }) => void }) => {
  const s = layout(theme);

  return (
    <Section theme={theme} title="Internal notes" count={model.notes.length}>
      {model.notes.length === 0 && <EmptyState theme={theme} text="No internal notes yet." />}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
        {model.notes.map((note) => (
          <li key={note.id}>
            <button type="button" onClick={() => onOpen({ object: 'note', recordId: note.id })} style={{ ...s.card, padding: theme.space(2), width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: theme.font.body, color: theme.color.text }}>
              <div style={{ fontWeight: theme.font.weight.medium }}>{note.title ?? 'Untitled note'}</div>
              {note.body && <div style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, marginTop: 2, overflowWrap: 'anywhere' }}>{note.body.slice(0, 240)}</div>}
              <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>{formatWhen(note.updatedAt, model.now)}</div>
            </button>
          </li>
        ))}
      </ul>
      {model.capabilities.canAddNote && (
        <button type="button" onClick={onAdd} style={{ ...s.button('secondary'), minHeight: 36, marginTop: theme.space(2) }}>+ Add note</button>
      )}
    </Section>
  );
};

// -------------------------------------------------------------- ownership
export const AssignmentSection = ({ theme, model, onChange }: { theme: LvTheme; model: Lead360Model; onChange: () => void }) => {
  const s = layout(theme);
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
          <button type="button" onClick={onChange} style={{ ...s.button('secondary'), minHeight: 36 }}>{model.capabilities.canChangeOwner ? 'Change owner' : 'Claim lead'}</button>
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
  const s = layout(theme);

  return (
    <Section theme={theme} title="Lifecycle">
      <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
        <Tag theme={theme} tone="info">{statusLabel(model.lead.status)}</Tag>
        <span style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, flex: 1, minWidth: 200 }}>Every status change goes through the governed lifecycle route and is audited with your name.</span>
      </div>
      <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', marginTop: theme.space(2) }}>
        {model.capabilities.canChangeStatus && (
          <button type="button" onClick={onChangeStatus} style={{ ...s.button('primary'), minHeight: 36 }}>Change status</button>
        )}
        {model.capabilities.canGovern && (
          <button type="button" onClick={onOpenGovernance} style={{ ...s.button('secondary'), minHeight: 36 }}>Archive · Mark duplicate · Reopen (Actions tab)</button>
        )}
      </div>
    </Section>
  );
};
