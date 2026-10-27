# Task 1 Technical Decisions â€” Pune Pilot CRM

**Document Version:** 1.0
**Date:** 2026-10-27
**Branch:** `feature/shlok-pune-pilot-crm`
**Base Commit:** `bd2ab74d86722d4347b8cfb51746d612b78511bd`
**Author:** Shlok Thorat (`shlokthorat-LA-VIVENZIA`)
**Scope:** Design decisions, rationale, trade-offs, and verification status for Task 1

---

## Table of Contents
1. [Overview](#1-overview)
2. [Decision Log](#2-decision-log)
   - [TD-01: Dedicated Field `pilotZone` vs Overwriting `location`](#td-01-dedicated-field-pilotzone-vs-overwriting-location)
   - [TD-02: Canonical Pilot Zone Vocabulary and Label Mapping](#td-02-canonical-pilot-zone-vocabulary-and-label-mapping)
   - [TD-03: Deterministic UUIDv5 Option ID Generation](#td-03-deterministic-uuidv5-option-id-generation)
   - [TD-04: Strict Evidence-Based Vibe Mapping (Rule 7 Compliance)](#td-04-strict-evidence-based-vibe-mapping-rule-7-compliance)
   - [TD-05: Non-Inference of Vibe from Venue Names and Free-Text](#td-05-non-inference-of-vibe-from-venue-names-and-free-text)
   - [TD-06: Documented Taxonomy Gaps (Work Cafe, Fine Dining, Luxury Spa)](#td-06-documented-taxonomy-gaps-work-cafe-fine-dining-luxury-spa)
   - [TD-07: Safe Handling of Null, Missing, and Legacy Records](#td-07-safe-handling-of-null-missing-and-legacy-records)
   - [TD-08: Server-Boundary Normalization and Validation](#td-08-server-boundary-normalization-and-validation)
   - [TD-09: Resilient GraphQL Schema Decoupling (Fallback Query)](#td-09-resilient-graphql-schema-decoupling-fallback-query)
   - [TD-10: Step Gating in Capture Flow (`canReview`)](#td-10-step-gating-in-capture-flow-canreview)
   - [TD-11: URL Parameter Cleanliness and History Stack Hygiene](#td-11-url-parameter-cleanliness-and-history-stack-hygiene)
   - [TD-12: Preservation of Untracked Developer Setup Script](#td-12-preservation-of-untracked-developer-setup-script)

---

## 1. Overview

Every design decision documented here was evaluated against four core engineering principles:
1. **Data Integrity:** Operational territory routing requires structured, deterministic fields, not free-text fuzzy matching.
2. **Defensive Taxonomy:** "Evidence over assumptions" â€” no artificial categorization of businesses without verified data.
3. **Resilience & Backward Compatibility:** Zero regressions for legacy non-pilot leads; seamless operation before and after database metadata synchronization.
4. **Minimal Invasive Surface:** Narrowly scoped code modifications; zero changes to existing database migration state during local audits.

---

## 2. Decision Log

### TD-01: Dedicated Field `pilotZone` vs Overwriting `location`

* **Decision:** Introduce a dedicated nullable `FieldType.SELECT` field named `pilotZone` on `lvLead`, rather than embedding the pilot zone into the existing free-form `location` string.
* **Reason:** `location` contains street addresses, building names, floor numbers, or landmarks (e.g. `"Level 2, East Wing, Amanora Town Centre, Hadapsar"`). Overwriting `location` with `"Amanora Mall"` destroys vital physical address data. Parsing zone out of free text causes false positives (e.g., a venue in "Hadapsar" mentioning "Near Amanora Mall").
* **Evidence in Code:**
  * `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-core/objects/lead.object.ts` (lines 133â€“142) declares `pilotZone`.
  * `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-capture/services/capture-service.ts` (line 224â€“225) persists both `location` and `pilotZone` independently.
  * Verified in test `leadCreateData preserves all related contact and profile fields alongside pilotZone` in `pilot-zone-capture.test.ts`.
* **Trade-offs / Limitations:** Requires a schema addition to `lvLead`, which requires metadata synchronization during staging deployment.
* **Status:** Verified in code and unit tests; physical database column creation pending staging metadata sync.

---

### TD-02: Canonical Pilot Zone Vocabulary and Label Mapping

* **Decision:** Standardize on uppercase snake_case canonical keys across both frontend and backend:
  * `AMANORA_MALL` â†’ `"Amanora Mall"`
  * `SEASONS_MALL` â†’ `"Seasons Mall"`
  * `MAGARPATTA_CITY` â†’ `"Magarpatta City"`
  * `HADAPSAR` â†’ `"Hadapsar"`
* **Reason:** Guarantees strict type safety in TypeScript (`LeadPilotZone` and `PilotZone`), prevents case-sensitivity bugs, and mirrors existing CRM enums (`LEAD_STATUS`, `LEAD_PRIORITY`).
* **Evidence in Code:**
  * Frontend: `packages/lv-app/src/domain/pilot-zones.ts` (`PILOT_ZONES`, `PILOT_ZONE_LABELS`).
  * Backend: `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-core/constants/lead-taxonomy.ts` (`LEAD_PILOT_ZONES`, `LEAD_PILOT_ZONE_LABELS`).
* **Trade-offs / Limitations:** None.
* **Status:** Fully Verified.

---

### TD-03: Deterministic UUIDv5 Option ID Generation

* **Decision:** Generate select option IDs for `LEAD_PILOT_ZONE_OPTIONS` deterministically using UUIDv5 with a fixed namespace, via `generate-select-options.mjs`.
* **Reason:** Twenty CRM requires select field options to have unique UUIDs. Deterministic generation ensures that regenerating options produces identical UUIDs across branches, environments, and migrations, preventing orphan foreign keys or data loss.
* **Generated Values:**
  * `AMANORA_MALL`: `'babddb01-7d76-5c21-bd6d-eb4d889feffa'`
  * `SEASONS_MALL`: `'e68bf18f-5ac6-5dd5-aafc-8af3502375da'`
  * `MAGARPATTA_CITY`: `'e1f859a8-fd44-5d29-8451-3069f8279d43'`
  * `HADAPSAR`: `'6e82037b-f7a3-50d5-a85e-9a28e9b474a2'`
* **Evidence in Code:**
  * `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-core/constants/select-options.generated.ts` (lines 278â€“308).
  * `packages/twenty-apps/internal/lavivenzia-crm/scripts/generate-select-options.mjs` (lines 256â€“263).
* **Trade-offs / Limitations:** None.
* **Status:** Fully Verified.

---

### TD-04: Strict Evidence-Based Vibe Mapping (Rule 7 Compliance)

* **Decision:** Vibe filtering resolves exclusively against explicit, recognized CRM subcategories.
* **Reason:** Mandatory Rule 7 states: *"avoid broad match that classifies all restaurants as fine dining or all wellness providers as luxury spas without evidence."*
* **Mapping Matrix:**
  * **Brewery & Nightlife (`brewery_nightlife`):** `BAR_LOUNGE`, `BREWERY`, `NIGHTLIFE`.
  * **Fine Dining (`fine_dining`):** `FINE_DINING` only. (Excludes broad `RESTAURANT`, `FOOD_EXPERT`, `CHEF`).
  * **Luxury Spa (`luxury_spa`):** `LUXURY_SPA`, `SPA` only. (Excludes broad `WELLNESS_PROVIDER`, `RETREAT`, `RESORT`).
  * **Work Cafe (`work_cafe`):** `WORK_CAFE` only. (Excludes broad `CAFE`).
  * **Gaming & Arcade (`gaming_arcade`):** `GAMING_ARCADE`, `GAMING`, `ARCADE` only. (Excludes broad `EVENT_VENUE`, `ADVENTURE_PROVIDER`).
* **Evidence in Code:**
  * `packages/lv-app/src/domain/vibe-taxonomy.ts` (`VIBE_MAPPINGS`, `matchesVibe`).
  * Unit tests in `vibe-taxonomy.test.ts` lines 88â€“116 explicitly assert that `RESTAURANT`, `WELLNESS_PROVIDER`, and `CAFE` return `false`.
* **Trade-offs / Limitations:** Venues classified only at the generic category level (e.g. `category: RESTAURANT` without subcategory) will not appear under specific vibes like "Fine Dining". They remain accessible under "All".
* **Status:** Fully Verified.

---

### TD-05: Non-Inference of Vibe from Venue Names and Free-Text

* **Decision:** Prohibit heuristic text parsing (e.g. scanning for `"spa"` in `"Hadapsar Spa & Wellness"`, or `"brew"` in `"Fictional Brewpub"`) to assign vibes.
* **Reason:** Name-based keyword heuristics cause high false-positive rates (e.g. `"The Beer Cafe"` is a casual cafe, `"Spa Nails Salon"` is not a luxury spa). Classification must rely solely on structured taxonomy confirmed by humans.
* **Evidence in Code:**
  * `matchesVibe(subcategory, category, filter)` in `vibe-taxonomy.ts` accepts only category and subcategory strings; does not accept lead name, description, or address.
  * Verified in test `does NOT infer vibe from venue name or address text` in `leads-screen-filters.test.ts`.
* **Trade-offs / Limitations:** Requires leads to have subcategories populated during capture or enrichment to participate in vibe filtering.
* **Status:** Fully Verified.

---

### TD-06: Documented Taxonomy Gaps (Work Cafe, Fine Dining, Luxury Spa)

* **Decision:** Formally document gaps in `VIBE_MAPPINGS` where the legacy Twenty CRM taxonomy lacks granular subcategories, rather than inventing undocumented taxonomy codes.
* **Reason:** Transparent engineering record for product owners. Legacy CRM taxonomy had `RESTAURANT` and `WELLNESS_PROVIDER`, but lacked distinction between fine dining vs casual bistros, or luxury destination spas vs local clinics.
* **Evidence in Code:**
  * `packages/lv-app/src/domain/vibe-taxonomy.ts` lines 77â€“108 records `taxonomyGapNote` for `fine_dining`, `luxury_spa`, `work_cafe`, and `gaming_arcade`.
  * Verified in test `documents taxonomy gaps and rationale in VIBE_MAPPINGS` in `vibe-taxonomy.test.ts`.
* **Trade-offs / Limitations:** None. Informs Task 2 and future sprint planning.
* **Status:** Fully Verified.

---

### TD-07: Safe Handling of Null, Missing, and Legacy Records

* **Decision:**
  * When filter is `'all'`, leads with `pilotZone: null` or `category: null` are included.
  * When a specific zone (e.g. `AMANORA_MALL`) or vibe is selected, records with `null` or missing values are safely excluded without throwing errors or crashing.
* **Reason:** Protects existing leads (e.g. Mumbai, Goa, or pre-pilot records) and partially filled drafts from disappearing or causing runtime exceptions.
* **Evidence in Code:**
  * `matchesPilotZone(recordZone, filter)`: `if (filter === 'all') return true; if (!recordZone) return false;`.
  * `matchesVibe(subcategory, category, filter)`: `if (filter === 'all') return true; if (!subcategory && !category) return false;`.
  * Verified in tests `safely handles missing or null pilotZone values` and `excludes records with null or missing category/subcategory from specific vibes`.
* **Trade-offs / Limitations:** None.
* **Status:** Fully Verified.

---

### TD-08: Server-Boundary Normalization and Validation

* **Decision:** Validate and normalize `pilotZone` inside `capture-request.ts` using `normalizePilotZoneInput`.
* **Reason:** Frontend validation (`canReview`) is for user experience, but cannot serve as authorization or data integrity enforcement. API clients or automated scrapers sending direct HTTP POST requests must be validated at the server boundary.
* **Normalization Logic:**
  * Strips leading and trailing whitespace (`" AMANORA_MALL "` â†’ `"AMANORA_MALL"`).
  * Accepts human-readable labels (`"Amanora Mall"` â†’ `"AMANORA_MALL"`).
  * Case-insensitive matching.
  * Rejects unsupported strings with a 400 error message listing the 4 valid zones.
* **Evidence in Code:**
  * `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-capture/services/capture-request.ts` lines 22â€“50.
  * Unit tests in `pilot-zone-capture.test.ts` lines 9â€“70.
* **Trade-offs / Limitations:** None.
* **Status:** Fully Verified.

---

### TD-09: Resilient GraphQL Schema Decoupling (Fallback Query)

* **Decision:** Implement a two-tier query strategy in `packages/lv-app/src/api/leads.ts` (`useLeadList`):
  1. Primary `LIST_QUERY` queries `pilotZone`.
  2. If GraphQL responds with `Cannot query field "pilotZone"`, execute `FALLBACK_LIST_QUERY` and map `pilotZone: null`.
  3. Any other error (network timeout, 401 unauthenticated, 403 forbidden, syntax error) is immediately rethrown.
* **Reason:** In Twenty CRM, database metadata tables gate GraphQL schema generation. Deploying frontend code before running `syncApplication` would otherwise break the Leads page with an unhandled GraphQL error.
* **Evidence in Code:**
  * `packages/lv-app/src/api/leads.ts` lines 293â€“305.
  * Verified in test `GraphQL schema fallback resilience` in `leads-screen-filters.test.ts`.
* **Trade-offs / Limitations:** Until metadata sync is run in the backend database, leads will have `pilotZone: null` and will only appear under `'all'` zone filter.
* **Status:** Fully Verified in code and tests.

---

### TD-10: Step Gating in Capture Flow (`canReview`)

* **Decision:** In `packages/lv-app/src/api/capture.ts`, tie `canReview` to `Boolean(draft.pilotZone && isPilotZone(draft.pilotZone))`.
* **Reason:** Ensures that an Experience Hunter cannot advance past Step 3 to "Check for duplicates" or "Create the lead" without explicitly selecting one of the four pilot zones.
* **Evidence in Code:**
  * `packages/lv-app/src/api/capture.ts` line 454.
  * `packages/lv-app/src/screens/CaptureScreen.tsx` line 130 (`disabled={!capture.canReview}`).
  * Verified in tests `prevents progression when name is present but pilotZone is missing` and `rejects empty string placeholder from unlocking review step` in `capture-zone.test.ts`.
* **Trade-offs / Limitations:** Enforces zone selection for all venue leads created in the UI.
* **Status:** Fully Verified.

---

### TD-11: URL Parameter Cleanliness and History Stack Hygiene

* **Decision:** When a user selects `'all'` for zone or vibe, remove the query parameter from the URL (`next.delete('zone')`) rather than appending `?zone=all`. Perform updates using `{ replace: true }`.
* **Reason:**
  * Keeps URLs clean and human-readable (`/leads` instead of `/leads?zone=all&vibe=all&view=all`).
  * `{ replace: true }` prevents polluting the browser history so that clicking "Back" returns the user to the previous screen rather than requiring 10 back clicks through filter clicks.
* **Evidence in Code:**
  * `packages/lv-app/src/screens/LeadsScreen.tsx` lines 163â€“173.
  * Verified in test `clearing zone or vibe deletes the parameter instead of setting "all" in URL` in `leads-screen-filters.test.ts`.
* **Trade-offs / Limitations:** None.
* **Status:** Fully Verified.

---

### TD-12: Preservation of Untracked Developer Setup Script

* **Decision:** Preserve the untracked file `setup_lavivenzia_app.js` without modification, renaming, or committing.
* **Reason:** Mandatory repository rule. The script contains local developer setup helpers for PostgreSQL container seeding.
* **Evidence in Git:**
  * `git status --porcelain setup_lavivenzia_app.js` returns `?? setup_lavivenzia_app.js`.
* **Trade-offs / Limitations:** Must be kept out of staging git commits.
* **Status:** Fully Verified.
