# Day 5 — Operational dashboards, Admin Control Tower, destructive-action governance

Status labels used below: **IMPLEMENTED** (code exists and is applied to the
workspace), **VERIFIED** (proven by a real execution — unit, live integration,
or a real browser session — recorded in TESTING-QA.md), **LIMITATION** (works,
with a stated boundary), **NOT IMPLEMENTED** (deliberately absent; shown as
unavailable in the UI, never faked).

Modules: `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-dashboard`
and `.../lv-governance`. No Twenty core file was changed for Day 5;
CORE-MODIFICATIONS.md is unchanged. No paid / Enterprise feature is used.

---

## 1. Architecture

```
browser (sandboxed front component)
   │  POST /dashboard/summary  { lens?, timeZoneOffsetMinutes? }
   │  POST /control-tower/summary { filters? }
   ▼
logic function (HTTP route)        ← identity = session-derived workspace member
   │  resolveCaller()              ← role from currentUser permissionFlags +
   │                                  objectPermissions (never from the body)
   │  buildDashboardSummary() / buildControlTowerSummary()
   ▼
QueryBatch → DelegatedGraphqlClient → /graphql with the caller's delegated token
   (counts, groupBy, bounded lists; CM-004 row scoping applies automatically)
```

- **Aggregation is server-side.** Every number is a `totalCount` or a
  `groupBy` total from Twenty's GraphQL API, computed in the database. Lists are
  bounded (10 rows on dashboards, 25 in the Control Tower, hard cap 100 in the
  batch layer). The front component never receives full tables and never counts
  in the browser. **IMPLEMENTED / VERIFIED**
- **No N+1.** `QueryBatch` packs every count / group / list of a summary into as
  few GraphQL documents as Twenty allows (≤ 18 root fields per document, one
  root resolver per object per document) and runs the documents in parallel.
  Because a root resolver may appear once per document, the number of documents
  equals the number of times the busiest object is queried: 10–11 for a role
  dashboard, 13 for the Control Tower — a constant, independent of how many
  records exist (unit test `dashboard-requests.test.ts` enforces a budget of
  14). Lead names for task rows are fetched in one `in` query, not per row.
  **IMPLEMENTED / VERIFIED**
- **Delegated token.** The batch runs as *the caller*. Twenty applies the
  caller's object permissions and CM-004's row scoping (`lvLead.ownerId`,
  `lvOnboarding.reviewerId`, `lvInteraction.actorId`,
  `lvNotification.recipientId`, `lvSla.ownerId`, documents via onboarding) to
  every count, so a personal dashboard cannot leak another member's records
  even if a filter is forged. **VERIFIED** (Hunter and Onboarding Expert see
  only their own fixtures; Main Admin sees all).
- **Real data only.** No hard-coded counts, no sample rows, no invented scores.
  Every KPI carries an `emptyText` explaining a zero ("No overdue follow-ups"),
  and unavailable metrics carry `value: null` + `unavailableReason`.

## 2. Role dashboards — `My Dashboard` (Work → first item)

Page layout `lv-my-dashboard` (STANDALONE_PAGE) hosting front component
`lv-my-dashboard`. The **lens** — which dashboard a person sees — is derived on
the server from the caller's real permissions (`caller-context.ts`):

| Caller's permissions | Lens | Can switch to |
|---|---|---|
| settings permission `WORKSPACE` (Main Admin / Admin) | ADMIN | HUNTER, COORDINATOR, ONBOARDING (same unscoped data, different framing) |
| update on `lvOnboarding` (Onboarding Expert) | ONBOARDING | — |
| update on `lvOnboarding` **and** `lvInteraction` (Operations) | COORDINATOR | HUNTER, ONBOARDING |
| update on `lvInteraction` (Lead Coordinator) | COORDINATOR | HUNTER |
| update on `lvLead` only (Experience Hunter) | HUNTER | — |
| read-only (Management) | OVERSIGHT (pipeline + conversion, no personal action lists) | — |

A requested `lens` in the body is honoured **only** if it is in
`availableLenses`; a Hunter asking for `ADMIN` gets `HUNTER`. **VERIFIED** (live
test and unit test).

Personal lenses scope to **me** (`ownerId = caller` / `reviewerId = caller` /
`assigneeId = caller`) on top of CM-004; the ADMIN lens is workspace-wide.

### 2.1 Experience Hunter — IMPLEMENTED / VERIFIED

| Metric | Source | Condition | Scope |
|---|---|---|---|
| New leads today | `lvLead` count | `createdAt` within the caller's local day (`timeZoneOffsetMinutes`, clamped ±14h) | mine |
| Leads awaiting first contact | `lvLead` count | open status, `lastInteractionAt IS NULL` | mine |
| Overdue follow-ups | `task` count | `status ≠ DONE`, `dueAt < now` | assignee = me |
| SLA breaches | `lvSla` count | status ∈ {BREACHED, ESCALATED}, not resolved | owner = me |
| High-priority leads | `lvLead` count | open, priority ∈ {HIGH, CRITICAL} | mine |
| High-opportunity leads | — | **NOT IMPLEMENTED** — no Opportunity Score exists in the data model; tile shows *n/a* with the reason | — |
| Action lists | leads without first contact · overdue follow-ups · SLA due · SLA breached · no next action · no next follow-up · high-priority without interaction in 7 days | bounded to 10, each row deep-links to the record | mine |
| Pipeline | `lvLeadsGroupBy(status)` | main-flow statuses in order | mine |
| Inactive | same groupBy | additional statuses (DORMANT, LOST, …) | mine |
| Conversion | same groupBy | ONBOARDING_STARTED → LIVE_ACTIVE | mine |
| Recent activity | interactions, notes, assignment history, tasks, lead updates, onboardings, documents, SLAs (last 14 days, merged and sorted, 10 rows) | | mine |

### 2.2 Lead Coordinator — IMPLEMENTED / VERIFIED

| Metric | Source | Condition |
|---|---|---|
| Calls / emails / WhatsApp / meetings due today | `task` rows due today (bounded 100) bucketed by the **source interaction's channel** (`lvSourceInteraction.channel`); tasks with no source interaction are counted under "other" | assignee = me |
| Overdue follow-ups | `task` count | `status ≠ DONE`, `dueAt < now` |
| Waiting for response | `lvInteraction` | `outcome = AWAITING_RESPONSE` in the last 14 days, one row per lead |
| Likely to convert | `lvLead` count | status ∈ {INTERESTED, NEGOTIATION} and priority ∈ {HIGH, CRITICAL} (no score exists — stated in the notes) |
| Stuck leads | `lvLead` count | open workload status, created > 14 days ago, `lastInteractionAt` older than 14 days or null |
| Communication activity | `lvInteractionGroupBy(channel)` over the last 30 days, split inbound / outbound |
| No response · Unowned | `lvLead` counts | status NO_RESPONSE; `ownerId IS NULL` (workspace-wide, because an unowned lead is visible to all under CM-004) |

### 2.3 Onboarding Expert — IMPLEMENTED / VERIFIED

| Metric | Source | Condition |
|---|---|---|
| In progress / Waiting for documents / Ready for review | `lvOnboardingGroupBy(status)` | IN_PROGRESS+INITIATED · WAITING_FOR_PARTNER+CHANGES_REQUESTED · INTERNAL_REVIEW; reviewer = me |
| First-action SLA due / Onboarding SLA breached | `lvSla` | rule ONBOARDING_FIRST_ACTION due; onboarding/document rules breached or escalated; owner = me |
| Stuck onboardings | `lvOnboarding` count | open status, `updatedAt` > 7 days ago |
| Document queue | `lvOnboardingDocumentGroupBy(verificationState)` | PENDING+UNDER_REVIEW, VERIFIED, REJECTED, NEEDS_REPLACEMENT, EXPIRED; "missing" = open MISSING_DOCUMENT SLAs |
| Expiring documents | `lvOnboardingDocument` | VERIFIED with `expiresAt` within 30 days |
| Onboarding health | computed per open onboarding from real facts: BLOCKED (breached SLA or rejected document), NEEDS_ATTENTION (pending/replacement document or no update 7 days), HEALTHY otherwise | reviewer = me |
| Approvals waiting | `lvOnboarding` list | status INTERNAL_REVIEW |

"Next action" on an onboarding is **NOT IMPLEMENTED**: the object has no such
field; the dashboard shows the status and the SLA instead of inventing one.

### 2.4 Main Admin / Admin — IMPLEMENTED / VERIFIED

Workspace-wide versions of the Hunter KPIs plus: critical / high priority open
leads, incomplete contact data, duplicate candidates, SLA by status, onboarding
by status, and the lens switcher. A per-member workload breakdown is **NOT
IMPLEMENTED** (the Control Tower's Owner filter is the way to look at one
member's load). **Opportunity Score** and **Relationship Health** tiles are
present, show *n/a*, and state that no scoring model exists. **NOT IMPLEMENTED
by design** — the fields exist on `lvLead` from Day 1 but nothing populates them.

## 3. Admin Control Tower (Management → Control Tower)

Page layout `lv-control-tower`, front component `lv-control-tower`, route
`POST /control-tower/summary`. The route refuses anyone whose derived role is not
an administrator with `refusal: NOT_AUTHORIZED` **before** any query runs; the
component renders an "Administrators only" state with no data. **VERIFIED** (live
integration test as Hunter and Onboarding Expert; Playwright as Tim).

Sections (bounded to 25 rows, each row deep-links):

1. Unowned leads · 2. Overdue follow-ups (with assignee) · 3. Hot leads without
follow-up (HIGH/CRITICAL, open, `nextFollowUpAt IS NULL`) · 4. Stuck leads · 5.
Stuck onboardings + 5b onboarding/document SLAs breached · 6. SLA breaches
(unresolved BREACHED/ESCALATED, with an "open SLA" button) · 7. Incomplete
contact data (no primary email **and** no primary phone) · 8. Marked duplicates
+ 8b flagged at capture (`duplicateKeys` present) · 9. Pending onboarding
approvals · 10. Document verification backlog (pending / rejected / replacement /
expired) · 11. Notification health (unread urgent, SLA notifications and
escalations in 7 days, failed / skipped emails) · 12. System health (SLA
evaluator last run from `lastEvaluatedAt`, open / escalated / blocked SLAs,
governance audit events in 7 days) plus breakdown bars (SLA by status and rule,
documents by state, onboarding by status, leads by status).

Everything in 11–12 is read from CRM rows. Uptime, queue depth and other
infrastructure metrics are **NOT IMPLEMENTED** — nothing in the CRM records them,
and the panel says so.

### 3.1 Filters — server-side, validated (`control-tower-filters.ts`)

| Filter | Applied as |
|---|---|
| Owner / Team | `ownerId in [...]` (≤ 20 UUIDs). **LIMITATION:** there is no team object in the data model, so "team" is a set of owners. |
| Unowned only | `ownerId IS NULL` |
| Category | `category eq` (validated against the select options) |
| Geography | `location ilike %text%` (≤ 80 chars, `%`/`_` stripped) |
| Lead source | `source eq` |
| Status | `status in` |
| Priority | `priority in` |
| Date created (from / to) | two `createdAt` clauses (Twenty allows one operator per clause) |
| SLA state | `lvSla.status in` |
| Onboarding state | `lvOnboarding.status in` |

Unknown values are dropped; the response's `notes` say when filters are
applied. Lead-scoped sections apply the lead filters; SLA / onboarding sections
apply the owner filters on their own owner column plus their state filter.
**VERIFIED** — live test: filtering by a bogus owner UUID takes every count to
zero; "unowned only" keeps the unowned section and empties the breach section
in the browser.

## 4. Permission model

- Identity comes from the delegated token (`currentUser.workspaceMember.id`)
  and the caller's `permissionFlags` / `objectPermissions`; nothing in a request
  body can name a member, a role, or claim `isAdmin`. **VERIFIED**
- API keys are refused on all Day 5 routes (`NOT_AUTHENTICATED`): a dashboard is
  a person's view. **VERIFIED**
- The navigation items are workspace metadata and are therefore visible to every
  role (Twenty has no per-role navigation). **LIMITATION** — a Hunter can *see*
  "Control Tower" in the sidebar but gets the refusal state; the API is what is
  protected. Twenty's own object permissions also hide list views a role cannot
  read.
- There is no role-based landing redirect (Twenty opens the first CRM view).
  "My Dashboard" is the first item under Work. **LIMITATION**
- Errors are logged server-side with the caller id; the client receives a
  generic message plus `partial: true` with the failed section names when a
  chunk fails, and the UI shows the sections that did load with a warning
  banner. **IMPLEMENTED**

## 5. Destructive-action governance (`lv-governance`)

Policy: nobody except the **Main Admin** role can make a record disappear; the
team changes a lead's *lifecycle* instead, and every such change is audited.

### 5.1 Lifecycle actions — IMPLEMENTED / VERIFIED

`POST /leads/lifecycle { leadId, action, reason?, status? }` — the route reads
the lead with the caller's token (so CM-004 and object permissions decide
whether they may touch it), applies the policy (`governance.ts`) and writes the
new status with the caller's token:

| Action | New status | Reason |
|---|---|---|
| ARCHIVE | DORMANT | optional |
| CLOSE | LOST, or one of NOT_INTERESTED / WRONG_CONTACT / NOT_ELIGIBLE / TEMPORARILY_CLOSED / REJECTED | required (≥ 3 chars) |
| MARK_DUPLICATE | DUPLICATE | required |
| REOPEN | QUALIFYING (only from an archived / closed / duplicate status) | optional |

Refusals: `NOT_AUTHENTICATED`, `NOT_FOUND` (also when CM-004 hides the lead),
`POLICY` (missing reason, no-op, reopen from an open status), `NOT_PERMITTED`.
Each applied or refused action writes an `lvAuditEvent` with the application
role: target object/id/label, **actor from the session**, timestamp, reason,
outcome. The lead page's **Actions** tab (`lv-lead-governance`) exposes these.

### 5.2 Permanent delete — IMPLEMENTED with a stated design

- Only the **Main Admin** role holds `destroy` (and soft-delete) on LV objects;
  Experience Hunter, Lead Coordinator, Onboarding Expert, Operations and
  Management do not. **VERIFIED** — a Hunter's `deleteLvLead` and
  `destroyLvLead` are refused by the platform.
- **A logic function cannot perform the deletion.** A delegated token acts as
  *user ∩ application role*, and the application role deliberately has no
  destroy or soft-delete permission — verified live: a Main Admin calling a
  route that ran `destroyLvLead` was refused. Granting destroy to the
  application role would let every function destroy, which is worse than the
  problem it solves. So permanent deletion stays Twenty's own **two-step**
  path — *Delete* (to trash) → *Permanently destroy* from the trash — which the
  platform gates by the caller's role and confirms explicitly.
- `POST /records/delete-impact { object, recordId }` is the pre-flight the
  Actions tab shows to a Main Admin: dependent counts (SLAs, notifications,
  tasks, interactions, onboardings, documents, history) computed with the
  application role, `canSoftDelete` / `canDestroy` from the caller's real
  object permissions, and the exact path. It deletes nothing. A non-admin never
  sees this block (the server reports `canDestroy: false`).
- **Audit from the platform's events**, not from the client: DB-event functions
  on `lvLead|lvOnboarding|lvOnboardingDocument .deleted / .restored /
  .destroyed` write `lvAuditEvent` rows (TRASH / RESTORE / PERMANENT_DELETE)
  with the actor from the event's `workspaceMemberId`, the record snapshot as
  label, and metadata. **VERIFIED** live: Main Admin trash → restore → destroy
  produced three audit rows with the admin as actor.
- **LIMITATION:** a reason cannot be attached to Twenty's native destroy dialog;
  the reason field on the Actions tab covers lifecycle actions. The audit row
  for a destroy records who / what / when and the snapshot.

`lvAuditEvent` (Management → not navigated; readable by administrators): `name`,
`action`, `outcome`, `targetObject`, `targetRecordId`, `targetLabel`, `actor` →
workspaceMember (SET_NULL), `at`, `reason`, `metadata`.

## 6. Visual system, states, responsiveness, accessibility

- LV palette from `lv-core/ui/theme.ts` (Pine Green `#1F4D3A`, Sage `#6B846F`,
  Warm Gold `#D4AF37`, Sand `#F3EFE7`, Charcoal `#1A1A1A`), display serif
  stack (Cinzel → Cormorant Garamond → Georgia) for headings, Sora → system-ui
  for body, no gradients; light and dark via `useColorScheme`. **VERIFIED** in
  Chromium light + dark. **LIMITATION:** the brand fonts are not bundled or
  self-hosted, so the sandboxed component renders the fallbacks (Georgia /
  system-ui) until the font files are added to the app.
- States: loading (`role=status`), empty (every list and KPI explains its zero),
  error (`role=alert` with retry), partial (banner listing failed sections),
  forbidden (Control Tower for non-admins). **IMPLEMENTED**; loading / empty /
  forbidden / partial seen in the browser or unit tests.
- Responsive: KPI grid `auto-fit, minmax(150px, 1fr)`, two-column sections
  `auto-fit, minmax(300px, 1fr)` (one column on phones), tables inside
  `overflow-x: auto`. **VERIFIED** at 320,
  390, 768, 1024, 1440, 1920 with `scrollWidth ≤ clientWidth`.
- Accessibility basics: semantic headings, KPI tiles and rows are real
  `<button>`s with accessible names (hidden text for n/a), lens tabs use
  `role=tablist/tab/aria-selected`, form controls have labels, visible focus
  ring (`:focus-visible`), status/alert live regions. Full WCAG audit **NOT
  DONE**.

## 7. Known limitations (summary)

1. Opportunity Score, Relationship Health, conversion probability — **NOT
   IMPLEMENTED**; shown as unavailable, never estimated.
2. No team object — "Team" filter is a set of owners.
3. Navigation visibility is shared metadata; protection is at the API.
4. No role landing redirect.
5. Onboarding "next action" does not exist as a field.
6. Duplicate detection = human-marked + capture-flagged; no cross-record
   matching runs in the dashboards.
7. Permanent delete is native two-step (route cannot destroy); no reason on
   the native dialog.
8. "Calls due today" etc. depend on tasks carrying a source interaction;
   tasks without one count as "other".
9. Infrastructure / uptime metrics are not shown.
10. Brand fonts fall back to Georgia / system-ui (not self-hosted yet).
11. Twenty's record page shows the Actions tab to every role; the widget
    itself hides the deletion block for non-admins and the server decides.
12. Dashboards are on-demand (Refresh button); there is no live push.
