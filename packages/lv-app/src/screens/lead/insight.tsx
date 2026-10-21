import { type Lead360, type DataQualityIssue, type ScoreFactor } from 'src/api/leads';
import { LvIcon } from 'src/design/icons';
import { LvAiUnavailable, LvConfidence } from 'src/design/intelligence';
import { EmptyState, formatWhen, LvBadge, LvButton, LvCard, Provenance, toneColour, toneWash, type Tone } from 'src/design/kit';
import { LvFactRow, LvSectionCard } from 'src/design/profile';
import { describeStatus } from 'src/design/status';
import { type LvTheme } from 'src/design/theme';
import { InsightDecisions } from 'src/screens/ask/insights';
import { sentenceCase } from 'src/screens/lead/header';

// Intelligence and governance.
//
// Both tabs show things the CRM worked out rather than things a person typed,
// so both are held to the same rule: say what was concluded, then show the
// evidence it was concluded from, and label where it came from. Every number
// on these two screens is computed by a rules engine on the server — none of
// it is a model's opinion, and the provenance chips say so.

type TabProps = { theme: LvTheme; data: Lead360; onAction: (action: 'interaction' | 'task' | 'note' | 'status') => void; onOpenTab: (tab: string) => void };

const HEALTH_TONE: Record<string, Tone> = {
  HEALTHY: 'success',
  WARM: 'success',
  COOLING: 'warning',
  AT_RISK: 'danger',
  STALLED: 'danger',
  COLD: 'danger',
  NEW: 'info',
};

const SEVERITY_TONE: Record<string, Tone> = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'neutral' };

const FactorList = ({ theme, factors, tone }: { theme: LvTheme; factors: ScoreFactor[]; tone: Tone }) => (
  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
    {factors.map((factor) => (
      <li key={`${factor.factor}-${factor.points}`} style={{ display: 'flex', alignItems: 'flex-start', gap: theme.space(3) }}>
        <span
          aria-hidden="true"
          style={{
            ...theme.type.caption,
            fontWeight: theme.font.weight.bold,
            minWidth: 40,
            textAlign: 'center',
            borderRadius: theme.radius.pill,
            padding: '2px 6px',
            background: toneWash(theme, tone),
            color: toneColour(theme, tone),
            flex: '0 0 auto',
          }}
        >
          {factor.points > 0 ? `+${factor.points}` : factor.points}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', ...theme.type.body, color: theme.color.heading }}>{factor.factor}</span>
          {/* The evidence, not a restatement of the label. A score you cannot
              audit is a score nobody will act on. */}
          <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted }}>{factor.evidence}</span>
        </span>
      </li>
    ))}
  </ul>
);

export const IntelligenceTab = ({ theme, data, onAction }: TabProps) => {
  const { intelligence, capabilities } = data;

  if (!capabilities.canViewIntelligence) {
    return (
      <LvSectionCard theme={theme} title="Intelligence" icon="sparkle">
        <EmptyState theme={theme} quiet={false} icon="info" tint="blue" title="Not available to your role" text="Scoring and relationship health are shown to the roles that own the pipeline." />
      </LvSectionCard>
    );
  }

  const { opportunity, health, dataQuality, nextBestAction } = intelligence;
  const healthTone = HEALTH_TONE[health.state ?? ''] ?? 'neutral';

  return (
    <>
      {/* What the CRM concluded, said once at the top. */}
      <div className="lv-two-col">
        <LvCard theme={theme}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.space(3), marginBottom: theme.space(3) }}>
            <h2 style={{ ...theme.type.heading, color: theme.color.heading, margin: 0 }}>Opportunity</h2>
            <Provenance theme={theme} source="rules" />
          </div>
          {opportunity.available ? (
            <>
              <p style={{ ...theme.type.figure, color: theme.color.heading, margin: 0, lineHeight: 1 }}>
                {opportunity.score}
                <span style={{ ...theme.type.body, color: theme.color.textMuted }}> / 100</span>
              </p>
              <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(2)}px 0 0` }}>
                {opportunity.score >= 70 ? 'High opportunity — worth prioritising.' : opportunity.score >= 40 ? 'Moderate opportunity.' : 'Low opportunity on what is recorded so far.'}
              </p>
            </>
          ) : (
            <LvAiUnavailable
              theme={theme}
              reason={opportunity.detail ?? 'Not enough is recorded to score this relationship.'}
              fallback={
                (opportunity.missing ?? []).length > 0
                  ? `Add ${(opportunity.missing ?? []).slice(0, 3).join(', ')} and the score becomes available.`
                  : undefined
              }
            />
          )}
        </LvCard>

        <LvCard theme={theme}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.space(3), marginBottom: theme.space(3) }}>
            <h2 style={{ ...theme.type.heading, color: theme.color.heading, margin: 0 }}>Relationship health</h2>
            <Provenance theme={theme} source="rules" />
          </div>
          <LvBadge theme={theme} tone={healthTone === 'neutral' ? 'neutral' : healthTone}>
            {sentenceCase(health.state) || 'Unassessed'}
          </LvBadge>
          {(health.reasons ?? []).length > 0 && (
            <ul style={{ margin: `${theme.space(3)}px 0 0`, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
              {(health.reasons ?? []).map((reason) => (
                <li key={reason.reason} style={{ display: 'flex', gap: theme.space(2), ...theme.type.bodySmall, color: theme.color.text }}>
                  <span aria-hidden="true" style={{ color: theme.color.warning, display: 'inline-flex', flex: '0 0 auto', marginTop: 2 }}>
                    <LvIcon name="warning" size={14} />
                  </span>
                  <span>
                    <strong style={{ color: theme.color.heading, fontWeight: theme.font.weight.medium }}>{reason.reason}</strong> — {reason.evidence}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {(health.positives ?? []).length > 0 && (
            <ul style={{ margin: `${theme.space(3)}px 0 0`, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
              {(health.positives ?? []).map((positive) => (
                <li key={positive.reason} style={{ display: 'flex', gap: theme.space(2), ...theme.type.bodySmall, color: theme.color.textMuted }}>
                  <span aria-hidden="true" style={{ color: theme.color.success, display: 'inline-flex', flex: '0 0 auto', marginTop: 2 }}>
                    <LvIcon name="check" size={14} />
                  </span>
                  <span>{positive.evidence}</span>
                </li>
              ))}
            </ul>
          )}
        </LvCard>
      </div>

      {/* Then the evidence it was concluded from. */}
      {opportunity.available && (opportunity.positive.length > 0 || opportunity.negative.length > 0) && (
        <LvSectionCard theme={theme} title="How the score was reached" icon="chart">
          <div className="lv-two-col">
            {opportunity.positive.length > 0 && (
              <div>
                <h3 style={{ ...theme.type.label, color: theme.color.success, margin: `0 0 ${theme.space(2)}px` }}>Adding to it</h3>
                <FactorList theme={theme} factors={opportunity.positive} tone="success" />
              </div>
            )}
            {opportunity.negative.length > 0 && (
              <div>
                <h3 style={{ ...theme.type.label, color: theme.color.danger, margin: `0 0 ${theme.space(2)}px` }}>Holding it back</h3>
                <FactorList theme={theme} factors={opportunity.negative} tone="danger" />
              </div>
            )}
          </div>
          {(opportunity.missing ?? []).length > 0 && (
            <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(4)}px 0 0` }}>
              Not yet recorded, so not counted either way: {(opportunity.missing ?? []).join(', ')}.
            </p>
          )}
        </LvSectionCard>
      )}

      {/* What should happen next, with its reason and the evidence behind it. */}
      {nextBestAction.primary && (
        <LvSectionCard theme={theme} title="Recommended next step" icon="sparkle">
          <p style={{ ...theme.type.subheading, fontSize: 17, color: theme.color.heading, margin: 0 }}>
            {nextBestAction.primary.title ?? sentenceCase(nextBestAction.primary.action)}
          </p>
          {nextBestAction.primary.reason && (
            <p style={{ ...theme.type.body, color: theme.color.text, margin: `${theme.space(2)}px 0 0` }}>{nextBestAction.primary.reason}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), flexWrap: 'wrap', marginTop: theme.space(3) }}>
            {nextBestAction.primary.deadlineLabel && (
              <LvBadge theme={theme} tone={nextBestAction.primary.priority === 'CRITICAL' ? 'danger' : 'info'}>
                {nextBestAction.primary.deadlineLabel}
              </LvBadge>
            )}
            <Provenance theme={theme} source="rules" />
          </div>
          {(nextBestAction.primary.evidence ?? []).length > 0 && (
            <ul style={{ margin: `${theme.space(3)}px 0 0`, paddingLeft: theme.space(4), display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(nextBestAction.primary.evidence ?? []).map((line) => (
                <li key={line} style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>
                  {line}
                </li>
              ))}
            </ul>
          )}
          {data.capabilities.canCreateTask && (
            <div style={{ marginTop: theme.space(4) }}>
              <LvButton theme={theme} variant="primary" size="sm" onClick={() => onAction('task')}>
                Schedule it
              </LvButton>
            </div>
          )}
        </LvSectionCard>
      )}

      {(nextBestAction.alternatives ?? []).length > 0 && (
        <LvSectionCard theme={theme} title="Other things worth doing" icon="task">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
            {(nextBestAction.alternatives ?? []).map((alternative, index) => (
              <li key={alternative.title ?? index} style={{ ...theme.type.body, color: theme.color.text }}>
                <strong style={{ color: theme.color.heading, fontWeight: theme.font.weight.medium }}>{alternative.title ?? sentenceCase(alternative.action)}</strong>
                {alternative.reason ? ` — ${alternative.reason}` : ''}
              </li>
            ))}
          </ul>
        </LvSectionCard>
      )}

      {/* What is wrong with the record, and exactly how to fix each one. */}
      <LvSectionCard
        theme={theme}
        title="Data quality"
        icon="info"
        action={typeof dataQuality.score === 'number' ? <LvConfidence theme={theme} value={dataQuality.score / 100} label="record completeness" /> : undefined}
      >
        {dataQuality.issues.length === 0 ? (
          <EmptyState theme={theme} text="Nothing is missing or malformed on this record." />
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
            {dataQuality.issues.map((issue: DataQualityIssue) => (
              <li key={issue.code} style={{ border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.lg, padding: theme.space(4) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), flexWrap: 'wrap' }}>
                  <span style={{ ...theme.type.subheading, fontSize: 15, color: theme.color.heading, flex: 1, minWidth: 0 }}>{issue.issue}</span>
                  <LvBadge theme={theme} tone={SEVERITY_TONE[issue.severity] === 'neutral' ? 'neutral' : (SEVERITY_TONE[issue.severity] ?? 'neutral')}>
                    {sentenceCase(issue.severity)}
                  </LvBadge>
                </div>
                <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(2)}px 0 0` }}>{issue.evidence}</p>
                <p style={{ ...theme.type.bodySmall, color: theme.color.text, margin: `${theme.space(1)}px 0 0` }}>
                  <strong style={{ color: theme.color.heading, fontWeight: theme.font.weight.medium }}>Fix:</strong> {issue.recommendedCorrection}
                </p>
              </li>
            ))}
          </ul>
        )}
      </LvSectionCard>
      {/* The suggestions the assistant has already produced about this
          relationship, and the one place any of them becomes a change.
          Loaded here rather than with the record: it is a second request
          behind a tab, and nobody pays for it until they look. */}
      <InsightDecisions theme={theme} leadId={data.lead.id} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Lifecycle and governance — who may do what, who did what, and what it costs
// ---------------------------------------------------------------------------
export const GovernanceTab = ({ theme, data, onAction }: TabProps) => {
  const { lead, capabilities, settableStatuses, slas, assignment, attention } = data;
  const status = describeStatus('lead', lead.status);

  const attentionFlags = [
    { key: 'overdueFollowUp', on: attention.overdueFollowUp, text: 'A follow-up is overdue.' },
    { key: 'slaBreach', on: attention.slaBreach, text: 'An SLA clock has breached or escalated.' },
    { key: 'missingDocuments', on: attention.missingDocuments, text: 'Documents are missing, rejected or expired.' },
    { key: 'noNextAction', on: attention.noNextAction, text: 'No next action is set.' },
    { key: 'noInteraction', on: attention.noInteraction, text: 'Nobody has logged a conversation yet.' },
  ].filter((flag) => flag.on);

  return (
    <>
      <LvSectionCard
        theme={theme}
        title="Lifecycle"
        icon="check"
        action={
          capabilities.canChangeStatus && settableStatuses.length > 0 ? (
            <LvButton theme={theme} variant="secondary" size="sm" onClick={() => onAction('status')}>
              Change the status
            </LvButton>
          ) : undefined
        }
      >
        <LvFactRow theme={theme} label="Current status">{status.label}</LvFactRow>
        <LvFactRow theme={theme} label="Priority">{sentenceCase(lead.priority) || 'Not set'}</LvFactRow>
        <LvFactRow theme={theme} label="Owner">{lead.owner?.displayName ?? 'Unassigned'}</LvFactRow>
        {lead.createdAt && <LvFactRow theme={theme} label="Created">{formatWhen(lead.createdAt, data.now)}</LvFactRow>}

        {/* The transitions the server will actually accept. A status that is
            not in this list cannot be set, so it is not offered. */}
        <div style={{ marginTop: theme.space(4) }}>
          <h3 style={{ ...theme.type.label, color: theme.color.textMuted, margin: `0 0 ${theme.space(2)}px` }}>
            {capabilities.canChangeStatus ? 'Allowed transitions' : 'Transitions (your role may not make them)'}
          </h3>
          {settableStatuses.length === 0 ? (
            <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>This relationship is closed; its status cannot move.</p>
          ) : (
            <ul style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
              {settableStatuses.map((candidate) => (
                <li
                  key={candidate}
                  style={{
                    ...theme.type.bodySmall,
                    color: theme.color.text,
                    background: theme.color.surfaceSunken,
                    border: `1px solid ${theme.color.border}`,
                    borderRadius: theme.radius.pill,
                    padding: `3px ${theme.space(3)}px`,
                    opacity: capabilities.canChangeStatus ? 1 : 0.6,
                  }}
                >
                  {describeStatus('lead', candidate).label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </LvSectionCard>

      {attentionFlags.length > 0 && (
        <LvSectionCard theme={theme} title="Why this record needs attention" icon="warning">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
            {attentionFlags.map((flag) => (
              <li key={flag.key} style={{ display: 'flex', gap: theme.space(3), alignItems: 'center', ...theme.type.body, color: theme.color.text }}>
                <span aria-hidden="true" style={{ color: theme.color.warning, display: 'inline-flex' }}>
                  <LvIcon name="warning" size={16} />
                </span>
                {flag.text}
              </li>
            ))}
          </ul>
        </LvSectionCard>
      )}

      {slas.length > 0 && (
        <LvSectionCard theme={theme} title="Service clocks" icon="clock">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
            {slas.map((sla) => (
              <li key={sla.id} style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 140, ...theme.type.body, color: theme.color.heading }}>{sla.name ?? sentenceCase(sla.rule)}</span>
                <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>
                  {sla.breachedAt ? `Breached ${formatWhen(sla.breachedAt, data.now)}` : sla.dueAt ? `Due ${formatWhen(sla.dueAt, data.now)}` : '—'}
                </span>
                <LvBadge theme={theme} tone={sla.breachedAt || sla.status === 'BREACHED' || sla.status === 'ESCALATED' ? 'danger' : 'info'}>
                  {sentenceCase(sla.status) || 'Open'}
                </LvBadge>
              </li>
            ))}
          </ul>
        </LvSectionCard>
      )}

      <LvSectionCard
        theme={theme}
        title="Ownership history"
        icon="person"
        action={
          capabilities.canChangeOwner || capabilities.canClaim ? (
            <LvButton theme={theme} variant="ghost" size="sm" onClick={() => onAction('status')}>
              {capabilities.canClaim ? 'Claim this lead' : 'Reassign'}
            </LvButton>
          ) : undefined
        }
      >
        {assignment.history.length === 0 ? (
          <EmptyState theme={theme} text="This relationship has not changed hands." />
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
            {assignment.history.map((entry) => (
              <li key={entry.id} style={{ ...theme.type.bodySmall, color: theme.color.text }}>
                <strong style={{ color: theme.color.heading, fontWeight: theme.font.weight.medium }}>
                  {entry.from?.displayName ?? 'Unassigned'} → {entry.to?.displayName ?? 'Unassigned'}
                </strong>
                {entry.reason ? ` · ${entry.reason}` : ''}
                {entry.at || entry.createdAt ? (
                  <span style={{ color: theme.color.textSubtle }}> · {formatWhen((entry.at ?? entry.createdAt) as string, data.now)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </LvSectionCard>

      {/* Permissions, stated rather than discovered by clicking a disabled
          button. This is the restricted state made legible. */}
      <LvSectionCard theme={theme} title="What your role may do here" icon="settings">
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
          {[
            { key: 'canEdit', label: 'Edit the record' },
            { key: 'canLogInteraction', label: 'Log interactions' },
            { key: 'canCreateTask', label: 'Create follow-ups' },
            { key: 'canAddNote', label: 'Add notes' },
            { key: 'canChangeStatus', label: 'Change the status' },
            { key: 'canChangeOwner', label: 'Reassign the owner' },
            { key: 'canReviewDocuments', label: 'Review documents' },
            { key: 'canViewIntelligence', label: 'See intelligence' },
          ].map((permission) => {
            const allowed = capabilities[permission.key] === true;

            return (
              <li
                key={permission.key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: theme.space(2),
                  ...theme.type.bodySmall,
                  color: allowed ? theme.color.text : theme.color.textSubtle,
                  background: allowed ? theme.tint.mint.wash : theme.color.surfaceSunken,
                  borderRadius: theme.radius.pill,
                  padding: `3px ${theme.space(3)}px`,
                }}
              >
                <span aria-hidden="true" style={{ display: 'inline-flex', color: allowed ? theme.tint.mint.ink : theme.color.textSubtle }}>
                  <LvIcon name={allowed ? 'check' : 'info'} size={13} />
                </span>
                {permission.label}
              </li>
            );
          })}
        </ul>
        <p style={{ ...theme.type.caption, color: theme.color.textMuted, margin: `${theme.space(3)}px 0 0` }}>
          Decided by the server from your role and your relationship to this record, as lens “{data.caller.lens}”.
        </p>
      </LvSectionCard>
    </>
  );
};
