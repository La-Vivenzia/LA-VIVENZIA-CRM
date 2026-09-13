# Lead 360 — the employee workspace for one relationship

**Day 7.** Lead 360 turns the Day 1–6 backend (interactions, tasks, notes,
assignment, lifecycle governance, onboarding, documents, SLAs, notifications,
rules intelligence, AI drafting) into one page an employee works from. Nothing
here is a second implementation of any of those: the page composes what exists
and every button calls a governed route that already had, or now has, its
audit row.

## Architecture

```
lvLead record page  ──tab "Lead 360"──▶  lv-lead-360 (front component)
                                              │  one request
                                              ▼
                                POST /leads/360  (lv-lead-360.logic-function)
                                  beginLeadRoute → loadLeadContext (CALLER token: CM-004 + object permissions)
                                  resolveCaller  → capabilities
                                  Day 6 engines  → opportunity / health / next best action / data quality (no persistence)
                                  composeLead360 → header · next action · timeline · tasks · notes · onboarding · documents · SLAs · ownership
```

| Piece | Where | Reuses |
|---|---|---|
| Composition (pure) | `lv-core/services/lead-360.ts` | `LeadContext`, `CallerContext`, `stepProgress`, engine result types |
| Route | `lv-core/lead-360.logic-function.ts` | `beginLeadRoute`, `resolveCaller`, `deriveLeadFacts` + engines |
| View helpers (pure) | `lv-core/front-components/lead-360/lead-360-view.ts` | lifecycle / onboarding / document vocabularies |
| Sections | `lv-core/front-components/lead-360/sections.tsx` | `dashboard-kit` (Section, EmptyState, ErrorState, LoadingState, formatWhen), `theme.ts` |
| Forms | `lv-core/front-components/lead-360/forms.tsx` | `validateInteractionInput`, `QUICK_ACTIONS`, `CLOSING_STATUSES`, generated select options |
| Page | `lv-core/front-components/lead-360.front-component.tsx` | `callRoute`, `navigate` |
| Layout | `lv-core/page-layouts/lead-profile.page-layout.ts` | Tab 0 = Details (Twenty FIELDS + Follow-ups; Twenty renders a record page's first tab as the narrow left column), tab 1 = "Lead 360" (VERTICAL_LIST, the main area, default on mobile); Relationship (interactions + Twenty TIMELINE), Notes & files, Intelligence, Actions unchanged |

The page holds no permission logic and no scoring rule. It renders
`capabilities` and reloads after every action. Twenty's own Timeline, Tasks,
Notes and Files widgets remain on their tabs; the merged relationship timeline
on Lead 360 is a read model over the same rows, bounded to 30 entries.

## Routes added on Day 7

| Route | Purpose | Runs as | Audit |
|---|---|---|---|
| `POST /leads/360 { leadId }` | compose the page | caller | — |
| `POST /interactions/log { leadId, channel, direction, occurredAt?, durationMinutes?, purpose?, summary?, sentiment?, outcome?, objections?, commitments?, nextAction?, nextFollowUpAt? }` | record a contact | caller (roles with interaction write) or application-for-lead-writer (Hunter) — actor always the session | INTERACTION_LOGGED |
| `POST /tasks/create { leadId, title?, description?, dueAt?, priority?, assigneeId?, quickAction?, timezoneOffsetMinutes?, sourceInteractionId? }` | task + taskTarget on the lead | caller | TASK_CREATED |
| `POST /tasks/update { leadId, taskId, action: COMPLETE\|RESCHEDULE\|REOPEN, dueAt?, title? }` | next-action controls; task must be attached to the lead | caller | TASK_COMPLETED / TASK_RESCHEDULED |
| `POST /notes/create { leadId, title?, body }` | Twenty note + noteTarget | caller | NOTE_CREATED |
| `POST /leads/lifecycle { leadId, action: …\|SET_STATUS, status, reason? }` | governed forward step (new action on the Day 5 route) | caller | STATUS_CHANGE |
| `POST /leads/assign { leadId, newOwnerId\|null, reason? }` | manual ownership change under policy | caller (+ application for history/audit) | OWNER_CHANGE + `lvAssignmentHistory` MANUAL |

All six take the actor from `event.workspaceMemberId`. On the native path (record editor / API) `lv-on-interaction-created` re-attributes `actorId` to the session member; only a workspace administrator may attribute a contact to a colleague explicitly. Existing hooks do the
rest: `lv-on-interaction-created` (lead summary, follow-up task, LEAD_REPLIED,
SLA re-evaluation, timeline activity), `lv-on-lead-updated` (LEAD_ASSIGNED /
REASSIGNED, SLA clocks).

## Interaction workflow

Add interaction → inline form (channel, direction, date/time, duration for
timed channels, purpose, summary, sentiment, outcome, problems, commitments,
next action, next follow-up) → client-side check with the **same**
`validateInteractionInput` the server runs → `/interactions/log` → the hook
creates the follow-up task (from next follow-up / next action), refreshes
`lastInteractionAt` / `nextAction` / `nextFollowUpAt` on the lead, notifies
the owner on an inbound contact, re-evaluates SLAs → the page reloads and the
new task is the Next action. A future-dated interaction is refused ("use a
follow-up task").

## Task / follow-up workflow

Create task → full form or a quick action (Call tomorrow · Follow up in 2
days · Send onboarding information · Review documents · Schedule meeting).
Quick actions are one shared table (`lv-followups/utils/quick-actions.ts`);
the due date snaps to the action's working hour in the browser's zone.
Next action panel = earliest open task with Complete / Reschedule-edit /
Create interaction; when none exists, "+ Add next action", and the Day 6 next
best action is offered as "Make this the next action" (creates the proposed
task through the same route). Accepting the NBA from the Intelligence tab
continues to work as before.

## Timeline

`buildTimeline` merges: lead created · assignment history (assigned /
reassigned / left unassigned, strategy, reason) · interactions (channel,
direction, outcome, next follow-up, sentiment tone) · tasks (created / done) ·
notes · SLA breached / met · onboarding submitted / status · document verified /
rejected / expired · governance & status-change audit rows (actor, reason) ·
AI decisions (type, decision, who). Sorted newest first, grouped by day
(Today / Yesterday / Sep 12). OWNER_CHANGE audit rows are skipped in favour of
the assignment-history entry; INTERACTION_LOGGED / TASK_CREATED /
NOTE_CREATED audit rows are skipped because the record itself is the entry.

## Onboarding and documents

The Day 3 wizard and document review console are now mounted: a RECORD_PAGE
layout for `lvOnboarding` (`lv-onboarding/page-layouts/onboarding-record.page-layout.ts`)
with tabs Onboarding (wizard, resumes the saved answers) · Documents (review
console) · Details. Lead 360 shows progress (steps complete / total, per-step
✓ / ○ with missing counts, document counts), the reviewer, and the documents
(name, type, state, expiry, rejection reason). "Start onboarding" creates the
lvOnboarding as the caller and opens it; "Continue onboarding" / "Review
documents" open the record page. "View" fetches the short-lived signed file
URL as the caller — the bucket is never exposed.

## Intelligence

The Overview carries the Day 6 data-quality issues as warnings (missing phone
/ email / website / location, stale lead, no next action …) plus "no
interaction yet" / "no next follow-up". The Intelligence summary shows
opportunity score with its top factors, relationship health with reasons, the
next best action priority and the issue count, all labelled **computed by
rules** with the rules version, and points to the Intelligence tab for AI
summary, classification, conversation summaries, drafting and duplicate
decisions (unchanged from Day 6; drafts remain editable, copy-only, marked AI
DRAFT, honest `AI UNAVAILABLE` without a provider).

## Permissions (see SECURITY-RBAC.md "Lead 360 and relationship operations")

| Capability | Rule |
|---|---|
| canLogInteraction | lvInteraction write, or lvLead write on a visible lead; not on a closed lead |
| canCreateTask / canAddNote | task / note write |
| canChangeStatus | lvLead write, lead not closed |
| canChangeOwner | admin, or the current owner |
| canClaim | lvLead write and the lead is unassigned |
| canWorkOnboarding | lvOnboarding write or admin |
| canReviewDocuments | canWorkOnboarding and (assigned reviewer, admin, or no reviewer yet) |

Role-aware ordering (`sectionOrderFor`): Hunter — next action, overview,
intelligence, timeline …; Coordinator — next action, tasks, SLAs, timeline …;
Onboarding Expert — onboarding, documents, next action …; Admin — everything.
No section is hidden by the page; what the server withheld simply is not there.

## Lifecycle governance

Positive flow and holding states via `SET_STATUS`; closing via `CLOSE` with a
reason; archive / duplicate / reopen on the Actions tab (Day 5 widget). The
onboarding-mirrored statuses are display-only from the lead. There is no
direct client-side status mutation anywhere on Lead 360.

## Audit events

STATUS_CHANGE, OWNER_CHANGE, INTERACTION_LOGGED, TASK_CREATED,
TASK_COMPLETED, TASK_RESCHEDULED, NOTE_CREATED (new), alongside the governance
set. REFUSED outcomes are written too (policy or permission), so a denied
attempt is visible. Assignment history (MANUAL), AI decisions, document audit
trails and Twenty's timelineActivity are the other audit surfaces and are
merged into the timeline.

## Quick Add, search, deep links

Quick Add is reachable as Work → Quick add lead and as the pinned ⌘K command
"Quick add lead". It now takes email, category, subcategory, source and an
optional owner (a manual assignment), and after creation shows Lead created →
LV Lead ID → Assignment → Next action with the real values (polled from the
record; "not allocated yet" is stated, never faked) and "Open Lead 360".

Global search finds leads by name (the platform indexes only the label
identifier for app objects); the new "All leads" view exposes LV ID,
organisation, status, owner, category, location, source, priority and next
follow-up as columns for Twenty's filters. Control Tower, dashboard and
notification rows deep-link to the lead record page (unchanged, verified on
Day 5); the section a row refers to is highlighted from the data itself
(overdue follow-up / no next action → Next action, SLA breach → Service levels,
rejected / expired / missing documents → Documents) because a front component
runs in a sandbox with no URL or storage access.

## Mobile

One column below ~420px (`repeat(auto-fit, minmax(min(100%, 420px), 1fr))`),
wrapping action bar, 44px controls, inline forms instead of modals, no
horizontal overflow at 320 / 390 / 768 / 1024 / 1440 / 1920; light and dark
via the shared theme tokens; no gradients.

## Known behaviour of the sandbox

Front components run in Twenty's remote-DOM sandbox. Text fields are uncontrolled (`defaultValue` + `onChange`) so React never overwrites what a person is typing; a person typing at normal speed loses nothing (verified at 60 ms/key). Synthetic zero-delay typing from automation drops keys and Playwright's `fill` / `selectOption` never settle against the host — the browser harness types at 45 ms/key and drives selects with a value + `change` event instead.

## States

Every section handles loading (skeleton), empty (honest copy, e.g. "No
interactions yet. Start building the relationship by logging the first
interaction."), error ("Unable to load this lead" + Retry) and forbidden
("You don't have permission to view this information" for a lead outside the
caller's CM-004 scope). No placeholder data anywhere.
