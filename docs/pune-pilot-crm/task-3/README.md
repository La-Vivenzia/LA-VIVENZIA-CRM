# Task 3 — Pune Pilot Sandbox Lead Import Documentation

**Repository:** `LA-VIVENZIA-CRM`
**Feature Branch:** `feature/shlok-pune-pilot-crm`
**Base Commit (Task 1):** `1c8492aa`
**Base Commit (Task 2):** `89d8cb2d`
**Current Status:** `IMPLEMENTED — READY FOR REVIEW`

---

## 1. Overview & Objective

Task 3 of the Pune Pilot CRM sprint implements the **“Load Pune Pilot Sandbox”** feature directly within `ImportScreen.tsx` in `packages/lv-app`.

The purpose of this feature is to allow Experience Hunters, Lead Coordinators, and testers to instantly populate the CRM with **12 clearly fictional sandbox venues** situated across the four target operational pilot zones in Eastern Pune (**Amanora Mall**, **Seasons Mall**, **Magarpatta City**, and **Hadapsar**) and mapped to all five curated pilot vibes (**Gaming & Arcade**, **Brewery & Nightlife**, **Work Cafe**, **Luxury Spa**, and **Fine Dining**).

---

## 2. Architecture & Technical Design

### A. Idempotency & Duplicate Protection
1. **Deterministic Import Key:** The sandbox import utilizes a fixed, deterministic UUIDv5/UUID constant:
   ```ts
   export const PUNE_PILOT_SANDBOX_IMPORT_KEY = '7f9c2d18-3a81-4b72-9b04-8e1c64df3310';
   ```
2. **Backend Key-Based Deduplication:** The `/capture/import/commit` logic function assigns each lead `captureKey = ${importKey}:${rowNumber}`. When `findLeadByCaptureKey` detects an existing lead matching this key, it reports `status: 'EXISTS'` instead of duplicating the database record.
3. **Client-Side Rapid-Click Guard:** While `isSandboxLoading` is active, the button renders `Loading sandbox leads…` with `disabled={true}`, rejecting any secondary in-flight submissions.

### B. Integration with the Existing Import Flow
- **Direct Commit Workflow:** Clicking "Load Pune Pilot Sandbox" bypasses the need for an external CSV file upload by passing structured rows directly to `/capture/import/commit`.
- **Result Summary:** Transitions the user directly to `ResultStep`, displaying KPI tiles for `Created`, `Skipped`, `Already imported`, and `Failed`.
- **Error Recovery & Retry:** If an API or network error occurs, `useImport` catches the exception, displays an `ErrorState` banner with the server's message, and configures the retry button to re-invoke `loadSandbox()`.
- **CSV Companion Export:** A secondary button ("Download Sandbox CSV") generates a compliant RFC-4180 CSV file containing all 12 records, allowing users to also test the manual file-upload dropzone and column-mapping wizard.

---

## 3. Fictional Sandbox Dataset (12 Records)

Every record is clearly marked with `[Sandbox]` in its title, uses non-deliverable `@*.sandbox.lavivenzia.internal` emails, test phone numbers (`+91 98220 000XX`), and internal sandbox URIs.

| # | Venue Name | Pilot Zone | Category / Subcategory | Pilot Vibe | Safe Contact Email |
|---|---|---|---|---|---|
| **2** | Neon Byte Arcade [Sandbox] | `AMANORA_MALL` | `BUSINESS_PARTNER` / `ARCADE` | Gaming & Arcade | `contact@neonbyte.sandbox.lavivenzia.internal` |
| **3** | The Saffron Table Fine Dining [Sandbox] | `AMANORA_MALL` | `BUSINESS_PARTNER` / `FINE_DINING` | Fine Dining | `reservations@saffrontable.sandbox.lavivenzia.internal` |
| **4** | Desk & Drip Co-Working Cafe [Sandbox] | `AMANORA_MALL` | `BUSINESS_PARTNER` / `WORK_CAFE` | Work Cafe | `hello@deskanddrip.sandbox.lavivenzia.internal` |
| **5** | Velocity VR Arena [Sandbox] | `SEASONS_MALL` | `BUSINESS_PARTNER` / `ARCADE` | Gaming & Arcade | `play@velocityvr.sandbox.lavivenzia.internal` |
| **6** | Nirvana Ananda Luxury Spa [Sandbox] | `SEASONS_MALL` | `BUSINESS_PARTNER` / `LUXURY_SPA` | Luxury Spa | `concierge@nirvanaananda.sandbox.lavivenzia.internal` |
| **7** | The Seasons Executive Suites [Sandbox] | `SEASONS_MALL` | `STAY` / `BOUTIQUE_STAY` | Boutique Stay | `stay@seasonssuites.sandbox.lavivenzia.internal` |
| **8** | The Hoppy Fox Craft Brewery [Sandbox] | `MAGARPATTA_CITY` | `BUSINESS_PARTNER` / `BREWERY` | Brewery & Nightlife | `taproom@hoppyfox.sandbox.lavivenzia.internal` |
| **9** | Roasted Bean Work Cafe [Sandbox] | `MAGARPATTA_CITY` | `BUSINESS_PARTNER` / `WORK_CAFE` | Work Cafe | `brew@roastedbean.sandbox.lavivenzia.internal` |
| **10** | Château Pune Heritage Dining [Sandbox] | `MAGARPATTA_CITY` | `BUSINESS_PARTNER` / `FINE_DINING` | Fine Dining | `curator@chateaupune.sandbox.lavivenzia.internal` |
| **11** | Hadapsar Taproom & Social [Sandbox] | `HADAPSAR` | `BUSINESS_PARTNER` / `BAR_LOUNGE` | Brewery & Nightlife | `social@hadapsartaproom.sandbox.lavivenzia.internal` |
| **12** | Aura Wellness & Spa Sanctuary [Sandbox] | `HADAPSAR` | `BUSINESS_PARTNER` / `LUXURY_SPA` | Luxury Spa | `care@aurasanctuary.sandbox.lavivenzia.internal` |
| **13** | Hadapsar Heritage Courtyard [Sandbox] | `HADAPSAR` | `STAY` / `HERITAGE_PROPERTY` | Heritage Stay | `booking@hadapsarcourtyard.sandbox.lavivenzia.internal` |

---

## 4. Files Created and Modified

| File Path | Change Type | Purpose |
|---|---|---|
| `packages/lv-app/src/fixtures/pune-pilot-sandbox.ts` | **New** | 12 fictional sandbox venues, deterministic import key, row generator, and CSV exporter. |
| `packages/lv-app/src/fixtures/__tests__/pune-pilot-sandbox.test.ts` | **New** | 12 automated unit tests for dataset size, determinism, taxonomy alignment, safety, and CSV formatting. |
| `packages/lv-app/src/screens/__tests__/pune-pilot-sandbox-import.test.ts` | **New** | 12 automated tests for hook workflow, idempotency, repeat-click protection, error recovery, and UI controls. |
| `packages/lv-app/src/api/import.ts` | **Modified** | Added `isSandboxLoading` state, `loadSandbox()` workflow action, and `willCreate` count fallback. |
| `packages/lv-app/src/screens/ImportScreen.tsx` | **Modified** | Wired retry handler on `ErrorState` to invoke `loadSandbox()` when error occurs on sandbox file. |
| `packages/lv-app/src/screens/import/steps.tsx` | **Modified** | Rendered Pune Pilot Sandbox Card on `SelectStep` with primary load button, CSV download, and venue disclosure. |
| `docs/pune-pilot-crm/task-3/README.md` | **Modified** | Master technical specification, architectural decisions, and verification records for Task 3. |

---

## 5. Automated Test Results

### A. Task 3 Focused Suite (24 tests)
```powershell
.\node_modules\.bin\vitest.cmd run -c packages/lv-app/vite.config.ts packages/lv-app/src/fixtures/__tests__/pune-pilot-sandbox.test.ts packages/lv-app/src/screens/__tests__/pune-pilot-sandbox-import.test.ts
```
* **Exit Code:** `0`
* **Result:** `2 passed (2 test files), 24 passed (24 tests)`
* **Duration:** `2.58s`

### B. Full Frontend Regression Suite (271 tests)
```powershell
.\node_modules\.bin\vitest.cmd run -c packages/lv-app/vite.config.ts packages/lv-app/src
```
* **Exit Code:** `0`
* **Result:** `20 passed (20 test files), 271 passed (271 tests), 0 failed, 0 skipped`
* **Status:** `100% GREEN`

### C. Static Analysis: TypeScript Typecheck & Oxlint
```powershell
# Typecheck
.\node_modules\.bin\tsc.cmd --noEmit -p packages/lv-app/tsconfig.json
# Exit code: 0 (0 errors)

# Linter
.\node_modules\.bin\oxlint.cmd -c packages/twenty-apps/internal/lavivenzia-crm/.oxlintrc.json packages/lv-app/src
# Exit code: 0 (0 warnings, 0 errors across 118 files)
```

### D. Whitespace and Git Integrity
```powershell
git diff --check
# Exit code: 0 (0 whitespace / EOF errors)
```

---

## 6. Manual QA Checklist & Verification Protocol

> [!IMPORTANT]
> Local browser QA and staging persistence have **NOT YET BEEN RUN** (`NOT RUN`). Backend services (Postgres, Redis, Twenty server) were offline locally, and database migrations/metadata synchronisation were strictly prohibited. All checklist items below represent upcoming verification steps to be executed upon deployment to staging.

| Test ID | Scenario / Verification Step | Expected Result | Status |
|---|---|---|---|
| `QA-T3-01` | Open Import screen (`/import`) | Screen loads on `SELECT` step with "Choose the file" and "Pune Pilot Sandbox" cards. | `NOT RUN` |
| `QA-T3-02` | Inspect Pune Pilot Sandbox card | Explanatory copy, demo data warning, and action buttons render clearly. | `NOT RUN` |
| `QA-T3-03` | Expand "View the 12 sandbox venues" disclosure | 12 venues render with pilot zone and subcategory badges. | `NOT RUN` |
| `QA-T3-04` | Click "Download Sandbox CSV" | Browser downloads `pune-pilot-sandbox-leads.csv` with valid RFC-4180 header and 12 rows. | `NOT RUN` |
| `QA-T3-05` | Click "Load Pune Pilot Sandbox" | Button transitions to `Loading sandbox leads…` (disabled); request submits to `/capture/import/commit`. | `NOT RUN` |
| `QA-T3-06` | Rapid double-click on load button | Only one network request is dispatched; second click ignored while in-flight. | `NOT RUN` |
| `QA-T3-07` | Successful sandbox load | Screen transitions to `RESULT` step; KPI tiles show `12 Created`, `0 Skipped`, `0 Failed`. | `NOT RUN` |
| `QA-T3-08` | Click "See them in Leads" on result screen | Navigates to `/leads`; leads display in table matching pilot zones and vibes. | `NOT RUN` |
| `QA-T3-09` | Repeat click after initial sandbox load | Subsequent load reports `12 Already imported` via idempotency; zero duplicate rows created. | `NOT RUN` |
| `QA-T3-10` | Network failure simulation | Displays `ErrorState` banner with retry button; clicking retry re-invokes `loadSandbox()`. | `NOT RUN` |
| `QA-T3-11` | Drag & drop downloaded sandbox CSV into dropzone | Standard file upload flow initiates, auto-maps columns, validates, and allows manual review. | `NOT RUN` |
| `QA-T3-12` | Mobile viewport (390px) | Sandbox card, buttons, and disclosure wrap vertically without horizontal overflow. | `NOT RUN` |

---

## 7. Sign-Off & Release Readiness

- [x] Fictional sandbox dataset (12 records across 4 zones and 5 vibes) created
- [x] "Load Pune Pilot Sandbox" action and CSV download implemented
- [x] Idempotency and rapid-click protection verified
- [x] 24 focused automated tests passing with exit code 0
- [x] Full frontend regression test suite passing 100% green (271 passing, 0 failed, 0 skipped)
- [x] TypeScript typecheck passed (0 errors)
- [x] Oxlint passed (0 warnings, 0 errors)
- [x] Git diff check passed (0 whitespace errors)
- [ ] Manual browser QA passed on staging environment (NOT RUN)
- [ ] Staging database persistence verified (NOT RUN)
- [ ] Code review sign-off by Karan (PENDING)
