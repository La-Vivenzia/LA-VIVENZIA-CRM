# Assignment, SLA & Notifications

## Assignment
Use geography, category, workload, expertise, language, lead value and existing relationship. Support manual, rule-based and round-robin/least-loaded assignment where available.

## Initial SLAs
- New lead contact: 24h
- Interested follow-up: 48h
- Onboarding first action: 24h
- Missing document reminder: 48h

## SLA states
On Track, Due Soon, Due, Breached, Escalated, Resolved.

## Breach behaviour
Notify owner, notify manager according to rule, increase priority where configured, create escalation task, audit the event and surface it in Control Tower.

## Notification types
Assignment, follow-up due/overdue, SLA breach, lead reply, onboarding started/completed, document rejected, reassignment, approval required, mention and escalation.

Delivery: in-app first, email second, optional WhatsApp/push. Notifications must be idempotent.

## Control Tower
Hot leads without follow-up, stuck onboarding, unowned leads, duplicates, incomplete contact information and SLA breaches.


---

## Implementation — notifications (Day 4A)

Module: `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-notifications`.
Everything below runs server-side inside the application; the browser only reads
rows it is allowed to see and asks the server to change read-state.

### One service, many producers

`services/notification-service.ts` is the only writer of `lvNotification`. Every
producer builds *intents* with the catalogue (`utils/build-notification.ts`) and
hands them to `dispatchNotifications`, which:

- drops the actor (nobody is told about their own action),
- drops intents without a recipient,
- collapses duplicates inside the batch,
- inserts each row and treats a unique violation on `dedupeKey` as "already
  delivered" — a retried function or replayed event is a no-op and can never
  flip a read notification back to unread (there is no upsert),
- stamps `triggeredBy` (from the event/session, never the body) and `sourceEvent`.

Recipients are always read off the record by the producer — `lead.ownerId`,
`onboarding.reviewerId`, `task.assigneeId`, a workspace-member mention in a note
body — and each recipient is linked to a record CM-004 lets them open (a lead
owner is linked to the lead, a reviewer to the onboarding). A client-supplied
`recipientId`, `actorId`, or `ownerId` is never used for identity.

### Events → producers

| Event | Producer | Recipient(s) | Email |
|---|---|---|---|
| Lead assigned / reassigned | `lv-on-lead-updated` (`lvLead.updated`) — the single source, whether the engine, the UI or the API changed the owner | new owner only (previous owner can no longer open the lead) | HIGH/CRITICAL leads |
| Follow-up due / overdue | `lv-follow-up-reminders` (cron `*/15 * * * *`) over Twenty `task` | assignee | no |
| Lead reply | `lv-on-interaction-created` when `direction = INBOUND` (new field) | lead owner | no |
| Onboarding started (`INITIATED`) / completed (`ACTIVATED`) | `lv-on-onboarding-updated` | reviewer + lead owner | no |
| Approval required (`INTERNAL_REVIEW`) | `lv-on-onboarding-updated` | reviewer | yes |
| Document rejected | `lv-on-document-updated` | reviewer (→ document) + lead owner (→ lead) | yes |
| Mention | `lv-on-note-created` / `lv-on-note-updated` — Twenty's own @-mention of a workspace member | mentioned member (new mentions only on edit) | no |
| SLA breach / escalation | builders ready; produced by the SLA engine (Phase 4B) | owner / manager | yes |

Dedupe keys are deterministic: `TYPE:record:recipient:<event stamp>` where the
stamp is the record's own `updatedAt` from the event (identical on replay,
different on the next change); follow-ups key on `(task, dueAt)` so a
reschedule re-reminds and a re-sweep does not; mentions key on `(note, member)`.

### Data model

`lvNotification`: `name` (title), `body`, `notificationType`, `priority`
(LOW…CRITICAL), `isRead`, `readAt`, `recipient` → workspaceMember,
`triggeredBy` → workspaceMember, `lead` → lvLead (SET_NULL), `targetObject` +
`targetRecordId` (generic pointer), `deepLink`, `dedupeKey` (unique),
`sourceEvent`, `emailStatus` (NOT_APPLICABLE / QUEUED / SENT / FAILED /
SKIPPED_NO_PROVIDER), `emailSentAt`, `emailError`, `metadata` (JSON).
Twenty's own `createdBy` is also present on every row.

### Read state

`POST /notifications/mark-read { notificationId }` and
`POST /notifications/mark-all-read`. The actor is the authenticated member from
the session; the application role performs the write only on rows whose
recipient is that member. A body naming another recipient is ignored; an API
key (no human) is refused. Team roles have no direct write permission on
notifications, so the routes are the only way to change read state.

### Email

Second channel, high-value types only: SLA breach, escalation, approval
required, document rejected, HIGH/CRITICAL assignment. Delivered by
`lv-on-notification-created` with nodemailer over SMTP configured through the
application variables `LV_SMTP_HOST`, `LV_SMTP_PORT`, `LV_SMTP_SECURE`,
`LV_SMTP_USER`, `LV_SMTP_PASSWORD` (secret), `LV_EMAIL_FROM`, `LV_APP_BASE_URL`
(Settings → Applications → La Vivenzia CRM). Why not Twenty's mailer: the
server's `EmailService` is an internal Nest provider unreachable from an
application function, and the workflow "send email" step needs a connected
personal mailbox. With no SMTP settings the row records
`SKIPPED_NO_PROVIDER` and the reason — nothing is ever marked SENT unless the
SMTP server accepted the message.

### In-app

`front-components/notification-centre.front-component.tsx`, mounted on the
standalone page layout "Notifications" (Work folder). Unread count, All/Unread
filter, priority colour bar and badge, unread dot, lead chip, relative time,
mark read on click, Mark all read, deep-link navigation, loading skeleton,
empty states, dark mode, 390px. Reads through the user's own token, so CM-004
decides what is listed; the recipient filter is a convenience for admins, not
the protection.

### Authorization

CM-004 gained `lvNotification: recipientId` (NULL never visible). A governed
role cannot list, fetch by id, or mark read anyone else's notification; deep
links open the record page, which re-checks authorization server-side.


---

## Implementation — SLA engine (Day 4B)

Module: `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-sla`.
Status legend: **IMPLEMENTED** = code exists · **VERIFIED** = executable
evidence (unit, live integration, or browser) · **LIMITATION** = known gap ·
**NOT IMPLEMENTED** = out of scope for Day 4B.

### Rules — IMPLEMENTED, VERIFIED

| Rule | Trigger (server event) | Window | Owner | Resolves when |
|---|---|---|---|---|
| `NEW_LEAD_CONTACT` | lead created in NEW / QUALIFYING / ASSIGNED, or DISCOVERED → NEW | 24h | lead owner | outward interaction logged after start · lead reaches CONTACTED or beyond · lead closed (any non-main-flow status) · target gone |
| `INTERESTED_FOLLOW_UP` | lead status enters INTERESTED | 48h | lead owner | outward interaction after start · follow-up task DONE after start · status leaves INTERESTED (NEGOTIATION+ → `LEAD_PROGRESSED`, else `LEAD_STATUS_CHANGED`, closed → `LEAD_CLOSED`) |
| `ONBOARDING_FIRST_ACTION` | onboarding status enters INITIATED | 24h | reviewer | status leaves INITIATED · any document on it moved out of PENDING after start |
| `MISSING_DOCUMENT` | document enters REJECTED / NEEDS_REPLACEMENT / EXPIRED | 48h | lead owner (reviewer when the onboarding has no lead) | document back to PENDING / UNDER_REVIEW (`DOCUMENT_RESUBMITTED`) · VERIFIED · a replacement registered (`replacedBy`) · onboarding REJECTED / ACTIVATED |

No other business rule was invented. Exact hours live in
`constants/sla-rules.ts` (`SLA_RULE_HOURS`).

### Clock — IMPLEMENTED, VERIFIED

- `startedAt` = the triggering record's own timestamp (`createdAt` /
  `updatedAt` from the database event), never "now" — a replayed event
  derives the same deadline and the same dedupe key.
- `dueAt = startedAt + window`; `dueSoonAt = dueAt − 25% × window` (24h → last
  6h, 48h → last 12h). **Decision:** the brief's 25% rule; the follow-up
  reminder's fixed 4h window is a different concept and was not reused.
- `BREACHED` = `dueAt + 1h`. **Decision (not a stated business rule):** DUE is
  the deadline; a one-hour grace lets the 15-minute evaluator raise DUE before
  BREACHED and gives the owner a last hour before their manager is involved.
  One constant (`BREACH_GRACE_HOURS`) — set it to 0 to breach at the deadline.
- All timestamps are UTC ISO-8601, normalised through `Date` on the server. A
  browser never computes SLA state; the centre and views only display it.

### State machine — IMPLEMENTED, VERIFIED

`ON_TRACK → DUE_SOON → DUE → BREACHED → ESCALATED`, forward-only; any of them
→ `RESOLVED`; nothing leaves `RESOLVED`. An evaluator that was down jumps
straight to the state the clock dictates and announces only that state (one
notification, not a burst).

### Evaluator — IMPLEMENTED, VERIFIED

`lv-sla-evaluator`, cron `*/15 * * * *`, application role, ≤ 200 rows per run
oldest deadline first (`truncated` reported). Every event hook
(`lv-on-lead-created`, `lv-on-lead-updated`, `lv-on-interaction-created`,
`lv-on-onboarding-updated`, `lv-on-document-updated`) also re-evaluates the
affected target immediately through the same code path, so reassignment and
resolution do not wait for the sweep. Test hook: executed directly
(`executeOneLogicFunction`, WORKFLOWS permission) the payload may carry
`clock` and `slaIds`; the cron sends no payload.

**Cron prerequisite (found Day 4B):** Twenty schedules cron-triggered logic
functions only after `cron:trigger:start-cron-trigger` has been registered
once per environment (`node dist/command/command cron:trigger:start-cron-trigger`).
It had never been run in this dev environment, so no LV cron (including the
Day 2 `lv-expire-documents`) had ever fired on schedule before today. Now
registered; see ENVIRONMENT.md.

### Idempotency / concurrency — IMPLEMENTED, VERIFIED

Database-enforced, no in-memory locks:

- one SLA per trigger: unique `dedupeKey` = `RULE:targetId:startedAt`;
- every state change is a conditional batch update (`updateLvSlas(filter:
  {id, status: from}, data)`) — the caller that gets a row back owns the
  transition; everyone else does nothing;
- notifications go through the Day 4A service with keys `SLA_DUE_SOON|SLA_DUE|
  SLA_BREACH:slaId:owner` and `ESCALATION:slaId:manager`;
- the escalation task is linked by a claim on `escalationTaskId`; a task
  created by a run that lost that claim is destroyed; a run that finds an
  unlinked task (crash between create and link) re-links it.

Verified live: five concurrent evaluator executions on one breached SLA → one
breach, one SLA_BREACH, one ESCALATION, one task; repeated runs after
escalation change nothing; a failed notification / failed task creation is
retried on the next run without duplicates (unit, fake DB with the same
claim semantics).

### Escalation — IMPLEMENTED, VERIFIED, with a LIMITATION

On BREACHED: owner notified (`SLA_BREACH`, email-eligible) → escalation owner
resolved server-side → `ESCALATION` notification → Twenty task (title, rule,
subject, original owner, escalation owner, deadline, breach time, SLA id;
assignee = escalation owner; `lvPriority` CRITICAL; `taskTarget` on the lead
and onboarding) → `ESCALATED`. Single tier; repeated evaluation is a no-op.

**LIMITATION — no manager mapping exists.** The La Vivenzia role model
(SECURITY-RBAC.md) defines no manager relationship, and the application role
cannot read role membership. Per the brief, none was invented: the escalation
recipient is the workspace setting `LV_ESCALATION_OWNER_EMAIL` (Settings →
Applications → La Vivenzia CRM), resolved to a workspace member at run time.
While it is empty a breached SLA stays `BREACHED` with
`escalationBlockedReason = NO_ESCALATION_OWNER_CONFIGURED`, and escalates on the
first run after it is set (verified live). The business still has to decide
who that person is (or whether it should be per-role / per-region).

### Reassignment — IMPLEMENTED, VERIFIED

Responsibility follows the record (lead owner / reviewer), read from the
workspace at every evaluation, never from a request. The deadline never
resets. The previous owner receives no further SLA notifications; the new
owner does (dedupe keys include the owner). A `REASSIGNED` audit entry is
appended; the SLA row is reused, never duplicated.

### Audit — IMPLEMENTED, VERIFIED

`auditTrail` (append-only JSON on the SLA row, same convention as
`onboarding.auditTrail`): `CREATED`, `TRANSITION` (from → to), `NOTIFIED`
(type, recipient), `REASSIGNED`, `ESCALATED`, `ESCALATION_TASK_CREATED`,
`ESCALATION_BLOCKED`, `RESOLVED` (reason). Every evaluation updates
`lastEvaluatedAt` rather than appending an entry — one row per 15 minutes per
SLA would be the noise the brief warns against. Twenty's own `createdBy` /
`updatedAt` and the notification rows' `sourceEvent = lv-sla-evaluator`
complete the picture.

### Security — IMPLEMENTED, VERIFIED

CM-004 scopes `lvSla` on `ownerId` (unowned visible, like unassigned leads).
No LV team role has update/create on `lvSla`: a Hunter cannot resolve, reassign
or forge an SLA by mutation (verified). `POST /sla/summary` runs delegated, so
CM-004 decides what it returns; body fields never widen it. Only a member with
the WORKFLOWS settings permission can execute the evaluator directly.

### Control Tower data — IMPLEMENTED (API), VERIFIED

`POST /sla/summary { statuses?, limit? }` → counts by status and rule plus
open rows with owner, rule, priority, due / breached / escalated times and the
linked lead / onboarding / document; view "SLAs · Attention needed" and the
Work → SLAs sidebar entry. The dashboard itself is Day 5.

### Limitations / not implemented

- LIMITATION: escalation owner is a single workspace setting (above).
- LIMITATION: `MISSING_DOCUMENT` resolution via a *new* replacement document
  is detected by the 15-minute sweep, not instantly (no `.created` hook).
- LIMITATION: a follow-up task completing resolves `INTERESTED_FOLLOW_UP` at
  the next sweep or lead event (no `task.updated` hook).
- LIMITATION: the SLA audit trail is JSON on the row; concurrent appends from
  an event hook and the sweep on the same row could drop an entry (state is
  never affected — only the trail).
- NOT IMPLEMENTED: multi-tier escalation, per-rule or per-region managers,
  business-hours clocks, SLA pause/hold, the Control Tower UI.
