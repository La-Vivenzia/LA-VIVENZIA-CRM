# CRM Lead Capture — the one way a relationship enters La Vivenzia CRM

*Day 8. Supersedes the Day 1 "Quick add lead" form; complements
`LA_VIVENZIA_CRM_DOCUMENTATION/CAPTURE-OCR.md` (the original specification).*

```
DISCOVER → CAPTURE → EXTRACT → REVIEW → CLASSIFY → DUPLICATE CHECK
        → CREATE LV LEAD → ASSIGN → NOTIFY → NEXT ACTION → LEAD 360
```

Every method — a typed name, a photographed card, a pasted website, a social
handle, a referral, a spreadsheet — goes through the same chain, the same
routes and the same records. Nothing is created until a person has looked at
it, and nothing is claimed on screen that the server did not do.

## 1. Where it lives

| Surface | Path |
|---|---|
| Page | Sidebar **Workspace → Capture lead** (page layout `PL_QUICK_ADD_ID`, front component `lv-capture-lead`). ⌘K → "Capture lead". |
| Entry points | My Dashboard header (gold "Capture lead"), Lead 360 action bar ("Capture lead" for anyone who may create leads), the sidebar, the command menu. Mobile: the same page by URL / ⌘K; the sidebar is collapsed on a phone. |
| Component | `src/modules/lv-capture/front-components/capture-lead/` — `capture-lead.tsx` (screen), `capture-state.ts` (state machine, unit-tested), `import-leads.tsx` + `import-state.ts` (CSV branch). `capture-lead.front-component.tsx` is the JSX-free `defineFrontComponent` wrapper. |
| Routes | `POST /capture/extract`, `/capture/preflight`, `/capture/create`, `/capture/import/inspect`, `/capture/import/validate`, `/capture/import/commit` — all `isAuthRequired`, all refuse API keys (`NOT_AUTHENTICATED`): capture is something a signed-in person does. |
| Services | `services/capture-request.ts` (input parsing — never reads owner/actor ids), `services/extraction.ts` (image + page metadata + SSRF guard + `fetchOwnFile`), `services/capture-service.ts` (quality hints, duplicate scan, assignment recommendation, idempotent create, owner-at-creation notification), `services/import-service.ts` (row validation, duplicates in-file and against the CRM), `services/import-batch.ts` (the uploaded CSV: batch record, mapping, server-side parse). |
| Constants | `constants/capture-methods.ts` — the 19 methods, their input kind, default source and whether a person must confirm before creation. |

## 2. The methods

| Group | Method (`captureMode`) | Input | Default source | Needs confirmation |
|---|---|---|---|---|
| Manual | MANUAL, OTHER | form | OTHER | — |
| Image | VISITING_CARD, IMAGE, SCREENSHOT, BROCHURE, FLYER, POSTER | photo / file | EVENT for flyer & poster, OTHER otherwise | **yes** |
| Link | WEBSITE_URL (URL), INSTAGRAM, INSTAGRAM_POST, LINKEDIN_PROFILE, SOCIAL_HANDLE (handle or profile link) | text | WEBSITE / INSTAGRAM / LINKEDIN / platform | — |
| People | REFERRAL, PARTNER_REFERRAL, EVENT, WALK_IN, PHONE | form (+ referrer) | REFERRAL / PARTNER_REFERRAL / EVENT / WALK_IN / PHONE | — |
| Bulk | IMPORT | CSV | IMPORTED | per row |
| System | API (not offered on screen) | — | — | — |

The five primary actions on the entry screen (Capture manually · Upload image ·
Paste URL · Paste social profile · Import CSV) cover the common cases; the
full menu is one tap below. Choosing a method only decides the input step and
the default source — everything after REVIEW is identical.

## 3. The steps

**CAPTURE (input).** Manual and people methods show the essentials (name,
organisation, phone, email, location, category, subcategory, source) with
"More detail" folded away (job title, website, Instagram, social profile,
priority, notes). Image methods open the camera (`<input type="file"
accept="image/*" capture="environment">`) or a file picker — JPG, PNG, WEBP up
to 6 MB — with "Type it instead" always available. Link methods take one
field.

**EXTRACT.** Runs only for image and link methods, through `/capture/extract`:

- *Image (OCR).* The photo is uploaded into the lead's `captureFiles` FILES
  field through the platform uploader (see CM-006 for why the component
  cannot read bytes itself), and the route fetches it back **from this
  server's own signed file URL only** (`fetchOwnFile`: same origin as
  `TWENTY_API_URL`, `/file/files-field/<id>`, token present). The image goes
  to the Day 6 AI provider as a vision request (`CAPTURE_EXTRACTION_PROMPT`,
  temperature 0) and returns per-field values with a confidence; the run is
  recorded as an `lvAiRun` (operation `CAPTURE_EXTRACTION`, target
  `lvCapture`/captureKey). Without a provider the result is `UNAVAILABLE` and
  the screen says so: *"Unable to extract information automatically. No AI
  provider is configured…"*. **Provider-dependent** — in the dev workspace no
  key is configured, so every image capture takes the honest manual path; the
  image still stays attached to the lead.
- *Website URL.* Public page metadata (`og:site_name`, title, description,
  `mailto:`, `tel:`, Instagram/LinkedIn links, locality) is read with a 6-second
  timeout, 512 KB cap and a UA that says what it is. Private and link-local
  addresses, `.local`/`.internal`, bare hosts and non-http(s) schemes are
  refused (`isFetchableUrl`). Social hosts are never fetched.
- *Social profile / handle.* Parsed only (`parseSocialProfile`): platform,
  handle, canonical URL. No platform API, no scraping — the response is
  `UNAVAILABLE` with the reason spelled out; the handle and link are kept as
  the lead's Instagram / social profile.

Extracted values land only in **empty** fields, each marked *Read
automatically · high/medium/low confidence*; editing one makes it the
person's own. A confirmation-required method cannot create until the person
has been through REVIEW (`isHumanConfirmed`), and the server enforces that
too (`INVALID_INPUT`).

**REVIEW.** `/capture/preflight` (stage START) builds the draft with the same
builder every capture has used since Day 1 (`buildLeadDraft`), returns data
quality hints (missing contact / phone / email / organisation / location /
category; malformed email / phone / website) and — when no category is set —
a **draft classification** (`classifyDraft`, `lvAiRun` operation
CLASSIFICATION on the capture key; `AI_SUGGESTED` ≥ 0.6 confidence,
`REVIEW_REQUIRED` below, `UNAVAILABLE` without a provider). A confident
suggestion fills the category as *AI suggestion*; a weak one stays a
suggestion with **Accept / Reject**, and changing the category by hand is
*Edit*. The decision (ACCEPTED / EDITED / REJECTED / MANUAL) travels with the
create request and is audited. The model sees the minimised draft only: name,
organisation, location, source, website, handle, languages and *whether* an
email/phone exists — never their values, never notes, never the image text.

**CHECK (duplicates + assignment).** `/capture/preflight` (stage REVIEW) runs
the Day 6 duplicate scan (`scanDuplicates`, under the caller's token, so a
Hunter is compared against what they can see) and a **dry run of the
assignment engine** (`recommendAssignment` → `selectAssignee` with the live
members, rules and existing-relationship lookup). The screen shows:

- *Possible duplicate* — similarity %, matching fields, status, and
  **Open existing / Create new anyway / Ignore — not the same**. Create is
  disabled until a decision is made. Merging into an existing lead stays on
  that lead's Intelligence tab (owner/admin, Day 6 route) — the capture
  screen does not merge, because the person capturing may not own the
  existing lead.
- *Recommended owner* with the why (matched factors, open-lead count of
  capacity, or the round-robin / existing-relationship reason) and
  **Assign to X / Assign to me / Assign manually / Leave unassigned**; or
  *No automatic match* with the engine's reason, defaulting to "Assign to
  me".

**CREATE.** `/capture/create`:

1. Session actor only. `assignment.mode`: ENGINE (leave it to the
   `lvLead.created` handler — the history strategy then reflects what really
   happened), SELF, MEMBER (**admin only** for a colleague — a non-admin
   naming anyone but themselves is refused with `POLICY` and audited
   `ASSIGNMENT_CHANGED:REFUSED`), NONE.
2. **Duplicate gate.** If no decision was sent, the server scans again and
   refuses `DUPLICATE_UNDECIDED` when it finds candidates (audited
   `DUPLICATE_DETECTED:REFUSED`). A replay of an already-created capture
   skips this.
3. **Idempotent create.** Every attempt carries a client-minted `captureKey`
   (UUID, `lvLead.captureKey` is unique). A second press, a retry after a
   timeout, or two racing requests all resolve to the same lead
   (`findLeadByCaptureKey` before the write and again on a unique violation);
   the response says `replayed: true`.
4. The lead is created **as the caller** (permissions and CM-004 apply), with
   `captureProvenance` (see §5) and the attachment; the LV ID is allocated
   synchronously (`allocateLeadId`). `LEAD_CREATED` audited.
5. Classification and duplicate decisions are audited
   (`CLASSIFICATION_ACCEPTED/EDITED/REJECTED`, `DUPLICATE_CREATED_NEW/IGNORED`);
   the duplicate decision is also stored as a Day 6 `lvAiInsight` DUPLICATE
   row with the pair fingerprint, so an ignored pair is not suggested again.
6. Assignment: SELF/MEMBER set the owner at creation (the `lvLead.created`
   handler honours an existing owner as manual precedence); ENGINE polls the
   owner for up to 4 s and reports `ASSIGNED`, `PENDING` (still routing —
   Lead 360 will show it) or `UNASSIGNED` with the reason. **It never claims
   an assignment it did not observe.** The Day 4 notification producer
   (`lv-notifications/on-lead-updated`) sends LEAD_ASSIGNED to the owner.
7. Next action: the Day 6 NBA for a new lead ("First contact with …" / "Find
   contact details for …") becomes a real task through the shared
   `createLeadTask` service, assigned to the owner (or the capturer), and
   mirrored onto `nextAction` / `nextFollowUpAt`. If the task fails the lead
   is still returned, with `taskError`.

**SUCCESS.** LV ID, owner (or "Unassigned — reason" / "Routing in progress"),
next action, **Open Lead 360**, **Capture another** (same method), Done.

## 4. CSV import

`UPLOAD → MAP → VALIDATING → REVIEW → IMPORTING → REPORT`, in the same
component (Import CSV). The file (≤ 2 MB, ≤ 2 000 rows, comma / semicolon /
tab, quotes, CRLF, BOM — `utils/csv.ts`) is uploaded through the platform
uploader into an **`lvImportBatch`** record (the sandbox cannot read the file
itself — CM-006) and parsed **by the server**: `/capture/import/inspect`
reads it back from the server's own signed file URL, returns the headers, a
three-row sample, the row count and a proposed mapping, and records the batch
(file, status UPLOADED, who). Validate and commit re-read the same file and
apply the mapping the person chose; the batch keeps the mapping, the
validation summary and the final report, so an import can be looked at
afterwards. (API callers may still send `rows` inline to validate/commit.)

- **Map.** Headers are auto-matched by synonym (`utils/import-mapping.ts`:
  Name, Organisation/Company, Job title, Email, Phone/Mobile, Website,
  Instagram, Social profile, Location/City, Category, Subcategory, Source,
  Priority, Languages, Owner, Notes); anything else can be mapped by hand;
  one target per column.
- **Validate** (`/capture/import/validate` with the mapping, audited `IMPORT_STARTED`). Each
  row goes through the same draft builder, then: loose category / source /
  priority matching against the dynamic taxonomy ("villa" → STAY / VILLA,
  "Restaurants" → BUSINESS_PARTNER / RESTAURANT; an unknown source becomes
  IMPORTED with a warning; an unknown category is an error); owner by email
  or name (unknown → error); invalid email / phone / website → error;
  duplicates **within the file** (first row wins) and **against the CRM**
  (the Day 1 matcher over a duplicate-key shortlist, under the caller's
  token). Summary: Valid / Warnings / Errors / Duplicates.
- **Review.** Per-row Create / Skip; errors are always skipped, duplicates
  default to Skip ("Create anyway" is one tap), with "Skip all / Create all
  duplicates".
- **Import** (`/capture/import/commit` with the mapping and per-row decisions). Every accepted row is created through
  `createCapturedLead` with `captureKey = importKey:rowNumber`, so re-sending
  the same file reports `EXISTS` instead of duplicating. An owner column is
  applied only when the importer is an admin or names themselves; otherwise
  the row goes through the engine and the report counts an owner warning.
  Report: Created / Existing / Skipped / Failed per row with LV IDs; audited
  `IMPORT_COMPLETED` (or `IMPORT_FAILED`).

Twenty's native spreadsheet importer remains available on the Leads list; it
bypasses all of the above (no LV validation, no duplicate intelligence, no
capture provenance). An application cannot extend it, which is why the LV
import is app-side.

## 5. Provenance (`lvLead.captureProvenance`, RAW_JSON)

```json
{
  "method": "VISITING_CARD", "platform": null,
  "originalUrl": null, "originalHandle": null,
  "capturedAt": "2026-09-16T05:12:10.000Z", "capturedById": "<workspace member>",
  "extraction": { "status": "UNAVAILABLE", "kind": "OCR", "runId": null, "fieldCount": 0 },
  "classification": { "status": "MANUAL", "runId": null },
  "verification": "CONFIRMED_BY_PERSON",
  "duplicateDecision": { "decision": "NONE", "candidateLeadIds": [] },
  "captureKey": "<uuid>"
}
```

Written once at creation, by the server, from the session — never from the
request body. The Day 1 `fieldProvenance` (per-field USER_ENTERED /
OCR_EXTRACTED / DERIVED / AI_SUGGESTED) and `rawCaptureInput` are unchanged.
`captureProvenance` is **not** part of the model context (the minimiser
whitelists fields).

**Lead 360** shows it: the Overview section gains a *Capture history* block
(method · platform, captured by, captured at, original handle / link,
automatic extraction outcome, duplicate check, attached files) and the
timeline's "Lead created" entry reads *Captured via Visiting card by Tim ·
automatic extraction unavailable · duplicate check: ignored*. Leads created
before Day 8 (or through the API / native importer) show the Day 1 entry
("Source: …") and no block.

## 6. Security

- `readRouteInput` gives the actor from the session; `actorId`,
  `workspaceMemberId`, `ownerId`, `reviewerId` in a body are ignored
  (`readCaptureInput` never reads them).
- Assigning to someone else at capture: admin only. Everyone may claim.
- Create runs under the caller's delegated token: a role without `lvLead`
  update permission (Onboarding Expert) is refused by the platform
  (`NOT_PERMITTED`), and CM-004 scopes what a Hunter can see in duplicate
  checks and imports.
- Image bytes are read only from this server's own signed file endpoint;
  page metadata only from public http(s) hosts; social platforms never.
- Upload/download of files requires the platform `UPLOAD_FILE` /
  `DOWNLOAD_FILE` flags — granted (Day 8) to Experience Hunter, Lead
  Coordinator and Operations, who capture leads; Main Admin has all settings.
- Privacy: the model receives the image itself (that is the point of OCR) and
  the minimised draft; never raw email/phone values, notes or
  `rawCaptureInput`. The Day 6 privacy test still passes.

## 7. Audit trail (`lvAuditEvent`)

`CAPTURE_STARTED`, `CAPTURE_EXTRACTED` (kind, status, run, field count),
`CAPTURE_REVIEWED`, `CLASSIFICATION_ACCEPTED / EDITED / REJECTED`,
`DUPLICATE_DETECTED` (candidates), `DUPLICATE_CREATED_NEW`,
`DUPLICATE_IGNORED`, `LEAD_CREATED` (APPLIED / REFUSED with the platform
reason), `ASSIGNMENT_RECOMMENDED` (member, strategy, reasons),
`ASSIGNMENT_ACCEPTED`, `ASSIGNMENT_CHANGED` (incl. REFUSED spoof attempts),
`ASSIGNMENT_FAILED`, `IMPORT_STARTED / COMPLETED / FAILED`, plus the existing
`TASK_CREATED`. Before a lead exists the target is `lvCapture` / captureKey;
after, `lvLead` / lead id. `DUPLICATE_MERGED` is reserved for the Day 6 merge
route.

## 8. Honest limits

- **OCR and draft classification are provider-dependent.** They work when
  `LV_AI_PROVIDER` / `LV_AI_API_KEY` are configured (OpenAI and Anthropic
  dialects both carry images); in the dev workspace no key is set, so every
  image capture reports *Unable to extract information automatically* and
  continues by hand. No mock stands in for the provider anywhere.
- Social capture keeps the handle and link only. No Instagram / LinkedIn /
  WhatsApp integration, no scraping.
- Merge at capture is deliberately not offered; Open existing + the Day 6
  merge on the Intelligence tab is the path.
- PDF brochures are not extracted (images only); a PDF can still be attached
  through Twenty's record page.
- The native Twenty importer is untouched and unvalidated.

## 9. Verification

- Unit: `src/modules/lv-capture/__tests__/universal-capture.test.ts` (methods,
  social parsing, draft modes, request parsing, quality, SSRF guard, page
  metadata, CSV, mapping, import validation) and `capture-state.test.ts`
  (screen state machine, import state machine, Lead 360 capture summary).
- Integration (live server, real sessions):
  `src/__tests__/lv-capture.integration-test.ts` — API-key refusal, manual
  create + idempotent replay + provenance + audit, owner spoof refused / self
  claim, CM-004 refusal, unconfirmed image refused, image extraction honesty,
  URL / private-address / social handling, duplicate gate + recorded decision,
  CSV validate + commit + re-commit, Lead 360 capture summary.
- Browser: `.notes/d8/d8-browser.mjs` — nine scenarios, four widths in the
  responsive sweep, fixtures destroyed afterwards.
