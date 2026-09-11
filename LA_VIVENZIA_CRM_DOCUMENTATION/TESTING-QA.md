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
