# Day 9 — Partners, Experiences, Properties, Onboarding Completion, Ecosystem Operations

**Status:** implemented on Twenty 2.39.0, application `lavivenzia-crm`. **No new core
modification.** **Date:** 2026-09-16.

The Founder V1 chain is operational end to end and demonstrated live:

```
Lead → Onboarding (10 steps) → Verified documents → HUMAN approval
     → Partner LVP-… (+ Person / Organisation linked) → Property LVR-… or Experience LVE-… (draft)
     → Review → Approval → Activation readiness (deterministic) → ACTIVE / LIVE
     → lead LIVE_ACTIVE, onboarding ACTIVATED, everything audited, everything on the timelines
```

Full description: `docs/CRM-ECOSYSTEM.md`. Audit before coding: `.notes/d9/audit.md`.

---

## 1. Founder V1 requirements closed

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Partner as an operational entity (code, type, category, contact, organisation, lead, location, geography, owner, status, dates, pricing, availability, policies, documents, notes, timeline, audit) | DONE | `partner.object.ts`; `/partners/360`; browser 3, 3b | Relationship health = lead's Day 6 score; partner health N/A (no bookings / revenue data) |
| Partner lifecycle, explicit and auditable | DONE | `ecosystem-lifecycle.ts`; integration "partner activation"; audit `PARTNER_STATUS_CHANGE` | APPROVED + SUSPENDED added to the existing set; pre-approval states live on lead + onboarding |
| Partner created / linked from approved onboarding, idempotent, server code, lead ↔ partner, person / organisation, audit, actor from session, concurrency-safe | DONE | `ecosystem-activation.ts`; unit "creates once… replay links", "reuses… never downgrades", "race → loser reads winner"; integration "reviewer approves → partner", "replayed approval creates no second" | `sourceKey` unique index is the arbiter |
| Partner 360 (header, overview, onboarding, verification, experiences, properties, relationship, timeline, documents, audit; loading / empty / error / forbidden) | DONE | `ecosystem-360/partner-360.tsx`; browser 3, 16a, 16b, 17, 18 | |
| Experience operational (fields per brief) | DONE | `experience.object.ts` (38 fields) | Fields map to onboarding answers or team-recorded facts only |
| Experience 360 | DONE | `listing-360.tsx`; browser 6 | |
| Experience lifecycle (server-authoritative, permissions, actor, audit, no bypass) | DONE | `applyListingTransition`; integration "security…" (`NOT_ALLOWED` on DRAFT→LIVE); browser 6b | |
| Property operational + Founder's 14 categories | DONE | `property.object.ts`; `PROPERTY_TYPE_OPTIONS` | Existing values relabelled, nine added |
| Property 360 | DONE | browser 9, 17 | |
| Relationship graph (Person ↔ Organisation ↔ Lead ↔ Partner ↔ Experience / Property; Experience → Host; Property → Manager) | DONE | relations on the three objects + 12 reverse fields; integration asserts `contactId` / `organisationId` linked | Link-before-create by email / name |
| Onboarding shows step state, missing info, documents, reviewer, decision, next action | DONE (Day 3) + Partner 360 onboarding panel | `OnboardingPanel`; browser 10 | |
| Final review is a human gate | DONE (Day 3) | `HUMAN_ONLY_TRANSITIONS` | Unchanged |
| Onboarding → entity activation chain, partner-only / +experience / +property | DONE | `expectedListingFor`; integration (STAY → property, 0 experiences) | |
| Activation readiness, deterministic, structured reasons | DONE | `activation-readiness.ts`; unit; integration `NOT_READY` → `READY`; browser 15 | 14 checks for a partner, 15 for a listing |
| Role-based workflows | DONE | roles: Experience Team → lvExperience write, Operations → all three; `capabilitiesFor` | Hunters / Coordinators / Onboarding Expert read only; approval never by the record's owner |
| Permissions + CM-004 + security tests | DONE | integration "security…" (10 refusals), "soft-deleted…"; browser 16a–c | CM-004 unchanged; ecosystem records workspace-readable by design (§6 of the doc) |
| Duplicate protection (partner: lead / onboarding / name; listings: partner + name + location) | DONE | `findPartnerForOnboarding`; `/ecosystem/create` → `DUPLICATE_UNDECIDED`; integration "creating an experience by hand" | Day 1 matcher reused; human CREATE_NEW decision |
| Taxonomy administration without a developer | **MISSING** (documented) | §Taxonomy below | Requires a taxonomy object and rewiring; deliberately not started inside Day 9 |
| Navigation + views (Partners / Experiences / Properties, 5–6 views each) | DONE | 16 view files; browser 1, 4, 7 | Existing sidebar items under Relationships |
| Dashboard / Control Tower ecosystem metrics | DONE | `ecosystem-summary.ts`; Control Tower KPI rows + "Ecosystem" backlog group (E1–E5); My Dashboard tiles for ADMIN / OVERSIGHT / ONBOARDING | One GROUP BY per object; request budget test updated (+3 documents) |
| Timeline / relationship memory | DONE | `buildTimeline` (created, audit, onboarding decisions, documents, interactions); Twenty `timelineActivity` untouched | No duplicates on retries: audit rows carry the event, replays write PARTNER_LINKED once per event |
| Notifications | DONE | `EXPERIENCE_APPROVAL_REQUIRED`, `PROPERTY_APPROVAL_REQUIRED`, `ACTIVATION_READY`, `PARTNER_CREATED` via `dispatchNotifications` (dedupe keys) | DOCUMENT_REJECTED existed; DOCUMENT_EXPIRING not added (expiry cron marks state; no Founder rule for advance warning in the repo) |
| SLA | DONE — no new rule | audit §27 | Nothing in the repo's Founder text defines an approval SLA; none invented |
| AI | DONE — none fabricated | Scores are N/A with reasons; Day 6 abstraction untouched | No partner / experience summary prompt was added: with no provider in dev it would only ever say AI_UNAVAILABLE, and the brief forbids fake output |
| Lead 360 ecosystem panel | DONE | `EcosystemSection`; `/leads/360` returns `ecosystem`; browser 12 | |
| Responsive 320–1920, dark mode | DONE | browser 17 (6 widths), 18 | |

## 2. Fixes found on the way

- The onboarding handler mirrored only `onboardingStatus`; the lead's own `status` never reached the onboarding-mirrored stretch. It now does (`leadStatusFor`), never rewinding a live lead.
- `person.city` does not exist on Twenty's person object; the link/create path no longer sends it.

## 3. Taxonomy — design decision (not implemented)

Founder V1: *New category → define fields → define workflow → define responsible role → activate, without developer intervention.* Today categories and subcategories are TypeScript constants (`lead-taxonomy.ts`) compiled into generated SELECT options and a static parent map that the draft builder, classifier, import matcher, engines and now the ecosystem objects import. An administrator can already add or relabel SELECT options in Settings → Data model, but the parent mapping, per-category fields, workflow and responsible role do not exist as data.

Closing it needs: an `lvCategory` object (key, label, parent, active, responsibleRole, fieldSpec RAW_JSON, workflowUniversalIdentifier), a route + admin surface, a regenerated SELECT option sync on activation, and every consumer switched from the constants to a cached read of the object — with the classifier's allowed vocabulary and the readiness / import rules following. That is a Day-sized change touching Days 1, 6, 8 and 9 code; doing it inside Day 9 would have meant either shipping it half-wired or shortening the ecosystem work the brief centres on. It is recorded here as the next architectural item, with the constants left as the single source of truth until then.

## 4. Verification

| Layer | Result |
|---|---|
| Unit | 49 files / 1012 tests (`npx vitest run --project unit`) — 13 new in `lv-core/__tests__/ecosystem.test.ts` (codes, allocator incl. collision / contention / ceiling, both lifecycles, partner + listing readiness, onboarding → partner / listing mapping, idempotency, reuse without downgrade, race) |
| Integration (live, real sessions) | 8 files / 61 tests — 9 new in `lv-ecosystem.integration-test.ts` (API-key refusal; approval → partner + property + links + mirror + audit; replay; Partner 360 as admin / hunter + Lead 360 ecosystem; 10 security refusals incl. actor spoof, IDOR guess, unauthorised mutation / approval / owner change, approval bypass; property lifecycle with readiness gate and a real uploaded image; partner activation → lead LIVE_ACTIVE / onboarding ACTIVATED; manual experience with duplicate decision; soft-deleted records) |
| Browser | `.notes/d9/d9-browser.mjs` — 18 scenarios / 32 checks, ALL PASS (§5) |
| Typecheck / lint | app: clean; front-end: unchanged |
| Regression | Day 5 38/38, Day 6 32/32, Day 7 34/34, Day 8 9/9 browser suites re-run after the change; unit + integration green; zero core files changed (TESTING-QA.md) |

## 5. Browser scenarios

Recorded outcome: **32 checks, ALL PASS** on 2026-09-16 (screenshots `.notes/d9/shots/`). Scenarios: partner list and views, manual partner with duplicate decision, Partner 360, experience list, create experience from Partner 360, Experience 360 + lifecycle from the page, property list, create property, Property 360, onboarding record state, approval → partner in the browser as the Onboarding Expert, Lead 360 ecosystem panel, partner → experience / property relations, readiness → activation, role restrictions for Onboarding Expert and Hunter + spoof refusal, six widths, dark mode).

## 6. Honest limits

- Partner health and experience quality are N/A: the inputs (bookings, revenue, complaints, guest feedback) are not recorded anywhere in the CRM.
- Taxonomy administration is documented, not built.
- Media is attached through the Details tab; the 360 pages display it.
- Dashboard "not active" counts are status facts; per-record readiness runs on the 360 pages.
- No SLA for approvals; no AI summaries (nothing to say truthfully without a provider).
