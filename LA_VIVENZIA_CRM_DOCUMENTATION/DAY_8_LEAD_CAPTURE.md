# Day 8 — Universal Lead Capture, Acquisition and Assignment Operations

**Status:** implemented on Twenty 2.39.0, application `lavivenzia-crm`, plus
one documented core change (CM-006). **Date:** 2026-09-16.

One coherent **Capture lead** experience replaces the Day 1 Quick Add form:
nineteen ways a relationship can be discovered, one review, one duplicate
check, one assignment decision, one server-created lead with an LV ID, a next
action, and a Lead 360 that shows how it all happened. The full description
is in `docs/CRM-LEAD-CAPTURE.md`; this page is the day's record.

---

## 1. Audit (before coding)

`.notes/d8/audit.md` — 26 items. DONE and untouched: lead creation, LV ID
allocation, source taxonomy, post-creation AI classification, Day 6 duplicate
intelligence and decision routes, the assignment engine, notifications, NBA,
RBAC, CM-004, Lead 360. PARTIAL → completed: Quick Add, manual capture, URL and
social capture, provenance, assignment UI, CSV import and mapping, mobile
capture, audit. MISSING → built: image capture, OCR (vision through the Day 6
provider), import validation, import duplicate handling.

## 2. What was built

| Area | Delivered |
|---|---|
| Capture methods | 19 on screen + API (`constants/capture-methods.ts`); `LEAD_CAPTURE_MODES` 8 → 20; `SOCIAL_PLATFORMS`; `IMAGE_CAPTURE_MODES` require a person's confirmation |
| Entry screen | 5 primary actions (Capture manually · Upload image · Paste URL · Paste social profile · Import CSV) + the full menu |
| Screen | `lv-capture/front-components/capture-lead/` — CHOOSE → INPUT → EXTRACTING → REVIEW → CHECKING → DECIDE → CREATING → SUCCESS; import branch UPLOAD → MAP → VALIDATING → REVIEW → IMPORTING → REPORT; state machines unit-tested; Day 7B kit throughout; 44 px targets; 320–1920 |
| Extraction | `/capture/extract`: vision OCR (image fetched from the server's own signed file URL; `CAPTURE_EXTRACTION_PROMPT`; `lvAiRun` CAPTURE_EXTRACTION), public page metadata (SSRF-guarded), social handle parsing (no scraping). HIGH / MEDIUM / LOW confidence per field; every field editable; `UNAVAILABLE` stated honestly |
| Review | `/capture/preflight`: draft (Day 1 builder), quality hints, draft classification (`classifyDraft` — AI_SUGGESTED / REVIEW_REQUIRED / UNAVAILABLE; ACCEPT / EDIT / REJECT on screen), duplicate scan, assignment recommendation with reasons (dry run of `selectAssignee`) |
| Create | `/capture/create`: session actor; admin-only colleague assignment; server duplicate gate; idempotent by `captureKey`; created as the caller; synchronous LV ID; provenance; classification/duplicate audit + Day 6 insight; ENGINE/SELF/MEMBER/NONE assignment reported truthfully (ASSIGNED / PENDING / UNASSIGNED / FAILED); NBA task through `createLeadTask`; owner notified through the Day 4 dispatcher when assigned to someone else at creation |
| Import | `lvImportBatch` object; `/capture/import/inspect` (server parses the uploaded CSV, auto-maps), `/validate` (taxonomy, owners, email/phone/URL, in-file and CRM duplicates, summary), `/commit` (per-row decisions, `importKey:row` capture keys, report, batch record). Inline `rows` still accepted for API callers |
| Data model | `lvLead`: `jobTitle`, `socialProfiles`, `captureProvenance`, `captureKey` (unique), `captureFiles` (FILES ×5). New `lvImportBatch`. 18 audit actions |
| Lead 360 | `capture` summary in the model; *Capture history* block on Overview; timeline "Lead created" reads *Captured via … by … · extraction … · duplicate check …*; `Capture lead` action; `canCapture` capability |
| Entry points | Sidebar Workspace → Capture lead (IconCameraPlus), ⌘K "Capture lead", My Dashboard header, Lead 360 action bar (`openCapturePage` resolves the page id through metadata) |
| Roles | `UPLOAD_FILE` + `DOWNLOAD_FILE` flags for Experience Hunter, Lead Coordinator, Operations |
| Provider | `AiRequest.images`; OpenAI and Anthropic dialects send images; `runPrompt(…, images)` |
| Core | **CM-006** — files picked in a front component reach `uploadFile` through a host-side handle (renderer + one host hook) |

## 3. Fixes found on the way

- **Day 6 duplicate scan was silently empty on the live platform.** Twenty
  2.39 refuses `containsAny` on ARRAY fields (only `containsIlike`, `is`,
  `isEmptyArray`), so the shortlist query errored and `scanDuplicates`
  returned no candidates for every lead — the Intelligence tab's duplicate
  panel could never fire. Now one escaped `containsIlike` clause per key, and
  a GraphQL error is thrown rather than read as "no duplicates". The import
  matcher uses the same shape.
- Invalid category/subcategory values from a stale client are dropped with a
  warning in the draft builder instead of failing at the database, and a
  rejected value is reported as `INVALID_INPUT`, not as a permission problem.
- `LvTable` used `CSS.escape`, which the sandboxed renderer does not provide.
- `crypto.randomUUID` is not always present in the sandbox; the fallback now
  produces a well-formed v4 UUID (the routes validate the shape).

## 4. Verification

| Layer | Result |
|---|---|
| Unit | 48 files / 999 tests (`npx vitest run --project unit`) — 36 new (`universal-capture.test.ts`, `capture-state.test.ts`, image parts in `ai-provider.test.ts`) |
| Integration (live server, real sessions) | 7 files / 52 tests — 10 new in `lv-capture.integration-test.ts` |
| Browser (`.notes/d8/d8-browser.mjs`) | 9 scenarios, see §5; screenshots in `.notes/d8/shots/` |
| Typecheck / lint | app: clean; `twenty-front`: unchanged pre-existing count |
| Regression | Day 5 / 6 / 7 browser suites re-run after the change (D7's Quick Add scenario updated to the capture flow) |

## 5. Browser scenarios

| # | Scenario | Outcome |
|---|---|---|
| 1 | Mobile (390) manual capture: entry → form → review (quality hints) → check (recommendation) → create in ~15 s → LV ID, owner, next action, Open Lead 360; task and audit rows real | PASS |
| 2 | Visiting card photo: uploaded into `captureFiles`, server reads it back, provider absent → *Unable to extract information automatically*, continued by hand, lead created with the image attached | PASS (OCR itself provider-dependent) |
| 3 | URL capture (`https://example.com`): page metadata extracted ("Example Domain"), marked for confirmation, lead created with the website | PASS |
| 4 | Duplicate: detected before creation with %, fields, OPEN EXISTING / CREATE NEW / IGNORE; Create disabled until decided; Open existing navigates; Ignore creates and records the decision (insight + audit) | PASS |
| 5 | Assignment: recommended owner with reasons, ENGINE assignment applied by the existing engine (history strategy SCORED), owner notified | PASS |
| 6 | Admin assigns manually to Tim: owner at creation, Tim notified, success shows Tim | PASS |
| 7 | CSV import: upload → auto-mapped columns → validation report (1 valid, 1 warning, 1 error, 2 duplicates incl. one against the CRM) → import 2 → report with LV IDs; errors/duplicates skipped by default | PASS |
| 8 | Hunter security: assigning a colleague refused by the server (no lead, ASSIGNMENT_CHANGED:REFUSED), self-claim then succeeds as Tim | PASS |
| 9 | Responsive 320 / 390 / 768 / 1024 / 1440 / 1920 without overflow; Lead 360 capture history + timeline; dashboard and Lead 360 entry points | PASS |

## 6. Honest limits

- OCR and draft classification depend on a configured provider (none in dev);
  no mock stands in.
- Social capture keeps handle + link; nothing is fetched from Instagram,
  LinkedIn, Facebook, YouTube or X.
- Merge-at-capture is not offered; Open existing + the Day 6 merge is the path.
- PDFs are attachable but not extracted.
- Twenty's native importer is untouched and bypasses LV validation.
- The renderer `dist/` must be rebuilt after CM-006 on a fresh checkout
  (ENVIRONMENT.md).
