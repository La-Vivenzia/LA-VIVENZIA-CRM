# Task 1 Release Readiness & Handover Protocol â€” Pune Pilot CRM

**Document Version:** 1.0
**Date:** 2026-10-27
**Branch:** `feature/shlok-pune-pilot-crm`
**Base Commit:** `bd2ab74d86722d4347b8cfb51746d612b78511bd`
**Author:** Shlok Thorat (`shlokthorat-LA-VIVENZIA`)
**Target Reviewer:** Karan / Engineering Leadership
**Overall Readiness Status:** **`READY FOR HUMAN REVIEW`**

---

## Table of Contents
1. [Executive Readiness Statement](#1-executive-readiness-statement)
2. [Sprint Status Matrix](#2-sprint-status-matrix)
3. [Verified Deliverables](#3-verified-deliverables)
4. [Automated Verification Evidence](#4-automated-verification-evidence)
5. [Known Baseline Failure Analysis](#5-known-baseline-failure-analysis)
6. [Outstanding Dependencies & Limitations](#6-outstanding-dependencies--limitations)
7. [Staging Deployment & Verification Protocol](#7-staging-deployment--verification-protocol)
8. [Safe Cleanup Guidelines for Temporary QA Data](#8-safe-cleanup-guidelines-for-temporary-qa-data)
9. [Final Sign-Off Criteria](#9-final-sign-off-criteria)

---

## 1. Executive Readiness Statement

The Task 1 implementation (Pune Pilot Leads Zone/Vibe Filters and Capture Pilot Zone) has met all code-quality, architectural, typing, and automated testing criteria.

All 53 newly added automated tests pass with 100% success rate across frontend and backend packages. No regressions exist across the 1,336 passing automated tests in the workspace (1,126 backend + 210 frontend). Static analysis reports 0 TypeScript errors and 0 Oxlint warnings. The codebase is fully prepared for peer review, merge to the integration branch, and deployment to staging.

---

## 2. Sprint Status Matrix

| Component / Evaluation Gate | Status | Evidence / Notes |
|---|---|---|
| **Feature Implementation** | **`IMPLEMENTED`** | All required pills, dropdowns, taxonomy, schemas, and contracts are in code |
| **Automated Unit & Contract Tests** | **`AUTOMATED TESTS PASSED`** | **53/53 new tests passed** (45 frontend + 8 backend); 1,336 total passed across workspace (1,126 backend + 210 frontend) |
| **TypeScript Typecheck** | **`PASSED`** | `tsc -p packages/lv-app/tsconfig.json --noEmit` exited `0` (0 errors) |
| **Frontend Linter (Oxlint)** | **`PASSED`** | 113 files checked with 13 rules; 0 warnings, 0 errors |
| **Backend Linter (Oxlint)** | **`PASSED`** | 437 files checked with 13 rules; 0 warnings, 0 errors |
| **Git Diff Whitespace Check** | **`PASSED`** | `git diff --check` exited `0` (no whitespace or conflict issues) |
| **Manual Human Verification** | **`MANUAL TESTING PENDING`** | 41 manual test cases documented in `task-1-pune-pilot-crm-manual-qa.md` marked `NOT RUN` |
| **Database Metadata Synchronization** | **`METADATA SYNC PENDING`** | Physical column creation on PostgreSQL requires `syncApplication` on deployment |
| **Staging Physical Persistence** | **`STAGING PERSISTENCE NOT VERIFIED`** | Deferred to staging deployment per safety rules prohibiting local DB mutation |

---

## 3. Verified Deliverables

1. **Leads Screen Zone Quick-Filters (`/leads`):**
   * Horizontal segmented pills for `All`, `Amanora Mall`, `Seasons Mall`, `Magarpatta City`, `Hadapsar`.
   * Real-time filtering composed with search, views, and vibes.
   * Clean URL query parameter sync (`?zone=...`).
2. **Leads Screen Vibe Quick-Filters (`/leads`):**
   * Horizontal segmented pills for `All`, `Gaming & Arcade`, `Brewery & Nightlife`, `Work Cafe`, `Luxury Spa`, `Fine Dining`.
   * Explicit subcategory mapping complying with Rule 7 ("evidence over assumptions").
   * Clean URL query parameter sync (`?vibe=...`).
3. **Capture Pilot Zone Dropdown (`/capture`):**
   * Mandatory `LvSelect` under Step 3 ("Where they are").
   * Enforced validation (`canReview`) gating progression to duplicate check and lead creation.
   * State preservation across step navigation.
4. **Backend Schema & Contract:**
   * Universal identifier `LEAD_PILOT_ZONE_FIELD_ID = '9f223515-83d3-5708-8d6d-16b0e39affac'`.
   * Deterministic UUIDv5 option IDs in `select-options.generated.ts`.
   * Server-boundary validation and normalization in `capture-request.ts`.
   * Safe mapping through `buildLeadDraft` to `leadCreateData`.
5. **Schema Resilient Fallback:**
   * Two-tier query fallback (`FALLBACK_LIST_QUERY`) ensuring frontend does not crash if GraphQL metadata sync is pending.

---

## 4. Automated Verification Evidence

* **Execution Status Note:** The test outputs below represent the comprehensive suite execution performed and verified during the Task 1 QA session on commit `bd2ab74d86722d4347b8cfb51746d612b78511bd`. They are documented here for audit and release verification.

* **Focused Frontend Tests (Task 1):**
  `.\node_modules\.bin\vitest.cmd run -c packages/lv-app/vite.config.ts packages/lv-app/src/domain/__tests__/ packages/lv-app/src/screens/__tests__/ packages/lv-app/src/api/__tests__/capture-zone.test.ts`
  **Result:** 4 files passed, **45 passed (45 individual tests)**, duration: 808ms, exit code: `0`.
* **Focused Backend Tests (Task 1):**
  `.\node_modules\.bin\vitest.cmd run --root packages/twenty-apps/internal/lavivenzia-crm packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-capture/__tests__/pilot-zone-capture.test.ts`
  **Result:** 1 file passed, **8 passed (8 individual tests)**, duration: 1.48s, exit code: `0`.
* **Combined New Task 1 Tests:**
  **53 passed out of 53 tests (100% pass rate)**.
* **Full Backend Regression Suite:**
  `.\node_modules\.bin\vitest.cmd run --root packages/twenty-apps/internal/lavivenzia-crm`
  **Result Breakdown:**
  * **Test Files:** 57 passed, 9 skipped (66 total files).
  * **Individual Tests:** **1,126 passed, 88 skipped, 0 failed (1,214 total tests)**.
  * *Note: The 88 skipped tests are integration tests requiring a live database connection.*
  * Duration: 13.58s, exit code: `0`.
* **Full Frontend Regression Suite:**
  `.\node_modules\.bin\vitest.cmd run -c packages/lv-app/vite.config.ts packages/lv-app/src`
  **Result Breakdown:**
  * **Test Files:** 15 passed, 1 failed (16 total files).
  * **Individual Tests:** **210 passed, 1 failed (211 total tests)**.
  * Duration: 1.68s, exit code: `1`.
  > [!WARNING]
  > **Suite Status Note:** The full frontend test suite is **not entirely green** due to a single pre-existing baseline failure in `packages/lv-app/src/design/__tests__/design-system.test.ts:204`. This failure predates Task 1 and is detailed below.

---

## 5. Known Baseline Failure Analysis

* **Failing Test:** `packages/lv-app/src/design/__tests__/design-system.test.ts:204`
* **Assertion:** `.lv-sidebar has no phone rule: expected '\n /* The scheme has to reach the â€¦' to contain '.lv-sidebar'`
* **Analysis & Verification:**
  * Verified to be a **pre-existing baseline failure** present on commit `bd2ab74d86722d4347b8cfb51746d612b78511bd` prior to any Task 1 modifications.
  * Caused by a responsive style token check mismatch in legacy design system tests; unrelated to leads, capture, or zone/vibe filters.
  * In strict adherence to non-negotiable repository audit rules ("Do not weaken, skip, delete, or rewrite existing tests merely to make the suite pass"), this test remains untouched and preserved.

---

## 6. Outstanding Dependencies & Limitations

1. **Metadata Synchronization:**
   The `pilotZone` field is fully declared in code (`lead.object.ts`), but physical database columns in PostgreSQL and Twenty's dynamic GraphQL schema reflection require executing Twenty's application sync mutation (`syncApplication`).
2. **Authorized Execution Requirement:**
   Only an authorized environment owner or lead DevOps engineer may execute database migrations or metadata synchronization in integration and staging environments.
3. **Staging Environment Access:**
   End-to-end database writes cannot be verified on local environments without modifying database state. Staging deployment will provide the target database for final integration sign-off.
4. **Preserved File:**
   The untracked developer helper script `setup_lavivenzia_app.js` must remain untouched and uncommitted.

---

## 7. Staging Deployment & Verification Protocol

When merging and deploying to the staging environment, the DevOps / Lead engineer should execute the following sequence:

1. **Merge & Pull:**
   Merge `feature/shlok-pune-pilot-crm` into `main` / staging branch following human code review.
2. **Build Workspace:**
   ```bash
   yarn nx build twenty-shared
   node packages/twenty-sdk/dist/cli.cjs dev:build packages/twenty-apps/internal/lavivenzia-crm
   ```
3. **Execute Metadata Synchronization (Authorized Environment Owner Only):**
   An authorized environment owner runs the Twenty metadata synchronization command to apply `lavivenzia-crm` manifest updates to the database:
   ```bash
   # Executes metadata registration for pilotZone on lvLead
   yarn nx command twenty-server sync-application lavivenzia-crm
   ```
4. **Execute Manual QA Checklist:**
   Execute all 41 test cases (`TC-ZONE-01` through `TC-RESP-02`) documented in [task-1-pune-pilot-crm-manual-qa.md](./task-1-pune-pilot-crm-manual-qa.md).
5. **Verify Database Persistence:**
   Confirm through the Twenty CRM interface or authorized administrative inspection tools that `pilotZone` is populated alongside `location` and `name` without data loss.

---

## 8. Safe Cleanup Guidelines for Temporary QA Data

During staging verification, testers will create temporary fictional leads (e.g. `QA_TEMP_Amanora_01`). To maintain database cleanliness and prevent unintended data loss:

1. **Explicit Fictional Identifiers:** All temporary test records must use the designated fictional prefixes and identifiers (such as `QA_TEMP_Amanora_01`).
2. **Track Created Record IDs:** Testers must record the exact record IDs created during manual QA runs.
3. **ID-Targeted Cleanup Only:** Cleanup must target only individually verified QA record IDs through an approved mechanism (such as the standard UI lead archive/delete action or authorized administrator tools).
4. **Prohibition of Broad Deletions:** Broad wildcard SQL deletion queries (e.g. `WHERE name LIKE ...`), table truncations, or cascading purge scripts are **strictly prohibited** in all environments.
5. **Authorized Operations:** Metadata synchronization, schema alterations, and administrative database cleanup must only be performed by an authorized environment owner. Never modify or delete seeded workspace records.

---

## 9. Final Sign-Off Criteria

Task 1 is declared **Fully Production Ready** once:
- [ ] Code review completed and approved by Karan / Engineering Leadership (Pending human review).
- [x] Automated test suite passed with 0 feature-related regressions (53/53 new Task 1 tests passed).
- [x] TypeScript typecheck and Oxlint passed with 0 errors.
- [ ] Pull request merged to main/staging.
- [ ] Metadata synchronization (`syncApplication`) executed on staging environment by authorized environment owner.
- [ ] All 41 checklist items in `task-1-pune-pilot-crm-manual-qa.md` executed and marked `PASSED` on staging.
- [ ] Physical database persistence verified in PostgreSQL on staging.
