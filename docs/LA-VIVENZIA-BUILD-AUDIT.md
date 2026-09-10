# La Vivenzia CRM — Build Audit

**What this is:** a complete account of everything added to this repository on
top of Twenty 2.39.0, what is verified, what is not, and what is still missing.

**Date:** 2026-09-09
**Baseline:** Twenty 2.39.0 (source drop, no Git — see Risks)
**Repository:** `D:\lavivenzia-crm`

---

## 1. Headline numbers

| | |
|---|---|
| La Vivenzia application files | **109** |
| Source lines (excl. tests and generated) | **~8,900** |
| Unit tests | **609**, all passing |
| Integration tests (live server) | **8**, all passing |
| Typecheck / lint / build | **0 errors, 0 warnings** |
| Custom objects | **7** |
| Fields added (incl. on Twenty's standard objects) | **21 standalone + ~90 inline** |
| Logic functions | **3** |
| Front components | **2** |
| Views / page layouts / timeline types | **5 / 1 / 1** |
| Metadata entities installed on the live server | **636** |
| Twenty core files modified | **2 changes, both registered** (CM-001, CM-002) |

---

## 2. Where everything lives

Everything La Vivenzia is one application package. Twenty core is untouched
except for the two registered modifications.

```
packages/twenty-apps/internal/lavivenzia-crm/
  src/modules/
    lv-core            16 files   Lead model, taxonomy, duplicate detection, routing attributes
    lv-capture          8 files   Capture normalisers, lead draft builder, Quick Add UI
    lv-assignment      21 files   Scoring, eligibility, round robin, history, rules
    lv-interactions    10 files   Interaction log, orchestrator, timeline type
    lv-followups       12 files   Follow-up derivation, Today/Upcoming/Overdue/Completed views
    lv-onboarding      26 files   10-step partner onboarding, documents, wizard
    lv-notifications    4 files   Notification foundation
```

Not started: `lv-intelligence`, `lv-copilot`, `lv-analytics`, `lv-sla`.

---

## 3. What was built, feature by feature

### 3.1 Lead capture (`lv-capture`)

Eight capture modes through **one** validated path (`buildLeadDraft`):
manual, website URL, Instagram, image, visiting card, referral, import, API.

- Deterministic normalisers: website URL (strips `www`, tracking params),
  Instagram handle (correctly **rejects post/reel links** — they identify no
  account), email, phone (India-first `+91` default), business-name matching
  (accent- and suffix-insensitive).
- **Provenance per field** — every value records whether it was typed, derived,
  OCR-extracted, AI-suggested, imported or synced.
- Image and visiting-card captures are stored with their attachment and parked
  at `DISCOVERED` for a human. **Nothing is invented.**
- `dataCompleteness` — a plain percentage of populated qualification fields.

### 3.2 Duplicate detection (`lv-core`)

Sørensen–Dice over character bigrams blended with token containment, plus exact
keys on email / phone / Instagram / website domain.

The founder's example — *"The Forest Table"* vs *"The Forest Table Pune"* —
scores **89%**, close to the 91% in the brief, and is surfaced for a human to
decide. Twenty's existing merge UI is reused; nothing was rebuilt.

### 3.3 Assignment engine (`lv-assignment`)

Precedence, highest first — every branch deterministic and auditable:

1. **MANUAL** — a human named an owner
2. **RULE** — an admin-configured `lvAssignmentRule` matched
3. **EXISTING_RELATIONSHIP** — the prior owner is available, so continuity wins
4. **SCORED** — weighted factors (relationship 30, category 20, geography 20, expertise 15, language 15)
5. **ROUND_ROBIN** — nothing discriminated, so balance by workload

Workload is deliberately **not** an additive weight: it is a hard capacity
filter and the round-robin tie-break, so an idle member never outranks an expert
one. Every transfer writes an immutable `lvAssignmentHistory` row with strategy,
score, matched rule and a plain-language reason.

### 3.4 Interactions and follow-ups (`lv-interactions`, `lv-followups`)

Eleven channels, each carrying all twelve required attributes (date/time, actor,
channel, duration, purpose, summary, sentiment, outcome, objections,
commitments, next action, next follow-up).

**Reused rather than rebuilt** — this was the explicit constraint:

| Requirement | Twenty primitive | New code |
|---|---|---|
| Follow-ups, due dates | `task` | 2 fields (`lvPriority`, `lvSourceInteraction`) |
| Attaching follow-ups to leads | `taskTarget.custom` | none |
| Today / Upcoming / Overdue / Completed | task views + existing `IS_TODAY` / `IS_IN_PAST` / `IS_IN_FUTURE` operands | 4 declarations |
| Lead timeline | `timelineActivity` + `defineTimelineActivityType` | 1 declaration |
| Free-form notes | `note` | none |

**No follow-up object exists.** The only genuinely new object is
`lvInteraction`, because nothing in Twenty carries channel + duration +
sentiment + outcome + objections + commitments.

### 3.5 Partner onboarding (`lv-onboarding`)

Ten steps, eleven statuses, full state machine.

- **All 121 status pairs tested** — each is either in the transition table and
  accepted, or refused with `NOT_ALLOWED`. Nothing silently permitted.
- **Human approval enforced in code**, not documentation: `APPROVED`,
  `REJECTED`, `CHANGES_REQUESTED`, `ACTIVATED` refuse a null actor. Approval
  additionally requires a named reviewer and every document verified.
- Guards run in the state machine **and again server-side** in the
  `POST /onboarding/transition` logic function, because `SECURITY-RBAC.md` says
  UI filtering is never the protection.
- Progress % and health score are deliberately different numbers: progress is
  how far through the form; health is how *good* the submission is.
- Save/resume: a partner resumes at their first incomplete step.

### 3.6 Document management (`lv-onboarding`)

- **Six verification states**: Pending, Under Review, Verified, Rejected,
  Expired, Needs Replacement. All 36 state pairs tested.
- **Seven verification flags**: unreadable, missing page, expiry, name mismatch,
  inconsistent information, duplicate, wrong document type.
- Flags that need a different file (unreadable, missing page, expiry, wrong
  type) imply **replacement**; judgement flags imply **rejection**.
- Replacement is a chain (`replaces` / `replacedBy`) — the superseded document
  is **never deleted**, because it is the evidence of what was checked.
- Expiry is the one transition the system may apply without a human: a date
  passing is a fact, not a judgement.
- Metadata captured: original filename, MIME type, size, uploaded-at,
  verified-at, reviewer, rejection reason, append-only audit trail.
- Only a `VERIFIED` document lets a partner be approved — expired, rejected and
  replacement-pending all block it.

### 3.7 Storage — Cloudflare R2

**Zero code.** Twenty's `s3.driver.ts` already accepts a custom endpoint, and
region validation is `@IsString()` only, so R2's required `region: auto` passes.
Configuration and bucket guidance in [`STORAGE-R2.md`](./STORAGE-R2.md).

Binaries never enter PostgreSQL: a `FILES` field stores a storage key; bytes go
to the driver. That requirement was already satisfied by Twenty's architecture.

### 3.8 User interface

Two front components, both mobile-first per `UI-UX-SPEC.md` — Pine/Sage/Gold/
Sand/Charcoal, 44px touch targets, 16px inputs (stops iOS zoom-on-focus):

- **Quick Add Lead** — six capture modes, duplicate warning before creation
- **Onboarding wizard** — ten steps, progress bar, save/resume, per-field
  validation revealed only after a partner tries to advance

---

## 4. Test coverage

| Suite | Tests |
|---|---|
| `transition-onboarding` (121-pair matrix) | 30 |
| `normalize-input` | 28 |
| `transition-document` (36-pair matrix) | 27 |
| `wizard-state` | 26 |
| `validate-onboarding` | 26 |
| `select-assignee` | 24 |
| `duplicate-detection` | 22 |
| `derive-follow-up` | 22 |
| `quick-add-state` | 21 |
| `follow-up-views` | 21 |
| `onboarding-progress` | 20 |
| `build-lead-draft` | 18 |
| `round-robin`, `score-candidate` | 16 each |
| `onboarding-orchestrator` | 15 |
| `core-api-assignment-port`, `build-notification`, `select-options` | 14 each |
| `interaction-orchestrator` | 13 |
| `assignment-orchestrator` | 12 |
| `build-assignment-history` | 9 |
| **Total (with `it.each` expansion)** | **609 unit + 8 integration** |

The integration tests run against the **live installed app** and assert, among
other things, that **no `lvFollowUp` object exists** while `task` carries
`lvPriority` — proving the follow-up really is Twenty's task, not a duplicate.

---

## 5. Twenty core modifications

Two, both registered in `LA_VIVENZIA_CRM_DOCUMENTATION/CORE-MODIFICATIONS.md`.

**CM-001 — Product rebrand.** Browser title, PWA manifest, emails across 33
locales, Docker Compose, Helm chart, README. `LICENSE` and `TRADEMARK.md`
untouched, as AGPL requires. Package/import names deliberately unchanged
(60,000+ occurrences; identifiers, not branding).

**CM-002 — Windows path separators.** Three places built a path with
`path.join`/`path.relative` and used it as an *identifier* (a storage key, or a
manifest value validated server-side). Fixed to POSIX. **This was the root cause
of the failure that had also been breaking `workspace:seed:dev` since early in
the project.** Should be reported upstream rather than carried in the fork.

---

## 6. Bugs found

### In Twenty (upstream defects, Windows-only)

| # | Where | Status |
|---|---|---|
| 1 | `file-storage.service.ts` — `path.join` for storage keys | **Fixed** (CM-002) |
| 2 | `file-uploader.ts` — backslash wire paths | **Fixed** (CM-002) |
| 3 | `manifest-build.ts` — backslash manifest paths | **Fixed** (CM-002) |
| 4 | `assets-path.ts` — `__dirname.includes('/dist/')` never matches on Windows | **Not fixed** — worked around by mirroring assets |
| 5 | `nest start --watch` — `taskkill`s a dead PID and dies (`ERROR: The process "22840" not found`) | **Not fixed** — run without `--watch` |
| 6 | `twenty-sdk:build` — single-quoted globs passed literally to `rimraf` | **Not fixed** — build completes without the cleanup step |
| 7 | 10 server unit tests assert POSIX separators / need symlink privileges | **Not fixed** — pre-existing, pass on Linux |

### In my own work, caught before shipping

- **Instagram profile URL in `websiteUrl`** — would have given every Instagram
  lead the same `domain:instagram.com` duplicate key, colliding them all.
- **Colliding view-field IDs** — `String(10).slice(-1)` and `String(20).slice(-1)`
  both yield `'0'`, so two views would have shared IDs.
- **Only 1 of 5 views registered** — the manifest builder reads one view per
  file from the *default export*; named consts with a re-export were skipped.
- **Unassignable leads wrote no audit row** — "null → null" looked like no
  change, hiding exactly what the Admin Control Tower must surface.
- **Rebrand broke localisation** — catalogue `msgid`s were rebranded before two
  source strings were, and a Lingui `msgid` *is* the lookup key. Both fixed and
  re-verified.

---

## 7. Verified vs unverified

### Verified end to end

- App installs: **636 metadata entities, 0 errors**
- All 7 objects live and queryable on the running server
- Leads created through the real GraphQL API
- 8 integration tests green against the live instance
- Server, frontend, Postgres and Redis all running

### NOT verified — be clear about this

| Gap | Detail |
|---|---|
| **Database-event triggers do not fire** | Three leads created via the API; none auto-assigned. The logic functions are installed (3 rows in `core.logicFunction`) and the engine is proven by 609 unit tests, but Twenty's event dispatch has not been observed working on this Windows box. **Expected to work on Linux/WSL2; unproven.** |
| **Front components not rendered** | Both components typecheck and build, but neither has been opened in a browser. |
| **Email rendering** | 33 locales verified by catalogue inspection, not by rendering templates. |
| **R2 itself** | Configuration is correct by inspection; no bucket has been connected. |
| **Onboarding wizard on a real device** | Responsive by construction (single column, 44px targets); not tested at the 9 breakpoints `TESTING-QA.md` requires. |
| **Permission enforcement per role** | Server-side guards are tested; the nine La Vivenzia roles from `SECURITY-RBAC.md` have not been configured or tested. |

---

## 8. Outstanding risks

| ID | Risk | Severity |
|---|---|---|
| **BLOCKER-01** | **No Git history.** Still a source drop. No upgrade path, no patch path, and no way to prove what changed. Every roadmap doc names this as task one. | **Critical** |
| **DECISION-01** | Row-level permissions are enterprise-key gated. `SECURITY-RBAC.md` requires server-side row scoping ("view permitted leads"); UI filtering is explicitly excluded. Licence or fork-level enforcement — unresolved. | **Critical** |
| **DECISION-02** | Platform audit log (ClickHouse) is enterprise-gated. `timelineActivity` covers record changes only, not logins, permission changes or exports. | High |
| **RISK-11** | AGPL §13: if the CRM is network-accessible outside La Vivenzia, source-provision duties apply. Legal advice needed before launch. | High |
| **LV-24** | No backups, no restore test, no DR runbook. | High |
| **BLOCKER-03** | `public/ui-reference/` still does not exist, though `CLAUDE.md` and `UI-UX-SPEC.md` both require inspecting it before UI work. | Medium |
| — | Windows is not a viable verification environment. Linux/WSL2 should be the reference, matching CI. | Medium |

---

## 9. Honest assessment

**What is genuinely solid:** the decision logic. Assignment, follow-up
derivation, onboarding and document state machines are pure, deterministic and
covered by 609 tests including two exhaustive state-pair matrices. Human
approval is enforced in code and re-enforced server-side. Nothing fabricates
partner information, and `opportunityScore` is deliberately left empty rather
than guessed.

**What is thinner than the test count suggests:** the wiring. The ports that
talk to Twenty's API are typed and unit-tested against fakes, but only lightly
exercised against the real server — and the database-event path is not working
at all here. The UI compiles and is structurally sound but has not been looked
at in a browser.

**The single most important next step** is not a feature. It is **BLOCKER-01**:
put this in Git. There are now two core modifications, ~109 new files and a
rebrand touching 70+ files, all sitting in a directory with no version control
and no upstream remote. That is the largest risk in the project by some margin.

**After that**, move verification to Linux or WSL2 and re-run everything. Four
of the seven Twenty bugs above are Windows-only, the event triggers are
unproven, and the 10 failing server tests pass on Linux. A day on the right
platform would convert a lot of "unverified" into "verified".
