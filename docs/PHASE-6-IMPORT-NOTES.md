# Phase 6 — CSV Import

The spreadsheet route into the CRM, rebuilt on the Phase 0–5 system. No new
visual language: it is the capture workflow's promise — La Vivenzia does the
reading, the person stays in charge, nothing is created until they have seen
it — made about a whole file instead of one lead.

Screens: `packages/lv-app/src/screens/ImportScreen.tsx` and
`packages/lv-app/src/screens/import/steps.tsx`.
State and contracts: `packages/lv-app/src/api/import.ts`.
Upload: `packages/lv-app/src/api/files.ts`.

---

## The workflow, as the backend actually defines it

```
SELECT ─▶ UPLOADING ─▶ ANALYSING ─▶ MAP ─▶ VALIDATING ─▶ REVIEW ─▶ IMPORTING ─▶ RESULT
        │            │                   │                       │
        │            └ /capture/import/inspect                   └ /capture/import/commit
        └ platform file upload           └ /capture/import/validate
```

Three routes, and only the last one writes a lead.

| Route | Sends | Returns | Writes |
| --- | --- | --- | --- |
| `POST /capture/import/inspect` | `importKey`, `file { fileId, url, name, mimeType, size }` | `fileName, headers, sample (3 rows), rowCount, skippedEmptyRows, truncated, mapping` | The `lvImportBatch` record only |
| `POST /capture/import/validate` | `importKey`, `mapping` | `rows[], summary, duplicateError, members[]` | An `IMPORT_STARTED` audit row only |
| `POST /capture/import/commit` | `importKey`, `mapping`, `decisions[]` | `report[], summary, note` | One `lvLead` per accepted row |

The screen shape (`mapping` + `decisions`) is used throughout; the alternative
API shape (inline `rows`) exists for tests and integrations and is not used
here.

### The file never travels as bytes to a route

`/capture/import/inspect` refuses anything but *"the fileId and url of a CSV
uploaded through the CRM"*, and `fetchOwnFile`
(`services/extraction.ts:335`) will only read a URL on this server's own
origin matching `/file/files-field/<uuid>` with a signed token. So the CSV has
to go into `lvImportBatch.file` first.

The legacy front-component got that from the sandbox host (`uploadFile` in
`twenty-sdk/front-component`). `lv-app` is not a sandboxed component, so
`src/api/files.ts` performs Twenty's own three-step handshake directly against
`/metadata` with the signed-in person's token:

1. resolve the FILES field's metadata id (`objects { fields { id name } }`,
   cached for the session — the id is workspace-specific and cannot be baked
   in);
2. `createFileUpload(filename, size, fileFolder: FilesField, fieldMetadataId)`
   → `{ fileId, uploadUrl, contentType }`;
3. `PUT` the bytes at `uploadUrl`, then `completeFileUpload(fileId)` → the
   signed `url` the routes will accept.

**No backend change was needed for any of this.** The only reason step 3 uses
`XMLHttpRequest` rather than `fetch` is that it reports bytes sent, which is
the one genuine percentage anywhere in an import.

---

## The five screens

### 6.1 Select a file

`LvUploadZone` (drop zone on a wide screen, a single full-width *Choose a
file* on a phone), the real limits, and a collapsed list of the 16 columns the
server recognises by name. A *Download a blank template* button writes a
header row generated from the real target list, so every column in it
auto-maps.

The reassurance — *nothing is created by choosing a file* — is on this screen
rather than a later one, because it is only worth something while there is
still a decision to make.

Then two waits, both named:

- **Uploading** — `LvUploadItem` with the real byte fraction.
- **Analysing** — `LvStageWait`; there is nothing to measure, so it says what
  is happening instead of drawing a bar.

### 6.2 Map the columns

One row per column of the file: its header, **the values actually in it** (the
three sample rows the inspect route returns), and the field it becomes. A
header called "Contact" means nothing until you can see it holds phone
numbers.

The proposed mapping is the server's `autoMapColumns` — exact synonym match
first, then word containment, each target taken at most once. Nothing is
invented on the client: a target already used is left in the list but
disabled, and a column can always be set to *Do not import*.

The CTA states the real count: **Check 1,240 rows**.

### 6.3 Validate

`LvStageWait`, naming the four things the route is doing (building each row
into a lead, checking categories, checking owners named in the file, looking
for leads already in the CRM) and stating that nothing is created by it. No
percentage, because the route reports none.

### 6.4 Review and decide

Summary tiles straight from `summarise()` — total, ready, needs a look,
already here, cannot import — plus **Will be created**, which is counted from
the decisions rather than from the file.

Per row: what it will become, the server's messages verbatim, and for a
duplicate the lead it matched with its percentage, its matching fields and a
link to open it. Decisions default the way the legacy implementation defaults
them: `ERROR` and `DUPLICATE` start at *Skip*, everything else at *Import*.
A row the server refused cannot be forced through — the commit route would
refuse it again — so the toggle is replaced by the reason.

`duplicateError` gets its own banner. It is the one part of validation that
can fail on its own, and without saying so a row marked *Ready* would look
checked when it had been compared with nothing.

The primary CTA names the outcome — **Import 184 leads**, or **Finish without
importing** when every row is set to skip — and an `LvConfirm` states the full
consequence before the one irreversible step, including how many rows are
being left behind and that creation cannot be undone from this screen.

### 6.5 Result

`reportSummary` as tiles (created / skipped / already imported / failed), the
server's `note` about owners it could not apply, each created lead by its LV
number as a link to its profile, each failed row with its error, and two next
actions: see them in Leads, or import another file.

`EXISTS` is surfaced as *already imported* rather than folded into created:
the commit route is idempotent by `${importKey}:${rowNumber}`, so a retried
commit returns what exists instead of duplicating it, and the screen should
say which of the two happened.

---

## Real limits, from the code rather than invented

| Limit | Value | Where it is defined |
| --- | --- | --- |
| File size | 2 MB | `MAX_IMPORT_BYTES`, `services/import-batch.ts` |
| Rows per import | 2,000 | `MAX_IMPORT_ROWS`, `services/import-batch.ts` |
| Sample rows shown | 3 | `SAMPLE_ROWS`, `capture-import-inspect.logic-function.ts` |
| Recognised columns | 16, one required (`name`) | `IMPORT_TARGETS`, `utils/import-mapping.ts` |
| Delimiters | `,` `;` tab `\|`, detected from the header line | `detectDelimiter`, `utils/csv.ts` |
| Cell length | 500 characters | `readRows`, `capture-import.logic-function.ts` |

There is **no extension or MIME check** anywhere on the server — the parser
judges the contents. The picker's `accept` list is therefore a convenience,
not a rule, and the client rejects only an empty file or one over 2 MB, with
the size named in the message.

`truncated` (rowCount at the cap) gets a warning banner saying plainly that
the rest of the file is not in this import.

---

## Shared primitives, improved rather than duplicated

- **`LvUploadZone` gained `camera`** (default `true`). A camera cannot produce
  a spreadsheet, and offering *Take a photo* as the first and most prominent
  button on a phone sends people to photograph a file they already have. The
  capture screens are unchanged; the import zone passes `camera={false}` and
  the file picker becomes the primary button.
- **`LvStageWait` is new and shared.** Capture had this shape inlined twice
  (CHECKING and CREATING); import needed it three more times. It is now one
  kit component and `CaptureScreen` was rewritten onto it.
- **`Segmented` had a 32px inline `minHeight`** — below even the 36px compact
  floor, on every screen that uses it, and unfixable from the stylesheet
  because an inline style beats a media query. That geometry moved into
  `LvStyles` as `.lv-segmented > button`: 44px on a phone, 36px from 768px up.
  The `tabs` family already *claimed* a 44px target in the responsive
  contract; it is now true. Measured after the change: 141×44 at 390px,
  91×36 at 1440px.
- **`.lv-map-row`, `.lv-import-row`, `.lv-import-decision`, `.lv-segmented`**
  live in `LvStyles` with a phone rule and a ≥768px rule, like every other
  width-dependent class. No inline style decides layout.

Two families were added to the responsive contract — `waiting-states` and
`column-mapping` — and to `REQUIRED_FAMILIES` in the design-system test, so
the contract still covers everything the system ships (34 families).

---

## Mobile

Mobile is not the desktop narrowed:

- the drop zone is a file picker button, and the camera is gone entirely;
- a mapping row is a stack — header, its real values, then a full-width field
  picker — instead of three squeezed columns;
- the per-row decision moves **below** the row rather than to an edge a thumb
  cannot reach;
- the one action that moves the workflow on is pinned to the foot of the
  screen by `LvContextualActions`, which replaces the bottom nav while it is
  there;
- the confirmation is an `LvSheet` from the bottom edge, not a centred dialog.

---

## Entry point

Import is reached from Capture: a fourth group, *From a spreadsheet*, using
the same `SourceTile` as the fourteen single-lead methods (extracted from
`ChooseStep` for the purpose) so it reads as one of the ways a lead gets in
rather than a separate product. Route: `/capture/import`.

---

## Not changed

No backend file was touched in Phase 6. The 26 superseded front-components,
including `import-leads.tsx`, are still in the repository and still work; they
come out when `lv-app` covers every door.

---

## Two environment findings, neither in application code

Verifying this was the first time anything in `lv-app` used a FILES-field
upload, and it turned up two pieces of local configuration that had never been
exercised.

1. **`SERVER_URL` was unset**, so it fell back to its `http://localhost:3000`
   default while the server listens on 3102. `createFileUpload` therefore
   handed back `uploadUrl: http://localhost:3000/file-upload/…` and the PUT
   404'd. The same value feeds `TWENTY_API_URL` for logic functions
   (`logic-function-executor.service.ts:435,452`), which is exactly what
   `fetchOwnFile` compares the file's origin against, so `inspect` would have
   refused it a second time.
2. **The lv-app origin was not allowed a session cookie.** Twenty derives its
   credentialed-origin list from `SERVER_URL`, `FRONTEND_URL` (`:3001` here)
   and `AUTH_COOKIE_ALLOWED_ORIGINS`, so signing in from `:3200` was refused
   with *"Request origin is not allowed to receive a session cookie"*.

Both were supplied as environment variables on the dev server process for the
verification run — nothing was written to `packages/twenty-server/.env`:

```
NODE_ENV=development NODE_PORT=3102   SERVER_URL=http://localhost:3102   AUTH_COOKIE_ALLOWED_ORIGINS=http://localhost:3200   nest start --watch
```

(`nx start twenty-server` fails on this machine before reaching the server:
`twenty-sdk:build` shells out to `rimraf` with quoted globs that survive into
the argument, so it is run through `nest` directly.)

---

## Verified

Against a live backend, signed in as `tim@apple.dev`, with a 9-row CSV holding
deliberately imperfect headers and a deliberate mix of outcomes.

**Widths** — 320, 360, 375, 390, 430, 768, 820, 1030, 1280, 1440. No
horizontal overflow and no console errors at any of them.

**Auto-mapping** matched 11 of 14 columns by name and left three unmatched
(`Sub type`, `Where from`, `Rating`), which now carry a *Not matched by name*
badge. The two that belonged somewhere were set by hand on the screen.

**Validation**, from the real route: 3 ready, 1 needs a look, 2 already here,
3 cannot import, and *"2 blank rows were skipped while reading the file."*
Every message is the server's own —

- `Subcategory "Houseboat" is not under STAY; left empty.`
- `Source "Spreadsheet" is not a CRM source; recorded as Imported.`
- `Priority "Urgent" is not Critical / High / Medium / Low; left as Medium.`
- `Email "farah[at]qureshiateliers.com" is not valid.`
- `Category "Nightclub" is not one of the CRM categories.`
- `Owner "not.a.colleague@example.com" is not a team member.`

**Duplicates**, both kinds: an in-file repeat (*"The same details appear
earlier in this file, on row 3"*) and a real CRM match — *"Looks like Phase 5
Manual Verification (LV-000014) — 100% match on phone"* with a working
**Open it**. Note that leads seeded before duplicate keys existed carry an
empty `duplicateKeys` array and therefore can never be matched; that is a
backend data question, not a screen one.

**The CTA counted correctly**: *Check 9 rows* on the mapping step, *Import 4
leads* on review (3 ready + 1 warning; duplicates and errors default to skip),
and *Finish without importing* once every row was set to skip.

**Refusals** on the select screen: *"That file is 2.7 MB. The import reads up
to 2.0 MB, so split it and bring it in as more than one file."* and the
server's *"That file has no header row or no data rows."*

**The commit route ran for real, twice — at 1440 and at 390 — with every row
set to skip.** Result: created 0, skipped 9, already imported 0, failed 0, and
the screen said *"leads-import-test.csv was read and checked, and every row was
set to skip. The import is on record and the CRM is unchanged."*

**What that leaves unverified:** the created-lead path. Running it would add
leads that `lv-app` cannot delete — there is no delete route, only
`/records/delete-impact` — so it was stopped at that boundary deliberately.
Unverified as a consequence: the *"N leads imported"* heading, the list of
created leads with their LV numbers, the `EXISTS` (already imported) row
state, and the owner-warning `note`. All four render from `report` and
`summary` fields whose shapes are taken from the commit route's own return
statement, and the zero-create run exercised every other part of the same
screen.
