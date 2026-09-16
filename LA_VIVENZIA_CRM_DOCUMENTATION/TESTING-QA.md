# Testing & QA

## Layers
Unit: assignment, SLA, scoring, duplicate similarity, validation, notification deduplication.

Integration: lead creation, assignment, timeline, email, onboarding, documents, notifications and permissions.

E2E: capture → qualification → follow-up → onboarding → approval → activation.

## Permission tests
Allowed role succeeds. Disallowed role fails server-side. Direct API attempts also fail. UI filtering is never the only protection.

## Responsive QA
320, 375, 390, 430, 768, 1024, 1280, 1440, 1920px.

## Accessibility
Keyboard navigation, focus, labels, contrast, errors, semantics and touch targets.

## AI QA
Hallucination resistance, missing data, ambiguity, wrong documents, duplicates, low confidence, prompt injection in external content and human approval boundaries.

## Performance
Lead capture, record load, search, dashboards, notification delivery, OCR and AI latency.

---

# Test status (2026-09-10)

## Automated gates

| Gate | Result |
|---|---|
| Unit tests (`vitest --project unit`) | **654 pass**, 24 files, 0 fail |
| Typecheck (`tsc --noEmit`) | clean |
| Lint (`oxlint`) | 0 warnings, 0 errors |
| Integration tests | 8 defined, **not run** — they mutate the live workspace |
| E2E suite | none exists |

## Why unit tests were not enough

The previous audit found 609 passing unit tests alongside a system in which
**no automation had ever executed**: 0 owners, 0 history rows, 0 notifications.
Every unit test passed because every unit was correct. The defect was in the
platform's execution sandbox (see CM-003), which no unit test touches.

The lesson is recorded here because it will recur: **a green unit suite is
evidence about logic, not about execution.** Anything claimed as working must
also be shown working against the running system.

## Real-execution verification performed

Each of these was run against the live server and database, not simulated.

| Scenario | Evidence |
|---|---|
| Lead creation → routing | Lead created via GraphQL; `logic-function-queue` completed; lead gained `LV-000001`, an owner and status `ASSIGNED` |
| LV Lead ID allocation | `LV-000001`…`LV-000005` issued, all unique, sequence continues correctly |
| Backfill of pre-existing leads | 3 real leads processed through the same production path; all now identified, owned and recorded |
| Assignment history | One row per lead with real strategy (`SCORED`) and real scores (70, 55) |
| Notification | `LEAD_ASSIGNED` row with title, deep link, recipient and dedupe key |
| Interaction → follow-up | Interaction created; Twenty task created with correct title, due date, `lvPriority` and assignee |
| Task ↔ lead link | `taskTarget` row joins the task to `LV-000004` |
| Lead summary refresh | `lastInteractionAt`, `nextAction`, `nextFollowUpAt` all updated |
| Timeline | Interaction and task both appear on the lead's timeline |
| **Idempotency** | Identical job re-enqueued and reprocessed: history 2→2, notifications 1→1, identifier unchanged, owner unchanged |
| **Permission enforcement** | Same token: `destroy` refused, soft `delete` refused, `update` allowed, `read` allowed |

## Verification data hygiene

Records created for verification were prefixed `[E2E-VERIFY]` and removed
afterwards: 2 leads, 2 interactions, 2 tasks, 1 notification, 2 history rows.
The three real leads were kept and are now correctly processed.

## Not yet covered

- No automated test asserts the CM-003 Windows branch; on Linux CI it passes
  either way, so the test must force the platform check.
- No test exercises an unauthorised **human** user. Proving that needs a second
  authenticated session, which requires workspace credentials not available to
  the automation. The enforcement evidence above uses the application token,
  which is a real role boundary but not a second person.
- Onboarding approval, document upload and document verification still have no
  real-execution evidence.

---

# Remediation 2 test status (2026-09-10)

| Gate | Result |
|---|---|
| Unit tests | **715 pass**, 27 files, 0 fail (was 654) |
| Typecheck | clean |
| Lint | 0 warnings, 0 errors |
| Integration | 8 defined, still not run (mutate the live workspace) |
| E2E scenario | **22 of 23 checks passed**; the 23rd found a real bug, now fixed |

## The bug the end-to-end run found

The one failing check was `LV Lead ID allocated`. It was not a flaky test: a
soft-deleted lead was holding `LV-000006` in the unique index while being
invisible to the allocator's query, so allocation had wedged. Two unit tests
now cover it — one proving the fix, one reproducing the original blindness.

This is the second time in two sessions that real execution found something no
unit test could. The pattern is worth stating plainly: **these tests verify
logic; only running the system verifies the system.**

## Verified by real execution

Lead creation → LV Lead ID → assignment → history → notification;
onboarding creation linked to a lead; real PDF uploaded through Twenty's FILES
upload; document registered with full metadata; reviewer assigned; illegal
transition refused; under review; verified; five-step transition to
INTERNAL_REVIEW; approval refused without a human; approval by a named
reviewer; onboarding APPROVED; six-entry onboarding audit; three-entry
append-only document audit; document expiry sweep moving a back-dated document
to EXPIRED.

## Verification data hygiene

Records were prefixed `[E2E-R2]` and removed afterwards: 2 leads, 1 onboarding,
2 documents, plus their history and notifications. `LV-000003`, `LV-000004` and
`LV-000005` were never touched.

## Not covered

- No automated test asserts the CM-003 Windows branch.
- No test exercises an unauthorised **human** user (needs a second session
  credential that is not available to the automation).
- The reviewer UI and the wizard uploader are typechecked and linted but have
  no rendering tests; both were exercised only through the routes they call.
- Mobile layout is enforced by tokens (44px targets, fluid containers, wrapping
  rows) and unit-tested at that level, not visually verified in a browser.

---

# Remediation 3 test status (2026-09-11)

| Gate | Result |
|---|---|
| App unit tests | **722 pass**, 27 files |
| Core specs (touched files) | **78 pass**, incl. 11 new for the scoping policy |
| Typecheck — app and core | clean |
| Lint | 0 / 0 |
| Live scope matrix | 13/13 |
| Live impersonation | 8/8 |
| Live scoped-creator assignment | 5/5 |
| Live regression E2E | 29/29 |

## A note on what a failing security test can do

An early version of the scope matrix tested DELETE against a **real** lead. When
scoping had not yet engaged (stale role cache), it deleted `LV-000004`, then on a
re-run `LV-000003`. Both were restored immediately via `restoreLvLead`. The suite
was rewritten to operate only on throwaway fixtures it creates itself, and check
5b now asserts the row is untouched in the database. Recorded here because it is
exactly the mistake the next person writing a security test will be tempted to
make.

## Visual verification (Chromium, real login)

Sidebar shows CRM › Leads, People, Organisations, Experiences, Properties,
Partners; Work (collapsed); Opportunities; Dashboards. No demo objects. Company
relabelled Organisation. Dark mode renders. 390px viewport: no horizontal
overflow. Automation/Workflows correctly hidden for a role without tool access.


## Day 4A — notifications: verified by real execution

Unit (vitest, 33 files / 788 tests): catalogue builders and dedupe keys,
service idempotency and actor suppression, mention parsing, email config /
composition / delivery outcomes (including a real nodemailer transport with no
network), follow-up reminder selection, read-state authorization, event
parsing, centre presentation rules.

Live, in the repository — `src/__tests__/lv-notifications.integration-test.ts`
(6 tests, real sessions for a Main Admin, an Experience Hunter and an
Onboarding Expert; skipped without `TWENTY_API_KEY` and the dev users):
assignment via the real `lvLead.updated` flow with server-derived audit;
reassignment recipient correctness; CM-004 on notifications; deep-link
authorization; event replay idempotency; actor suppression; follow-up sweep
run twice; mark read / mark all read / API-key refusal.

Live, scratchpad (`notifications.mjs`, 60 checks, all passing): the above plus
onboarding started / approval required / completed, document rejected through
the reviewer route, mentions on create and edit, lead reply, email queued →
`SKIPPED_NO_PROVIDER` with reason, audit fields.

Browser (`centre.mjs`, Playwright, real login as Tim): sidebar entry, centre
renders a real notification unread with the priority indicator and lead chip,
Mark all read → server confirms 0 unread and `readAt` set, clicking navigates to
`/object/lvLead/<id>`, 390px dark mode with no horizontal overflow.

Finding while doing this: `packages/twenty-front-component-renderer` had never
been built on this machine, so **no LV front component had ever rendered in the
running browser before Day 4A** (earlier E2E ran through routes and GraphQL).
Built with `sandbox:prebuild` + `vite build`; the dev server must be restarted
after. Documented in ENVIRONMENT.md.


## Day 4B — SLA engine: verified by real execution

Unit (vitest, 37 files / 847 tests total): clock schedules for all four rules
with time travel (0 / 10 / 17.99 / 18 / 24 / 24.99 / 25 / 240 h and the 48h
equivalents), timezone normalisation, trigger predicates, state machine,
resolution rules per rule, ownership per target, full lifecycle with a fake
clock, ten repeated runs after escalation, resolution before and after
breach, deleted target, reassignment (old owner silenced, new owner told,
deadline unchanged, no duplicate row), three concurrent evaluators on one SLA
(one breach / notification / escalation / task), failed notification and
failed task creation retried without duplicates, missing escalation owner,
restart between breach and escalation.

Live, in the repository — `src/__tests__/lv-sla.integration-test.ts` (6
tests, real sessions): clock from `createdAt` + reassignment; time-travelled
lifecycle with notifications and task; five concurrent executions; resolution
before and after breach; CM-004 isolation and forged mutations refused.

Live, scratchpad (`sla.mjs`, 55 checks, all passing): the above plus rule 2
(48h) end to end, rule 3 (reviewer, resolved by a document review through the
route), rule 4 (owner = lead owner, link → lead, resolved by resubmission),
ownerless SLA, deleted target → `TARGET_GONE`, escalation owner unset →
blocked → set → escalates once, `/sla/summary` scoping, evaluator execution
refused for a governed user.

Background execution: the cron-trigger scheduler had never been registered
in this environment (see ENVIRONMENT.md); after registering it, a probe SLA's
`lastEvaluatedAt` was updated by the scheduled `*/15` run with no client
involved.


## Day 5 — dashboards, Control Tower, governance: verified by real execution

Unit (vitest `--project unit`): metric predicates (overdue, stuck, hot without
follow-up, incomplete contact, SLA breach set), coordinator channel buckets,
onboarding health from real facts, viewer-timezone "today" with clamped offset,
Control Tower filter parsing (drops unknown values, strips SQL wildcards,
carries owner filters onto SLA / task / onboarding columns), lens derivation
from permissions, query-batch packing (no repeated root resolver, ≤ 18 roots,
typed variables, bounded lists), a request budget (each lens and the Control
Tower stay ≤ 14 documents with a fake client — a constant, never per row), and
the lifecycle policy (reason rules, closing statuses, reopen only from a closed
state, no-ops refused).

Live, in the repository — `src/__tests__/lv-dashboards.integration-test.ts`
(6 tests, real sessions for a Main Admin, an Experience Hunter and an
Onboarding Expert; skipped without `TWENTY_API_KEY` and the dev users):
Hunter dashboard deltas from controlled fixtures (overdue task, breached SLA
via evaluator time travel, high-priority lead) and no leakage of another
member's lead; Hunter cannot force the ADMIN lens and is refused by the
Control Tower route; Onboarding Expert sees only their own onboarding; Admin
dashboard + Control Tower deltas, server-side filters (owner, unowned,
status, priority, SLA state) and bogus filters ignored; Hunter archive /
reopen audited with the session actor and refused soft-delete / destroy;
Main Admin delete-impact, then trash → restore → destroy each captured as an
audit row.

Browser (`d5-browser.mjs`, Playwright, real credentials for four roles —
Tim / Experience Hunter, `lv-test-d` / Lead Coordinator, `lv-test-c` /
Onboarding Expert, `lv-test-b` / Main Admin — fixtures created and destroyed
by the script; **38/38 checks pass**): dashboard loads with the right lens,
KPI numbers and lists reflect the fixtures (overdue task, breached SLA via
evaluator time travel, unowned lead, onboarding in review with pending and
rejected documents, PHONE follow-up due today), unavailable metrics show
*n/a*, a row click deep-links to the record, the Hunter gets "Administrators
only" on the Control Tower with no data, the Admin Control Tower lists every
fixture in its section, the "unowned only" filter changes the lists
server-side, a breach row deep-links to the lead, the lead page Actions tab
shows lifecycle buttons for the Hunter and the deletion impact only for the
Main Admin, widths 320 / 390 / 768 / 1024 / 1440 / 1920 without horizontal
overflow, dark mode, first Tab lands on a focusable control.

States (`d5-states.mjs`, 5/5): loading state visible before data, replaced by
the summary; aborting the route request in the browser shows the error state
with the message and a Retry button while the previously loaded figures stay
on screen; Retry recovers.

Operational notes from this round: a disposable user created through the
sign-up API is asked to complete a profile on first browser login (the script
handles it); every destroy — including test cleanup — is audited from the
platform events, so each suite now sweeps the audit rows of its own fixtures
(the scratchpad suites call `sweep-audit.mjs`), leaving the governance log
with only real entries.

Fixture hygiene: every suite destroys what it creates (leads, tasks, task
targets, interactions, onboardings, documents, SLAs, escalation tasks,
notifications, assignment history, audit rows). The three real leads
LV-000003/4/5 are never touched.


## Day 6 — AI intelligence & Copilot: verified by real execution

Unit (vitest `--project unit`, 43 files / 935 tests total; 60 new):
provider abstraction with a deterministic transport — success, fenced JSON,
malformed JSON, schema failure, empty response, rate limit → retry →
success, retry exhaustion, timeout, bad credentials (no retry), network
failure, Anthropic dialect, classify label allowlist; configuration
defaults / clamps / key never exposed; prompt registry versions and
validators; opportunity score arithmetic (exact points, SCORE_UNAVAILABLE
cases, clamping); relationship health states; next-best-action ladder;
data quality issues; duplicate scan ranking; persistence cost control (no
rewrite when unchanged, confirmed insight → STALE + new suggestion);
provenance (citations outside the context dropped; failed calls stored as
UNAVAILABLE with code); model context privacy; Copilot allowlist
(unsupported object / field / operator, excessive limit, owner spoofing by
id or name, wildcard stripping, date resolution, sort allowlist), intent
rules (ten everyday questions; delete / merge / approve / reassign / price /
send never executable; impersonation refused), anti-hallucination answers
(pricing / availability / certification "not available"), model-intent
fallback validated like any plan.

Live, in the repository — `src/__tests__/lv-ai.integration-test.ts` (7
tests, real sessions for a Main Admin, an Experience Hunter and an
Onboarding Expert; skipped without `TWENTY_API_KEY` and the dev users):
deterministic intelligence with provenance and the mirrored score;
`AI_UNAVAILABLE` from every model operation with an audited run; AI objects
denied to team roles, auditable by the Main Admin, API key refused,
non-owner `NOT_FOUND`; NBA accept → task with the reviewer's token, decision
single-shot, non-owner refused; duplicate twin surfaced with evidence and
MERGE → DUPLICATE + `MARK_DUPLICATE` audit, both records intact; Copilot
scoping (Hunter's "all leads" = CM-004 count), impersonation / delete /
owner-change refused, SQL-like text harmless, reviewer cannot see a Hunter
lead, pricing / availability / certification answers; proposal → confirm
(other member refused, single-use, task assigned to the confirmer);
briefing facts with fixed ranking. Fixtures (leads, interactions, tasks,
SLAs, notifications, history, AI insights, runs, problems, audit rows) are
destroyed afterwards.

Live probe (`.notes/d6/d6-probe.mjs`, 42 checks, all passing) covers the
same ground against the three real leads without creating fixtures.

Browser (`.notes/d6/d6-browser.mjs`, Playwright, real logins for Tim /
Hunter, lv-test-c / Onboarding Expert, lv-test-b / Main Admin; fixtures
created and destroyed): see the Day 6 report for the per-check results —
Intelligence tab loading → data, AI UNAVAILABLE labels, computed score /
health / next best action with explanations, Accept → real task, duplicate
Ignore decision, aborted request → error state → Retry recovers, widths
320 / 390 / 768 without horizontal overflow, dark mode; Copilot page
briefing, structured answers with KNOWN blocks, pricing "not available",
delete and "act as admin" NOT PERFORMED, proposal → Confirm → one task;
Onboarding Expert asking about a Hunter lead refused; Admin Control Tower
system health with AI operations and unresolved problems; dashboard
high-opportunity KPI.

Fixture hygiene: AI insight / run rows created by probes are purged
(`.notes/d6/purge-ai-test-rows.mjs`); the three real leads are untouched.

## Day 7B — design system & UI transformation: verified by real execution

**Baseline before any change** (commit `17709946`): unit 46 files / 963
tests, `tsc` clean, `oxlint` clean; front-end `tsc` 78 pre-existing errors
on `main` (untouched files). Screenshots of every LV surface in light / dark
× 1440 / 390 as Admin saved under `.notes/d7b/shots/before/`.

**After:** unit 47 files / 984 tests (21 new in
`lv-core/ui/__tests__/tokens.test.ts`: WCAG AA contrast of text, heading,
muted text, status colours on their washes and on the surface, primary and
inverse-panel text, focus ring, border visibility — in both schemes; dark
mode is a pine, not a grey; typography faces and minimum sizes; the host
stylesheet's generated `--lv-*` blocks byte-identical to `tokens.ts`; fonts
and licences present, no font CDN; unified status labels never SNAKE_CASE,
urgency consistent across kinds, unknown values safe). Integration
`--project integration --no-file-parallelism` 6 files / 42 tests against
the live server. `tsc` and `oxlint` clean in the application; front-end
`tsc` still exactly 78 errors, all pre-existing; the two upstream Jest
suites touched by CM-005 (`getEmptyStateSubTitle`,
`getTimelineActivityAuthorFullName`) pass (9 tests).

**Browser sweep** (`.notes/d7b/ui-shots.mjs`, Playwright, real logins):
sign-in, My Dashboard, Notifications, Tasks, Copilot, Partner onboardings,
Leads, Lead 360 / Intelligence / Actions tabs, Control Tower — as Main
Admin, Experience Hunter, Lead Coordinator and Onboarding Expert, light and
dark, 1440 × 900 and 390 × 844. Every LV page reports zero horizontal
overflow at 390. Screenshots under `.notes/d7b/shots/after/<role>/`.

**Regression:** the Day 5 (`regress/d5-browser.mjs`, `d5-states.mjs`),
Day 6 (`d6/d6-browser.mjs`) and Day 7 (`d7/d7-browser.mjs`) browser suites
were updated for the regrouped sidebar (Work → Workspace, CRM →
Relationships, Management → Insights, Copilot under Intelligence) and for
Twenty's tab test-ids (and two copy assertions for the new provenance
label and the renamed panel button), then re-run: Day 5 38/38, Day 6 32/32,
Day 7 34/34.

**Not covered:** pixel-diff snapshots (none are kept; the screenshots are
for human review); the widths 320 / 768 / 1024 / 1920 were checked by hand
on the dashboard and Lead 360 only; screen-reader testing was not run —
the accessibility work is structural (roles, labels, live regions, focus
rings) and asserted by inspection.

## Day 8 — universal lead capture: verified by real execution

**Unit** `npx vitest run --project unit`: 48 files / 999 tests (36 new
across `lv-capture/__tests__/universal-capture.test.ts` — capture
methods, social profile parsing, draft modes and provenance, request parsing
never reading identity, quality hints, image/URL extraction incl. the SSRF
guard and page-metadata parser, RFC-4180 CSV parser, column auto-mapping, import
validation with in-file duplicates — and `capture-state.test.ts` — the screen's
state machine, the import state machine, the Lead 360 capture summary — and
`ai-provider.test.ts` — image parts in the OpenAI and Anthropic request shapes).

**Integration** `--project integration --no-file-parallelism` against the live
server with real sessions: 7 files / 52 tests, 10 new in
`lv-capture.integration-test.ts` (API-key refusal on every capture route;
manual preflight → create → LV ID → task → provenance → audit → idempotent
replay; owner spoof refused with POLICY and audited, self-claim succeeds as the
session member; Onboarding Expert refused by the platform; unconfirmed image
draft refused; image extraction honest about the provider (UNAVAILABLE without
a key — the assertion accepts EXTRACTED with an audited run when a key exists);
URL extraction of example.com, private address refused, Instagram handle kept
but not scraped; duplicate detected before creation, undecided create refused,
CREATE_NEW recorded as insight + audit; CSV validate (valid / warning / error /
in-file duplicate / CRM duplicate) → commit creates only accepted rows → re-commit
reports EXISTS; Lead 360 capture summary and timeline).

**Browser** (`.notes/d8/d8-browser.mjs`, Playwright, real logins, real files,
fixtures destroyed afterwards): nine scenarios — mobile manual capture at 390;
visiting-card photo through the platform uploader (CM-006) with the honest
"unable to extract" path and the image attached; URL capture; duplicate
detection → open existing / ignore with the decision recorded; assignment
recommendation with reasons → engine assignment → notification; admin manual
assignment → notification; CSV import end to end (upload → map → validate →
review → import → report with LV IDs); Hunter security (colleague assignment
refused, self-claim allowed); responsive sweep at 320 / 390 / 768 / 1024 / 1440 /
1920 with zero horizontal overflow and ≥ 44 px primary actions, Lead 360
capture history, dashboard and Lead 360 entry points. Result and screenshots in
`DAY_8_LEAD_CAPTURE.md` §5 and `.notes/d8/shots/`.

**Regression:** Day 5 (`regress/d5-browser.mjs`), Day 6 (`d6/d6-browser.mjs`)
and Day 7 (`d7/d7-browser.mjs`, its Quick Add scenario rewritten for the
capture flow) re-run after the change; the Day 6 privacy test is unchanged and
passing; `tsc` and `oxlint` clean in the application; front-end `tsc` unchanged
(pre-existing errors only).

**Provider-dependent, not mocked:** vision OCR and draft classification. In the
dev workspace no `LV_AI_API_KEY` is configured, so those paths are verified for
their honest UNAVAILABLE behaviour; the request shapes (image parts for the
OpenAI and Anthropic dialects) are unit-tested, the live call is not.

**Not covered:** PDF extraction (not implemented); voice capture (not
implemented); Twenty's native importer (untouched).

## Day 9 — partners, experiences, properties, activation: verified by real execution

**Unit** `npx vitest run --project unit`: 49 files / 1012 tests (13 new in
`lv-core/__tests__/ecosystem.test.ts` — entity codes and parsing, the code
allocator under collision, contention and the 999999 ceiling, both lifecycle
tables incl. human-only / reason-required / same-status refusals, partner and
listing readiness with exact missing requirements, onboarding → partner /
listing mapping, idempotent creation on replay, reuse without downgrading an
ACTIVE partner, race → the loser reads the winner; the dashboard request-budget
test raised by the three GROUP BY documents the ecosystem summary adds).

**Integration** `--project integration --no-file-parallelism` against the live
server with real sessions: 8 files / 61 tests, 9 new in
`lv-ecosystem.integration-test.ts` (API-key refusal on all six routes; reviewer
approval → partner LVP code, APPROVED, contact person + organisation linked,
lead ↔ partner, DRAFT property with the onboarding's data, lead status mirror,
audit with the reviewer as actor; replayed approval creates no second partner;
Partner 360 as admin and as Hunter + Lead 360 ecosystem panel; ten security
refusals — actor spoof, guessed id, unauthorised status change / approval /
owner change / listing creation, DRAFT → LIVE bypass, activation NOT_READY,
second activation SAME_STATUS, suspension without reason; property lifecycle
IN_REVIEW → READY → LIVE with a real uploaded image and the readiness gate;
partner activation → lead LIVE_ACTIVE and onboarding ACTIVATED; manual
experience with the duplicate decision; soft-deleted records NOT_FOUND).

**Browser** (`.notes/d9/d9-browser.mjs`, Playwright, real logins, fixtures
destroyed afterwards): 18 scenarios / 32 checks, ALL PASS — partner list and the
five views; manual partner with the duplicate decision; Partner 360 header,
readiness, onboarding, documents, relations, timeline, audit; experience list
and views; experience created from Partner 360; Experience 360 with submit →
approve from the page; property list and views; property created; Property
360; onboarding record state; approval in the browser as the Onboarding Expert
→ partner appears; Lead 360 ecosystem panel; partner → listing relations;
readiness NOT_READY → READY → Activate → lead LIVE_ACTIVE; Onboarding Expert and
Hunter restrictions incl. a spoofed actor refused and audited; six widths with
zero horizontal overflow; dark mode. Screenshots in `.notes/d9/shots/`. Filtered
console output: only Twenty's own Apollo "Missing field … provider" warning.

**Regression after the change** (2026-09-16): Day 5 `regress/d5-browser.mjs`
38/38; Day 6 `d6/d6-browser.mjs` 32/32; Day 7 `d7/d7-browser.mjs` 34/34 (its
datetime helper now sets the input value directly — typing `PM` into the
12-hour field was dropped by the sandbox in afternoon runs); Day 8
`d8/d8-browser.mjs` 9/9 (S3 re-run after one sandbox keystroke drop). Unit,
integration, `tsc --noEmit` and `oxlint` clean. Zero core files changed.

## Day 10 — final V1 verification, real AI provider, production readiness

**REAL PROVIDER vs MOCK.** `lv-ai/__tests__/ai-provider.test.ts` (22 unit tests)
drives the provider with a fake transport. `src/__tests__/lv-ai-real-provider.integration-test.ts`
calls OpenAI for real when `LV_AI_API_KEY` is in the environment (12 steps). Result
on 2026-09-16: initialisation, authentication (wrong key → 401 →
`AI_REQUEST_REJECTED`, one attempt, key absent from the message), unsupported
model, network failure, unconfigured provider — **5 PASS**; text generation,
structured output, classification, summarisation, timeout and invalid-response —
**7 BLOCKED**: the OpenAI account answers `429 insufficient_quota`
(`credit_balance_exhausted`). The steps are reported as skipped with the code,
never as passed.

**AI matrix (live routes, real sessions)** `src/__tests__/lv-ai-day10.integration-test.ts`
(14 tests): PRIVACY ×3 (a Hunter cannot make any AI route reach a lead CM-004
hides; spoofed ownerId / actorWorkspaceMemberId / isAdmin ignored; API keys
refused), COPILOT security (forbidden record, cross-user rows, delete / merge /
approve / reject / price / send / reassign refused with the human path, SQL / key /
escalation requests answered UNSUPPORTED or REFUSED without leakage, empty result),
K data quality, C/D/G rules score / health / NBA — **6 PASS**; A classification,
B summary, F conversation summary, H draft, I onboarding assistant, J briefing,
L Copilot model fallback, M visiting-card OCR — **8 BLOCKED** (same quota).

**Provider fix found by the real test:** an exhausted balance was retried as a
rate limit and reported `AI_RETRY_EXHAUSTED`. New code `AI_QUOTA_EXHAUSTED`
(no retry, clear message); unit test added (1013 unit tests).

**Regression** (after the Day 10 changes, same day): unit 49 files / 1013 passed;
integration 10 files / 87 tests — 72 passed, 0 failed, 15 blocked (OpenAI
credits); browser Day 5 38/38, Day 6 32/32 (three checks made provider-aware),
Day 7 34/34, Day 8 29/29, Day 9 31/31; `tsc --noEmit` and `oxlint` clean.

### Day 10 addendum — provider migration to Gemini

The primary provider became Google Gemini (`LV_AI_PROVIDER=gemini`, model
`gemini-2.5-flash`) through the unchanged `AiProvider` contract; the Gemini
dialect lives beside the OpenAI and Anthropic ones in `HttpChatProvider`. Mock
unit tests (`ai-provider.test.ts`, 31): wire format (model in the path, key in
`x-goog-api-key`, system instruction, JSON mime type, thinking off, images as
`inlineData`), invalid key → `AI_REQUEST_REJECTED` without retry, per-minute 429 →
retry → success, per-day 429 → `AI_QUOTA_EXHAUSTED`, safety block / token cap /
empty candidate, schema validation and label allowlist identical to other
dialects. Unit total: 49 files / 1022.

REAL PROVIDER (`lv-ai-real-provider.integration-test.ts`, 13 steps, Gemini key
from the environment) — **12 PASS + 1 skipped-by-design** on `gemini-3.6-flash`
and again on `gemini-3.5-flash-lite`: init · authentication (a wrong key is
refused as invalid credentials, the real key is not) · text (65 chars, 21/13
tokens) · structured JSON `{city: Goa, count: 3}` · classify STAY 0.95 ·
summarise · invalid key → `AI_REQUEST_REJECTED` in one attempt · unsupported
model · real timeout → `AI_TIMEOUT` at 2 s · validator refusal →
`AI_INVALID_RESPONSE` · network → `AI_UNAVAILABLE` · unconfigured. (Two earlier
keys from a project Google had denied were refused with 403 on every model —
recorded, not a CRM defect.)

Day 10 AI matrix under Gemini (`lv-ai-day10`, 14 tests): all 14 have passed with
**REAL OUTPUT**, spread over three runs because the free tier allows 20
requests per day per model — A classification (STAY / FARM_STAY, confidence 1,
accepted → lead written → single-shot), B summary (240 chars, 4 citations all
from context, 0 dropped, run row SUCCESS with tokens and no contact values),
F conversation (MIXED, commitments, PRICING objection → applied to the
interaction; note-less interaction → `INSUFFICIENT_DATA` before any call),
H draft (subject + 450-char body, nothing sent), I onboarding assistant
(rewrite, "maintained all original facts", missing-information list, written
only on Accept), J briefing (`MODEL`, grounded refs), L Copilot model intent
(`QUERY_MODEL`, 0 rows leaked; ambiguous / unsupported → REFUSED), M OCR (all
ten card fields read with confidence 1, no lead created; blank image → no
invented value), plus PRIVACY ×3, COPILOT security, K, C/D/G. Day 6 live suite
7/7, capture suite 10/10. Typecheck and lint clean. Browser: the Day 6 suite
(the only one naming the provider header) 32/32; the Intelligence tab shows a
real AI GENERATED summary labelled `gemini · gemini-3.5-flash-lite`.
