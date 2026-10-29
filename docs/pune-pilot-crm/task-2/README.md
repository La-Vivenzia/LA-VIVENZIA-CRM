# Task 2 — Five-Stage Onboarding Tracker Documentation

**Repository:** `LA-VIVENZIA-CRM`
**Feature Branch:** `feature/shlok-pune-pilot-crm`
**Task 1 Checkpoint Commit:** `1c8492aa`
**Current Status:** `IMPLEMENTED — READY FOR REVIEW`

---

## 1. Overview & Objective

Task 2 of the Pune Pilot CRM sprint establishes a clean, unified **five-stage visual onboarding tracker** for `OnboardingRecordScreen.tsx` in `packages/lv-app`.

External partner onboarding (villa owners, chefs, venue hosts) is governed on the backend by an 11-status state machine in `lvOnboarding`. The previous UI mapped these statuses across a 6-stage stepper that split verification and review into separate visual steps.

Under **Option A**, the visual journey is unified into five linear stages matching the high-level E2E pipeline documented in `docs/IMPLEMENTATION-STATUS.md` line 250 (`invite → complete → verify → approve → activate`):

1. **Invited** (`invite`)
2. **With Partner** (`partner`)
3. **Under Review** (`review`)
4. **Approved** (`approved`)
5. **Live** (`live`)

---

## 2. Five-Stage Visual Taxonomy & Machine Status Mapping

### A. The Five Visual Stages
| # | Stage Key | Visual Label | Included Machine Statuses | Meaning & Tooltip Copy |
|---|---|---|---|---|
| **0** | `invite` | **Invited** | `NOT_STARTED`, `INVITED` | The partner has been asked to fill in their profile. |
| **1** | `partner` | **With Partner** | `INITIATED`, `IN_PROGRESS`, `WAITING_FOR_PARTNER`, `CHANGES_REQUESTED` | The partner is filling the form in, and can still edit it. |
| **2** | `review` | **Under Review** | `VERIFICATION`, `INTERNAL_REVIEW` | Submitted and locked. Verification and internal review in progress. |
| **3** | `approved` | **Approved** | `APPROVED` | Approved and waiting to go live. |
| **4** | `live` | **Live** | `ACTIVATED` | The partner is live on La Vivenzia. |

### B. Machine Status Resolution (`stageOf(status)`)
All 11 backend machine statuses are mapped deterministically via `stageOf`:

| Machine Status | Stage Index | Stage Key | Visual State | Editable Boundary |
|---|---|---|---|---|
| `NOT_STARTED` | `0` | `invite` | Current / Todo | Partner editable |
| `INVITED` | `0` | `invite` | Current / Todo | Partner editable |
| `INITIATED` | `1` | `partner` | Done (0), Current (1) | Partner editable |
| `IN_PROGRESS` | `1` | `partner` | Done (0), Current (1) | Partner editable |
| `WAITING_FOR_PARTNER` | `1` | `partner` | Done (0), Current (1) | Partner editable |
| `CHANGES_REQUESTED` | `1` | `partner` | Done (0), Current (1) | Partner editable |
| `VERIFICATION` | `2` | `review` | Done (0-1), Current/Blocked (2) | Locked for review |
| `INTERNAL_REVIEW` | `2` | `review` | Done (0-1), Current/Blocked (2) | Locked for review |
| `APPROVED` | `3` | `approved` | Done (0-2), Current (3) | Locked |
| `ACTIVATED` | `4` | `live` | Done (0-3), Current (4) | Terminal Live |
| `REJECTED` | `-1` | — | All Todo (0-4), Rejection Banner | Non-terminal (reapply) |

### C. Invariants & Safety Rules
1. **Unified Evaluation:** Both `VERIFICATION` (document checking) and `INTERNAL_REVIEW` (internal decision) resolve to stage index `2` (`Under Review`), eliminating intermediate stepper flicker.
2. **Distinct Go-Live Boundaries:** `APPROVED` (index `3`) and `ACTIVATED` (index `4`) remain distinct stages. Approval requires a named reviewer and all documents verified; Activation puts the partner live.
3. **Re-Application Handling for `REJECTED`:** `REJECTED` returns `-1` from `stageOf` and is explicitly excluded from `ONBOARDING_JOURNEY`. When a record is rejected:
   - Stepper stages remain in `todo` (none falsely marked `done`, `current`, or `approved`).
   - A dedicated rejection notice renders alongside the stepper stating when it was rejected and that the partner can reapply (`ONBOARDING_TRANSITIONS.REJECTED = ['IN_PROGRESS']`).
4. **Stopping vs Non-Stopping Blockers:**
   - Partner-editable reminders (`kind: 'PARTNER'`) do not block the stage display.
   - Genuine stopping blockers (`kind: 'DOCUMENT'`, `'ANSWER'`, `'REVIEWER'`) cause the active stage to render as `blocked` (warning glyph + blocker detail) and provide a direct navigation link to resolve the blocker.
5. **Defensive Guard on Transitions:** `blockersFor` employs null-coalescing (`ONBOARDING_TRANSITIONS[record.status] ?? []`) ensuring unexpected or malformed statuses do not cause unhandled runtime exceptions.
6. **Read-Only Visual State:** The stage tracker is purely declarative. All lifecycle transitions remain gated through the authorized `TransitionDialog` modal (`/onboarding/transition`) at the foot of the screen.

---

## 3. Files Modified and Added

| File Path | Change Type | Purpose |
|---|---|---|
| `packages/lv-app/src/api/onboarding.ts` | Modified | Updated `ONBOARDING_JOURNEY` to 5 stages; defensive `next` fallback in `blockersFor`. |
| `packages/lv-app/src/screens/onboarding/parts.tsx` | Modified | Extracted `journeyStepsFor` pure view-model function; updated `LvJourney` component. |
| `packages/lv-app/src/design/kit.tsx` | Modified | Restored mobile-first stylesheet structure by consolidating wide-screen and reduced-motion media queries into unified blocks. |
| `packages/lv-app/src/api/__tests__/onboarding-journey.test.ts` | New | 22 automated unit tests covering taxonomy, 11 statuses, edge cases, copy, and tone. |
| `packages/lv-app/src/screens/__tests__/onboarding-tracker.test.ts` | New | 14 automated unit tests covering stepper states, blockers, callbacks, and null safety. |
| `docs/pune-pilot-crm/task-2/README.md` | Modified | Master technical specification, test record, and manual QA protocol for Task 2. |

---

## 4. Automated Test Results

### A. Task 2 Focused Suite (36 tests)
```powershell
.\node_modules\.bin\vitest.cmd run -c packages/lv-app/vite.config.ts packages/lv-app/src/screens/__tests__/onboarding-tracker.test.ts packages/lv-app/src/api/__tests__/onboarding-journey.test.ts
```
* **Exit Code:** `0`
* **Result:** `2 passed (2 test files), 36 passed (36 tests)`
* **Duration:** `2.86s`

### B. Design-System Suite (28 tests)
```powershell
.\node_modules\.bin\vitest.cmd run -c packages/lv-app/vite.config.ts packages/lv-app/src/design/__tests__
```
* **Exit Code:** `0`
* **Result:** `2 passed (2 test files), 28 passed (28 tests)`
* **Duration:** `1.29s`

### C. Full Frontend Regression Suite (247 tests)
```powershell
.\node_modules\.bin\vitest.cmd run -c packages/lv-app/vite.config.ts packages/lv-app/src
```
* **Exit Code:** `0`
* **Result:** `18 passed (18 files), 247 passed (247 tests), 0 failed, 0 skipped`
* **Duration:** `6.12s`
* **Status:** `100% GREEN`

### D. Static Analysis: TypeScript Typecheck & Oxlint
```powershell
# Typecheck
.\node_modules\.bin\tsc.cmd --noEmit -p packages/lv-app/tsconfig.json
# Exit code: 0 (0 errors)

# Linter
.\node_modules\.bin\oxlint.cmd -c packages/twenty-apps/internal/lavivenzia-crm/.oxlintrc.json packages/lv-app/src
# Exit code: 0 (0 warnings, 0 errors across 115 files)
```

### E. Whitespace and Git Integrity
```powershell
git diff --check
# Exit code: 0 (0 whitespace / EOF errors)
```

---

## 5. Manual QA Checklist & Verification Protocol

> [!IMPORTANT]
> Local browser QA and staging persistence have **NOT YET BEEN RUN** (`NOT RUN`). Backend services (Postgres, Redis, Twenty server) were offline locally, and database migrations/metadata synchronisation were strictly prohibited. All checklist items below represent verification steps to be executed upon deployment to staging.

| Test ID | Scenario / Verification Step | Expected Result | Status |
|---|---|---|---|
| `QA-T2-01` | Open onboarding record in `NOT_STARTED` or `INVITED` | 5 visual stages rendered; `Invited` is current; stages 1-4 are todo. | `NOT RUN` |
| `QA-T2-02` | Open record in `IN_PROGRESS` or `WAITING_FOR_PARTNER` | Stage 0 `Invited` marked done; Stage 1 `With Partner` is current; 2-4 todo. | `NOT RUN` |
| `QA-T2-03` | Open record in `CHANGES_REQUESTED` with reason | Stage 1 is current; banner at top shows reason; badge shows `Changes requested`. | `NOT RUN` |
| `QA-T2-04` | Open record in `VERIFICATION` | Stages 0 and 1 marked done; Stage 2 `Under Review` is current; 3 and 4 todo. | `NOT RUN` |
| `QA-T2-05` | Open record in `INTERNAL_REVIEW` with unverified document | Stage 2 `Under Review` renders as `blocked` with amber warning and blocker text. | `NOT RUN` |
| `QA-T2-06` | Click blocker link on blocked Stage 2 | Navigation jumps straight to `documents` tab to inspect unverified items. | `NOT RUN` |
| `QA-T2-07` | Open record in `INTERNAL_REVIEW` with all verified documents | Stage 2 `Under Review` renders as `current` with stage meaning. | `NOT RUN` |
| `QA-T2-08` | Open record in `APPROVED` | Stages 0, 1, 2 marked done; Stage 3 `Approved` is current; Stage 4 is todo. | `NOT RUN` |
| `QA-T2-09` | Open record in `ACTIVATED` | Stages 0, 1, 2, 3 marked done; Stage 4 `Live` is current; partner live badge displayed. | `NOT RUN` |
| `QA-T2-10` | Open record in `REJECTED` | All 5 stages remain in todo; red rejection notice with timestamp shown; reapply possible. | `NOT RUN` |
| `QA-T2-11` | Responsive Layout (Desktop wide row vs Mobile 390px column stack) | Stepper flexes vertically on mobile without horizontal scroll or truncated labels; wraps cleanly on desktop. | `NOT RUN` |
| `QA-T2-12` | Transition Dialog Execution & Permission Restrictions | Primary action button triggers `TransitionDialog`; human-only transitions (`APPROVED`, `ACTIVATED`) refuse automated execution; tracker remains read-only. | `NOT RUN` |
| `QA-T2-13` | Loading, Error, and Forbidden States | In-flight fetch displays `LoadingState` skeleton; 403 displays role-forbidden notice; network error displays retryable `ErrorState`. | `NOT RUN` |
| `QA-T2-14` | Onboarding Queue List Filtering & Stage Sorting | Queue screen (`OnboardingScreen.tsx`) displays rows sorted by 5-stage progression; `With the partner` filter matches stage 1; count pills match live records. | `NOT RUN` |

---

## 6. Sign-Off & Release Readiness

- [x] Architecture and 5-stage visual mapping implemented
- [x] Machine status invariants and transition guards preserved
- [x] 36 focused automated tests passing with exit code 0
- [x] 28 design-system automated tests passing with exit code 0
- [x] Full frontend regression test suite passing 100% green (247 passing, 0 failed, 0 skipped)
- [x] TypeScript typecheck passed (0 errors)
- [x] Oxlint passed (0 warnings, 0 errors)
- [x] Git diff check passed (0 whitespace errors)
- [ ] Manual browser QA passed on staging environment (NOT RUN)
- [ ] Staging database persistence verified (NOT RUN)
- [ ] Code review sign-off by Karan (PENDING)
