# Security & RBAC

## Roles
Main Admin, Admin, Experience Hunter, Lead Coordinator, Onboarding Expert, Experience Team, Marketing, Operations, Management and future custom roles.

## Main Admin
Full system access including restricted destructive actions.

## Admin
Configurable administrative access.

## Experience Hunter
Create leads, view permitted leads, research, notes, problems and assigned work.

## Lead Coordinator
Contact leads, interactions, follow-ups, operational statuses, onboarding support and escalation.

## Onboarding Expert
Forms, documents, validation, partner communication and onboarding state.

## Security rules
- Enforce permissions server-side.
- UI filtering is never security.
- Destructive actions require authorization.
- Sensitive actions are auditable.
- API and UI must enforce the same rules.
- Privileged roles should use MFA.
- Exports must be controlled.
- Secrets never enter source control.

## Delete policy
Normal users archive/close/mark duplicate. Main Admin can permanently delete under controlled policy. Record who/what/when/reason and previous identifier where applicable.

## Audit
Ownership changes, critical status changes, permission changes, merges, deletions, exports, approvals/rejections, document verification and sensitive configuration changes.

---

# Implementation status (2026-09-10)

## Roles that now exist

Eight roles are defined in `packages/twenty-apps/internal/lavivenzia-crm/src/roles/`
and are live in the workspace. **Admin is deliberately not one of them** — Twenty
ships an `Admin` role and the manifest sync refuses a duplicate label
(`ROLE_LABEL_ALREADY_EXISTS`), so the built-in role fills that slot.

| Role | Settings | Update all | Soft delete | Destroy | May modify |
|---|---|---|---|---|---|
| Main Admin | yes | yes | yes | **yes** | everything |
| Admin *(Twenty built-in)* | yes | yes | yes | yes | everything |
| Experience Hunter | no | no | no | no | lvLead, task, note |
| Lead Coordinator | no | no | no | no | lvLead, lvInteraction, task, note |
| Onboarding Expert | no | no | no | no | lvOnboarding, lvOnboardingDocument, task, note |
| Operations | no | no | no | no | lvLead, lvInteraction, lvOnboarding, task, note |
| Experience Team | no | no | no | no | task, note |
| Marketing | no | no | no | no | note |
| Management | no | no | no | no | **nothing — read only** |
| La Vivenzia CRM automation | no | yes | no | no | records only, never deletes |

`canUpdateAllObjectRecords` is `false` for every non-admin role, so anything not
granted explicitly is refused by the server. Main Admin is the only role that can
permanently destroy a record, which is the delete policy above expressed in code.

## What is actually enforced, and how that was proven

Enforcement was verified against the live API with a real token, not by reading
code. Using the application token, which carries the automation role:

| Operation | Result |
|---|---|
| `destroyLvLead` | `PERMISSION_DENIED` / `FORBIDDEN` |
| `deleteLvLead` (soft) | `PERMISSION_DENIED` / `FORBIDDEN` |
| `updateLvLead` | succeeded — the engine needs it |
| `lvLead` (read) | succeeded |

Same token, same endpoint, four different outcomes: the permission engine is
deciding, not the UI.

## Row-level ownership — NOT enforced

`core.rowLevelPermissionPredicate` holds **0 rows**, and no LV role defines one.

This is not an oversight. In this Twenty version row-level predicates are gated
by a **billing entitlement** (`BillingEntitlementKey.RLS`); when that entitlement
is withdrawn, `billing-webhook-entitlement.service.ts` deletes every predicate
group in the workspace. Building ownership enforcement on a control that a
billing event can silently erase would be worse than not having it, because the
protection would appear to exist.

**The consequence, stated plainly: any authenticated workspace member can read
every lead, every onboarding submission and every partner document.** Object and
field permissions restrict *what operations* a role may perform; they do not
restrict *which rows* it sees.

Until this is resolved, do not treat the CRM as safe for partner identity
documents. The options are: purchase the entitlement and define predicates in
the manifest (the type already supports it — `RowLevelPermissionPredicateManifest`);
or enforce ownership in the application layer on every read path, which is
duplicated effort and easy to miss.

## Still outstanding

- Row-level ownership (above) — the single largest gap.
- MFA is not enforced for privileged roles.
- Export controls are not configured.
- No role is yet assigned to any human user; `roleTarget` bindings remain to be
  made by an administrator.
