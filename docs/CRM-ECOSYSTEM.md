# CRM Ecosystem — Partners, Experiences, Properties

*Day 9. The operating entities the Founder V1 journey ends in:*

```
Lead → Onboarding → Verification → Human approval
     → Partner (LVP-…) → Experience (LVE-…) / Property (LVR-…)
     → Activation readiness → ACTIVE / LIVE
```

## 1. Where it lives

| Piece | Path |
|---|---|
| Objects | `lv-core/objects/partner.object.ts`, `experience.object.ts`, `property.object.ts` (+ reverse relations in `lv-core/fields/*-on-*.field.ts`) |
| Lifecycles | `lv-core/constants/ecosystem-lifecycle.ts` — transition tables, human-only / reason-required / readiness-gated sets, `checkTransition` |
| Codes | `lv-core/utils/entity-code.ts` + `services/entity-code-allocator.ts` — `LVP-000042`, `LVE-000042`, `LVR-000042`; unique index as arbiter, retry on collision, never renumbered |
| Approval → entities | `lv-core/services/ecosystem-activation.ts`, called by `lv-onboarding/on-onboarding-updated` on APPROVED / ACTIVATED |
| Readiness | `lv-core/services/activation-readiness.ts` (pure) |
| Operations | `lv-core/services/ecosystem-service.ts` (loaders, capabilities, transitions, owner change), `ecosystem-360.ts` (page composition), `lead-ecosystem.ts` (Lead 360 panel) |
| Routes | `POST /partners/360`, `/experiences/360`, `/properties/360`, `/ecosystem/transition`, `/ecosystem/create`, `/ecosystem/readiness` — session-only |
| Pages | Record pages `partner-profile`, `experience-profile`, `property-profile` (360 tab + Details tab); front components `lv-partner-360`, `lv-experience-360`, `lv-property-360` (`front-components/ecosystem-360/`) |
| Views | `lv-core/views/partners-*.view.ts` (All · Onboarding · Pending approval · Active · Needs attention), `experiences-*` (All · Draft · Verification · Pending approval · Active · Needs attention), `properties-*` (All · Verification · Pending approval · Active · Needs attention) |
| Dashboards | `lv-dashboard/services/ecosystem-summary.ts` → Control Tower (KPI rows + "Ecosystem" backlog group) and My Dashboard (ADMIN / OVERSIGHT / ONBOARDING lenses) |
| Notifications | `EXPERIENCE_APPROVAL_REQUIRED`, `PROPERTY_APPROVAL_REQUIRED`, `ACTIVATION_READY`, `PARTNER_CREATED` through the Day 4 dispatcher |

## 2. Data model

**lvPartner** — name, `partnerCode` (unique), `sourceKey` (unique; `onboarding:<id>` or `manual:<uuid>`), status, statusReason, partnerType, category, subcategory, description, emails, phones, website, instagram, location, geography, languages, pricing / availability / policies (RAW_JSON, as the partner stated them in onboarding), approvedAt, activatedAt, provenance; relations: owner (workspace member), contact (person), organisation (company), lead, onboarding; reverse: experiences, properties.

**lvExperience** — name, `experienceCode`, `sourceKey`, status, statusReason, category, subcategory, shortDescription, description, hostName, location, destination, meetingPoint, durationMinutes, minParticipants, capacity, basePrice (CURRENCY), priceUnit, availability, languages, ageRequirement, difficulty, accessibility, included, excluded, requirements, safetyInformation, cancellationPolicy, images (FILES ×20), documents (FILES ×10), submittedAt, approvedAt, activatedAt; relations: partner, host (person), owner, reviewer, onboarding.

**lvProperty** — name, `propertyCode`, `sourceKey`, status, statusReason, propertyType (the Founder's 14 categories + Venue / Other), description, location, streetAddress, destination, capacity (sleeps), rooms, amenities, basePrice, priceUnit, availability, checkIn, checkOut, cancellationPolicy, houseRules, images, documents, submittedAt, approvedAt, activatedAt; relations: partner, manager (person), owner, reviewer, onboarding.

Person and Organisation are Twenty's `person` / `company`. On approval the partner is linked to an existing person (by email) or company (by name) when one exists and a new one is created from the onboarding's own answers only when none does.

## 3. Lifecycles

**Partner**: PROSPECTIVE → ONBOARDING → APPROVED → ACTIVE ⇄ PAUSED; ACTIVE → SUSPENDED → ACTIVE; ACTIVE/PAUSED → INACTIVE → ACTIVE; anything → OFFBOARDED (terminal). Human-only: ACTIVE, SUSPENDED, OFFBOARDED. Reason required: PAUSED, SUSPENDED, OFFBOARDED. ACTIVE is readiness-gated. States before approval (prospect, verification, pending approval, rejected) are the lead's and the onboarding's.

**Experience / Property** (one machine): DRAFT → IN_REVIEW → READY (approved) → LIVE (active) → PAUSED/SUSPENDED ⇄ LIVE; IN_REVIEW/READY → CHANGES_REQUIRED → IN_REVIEW; anything → RETIRED (archived). Human-only: READY, CHANGES_REQUIRED, LIVE, SUSPENDED, RETIRED. Reason required: CHANGES_REQUIRED, PAUSED, SUSPENDED, RETIRED. LIVE is readiness-gated. Day 1 values are kept; the labels read as the Founder lifecycle (READY = "Approved", LIVE = "Active", RETIRED = "Archived").

Every transition goes through `/ecosystem/transition`: actor from the session; the record read as the caller; allowed-transition check; permission check (write on the object, or admin); **no self-approval** (the record's owner may not approve / activate / suspend / archive their own record unless admin); readiness for activation; the platform's own write permission; an audit row for every outcome, refused ones included.

## 4. Approval → partner (idempotent)

`ensurePartnerForOnboarding` runs from the `lvOnboarding.updated` event when the status becomes APPROVED (or ACTIVATED for an onboarding approved before Day 9). It finds an existing partner by `sourceKey` / `onboardingId` / `leadId` (LINK / REUSE — an ACTIVE partner is never downgraded), else creates one with `sourceKey = onboarding:<id>`; the unique index refuses the loser of a race, who re-reads the winner. The code is allocated by the unique index. `PARTNER_CREATED` or `PARTNER_LINKED` is audited with the approving reviewer as actor. Then, by the lead's category: STAY → a DRAFT property; EXPERIENCE → a DRAFT experience; business partners and people/community → partner only. The listing inherits title, description, capacity, price, unit, availability, cancellation policy, address / meeting point, images (FILES from the onboarding, de-duplicated) and the contact as host / manager. The lead's `status` follows the onboarding through ONBOARDING_INITIATED → ONBOARDING_IN_PROGRESS → VERIFICATION → APPROVED → LIVE_ACTIVE (never rewound past LIVE_ACTIVE, never touched when closed).

## 5. Activation readiness (deterministic)

`assessPartnerReadiness`: name, code, category, location, contact channel, owner, onboarding linked and APPROVED/ACTIVATED with a reviewer, cancellation policy on file, partner terms accepted, a verified and unexpired IDENTITY document, no rejected or expired document, the expected listing present (STAY → property, EXPERIENCE → experience), not suspended / offboarded. `assessListingReadiness`: name, code, description ≥ 40 characters, location, capacity, duration (experience) / type (property), price and unit, availability, cancellation policy, at least one image, owner, partner linked and approved/active, status approved by a reviewer. Result: `READY` or `NOT_READY` with coded reasons grouped by PROFILE / DOCUMENTS / COMMERCIAL / APPROVAL / RELATIONS. No score, no model. The ACTIVE / LIVE transitions call it and fail closed (`NOT_READY`, audited `ACTIVATION_READINESS : REFUSED`).

## 6. Permissions

| Role | lvPartner | lvExperience | lvProperty |
|---|---|---|---|
| Main Admin | write + govern | write + govern | write + govern |
| Operations | write; govern others' records | write; govern | write; govern |
| Experience Team | read | write; govern others' records | read |
| Experience Hunter, Lead Coordinator, Onboarding Expert, Marketing, Management | read | read | read |

"Govern" = approve / activate / suspend / archive, refused for the record's own owner unless admin. Ecosystem records are workspace-visible for reading (a Hunter must be able to see existing partners to avoid creating duplicates); CM-004 is unchanged — the lead, onboarding and documents a 360 page reaches into are still read as the caller and scoped. No core change.

## 7. Honest limits

- **Partner health, experience quality**: N/A with the reason. They need bookings, revenue, complaints and guest feedback the CRM does not record.
- **Relationship health** on Partner 360 is the lead's Day 6 score (interactions live on the lead); N/A until interactions exist.
- **Taxonomy administration** (new category → fields → workflow → role → activate, no developer): not implemented. See `DAY_9_ECOSYSTEM.md` §Taxonomy for the design and why it is a separate change.
- Media for experiences / properties is attached through the Details tab (Twenty's FILES field); the 360 pages show it, they do not upload it.
- Dashboard "not active" counts are status facts; per-record readiness is computed on the 360 pages.
