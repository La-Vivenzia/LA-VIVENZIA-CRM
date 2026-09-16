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

---

# Document security (2026-09-10, Remediation 2)

Verified against the live routes, not read from source.

| Attempt | Result |
|---|---|
| No token | refused — "Missing authentication token" |
| Invalid token | refused — "Token invalid." |
| Executable declared as PDF | refused — `UNSUPPORTED_TYPE` |
| 20 MB file (limit 15 MB) | refused — `TOO_LARGE` |
| `filePath: ../../../etc/passwd` | refused — `UNSAFE_PATH` |
| Unknown document type | refused |
| Onboarding id that does not exist | refused — `ONBOARDING_NOT_FOUND` |
| Verify with no named human | refused — `ACTOR_REQUIRED` |
| Skip review (PENDING → VERIFIED) | refused — `NOT_ALLOWED` |
| Approve with no named human | refused — `ACTOR_REQUIRED` |

Authentication is enforced by the platform (`isAuthRequired: true`) before any
handler runs. A null `userWorkspaceId` means an authenticated *non-human*
caller — an API key or integration — which is recorded, not refused; the
human-only rule is enforced by the state machine's actor requirement.

**Type checking is by content, not extension.** Twenty sniffs magic bytes, so a
renamed executable is identified as what it is. The allowlist (PDF/JPEG/PNG/
WEBP, 15 MB) is La Vivenzia's, applied server-side in the register route.

**Private storage stays private.** Preview uses short-lived signed URLs fetched
only when a reviewer opens a document. No object is made public, and no R2
credential reaches the browser.

## Still not enforced

- **Row-level ownership** — unchanged from Remediation 1 and still the largest
  gap. Any authenticated member can read every onboarding and every document.
  A reviewer is *recorded*, but nothing stops a different member acting.
- **Cross-onboarding document access** — a document is bound to its onboarding
  at registration, but reads are not scoped per onboarding. This is the same
  row-level gap, and it matters most here because these are identity papers.
- **Reviewer entitlement** — the routes accept any authenticated caller with a
  `workspaceMember` id. Restricting the *reviewer* role specifically needs
  either row-level predicates or an explicit check against `roleTarget`.
- **Antivirus scanning** — partners upload arbitrary files within the allowed
  types. Nothing scans them.

---

# Remediation 3 (2026-09-11): row-level access without a paid feature

**Row-level ownership is now enforced server-side, in the ORM, using no
Enterprise code.** See CORE-MODIFICATIONS.md CM-004 for the mechanism and why it
had to live in core. This section records what is enforced and how it was proven.

## The access model as enforced

| Role | Row visibility | May write |
|---|---|---|
| Main Admin | all rows | everything, incl. destroy |
| Admin *(Twenty built-in)* | all rows (not governed) | everything |
| Operations | all rows | lvLead, lvInteraction, lvOnboarding, task, note |
| Management | all rows | **nothing** |
| Experience Hunter | own leads (+ unassigned) | lvLead, task, note |
| Lead Coordinator | own leads (+ unassigned) | lvLead, lvInteraction, task, note |
| Onboarding Expert | onboardings they review (+ unassigned) and **those onboardings' documents** | lvOnboarding, lvOnboardingDocument, task, note |
| Experience Team | own rows | task, note |
| Marketing | own rows | note |

Two layers, each enforced by the server:
- **Object permissions** (Twenty, free) decide *what operations* a role may perform.
- **CM-004 scoping** decides *which rows* a governed role can see at all.

A document is scoped **through its onboarding**. A reviewer who cannot open the
onboarding cannot reach its papers by guessing a file id, through a list, or by
direct mutation — all three proven live.

## Actor identity — the client is no longer trusted

Every route now takes the acting member from `event.workspaceMemberId`, which
the platform resolves from the session. Body fields named `actorWorkspaceMemberId`,
`reviewerWorkspaceMemberId` or `uploadedByWorkspaceMemberId` are ignored for
identity. Proven live: a body claiming to be Jony, sent from Tim's session,
recorded **Tim** in the response, the database row and the audit trail.

## Reviewer entitlement

A human-only decision (verify, reject, approve, request changes) on a record that
has an assigned reviewer may be made **only by that reviewer** —
`NOT_THE_REVIEWER` otherwise. The recorded reviewer is authoritative; a request
may propose one only when none is recorded, and only the authenticated actor.

## System side-effects vs human actions

Functions triggered by a person run with **that person's** permissions by default
(Twenty's delegated token). That is right for the routes — authorization binds
where a human acts — and wrong for system side-effects, which the person's role
usually cannot perform. So:

| Function | Runs as | Why |
|---|---|---|
| `/onboarding/documents/register`, `/review`, `/onboarding/transition` | the caller | a person is acting; their permissions must apply |
| `lv-on-lead-created`, `lv-on-interaction-created`, `lv-on-onboarding-updated`, `lv-expire-documents` | the application | routing, history, notifications and mirrors are system writes |

`lv-on-onboarding-updated` is new: it mirrors onboarding status onto the lead,
because a reviewer approving an onboarding cannot write the lead themselves.

## What was proven live (real sessions, real API, non-destructive fixtures)

| Suite | Result |
|---|---|
| Scope matrix — Experience Hunter vs another member's lead/onboarding/document | **13/13** |
| Impersonation — body claims another member on review, transition, upload | **8/8** |
| Scoped creator — Hunter creates a lead; assignment, history, notification complete | **5/5** |
| Regression — full R1+R2 end-to-end with a human approver | **29/29** |

## Still outstanding

- **Two-actor mutual test.** Only one dev user carries a known password. A
  second session would let Jony be a live actor rather than a passive owner.
- **Reviewer role vs record reviewer.** Entitlement is by *assigned reviewer*;
  an Onboarding Expert not assigned to a record cannot act on it, which is the
  intended behaviour. Admins who wish to review must assign themselves first
  (which leaves an audit trail).
- **Onboarding Expert cannot upload.** By design — partners upload via the
  wizard's application token. If a reviewer must upload a replacement on a
  partner's behalf, that needs a decision.
- **Management is read-only by object permission**, so wide visibility cannot
  be turned into a write.
- MFA for privileged roles and export controls remain unconfigured.

## How an administrator assigns roles

Settings → Members → member → Role, or `updateWorkspaceMemberRole(workspaceMemberId, roleId)`
on `/metadata` with an administrator's **session** (an API key is refused, and
nobody can change their own role). Both invalidate the role cache correctly;
a direct database update does not.


## Notifications (Day 4A)

- `lvNotification` is row-scoped by CM-004 on `recipientId`, with NULL never
  visible. Verified live: a Hunter cannot list, fetch by id, or mark read a
  reviewer's notification; an unscoped Main Admin can read all.
- Recipients are resolved server-side from the record (owner, reviewer,
  assignee, mention). `recipientId` / `actorId` / `ownerId` in a request body
  are never identity. The actor is the event's `workspaceMemberId` or the
  route session; the actor is never notified about their own action.
- Each recipient is linked to a record they can open under CM-004. The
  previous owner of a reassigned lead is deliberately **not** notified: they
  can no longer open the lead, so any link would reveal a record they cannot
  access.
- Read-state changes go through routes that take the actor from the session
  and write with the application role, confined to the actor's own rows. API
  keys are refused (`NOT_AUTHENTICATED`).
- Audit: `triggeredBy`, `sourceEvent`, `createdBy`, `readAt`, `emailStatus`
  live on the row. No separate audit row per read — that would be the noisy
  duplicate the brief warns against.


## SLAs (Day 4B)

- `lvSla` is row-scoped by CM-004 on `ownerId` (NULL visible, like an
  unassigned lead). Verified live: Hunter A cannot read reviewer C's SLA by id
  or list; C cannot read A's; an unscoped Main Admin sees all.
- No LV team role can create or update `lvSla`. Verified live: a Hunter's
  `updateLvSla(status: RESOLVED)` on their own SLA and `ownerId` takeover of
  another's are both refused; `createLvSla` with a client-supplied owner is
  refused. State changes happen only through the application role from
  server events and the evaluator.
- Owner, escalation owner and recipients are resolved server-side (record
  owner / reviewer; `LV_ESCALATION_OWNER_EMAIL` → workspace member). Nothing
  in a request body names them.
- Running the evaluator on demand requires the WORKFLOWS settings permission
  (Twenty's `executeOneLogicFunction` guard); a governed user is refused.


## Dashboards, Control Tower and governance (Day 5)

- Dashboard and Control Tower routes derive **who** is asking from the
  delegated session token (`currentUser.workspaceMember`) and **what they may
  see** from the caller's real `permissionFlags` / `objectPermissions`. The
  request body can ask for a lens or filters — never for an identity, a role or
  an `isAdmin` flag. A Hunter requesting the ADMIN lens receives HUNTER. API
  keys are refused (`NOT_AUTHENTICATED`). Verified live.
- Every aggregate runs with the caller's token, so CM-004 row scoping and object
  permissions apply to each COUNT / GROUP BY / list. A personal dashboard
  therefore cannot reveal another member's leads, onboardings, interactions,
  SLAs or notifications, whatever filter is sent. Verified live for an
  Experience Hunter and an Onboarding Expert against a Main Admin's fixtures.
- `POST /control-tower/summary` refuses any caller without the administrator
  settings permission (`NOT_AUTHORIZED`) before running a query. The sidebar
  entry is shared workspace metadata and remains visible to every role
  (LIMITATION — Twenty has no per-role navigation); the API is what is
  protected, and the page renders an "Administrators only" state with no data.
  Verified by direct API call and in a real browser as a Hunter.
- **Destructive actions.** No LV team role holds soft-delete or destroy on LV
  objects; only Main Admin does. Verified live: a Hunter's `deleteLvLead` and
  `destroyLvLead` are refused by the platform. The team uses lifecycle actions
  (`POST /leads/lifecycle`: archive → DORMANT, close → LOST or a specific
  closing status, mark duplicate → DUPLICATE, reopen → QUALIFYING), each an
  ordinary update the role already permits and CM-004 already scopes, each
  written to `lvAuditEvent` with the actor from the session, the target,
  timestamp, reason and outcome (applied or refused).
- **Permanent delete cannot be performed by an application function.** A
  delegated token acts as *user ∩ application role*, and the application role
  deliberately has neither destroy nor soft-delete; a route calling
  `destroyLvLead` was refused even for a Main Admin. Granting destroy to the
  application role would let every function destroy. So permanent deletion is
  Twenty's native two-step path (Delete → trash → Permanently destroy), gated
  by the Main Admin role and an explicit confirmation, and audited from the
  platform's `*.deleted` / `*.restored` / `*.destroyed` events with the actor
  from the event. `POST /records/delete-impact` shows the Main Admin the
  dependent counts first and deletes nothing. Verified live: trash → restore →
  destroy by a Main Admin produced TRASH / RESTORE / PERMANENT_DELETE audit
  rows naming the admin.
- Server-side errors are logged with the caller id; the client receives a
  generic message.


## AI intelligence and Copilot (Day 6)

- Identity is the session. Every AI route (`/ai/lead/insights`,
  `/ai/lead/generate`, `/ai/insight/decide`, `/ai/briefing`, `/copilot/ask`,
  `/copilot/confirm`) refuses API keys (`NOT_AUTHENTICATED`) and takes the
  actor from the delegated token; a body may name a lead, a question, a
  decision — never a member, a role or an `isAdmin` flag. "Act as admin" in a
  Copilot question is refused with an explanation, not honoured.
- The lead is loaded with the caller's own token before anything else, so a
  lead CM-004 hides is `NOT_FOUND` for insights, generation, decisions and
  Copilot record questions alike (verified live: Onboarding Expert vs a
  Hunter's lead).
- The AI bookkeeping objects (`lvAiInsight`, `lvAiRun`, `lvProblem`) carry no
  row scoping, so every team role is **denied** direct read / write on them
  by object permission (`roles/ai-private-objects.ts`); the Main Admin keeps
  access for audit. Routes read and write them with the application role
  only after proving lead access. Verified live: a Hunter's direct
  `lvAiInsights` query and an Onboarding Expert's `lvAiRuns` query are
  refused by the platform.
- AI never writes CRM records. A suggestion becomes a change only through
  `/ai/insight/decide`, which performs the write with the **reviewer's own
  token** (category, task, interaction fields, DUPLICATE marking, onboarding
  answers), so the role's permission and CM-004 decide, and records
  reviewer / time / decision on the insight. Permanent delete, merge
  (field-level), approve / reject, reassignment, pricing and sending are
  not available to the AI layer at all; the Copilot answers such requests
  with the human path.
- Copilot queries are allowlisted plans (objects, fields, operators, enum
  vocabularies, limit ≤ 25) validated server-side; member filters accept
  only "me" / "none", resolved to the caller inside the server. A plan that
  names an id, a name, a join or an unknown field is refused before any
  query runs. The query executes with the caller's token — never as an
  admin filtered afterwards.
- Copilot writes are proposals stored with the proposing actor; only that
  actor can confirm, once, within 15 minutes, and the task / note is created
  with their token.
- Model context is minimised: no email / phone values, no member ids, no
  raw capture text, no provenance JSON, no documents, no secrets. The API
  key is a secret application variable read only inside logic functions.

## Lead 360 and relationship operations (Day 7)

- Lead 360 (`POST /leads/360`) reads every record **as the caller**. A lead the
  caller cannot open under CM-004 is `NOT_FOUND` — for the page and for every
  mutation route below. An API key (no session member) is `NOT_AUTHENTICATED`.
- The page renders only the actions the server returned in `capabilities`,
  which are derived from the platform's own answers (`currentUser` object
  permissions, the WORKSPACE settings flag) and the record (ownership,
  closed/archived, assigned reviewer). The UI is a convenience; every route
  re-decides with the same inputs and the platform enforces the write.
- **Identity is never taken from the body.** `/interactions/log`,
  `/tasks/create`, `/tasks/update`, `/notes/create`, `/leads/lifecycle` and
  `/leads/assign` use `event.workspaceMemberId`; `actorId`, `workspaceMemberId`,
  `reviewerId` and `ownerId`-as-identity in a body are ignored. Proven live:
  a body claiming the coordinator, sent from the hunter's session, records the
  **hunter** on the interaction row and in the audit row.
- `lv-on-interaction-created` now corrects `actorId` on any interaction row to
  the session member that triggered the event, so the native record editor and
  the API cannot attribute a contact to someone else either. Two exceptions:
  rows created by integrations (no session member) keep what they carried, and
  a workspace administrator (WORKSPACE settings flag) may attribute a contact
  to a colleague explicitly — back-filling a call someone else made — because
  an admin is unscoped and audited, so there is nothing to gain by lying.
- **Status changes go through the governed lifecycle route only.**
  `SET_STATUS` may target the main flow (minus the onboarding-mirrored states
  ONBOARDING_INITIATED … LIVE_ACTIVE, which only `lv-on-onboarding-updated`
  sets) and the holding states FOLLOW_UP_LATER / NO_RESPONSE. Closing,
  duplicate and archive keep their own actions and reason rules. A closed lead
  must be reopened first. Every change is a STATUS_CHANGE audit row.
- **Ownership policy** (`assignment-policy.ts`): an administrator may reassign
  any lead they can see; the current owner may hand over or release their own
  lead; a lead-writer may claim an unassigned lead **for themselves only**. The
  update is made as the caller, so CM-004 still applies; a MANUAL
  `lvAssignmentHistory` row and an OWNER_CHANGE audit row are written. The
  existing `lvLead.updated` hook notifies the new owner and re-evaluates SLAs.
- **Experience Hunter and interactions.** The role has no lvInteraction write.
  Working a lead includes recording the contact, so `/interactions/log` lets a
  lead-writer log an interaction on a lead they can see: the row is written
  with the application role carrying the session actor, only after the
  delegated read proved the lead is theirs. The audit row records
  `writtenAs: application-for-lead-writer`. Roles with lvInteraction write
  (Coordinator, Operations, Admin) create the row delegated. This is the one
  place the role table above is widened, and it is route-enforced, not a role
  change.
- Tasks and notes are Twenty's own objects created as the caller (task / note
  permission binds); `/tasks/update` additionally requires the task to be
  attached to the lead being viewed, so a guessed task id cannot be completed
  through another lead.
- Documents keep the short-lived signed file URL: Lead 360 fetches
  `lvOnboardingDocument.file` only when a person opens a document, as that
  person. The bucket is never exposed.
- Onboarding visibility on Lead 360 follows CM-004 for lvOnboarding: an
  Onboarding Expert who is not the lead's owner does not get the lead page at
  all (the onboarding record page, reached from notifications and the
  Onboarding list, is theirs); a Hunter sees the onboarding on their lead only
  while it has no reviewer or they are the reviewer. This is deliberate — the
  page does not read onboarding with the application role to widen it.

## Universal lead capture (Day 8)

- The five capture routes (`/capture/extract`, `/capture/preflight`,
  `/capture/create`, `/capture/import/inspect|validate|commit`) are
  session-only: an API key is `NOT_AUTHENTICATED`. The actor comes from the
  session; `actorId`, `workspaceMemberId`, `ownerId`, `reviewerId` in a body are
  never read (`readCaptureInput`). Proven live: a Hunter's body naming the
  admin as `ownerId` / `actorWorkspaceMemberId` creates the lead owned by the
  **Hunter**.
- **Assigning a colleague at capture is an administrator's call.** `assignment
  { mode: 'MEMBER', memberId }` for anyone but the caller is refused for a
  non-admin with `POLICY` before anything is written, and audited
  `ASSIGNMENT_CHANGED : REFUSED`. `SELF` (claim) is open to every lead-writer.
  ENGINE leaves routing to `lv-on-lead-created`, so the history strategy is the
  engine's own. An owner set at creation for someone else is notified through
  the Day 4 intents and dispatcher (`notifyOwnerAssignedAtCapture`) — the
  one place besides `lv-on-lead-updated` that tells a person they own a lead,
  because creation-with-owner never passes through `lvLead.updated`.
- The lead is created **as the caller**: a role without `lvLead` update
  permission (Onboarding Expert) is refused by the platform (`NOT_PERMITTED`),
  and CM-004 scopes the duplicate check, the import's CRM comparison and the
  Lead 360 hand-off. The LV ID is allocated synchronously by the server.
- **Duplicate gate on the server.** A create without a duplicate decision is
  re-scanned; candidates → `DUPLICATE_UNDECIDED`, audited
  `DUPLICATE_DETECTED : REFUSED`. The decision (CREATE_NEW / IGNORED) is
  audited and stored as a Day 6 DUPLICATE insight with the pair fingerprint.
  Merging stays on the existing lead's Intelligence tab under its owner's or an
  admin's permissions — the capture screen never merges.
- **Idempotency.** `lvLead.captureKey` is unique; a replayed create returns
  the first lead (`replayed: true`) instead of a second row. Import rows use
  `importKey:rowNumber`.
- **Image and file bytes.** The sandboxed capture screen never sees file
  bytes (CM-006): images and CSVs are uploaded through the platform uploader
  (which requires the `UPLOAD_FILE` permission flag — granted to Experience
  Hunter, Lead Coordinator and Operations, together with `DOWNLOAD_FILE`, so
  the roles that capture leads can attach a card and open it later) into a
  FILES field, and the routes read them back **only from this server's own
  signed file URL** (`fetchOwnFile`: same origin as `TWENTY_API_URL`,
  `/file/files-field/<id>`, token present). Any other URL is refused.
- **Outbound fetches.** Page metadata is read from public http(s) hosts only
  (`isFetchableUrl`: loopback, RFC-1918, link-local, `.local`/`.internal`,
  bare hosts and non-http schemes refused; 6-second timeout; 512 KB cap).
  Social platforms are never fetched; handles are parsed, not scraped.
- **Model input.** OCR sends the image itself and the extraction prompt. Draft
  classification sends the minimised draft (name, organisation, location,
  source, website, handle, languages, *whether* email/phone exist). Raw
  email/phone values, notes, `rawCaptureInput` and `captureProvenance` never
  reach a provider; the Day 6 privacy test is unchanged.
- **Data quality before creation** is advisory: hints (missing/invalid
  fields) never block a create — the person decides — except that a lead with
  nothing identifying (no name, organisation, website or profile) is refused
  by the draft builder, as since Day 1.
- Audit: the 17 capture actions listed in DATA-MODEL.md, each with the session
  actor, written with the application role.
- Proven live (`src/__tests__/lv-capture.integration-test.ts`,
  `.notes/d8/d8-browser.mjs`): API-key refusal on every route; owner spoof
  refused and audited, self-claim succeeds; Onboarding Expert refused;
  unconfirmed image draft refused; private-address fetch refused; social handle
  not scraped; undecided duplicate refused; replay idempotent; import re-commit
  reports EXISTS.
