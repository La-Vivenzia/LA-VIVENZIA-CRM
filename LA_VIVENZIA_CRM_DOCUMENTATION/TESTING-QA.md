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
