# Architecture

## Decision
Use Twenty CRM as the platform foundation and extend it with disciplined LV modules/apps.

### Platform layer
Auth, workspace, users, permissions, metadata, custom objects/fields, record UI, views, timeline, tasks/notes, email/calendar, workflows, APIs, import/export and AI runtime.

### LV modules
- lv-core
- lv-notifications
- lv-onboarding
- lv-assignment
- lv-sla
- lv-intelligence
- lv-capture
- lv-copilot
- lv-analytics

## Boundary rule
If Twenty already provides a primitive, configure or extend it rather than rebuilding it.

## Data boundary
Keep CRM and consumer/product databases separate initially. Integrate through typed APIs, events/webhooks and idempotent sync jobs.

## Domain objects
People, Organisations, Leads, Contacts, Experiences, Properties, Partners, Users, Tasks, Activities, Conversations, Emails, Documents, Onboardings, Problems, Notes, Categories, Custom Fields, Workflows, Notifications, Audit Logs, AI Insights.

## Relationship graph
One person can have multiple roles. One organisation can have multiple people. A partner can have multiple experiences. Experiences can have multiple locations. Relationships can involve multiple team members.

## Core modification rule
Prefer configuration and app extensions. Any Twenty core edit requires documented approval in CORE-MODIFICATIONS.md.

---

# Automation execution path (2026-09-10)

This is the path a lead actually travels. It uses Twenty's own event and queue
infrastructure throughout; La Vivenzia adds no queue, no scheduler and no
second event bus.

```
createLvLead (GraphQL)
  → record persisted
  → Twenty emits lvLead.created
  → bull:trigger-queue          (Twenty)
  → bull:logic-function-queue   (Twenty)
  → lv-on-lead-created handler
      ├─ re-read current lead state      ← not the event payload
      ├─ allocate LV Lead ID             (lv-core/services/lead-id-allocator)
      ├─ select assignee                 (lv-assignment/utils/select-assignee)
      ├─ apply owner + status
      ├─ append assignment history       (idempotent on eventKey)
      └─ upsert notification             (idempotent on dedupeKey)

createLvInteraction (GraphQL)
  → lvInteraction.created → same two queues
  → lv-on-interaction-created handler
      ├─ refresh lead relationship summary
      ├─ create Twenty task (follow-up)
      └─ link task to lead via taskTarget
  Timeline entries are emitted declaratively by the lvInteractionLogged
  timeline activity type — not written by the handler.
```

## Why the handler re-reads the record

A redelivered message still carries the record **as it was at creation**. The
real payload for a lead that has since been routed still reads
`lvLeadId: ""`, `ownerId: null`. Trusting it would re-allocate an identifier the
lead already holds and re-run routing that already happened, so the handler
queries current state first and decides from that. The event says *which*
record changed; the API says what it looks like *now*.

## Idempotency

Three independent guards, each enforced by a unique index in Postgres rather
than by application logic:

| Concern | Key | Index |
|---|---|---|
| Duplicate LV Lead ID | `lvLead.lvLeadId` | `IDX_UNIQUE_38a5115…` |
| Duplicate history row | `lvAssignmentHistory.eventKey` | `IDX_UNIQUE_c7024e8…` |
| Duplicate notification | `lvNotification.dedupeKey` | `IDX_UNIQUE_68bae0b…` |

`eventKey` is derived from the event, not the resulting state
(`lvLead.created:<leadId>`). That is what lets history stay **append-only** — a
genuine later reassignment adds a row — while a *replay* of the same event is
rejected. An explicit human reassignment passes no key and always appends.

Identifier allocation has no lock. Two workers may compute the same next number;
only one can write it, and the loser re-reads the highest issued id and retries.
The database is the arbiter, which is the only design that stays correct under
concurrency without locking.

**Verified, not assumed:** the identical job was re-enqueued onto the real
queue and processed a second time by the real worker. Before and after were
identical — history 2→2, notifications 1→1, `LV-000002` unchanged, owner
unchanged, job completed successfully.

## Known limitation

The LV Lead ID is allocated by the worker, so there is a short window after
creation in which it is empty. Twenty has no sequence field type and no
synchronous pre-create hook, so it cannot be assigned in the same transaction as
the insert. The id is stable and unique once written; it is not
*instantaneous*, and the UI should not assume it is present the moment a lead is
created.

The fixed-width format keeps string ordering equal to numeric ordering, which is
what makes "find the highest issued id" a cheap indexed lookup. That holds to
`LV-999999`; the allocator refuses past that rather than issue a duplicate.

---

# Route handlers receive an event, not their body (2026-09-10)

An HTTP-route logic function does **not** receive its JSON body as the handler
argument. Twenty hands it a Lambda-style proxy event:

```
{ headers, queryStringParameters, pathParameters, body, rawBody,
  isBase64Encoded, requestContext: { http: { method, path } }, userWorkspaceId }
```

Every route in this application read `input.onboardingId` directly, so every
field was `undefined`. The pre-existing `/onboarding/transition` route had the
same defect from the day it was written — invisible because nothing had ever
called it. `lv-core/utils/route-event.ts` now reads the envelope, and its tests
exist specifically to stop this returning.

`userWorkspaceId` is set by the platform from the authenticated session and
cannot be forged by the caller, so it is recorded in the audit alongside the
claimed actor.

**Known gap:** `userWorkspaceId` cannot be mapped to a `workspaceMember` id
from inside a logic function — the core API exposes no `userWorkspace` query
and `workspaceMember` is filterable only by `id`/`userId`/`userEmail`. So the
reviewer id on a decision is client-asserted, cross-checked against a
platform-authenticated session but not yet derived from it. Closing this needs
either a `currentWorkspaceMember` query or the mapping exposed to functions.

# Identifier allocation and soft deletes

A soft-deleted lead keeps its `lvLeadId`, and the unique index still counts it —
but the default API query hides it. The allocator therefore proposed a number
that was already taken, the insert was refused, it retried the same doomed
number, and gave up with CONTENTION. **One deleted lead wedged allocation
permanently.**

Found by running the pipeline against a database where a test lead had been
cleaned up, not by any unit test. The port now reads live and soft-deleted rows
and takes the larger. Identifiers are never reused, which is also what a
business key should do: `LV-000006` must not come back attached to a different
partner.

# Document layer

```
browser picks a file
  → uploadFile()                       Twenty FILES upload (magic-byte sniff)
  → POST /onboarding/documents/register
      validateUpload + isSafeStoredPath   ← the enforcement
      → lvOnboardingDocument PENDING, audit entry
  → POST /onboarding/documents/review     ← reviewer decisions
      transitionDocument()                 state machine, human-only guards
  → cron 15 2 * * * lv-expire-documents   ← the only system-applied transition
```

A FILES field stores `[{ fileId, label }]` — a reference, never a path string
and never bytes. Preview uses the signed URL Twenty issues per file.
