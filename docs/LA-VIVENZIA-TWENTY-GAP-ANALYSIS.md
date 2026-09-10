# La Vivenzia CRM — Twenty CRM Technical Gap Analysis

**Status:** Audit only. No code, schema, package, UI or branding was modified in producing this document.
**Repository audited:** `D:\LA  VIVENZIA\LAVIVENZIACRM`
**Requirements source:** *La Vivenzia Super CRM — Product Requirements & Functional Blueprint* (70 sections + 3-phase MVP priority), supplied by the founder.
**Date:** 2026-09-08
**Method:** Direct source-code inspection of this repository. Nothing here is taken from Twenty's marketing site or public documentation; every claim is anchored to a file path in this repo.

---

## PART 0 — READING GUIDE

### Support levels

| Level | Meaning |
|---|---|
| **A** | Fully supported by Twenty as shipped. Works out of the box. |
| **B** | Mostly supported. Reachable through configuration: custom objects, custom fields, views, roles, page layouts, workflows, agents — **no code**. |
| **C** | Partially supported. Twenty provides the substrate (data model, API, workflow engine, agent runtime) but La Vivenzia must write real code — an app module, a logic function, a front component. |
| **D** | Requires substantial new functionality. A subsystem Twenty does not have at all, built on top of Twenty's primitives. |
| **E** | Not realistically supported without major architectural work — a different storage engine, a different data paradigm, or a fork of Twenty core. |

### Implementation route codes

| Code | Route |
|---|---|
| **R1** | Already available in Twenty — do not rebuild. |
| **R2** | Twenty configuration (settings UI / metadata API). No code. |
| **R3** | Twenty **application/extension framework** (`packages/twenty-sdk`, app manifest). Code, but outside core. |
| **R4** | Requires modifying Twenty **core** (fork-level change). |
| **R5** | Entirely new La Vivenzia module (new objects + new services, delivered as an app). |
| **R6** | External service / third-party API. |
| **R7** | New database architecture (new store, not just new tables). |

---

## PART 1 — CURRENT TWENTY REPOSITORY: VERIFIED FACTS

### 1. Exact version / commit / branch

| Item | Finding | Evidence |
|---|---|---|
| Product version | **Twenty 2.39.0** | `packages/twenty-server/src/engine/core-modules/upgrade/constants/twenty-current-version.constant.ts` — auto-generated, `TWENTY_CURRENT_VERSION = '2.39.0'` |
| Monorepo package version | `0.2.1` | `package.json:53` (workspace version, unrelated to product version) |
| Commit / branch | **UNKNOWN — no `.git` directory exists** | `ls -la` on repo root shows no `.git`; `git rev-parse HEAD` returns *"not a git repository"* |
| Upgrade history present | 1.21 → 2.23+ upgrade command directories | `packages/twenty-server/src/database/commands/upgrade-version-command/` |
| Node | `24.16.0` | `.nvmrc` |
| Package manager | Yarn 4.13.0 | `package.json` → `packageManager` |
| Licence | AGPL-3.0, with **352 files** carrying `/* @license Enterprise */` | root `package.json`; `grep -rl "@license Enterprise"` |

> **RISK-01 (High).** This is a **source drop, not a clone**. No git history, no remote, no branch, no commit SHA. You cannot currently diff against upstream, pull security patches, or rebase La Vivenzia changes onto a new Twenty release. **Before any development starts this must become a proper fork** — clone `twentyhq/twenty` at tag `v2.39.0`, verify the working tree matches this drop, re-point the remote. Until then the upgrade path is broken by construction.

### 2. Current architecture

Nx + Yarn 4 monorepo. Verified packages under `packages/`:

| Package | Role |
|---|---|
| `twenty-server` | NestJS + TypeORM + PostgreSQL + Redis + GraphQL. All backend. |
| `twenty-front` | React 19, Jotai, Linaria, Vite, Apollo. |
| `twenty-shared` | Isomorphic types/utils shared front↔back. |
| `twenty-ui` | Design system / component library. |
| `twenty-sdk` | **Application SDK + CLI** — how apps are authored. |
| `twenty-apps` | `examples/`, `public/`, `internal/`, `fixtures/` — shipped applications. |
| `twenty-front-component-renderer` | Sandboxed rendering of app-supplied front components (`@remote-dom/react`). |
| `twenty-client-sdk`, `twenty-cli`, `create-twenty-app` | Client + scaffolding tooling. |
| `twenty-emails` | React Email transactional templates. |
| `twenty-e2e-testing` | Playwright. |
| `twenty-docker` | Docker Compose, Helm chart, k8s manifests, Grafana + OTel collector. |
| `twenty-docs`, `twenty-website`, `twenty-zapier`, `twenty-utils`, `twenty-oxlint-rules`, `twenty-codex-plugin`, `twenty-claude-skills` | Supporting. |

The server splits into two halves, and this distinction drives every decision below:

- `src/engine/` — the **platform**: API layer, metadata engine, ORM, permissions, auth, workspace manager, AI, apps.
- `src/modules/` — the **CRM product built on that platform**: company, person, opportunity, task, note, attachment, messaging, calendar, workflow, timeline, dashboard, emailing, call-recording, blocklist, connected-account.

### 3. Frontend architecture

- React 19 + Vite + Module Federation. State via **Jotai**, data via **Apollo GraphQL**.
- Styling: **Linaria** (zero-runtime styled-components). Theme tokens in `twenty-ui/src/theme-constants/`.
- i18n: **Lingui**, ~90 locale catalogs in `packages/twenty-front/src/locales/*.po`.
- ~60 feature modules under `packages/twenty-front/src/modules/`, incl. `object-record` (generic record engine), `views`, `page-layout`, `workflow`, `ai`, `command-menu`, `settings`, `dashboards`, `spreadsheet-import`, `applications`, `marketplace`, `front-components`.
- The UI is **metadata-driven**. There is no hand-written "Company page". `object-record` + `page-layout` + `views` render whatever the metadata engine reports.

> **This is the single most important architectural fact for La Vivenzia.** A new `Lead` object gets a full table view, kanban, record page, filters, sorts, search, import/export and timeline with **zero frontend code**.

### 4. Backend architecture

NestJS modular monolith + BullMQ worker (`src/queue-worker/`), Redis-backed.

| Subsystem | Path |
|---|---|
| API layer (GraphQL, REST, **MCP**) | `src/engine/api/{graphql,rest,mcp,common}` |
| Metadata engine (~80 modules) | `src/engine/metadata-modules/` |
| Twenty ORM (dynamic per-workspace entities) | `src/engine/twenty-orm/` |
| Workspace manager + migrations | `src/engine/workspace-manager/` |
| Core modules (~90) | `src/engine/core-modules/` |
| Caching | `src/engine/workspace-cache*`, `core-entity-cache` |

### 5. Database architecture

- **PostgreSQL**, multi-schema: a `core` schema for platform tables (`core.role`, `core.rowLevelPermissionPredicate`, `core.application`, `core.agent`, `core.skill`, …) plus **one schema per workspace** holding CRM records.
- Records live in real, physical, per-workspace tables. Adding a custom object/field emits a **real DDL migration**, not an EAV row (`src/engine/workspace-manager/workspace-migration/`).
- **32 standard workspace entities** ship: `person, company, opportunity, task, taskTarget, note, noteTarget, attachment, timelineActivity, workspaceMember, dashboard, message, messageThread, messageThreadTarget, messageChannel, messageChannelMessageAssociation, messageParticipant, messageFolder, messageCampaign, messageList, messageListMember, calendarEvent, calendarChannel, calendarEventParticipant, calendarEventTarget, calendarChannelEventAssociation, callRecording, blocklist, workflow, workflowVersion, workflowRun, workflowAutomatedTrigger`.
- Full-text search via Postgres **`tsvector` + GIN** with an `unaccent_immutable` wrapper and an `ILIKE` fallback (`src/engine/core-modules/search/services/search.service.ts:198-350`).
- **Redis** for cache/queues/pub-sub. **ClickHouse** for event logs (§20). **S3 or local disk** for files.
- Soft delete is first-class (`deletedAt`), with a scheduled hard-delete sweeper: `src/engine/trash-cleanup/`.

### 6. Authentication architecture

`src/engine/core-modules/auth/`. Verified strategies in `auth/strategies/`:

| Method | Status |
|---|---|
| Email + password | Available |
| Google OAuth | `google.auth.strategy.ts` |
| Microsoft OAuth | `microsoft.auth.strategy.ts` |
| **SAML** | `saml.auth.strategy.ts` — **enterprise-key gated at runtime** |
| **OIDC** | `oidc.auth.strategy.ts` — **enterprise-key gated at runtime** |
| JWT sessions + signing-key rotation cron | `jwt.auth.strategy.ts`, `jwt/crons/` |
| **MFA / TOTP** | **Available and NOT gated** — `core-modules/two-factor-authentication/strategies/otp/totp/`. No `@license Enterprise` header, no enterprise guard. |
| API keys | `core-modules/api-key/` |
| Impersonation | `core-modules/impersonation/` (permission-flagged) |
| Approved access domains, email verification, captcha, throttling | Present |

SSO gating is explicit: `sso.resolver.ts` and `sso-auth.controller.ts` both apply `EnterpriseFeaturesEnabledGuard`, which throws unless `enterprisePlanService.isValid()`.

> La Vivenzia §62's **MFA requirement is met for free**. SSO is not — see RISK-02.

### 7. Permission / RBAC architecture

Twenty's strongest area, and it maps well onto La Vivenzia §40.

| Layer | Implementation | Gated? |
|---|---|---|
| Roles | `core.role` — `metadata-modules/role/role.entity.ts`. Flags: `canUpdateAllSettings`, `canAccessAllTools`, `canReadAllObjectRecords`, `canUpdateAllObjectRecords`, `canSoftDeleteAllObjectRecords`, `canDestroyAllObjectRecords`, `canBeAssignedToUsers/Agents/ApiKeys`, `isEditable` | **Free** |
| Object-level permissions | `metadata-modules/object-permission/` | **Free** |
| **Field-level** permissions | `object-permission/field-permission/field-permission.entity.ts` | **Free** |
| 28 permission flags | `twenty-shared/src/constants/PermissionFlagType.ts` — incl. `DATA_MODEL`, `ROLES`, `WORKFLOWS`, `IMPERSONATE`, `IMPORT_CSV`, `EXPORT_CSV`, `AI`, `AI_SETTINGS`, `SEND_EMAIL_TOOL`, `HTTP_REQUEST_TOOL`, `CODE_INTERPRETER_TOOL`, `SECURITY`, `LAYOUTS`, `VIEWS`, `UPLOAD_FILE`, `DOWNLOAD_FILE`, `CONNECTED_ACCOUNTS` | **Free** |
| **Row-level permissions** | `metadata-modules/row-level-permission-predicate/` — per-role, per-object, per-field predicate groups with operands and logical grouping | **ENTERPRISE-KEY GATED** |

Row-level gating is enforced at runtime, not merely by licence header:

```ts
// row-level-permission-predicate.service.ts:573
const hasValidEnterprisePlan = this.enterprisePlanService.isValid();
const isRowLevelPermissionEnabled = await this.billingService.hasEntitlement(
  workspaceId, BillingEntitlementKey.RLS,
);
return hasValidEnterprisePlan && isRowLevelPermissionEnabled;
```

`hasEntitlement` returns `true` when `IS_BILLING_ENABLED=false` (`billing.service.ts:76-80`), so on a self-host the gate collapses to **`enterprisePlanService.isValid()` — a signed enterprise key**.

> **RISK-02 (Critical).** §40 requires *"Experience Hunter — create/view **assigned** leads"*. That is exactly row-level scoping, and it is the one RBAC layer behind the enterprise key. Three options: **(a)** buy a Twenty enterprise licence; **(b)** implement La Vivenzia's own row-scoping in a query-runner hook (fork-level, `R4`); **(c)** approximate with per-role views + object permissions — which restricts *what is displayed* but **not what is reachable via the API**, and is therefore **not acceptable** for a stated security requirement. This decision must be made before Phase 1 starts.

### 8. Existing object / data-model system

- Objects and fields are **runtime metadata**, editable by an admin holding the `DATA_MODEL` flag via Settings → Data Model — **no developer, no deploy**.
- `objectMetadata` columns of note: `isCustom`, `isSystem`, `isActive`, `isSearchable`, `isAuditLogged`, **`duplicateCriteria` (jsonb)**, `labelIdentifierFieldMetadataId`, `imageIdentifierFieldMetadataId`, `shortcut`, `standardOverrides`.
- A parallel "flat entity" layer (`metadata-modules/flat-*`, ~30 modules) gives a serialisable, diffable representation of all metadata. This is what makes apps installable and metadata versionable.

### 9. Custom fields system

25 field types (`twenty-shared/src/types/FieldMetadataType.ts`):

`ACTOR, ADDRESS, ARRAY, BOOLEAN, CURRENCY, DATE, DATE_TIME, EMAILS, FILES, FULL_NAME, LINKS, MORPH_RELATION, MULTI_SELECT, NUMBER, NUMERIC, PHONES, POSITION, RATING, RAW_JSON, RELATION, RICH_TEXT, SELECT, TEXT, TS_VECTOR, UUID`

Notable for La Vivenzia: **`MORPH_RELATION`** (polymorphic — one field pointing at several object types, directly useful for §60's multi-role identity model) and **`ACTOR`** (who/what/which-source performed an action, carrying `ConnectedAccountProvider` — useful for §2's lead-source tracking).

**Not present:** cascading / dependent SELECT (category → sub-category with filtered options). See LV-P1-04.

### 10. Workflow / automation engine

`src/modules/workflow/` with a visual builder in `twenty-front/src/modules/workflow/`.

- **Triggers** (`workflow-trigger/types/workflow-trigger.type.ts`): `DATABASE_EVENT`, `MANUAL` (global / single-record / bulk availability), `CRON` (minutes / hours / days / custom pattern), `WEBHOOK` (GET/POST, optional API-key auth).
- **Actions** (`workflow-executor/workflow-actions/`): `record-crud`, `code`, `http-request`, `mail-sender`, `create-calendar-event`, `if-else`, `filter`, `iterator`, `delay`, `form`, `logic-function`, **`ai-agent`**, `tool-backed`.
- Versioned (`workflowVersion`), with run history (`workflowRun`) and status tracking.

> This subsystem alone covers a large share of §15 (smart follow-up), §32 (SLA), §57 (custom workflows) and §69 (AI autonomy) **without code**.

### 11. Task / activity system

`src/modules/task/` — `task` + `taskTarget`. `taskTarget` is the join that attaches one task to person / company / opportunity / **custom objects**. Notes work identically (`note` + `noteTarget`). Front: `modules/activities/`. Today / Upcoming / Overdue / Completed views are ordinary saved view filters (§33 satisfied by configuration).

### 12. Timeline / activity history

`src/modules/timeline/` + the `timelineActivity` standard object. Populated automatically by pre-query hooks on create/update (`timeline/query-hooks/timeline-activity-*.pre-query-hook.ts`) and by internal events (`jobs/upsert-timeline-activity-from-internal-event.job.ts`).

`timeline-activity.workspace-entity.ts` declares `targetCustom: EntityRelation<CustomWorkspaceEntity>` — **custom objects get the timeline for free**. Fields stored: `happensAt`, `properties` (JSON diff), `workspaceMember`, `linkedRecordId` / `linkedObjectMetadataId` / `linkedRecordCachedName`, `timelineActivityTypeSnapshot`.

`isAuditLogged` on `objectMetadata` toggles this per object.

### 13. Email / calendar capabilities

Full two-way sync, not a token integration.

- **Messaging** (`src/modules/messaging/`): drivers for **Gmail, Microsoft Graph, IMAP, SMTP, inbound-email** (`message-import-manager/drivers/`). Import manager, outbound manager, folder manager, participant matcher, blocklist, cleaner, monitoring.
- **Calendar** (`src/modules/calendar/`): event import, creation manager, participant manager, blocklist, cleaner. CalDAV via `core-modules/imap-smtp-caldav-connection/`.
- Threads auto-link to records through `messageParticipant` + `match-participant` matching on email handle.
- Sending: `mail-sender` workflow action, `send-email-tool` / `draft-email-tool` AI tools, `EMAIL_THREAD` dashboard widget.

### 14. Search capabilities

- Postgres `tsvector` primary with `ILIKE` fallback; `ts_rank_cd` / `ts_rank` ordering; cross-object result ranking via `standard-objects-by-priority-rank.ts`.
- Front: global command menu (`modules/command-menu/`).
- **This is keyword search.** There is no embedding store, no vector index, no pgvector, and no semantic/NL query planner anywhere in the repo. See LV-X-12.

### 15. Dashboard / reporting capabilities

- `dashboard` standard object + `page-layout` / `page-layout-tab` / `page-layout-widget` metadata + `chart-data` services (`src/modules/dashboard/chart-data/`).
- **24 widget types** (`twenty-shared/src/types/page-layout/WidgetType.ts`): `VIEW, IFRAME, FIELD, FIELDS, GRAPH, STANDALONE_RICH_TEXT, TIMELINE, TASKS, NOTES, FILES, EMAILS, CALENDAR, FIELD_RICH_TEXT, WORKFLOW, WORKFLOW_VERSION, WORKFLOW_RUN, FRONT_COMPONENT, RECORD_TABLE, EMAIL_THREAD, CALL_RECORDING_SUMMARY, CALL_RECORDING_TRANSCRIPT, MESSAGE_CAMPAIGN_BODY, MESSAGE_CAMPAIGN_DETAILS, FORM_FIELD`.
- **Only 4 chart types**: `AGGREGATE_CHART`, `PIE_CHART`, `BAR_CHART`, `LINE_CHART` (`graph-widget-configuration-type.ts`).
- **No funnel chart, no cohort analysis, no chart drill-down.** `FRONT_COMPONENT` and `IFRAME` are the escape hatches.

### 16. API capabilities

| API | Path |
|---|---|
| GraphQL — core (per-workspace records, dynamically generated schema) | `src/engine/api/graphql/` |
| GraphQL — metadata (objects, fields, roles, views…) | same package, metadata schema |
| REST — core + metadata, with OpenAPI | `src/engine/api/rest/`, `core-modules/open-api/` |
| **MCP** (Model Context Protocol server) | `src/engine/api/mcp/` — tools, guards, tool annotations |
| Webhooks (outbound) | `metadata-modules/webhook/` |
| Server route triggers | `core-modules/server-route-trigger/` |
| Zapier | `packages/twenty-zapier/` |

Per-object query runners include `findMany`, `findOne`, **`findDuplicates`**, **`mergeMany`**, `createMany`, `updateMany`, `deleteMany`, `destroyMany`, `restoreMany`, `groupBy`.

### 17. AI / agent capabilities

Substantially more than expected. `src/engine/metadata-modules/ai/`:

| Component | Detail |
|---|---|
| **Agents** | `ai-agent/` — `core.agent` entity: `name`, `label`, `prompt`, `modelConfiguration`, `responseFormat` (incl. **structured output**), `icon`, `description`. Agents are first-class workspace-configurable records. |
| **Agent roles** | `ai-agent-role/` — agents are assigned Twenty roles, so an agent's data access is governed by the same RBAC as a human. |
| **Skills** | `metadata-modules/skill/skill.entity.ts` — named, reusable instruction blocks (`content: text`, `isCustom`, `isActive`, unique per workspace). **An admin-authorable prompt library, no code.** |
| **AI chat** | `ai/ai-chat/` — streaming chat with checkpointing, keepalive, tool preloading, workspace context. This is the Copilot substrate. |
| **Providers** | `ai-models/ai-providers.json` → `openai`, `anthropic`, `google`, `mistral`, `xai`. Plus registry, preferences, models.dev catalog. |
| **Tools** | `core-modules/tool/tools/`: `send-email-tool`, `draft-email-tool`, `create-calendar-event-tool`, `http-tool`, `code-interpreter-tool`, `navigate-tool`, `output-navigation-tool`, `search-help-center-tool`. Plus `core-modules/record-crud/` exposing find / create / update / upsert / delete / group-by to agents. |
| **Tool provider** | `core-modules/tool-provider/` — extensible tool registration. |
| **Workflow integration** | `ai-agent` is a first-class workflow action. |
| Monitoring / stats / billing | `ai-agent-monitor/`, `ai-workspace-stats/`, `ai-billing/` |

Per-tool permission flags (`SEND_EMAIL_TOOL`, `HTTP_REQUEST_TOOL`, `CODE_INTERPRETER_TOOL`, `CREATE_CALENDAR_EVENT_TOOL`) directly support §69's human-approval boundary.

> **Constraint (moderate, not blocking).** Custom AI providers require an enterprise key **only above 25 seats** — `MAX_SEATS_WITHOUT_ENTERPRISE_KEY = 25`, enforced in `admin-panel/services/admin-panel-ai-provider.service.ts:48`. Below 25 users it is free. This gates *custom provider configuration*, not AI itself.

### 18. File / document handling

- `core-modules/file/` + `file-storage/drivers/` — **`local.driver.ts`**, **`s3.driver.ts`**, plus a `validated-storage.driver.ts` wrapper.
- `FILES` field type, `attachment` standard object, `file-email-attachment`, `files-field`, signed file URLs, upload guards, `UPLOAD_FILE` / `DOWNLOAD_FILE` permission flags.
- **No OCR, no document parsing, no expiry/validity checking.** `grep -w OCR` across all source: **0 hits**.

### 19. Import / export

- **Import:** `twenty-front/src/modules/spreadsheet-import/` — a full multi-step CSV/XLSX wizard (upload → header match → field map → validate → import). Gated by `IMPORT_CSV`.
- **Export:** `record-index/export/`, `useExportProcessRecordsForCSV`, `useExportSingleRecord`. Gated by `EXPORT_CSV`.
- API bulk import via REST/GraphQL `createMany` / `upsertMany`.

### 20. Audit logging

**Two distinct systems — this distinction is decisive for §42.**

1. **`timelineActivity`** (per-record change trail) — Postgres, in-workspace, **free and ungated**, attaches to custom objects, per-object toggle via `isAuditLogged`. Records who, what, when, and a JSON property diff.
2. **`core-modules/event-logs/`** (platform event log) — **ClickHouse**-backed (`CLICKHOUSE_URL` config var; Grafana datasource shipped in `packages/twenty-docker/grafana/provisioning/datasources/`). Tables: `workspaceEvent`, `pageview`, `objectEvent`, `usageEvent`, `applicationLog`. **Every table carries `requiresEntitlement: BillingEntitlementKey.AUDIT_LOGS`**, and access is `enterprisePlanService.isValid() && billingService.hasEntitlement(...)` (`event-logs.service.ts:138-149`). All 12 files are `@license Enterprise`.

> **RISK-03 (High).** On a self-hosted instance without an enterprise key, **the ClickHouse audit-log viewer is unavailable**. `timelineActivity` remains and covers most of §42 — the *"Tejas → Interested → Onboarding, with timestamp/user"* example is literally a timelineActivity row. What `timelineActivity` does **not** provide: login/session events, permission-change events, export events, immutability guarantees, or a retention policy — all implied by §62. Plan a La Vivenzia-owned audit store for those.

### 21. Notification infrastructure

**The single largest missing platform primitive.**

- There is **no notification entity, no notification service, no notification centre, no inbox, no digest**. Verified: no `*Notification*` entity anywhere in `twenty-server/src`; no notification type in `twenty-shared`; the only front-end "notification" string hits are Storybook fixtures.
- What exists: `twenty-front/src/modules/ui/feedback/snack-bar-manager/` (ephemeral toasts) and `packages/twenty-emails/` — **12 transactional/system templates only** (password reset, invite, billing, suspension, email verification). None are user-activity notifications.
- Outbound channels available to build on: `mail-sender` workflow action, `send-email-tool`, webhooks, `http-request` action, SSE (`modules/sse-db-event/`).

> **RISK-04 (High).** §43 requires CRM + email + optional WhatsApp + optional push across 6 event types, and §32's SLA engine, §16's follow-up priorities and §30's assignment engine are all inert without it. **This must be built from zero.**

### 22. Self-hosting / deployment architecture

`packages/twenty-docker/`: `docker-compose.yml` (+ `.dev`, `.override`), a complete **Helm chart** (`helm/twenty/` with `values.schema.json`, templates, tests), **k8s manifests**, Podman support, a custom Postgres image (`twenty-postgres-spilo`), **OTel collector** and **Grafana** provisioning. `core-modules/health/` provides probes. Config surface: `core-modules/twenty-config/config-variables.ts` (1000+ lines).

Fully self-hostable. Runtime dependencies: PostgreSQL, Redis, object storage (S3 or disk); ClickHouse only if event logs are used.

### 23. Extension / app framework

**The most important finding in this audit.** `core-modules/application/` is a mature, first-class extension system — not a plugin afterthought.

Subsystems present: `application-manifest`, `application-install`, `application-upgrade`, `application-package`, `application-registration`, `application-marketplace`, `application-oauth`, `application-authorization`, `application-variable`, `application-key-value`, `application-translation`, `application-development`, `application-job`, `application-stop`, `connection-provider`, `pre-installed-apps`, `front-component-shared-dependencies`.

An application authored with `twenty-sdk` and `defineApplication()` can declare — verified against `packages/twenty-apps/examples/document-generator/src/`:

`objects/` · `fields/` · `indexes/` · `roles/` · `object-permissions/` · `field-permissions/` · `agents/` · `logic-functions/` · `front-components/` · `page-layouts/` · `navigation-menu-items/` · `command-menu-items/` · `application-variables/` · `connection-providers/` · `assets/`

Shipped public apps to model against: `call-recorder, discord, exa, fathom, fireflies, last-contact, linear, people-data-labs, slack`.

Supporting runtime: **`core-modules/logic-function/`** — serverless function execution with `local`, `lambda` and `disabled` drivers, a build pipeline and a common dependency layer. This is how La Vivenzia writes backend logic **without touching core**.

Front components render sandboxed via `packages/twenty-front-component-renderer` (`@remote-dom/react`).

> **This is the route that makes the La Vivenzia project viable.** Almost all of Phase 1 and much of Phase 2 can live in a `lavivenzia-crm` application package rather than in a fork of core.

### 24. Existing mobile / responsive capabilities

- **Responsive web only.** `MOBILE_VIEWPORT = 768` (`twenty-ui/src/theme-constants/constants.ts`), honoured across **113 source files** via `useIsMobile` / `isMobile`.
- A PWA manifest exists (`packages/twenty-front/public/manifest.json`) but there is **no service worker for offline use** (the only one present, `mockServiceWorker.js`, is MSW test tooling), **no camera capture flow, no native app, no offline queue**.
- §46's *"lead created in 30 seconds from a visiting-card photo"* has **no foundation here at all**.

### 25. Existing testing infrastructure

| Layer | Count | Tooling |
|---|---|---|
| Server unit | **1,088** `.spec.ts` | Jest |
| Server integration | **618** `.integration-spec.ts` | Jest + real DB (`test:integration:with-db-reset`) |
| Front unit | **1,148** `.test.ts(x)` | Jest + Testing Library + MSW |
| Storybook stories | **275** | Storybook 10 + `storybook:test` |
| E2E | 9 specs | Playwright (`twenty-e2e-testing/`) |

Plus `nx lint:diff-with-main`, `tsgo` typecheck, oxfmt/oxlint with custom rules (`twenty-oxlint-rules`), and a read-only Postgres MCP server wired in `.mcp.json`.

> **Test infrastructure is a genuine asset — La Vivenzia inherits ~2,900 tests.** It is also a constraint: fork-level changes to core must keep them green.

---

## PART 2 — REQUIREMENT MATRIX

Columns are abbreviated for width. Legend:
**Sup** = support level · **Cfg** = configuration only · **Cus** = custom development · **Maj** = major development · **DB** = new database model · **BE** = new backend logic · **FE** = new frontend UI · **3P** = third-party integration · **AI** = AI required · **Cx** = estimated complexity (S/M/L/XL) · **Route** = implementation route code (see Part 0).

### 2.1 PHASE 1 — CORE CRM (MVP)

| ID | La Vivenzia Requirement | Twenty supports? | Sup | Cfg | Cus | Maj | DB | BE | FE | 3P | AI | Cx | Relevant Twenty code | Recommended approach | Notes / risks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **LV-P1-01** | Login (§40, §62) | Yes | **A** | ✓ | – | – | – | – | – | – | – | S | `core-modules/auth/`, `auth/strategies/`, `two-factor-authentication/` | **R1/R2** — enable email+password and Google; enable TOTP MFA in Security settings | SSO (SAML/OIDC) is enterprise-gated. MFA is free. Do not build auth. |
| **LV-P1-02** | Roles & permissions — 5 internal roles, "own leads only" (§3, §40) | Partly | **B** | ✓ | ~ | – | – | ~ | – | – | – | M | `metadata-modules/role/`, `object-permission/`, `field-permission/`, `PermissionFlagType.ts`, `row-level-permission-predicate/` | **R2** for role/object/field perms; **R4 or licence** for row-level scoping | **RISK-02.** Row-level predicates are enterprise-key gated at runtime. Everything else is free. Decide licence vs. custom query-runner hook before Phase 1. |
| **LV-P1-03** | Lead database — universal lead object with Lead ID, category, owner, status, score (§5, §59) | Yes, via metadata | **B** | ✓ | – | – | ✓ | – | – | – | – | M | `metadata-modules/object-metadata/`, `field-metadata/`, `twenty-front/src/modules/object-record/` | **R2** — create `Lead` custom object + fields in Settings → Data Model; **R3** to ship it as an app manifest | Physical tables, real migrations. Full table/kanban/record UI comes free. Ship as app manifest, not hand-clicks, so it is reproducible across environments. |
| **LV-P1-04** | Dynamic categories — 4 ecosystems, ~60 values, admin-creatable, category→sub-category (§2) | Partly | **B** | ✓ | ~ | – | – | – | ~ | – | – | M | `FieldMetadataType.SELECT` / `MULTI_SELECT`, Settings → Data Model | **R2** for flat SELECT lists; **R3** front component for cascading | **No cascading/dependent SELECT exists.** Flat SELECT options are admin-editable with no code (§2 satisfied). Category→sub-category filtering needs a custom field front component or a workflow validation. |
| **LV-P1-05** | Lead capture — manual, referral, website, Instagram screenshot, visiting card, brochure, poster (§7, §47) | Partly | **C** | ~ | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | ✓ | L | `workflow-actions/form/`, REST/GraphQL API, `WEBHOOK` trigger, `spreadsheet-import/` | **R2** manual/form/CSV/API; **R5+R6** for image and social capture | Manual + web form + CSV + API are **A-grade today**. Image/Instagram/card capture needs OCR (RISK-05) and has zero foundation. Split this requirement in the plan. |
| **LV-P1-06** | Lead profile — universal profile page with all §5 fields | Yes | **B** | ✓ | – | – | – | – | – | – | – | S | `page-layout/`, `page-layout-tab/`, `page-layout-widget/`, `object-record/record-show/` | **R2** — compose page layout with FIELDS / TIMELINE / TASKS / NOTES / EMAILS widgets | 24 widget types cover the whole §5 field list. AI recommendation / relationship health are custom fields fed by workflows. |
| **LV-P1-07** | Lead timeline — permanent, nothing disappears (§6) | Yes | **A** | ✓ | – | – | – | – | – | – | – | S | `modules/timeline/`, `timeline-activity.workspace-entity.ts` (`targetCustom`) | **R1/R2** — set `isAuditLogged` on the Lead object | Auto-populated by pre-query hooks. Works on custom objects out of the box. **Do not rebuild.** Note: trash-cleanup sweeper can hard-delete; verify retention against §6's "nothing disappears". |
| **LV-P1-08** | Assignment — manual + auto by geography/category/workload/expertise/language (§30) | Partly | **C** | ~ | ✓ | – | – | ✓ | – | – | – | L | `field-metadata` RELATION → `workspaceMember`; `workflow-executor/workflow-actions/record-crud`, `code` | **R2** manual; **R3/R5** for the engine | Manual assignment is trivial. The 7-factor engine has no equivalent — see LV-X-17. |
| **LV-P1-09** | Tasks — 10 task types, Today/Upcoming/Overdue/Completed (§33) | Yes | **A** | ✓ | – | – | – | – | – | – | – | S | `modules/task/`, `taskTarget`, `twenty-front/src/modules/activities/` | **R1/R2** — add a `taskType` SELECT field; build 4 saved views | `taskTarget` attaches tasks to custom objects. **Do not rebuild.** |
| **LV-P1-10** | Follow-ups — every interaction generates a next action; 4 priority levels (§15, §16) | Yes, via workflows | **B** | ✓ | – | – | – | – | – | – | – | M | `workflow-trigger` DATABASE_EVENT, `workflow-actions/record-crud`, `delay` | **R2** — workflow: on interaction create → create task with due date | Priority is a SELECT field. Delay action handles scheduling. Notification of the due follow-up is the gap (RISK-04). |
| **LV-P1-11** | Interaction history — 12 channels, 11 captured attributes incl. sentiment/objection/commitment (§17) | Via custom object | **B** | ✓ | – | – | ✓ | – | – | – | – | M | `object-metadata/`, `note`/`noteTarget` as the pattern, `MORPH_RELATION` | **R2/R3** — new `Interaction` custom object with a `MORPH_RELATION` target | Straight metadata work. AI-filled fields (sentiment, objection) come from LV-X-35. |
| **LV-P1-12** | Basic dashboards (§26) | Partly | **B** | ✓ | ~ | – | – | – | ~ | – | – | M | `modules/dashboard/`, `chart-data/`, `WidgetType.ts`, `GRAPH_WIDGET_CONFIGURATION_TYPES` | **R2** for counts/breakdowns; **R3** front component for anything beyond 4 chart types | Only AGGREGATE / PIE / BAR / LINE exist. §26's conversion-stage table is expressible; §54's funnel is not (LV-X-26). |
| **LV-P1-13** | Onboarding workflow — 10 guided steps, progress %, doc collection, verification (§21-§25) | **No** | **D** | – | – | ✓ | ✓ | ✓ | ✓ | – | ~ | XL | `core-modules/onboarding/` is **user onboarding, not partner onboarding**; `workflow-actions/form/`, `file/` | **R5** — new La Vivenzia `Onboarding` module | **Do not confuse Twenty's `onboarding` module with this.** Twenty's onboards a *workspace user*. La Vivenzia needs a partner-facing, resumable, 10-step, document-gated flow with a health score. Largest single Phase-1 build. |
| **LV-P1-14** | Email integration — official LV mailboxes, thread linked to lead, sent/received/replied tracking (§44) | Yes | **A** | ✓ | – | – | – | – | – | ~ | – | S | `modules/messaging/` (gmail, microsoft, imap, smtp, inbound-email drivers), `match-participant/` | **R1/R2** — connect accounts in Settings | Two-way sync, threads, participants, folders, blocklist all shipped. **Do not rebuild.** Auto-linking to a *custom* Lead object needs a small matcher extension (`R3`). |
| **LV-P1-15** | Search (§38, basic) | Yes (keyword) | **B** | ✓ | – | – | – | – | – | – | – | S | `core-modules/search/`, `command-menu/`, `TS_VECTOR` field type | **R2** — mark Lead searchable (`isSearchable`) | Postgres tsvector + ILIKE fallback. Covers "Raj". Does **not** cover §38's NL examples — see LV-X-12. |
| **LV-P1-16** | Admin controls (§26, §41) | Yes | **A** | ✓ | – | – | – | – | – | – | – | S | `twenty-front/src/modules/settings/`, `core-modules/admin-panel/`, `feature-flag/`, `twenty-config/` | **R1/R2** | Workspace settings, members, roles, data model, feature flags, server admin panel all present. |
| **LV-P1-17** | Audit log — critical changes permanently traceable (§42) | Partly | **B** | ✓ | ~ | – | ~ | ~ | – | – | – | M | `timelineActivity` (free); `core-modules/event-logs/` (ClickHouse, enterprise-gated) | **R2** for record-change audit; **R5** for auth/permission/export audit | **RISK-03.** `timelineActivity` satisfies §42's stated example for free. Login events, permission changes, exports and immutability are **not** covered without an enterprise key. |
| **LV-P1-18** | Delete restrictions — archive/duplicate/close for normal users, permanent delete Main-Admin-only, recycle bin, reason capture (§41) | Mostly | **B** | ✓ | ~ | – | – | ~ | – | – | – | M | `role.canSoftDeleteAllObjectRecords` / `canDestroyAllObjectRecords`, `deletedAt`, `engine/trash-cleanup/`, `restoreMany` | **R2** for the permission split and recycle bin; **R3** for reason capture | Soft delete + restore + role-gated destroy are shipped and map almost exactly onto §41. Missing: **deletion reason, previous-ID retention**, and an explicit "Archive / Mark Duplicate / Close" action set (custom actions or SELECT statuses). |

**Phase 1 tally:** A = 5 · B = 10 · C = 2 · D = 1 · E = 0 · **(n = 18)**

### 2.2 PHASE 2 — AI CRM

| ID | La Vivenzia Requirement | Twenty supports? | Sup | Cfg | Cus | Maj | DB | BE | FE | 3P | AI | Cx | Relevant Twenty code | Recommended approach | Notes / risks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **LV-P2-01** | AI lead classification (§8) | Yes, via agents | **B** | ✓ | – | – | – | – | – | ~ | ✓ | M | `metadata-modules/ai/ai-agent/`, `workflow-actions/ai-agent/`, `AgentResponseFormat` (structured output) | **R2** — agent + skill + DATABASE_EVENT workflow writing back via record-crud | Structured output means classification lands directly in typed fields. Genuinely no-code. |
| **LV-P2-02** | AI lead score 0-100, **explainable**, 10 factors (§9) | Substrate only | **C** | ~ | ✓ | – | ✓ | ✓ | ~ | – | ✓ | L | same as above + `NUMBER` / `RAW_JSON` fields | **R3** — agent produces structured breakdown; logic function persists; front component renders it | Scoring is easy; **explainability UI and factor storage are the work.** Store the 10-factor breakdown as `RAW_JSON` and render with a front component. |
| **LV-P2-03** | Duplicate detection — fuzzy, "The Forest Table" vs "The Forest Table Pune" at 91% (§10) | Partly | **C** | ~ | ✓ | – | – | ✓ | – | – | ~ | M | `objectMetadata.duplicateCriteria`, `common-find-duplicates-query-runner.service.ts`, `common-merge-many-query-runner.service.ts`, front `record-merge/`, `RecordDetailDuplicatesSection.tsx` | **R2** for exact-match; **R3/R4** for fuzzy | **Twenty's duplicate detection is exact-match on configured criteria columns** (`compute-duplicate-keys.util.ts` — JSON-stringified value tuples). No similarity scoring. Add `pg_trgm` similarity or an embedding pass in a logic function. **The merge UI already exists and is excellent — do not rebuild it.** |
| **LV-P2-04** | AI summaries (§34 Relationship Memory) | Yes, via agents | **B** | ✓ | – | – | – | – | – | – | ✓ | M | `ai-agent/`, `skill/`, CRON workflow trigger | **R2** — scheduled agent writes to a `RICH_TEXT` summary field | Straightforward. Cost control is the real consideration at volume. |
| **LV-P2-05** | AI email drafting (§19, §45) | Yes | **A** | ✓ | – | – | – | – | – | – | ✓ | S | `core-modules/tool/tools/email-tool/draft-email-tool.ts`, `email-composer.service.ts` | **R1/R2** — enable the tool, add a brand-voice skill | Shipped tool with tests. §19's tone actions (Professional/Friendly/Shorter/…) are skill prompts. **Do not rebuild.** |
| **LV-P2-06** | AI WhatsApp drafting (§19) | Text yes, channel no | **C** | ~ | ✓ | – | – | ✓ | ✓ | ✓ | ✓ | M | agents for text; **no WhatsApp anywhere** | **R3+R6** — agent drafts, WhatsApp Business API sends | `grep -i whatsapp` finds only a seeded custom-field label and locale strings. **No integration exists.** |
| **LV-P2-07** | AI next-best-action, with reason and action buttons (§65) | No | **D** | – | – | ✓ | ✓ | ✓ | ✓ | – | ✓ | L | `ai-agent/`, `page-layout-widget` FRONT_COMPONENT | **R5** — new NBA engine + widget | Nothing comparable exists. Needs an engine, per-lead persisted recommendation, and a bespoke UI surface with Call/WhatsApp/Email/Schedule/Complete actions. |
| **LV-P2-08** | AI problem classification (§13, §36) | Substrate only | **C** | ~ | ✓ | – | ✓ | ~ | ~ | – | ✓ | M | `object-metadata/`, `ai-agent/` | **R3** — `Problem` custom object + classifier agent | Object is config; the AI *solution suggestion* (§13's "not just contact admin") is the real work. |
| **LV-P2-09** | AI onboarding assistance (§23) | No | **D** | – | – | ✓ | ✓ | ✓ | ✓ | – | ✓ | L | depends on LV-P1-13 | **R5** | Blocked on LV-P1-13. §23's constraint — *user-provided info ≠ AI-suggested wording, AI must not fabricate* — requires explicit provenance tracking per field. Design that in from the start. |
| **LV-P2-10** | OCR — visiting card, brochure, poster, screenshot (§7, §46) | **No** | **D** | – | – | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | L | none; `file/` for storage only | **R6** — vision model (the AI SDK is already wired for OpenAI/Anthropic/Google) or a dedicated OCR API | **RISK-05.** Zero foundation. The good news: the multimodal providers already configured can do this without a new vendor. |
| **LV-P2-11** | AI daily brief (§29) | Substrate only | **C** | ~ | ✓ | – | ~ | ✓ | ~ | – | ✓ | M | `CRON` workflow trigger, `ai-agent` action, `mail-sender` | **R2/R3** — cron workflow → agent → email | Generation is config-reachable. **Delivery into the product** needs the missing notification centre (RISK-04); email-only is the pragmatic v1. |

**Phase 2 tally:** A = 1 · B = 2 · C = 5 · D = 3 · E = 0 · **(n = 11)**

### 2.3 PHASE 3 — INTELLIGENT OPERATING SYSTEM

| ID | La Vivenzia Requirement | Twenty supports? | Sup | Cfg | Cus | Maj | DB | BE | FE | 3P | AI | Cx | Relevant Twenty code | Recommended approach | Notes / risks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **LV-P3-01** | Voice lead capture (§48) | No | **D** | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | L | none | **R5+R6** — speech-to-text API + structured extraction agent | No audio capture, no STT anywhere. Mobile capture surface (LV-X-22) is a prerequisite. |
| **LV-P3-02** | Advanced analytics (§53) | Partly | **D** | – | ~ | ✓ | ~ | ✓ | ✓ | ~ | – | L | `dashboard/chart-data/`, `groupBy` query runner | **R3/R5** — dedicated analytics module, possibly a read replica or OLAP store | 4 chart types and no drill-down will not carry §53's seven analysis dimensions. Consider ClickHouse (already a dependency shape Twenty understands) or a BI tool behind an `IFRAME` widget. |
| **LV-P3-03** | Predictive conversion (§55) | No | **D** | – | – | ✓ | ✓ | ✓ | ~ | ~ | ✓ | L | none | **R5+R6** | Needs historical outcome data first. Not startable until Phase 1 has run long enough to produce a training set. |
| **LV-P3-04** | Partner health score (§51) | Substrate only | **C** | ~ | ✓ | – | ~ | ✓ | ~ | – | ~ | M | custom fields + CRON workflow + `code` action | **R2/R3** | 9 input factors; several (revenue, repeat customers, complaints) require data La Vivenzia does not yet hold. |
| **LV-P3-05** | Workflow builder — trigger → condition → action (§57) | **Yes** | **A** | ✓ | – | – | – | – | – | – | – | S | `modules/workflow/` + `twenty-front/src/modules/workflow/` visual builder | **R1** | Fully shipped, visual, versioned, with run history. §57's exact example is expressible today. **Do not rebuild.** |
| **LV-P3-06** | AI forecasting (§55) | No | **D** | – | – | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | L | none | **R5** | Same data-maturity dependency as LV-P3-03. |
| **LV-P3-07** | AI relationship graph — Person ↔ Business ↔ Experience ↔ Location ↔ Team ↔ Lead ↔ Customer (§61) | Relations yes, graph no | **E** | – | – | ✓ | ✓ | ✓ | ✓ | – | ✓ | XL | `MORPH_RELATION` field type, `related-person-ids/` | **R7** — graph store (Neo4j / Postgres recursive CTE / AGE) alongside Postgres | **RISK-06.** `MORPH_RELATION` models the *edges*, but there is no traversal engine, no path query, no graph visualisation. Multi-hop queries over relational tables will not scale to §61's ambition. This is the one true architectural gap. |
| **LV-P3-08** | Advanced integrations (§58) | Framework yes | **C** | ~ | ✓ | – | ~ | ✓ | ~ | ✓ | – | M-L | `application/connection-provider/`, `application-oauth/`, `twenty-apps/public/` (slack, linear, exa…) | **R3+R6** per integration | The framework is genuinely good — 9 real apps ship as reference. Each integration is still its own build. |
| **LV-P3-09** | Automated intelligence / AI autonomy with approval gates (§69) | Substrate yes | **D** | – | ~ | ✓ | ✓ | ✓ | ✓ | – | ✓ | L | `PermissionFlagType` per-tool flags, `ai-agent-role/`, `workflow-actions/ai-agent` | **R5** | The permission scaffolding for §69's autonomy boundary **already exists** (per-tool flags + agent roles). The approval *workflow* and its UI do not. |

**Phase 3 tally:** A = 1 · B = 0 · C = 2 · D = 5 · E = 1 · **(n = 9)**

### 2.4 CROSS-CUTTING / PLATFORM REQUIREMENTS

| ID | La Vivenzia Requirement | Twenty supports? | Sup | Cfg | Cus | Maj | DB | BE | FE | 3P | AI | Cx | Relevant Twenty code | Recommended approach | Notes / risks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **LV-X-01** | Experience Hunter dashboard (§12) | Yes | **B** | ✓ | – | – | – | – | ~ | – | – | M | `dashboard/`, `page-layout/`, `WidgetType` VIEW/GRAPH/RECORD_TABLE | **R2** | The 6 counters and My-Leads table are widgets + saved views. "AI Lead Scanner" button is LV-P2-10. |
| **LV-X-02** | Lead Coordinator dashboard (§14) | Yes | **B** | ✓ | – | – | – | – | – | – | – | M | same | **R2** — 9 saved views surfaced as widgets | "Likely to convert" needs LV-P2-02; "stuck leads" needs LV-X-19. |
| **LV-X-03** | Onboarding Expert dashboard (§21) | Depends | **C** | ~ | ✓ | – | – | ~ | ~ | – | – | M | same | **R2/R3** | Blocked on LV-P1-13's data model. |
| **LV-X-04** | Admin Control Tower (§27) | Partly | **C** | ~ | ✓ | – | – | ✓ | ✓ | – | – | M | `dashboard/`, `groupBy` | **R3** | 5 of its 6 tiles depend on subsystems that don't exist yet (SLA breaches, duplicate candidates, stuck onboardings). |
| **LV-X-05** | Morning Workspace (§66) | No | **C** | – | ✓ | – | ~ | ✓ | ✓ | – | ✓ | M | `page-layout`, FRONT_COMPONENT widget | **R3/R5** | A bespoke landing surface. Buildable as a front component over existing views + an agent. |
| **LV-X-06** | End-of-day intelligence (§67) | No | **C** | – | ✓ | – | ~ | ✓ | ✓ | – | ✓ | M | CRON workflow + agent | **R3** | Pairs with LV-P2-11; same delivery gap (RISK-04). |
| **LV-X-07** | Relationship Memory (§34) | Substrate only | **C** | ~ | ✓ | – | ~ | ✓ | ~ | – | ✓ | M | `ai-agent`, `RICH_TEXT` field, `page-layout-widget` | **R3** | 7 structured sections (background, objections, preferred comms, next step) — store structured, render with a widget. |
| **LV-X-08** | Partner 360° (§52) | Yes | **B** | ✓ | – | – | ~ | – | – | – | – | M | `page-layout-tab/`, relation fields, TIMELINE/TASKS/NOTES/EMAILS/FILES widgets | **R2** | 13 sections map onto tabs + related-record widgets. Revenue/bookings/complaints need source data La Vivenzia doesn't have yet. |
| **LV-X-09** | Experience Quality Intelligence (§50) | No | **D** | – | – | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | L | none | **R5** | 9 evaluation dimensions, explicitly AI-assisted-not-AI-decided. New module. |
| **LV-X-10** | Lead Problem Database (§36) | Via custom object | **B** | ✓ | – | – | ✓ | – | – | – | – | S | `object-metadata/`, SELECT field for the 13 problem types | **R2** | Pure metadata work. |
| **LV-X-11** | AI Root Cause Analysis (§37) | No | **D** | – | – | ✓ | ~ | ✓ | ✓ | – | ✓ | L | `groupBy` runner + agent | **R5** | §37's example ("34% stalled → onboarding clarification") requires cohort analysis Twenty cannot express. |
| **LV-X-12** | Natural-language search (§38) | **No** | **D** | – | – | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | L | `core-modules/search/` is tsvector-only; `record-crud/find-records.service.ts` is the agent-facing query path | **R5** (+**R7** if embeddings) | **RISK-07.** No vector store, no pgvector, no query planner. Two routes: (a) LLM → structured filter over `find-records` (cheaper, matches §38's examples well); (b) embeddings + pgvector (new DB architecture). **Recommend (a) first.** |
| **LV-X-13** | AI CRM Copilot (§39) | Substrate yes | **C** | ~ | ✓ | – | ~ | ✓ | ~ | – | ✓ | M-L | `ai/ai-chat/` (streaming, checkpointing, tool preloading), `record-crud/`, `tool-provider/`, `twenty-front/src/modules/ai/` | **R2/R3** — configure an agent with record tools + La Vivenzia skills | **The chat surface, streaming, tool loop and RBAC-aware data access all exist.** This is far closer than expected. The 10 §39 questions mostly become skills + a few custom tools. |
| **LV-X-14** | AI Management Command Centre (§68) | Substrate yes | **C** | ~ | ✓ | – | ~ | ✓ | ~ | – | ✓ | M | same as LV-X-13 | **R3** | Same substrate, admin-scoped agent, aggregate tools. Depends on LV-P3-02 for the harder analytical questions. |
| **LV-X-15** | Custom fields, admin-created, no coding (§56) | **Yes** | **A** | ✓ | – | – | – | – | – | – | – | S | `metadata-modules/field-metadata/`, Settings → Data Model, `DATA_MODEL` permission flag | **R1** | 25 field types, real DDL migrations. **Do not rebuild.** |
| **LV-X-16** | Custom workflows, configurable (§57) | **Yes** | **A** | ✓ | – | – | – | – | – | – | – | S | `modules/workflow/` | **R1** | See LV-P3-05. |
| **LV-X-17** | Lead assignment engine — 7 factors (§30) | No | **D** | – | – | ✓ | ~ | ✓ | ~ | – | ~ | L | `workflow-actions/code`, `logic-function/` | **R5** | No assignment engine of any kind. Buildable as a logic function invoked by a DATABASE_EVENT workflow. |
| **LV-X-18** | Smart round robin, workload-balanced (§31) | No | **D** | – | – | ✓ | ✓ | ✓ | – | – | – | M | none | **R5** | Requires a workload counter table and concurrency-safe assignment. Part of LV-X-17. |
| **LV-X-19** | SLA engine — 4 rules, breach flagging (§32) | Partly | **D** | – | ~ | ✓ | ✓ | ✓ | ✓ | – | – | L | `CRON` trigger, `delay` action, `record-crud` | **R5** | A CRON workflow can *approximate* it. A real SLA engine (pausable clocks, business hours, escalation ladder, breach history) does not exist. **Underestimating this is a common failure mode.** |
| **LV-X-20** | Notifications — CRM + email + WhatsApp + push, 6 event types (§43) | **No** | **D** | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | XL | **nothing**; only `snack-bar-manager` (toasts) and 12 transactional email templates | **R5** | **RISK-04.** Complete greenfield: notification entity, preferences, fan-out, in-app centre, read state, digests, channel adapters. Several other requirements are inert without it. |
| **LV-X-21** | Email AI — summarise, intent, objections, draft, auto-attach to lead (§45) | Mostly | **B** | ✓ | – | – | – | ~ | – | – | ✓ | M | `messaging/`, `draft-email-tool`, `ai-agent` workflow action, `match-participant/` | **R2/R3** | Email data is already in Postgres and thread-linked. Summarise/intent/draft are agent config. "Attach to correct lead" needs a matcher extension for custom objects. |
| **LV-X-22** | Mobile-first lead capture — 30-second capture (§46, §47) | Responsive only | **D** | – | – | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | XL | `MOBILE_VIEWPORT`, 113 responsive files, PWA manifest — **but no service worker, no camera, no offline queue** | **R5+R6** | **RISK-08.** The CRM is usable on a phone; it is not a mobile capture tool. §46's target implies camera → OCR → confirm → save, offline-tolerant. Consider a dedicated PWA or thin native app hitting the REST API rather than bending `twenty-front`. |
| **LV-X-23** | AI data quality engine — continuous, AI suggests / human confirms (§49) | No | **D** | – | – | ✓ | ✓ | ✓ | ✓ | – | ✓ | L | `findDuplicates` runner is the only related piece | **R5** | 7 detection categories running continuously, each producing a human-confirmable suggestion. New module with its own suggestion queue. |
| **LV-X-24** | Experience Graph — People + Places + Businesses + Experiences + Communities + Relationships + Behaviour + Demand (Final Vision) | No | **E** | – | – | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | XL | none | **R7** | **RISK-06.** The long-term differentiator and the one requirement that genuinely does not fit Twenty's relational, per-workspace-schema model. Treat as a separate system fed by the CRM, not as a CRM feature. |
| **LV-X-25** | Security — RBAC, MFA, encryption, sessions, audit, backups, export controls, restricted deletion, API auth, sensitive-data controls (§62) | Mostly | **B** | ✓ | ~ | – | – | ~ | – | – | – | M | `auth/`, `two-factor-authentication/`, `role/`, `object-permission/`, `field-permission/`, `secret-encryption/`, `session-storage/`, `user-session/`, `api-key/`, `throttler/`, `sql-sanitization/`, `IMPORT_CSV`/`EXPORT_CSV` flags | **R2** mostly | Strong coverage. Gaps: **row-level scoping (RISK-02)**, **full audit trail (RISK-03)**, and backups (an ops concern, not a code one — the Helm chart does not manage them). |
| **LV-X-26** | Funnel visualisation with per-stage drill-down (§54) | No | **C** | – | ✓ | – | – | ~ | ✓ | – | – | M | only 4 chart types; `FRONT_COMPONENT` and `IFRAME` widgets | **R3** — custom front component over `groupBy` | The data is queryable today (`groupBy` on status); only the visualisation is missing. |
| **LV-X-27** | Unique Lead ID — `LV-2026-000124` (§4) | No | **C** | – | ✓ | – | ~ | ✓ | – | – | – | S | no sequence/auto-number field type exists | **R3** — logic function on create + a `TEXT` field, backed by a Postgres sequence | Small but must be concurrency-safe. Do **not** compute it from a row count. |
| **LV-X-28** | Multi-role identity — one person = many roles, one business = many people (§3, §60) | Partly | **C** | ~ | ✓ | – | ✓ | ~ | ~ | – | – | M | `MORPH_RELATION`, `RELATION`, `related-person-ids/`, `person`/`company` | **R2/R3** — a `PersonRole` join object | Twenty models person↔company as a single relation. La Vivenzia's "Villa Owner + Chef + Host + Local Expert" needs an explicit role-assignment object. Metadata work, but the UI for it needs thought. |
| **LV-X-29** | Website → CRM intake — register → verify → classify → create → assign → act (§4) | Partly | **C** | ~ | ✓ | – | – | ✓ | ~ | ~ | ~ | M | `WEBHOOK` trigger, REST API, `workflow-actions/form/`, `server-route-trigger/` | **R2/R3** | The webhook-triggered workflow chain covers most of it. Verification + consent capture + file/image intake need custom handling. |
| **LV-X-30** | Lead lifecycle — 14 main stages + 10 additional statuses (§11) | Yes | **B** | ✓ | – | – | – | – | – | – | – | S | `SELECT` field + `KANBAN` view type + `view-group/` | **R2** | Kanban grouped by status gives the pipeline UI free. Stage-transition rules go in workflows. |
| **LV-X-31** | Internal collaboration — mention, assign, ask help, escalate, note, attach, share (§35) | Mostly | **B** | ✓ | ~ | – | – | – | ~ | – | – | M | `twenty-front/src/modules/mention/`, `note`/`noteTarget`, `task`/`taskTarget`, `attachment` | **R2/R3** | Mentions, notes, tasks and attachments all ship. **Escalation** has no primitive and needs LV-X-20 to be meaningful. |
| **LV-X-32** | Onboarding health score — 76% Ready across 6 dimensions (§25) | No | **C** | – | ✓ | – | ~ | ✓ | ✓ | – | – | M | depends on LV-P1-13 | **R3** | Computation is simple once the onboarding model exists; the breakdown UI is a front component. |
| **LV-X-33** | AI document verification — readability, missing pages, expiry, name mismatch, wrong type (§24) | No | **D** | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | L | `file/`, `attachment` store the files; nothing reads them | **R5+R6** | Depends on LV-P2-10 (OCR). §24's "human approval available" gate should be modelled explicitly, not implied. |
| **LV-X-34** | AI objection handler (§20) | Yes, via agents | **B** | ✓ | – | – | – | – | – | – | ✓ | S | `ai-agent/`, `skill/` | **R2** | An agent plus 4-5 skills, given the lead's profile as context. Genuinely no-code. |
| **LV-X-35** | AI conversation assistant — rough notes → structured CRM data (§18) | Yes, via agents | **B** | ✓ | – | – | – | – | ~ | – | ✓ | M | `ai-agent/` with `AgentResponseFormat` structured output, `record-crud/` | **R2/R3** | Structured output writes straight into the LV-P1-11 Interaction fields. One of the highest-value, lowest-cost AI wins available. |

**Cross-cutting tally:** A = 2 · B = 10 · C = 12 · D = 10 · E = 1 · **(n = 35)**

---

## PART 3 — COVERAGE CALCULATION

### 3.1 Methodology (read this before quoting any number)

1. **Unit of measure.** Each row in Part 2 is one requirement, derived from the founder's blueprint sections and the explicit Phase 1/2/3 lists. Requirements that appear in more than one place in the blueprint are counted **once** and cross-referenced.
2. **Counting is unweighted.** Every requirement counts as 1, regardless of build size. `LV-P1-09 Tasks` (a day of configuration) counts the same as `LV-P1-13 Onboarding workflow` (weeks of engineering).
3. **Scope definitions.**
   - **MVP scope (n = 33)** = the 18 Phase-1 requirements **plus** the 15 cross-cutting requirements Phase 1 cannot ship without: LV-X-01, -02, -03, -04, -15, -16, -17, -19, -20, -25, -27, -28, -29, -30, -31.
   - **Full scope (n = 73)** = all rows in Part 2.
4. **Level → bucket mapping.** "Already available" = A. "After configuration" = A + B. "Requires custom code" = C + D + E. "Major new architecture" = D + E.
5. **Level assignment is a judgement**, made against source code, by one reviewer, in one pass. Rows sitting on a boundary (notably LV-P1-02, LV-P1-05, LV-P1-17, LV-X-19) could defensibly move one level. **Treat every percentage below as ±5 percentage points.**
6. **What these numbers do not measure:** engineering effort, integration risk, data-migration cost, or the cost of the licensing decisions in RISK-02 and RISK-03.

### 3.2 Results — MVP scope (n = 33)

| Bucket | Count | Share |
|---|---|---|
| **A — Twenty covers it already** | 7 | **~21%** |
| **B — reachable by configuration** | 15 | **~45%** |
| **A + B — covered after configuration** | 22 | **~67%** |
| **C — requires custom code on Twenty's substrate** | 7 | **~21%** |
| **D + E — requires substantial new subsystems** | 4 | **~12%** |
| **C + D + E — requires development of some kind** | 11 | **~33%** |

**Answers to the four questions asked:**

- **A. Core CRM requirements already covered by Twenty: ~21%** (7 of 33)
- **B. Covered after configuration: ~67%** (22 of 33, cumulative)
- **C. Requiring custom code: ~33%** (11 of 33)
- **D. Requiring major new architecture: ~12%** (4 of 33 — LV-P1-13 onboarding, LV-X-17 assignment engine, LV-X-19 SLA engine, LV-X-20 notifications)

### 3.3 Results — full scope, all three phases (n = 73)

| Bucket | Count | Share |
|---|---|---|
| A | 9 | ~12% |
| B | 22 | ~30% |
| **A + B** | 31 | **~43%** |
| C | 21 | ~29% |
| D | 19 | ~26% |
| E | 2 | ~3% |
| **C + D + E** | 42 | **~57%** |
| **D + E** | 21 | **~29%** |

### 3.4 The effort caveat — important

The count-based figures **flatter Twenty**, and quoting "67% of the MVP is configuration" without this paragraph would be misleading.

The four D-level MVP requirements — partner onboarding, assignment engine, SLA engine, notifications — are 12% of the requirement *count* but, in this reviewer's judgement, **a large majority of the MVP engineering effort**. Configuration items (create an object, add fields, build a view, write a workflow) are hours-to-days each; those four are weeks each.

**A defensible effort-weighted statement:** roughly **60-70% of MVP requirements are reachable without writing backend code**, but that configuration-reachable work probably represents only **~35-45% of the actual build effort**. This is an estimate from experience, not a measurement, and it is stated as a band deliberately.

**What the count-based number does honestly capture** is the *breadth* of foundation Twenty removes from the backlog: authentication, RBAC, a metadata-driven data model with real migrations, a full record UI, email/calendar sync, a workflow engine, an agent runtime, an API surface in three protocols, an app framework, and ~2,900 tests. None of that has to be built or maintained.

---

# EXECUTIVE SUMMARY

## 1. Is Twenty a suitable foundation for La Vivenzia CRM?

**Yes — with three conditions.**

The fit is better than a normal open-source CRM evaluation would suggest, for one structural reason: **Twenty is not a CRM with an extension mechanism bolted on; it is a metadata-driven application platform that ships a CRM as its reference application.** Objects, fields, permissions, views, layouts, workflows, agents and even frontend components are runtime data, not code. That is exactly the shape La Vivenzia needs, because the blueprint's §56 and §57 (admin-created fields and workflows, no developer) are *requirements* — and they are Twenty's core design assumption.

The three conditions:

1. **Fix the repository provenance first (RISK-01).** There is no `.git` here. Convert to a real fork of `v2.39.0` before writing a line of code, or you forfeit every future security patch.
2. **Resolve the enterprise-licence question before Phase 1 (RISK-02, RISK-03).** Row-level permissions and the platform audit log are behind a signed enterprise key. §40 and §62 depend on both.
3. **Accept that the AI layer is a genuine head start, not a finished product.** Agents, skills, tools, structured output and an RBAC-aware chat runtime exist. The La Vivenzia-specific intelligence — scoring, next-best-action, data quality, root cause — does not.

## 2. What percentage of the MVP is already available?

**~21%** works with no configuration and no code: login and MFA, the timeline, tasks, email/calendar sync, admin controls, custom fields, the workflow builder.

## 3. What percentage can be achieved through configuration?

**~67% cumulative** (~45% additional beyond the already-available 21%): the lead object and its fields, categories, lead profile pages, lifecycle statuses and kanban, follow-up workflows, interaction history, role dashboards, the problem database, Partner 360°, most of the security requirement, and several AI features (classification, summaries, objection handling, conversation structuring) that are agent-and-skill configuration rather than code.

## 4. What percentage requires custom development?

**~33% of the MVP** (~21% C-level, ~12% D-level). Across all three phases, **~57%**.

See §3.4 above: by *effort* rather than count, custom development is the larger half of the MVP.

## 5. What are the biggest missing capabilities?

Ranked by combined impact and effort:

1. **Notification infrastructure (LV-X-20)** — completely absent. Blocks or degrades SLA, follow-ups, assignment, daily brief, escalation.
2. **Partner onboarding system (LV-P1-13)** — Twenty's `onboarding` module onboards *workspace users*, not partners. Largest single Phase-1 build.
3. **Lead assignment engine + smart round robin (LV-X-17, LV-X-18)** — no primitive of any kind.
4. **SLA engine (LV-X-19)** — approximable with CRON workflows; a real one (pausable clocks, business hours, escalation) is a build.
5. **Natural-language search (LV-X-12)** — search is Postgres tsvector. No vector store, no query planner.
6. **OCR / document intelligence (LV-P2-10, LV-X-33)** — zero foundation; but the multimodal AI providers are already wired, so no new vendor is needed.
7. **Mobile-first capture (LV-X-22)** — responsive ≠ a 30-second capture tool. No camera flow, no offline queue.
8. **Fuzzy duplicate detection (LV-P2-03)** — detection is exact-match only. *The merge UI, however, already exists and is good.*
9. **Relationship / Experience Graph (LV-P3-07, LV-X-24)** — the one requirement that does not fit the architecture at all.
10. **Analytics beyond four chart types (LV-P3-02, LV-X-26)** — no funnel, no cohort, no drill-down.

## 6. What should NOT be rebuilt because Twenty already provides it?

Rebuilding any of these would be waste:

- **Authentication and MFA** — `core-modules/auth/`, TOTP is free and ungated.
- **RBAC** — roles, object permissions, **field-level** permissions, 28 permission flags.
- **The metadata/data-model engine** — custom objects and 25 field types with real DDL migrations.
- **The entire record UI** — table, kanban, calendar, list, record pages, filters, sorts, saved views, page layouts. This is the biggest single saving; it is thousands of hours.
- **Timeline / activity history** — including on custom objects.
- **Tasks and notes** with polymorphic targets.
- **Email and calendar sync** — Gmail, Microsoft, IMAP, SMTP, CalDAV, thread linking, participant matching.
- **The workflow engine and its visual builder.**
- **The AI agent runtime** — agents, skills, tools, structured output, RBAC-aware chat, 5 providers.
- **Record merge UI and `findDuplicates`/`mergeMany` plumbing.**
- **CSV import wizard and export.**
- **The API surface** — GraphQL, REST + OpenAPI, MCP, webhooks.
- **Deployment** — Docker Compose, Helm, k8s, health probes, OTel.
- **The test harness** — ~2,900 tests.

## 7. What should be built as La Vivenzia-specific modules?

As a **`lavivenzia-crm` application package** (route R3/R5, using `twenty-sdk` — *not* in core):

| Module | Contains |
|---|---|
| `lv-core` | Lead, Interaction, Problem, PersonRole, Category objects; fields; indexes; roles; page layouts; navigation |
| `lv-notifications` | Notification object, preferences, fan-out service, in-app centre front component, channel adapters |
| `lv-onboarding` | Partner onboarding model, 10-step resumable flow, document gates, health score |
| `lv-assignment` | Assignment engine, workload counters, round robin, reassignment audit |
| `lv-sla` | SLA definitions, clocks, breach detection, escalation ladder |
| `lv-intelligence` | Lead scoring + explainability, next-best-action, data quality suggestions, root cause |
| `lv-capture` | OCR intake, visiting-card/Instagram/website parsers, mobile capture surface |
| `lv-copilot` | La Vivenzia agents, skills library, custom agent tools, NL-search tool |
| `lv-analytics` | Funnel, drill-down, forecasting front components |

## 8. Which Twenty core areas would need modification?

Keep this list as short as possible — every entry is future upgrade pain.

| Area | Why | Avoidable? |
|---|---|---|
| **Row-level permission enforcement** (`metadata-modules/row-level-permission-predicate/`, query runners) | If you do not buy an enterprise licence, §40's assigned-leads-only scoping must be enforced in the query path | **Avoidable by licensing.** Strongly prefer that. |
| **Participant matching** (`modules/match-participant/`) | To auto-link email threads to a custom `Lead` object rather than only `person`/`company` | Possibly extensible via `R3`; verify before forking |
| **Search service** (`core-modules/search/`) | Only if you choose the embeddings route for NL search | Avoidable — use the LLM→filter route (`R5`) instead |
| **Chart types** (`dashboard/chart-data/`) | Only if `FRONT_COMPONENT` widgets prove insufficient for funnels | Avoidable — try `R3` first |

Everything else should be reachable through the application framework. **Discipline here is the difference between a maintainable fork and a dead one.**

## 9. What are the biggest technical risks?

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| **RISK-01** | No git history — this is a source drop, not a clone. No upgrade or patch path. | **Critical** | Re-fork from `twentyhq/twenty` at `v2.39.0` and verify the tree, **before any development** |
| **RISK-02** | Row-level permissions are enterprise-key gated; §40 depends on them | **Critical** | Decide licence vs. custom enforcement now. Do **not** ship view-level filtering as a security control. |
| **RISK-03** | Platform audit log (ClickHouse) is enterprise-gated; `timelineActivity` covers record changes only | **High** | Use `timelineActivity` for §42; build a La Vivenzia audit store for auth/permission/export events |
| **RISK-04** | No notification infrastructure at all | **High** | Budget it as a first-class Phase-1 module, not a late add-on |
| **RISK-05** | No OCR / document intelligence | **Medium** | Use the already-configured multimodal providers; no new vendor needed |
| **RISK-06** | Relationship/Experience Graph does not fit the relational, per-workspace-schema model | **High (long-term)** | Treat as a separate downstream system fed by the CRM. Do not attempt inside Twenty. |
| **RISK-07** | No vector store or NL query planner | **Medium** | Prefer LLM→structured-filter over `find-records`; defer embeddings |
| **RISK-08** | Mobile is responsive-only; §46's 30-second capture has no foundation | **High** | Separate PWA or thin native client against the REST API |
| **RISK-09** | Fork divergence — every core modification compounds upgrade cost across ~2,900 tests | **High** | Enforce the app-framework-first rule; require sign-off for any core change |
| **RISK-10** | AI cost at volume — scoring, summarising and classifying every lead on every change | **Medium** | Model the per-lead token cost before Phase 2; use CRON batching over per-event triggers where possible |
| **RISK-11** | AGPL-3.0 obligations | **Medium** | If the CRM is ever network-accessible to parties outside La Vivenzia, AGPL §13 source-provision duties apply. **Get legal advice before launch**, not after. |
| **RISK-12** | Custom AI providers gated above 25 seats | **Low** | Free below 25 users; factor the licence into headcount planning |

## 10. Recommendation

### **D — Hybrid approach.** Specifically: **fork for hygiene, extend by discipline.**

Assessed against the four options:

- **A. Fork Twenty** — necessary but insufficient on its own. A fork you then edit freely becomes unupgradeable within a year.
- **B. Extend using the app framework only** — insufficient. At minimum the row-level permission decision, and probably participant matching, cannot be resolved from outside core.
- **C. Use as inspiration, build separately** — **strongly discouraged.** It would mean rebuilding the metadata engine, the record UI, RBAC, email sync, the workflow engine and the agent runtime. That is a multi-year effort to arrive at a worse version of what is already in this folder.
- **D. Hybrid** — **recommended.**

**The rule that makes D work:**

> Everything goes in the `lavivenzia-crm` application package. A change to `packages/twenty-*` core requires explicit sign-off, a written justification, and an entry in a `CORE-MODIFICATIONS.md` ledger recording what was changed, why the app framework could not do it, and how to re-apply the change on upgrade.

---

## RECOMMENDED ARCHITECTURE FOR LA VIVENZIA CRM

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENTS                                                             │
│  twenty-front (unmodified, + LV front components)                    │
│  LV Capture PWA  (separate; camera → OCR → REST)   [RISK-08]         │
└───────────────┬──────────────────────────────────────────────────────┘
                │ GraphQL · REST · MCP
┌───────────────▼──────────────────────────────────────────────────────┐
│  TWENTY CORE  — forked from v2.39.0, modified as little as possible   │
│                                                                      │
│  auth + MFA │ RBAC │ metadata engine │ twenty-orm │ workflow engine   │
│  agent runtime (agents · skills · tools) │ messaging + calendar sync  │
│  timeline │ tasks/notes │ search │ dashboards │ files │ app framework │
└───────────────┬──────────────────────────────────────────────────────┘
                │  app manifest: objects · fields · roles · agents ·
                │  logic functions · front components · layouts
┌───────────────▼──────────────────────────────────────────────────────┐
│  lavivenzia-crm  APPLICATION PACKAGE   ← nearly all LV work lives here │
│                                                                      │
│  lv-core          Lead · Interaction · Problem · PersonRole ·        │
│                   Category · Onboarding objects, roles, layouts      │
│  lv-notifications Notification centre + channel fan-out   [RISK-04]  │
│  lv-onboarding    10-step partner flow · doc gates · health score    │
│  lv-assignment    7-factor engine · workload round robin             │
│  lv-sla           clocks · breach detection · escalation             │
│  lv-intelligence  scoring + explainability · NBA · data quality      │
│  lv-capture       OCR intake · card/IG/website parsers               │
│  lv-copilot       LV agents · skills library · NL-search tool        │
│  lv-analytics     funnel · drill-down · forecasting components       │
└───────────────┬──────────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────────┐
│  DATA & SERVICES                                                     │
│  PostgreSQL (core schema + per-workspace schemas)                    │
│  Redis (cache · BullMQ · pub/sub)                                    │
│  S3 (files · documents · images)                                     │
│  ClickHouse            — analytics + LV audit store  [RISK-03]       │
│  Graph store (Phase 3) — Experience Graph, separate  [RISK-06]       │
│                                                                      │
│  External: LLM providers (OpenAI/Anthropic/Google — already wired) · │
│  WhatsApp Business API · Google Workspace · Instagram · payments     │
└──────────────────────────────────────────────────────────────────────┘
```

### Sequencing

**Phase 0 — before any feature work (1-2 weeks)**
1. Re-fork from `twentyhq/twenty` at `v2.39.0`; verify this tree matches; establish the upstream remote and an upgrade cadence.
2. Decide the enterprise-licence question (RISK-02, RISK-03). This gates the §40 and §62 designs.
3. Scaffold `lavivenzia-crm` with `create-twenty-app`; get an empty app installing into a local instance.
4. Get legal advice on AGPL-3.0 §13 (RISK-11).
5. Create `CORE-MODIFICATIONS.md` and the sign-off rule.

**Phase 1 — Core CRM**
Configuration-led (objects, fields, roles, layouts, views, workflows), then the four builds: notifications, onboarding, assignment, SLA. **Start notifications early** — four other requirements depend on it.

**Phase 2 — AI CRM**
Configuration-first again: classification, summaries, objection handling and conversation structuring are agent + skill work. Then the builds: scoring explainability, fuzzy duplicates, OCR, next-best-action.

**Phase 3 — Intelligent OS**
Requires historical data from Phases 1-2 before prediction and forecasting are meaningful. Treat the Experience Graph as a separate downstream system from the outset.

---

## APPENDIX — VERIFICATION COMMANDS

Every finding above is reproducible. Representative commands used:

```bash
# Version and provenance
cat packages/twenty-server/src/engine/core-modules/upgrade/constants/twenty-current-version.constant.ts
git -C . rev-parse HEAD                       # → "not a git repository"

# Standard objects (32)
find packages/twenty-server/src -name "*.workspace-entity.ts" | wc -l

# Field types (25)
cat packages/twenty-shared/src/types/FieldMetadataType.ts

# Permission flags (28) and enterprise gating
cat packages/twenty-shared/src/constants/PermissionFlagType.ts
grep -rl "@license Enterprise" packages/ --include=*.ts --include=*.tsx | wc -l   # → 352
grep -rn "hasValidEnterprisePlan" packages/twenty-server/src/engine/metadata-modules/row-level-permission-predicate/

# Audit log gating
grep -rn "requiresEntitlement" packages/twenty-server/src/engine/core-modules/event-logs/registry/event-log-registry.ts
sed -n '138,150p'  packages/twenty-server/src/engine/core-modules/event-logs/event-logs.service.ts

# Workflow triggers and actions
cat packages/twenty-server/src/modules/workflow/workflow-trigger/types/workflow-trigger.type.ts
ls packages/twenty-server/src/modules/workflow/workflow-executor/workflow-actions/

# AI providers, tools, agents
python -c "import json;print(list(json.load(open('packages/twenty-server/src/engine/metadata-modules/ai/ai-models/ai-providers.json')).keys()))"
ls packages/twenty-server/src/engine/core-modules/tool/tools/

# Absence proofs
grep -rIl -w "OCR" packages/twenty-server/src packages/twenty-front/src packages/twenty-shared/src | wc -l   # → 0
grep -rn "Notification" packages/twenty-server/src --include=*.entity.ts --include=*.workspace-entity.ts     # → none
grep -rIn -i "whatsapp" packages/twenty-server/src   # → only a dev-seeder custom-field label

# Widget and chart types
cat packages/twenty-shared/src/types/page-layout/WidgetType.ts
cat packages/twenty-shared/src/types/page-layout/graph-widget-configuration-type.ts

# App framework surface
ls packages/twenty-apps/examples/document-generator/src/
ls packages/twenty-server/src/engine/core-modules/application/

# Test counts
find packages/twenty-server/src -name '*.spec.ts' | wc -l                 # → 1088
find packages/twenty-server/test -name '*integration-spec.ts' | wc -l     # → 618
find packages/twenty-front/src \( -name '*.test.ts' -o -name '*.test.tsx' \) | wc -l   # → 1148
```

---

*End of audit. No production code, schema, package file, UI or branding was modified. Nothing was committed.*
