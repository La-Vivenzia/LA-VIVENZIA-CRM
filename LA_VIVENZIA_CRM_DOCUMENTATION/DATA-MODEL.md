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

## Organisation
Name, type, location, website, social profiles, description, people, experiences, properties, status.

## Experience
Name, category, description, location, capacity, pricing, availability, languages, images, quality signals, operational readiness, partner.

## Property
Type, location, capacity, pricing, availability, images, documents, owner/manager, partner.

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
a lead exists, `lvLead`/id after).
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
object permissions decide what appears.

Use a stable human-readable LV Lead ID while preserving Twenty internal IDs as technical identifiers.
