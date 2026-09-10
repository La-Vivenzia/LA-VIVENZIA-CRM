# La Vivenzia CRM — Implementation Status

**Purpose:** the single operational tracker for preparing and building the La Vivenzia CRM on Twenty.
**Baseline:** Twenty **2.39.0** (verified in source).
**Date:** 2026-09-09
**Scope of this pass:** verification and architecture establishment only. **No product features were implemented.** No Twenty core file was modified. Nothing was committed.

**Source-of-truth order** (per `LA_VIVENZIA_CRM_DOCUMENTATION/README.md`):
`PRODUCT-REQUIREMENTS.md` → `UI-UX-SPEC.md` → `TWENTY-GAP-ANALYSIS.md` → `ARCHITECTURE.md` + `DATA-MODEL.md` → `SECURITY-RBAC.md` → `ROADMAP.md`

**Companion documents**
- `LA_VIVENZIA_CRM_DOCUMENTATION/` — 23 founder/product documents (all read for this pass).
- `docs/LA-VIVENZIA-TWENTY-GAP-ANALYSIS.md` — full 73-requirement source-level audit.
- `LA_VIVENZIA_CRM_DOCUMENTATION/CORE-MODIFICATIONS.md` — **canonical** core-change register. Current state: *no core modification approved*. Do not create a second register.

---

## PART A — VERIFICATION RESULTS (steps 1–14)

Every verdict below was re-verified against source in this pass.

### A1. Twenty version — VERIFIED

| Item | Value | Evidence |
|---|---|---|
| Product version | **2.39.0** | `packages/twenty-server/src/engine/core-modules/upgrade/constants/twenty-current-version.constant.ts` |
| Workspace version | `0.2.1` | `package.json` |
| Node required | `^24.5.0` / `.nvmrc` 24.16.0 | `package.json` engines |
| Yarn | 4.13.0 | `.yarn/releases/yarn-4.13.0.cjs` |
| Git | **ABSENT** | `git rev-parse HEAD` → *not a git repository* |

> **BLOCKER-01 — no Git.** Confirmed again today. There is no `.git`, no remote, no commit SHA. Every roadmap document (`ROADMAP.md` Phase 0, `ENVIRONMENT.md`, `TWENTY-GAP-ANALYSIS.md`) already names "clean fork with Git history" as the first task. **Nothing else in Phase 0 should start until this is done** — without it there is no upgrade path, no patch path, and no way to prove which files La Vivenzia has changed.

### A2. Repository structure — VERIFIED

Nx + Yarn 4 monorepo, 20 packages. Server splits cleanly:
- `twenty-server/src/engine/` — platform (API, metadata, ORM, auth, permissions, AI, apps).
- `twenty-server/src/modules/` — the CRM product built on that platform.

This split is what makes the LV strategy work: LV extends the platform, and sits *beside* `src/modules/`, not inside it.

### A3. Twenty primitives that already satisfy LV requirements — VERIFIED

Confirmed present and working-as-shipped. Per `LA_VIVENZIA_CRM_DOCUMENTATION/CLAUDE.md` rule 3, **none of these may be reimplemented without written evidence of a gap.**

| LV requirement (doc reference) | Twenty primitive | Location |
|---|---|---|
| Login, MFA (`SECURITY-RBAC.md`) | Email/password, Google, Microsoft, JWT, **TOTP MFA (free, ungated)** | `core-modules/auth/`, `core-modules/two-factor-authentication/strategies/otp/totp/` |
| RBAC (`SECURITY-RBAC.md`) | Roles, object permissions, **field permissions**, 28 permission flags | `metadata-modules/role/`, `object-permission/`, `field-permission/`, `PermissionFlagType.ts` |
| Dynamic categories, custom fields (`PRODUCT-REQUIREMENTS.md`) | Runtime metadata, 25 field types, real DDL migrations | `metadata-modules/{object-metadata,field-metadata}/` |
| Record UI, lead list/profile (`UI-UX-SPEC.md`) | Metadata-driven table/kanban/calendar/list + record pages | `twenty-front/src/modules/object-record/`, `views/`, `page-layout/` |
| Timeline (`PRODUCT-REQUIREMENTS.md`) | `timelineActivity` — auto-populated, **works on custom objects** (`targetCustom`) | `modules/timeline/`, `timeline-activity.workspace-entity.ts` |
| Tasks/notes (`PRODUCT-REQUIREMENTS.md`) | `task`+`taskTarget`, `note`+`noteTarget` (polymorphic targets) | `modules/task/`, `modules/note/` |
| Email/calendar (`COMMUNICATIONS.md`) | Two-way sync: Gmail, Microsoft, IMAP, SMTP, inbound-email, CalDAV | `modules/messaging/message-import-manager/drivers/`, `modules/calendar/` |
| Workflows Trigger→Condition→Action (`WORKFLOWS.md`) | Visual builder; 4 trigger types, 13 action types, versioned, run history | `modules/workflow/` |
| AI runtime (`AI-INTELLIGENCE.md`) | Agents, **skills**, structured output, RBAC-scoped agent roles, 5 providers, streaming chat | `metadata-modules/ai/`, `metadata-modules/skill/`, `core-modules/tool/` |
| Duplicate merge (`PRODUCT-REQUIREMENTS.md`) | `findDuplicates` + `mergeMany` + full merge UI | `common-find-duplicates-query-runner.service.ts`, `twenty-front/src/modules/object-record/record-merge/` |
| Restricted deletion (`SECURITY-RBAC.md`) | Soft delete, restore, role-gated destroy, trash sweeper | `role.canDestroyAllObjectRecords`, `engine/trash-cleanup/` |
| Import/export (`PRODUCT-REQUIREMENTS.md`) | CSV/XLSX wizard + export, permission-flagged | `twenty-front/src/modules/spreadsheet-import/`, `record-index/export/` |
| APIs (`INTEGRATIONS.md`) | GraphQL (core + metadata), REST + OpenAPI, **MCP**, webhooks | `engine/api/{graphql,rest,mcp}/`, `metadata-modules/webhook/` |
| Deployment (`LICENSING-DEPLOYMENT.md`) | Compose (server/worker/db/redis), Helm, k8s, health probes, OTel | `packages/twenty-docker/` |

### A4. Where LV functionality should live — DECIDED

**Decision: one application package, `lavivenzia-crm`, containing nine internal modules.**

The SDK declaration surface was verified at `packages/twenty-sdk/src/sdk/define/` and supports:

`agents · application · command-menu-items · conditional-availability · connection-providers · fields · front-component · indexes · logic-functions · navigation-menu-items · objects · page-layouts · permission-flags · roles · skills · timeline-activity-types · view-fields · views`

Two findings that materially improve the plan versus the original audit:
- **`permission-flags`** are app-declarable → LV can define its own permission flags without touching core.
- **`timeline-activity-types`** are app-declarable → LV lifecycle events can appear as first-class typed timeline entries, not generic diffs. This directly serves `PRODUCT-REQUIREMENTS.md`'s timeline requirement.

**Structural reference to follow:** `packages/twenty-apps/internal/twenty-partners/` — an internal Twenty app organised as `src/modules/<domain>/{objects,fields,services,front-components,page-layouts,navigation-menu-items,command-menu-items,graphql,types,__tests__}`. This is the closest existing analogue to LV and validates the nine-module design as **sub-modules of one app**, which satisfies `ARCHITECTURE.md`'s "do not create a second CRM architecture" rule.

Also available: `packages/create-twenty-app/` for scaffolding, and `packages/twenty-apps/examples/` (4 examples) + `public/` (9 shipped apps) as references.

### A5. Database schema / migrations — VERIFIED

- **PostgreSQL**, `core` schema for platform tables + **one schema per workspace** for records.
- Custom objects/fields emit **real DDL migrations**, not EAV rows (`engine/workspace-manager/workspace-migration/`).
- 211 TypeScript files under `src/database/typeorm/`; historical migrations live in `core/legacy-typeorm-migrations-do-not-add/` (explicitly closed to new entries) and current work goes through generated instance commands.
- Migration generation: `npx nx run twenty-server:database:migrate:generate --name <n> --type <fast|slow>`.
- Upgrade commands are versioned per release under `database/commands/upgrade-version-command/<version>/`.

> **Rule for LV:** LV objects are created through the **app manifest**, which drives the workspace-migration engine. LV must **not** hand-write TypeORM migrations against workspace schemas — that bypasses the metadata engine and breaks upgrades.
>
> `ARCHITECTURE.md`'s data-boundary rule (CRM DB separate from the consumer/product DB) is satisfied by default: Twenty owns its own PostgreSQL instance. Integration is via API/webhook only. **Do not add the consumer product's tables to this database.**

### A6. Authentication and RBAC — VERIFIED, with one licensing blocker

Auth: verified as listed in A3. MFA/TOTP is free and ungated — `SECURITY-RBAC.md`'s "privileged roles should use MFA" is satisfiable at no cost.

RBAC layers and their gating:

| Layer | Gated? |
|---|---|
| Roles, object permissions, field permissions, 28 permission flags | **Free** |
| **Row-level permission predicates** | **Enterprise-key gated at runtime** |
| SAML / OIDC SSO | Enterprise-key gated at runtime |
| ClickHouse platform audit log | Enterprise-key gated at runtime |

Verified gate (`row-level-permission-predicate.service.ts:573`):
```ts
const hasValidEnterprisePlan = this.enterprisePlanService.isValid();
const isRowLevelPermissionEnabled = await this.billingService.hasEntitlement(workspaceId, BillingEntitlementKey.RLS);
return hasValidEnterprisePlan && isRowLevelPermissionEnabled;
```
`hasEntitlement` returns `true` when billing is disabled, so on a self-host the gate reduces to **a signed enterprise key**.

> **BLOCKER-02 — row-level scoping.** `SECURITY-RBAC.md` states *"Experience Hunter: view permitted leads"* and *"UI filtering is never security"*, and `TESTING-QA.md` requires *"Direct API attempts also fail."* Those two statements together mean row-level enforcement is **mandatory and must be server-side**. Twenty's implementation is behind the enterprise key. This is a commercial decision that gates the Phase-1 RBAC design and it must be answered before `lv-core` roles are built. Options are recorded in Part D.

### A7. Workflows — VERIFIED

`modules/workflow/`, visual builder in `twenty-front/src/modules/workflow/`.
- Triggers: `DATABASE_EVENT`, `MANUAL` (global/single/bulk), `CRON` (minute/hour/day/custom pattern), `WEBHOOK` (GET/POST, optional API-key auth).
- Actions: `record-crud`, `code`, `http-request`, `mail-sender`, `create-calendar-event`, `if-else`, `filter`, `iterator`, `delay`, `form`, `logic-function`, `ai-agent`, `tool-backed`.
- Versioned (`workflowVersion`) with run history (`workflowRun`).

Covers `WORKFLOWS.md`'s Trigger→Condition→Action model and all six stated examples. **Does not** provide `WORKFLOWS.md`'s required *idempotency*, *retry policy* and *rollback/disable* guarantees as first-class concepts — those must be designed into LV logic functions.

### A8. Timeline / activity infrastructure — VERIFIED

`timelineActivity` is auto-populated by pre-query hooks (`timeline/query-hooks/`) and internal events. It stores `happensAt`, `properties` (JSON diff), `workspaceMember`, `linkedRecordId`/`linkedObjectMetadataId`, and a type snapshot. It declares `targetCustom`, so **LV custom objects get the timeline free**. Per-object toggle: `objectMetadata.isAuditLogged`.

Combined with app-declarable `timeline-activity-types` (A4), this covers `PRODUCT-REQUIREMENTS.md`'s timeline requirement without custom development.

> **Caveat:** `engine/trash-cleanup/` hard-deletes soft-deleted records on a schedule. Retention must be configured against the "nothing important disappears" requirement.

### A9. Tasks / notes — VERIFIED

`task` + `taskTarget`, `note` + `noteTarget`. Polymorphic targets attach to custom objects. Today/Upcoming/Overdue/Completed are saved view filters — configuration, not code. `PRODUCT-REQUIREMENTS.md`'s follow-up model (next action, due date, priority) maps to task fields plus a `priority` SELECT.

### A10. Email / calendar — VERIFIED

Drivers verified at `modules/messaging/message-import-manager/drivers/`: **gmail, microsoft, imap, smtp, inbound-email**. Calendar import/creation/participants under `modules/calendar/`; CalDAV via `core-modules/imap-smtp-caldav-connection/`. Threads link to records through `messageParticipant` + `modules/match-participant/`.

`COMMUNICATIONS.md`'s Sent → Received → Replied → Follow-up tracking is available. **One gap:** participant matching resolves to `person`/`company`; attaching a thread to an LV `Lead` object needs an extension (assessed in Part C as `LV-05`).

### A11. AI runtime — VERIFIED

- Agents (`core.agent`: prompt, model config, **structured output**), agent roles (RBAC-scoped data access), **skills** (`core.skill` — reusable instruction blocks, admin-authorable), streaming chat with checkpointing.
- Providers: `openai`, `anthropic`, `google`, `mistral`, `xai`.
- Tools: `send-email-tool`, `draft-email-tool`, `create-calendar-event-tool`, `http-tool`, `code-interpreter-tool`, `navigate-tool`, plus full record CRUD via `core-modules/record-crud/`.
- Per-tool permission flags (`SEND_EMAIL_TOOL`, `HTTP_REQUEST_TOOL`, `CODE_INTERPRETER_TOOL`, `CREATE_CALENDAR_EVENT_TOOL`).

Those per-tool flags plus agent roles are exactly the scaffolding `AI-INTELLIGENCE.md`'s guardrails section needs — the *enforcement primitives already exist*; the approval **workflow** does not.

> **Constraint:** custom AI providers require an enterprise key **above 25 seats** (`MAX_SEATS_WITHOUT_ENTERPRISE_KEY = 25`). Free below that.

### A12. Frontend architecture — VERIFIED

React 19, Vite, Module Federation, Jotai, Apollo, **Linaria** (zero-runtime CSS), Lingui i18n (~90 locales). Metadata-driven: `object-record` + `views` + `page-layout` render objects generically. Responsive via `MOBILE_VIEWPORT = 768` honoured in 113 files. App front-components render sandboxed through `packages/twenty-front-component-renderer` (`@remote-dom/react`).

> **BLOCKER-03 — UI reference assets missing.** `LA_VIVENZIA_CRM_DOCUMENTATION/CLAUDE.md` and `UI-UX-SPEC.md` both instruct: *"Inspect every actual image in `public/ui-reference/`"*. **That directory does not exist anywhere in this repository** (`find -type d -name ui-reference` → no results). No UI implementation should begin until these assets are supplied, or the instruction is withdrawn.

> **Design-system note.** `UI-UX-SPEC.md` mandates Pine Green `#1F4D3A` / Sage `#6B846F` / Gold `#D4AF37` / Sand `#F3EFE7` / Charcoal `#1A1A1A` with semantic tokens and a serif display face. Twenty's tokens live in `packages/twenty-ui/src/theme-constants/`. **Retheming `twenty-ui` is a core modification** and requires a `CORE-MODIFICATIONS.md` entry. The alternative — scoping LV brand tokens to LV front-components only — avoids that but produces a visually mixed product. **This is an unresolved design decision (see Part D, DECISION-04).**

### A13. Deployment / Docker — VERIFIED

`packages/twenty-docker/`: `docker-compose.yml` with **server, worker, db, redis** services and `db-data` / `server-local-data` volumes; a Helm chart with `image / storage / secrets / server / worker / db / redis` value groups, `values.schema.json`, templates and tests; k8s manifests; Podman; custom Spilo Postgres image; Grafana + OTel collector. Health probes at `core-modules/health/`.

Satisfies `LICENSING-DEPLOYMENT.md`'s self-hosting preference. **Not provided by Twenty and required by that document:** backup jobs, restore testing, secret management, DR runbooks. Those are La Vivenzia infrastructure work.

### A14. Test infrastructure — VERIFIED (execution blocked, see Part E)

| Layer | Count | Tooling |
|---|---|---|
| Server unit | 1,088 | Jest |
| Server integration | 618 | Jest + real DB |
| Front unit | 1,148 | Jest + Testing Library + MSW |
| Storybook stories | 275 | Storybook 10 |
| E2E | 9 | Playwright |

Nx targets confirmed present on `twenty-server`, `twenty-front` and `twenty-shared`: **`test`, `typecheck`, `lint`, `lint:diff-with-main`, `fmt`** (plus `test:integration`, `storybook:test` on the relevant packages).

---

## PART B — LV MODULE ARCHITECTURE (established)

### B1. Placement decision

```
packages/
  twenty-server/          ← UNMODIFIED (core)
  twenty-front/           ← UNMODIFIED (core)
  twenty-ui/              ← UNMODIFIED unless DECISION-04 says otherwise
  twenty-apps/
    internal/
      lavivenzia-crm/     ← ALL La Vivenzia work lives here
        src/
          modules/
            lv-core/
            lv-notifications/
            lv-onboarding/
            lv-assignment/
            lv-sla/
            lv-intelligence/
            lv-capture/
            lv-copilot/
            lv-analytics/
          application-config.ts
```

**One package, nine modules** — not nine packages. Nine separate app packages would fragment the manifest, duplicate shared object definitions, and create the "second CRM architecture" `ARCHITECTURE.md` forbids.

### B2. Module boundaries

| Module | Owns | Declares (SDK) | Must NOT contain |
|---|---|---|---|
| **lv-core** | Lead, Person-role, Organisation, Experience, Property, Activity/Interaction, Problem, Document, Category objects; LV roles; permission flags; lifecycle statuses; LV Lead ID; page layouts; navigation | `objects`, `fields`, `indexes`, `roles`, `permission-flags`, `page-layouts`, `views`, `view-fields`, `navigation-menu-items`, `timeline-activity-types` | Any re-implementation of person/company/task/note — extend Twenty's |
| **lv-notifications** | Notification object, preferences, fan-out service, in-app centre, channel adapters, idempotency keys | `objects`, `fields`, `logic-functions`, `front-component` | Its own scheduler — use `CRON` workflows / BullMQ via logic functions |
| **lv-onboarding** | Partner onboarding model, 10-step resumable flow, save/resume, missing-info checklist, document gates, health score, reviewer/approval states | `objects`, `fields`, `logic-functions`, `front-component`, `page-layouts` | Confusion with `core-modules/onboarding/`, which onboards *workspace users* |
| **lv-assignment** | 7-factor assignment engine, workload counters, round-robin/least-loaded, reassignment audit | `objects`, `logic-functions` | Direct DB writes bypassing `record-crud` permissions |
| **lv-sla** | SLA definitions, clocks, states (On Track→Escalated), breach detection, escalation ladder | `objects`, `fields`, `logic-functions` | Its own notification delivery — call `lv-notifications` |
| **lv-intelligence** | Opportunity score + explanation, next-best-action, data-quality suggestions, problem classification, root cause, AI Insight records | `agents`, `skills`, `logic-functions`, `front-component` | Fabricated facts; autonomous approval/deletion/ownership change (`AI-INTELLIGENCE.md` guardrails) |
| **lv-capture** | OCR intake, visiting-card/Instagram/website parsers, provenance tagging, mobile capture surface, offline queue | `logic-functions`, `front-component`, `command-menu-items` | Lead creation that skips duplicate check or human confirmation |
| **lv-copilot** | LV agents, skills library, NL-search tool, Morning Workspace, daily brief, management command centre | `agents`, `skills`, `logic-functions`, `front-component` | Tools that bypass agent-role RBAC |
| **lv-analytics** | Funnel with drill-down, team performance, management intelligence, forecasting components | `front-component`, `page-layouts`, `logic-functions` | A parallel reporting database in Phase 1 |

### B3. Cross-module rules

1. **Dependency direction is one-way:** every module may depend on `lv-core`; `lv-core` depends on nothing but Twenty.
2. **`lv-sla` and `lv-assignment` never deliver notifications directly** — both emit through `lv-notifications`, so idempotency and preferences live in one place (`ASSIGNMENT-SLA-NOTIFICATIONS.md`: *"Notifications must be idempotent"*).
3. **All writes go through `record-crud`** so object/field permissions are enforced. No raw SQL against workspace schemas.
4. **Provenance is mandatory** (`CAPTURE-OCR.md`): every field written by OCR/AI/import carries its source. Design this into `lv-core` field definitions from day one — retrofitting is expensive.
5. **Human-approval boundaries are enforced by permission flags**, not by prompt instructions (`AI-INTELLIGENCE.md` guardrails).

---

## PART C — IMPLEMENTATION STATUS MATRIX

Status values: `Verified – config path` · `Verified – gap` · `Blocked` · `Decision required` · `Not started`
No row is `In progress` or `Done`: **no implementation was performed in this pass.**

| # | Existing capability | Required LV capability | Twenty native solution | LV custom solution | Files / modules involved | Dependencies | Risk | Test plan | Status |
|---|---|---|---|---|---|---|---|---|---|
| **LV-01** | Email/password + OAuth + JWT + **free TOTP MFA** | Login + MFA for privileged roles (`SECURITY-RBAC.md`) | **Entirely native** — enable in Security settings | None | `core-modules/auth/`, `two-factor-authentication/` | None | Low | Integration: MFA-required role cannot authenticate without TOTP | Verified – config path |
| **LV-02** | Roles, object + field permissions, 28 permission flags | 9 LV roles with per-object/field rules | Native roles + permissions; LV roles declared in app manifest | Role definitions in `lv-core` | `metadata-modules/role/`, `object-permission/`, SDK `define/roles` | LV-04 | Low | Permission matrix test per role: allowed succeeds, denied fails **at API level** | Verified – config path |
| **LV-03** | **Row-level permission predicates (enterprise-gated)** | "View permitted leads" enforced server-side (`SECURITY-RBAC.md`) | Native but **licence-gated** | Fallback: LV predicate applied in a query-runner hook (**core modification**) | `row-level-permission-predicate/`, `engine/api/common/common-query-runners/` | **BLOCKER-02** | **Critical** | Direct GraphQL/REST call as Hunter for an unassigned lead must return zero rows | **Blocked — DECISION-01** |
| **LV-04** | Runtime metadata, 25 field types, real DDL migrations | Lead, Person, Organisation, Experience, Property, Activity, Problem, Document, Onboarding, Category objects (`DATA-MODEL.md`) | **Entirely native** — objects/fields via app manifest | `lv-core` object + field definitions | SDK `define/{objects,fields,indexes}`, `metadata-modules/` | BLOCKER-01 | Low | Integration: install app on clean workspace, assert schema + CRUD + permissions | Verified – config path |
| **LV-05** | `messageParticipant` + `match-participant` (resolves to person/company) | Email thread attached to LV **Lead** (`COMMUNICATIONS.md`) | Partial — sync and threading are native | Matcher extension mapping participants to Lead | `modules/match-participant/`, `modules/messaging/` | LV-04 | Medium — may require core touch; assess extension path first | Integration: inbound mail to a known lead handle appears on that lead's timeline | Verified – gap |
| **LV-06** | `timelineActivity` incl. `targetCustom`; app-declarable `timeline-activity-types` | Permanent lifecycle timeline (`PRODUCT-REQUIREMENTS.md`) | **Entirely native** | LV timeline activity types in `lv-core` | `modules/timeline/`, SDK `define/timeline-activity-types` | LV-04 | Low — but verify `trash-cleanup` retention | Integration: each lifecycle transition emits a typed entry; entry survives archive | Verified – config path |
| **LV-07** | `task`/`taskTarget`, `note`/`noteTarget`, saved views | Tasks, follow-ups, priority, Today/Overdue views | **Entirely native** + `priority` SELECT field | View definitions in `lv-core` | `modules/task/`, SDK `define/views` | LV-04 | Low | Unit: due-date/priority rules. Integration: overdue view membership | Verified – config path |
| **LV-08** | Workflow engine (4 triggers, 13 actions, versioned) | Trigger→Condition→Action incl. all 6 `WORKFLOWS.md` examples | **Entirely native** for the model | Idempotency, retry and disable semantics in LV logic functions | `modules/workflow/`, SDK `define/logic-functions` | LV-04 | Medium — engine gives no native idempotency guarantee | Unit: replayed trigger produces one effect. Integration: failure path is visible and disableable | Verified – config path |
| **LV-09** | **Nothing** — no notification entity/service/centre anywhere | Notification object, preferences, in-app centre, email, optional WhatsApp/push, idempotent (`ASSIGNMENT-SLA-NOTIFICATIONS.md`) | None. Only `snack-bar-manager` toasts + 12 transactional email templates | **Full build** in `lv-notifications` | `lv-notifications`; delivery via `mail-sender`, `http-request`, `sse-db-event` | LV-04 | **High** — LV-10, LV-11, LV-07 and daily brief are all inert without it | Unit: dedupe/idempotency key. Integration: 11 notification types fan out once per recipient per event. E2E: assignment → recipient sees it in-app | Verified – gap |
| **LV-10** | Ownership field + workflows; **no assignment engine** | 7-factor assignment + round-robin/least-loaded (`ASSIGNMENT-SLA-NOTIFICATIONS.md`) | Manual assignment only | **Full build** in `lv-assignment` | `lv-assignment`, `logic-function/`, `record-crud/` | LV-04, LV-09 | **High** — concurrency-safe round robin is the hard part | Unit: each of 7 factors; round-robin distribution under parallel creation. Integration: created lead gets exactly one owner | Verified – gap |
| **LV-11** | `CRON` trigger + `delay` action (approximation only) | SLA clocks, 6 states, breach escalation (`ASSIGNMENT-SLA-NOTIFICATIONS.md`) | Partial — scheduling exists, SLA semantics do not | **Full build** in `lv-sla` | `lv-sla`, CRON workflows | LV-04, LV-09 | **High** — commonly underestimated; business hours + pausable clocks | Unit: state transitions across the 4 initial SLAs. Integration: breach notifies owner + manager, creates escalation task, writes audit | Verified – gap |
| **LV-12** | `core-modules/onboarding/` onboards **workspace users**, not partners | 10-step partner onboarding, save/resume, health score, verification (`ONBOARDING.md`) | Only `workflow-actions/form` and `file/` as substrate | **Full build** in `lv-onboarding` | `lv-onboarding`, `core-modules/file/` | LV-04, LV-09 | **High** — largest single Phase-1 build | Unit: health-score computation across 7 inputs. Integration: resume from each of 10 steps. E2E: invite → complete → verify → approve → activate | Verified – gap |
| **LV-13** | Exact-match `duplicateCriteria`; **full merge UI already exists** | Similarity score shown before creation, e.g. 91% (`PRODUCT-REQUIREMENTS.md`) | Merge + `findDuplicates` native; **similarity is not** | Similarity scorer (`pg_trgm` or embedding) in `lv-intelligence` | `common-find-duplicates-query-runner.service.ts`, `record-merge/` (**do not rebuild**) | LV-04 | Medium | Unit: "The Forest Table" vs "The Forest Table Pune" scores high; unrelated names score low. Integration: Merge/Create New/Ignore all audited | Verified – gap |
| **LV-14** | Agents, skills, structured output, agent roles, 5 providers | Classification, scoring, summaries, conversation + communication assistant (`AI-INTELLIGENCE.md`) | **Largely native** — agent + skill configuration | Score **explainability** storage + UI; LV skills library | `metadata-modules/ai/`, `skill/`, SDK `define/{agents,skills}` | LV-04 | Medium — AI cost at volume; hallucination | AI QA per `TESTING-QA.md`: hallucination resistance, missing data, low confidence, prompt injection from external content | Verified – config path |
| **LV-15** | Per-tool permission flags + agent roles | Human-approval boundary for approval/deletion/ownership/commercial terms (`AI-INTELLIGENCE.md`) | Enforcement **primitives** native | Approval workflow + UI in `lv-intelligence` | `PermissionFlagType.ts`, `ai-agent-role/` | LV-02, LV-14 | Medium | Integration: agent attempting a guarded action is refused **server-side**, not by prompt | Verified – gap |
| **LV-16** | **No OCR anywhere** (`grep -w OCR` → 0 hits) | Visiting card → OCR → review → confirm → lead, < 30s (`CAPTURE-OCR.md`) | None; `file/` stores only | **Full build** in `lv-capture` | `lv-capture`, multimodal providers already wired | LV-04, LV-13 | Medium — no new vendor needed | Unit: extraction of 7 card fields; provenance tagging. E2E: photo → confirm → lead created with correct provenance | Verified – gap |
| **LV-17** | Responsive (`MOBILE_VIEWPORT`, 113 files), PWA manifest; **no service worker/camera/offline** | 30-second mobile capture, offline queue (`CAPTURE-OCR.md`) | Responsive shell only | Capture surface in `lv-capture`; possibly a separate PWA client | `twenty-front/public/manifest.json`, `lv-capture` | LV-16 | **High** — may justify a separate client | Responsive QA at 9 breakpoints (`TESTING-QA.md`); offline queue replay test | Verified – gap |
| **LV-18** | Postgres `tsvector` keyword search | Natural-language search, 6 stated examples (`PRODUCT-REQUIREMENTS.md`) | Keyword only. No vector store, no query planner | LLM→structured-filter tool over `find-records` in `lv-copilot` | `core-modules/search/`, `record-crud/find-records.service.ts` | LV-04, LV-14 | Medium | Unit: each of the 6 example queries produces the correct filter. Permission test: NL search cannot return records the role cannot read | Verified – gap |
| **LV-19** | AI chat runtime (streaming, tools, RBAC-scoped) | CRM Copilot + Management Command Centre (`AI-INTELLIGENCE.md`, `ANALYTICS.md`) | **Substrate largely native** — closer than expected | LV agents, skills, custom tools, Morning Workspace/daily brief surfaces | `metadata-modules/ai/ai-chat/`, `tool-provider/` | LV-14, LV-18, LV-09 | Medium | Integration: copilot answers respect the caller's role. AI QA as `TESTING-QA.md` | Verified – config path |
| **LV-20** | 24 widget types; **only 4 chart types**; no drill-down | Funnel with drill-down, team + management analytics (`ANALYTICS.md`) | Partial — counts/breakdowns yes, funnel no | Funnel + drill-down front components in `lv-analytics` | `dashboard/chart-data/`, `groupBy`, `FRONT_COMPONENT` widget | LV-04 | Medium | Unit: funnel stage counts match `groupBy`. Integration: drill-down respects permissions | Verified – gap |
| **LV-21** | `timelineActivity` free; **ClickHouse audit log enterprise-gated** | Audit ownership/status/permission changes, merges, deletions, exports, approvals (`SECURITY-RBAC.md`) | Record-change audit native; auth/permission/export audit **not** | LV audit store in `lv-core` for non-record events | `modules/timeline/`, `core-modules/event-logs/` (gated) | BLOCKER-02 licence decision | **High** | Integration: each of the 9 auditable action classes writes an immutable entry with actor, before/after, reason | Verified – gap |
| **LV-22** | Soft delete, restore, role-gated destroy, trash sweeper | Archive/close/mark-duplicate for users; Main-Admin-only permanent delete with who/what/when/**reason**/previous ID (`SECURITY-RBAC.md`) | **Mostly native** | Deletion reason + previous-ID capture; LV action set | `role.canDestroyAllObjectRecords`, `trash-cleanup/` | LV-02, LV-21 | Medium | Permission test: non-admin destroy fails at API. Integration: deletion records reason and prior identifier | Verified – config path |
| **LV-23** | Metadata + SELECT fields, admin-editable | Admin creates category + fields + workflow + responsible role, no developer (`PRODUCT-REQUIREMENTS.md`) | **Largely native** | Cascading category→subcategory (no dependent SELECT exists) | `metadata-modules/field-metadata/`, `lv-core` front component | LV-04 | Medium | Integration: admin creates a category end-to-end without a deploy | Verified – config path |
| **LV-24** | Compose, Helm, k8s, health, OTel | Backups, restore tests, secrets, DR runbooks (`LICENSING-DEPLOYMENT.md`, `ENVIRONMENT.md`) | Deployment yes; **backup/DR no** | LV infrastructure work (outside the app package) | `packages/twenty-docker/` | BLOCKER-01 | **High** | Restore test from backup into a clean environment | Not started |
| **LV-25** | Twenty UI tokens in `twenty-ui/src/theme-constants/` | Pine/Sage/Gold/Sand/Charcoal, serif display, semantic tokens (`UI-UX-SPEC.md`) | Theming exists but is Twenty-branded | Either LV-scoped tokens in front-components, or retheme `twenty-ui` (**core modification**) | `twenty-ui/src/theme-constants/`, `lv-core` front-components | **BLOCKER-03**, DECISION-04 | Medium | Responsive QA at 9 breakpoints; contrast/accessibility per `TESTING-QA.md` | **Blocked — DECISION-04** |

---

## PART D — OPEN DECISIONS AND BLOCKERS

These gate Phase 0/1. None can be resolved by engineering alone.

| ID | Question | Why it blocks | Options |
|---|---|---|---|
| **BLOCKER-01** | Repository has no Git history | No upgrade path, no patch path, no way to prove what LV changed | Re-fork `twentyhq/twenty` at `v2.39.0`, verify this tree matches, set upstream remote. **Do this first.** |
| **DECISION-01** | Enterprise licence for **row-level permissions**? | `SECURITY-RBAC.md` requires server-side row scoping; Twenty's is gated (LV-03) | (a) Buy enterprise licence — cleanest; (b) implement LV row scoping in a query-runner hook → **core modification**, needs `CORE-MODIFICATIONS.md` entry; (c) ~~UI filtering~~ — **excluded**, the docs forbid it |
| **DECISION-02** | Enterprise licence for **platform audit log**? | `SECURITY-RBAC.md` lists 9 auditable action classes; `timelineActivity` covers only record changes (LV-21) | (a) Enterprise licence + ClickHouse; (b) LV audit store in `lv-core` |
| **DECISION-03** | Seat count above or below 25? | Custom AI providers are gated above 25 seats | Confirm headcount plan before Phase 2 AI design |
| **DECISION-04** | Retheme `twenty-ui`, or scope LV brand to LV components only? | `UI-UX-SPEC.md` mandates LV brand tokens; retheming core is a documented core modification (LV-25) | (a) Retheme `twenty-ui` — coherent product, upgrade cost, needs `CORE-MODIFICATIONS.md`; (b) LV-scoped tokens — no core change, visually mixed product |
| **BLOCKER-03** | `public/ui-reference/` does not exist | `CLAUDE.md` and `UI-UX-SPEC.md` both require inspecting it before UI work | Supply the assets, or withdraw the instruction |
| **DECISION-05** | AGPL-3.0 obligations for the chosen deployment | `LICENSING-DEPLOYMENT.md` requires this review before public launch | Legal review. Not an engineering decision. |
| **BLOCKER-04** | **Port 5432 is occupied by another project's database.** A container `lavivenzia-postgres` (image `lavivenzia/postgres-dev:16`, created 2026-08-19, restart `unless-stopped`) binds `127.0.0.1:5432` — the exact default port `setup-dev-env.sh` and `.env.example` expect | The CRM dev database cannot start, and worse: if `.env` is generated with the default `5432`, the CRM server and its **migrations would target the other project's database**. Directly violates `ARCHITECTURE.md`'s "keep CRM and consumer/product databases separate" rule | Assign the CRM dev stack non-default ports (e.g. Postgres 5433, Redis 6380) in `packages/twenty-server/.env` and `docker-compose.dev.yml` overrides, **before** anyone runs `setup-dev-env.sh` to completion |
| **NOTE-01** | Documentation now lives in two places | `LA_VIVENZIA_CRM_DOCUMENTATION/` (23 founder docs) and `docs/` (2 engineering docs) | Recommend consolidating under `docs/`. **Not done unilaterally** — the founder set owns the source-of-truth order |

---

## PART E — BUILD, TEST, TYPECHECK AND LINT RESULTS

Run on 2026-09-09 against the unmodified baseline. **Nothing was changed to make anything pass.** All failures are reported.

### E0. Environment used

| Item | Value | Matches requirement? |
|---|---|---|
| OS | Windows 11 | CI uses Linux |
| Node | **v22.16.0** | ❌ repo requires `^24.5.0` (`.nvmrc` 24.16.0) |
| Yarn | 4.13.0 | ✅ |
| Repo path | `D:\LA  VIVENZIA\LAVIVENZIACRM` — **contains a double space** | ❌ see FAIL-A |
| Install | `yarn install --immutable`, cache redirected to `D:\.yarn-cache-lv` | 4,412 packages, 2.85 GiB |

Two environment problems were hit and worked around before anything could run:
1. **C: drive full** (1.8 GB free of 275 GB). Yarn's default cache is `C:\Users\kpvlo\AppData\Local\Yarn\Berry\cache`, so the first install died with `ENOSPC`. Worked around with `YARN_CACHE_FOLDER` / `YARN_GLOBAL_FOLDER` pointed at D:. **No repo file was modified; `yarn.lock` is byte-identical to the original.**
2. **Node version mismatch.** Install completed fetch + link successfully but failed its post-install validation hook (`yarn.config.cjs:26` enforces `^24.5.0`). `node_modules` was linked correctly regardless (2,259 entries), so verification could proceed.

### E1. Results

| Target | Result | Detail |
|---|---|---|
| `nx build twenty-shared` | ✅ **PASS** | Clean |
| `nx typecheck twenty-shared` | ✅ **PASS** | Clean |
| `nx test twenty-shared` | ✅ **PASS** | **234 suites / 1,882 tests passed**, 1 snapshot |
| `nx lint twenty-shared` | ✅ **PASS** | 0 warnings, 0 errors; formatting clean |
| `nx lint twenty-server` | ✅ **PASS** | 0 errors, **1 pre-existing warning** (see FAIL-D) |
| `nx lint twenty-front` | ✅ **PASS** | 0 warnings, 0 errors; formatting clean |
| `nx build twenty-ui` | ❌ **FAIL** | `TS5042` — **FAIL-A** |
| `nx typecheck twenty-server` | ❌ **BLOCKED** | Fails on its `twenty-ui:build` dependency, not on server code |
| `nx test twenty-server` | ❌ **BLOCKED** | Same dependency block |
| `jest` server suite (direct, bypassing nx graph) | ⚠️ **1,080 / 1,084 suites pass** | **7,728 passed, 10 failed, 15 skipped** — **FAIL-B** |
| `jest` front suite (direct) | ⚠️ **864 / 1,155 suites pass** | **5,101 passed, 1 assertion failed, 290 suites failed to load** — **FAIL-A (downstream)**, **FAIL-C** |
| `nx test:integration twenty-server` | ⏭️ **NOT RUN** | Requires a live PostgreSQL; no database was provisioned |
| `nx storybook:test twenty-front` | ⏭️ **NOT RUN** | Requires a Storybook build; blocked by FAIL-A |
| Playwright E2E | ⏭️ **NOT RUN** | Requires a running application stack |

### E2. FAIL-A — `twenty-ui:build` fails with `TS5042` (root cause: double space in the repository path)

**Error:** `error TS5042: Option 'project' cannot be mixed with source files on a command line.`

**Impact — this is the widest single problem found:** it blocks `twenty-ui:build`, and therefore `twenty-server:typecheck`, `twenty-server:test`, `twenty-front` build/storybook, and causes **290 front test suites to fail to load** with `Cannot find module 'twenty-ui/icon'`, `'twenty-ui/utilities'`, etc.

**Root cause, established by experiment:**
- `packages/twenty-ui/vite.config.ts:43` computes `tsConfigPath = path.resolve(__dirname, './tsconfig.lib.json')` and hands it to `vite-plugin-checker`, which spawns `tsc -p <path>`.
- `__dirname` here is `D:\LA  VIVENZIA\LAVIVENZIACRM\packages\twenty-ui` — **two consecutive spaces**.
- Passing that path **quoted** typechecks clean: `npx tsc -p "D:\LA  VIVENZIA\...\tsconfig.lib.json" --noEmit` → **exit 0**. The TypeScript itself is healthy.
- Simulating the argv split reproduces the exact error: `npx tsc -p "D:\LA" "VIVENZIA\...\tsconfig.lib.json"` → **`TS5042`**.

*(An earlier test via a space-free junction was inconclusive and is not relied on — Node resolves junctions to the real path, so `__dirname` still contained the double space.)*

**Fix — environment, not code: relocate the repository to a path with no spaces**, e.g. `D:\lavivenzia\crm`. Do **not** patch `twenty-ui/vite.config.ts`; that would be a core modification requiring a `CORE-MODIFICATIONS.md` entry, and it would be fixing a local path problem in shared source.

### E3. FAIL-B — 10 server test failures, all Windows-environment artifacts

| Suite | Tests | Cause |
|---|---|---|
| `logic-function-drivers/drivers/local/utils/__tests__/get-local-sdk-layer-path.util.spec.ts` | 1 | Expects `…/sdk/ws-1-app-2`, gets `…\sdk\ws-1-app-2` — path separator |
| `logic-function-drivers/drivers/local/utils/__tests__/get-local-deps-layer-path.util.spec.ts` | 2 | Same |
| `file-storage/drivers/__tests__/local.driver.spec.ts` | 4 | `EPERM: operation not permitted, symlink` — Windows needs Administrator or Developer Mode to create symlinks |
| `file/controllers/file.controller.spec.ts` | 3 | Expects `"resourcePath": "images/logo.png"`, gets `"images\\logo.png"` — path separator |

**None are Twenty source defects and none are attributable to La Vivenzia** (which has changed no code). All are POSIX-vs-Windows assumptions in the tests; they pass on CI (Linux). Expect them to persist on any Windows dev machine.

### E4. FAIL-C — 1 front assertion failure (locale/ICU)

`packages/twenty-front/src/utils/format/__tests__/formatDate.test.ts:28`
`formatToHumanReadableTime` expects `"12:30 pm"`; received `["12:30 PM", "12:30 PM", "12:30 p.m."]`.

Lowercase-vs-uppercase meridiem is an **ICU data difference**, consistent with running Node 22 where the repo requires Node 24. Environment, not code.

### E5. FAIL-D — 1 pre-existing lint warning (baseline)

`packages/twenty-server/src/engine/core-modules/application/application-translation/application-translation-sync.service.ts:5`
`eslint(no-unused-vars): Type 'APP_LOCALES' is imported but never used.`

0 errors. Present in the untouched baseline. **Do not fix** — it is upstream Twenty code and touching it creates avoidable fork drift.

### E6. Verdict

**Every failure observed is environmental.** Two root causes account for all of them:

1. **Repository path contains a double space** → FAIL-A → 290 front suites + all nx typecheck/test targets that depend on `twenty-ui`.
2. **Windows + Node 22 instead of Node 24** → FAIL-B (10 server tests) and FAIL-C (1 front test).

**Zero failures are attributable to Twenty source defects, and zero to La Vivenzia** — no LV code exists yet and no Twenty file was modified.

The baseline is therefore assessed as **healthy but not yet reproducibly verifiable on this machine**. Full green requires:

| Action | Clears |
|---|---|
| Relocate repo to a space-free path (e.g. `D:\lavivenzia\crm`) | FAIL-A + the 290 front suites |
| Install Node 24.16.0 (per `.nvmrc`) | FAIL-C, and the install validation hook |
| Free space on C:, or keep the D: yarn cache | the `ENOSPC` install failure |
| Enable Windows Developer Mode, **or** run verification on Linux/WSL/CI | FAIL-B (4 symlink tests); the 6 path-separator tests need Linux |

> **Recommendation:** treat **Linux or WSL2 as the reference verification environment**, matching CI. Windows is workable for editing but will never be fully green against this test suite.

### E6b. UPDATE 2026-09-09 — repository relocated, app now RUNS

The repository was moved (with the owner's approval) from `D:\LA  VIVENZIA\LAVIVENZIACRM` to **`D:\lavivenzia-crm`**, removing the double space.

**FAIL-A is resolved.** `nx build twenty-ui` now succeeds — confirming beyond doubt that the double space was the root cause of `TS5042` and of the 290 front suite load failures.

After the move all 18 `node_modules` workspace symlinks were broken (they held absolute paths to the old location); deleting them and re-running `yarn install` relinked them.

**The application is now running locally:**

| Component | Status |
|---|---|
| Server (`localhost:3000`) | ✅ `/healthz` → `{"status":"ok"}` |
| GraphQL (`/graphql`) | ✅ schema live, 11 root query fields, introspection working |
| Frontend (`localhost:3001`) | ✅ HTTP 200, React shell + Vite HMR |
| PostgreSQL | ✅ `core` schema (74 tables) + workspace schema (35 CRM tables) |
| Redis | ✅ healthy |
| Migrations | ✅ all applied through **2.39.0** |
| Seeded workspace | ✅ "Apple" (ACTIVE), users `tim@apple.dev` etc. |
| Seeded demo records | ❌ not created — blocked by **WIN-BUG-2** |

**Port isolation:** the CRM stack runs on **Postgres 5433 / Redis 6380** (compose project `lv-crm-dev`), deliberately avoiding the separate `lavivenzia-postgres` container on 5432 — satisfying `ARCHITECTURE.md`'s separate-database rule at the infrastructure level. This resolves **BLOCKER-04** for local dev.

### E6c. Two genuine Twenty bugs on Windows (not configuration)

Both are real defects in Twenty source, found while bringing the app up. Neither is caused by La Vivenzia.

**WIN-BUG-1 — `src/constants/assets-path.ts`: hardcoded POSIX separator**

```ts
const IS_BUILT_THROUGH_TESTING_MODULE = !__dirname.includes('/dist/');
```

On Windows `__dirname` uses backslashes, so `'/dist/'` never matches. A production build therefore takes the *testing* branch and looks for assets in `dist/engine/...` instead of `dist/assets/engine/...`, crashing with `ENOENT` on `seed-dependencies/yarn.lock`. Worked around by mirroring `dist/assets/engine/*` into `dist/engine/`. A real fix would normalise separators or use `path.sep`.

**WIN-BUG-2 — file storage rejects Windows path separators**

`FileStorageService.validateAndBuildFileStoragePathOrThrow` throws *"Resource path must not contain backslashes"*. The dev seeder builds resource paths with the platform separator, so `workspace:seed:dev` aborts at `PrefillLogicFunctionService.ensureSeeded`, before demo records are created. Same root cause as the 4 `local.driver.spec.ts` failures in FAIL-B.

**Consequence:** workspace, users, schema and all 35 CRM tables exist and the app is fully usable, but demo companies/people/opportunities are empty. Records can be created through the UI.

**A third, milder issue** (`twenty-sdk:build`) is shell portability rather than a bug: the build passes single-quoted globs (`'dist/define/**/*.d.ts'`) to `rimraf`, which Windows passes through literally. Only the stale-cleanup step is affected; the rollup `.d.ts` generation succeeds, so the build completes manually.

### E6d. Working local run recipe (Windows, until Node 24 / WSL2)

`nx start` cannot be used end-to-end because `twenty-sdk:build` fails as above, so the underlying commands are run directly:

```bash
# 1. infrastructure (isolated ports)
docker compose -f <lv-crm-dev.yml> up -d          # Postgres 5433, Redis 6380

# 2. env
#    packages/twenty-server/.env -> PG_DATABASE_URL=...localhost:5433/default
#                                   REDIS_URL=redis://localhost:6380
#    packages/twenty-front/.env  -> copied from .env.example

# 3. build deps + server
npx nx build twenty-shared && npx nx build twenty-ui
cd packages/twenty-sdk && npx rollup -c rollup.config.sdk-dts.mjs
cd ../twenty-server && npx rimraf dist && npx nest build --path ./tsconfig.build.json
cp -r dist/assets/engine/* dist/engine/                 # WIN-BUG-1 workaround

# 4. database
node dist/database/scripts/setup-db.js
node dist/command/command.js run-instance-commands --force
node dist/command/command.js cache:flush
node dist/command/command.js workspace:seed:dev         # aborts at WIN-BUG-2

# 5. run
cd packages/twenty-server && NODE_ENV=development npx nest start --watch   # :3000
cd packages/twenty-front  && npx vite --port 3001                          # :3001
```

Installing **Node 24.16.0** and running on **Linux/WSL2** would remove every workaround above.

### E7. Artifacts and side-effects

**No Twenty source file was hand-edited.** `package.json` and `yarn.lock` at the repo root are byte-identical to the original (Sep 7 timestamps preserved).

**One build side-effect to be aware of:** running `nx build twenty-shared` triggers its `generateBarrels` prerequisite (`packages/twenty-shared/scripts/generateBarrels.ts`), which **rewrites** `packages/twenty-shared/package.json`, `project.json` and the 15 `src/*/index.ts` barrel files. This is normal, deterministic regeneration from unchanged source — CI runs the same step first — and the regenerated tree passed typecheck, lint, format check and all 1,882 tests. It is recorded here only because, with no Git in place (BLOCKER-01), **byte-identity cannot currently be proven**. Confirm with `git status` immediately after the re-fork.

Created inside the repo: `node_modules/` and `.yarn/install-state.gz` — both gitignored. Created outside it:
- `D:\.yarn-cache-lv` and `D:\.yarn-global-lv` — the redirected Yarn cache (~2.85 GiB). Keep them, or delete and re-install after freeing C:.
- A temporary junction `D:\lvcrm-nospace` was created for a diagnostic and **has been removed**.

---

## PART F — RECOMMENDED NEXT ACTIONS

In order. Nothing below was performed in this pass.

1. **Resolve BLOCKER-01** — re-fork with Git history and verify this tree against `v2.39.0`.
2. **Resolve DECISION-01 and DECISION-02** — the licence answer shapes the whole Phase-1 RBAC and audit design.
3. **Resolve BLOCKER-03 / DECISION-04** — supply UI reference assets and settle the theming approach.
4. **Scaffold `packages/twenty-apps/internal/lavivenzia-crm`** with the nine empty modules, using `twenty-partners` as the structural reference and `create-twenty-app` for the skeleton. Get an empty app installing into a clean workspace and green on CI **before** any object is defined.
5. **Build `lv-core` objects** from `DATA-MODEL.md`, with provenance fields designed in from the start.
6. **Then `lv-notifications`** — LV-09 blocks LV-10, LV-11, LV-12 and the daily brief. It is the correct first functional build, ahead of the more visible features.

> Per `IMPLEMENTATION-ORDER.md`: *"Do not optimise AI autonomy before operational data quality and workflow reliability are proven."* Steps 5–6 come before anything in `lv-intelligence` or `lv-copilot`.
