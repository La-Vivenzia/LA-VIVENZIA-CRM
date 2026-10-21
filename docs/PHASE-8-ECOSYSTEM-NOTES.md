# Phase 8 — Ecosystem

The partners La Vivenzia works with, and the properties and experiences they
put on the platform. Built on the Phase 0–7 system; no new visual language.

Screens: `packages/lv-app/src/screens/EcosystemScreen.tsx`,
`EcosystemRecordScreen.tsx`, `screens/ecosystem/{parts,transition}.tsx`.
Contracts and state: `packages/lv-app/src/api/ecosystem.ts`.

---

## Which eight screens

The brief's §2 named "People / Organisations / Experiences / Tasks", but it
also said to transform *"the 8 Ecosystem screens identified in the screen
inventory"* — and section 8 of `UI-SCREEN-INVENTORY.md` is Partners,
Properties and Experiences. The backend settles it: there are dedicated
routes for all six of the inventory's surfaces and nothing whatsoever for an
ecosystem of People, Organisations or Tasks. Karan confirmed the inventory
reading.

| # | Inventory screen | Where it lives |
| --- | --- | --- |
| 8.1 | Partners list | `EcosystemScreen` at `/ecosystem/partners` |
| 8.2 | Partner 360 | `EcosystemRecordScreen` at `/ecosystem/partners/:id` |
| 8.3 | Properties list | `EcosystemScreen` at `/ecosystem/properties` |
| 8.4 | Property 360 | `EcosystemRecordScreen` at `/ecosystem/properties/:id` |
| 8.5 | Experiences list | `EcosystemScreen` at `/ecosystem/experiences` |
| 8.6 | Experience 360 | `EcosystemRecordScreen` at `/ecosystem/experiences/:id` |
| 8.7 | Activation readiness | `LvReadinessPanel` — its own section of every record, and a tab |
| 8.8 | Ecosystem transition | `EcosystemTransitionSheet` |

Three lists are one screen and three 360s are one screen, because the server
composes each trio the same way. The columns differ; nothing else does.

**People and Organisations are not lost** — they are where the backend
actually puts them, on the partner's Connections tab, which is fed by the
`contact` and `organisation` links `/partners/360` returns. **Tasks** appear
there too, from the same payload. Nothing needed inventing to satisfy the
brief's intent.

---

## The routes, and what they decide

| Route | Returns |
| --- | --- |
| `POST /partners/360 { partnerId }` | record, contact, organisation, lead, onboarding, documents, experiences, properties, readiness, health, interactions, tasks, notes, timeline, audit, capabilities, settableStatuses, members |
| `POST /properties/360 { propertyId }` | record, partner, host, onboarding, documents, readiness, quality, timeline, audit, capabilities, settableStatuses, members |
| `POST /experiences/360 { experienceId }` | the same shape, for an experience |
| `POST /ecosystem/readiness { kind, id }` | the activation check alone |
| `POST /ecosystem/transition { kind, id, action, to, reason }` | applies a status change or an owner change |

The lists have no route and are read through GraphQL
(`lvPartners`, `lvProperties`, `lvExperiences`).

**Nothing is recomputed in the browser.** `capabilities`,
`settableStatuses` and `readiness` all arrive decided by the server, which
applies the transition table, the governance rule that nobody approves their
own work, the readiness gate and the platform's own write permission. The
interface shows what it is given. Where it *can* know in advance that a move
will be refused — a readiness-gated status while readiness is failing — it
says so on the option rather than letting someone discover it by pressing.

---

## Relationship visualisation: there is no graph, so there is no graph

The brief asked for a graph only if graph data exists. It does not. The 360
routes return **records with named links** — a contact, an organisation, a
lead, a partner, a host, an onboarding, an owner — not edges with weights or
types. Drawing a node-link diagram over that would be inventing structure the
backend does not have.

So Connections is a list of what this record is actually attached to, each
entry naming the relationship and opening the thing it points at. It answers
"why does this matter and what do I do with it" without pretending to a
topology nobody computed.

---

## Real vocabulary, from `constants/ecosystem-lifecycle.ts`

Partners move `PROSPECTIVE → ONBOARDING → APPROVED → ACTIVE`, with
`PAUSED`, `SUSPENDED`, `INACTIVE` and the terminal `OFFBOARDED`.
Listings move `DRAFT → IN_REVIEW → READY → LIVE`, with `CHANGES_REQUIRED`,
`PAUSED`, `SUSPENDED` and the terminal `RETIRED`.

Two labels are worth knowing because they are not what the value says:
`READY` displays as **Approved** and `LIVE` as **Active**. The server's own
labels are used verbatim.

`ACTIVE` (partner) and `LIVE` (listing) are readiness-gated. Suspension,
offboarding, pausing, requesting changes and archiving all require a written
reason, and the server refuses without one.

---

## Shared components

Reused as-is: `LvDataTable` (rows become cards below 768), `LvRecordHeader`,
`LvPageHeader`, `LvTabs`, `LvContextualActions`, `LvSheet`, `LvSectionCard`,
`LvRelatedList`, `LvTimeline`, `KpiTile`, `Segmented`, `LvSearchField`,
`EmptyState`, `ErrorState`, `LoadingState`, `InlineNotice`, `LvProgress`.

Added, and registered in the responsive contract as `activation-readiness`
(37 families): `LvReadinessPanel`, `LvListings`, `LvConnections`,
`LvDocumentSummary`, `EcosystemStatus`, `EcosystemTransitionSheet`.

**No new CSS class was needed.** Phase 8 is composition over the existing
layout primitives, which is the point of having spent Phase 0 on them.

### One shared-primitive fix, carried from Phase 7's sweep

`.lv-contextual-inner` did not wrap. At 320px a record with two pinned
actions pushed a button 9px past the viewport, because `LvButton` sets
`whiteSpace: nowrap` and so will not shrink below its own label. The row now
wraps below 768 and stays on one line above it. This affects every screen with
a pinned action bar — Capture, Import, Onboarding and Ecosystem.

---

## Permissions

Only two roles may write ecosystem records:

| Role | lvPartner | lvProperty | lvExperience |
| --- | --- | --- | --- |
| Operations | write | write | write |
| Experience Team | — | — | write |
| Administrator | write (via `canUpdateAllObjectRecords`) | write | write |
| Everyone else | read only | read only | read only |

`capabilitiesFor` turns that into the `capabilities` the screens obey:
`canChangeStatus` false hides the action bar entirely, and
`describeCapabilities` says why in a sentence rather than leaving a person
hunting for a button that was never there. A record's own owner gets
`canGovern: false` unless they are an administrator — they cannot approve or
activate their own work — and the screen says so.

---

## Three faults found by looking at the screens

None of these were caught by the typechecker, the linter or the tests. All
three were found by rendering a real record and reading it.

1. **`₹[object Object] per person`.** `basePrice` is a Twenty `CURRENCY`
   field, which stores `{ amountMicros, currencyCode }` — millionths of a
   unit, not a number. Read as a plain number it stringifies to
   `[object Object]`. Fixed in `formatMoney`, in `EcosystemRow`, in the
   `Listing360` type and in both list queries, which now select
   `basePrice { amountMicros currencyCode }`.

2. **Raw enums on screen.** The Category column and the record header showed
   `EXPERIENCE`, `STAY` and `VENUE` in upper snake case. `humanise` now maps
   them, preferring the server's own `LEAD_CATEGORY_LABELS` where a label
   table exists and falling back to sentence case where none does. Shouting a
   database value at a person is precisely the Twenty habit this product is
   replacing.

3. **The kind switcher appeared twice on a phone.** The overview tiles already
   move between partners, properties and experiences at full width; a second
   row of buttons under them was the same control twice. It is now
   `.lv-kind-switch`, hidden below 768 and a flex row above it.

### And one carried in from Phase 7's width sweep

`.lv-contextual-inner` did not wrap, so a record with two pinned actions
pushed a button nine pixels past a 320px viewport — `LvButton` sets
`whiteSpace: nowrap` and therefore will not shrink below its own label. The
row now wraps below 768. This is a shared primitive, so Capture, Import,
Onboarding and Ecosystem all get the fix.

---

## Verified

Against the live backend, on real records created through `/ecosystem/create`
and moved with `/ecosystem/transition`.

**The fixture is honest.** `ACTIVE` and `LIVE` were *refused* during seeding —
`NOT_READY: Not ready to activate: 6 requirements missing` — and those
refusals were kept rather than worked around. So the records on screen are
genuinely stuck where the server says they are stuck, and screen 8.7 is
showing reasons the backend actually computed: 7 of 12 checks passing for
Sanctuary House, 13 of 16 for the Fermentation experience.

**Permissions**, through the real role system and without weakening anything:

| Signed in as | Change status | Notice shown |
| --- | --- | --- |
| Administrator | offered, with the full transition sheet | — |
| Onboarding Expert (no ecosystem write) | not offered | "Your role cannot change this record's status." |

The transition sheet also marks a readiness-gated option as one the server
will refuse, quoting the first failing reason, rather than letting someone
find out by pressing it.

**Widths** — 320, 360, 375, 390, 430, 768, 820, 1030, 1280, 1440. No
horizontal overflow, no console errors and no failed API requests on any
ecosystem screen.

---

## Known limitations

- **Partners and Properties have no top-level navigation entry.** The Phase 1
  sidebar lists People, Organisations, Experiences, Tasks and Analytics;
  "Experiences" now leads to the real screen instead of a placeholder, and the
  overview tiles move between all three kinds from there. Adding Partners and
  Properties to the sidebar would change the approved Phase 1 navigation, so
  it is left for Karan to decide rather than done unilaterally.
- **`/ecosystem/create` did not persist the email and phone** passed in
  `fields` during seeding: the partner's readiness still reports "Neither an
  email nor a phone number is on file". The partner object stores these as
  `emails`/`phones` composites and the create route may expect different keys.
  This is backend behaviour, not a screen fault, and was left alone — Phase 8
  is a UI transformation and the route is out of scope.
- **People, Organisations and Tasks have no ecosystem screens of their own**,
  by design: they are Twenty standard objects with no ecosystem routes, and
  they appear on the partner's Connections tab where the backend links them.
