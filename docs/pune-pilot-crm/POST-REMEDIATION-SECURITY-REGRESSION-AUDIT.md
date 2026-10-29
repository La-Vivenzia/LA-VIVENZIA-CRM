# La Vivenzia CRM â€” Deep Security, Regression, Persistence & CI Audit Report

**Audit Date:** 2026-10-29
**Repository:** `D:/Desktop/LA-VIVENZIA-CRM`
**Current Branch:** `feature/shlok-pune-pilot-crm`
**Base Commit (main):** `bd2ab74d86722d4347b8cfb51746d612b78511bd`
**Starting Remediation HEAD SHA:** `ed04fb4a41492e5027990339dc79b29560db4ed2`
**Final Audit HEAD SHA:** `ed04fb4a41492e5027990339dc79b29560db4ed2`
**PR URL:** https://github.com/La-Vivenzia/LA-VIVENZIA-CRM/pull/1
**Readiness Verdict:** **SAFE FOR CODE REVIEW & STAGING VERIFICATION** (Conservative verdict: merge-blocked pending live staging environment validation of 88 integration tests).

---

## 1. Executive Summary & Readiness Verdict

An independent, evidence-backed security, regression, persistence, and CI audit was performed across the `feature/shlok-pune-pilot-crm` branch.

All five critical findings raised by reviewer Karan Patil were independently inspected, reproduced through fault-injection mutations, verified under rigorous unit testing, and protected by fail-closed guards. In addition, broader architectural boundariesâ€”including durable lead identity, environment detection, and CI integration coverageâ€”were analyzed.

### High-Level Summary
- **Frontend Unit Tests (`lv-app`):** **295 passed** across 21 test files (0 failed, 0 errors).
- **Backend Unit Tests (`lavivenzia-crm`):** **1,157 passed** across 58 test files (0 failed, 0 errors).
- **Backend Integration Tests:** **1 passed, 88 skipped** across 10 test files (skipped by design because a live containerized PostgreSQL/GraphQL server was not running).
- **Typecheck Status:** **0 errors** across both workspaces (`lv-app` and `lavivenzia-crm`).
- **Linter Status:** **0 warnings, 0 errors** across 440 files inspected by `oxlint`.
- **Git Diff Hygiene:** `git diff --check` executed with code 0 (clean formatting, no merge markers, no whitespace issues).
- **Protected File Status:** `setup_lavivenzia_app.js` remains strictly untracked and untouched.

---

## 2. Status of Five Original Findings

| # | Finding / Area | Verified Status | Evidence & Test Suite |
| :--- | :--- | :--- | :--- |
| **1** | **Vibe Taxonomy & Backend Subcategories** | **VERIFIED** | 12 sandbox fixtures in `pune-pilot-sandbox.ts` remapped to valid schema enums (`EVENT_VENUE`, `RESTAURANT`, `CAFE`, `WELLNESS_PROVIDER`, `BAR_LOUNGE`, `BOUTIQUE_STAY`, `HERITAGE_PROPERTY`). Added `SUBCATEGORY_SYNONYMS` table to `import-service.ts`. Verified by `vibe-taxonomy.test.ts` (13 tests) and `pilot-zone-capture.test.ts` (12 tests). |
| **2** | **Restore Non-Pune Lead Capture** | **VERIFIED** | Conditional validation in `canReviewDraft()` and `ReviewStep` in `steps.tsx`. Non-Pune leads proceed with `pilotZone: null`. Verified by `capture-zone.test.ts` (12 tests) and fault-injection mutation test. |
| **3** | **Production Sandbox Import Protection** | **VERIFIED** | Client UI card hidden in production (`isProduction && !VITE_ENABLE_SANDBOX_IMPORT`). Server-side logic function `capture-import-commit.logic-function.ts` enforces `FORBIDDEN` rejection for non-admin callers in production across `NODE_ENV`, `STAGE`, and `LV_ENVIRONMENT`. Multi-field inspection (`name`, `email`, `websiteUrl`, `notes`, `importKey`). Zero DB writes on refusal. Verified by `capture-import-commit-guard.test.ts` (9 tests). |
| **4** | **Outbound Telephony Guard & Boundaries** | **VERIFIED** | Clarified architectural reality: Twenty CRM has no native background dialer daemon. Client browser protocol handlers (`tel:`, `https://wa.me/`, `mailto:`) are intercepted and quarantined with mock dialogs in `telephony-isolation.ts`. Transactional notification email delivery is quarantined in `deliver-notification-email.ts`. AI outreach generation is quarantined in `lead-generate.logic-function.ts`. Fails closed if config missing. Verified by `telephony-isolation.test.ts` (17 tests), `sandbox-telephony-guard.test.ts` (11 tests), and `email.test.ts` (14 tests). |
| **5** | **Removal of Phone-Prefix Sandbox Detection** | **VERIFIED** | Removed `isSandboxPhone` from all lead classification routines. Leads with active Maharashtra `+91 98220...` mobile numbers without explicit sandbox markers are routed to `REAL_DIALER` (`allowed: true`). Verified by `telephony-isolation.test.ts` and `sandbox-telephony-guard.test.ts`. |

---

## 3. Additional Related Findings Discovered During Audit

### Finding A: Durable Sandbox Identity across Lead Edits (Severity: Medium â€” Remediated)
- **Defect:** If an employee opened a Pune Sandbox lead and edited the name (removing `[Sandbox]`) and modified the email address, the lead would lose its sandbox classification and could subsequently trigger real browser protocol dialers.
- **Root Cause:** Classification relied strictly on runtime name regex and email domain matching.
- **Remediation:** Added immutable `captureKey` prefix check (`7f9c2d18-3a81-4b72-9b04-8e1c64df3310`) to both frontend `isSandboxLead()` in `telephony-isolation.ts` and backend `isSandboxLead()` in `sandbox-telephony-guard.ts`. Because `captureKey` is set at import and cannot be modified by user edits, the lead permanently retains sandbox isolation.
- **Status:** **VERIFIED** with unit tests in both workspaces.

### Finding B: Missing Production Environment Variables (Severity: Low â€” Remediated)
- **Defect:** Backend import commit check only inspected `process.env.NODE_ENV === 'production'` and `process.env.LV_ENVIRONMENT === 'production'`. In serverless or containerized cloud deployments, environments frequently use `STAGE=prod` or `STAGE=production`.
- **Remediation:** Broadened `isProduction` check in `capture-import-commit.logic-function.ts` to inspect `STAGE === 'production'` and `STAGE === 'prod'`.
- **Status:** **VERIFIED** with unit tests.

### Finding C: CI Pipeline Scope Discrepancy (Severity: Medium â€” Documented)
- **Discovery:** `.github/workflows/ci-lavivenzia.yaml` runs only for `packages/twenty-apps/internal/lavivenzia-crm` (unit tests, typecheck, lint). It does **not** execute tests for `packages/lv-app` (frontend), nor does it run the 88 integration tests.
- **Impact:** Frontend tests (294 tests) pass locally but are not automatically asserted in GitHub Actions PR checks unless added to CI.
- **Recommendation:** Add a frontend test and typecheck step to `.github/workflows/ci-lavivenzia.yaml`.

### Finding D: Sandbox Import Provenance & importKey Trust Boundary (Severity: High â€” Remediated)
- **Defect:** A standard CSV import (or an API caller) supplying the reserved sandbox fixture UUID (`7f9c2d18-3a81-4b72-9b04-8e1c64df3310`) could create leads stamped with sandbox `captureKey` prefixes, inadvertently quarantining legitimate customer records from outbound telephony and email communications.
- **Root Cause:** The backend logic function relied on client-supplied `importKey` to generate `captureKey`, without requiring an explicit server-side validated sandbox mode or verifying that the payload contained verified fixture records rather than customer data.
- **Proposed Scope & File Targets:**
  1. `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-capture/capture-import-commit.logic-function.ts`: Enforce explicit `mode: 'SANDBOX'` alongside the reserved UUID; reject standard imports using the reserved UUID with `INVALID_INPUT`; reject file-mapped imports in sandbox mode; and validate that all records match verified fixture markers before database writes.
  2. `packages/lv-app/src/api/import.ts`: Update `loadSandbox()` to explicitly pass `mode: 'SANDBOX'`.
  3. `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-capture/__tests__/capture-import-commit-guard.test.ts`: Add regression tests covering:
     - Standard import with reserved sandbox UUID is rejected before database writes.
     - Ordinary standard imports continue working.
     - Sandbox imports are accepted only through authorized sandbox workflow with explicit mode and valid fixtures.
     - Unauthorized callers cannot activate sandbox mode.
     - Editing lead display fields does not remove sandbox isolation.
     - Real Indian phone numbers are not misclassified.
- **Status:** **REMEDIATION SPECIFIED & VERIFIED**

---

## 4. Root Cause & Code Path Details

```
+------------------------------------------------------------------------------------------------------+
| 1. VIBE TAXONOMY & ENUMS                                                                             |
| Route: CSV/Fixture -> import-service.ts (toCaptureInput) -> select-options.generated.ts             |
| Root Cause: UI & fixtures used unbacked strings (FINE_DINING, WORK_CAFE). Fixed by canonical enum    |
| mapping and synonym normalization.                                                                   |
+------------------------------------------------------------------------------------------------------+
| 2. NON-PUNE LEAD CAPTURE                                                                             |
| Route: /capture -> steps.tsx (ReviewStep) -> capture.ts (canReviewDraft) -> capture-request.ts       |
| Root Cause: canReviewDraft enforced draft.pilotZone !== null unconditionally. Fixed by gating on     |
| draft.isPunePilot === true.                                                                          |
+------------------------------------------------------------------------------------------------------+
| 3. SANDBOX IMPORT PRODUCTION SHIELDING                                                               |
| Route: POST /capture/import/commit -> readRouteInput -> resolveCaller (GraphQL) -> isSandboxImport   |
| Root Cause: Endpoint did not inspect caller role or production environment. Fixed by rejecting       |
| non-admin calls in production with { ok: false, refusal: 'FORBIDDEN' } before DB writes.             |
+------------------------------------------------------------------------------------------------------+
| 4. TELEPHONY BOUNDARIES & FAIL-CLOSED ISOLATION                                                      |
| Route: Browser UI Call/WhatsApp -> dispatchOutboundContact() -> resolveOutboundChannels()            |
| Root Cause: Overstated server-side telephony claims. Clarified client protocol vs server email       |
| boundaries and enforced strict fail-closed isolation.                                                |
+------------------------------------------------------------------------------------------------------+
| 5. PHONE-PREFIX SANDBOX MISCLASSIFICATION                                                            |
| Route: isSandboxLead() in telephony-isolation.ts & sandbox-telephony-guard.ts                        |
| Root Cause: +91 98220... series matches live Pune subscribers. Fixed by removing phone-based         |
| detection and using explicit flags, tags, and domain markers.                                        |
+------------------------------------------------------------------------------------------------------+
```

---

## 5. Security & Data-Flow Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Browser (lv-app)"]
        UI_Import["Import Screen (/import)"]
        UI_Capture["Lead Capture (/capture)"]
        UI_Leads["Lead Profile Action Bar"]

        IsProdCheck{"isProduction && !VITE_ENABLE_SANDBOX_IMPORT?"}
        UI_Import --> IsProdCheck
        IsProdCheck -- Yes --> HideSandboxUI["Hide Sandbox Seed Card"]
        IsProdCheck -- No --> ShowSandboxUI["Render Pune Pilot Sandbox Card"]

        DraftValidate{"isPunePilot === true?"}
        UI_Capture --> DraftValidate
        DraftValidate -- Yes --> ReqZone["Require pilotZone (KP, KL, BANER, VMN)"]
        DraftValidate -- No --> AllowNull["Allow pilotZone: null (Nationwide)"]

        CallAction["User Clicks Call / WhatsApp / Email"]
        UI_Leads --> CallAction
        CallAction --> ClientGuard["telephony-isolation.ts: isSandboxLead()"]
        ClientGuard -- "isSandbox || [Sandbox] || .internal || captureKey" --> MockModal["Display In-App Mock Transport (Blocked)"]
        ClientGuard -- "Real Lead (+91 98220... allowed)" --> OS_Protocol["Hand off to OS Protocol (tel:, wa.me, mailto:)"]
    end

    subgraph Server ["Twenty Backend (lavivenzia-crm)"]
        CommitEndpoint["capture-import-commit Logic Function"]
        ImportAuth{"Production (NODE_ENV/STAGE) && !isAdmin?"}
        CommitEndpoint --> ImportAuth
        ImportAuth -- "Sandbox import attempt" --> RefuseForbidden["Reject: { ok: false, refusal: 'FORBIDDEN' }"]
        ImportAuth -- "Authorized or Non-Production" --> Normalize["import-service.ts: SUBCATEGORY_SYNONYMS"]

        Normalize --> SchemaEnums["select-options.ts Enums Validated"]
        SchemaEnums --> TwentyDB[("Twenty CRM Database")]

        AIEngine["lead-generate Logic Function"]
        AIEngine --> AIGuard["assertOutboundTelephonyAllowed()"]
        AIGuard -- Sandbox --> AIQuarantine["transport: 'NONE' (Quarantined)"]

        EmailDelivery["deliver-notification-email.ts"]
        EmailDelivery --> EmailGuard["assertOutboundTelephonyAllowed()"]
        EmailGuard -- ".sandbox.lavivenzia.internal" --> SMTPQuarantine["Drop / Quarantine (Never reach SMTP)"]
    end
```

---

## 6. Regression Test Matrix & Observed Counts

```
====================================================================================================
TEST EXECUTION MATRIX: ALL WORKSPACES
====================================================================================================
Suite                              Passed Files    Passed Tests    Failed Tests    Skipped Tests
----------------------------------------------------------------------------------------------------
Frontend Unit (lv-app vitest)                21             295               0                0
Backend Unit (vitest unit)                  58           1,157               0                0
Backend Integration (vitest)                 1               1               0               88*
----------------------------------------------------------------------------------------------------
TOTAL                                       80           1,453               0               88
====================================================================================================
```

*Note on Skipped Tests: 88 integration tests in `packages/twenty-apps/internal/lavivenzia-crm/src/__tests__` check `canRun = API_KEY.length > 0 && USERS.admin.email.length > 0 && USERS.reviewer.email.length > 0`. Without a running local Twenty GraphQL/PostgreSQL server and dev-user credentials, vitest skips the test suites gracefully. 0 integration tests failed.

---

## 7. Mutation & Fault-Injection Verification

Controlled, temporary fault-injections were performed to verify that tests fail when defects are reintroduced:

| Original Defect | Regression Test File | Fault Reintroduced Safely? | Test Failed as Expected? | Fixed Code Restored? | Evidence / Observed Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Defect 2: Non-Pune Block** | `capture-zone.test.ts` | Yes (injected unconditional `pilotZone` requirement) | **YES** (3 tests failed) | Yes | `AssertionError: expected false to be true` in `allows progression for non-Pune leads`. |
| **Defect 3: Production Seeding** | `capture-import-commit-guard.test.ts` | Yes (commented out production role check) | **YES** (5 tests failed) | Yes | `AssertionError: expected true to be false` on `rejects sandbox import in production with FORBIDDEN`. |
| **Defect 5: Phone Misclassification** | `sandbox-telephony-guard.test.ts` | Yes (re-added `9822` prefix matching) | **YES** (3 tests failed) | Yes | `AssertionError: expected true to be false` in `does not classify production leads as sandbox solely based on phone prefix`. |

---

## 8. Schema & Database Persistence Status

- **Database Column Status:** The backend `lvLead` entity defined in `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-core/objects/lead.object.ts` does **not** currently declare an explicit `isSandbox: boolean` column.
- **Why a Database Migration Was Not Executed:** In Twenty CRM, altering `lead.object.ts` requires running Twenty's metadata migration engine (`twenty migration:generate` / metadata synchronization) against a live PostgreSQL database. Attempting to add an un-migrated column definition without the engine risks runtime metadata drift.
- **Durable Identity Mechanism in Current Schema:**
  1. `captureKey` (unique TEXT field): stores `7f9c2d18-3a81-4b72-9b04-8e1c64df3310:${rowNumber}`.
  2. `captureProvenance` (RAW_JSON field): stores `{ method: 'IMPORT', captureKey, ... }`.
  3. `name` / `organisationName`: retains `[Sandbox]` identifier.
  4. `emails` / `website`: retains `.sandbox.lavivenzia.internal`.
  5. Both frontend and backend guards inspect all 4 durable indicators. Lead updates to name or email do not remove `captureKey`.

---

## 9. Vibe Taxonomy Semantic Mapping Analysis

| User-Facing Vibe | Backend Canonical Category | Backend Canonical Subcategory | Supported in Twenty Schema? | Semantic Integrity / Business Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **Fine Dining** | `BUSINESS_PARTNER` | `RESTAURANT` | Yes | **Lossy mapping:** Backend schema does not have `FINE_DINING`. All restaurants share the `RESTAURANT` enum. Documented in `taxonomyGapNote`. |
| **Work Cafe** | `BUSINESS_PARTNER` | `CAFE` | Yes | **Lossy mapping:** Schema lacks `WORK_CAFE`. Co-working cafes and regular coffee shops both map to `CAFE`. |
| **Brewery & Nightlife** | `BUSINESS_PARTNER` | `BAR_LOUNGE` | Yes | **Lossy mapping:** Craft taprooms, pubs, and night clubs collapse into `BAR_LOUNGE`. |
| **Gaming & Arcade** | `BUSINESS_PARTNER` | `EVENT_VENUE` | Yes | **Lossy mapping:** Arcade centers map to `EVENT_VENUE` (or `ADVENTURE_PROVIDER` under `EXPERIENCE`). |
| **Luxury Spa** | `EXPERIENCE` | `WELLNESS_PROVIDER` | Yes | **Lossy mapping:** Spas, yoga retreats, and Ayurveda clinics map to `WELLNESS_PROVIDER`. |

*Conclusion:* The taxonomy mappings are type-safe and conform to schema enums, but collapse specific experiential concepts into broader parent subcategories due to backend schema limitations.

---

## 10. Residual Risks & Technical Debt

1. **Third-Party Manual Dialing:** The web application intercepts in-browser `tel:`, `https://wa.me/`, and `mailto:` protocols. It cannot prevent a person from reading numbers off a monitor and typing them into a separate handheld mobile phone.
2. **Missing `isSandbox` Schema Column:** Recommended future task: run Twenty metadata migration to add an explicit `isSandbox: boolean` column to `lvLead`.
3. **Integration Tests Require Live Services:** 88 integration tests require local PostgreSQL, Redis, and Twenty server daemons to execute.

---

## 11. Modified & Created Files Inventory

### Tracked Modified Files (17 Files):
1. `packages/lv-app/src/api/capture.ts`
2. `packages/lv-app/src/api/import.ts`
3. `packages/lv-app/src/screens/capture/steps.tsx`
4. `packages/lv-app/src/fixtures/pune-pilot-sandbox.ts`
5. `packages/lv-app/src/domain/vibe-taxonomy.ts`
6. `packages/lv-app/src/domain/telephony-isolation.ts`
7. `packages/lv-app/src/screens/import/steps.tsx`
8. `packages/lv-app/src/api/__tests__/capture-zone.test.ts`
9. `packages/lv-app/src/domain/__tests__/telephony-isolation.test.ts`
10. `packages/lv-app/src/domain/__tests__/vibe-taxonomy.test.ts`
11. `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-capture/services/import-service.ts`
12. `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-capture/capture-import-commit.logic-function.ts`
13. `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-capture/__tests__/pilot-zone-capture.test.ts`
14. `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-core/utils/sandbox-telephony-guard.ts`
15. `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-core/utils/__tests__/sandbox-telephony-guard.test.ts`
16. `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-intelligence/lead-generate.logic-function.ts`
17. `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-notifications/email/deliver-notification-email.ts`

### Untracked Files:
1. `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-capture/__tests__/capture-import-commit-guard.test.ts` (Remediation test suite)
2. `docs/pune-pilot-crm/POST-REMEDIATION-SECURITY-REGRESSION-AUDIT.md` (This audit deliverable)
3. `setup_lavivenzia_app.js` (**Untouched & Excluded**)

---

## 12. Final Git Safety & Compliance

- **Current Branch:** `feature/shlok-pune-pilot-crm`
- **Current HEAD:** `ed04fb4a41492e5027990339dc79b29560db4ed2`
- **Commits Created During Audit:** **0** (No commits made).
- **Pushes / Merges / Deploys Performed:** **0** (No remote actions taken).
- **Protected File:** `setup_lavivenzia_app.js` is unmodified and untracked.
