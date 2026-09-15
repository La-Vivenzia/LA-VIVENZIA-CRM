import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useColorScheme, useRecordId } from 'twenty-sdk/front-component';

import { FC_LEAD_GOVERNANCE_ID } from 'src/constants/universal-identifiers';
import { LEAD_STATUS_LABELS, type LeadStatus } from 'src/modules/lv-core/constants/lead-lifecycle';
import { ErrorState, Field, InlineNotice, LoadingState, LvButton, LvCard, LvInput, LvPage, LvSelect, LvStatusBadge, PageHeader, Section } from 'src/modules/lv-core/ui/kit';
import { layout, themeFor } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';
import { CLOSING_STATUSES, isClosedOrArchived } from 'src/modules/lv-governance/services/governance';

// Lifecycle & governance actions on a lead: Archive, Close, Mark duplicate,
// Reopen — and, for the Main Admin only, the impact analysis for a permanent
// deletion. The buttons are a convenience; every action is decided again on
// the server (role permissions, CM-004, the governance policy, the audit row).
//
// Permanent deletion itself stays Twenty's native two-step path (trash, then
// permanently destroy), because an application function cannot destroy
// records; both steps are audited from the platform's events.

type LeadState = { id: string; name: string | null; status: string | null; lvLeadId: string | null };
type Dependents = Record<string, number>;

export const LeadGovernance = () => {
  const recordId = useRecordId();
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
  const s = useMemo(() => layout(theme), [theme]);
  const client = useMemo(() => new CoreApiClient(), []);

  const [lead, setLead] = useState<LeadState | null>(null);
  const [canDestroy, setCanDestroy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [closeStatus, setCloseStatus] = useState<LeadStatus>('LOST');
  const [impact, setImpact] = useState<{ dependents: Dependents; canDestroy: boolean; canSoftDelete: boolean; path: string[] } | null>(null);

  const load = useCallback(async () => {
    if (!recordId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.query({
        lvLead: { __args: { filter: { id: { eq: recordId } } }, id: true, name: true, status: true, lvLeadId: true },
      });

      setLead(((result as { lvLead?: LeadState | null }).lvLead ?? null) as LeadState | null);

      // Capability hint only — the platform enforces destroy permission itself
      // when the Main Admin uses Twenty's delete / permanently-destroy actions.
      const preflight = (await callRoute('/records/delete-impact', { object: 'lvLead', recordId })) as {
        canDestroy?: boolean;
        canSoftDelete?: boolean;
        dependents?: Dependents;
        path?: string[];
      };

      setCanDestroy(Boolean(preflight.canDestroy));
      setImpact({
        dependents: preflight.dependents ?? {},
        canDestroy: Boolean(preflight.canDestroy),
        canSoftDelete: Boolean(preflight.canSoftDelete),
        path: preflight.path ?? [],
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load this lead.');
    } finally {
      setIsLoading(false);
    }
  }, [client, recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: 'ARCHIVE' | 'CLOSE' | 'MARK_DUPLICATE' | 'REOPEN') => {
    if (!lead) {
      return;
    }

    setBusy(action);
    setError(null);
    setNotice(null);

    try {
      const result = (await callRoute('/leads/lifecycle', {
        leadId: lead.id,
        action,
        reason: reason.trim() || undefined,
        status: action === 'CLOSE' ? closeStatus : undefined,
      })) as { to?: string };

      setNotice(`Done — the lead is now ${String(result.to ?? '').toLowerCase().replace(/_/g, ' ')}. An audit entry was recorded.`);
      setReason('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The action was refused.');
    } finally {
      setBusy(null);
    }
  };

  const dependentTotal = impact ? Object.values(impact.dependents).reduce((sum, count) => sum + count, 0) : 0;

  return (
    <LvPage theme={theme} maxWidth={900} className="lv-gov">
      <div style={s.stack(3)}>
        <PageHeader theme={theme} eyebrow={lead?.lvLeadId ?? 'Lead'} title="Lifecycle & governance" subtitle="Records are never deleted by the team. Archive, close or mark a duplicate instead; every action is audited with who, what, when and why." />

        {error && <ErrorState theme={theme} text={error} />}
        {notice && (
          <InlineNotice theme={theme} tone="success">
            {notice}
          </InlineNotice>
        )}
        {isLoading && <LoadingState theme={theme} rows={2} label="Loading lead" />}

        {!isLoading && lead && (
          <>
            <Section theme={theme} title="Current status" actions={<LvStatusBadge theme={theme} kind="lead" value={lead.status} />}>
              <p style={{ ...theme.type.bodySmall, margin: 0, color: theme.color.textMuted }}>
                {isClosedOrArchived(lead.status ?? '') ? 'This lead is closed or archived. Reopening returns it to Qualifying.' : 'Open leads can be archived, closed with a reason, or marked as a duplicate.'}
              </p>
            </Section>

            <Section theme={theme} title="Take an action">
              <Field theme={theme} label="Reason" htmlFor="lv-gov-reason" help="Required to close, mark duplicate, or delete. Kept in the audit log.">
                <LvInput theme={theme} id="lv-gov-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Why is this happening?" />
              </Field>

              <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', marginTop: theme.space(3), alignItems: 'center' }}>
                {isClosedOrArchived(lead.status ?? '') ? (
                  <LvButton theme={theme} variant="primary" onClick={() => void act('REOPEN')} disabled={busy !== null} busy={busy === 'REOPEN'}>
                    Reopen (back to Qualifying)
                  </LvButton>
                ) : (
                  <>
                    <LvButton theme={theme} variant="secondary" onClick={() => void act('ARCHIVE')} disabled={busy !== null} busy={busy === 'ARCHIVE'}>
                      Archive (Dormant)
                    </LvButton>
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label htmlFor="lv-gov-close" style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>
                        Close as
                      </label>
                      <LvSelect theme={theme} id="lv-gov-close" value={closeStatus} onChange={(event) => setCloseStatus(event.target.value as LeadStatus)} style={{ width: 'auto', minHeight: 40 }}>
                        {CLOSING_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {LEAD_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </LvSelect>
                      <LvButton theme={theme} variant="secondary" onClick={() => void act('CLOSE')} disabled={busy !== null || reason.trim().length < 3} busy={busy === 'CLOSE'}>
                        Close
                      </LvButton>
                    </span>
                    <LvButton theme={theme} variant="danger" onClick={() => void act('MARK_DUPLICATE')} disabled={busy !== null || reason.trim().length < 3} busy={busy === 'MARK_DUPLICATE'}>
                      Mark duplicate
                    </LvButton>
                  </>
                )}
              </div>
            </Section>

            {canDestroy && impact && (
              <LvCard theme={theme} tone="danger" as="section" ariaLabel="Permanent deletion">
                <h3 style={{ ...theme.type.subheading, margin: `0 0 ${theme.space(1)}px`, color: theme.color.danger }}>Permanent deletion (Main Admin)</h3>
                <p style={{ ...theme.type.bodySmall, margin: `0 0 ${theme.space(2)}px`, color: theme.color.textMuted }}>
                  Irreversible, and deliberately not a one-click button. Your role holds the destroy permission; use the record menu to move the lead to the trash, then “Permanently destroy” it from the trash. Both steps are recorded in the audit log with your identity. Prefer Archive or Close.
                </p>
                <table style={{ ...theme.type.bodySmall, borderCollapse: 'collapse', marginBottom: theme.space(2) }}>
                  <caption style={{ textAlign: 'left', fontWeight: theme.font.weight.medium, marginBottom: 4 }}>
                    What depends on this lead ({dependentTotal} record{dependentTotal === 1 ? '' : 's'} would be destroyed or unlinked)
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{ ...theme.type.label, color: theme.color.textMuted, textAlign: 'left', padding: '4px 8px 4px 0', borderBottom: `1px solid ${theme.color.borderStrong}` }}>
                        Records
                      </th>
                      <th scope="col" style={{ ...theme.type.label, color: theme.color.textMuted, textAlign: 'right', padding: '4px 0', borderBottom: `1px solid ${theme.color.borderStrong}` }}>
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(impact.dependents).map(([key, count]) => (
                      <tr key={key}>
                        <td style={{ padding: '4px 8px 4px 0' }}>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</td>
                        <td style={{ ...theme.type.mono, textAlign: 'right' }}>{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ol style={{ ...theme.type.bodySmall, margin: 0, paddingLeft: 18, color: theme.color.textMuted }}>
                  {impact.path.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </LvCard>
            )}
            {!canDestroy && (
              <p style={{ ...theme.type.caption, margin: 0, color: theme.color.textMuted }}>
                Permanent deletion is reserved for the Main Admin role and is audited. Your role cannot delete records.
              </p>
            )}
          </>
        )}
        {!isLoading && !lead && !notice && (
          <p role="status" style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>
            This lead is not available.
          </p>
        )}
      </div>
    </LvPage>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_LEAD_GOVERNANCE_ID,
  name: 'lv-lead-governance',
  description: 'Archive, close, mark duplicate, reopen — and, for Main Admin only, an audited two-step permanent delete',
  component: LeadGovernance,
});
