import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useColorScheme, useRecordId } from 'twenty-sdk/front-component';

import { FC_LEAD_GOVERNANCE_ID } from 'src/constants/universal-identifiers';
import { LEAD_STATUS_LABELS, type LeadStatus } from 'src/modules/lv-core/constants/lead-lifecycle';
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
    <div style={{ ...s.page, padding: theme.space(3) }}>
      <style>{`.lv-gov button:focus-visible, .lv-gov input:focus-visible, .lv-gov select:focus-visible { outline: 2px solid ${theme.color.accent}; outline-offset: 2px; }`}</style>
      <div className="lv-gov" style={s.stack(3)}>
        <div>
          <h2 style={{ margin: 0, fontFamily: theme.font.display, fontSize: theme.font.size.lg, color: theme.color.brand }}>Lifecycle & governance</h2>
          <p style={{ margin: `${theme.space(1)}px 0 0`, color: theme.color.textMuted, fontSize: theme.font.size.sm }}>
            Records are never deleted by the team. Archive, close or mark a duplicate instead; every action is audited with who, what, when and why.
          </p>
        </div>

        {error && <div role="alert" style={{ ...s.card, border: `1px solid ${theme.color.danger}`, color: theme.color.danger }}>{error}</div>}
        {notice && <div role="status" style={{ ...s.card, border: `1px solid ${theme.color.success}`, color: theme.color.success }}>{notice}</div>}
        {isLoading && <p role="status" style={{ color: theme.color.textMuted }}>Loading…</p>}

        {!isLoading && lead && (
          <>
            <div style={{ ...s.card, display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm }}>Current status</span>
              <span style={s.badge(isClosedOrArchived(lead.status ?? '') ? 'neutral' : 'success')}>
                {lead.status ? LEAD_STATUS_LABELS[lead.status as LeadStatus] ?? lead.status : '—'}
              </span>
            </div>

            <div style={s.card}>
              <label htmlFor="lv-gov-reason" style={{ display: 'block', fontSize: theme.font.size.sm, marginBottom: 4 }}>
                Reason <span style={{ color: theme.color.textMuted }}>(required to close, mark duplicate, or delete)</span>
              </label>
              <input id="lv-gov-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} style={s.input} placeholder="Why is this happening?" />

              <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', marginTop: theme.space(3), alignItems: 'center' }}>
                {isClosedOrArchived(lead.status ?? '') ? (
                  <button type="button" onClick={() => void act('REOPEN')} disabled={busy !== null} style={s.button('primary')}>
                    {busy === 'REOPEN' ? 'Reopening…' : 'Reopen (back to Qualifying)'}
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => void act('ARCHIVE')} disabled={busy !== null} style={s.button('secondary')}>
                      {busy === 'ARCHIVE' ? 'Archiving…' : 'Archive (Dormant)'}
                    </button>
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <label htmlFor="lv-gov-close" style={{ fontSize: theme.font.size.sm }}>Close as</label>
                      <select id="lv-gov-close" value={closeStatus} onChange={(event) => setCloseStatus(event.target.value as LeadStatus)} style={{ ...s.input, width: 'auto', minHeight: 36 }}>
                        {CLOSING_STATUSES.map((status) => (
                          <option key={status} value={status}>{LEAD_STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => void act('CLOSE')} disabled={busy !== null || reason.trim().length < 3} style={s.button('secondary')}>
                        {busy === 'CLOSE' ? 'Closing…' : 'Close'}
                      </button>
                    </span>
                    <button type="button" onClick={() => void act('MARK_DUPLICATE')} disabled={busy !== null || reason.trim().length < 3} style={s.button('secondary')}>
                      {busy === 'MARK_DUPLICATE' ? 'Marking…' : 'Mark duplicate'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {canDestroy && impact && (
              <div style={{ ...s.card, border: `1px solid ${theme.color.danger}` }}>
                <h3 style={{ margin: `0 0 ${theme.space(1)}px`, fontSize: theme.font.size.md, color: theme.color.danger }}>Permanent deletion (Main Admin)</h3>
                <p style={{ margin: `0 0 ${theme.space(2)}px`, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
                  Irreversible, and deliberately not a one-click button. Your role holds the destroy permission; use the record menu to move the lead to the trash, then “Permanently destroy” it from the trash. Both steps are recorded in the audit log with your identity. Prefer Archive or Close.
                </p>
                <table style={{ borderCollapse: 'collapse', fontSize: theme.font.size.sm, marginBottom: theme.space(2) }}>
                  <caption style={{ textAlign: 'left', fontWeight: theme.font.weight.medium, marginBottom: 4 }}>
                    What depends on this lead ({dependentTotal} record{dependentTotal === 1 ? '' : 's'} would be destroyed or unlinked)
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{ textAlign: 'left', padding: '4px 8px 4px 0', borderBottom: `1px solid ${theme.color.border}` }}>Records</th>
                      <th scope="col" style={{ textAlign: 'right', padding: '4px 0', borderBottom: `1px solid ${theme.color.border}` }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(impact.dependents).map(([key, count]) => (
                      <tr key={key}>
                        <td style={{ padding: '4px 8px 4px 0' }}>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</td>
                        <td style={{ textAlign: 'right', fontFamily: theme.font.mono }}>{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
                  {impact.path.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
            {!canDestroy && (
              <p style={{ margin: 0, fontSize: theme.font.size.xs, color: theme.color.textMuted }}>
                Permanent deletion is reserved for the Main Admin role and is audited. Your role cannot delete records.
              </p>
            )}
          </>
        )}
        {!isLoading && !lead && !notice && <p role="status" style={{ color: theme.color.textMuted }}>This lead is not available.</p>}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_LEAD_GOVERNANCE_ID,
  name: 'lv-lead-governance',
  description: 'Archive, close, mark duplicate, reopen — and, for Main Admin only, an audited two-step permanent delete',
  component: LeadGovernance,
});
