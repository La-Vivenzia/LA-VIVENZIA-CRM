# Task 1 Manual QA Checklist & Verification Protocol â€” Pune Pilot CRM

**Document Version:** 1.1
**Date:** 2026-10-27
**Branch:** `feature/shlok-pune-pilot-crm`
**Base Commit:** `bd2ab74d86722d4347b8cfb51746d612b78511bd`
**Auditor:** Shlok Thorat (`shlokthorat-LA-VIVENZIA`)
**Total Manual Test Cases:** **41 Unique Test Cases** (11 Zone, 10 Vibe, 6 Composition, 10 Capture, 4 Accessibility & Responsive)
**Execution Note:** All 41 manual test cases are currently designated **`NOT RUN`**. They have not been executed on a live browser or staging database. They are ready for human verification following staging deployment and backend metadata synchronization.

---

## Table of Contents
1. [Overview and Testing Guidelines](#1-overview-and-testing-guidelines)
2. [Proposed Fictional QA Dataset](#2-proposed-fictional-qa-dataset)
3. [Section A: Leads Zone Filters Checklist (11 Cases: TC-ZONE-01 to TC-ZONE-11)](#3-section-a-leads-zone-filters-checklist)
4. [Section B: Leads Vibe Filters Checklist (10 Cases: TC-VIBE-01 to TC-VIBE-10)](#4-section-b-leads-vibe-filters-checklist)
5. [Section C: Filter Composition, Search & Saved Views (6 Cases: TC-COMP-01 to TC-COMP-06)](#5-section-c-filter-composition-search--saved-views)
6. [Section D: Capture Pilot Zone Checklist (10 Cases: TC-CAPT-01 to TC-CAPT-10)](#6-section-d-capture-pilot-zone-checklist)
7. [Section E: Accessibility & Responsive Layout Checklist (4 Cases: TC-A11Y-01 to TC-RESP-02)](#7-section-e-accessibility--responsive-layout-checklist)
8. [Section F: Staging Persistence & Metadata Sync Prerequisite](#8-section-f-staging-persistence--metadata-sync-prerequisite)

---

## 1. Overview and Testing Guidelines

* **Target URL (Local Dev):** `http://localhost:3200`
* **Test Accounts:** Use seeded development credentials (e.g. `tim@apple.dev`).
* **Environment Separation:**
  * **UI-Only Checks (29 Cases):** Verify styling, keyboard accessibility, segmented buttons, dropdown options, and URL query parameter behavior without needing a synchronized backend database.
  * **Backend-Requiring Checks (12 Cases):** Marked **`Requires Sync DB`**. These verify real database persistence after `syncApplication` has been executed on the target environment by an authorized environment owner.
* **Integrity Rule:** Do **not** mark any test case as passed without physically verifying it in a live browser. All 41 tests remain `NOT RUN`.

---

## 2. Proposed Fictional QA Dataset

> [!IMPORTANT]
> **Fictional Test Data Specification:** The following 4 fictional records are proposed test data for post-deployment staging verification. They contain strictly fictional identifiers, fictional organization names, and placeholder locations. **None of these records have been created.** They represent a template for authorized testers during staging verification.

| Record ID | Fictional Lead Name | Fictional Organisation | Pilot Zone | Category | Subcategory | Placeholder Location String | Intended Matching Vibe |
|---|---|---|---|---|---|---|---|
| **QA-PUNE-01** | `QA_TEMP_Amanora_01` | Fictional Amanora Dining Corp | `AMANORA_MALL` | `BUSINESS_PARTNER` | `BAR_LOUNGE` | Level 2, Fictional Zone, Amanora Sector, Pune | `Brewery & Nightlife` |
| **QA-PUNE-02** | `QA_TEMP_Seasons_01` | Fictional Seasons Arcade LLC | `SEASONS_MALL` | `EXPERIENCE` | `GAMING_ARCADE` | Fictional Entertainment Wing, Seasons Sector, Hadapsar, Pune | `Gaming & Arcade` |
| **QA-PUNE-03** | `QA_TEMP_Magarpatta_01` | Fictional Magarpatta Spaces Ltd | `MAGARPATTA_CITY` | `BUSINESS_PARTNER` | `WORK_CAFE` | Fictional Tower 7, Cyber Sector, Magarpatta City, Pune | `Work Cafe` |
| **QA-PUNE-04** | `QA_TEMP_Hadapsar_01` | Fictional Hadapsar Wellness Inc | `HADAPSAR` | `EXPERIENCE` | `LUXURY_SPA` | Fictional Plaza 4, Hadapsar Bypass, Hadapsar, Pune | `Luxury Spa` |

---

## 3. Section A: Leads Zone Filters Checklist

| Test ID | Feature Area | Preconditions / Test Data | Steps to Execute | Expected Result | Actual Result | Status | Environment |
|---|---|---|---|---|---|---|---|
| **TC-ZONE-01** | Zone Filter | User logged in, at `/leads` | Inspect the zone filter row | "All" pill is visually active by default; URL contains no `?zone=` parameter | Pending human execution | `NOT RUN` | UI Only |
| **TC-ZONE-02** | Zone Filter | At `/leads` | Verify all 5 pills | Exactly 5 options displayed: `All`, `Amanora Mall`, `Seasons Mall`, `Magarpatta City`, `Hadapsar` | Pending human execution | `NOT RUN` | UI Only |
| **TC-ZONE-03** | Zone Filter | Leads present in all zones | Click "Amanora Mall" | URL updates to `?zone=AMANORA_MALL`; only Amanora leads visible; active chip appears in filter bar | Pending human execution | `NOT RUN` | Requires Sync DB |
| **TC-ZONE-04** | Zone Filter | Leads present in all zones | Click "Seasons Mall" | URL updates to `?zone=SEASONS_MALL`; only Seasons Mall leads visible | Pending human execution | `NOT RUN` | Requires Sync DB |
| **TC-ZONE-05** | Zone Filter | Leads present in all zones | Click "Magarpatta City" | URL updates to `?zone=MAGARPATTA_CITY`; only Magarpatta City leads visible | Pending human execution | `NOT RUN` | Requires Sync DB |
| **TC-ZONE-06** | Zone Filter | Leads present in all zones | Click "Hadapsar" | URL updates to `?zone=HADAPSAR`; only Hadapsar leads visible | Pending human execution | `NOT RUN` | Requires Sync DB |
| **TC-ZONE-07** | Zone Filter | Specific zone selected | Click "All" pill | URL drops `zone` parameter (`/leads`); all leads re-appear in the table | Pending human execution | `NOT RUN` | UI Only |
| **TC-ZONE-08** | Zone Filter | Leads with `pilotZone: null` | Select any specific zone (e.g. Amanora) | Unassigned / null leads do not appear under Amanora Mall | Pending human execution | `NOT RUN` | Requires Sync DB |
| **TC-ZONE-09** | Zone Filter | Leads with `pilotZone: null` | Select "All" | Unassigned / legacy leads appear in list without error | Pending human execution | `NOT RUN` | UI Only |
| **TC-ZONE-10** | Zone Filter | At `/leads` | Manually enter `/leads?zone=UNKNOWN_ZONE` in browser address bar | Screen renders cleanly; zone defaults safely to "All" without exception | Pending human execution | `NOT RUN` | UI Only |
| **TC-ZONE-11** | Zone Filter | Specific zone selected | Refresh browser (F5) | Selected zone remains active; list remains filtered | Pending human execution | `NOT RUN` | UI Only |

---

## 4. Section B: Leads Vibe Filters Checklist

| Test ID | Feature Area | Preconditions / Test Data | Steps to Execute | Expected Result | Actual Result | Status | Environment |
|---|---|---|---|---|---|---|---|
| **TC-VIBE-01** | Vibe Filter | User logged in, at `/leads` | Inspect the vibe filter row | "All" pill is active by default; URL contains no `?vibe=` parameter | Pending human execution | `NOT RUN` | UI Only |
| **TC-VIBE-02** | Vibe Filter | At `/leads` | Verify all 6 pills | Exactly 6 options displayed: `All`, `Gaming & Arcade`, `Brewery & Nightlife`, `Work Cafe`, `Luxury Spa`, `Fine Dining` | Pending human execution | `NOT RUN` | UI Only |
| **TC-VIBE-03** | Vibe Filter | Leads with `BAR_LOUNGE` | Click "Brewery & Nightlife" | URL updates to `?vibe=brewery_nightlife`; only nightlife / bar leads visible | Pending human execution | `NOT RUN` | UI Only / Sync DB |
| **TC-VIBE-04** | Vibe Filter | Leads with `FINE_DINING` vs `RESTAURANT` | Click "Fine Dining" | Only explicit `FINE_DINING` records display; generic `RESTAURANT` records excluded | Pending human execution | `NOT RUN` | UI Only / Sync DB |
| **TC-VIBE-05** | Vibe Filter | Leads with `LUXURY_SPA` vs `WELLNESS_PROVIDER` | Click "Luxury Spa" | Only explicit `LUXURY_SPA` or `SPA` records display; generic `WELLNESS_PROVIDER` excluded | Pending human execution | `NOT RUN` | UI Only / Sync DB |
| **TC-VIBE-06** | Vibe Filter | Leads with `WORK_CAFE` vs `CAFE` | Click "Work Cafe" | Only explicit `WORK_CAFE` records display; generic `CAFE` excluded | Pending human execution | `NOT RUN` | UI Only / Sync DB |
| **TC-VIBE-07** | Vibe Filter | Leads with `GAMING_ARCADE` | Click "Gaming & Arcade" | Only arcade/gaming records display | Pending human execution | `NOT RUN` | UI Only / Sync DB |
| **TC-VIBE-08** | Vibe Filter | Lead named "Spa Centre" but no subcategory | Click "Luxury Spa" | Lead is NOT displayed (confirms no keyword heuristic guessing from name) | Pending human execution | `NOT RUN` | UI Only / Sync DB |
| **TC-VIBE-09** | Vibe Filter | Specific vibe selected | Click "All" pill | URL drops `vibe` parameter; all leads re-appear | Pending human execution | `NOT RUN` | UI Only |
| **TC-VIBE-10** | Vibe Filter | At `/leads` | Manually enter `/leads?vibe=invalid_vibe` | Screen renders cleanly; vibe defaults safely to "All" | Pending human execution | `NOT RUN` | UI Only |

---

## 5. Section C: Filter Composition, Search & Saved Views

| Test ID | Feature Area | Preconditions / Test Data | Steps to Execute | Expected Result | Actual Result | Status | Environment |
|---|---|---|---|---|---|---|---|
| **TC-COMP-01** | Composition | Leads in various zones & vibes | Select Zone "Amanora Mall" AND Vibe "Brewery & Nightlife" | URL updates to `?zone=AMANORA_MALL&vibe=brewery_nightlife`; only leads matching BOTH criteria display | Pending human execution | `NOT RUN` | Requires Sync DB |
| **TC-COMP-02** | Composition | Active Zone + Vibe filter | Type "QA_TEMP_Amanora_01" in search box | Search filters down within the active zone & vibe subset; URL includes `&q=QA_TEMP_Amanora_01` | Pending human execution | `NOT RUN` | Requires Sync DB |
| **TC-COMP-03** | Composition | Active Zone + Vibe filter | Switch saved view to "Follow-ups" | View changes; zone and vibe filters remain active | Pending human execution | `NOT RUN` | Requires Sync DB |
| **TC-COMP-04** | Composition | Active filters in place | Click "x" on the Zone chip in `LvFilterBar` | Only the Zone filter clears; Vibe, search, and saved view remain intact | Pending human execution | `NOT RUN` | UI Only |
| **TC-COMP-05** | Empty State | Select non-existent combination | Select a zone + vibe with zero matching records | Empty state card shows "No leads match the selected filters" with "Reset zone & vibe" button | Pending human execution | `NOT RUN` | UI Only |
| **TC-COMP-06** | Empty State | Zero-result empty state displayed | Click "Reset zone & vibe" button | Both filters reset to "All"; leads re-appear immediately | Pending human execution | `NOT RUN` | UI Only |

---

## 6. Section D: Capture Pilot Zone Checklist

| Test ID | Feature Area | Preconditions / Test Data | Steps to Execute | Expected Result | Actual Result | Status | Environment |
|---|---|---|---|---|---|---|---|
| **TC-CAPT-01** | Capture UI | Navigate to `/capture` | Fill Step 1 (Name), navigate to Step 3 ("Where they are") | Pilot Zone field is present with red asterisk `*` and label "Pilot zone *" | Pending human execution | `NOT RUN` | UI Only |
| **TC-CAPT-02** | Capture UI | At Step 3 | Click Pilot Zone dropdown | Shows placeholder "Select a Pune pilot zoneâ€¦" followed by the 4 zones | Pending human execution | `NOT RUN` | UI Only |
| **TC-CAPT-03** | Validation | Name entered, Pilot Zone unselected | Inspect primary action button | "Check for duplicates" button is disabled; inline error "Pilot zone is required" is displayed | Pending human execution | `NOT RUN` | UI Only |
| **TC-CAPT-04** | Validation | At Step 3 | Select "Amanora Mall" from dropdown | Inline error clears; "Check for duplicates" button becomes active | Pending human execution | `NOT RUN` | UI Only |
| **TC-CAPT-05** | State Persistence | Zone selected in Step 3 | Click "Check for duplicates", then click "Back a step" in header | Step 3 re-opens; "Amanora Mall" remains selected in the dropdown | Pending human execution | `NOT RUN` | UI Only |
| **TC-CAPT-06** | State Persistence | At Step 3 | Change zone from "Amanora Mall" to "Hadapsar", then proceed | Draft payload updates to `pilotZone: "HADAPSAR"` | Pending human execution | `NOT RUN` | UI Only |
| **TC-CAPT-07** | Location Isolation | At Step 3 | Enter `location: "QA Placeholder Tower 7, Cyber Sector"` and select `pilotZone: "MAGARPATTA_CITY"` | Both fields are distinct; location text is not overwritten by zone code | Pending human execution | `NOT RUN` | UI Only / Sync DB |
| **TC-CAPT-08** | Record Creation | Full valid draft filled | Click "Create the lead" | Lead creates successfully; success screen displays lead ID | Pending human execution | `NOT RUN` | Requires Sync DB |
| **TC-CAPT-09** | Reopening Record | Lead created with pilot zone | Navigate to `/leads/:id` | Lead 360 profile displays both location address and pilot zone | Pending human execution | `NOT RUN` | Requires Sync DB |
| **TC-CAPT-10** | Schema Fallback | Test in environment without metadata sync | Attempt to create lead or list leads | Fallback query prevents frontend crash; error handled gracefully | Pending human execution | `NOT RUN` | UI Only |

---

## 7. Section E: Accessibility & Responsive Layout Checklist

| Test ID | Feature Area | Preconditions / Test Data | Steps to Execute | Expected Result | Actual Result | Status | Environment |
|---|---|---|---|---|---|---|---|
| **TC-A11Y-01** | Keyboard Nav | At `/leads` | Use `Tab` key to navigate through filter pills | Focus ring (`2px solid #1F4D3A`) is clearly visible on each active pill | Pending human execution | `NOT RUN` | UI Only |
| **TC-A11Y-02** | Screen Reader | Screen reader active | Focus Zone and Vibe segmented button groups | Groups announce accessible names: "Pilot zone" and "Vibe" | Pending human execution | `NOT RUN` | UI Only |
| **TC-RESP-01** | Mobile Viewport | Open Chrome DevTools, set width to 375px (iPhone SE) | Inspect `/leads` filter bar | Zone and Vibe pills wrap or scroll horizontally without clipping or page blowout | Pending human execution | `NOT RUN` | UI Only |
| **TC-RESP-02** | Mobile Viewport | Width 375px | Open `/capture` at Step 3 | Pilot Zone select dropdown spans 100% container width with legible touch targets | Pending human execution | `NOT RUN` | UI Only |

---

## 8. Section F: Staging Persistence & Metadata Sync Prerequisite

1. **Why Backend Tests Marked `Requires Sync DB` Are NOT RUN:**
   * In local testing, `pilotZone` exists in TypeScript code, but PostgreSQL metadata tables (`core.fieldMetadata`) gate GraphQL mutations.
   * Per audit rules, `syncApplication(dryRun: false)` was not run locally.
2. **Execution Steps for Staging QA:**
   * Step 1: Merge `feature/shlok-pune-pilot-crm` to staging after human code review.
   * Step 2: Deploy and run `syncApplication` via Twenty CLI / migration runner (must be performed strictly by an authorized environment owner).
   * Step 3: Execute tests `TC-ZONE-03` through `TC-ZONE-06` and `TC-CAPT-08` through `TC-CAPT-09` using the fictional dataset in Section 2.
   * Step 4: Record pass/fail verdicts and update this checklist in the release artifact.
3. **Safe Cleanup Policy for Temporary Staging Data:**
   * Testers must record the exact record IDs created during manual QA runs.
   * Cleanup must target only those individually verified QA record IDs through an approved mechanism (e.g. using the application UI delete action or authorized administrative tool).
   * Do not run broad wildcard SQL queries or automated bulk deletion scripts against the database.
