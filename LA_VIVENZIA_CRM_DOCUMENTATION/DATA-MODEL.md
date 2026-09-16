# Data Model

## Lead
lvLeadId, person, organisation, category, subcategory, location, source, owner, status, priority, opportunityScore, relationshipHealth, lastInteractionAt, nextAction, nextFollowUpAt, onboardingStatus.

Capture fields (Day 1 → Day 8): `captureMode` (20 values — MANUAL, VISITING_CARD,
IMAGE, SCREENSHOT, BROCHURE, FLYER, POSTER, INSTAGRAM, INSTAGRAM_POST,
LINKEDIN_PROFILE, WEBSITE_URL, SOCIAL_HANDLE, REFERRAL, PARTNER_REFERRAL, EVENT,
WALK_IN, PHONE, IMPORT, API, OTHER), `rawCaptureInput`, `fieldProvenance`
(per field: USER_ENTERED / OCR_EXTRACTED / DERIVED / AI_SUGGESTED),
`duplicateKeys`; and since Day 8 `jobTitle` (TEXT), `socialProfiles` (LINKS —
LinkedIn, Facebook, YouTube, X or other profile), `captureProvenance` (RAW_JSON:
method, platform, originalUrl, originalHandle, capturedAt, capturedById,
extraction {status, kind, runId, fieldCount}, classification {status, runId},
verification, duplicateDecision {decision, candidateLeadIds}, captureKey —
written once by the server from the session, see docs/CRM-LEAD-CAPTURE.md §5),
`captureKey` (TEXT, unique — the idempotency key of the capture attempt) and
`captureFiles` (FILES, up to 5 — the visiting card / screenshot / document the
lead was captured from).

## Import batch (`lvImportBatch`, Day 8)
name (file name), importKey (unique; each row's capture key is
`importKey:rowNumber`), file (FILES, 1 — the uploaded CSV), status (UPLOADED /
VALIDATED / IMPORTED / FAILED), rowCount, mapping (column → target), summary
(valid / warnings / errors / duplicates), report (per-row result with lead ids),
importedById. Written only by the capture import routes (application role);
exists because the sandboxed capture screen cannot read a picked file (CM-006),
so the server parses the uploaded CSV, and because an import should be
reviewable afterwards.

## Person
Name, phone, email, location, languages, social profiles, roles, consent, relationship health.
Twenty's `person`. Since Day 9 a partner links to its contact person (`lvPartner.contact`), an experience to its host (`lvExperience.host`) and a property to its manager (`lvProperty.manager`); approval links an existing person by email or creates one from the onboarding answers.

## Organisation
Name, type, location, website, social profiles, description, people, experiences, properties, status.
Twenty's `company`; `lvPartner.organisation` links to it (existing by name, else created from the onboarding).

## Partner (`lvPartner`, Day 9)
name, partnerCode (`LVP-000042`, unique, server-allocated), sourceKey (unique idempotency key — `onboarding:<id>` / `manual:<uuid>`), status (PROSPECTIVE, ONBOARDING, APPROVED, ACTIVE, PAUSED, SUSPENDED, INACTIVE, OFFBOARDED), statusReason, partnerType, category, subcategory, description, emails, phones, website, instagram, location, geography, languages, pricing / availability / policies (RAW_JSON as stated in onboarding), approvedAt, activatedAt, provenance; relations owner (member), contact (person), organisation (company), lead, onboarding; reverse experiences, properties. Lifecycle, readiness and approval chain: `docs/CRM-ECOSYSTEM.md`.

## Experience (`lvExperience`, Day 9)
name, experienceCode (`LVE-`), sourceKey, status (DRAFT, IN_REVIEW, CHANGES_REQUIRED, READY = approved, LIVE = active, PAUSED, SUSPENDED, RETIRED = archived), statusReason, category, subcategory, shortDescription, description, hostName, location, destination, meetingPoint, durationMinutes, minParticipants, capacity, basePrice (CURRENCY), priceUnit, availability, languages, ageRequirement, difficulty, accessibility, included, excluded, requirements, safetyInformation, cancellationPolicy, images (FILES), documents (FILES), submittedAt, approvedAt, activatedAt; relations partner, host (person), owner, reviewer, onboarding.

## Property (`lvProperty`, Day 9)
name, propertyCode (`LVR-`), sourceKey, status (same machine as experience), statusReason, propertyType (Villa, Homestay, Boutique stay, Resort, Hotel, Farm stay, Heritage property, Luxury stay, Unique stay, Glamping property, Hostel, Retreat centre, Property manager, Property owner, Venue, Other), description, location, streetAddress, destination, capacity (sleeps), rooms, amenities, basePrice, priceUnit, availability, checkIn, checkOut, cancellationPolicy, houseRules, images, documents, submittedAt, approvedAt, activatedAt; relations partner, manager (person), owner, reviewer, onboarding.

## Onboarding
Lead/partner, current step, progress, health score, missing information, documents, verification state, reviewer, approval state.

## Activity
Channel, timestamp, actor, duration, purpose, summary, sentiment, outcome, objections, commitments, next action, next follow-up.

## Problem
Type, severity, lead, reporter, description, root cause, status, resolution, AI recommendation.

## Document
Type, owner, uploadedAt, expiry, verification status, OCR/extraction result, mismatch flags, reviewer.

## Notification
Recipient, type, priority, related record, message, deep link, read state, createdAt, dueAt, delivery channel.

## AI Insight
Entity, type, score, explanation, evidence, confidence, createdAt, expiry, human decision/status.

## Audit event
Actor, action, entity, entity ID, timestamp, before, after, reason, request/source context.

Actions (`lvAuditEvent.action`): the governance set — ARCHIVE, CLOSE, MARK_DUPLICATE,
REOPEN, TRASH, RESTORE, PERMANENT_DELETE — and, since Day 7, the relationship
operations performed from Lead 360: STATUS_CHANGE, OWNER_CHANGE,
INTERACTION_LOGGED, TASK_CREATED, TASK_COMPLETED, TASK_RESCHEDULED, NOTE_CREATED;
and, since Day 8, the capture chain: CAPTURE_STARTED, CAPTURE_EXTRACTED,
CAPTURE_REVIEWED, CLASSIFICATION_ACCEPTED / EDITED / REJECTED,
DUPLICATE_DETECTED / MERGED / IGNORED / CREATED_NEW, LEAD_CREATED,
ASSIGNMENT_RECOMMENDED / ACCEPTED / CHANGED / FAILED, IMPORT_STARTED /
COMPLETED / FAILED (target `lvCapture`/captureKey or `lvImport`/importKey before
a lead exists, `lvLead`/id after). Since Day 9 also the ecosystem: PARTNER_CREATED,
PARTNER_LINKED, PARTNER_STATUS_CHANGE, PARTNER_OWNER_CHANGE, EXPERIENCE_CREATED,
EXPERIENCE_STATUS_CHANGE, PROPERTY_CREATED, PROPERTY_STATUS_CHANGE,
ACTIVATION_READINESS (REFUSED when activation is attempted NOT_READY),
ENTITY_OWNER_CHANGE — every refused transition is a row too.
Every row is written with the application role from the session-derived actor;
`metadata` carries the before/after (status from/to, owner from/to, task id,
interaction id). Assignment decisions are additionally recorded in
`lvAssignmentHistory` (strategy MANUAL for a hand-made change), AI decisions in
`lvAiInsight` (humanDecision, reviewer), and document decisions in the
document's own `auditTrail`. Twenty's `timelineActivity` remains the
field-level history of every record.

## Lead 360 (composed, not stored)
Lead 360 is a server-composed view (`POST /leads/360`), never a table: lead
with owner, caller capabilities, next action (earliest open task + rules-based
next best action), bounded open tasks (8), interactions (10), notes (6), a merged
relationship timeline (30 entries from lead creation, assignment history,
interactions, tasks, notes, SLA breaches/resolutions, onboarding, document
decisions, audit rows and AI decisions), onboarding progress with its documents,
open SLAs, rules intelligence (opportunity score, relationship health, next best
action, data quality), the assignment history and (Day 8) the capture summary
derived from `captureProvenance` (method, platform, captured by/at, original
link or handle, extraction and classification outcome, duplicate decision,
attached files). All of it is read under the caller's token, so CM-004 and
object permissions decide what appears. Since Day 9 it also carries `ecosystem`: the
partner the lead became (code, status, readiness) and its experiences / properties.
Partner 360 (`POST /partners/360`), Experience 360 and Property 360 are composed the
same way — see `docs/CRM-ECOSYSTEM.md`.

Use a stable human-readable LV Lead ID while preserving Twenty internal IDs as technical identifiers.
