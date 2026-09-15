# Twenty Core Modifications Register

Core modification is an exception.

Every entry must include date, requirement, why app/configuration is insufficient, files changed, risk, tests, rollback plan, reviewer and issue/PR.

Preferred path: requirement → inspect primitive → configure → app extension → workflow → integration → core modification only if still necessary.

Current status: **two approved modifications — CM-001 (product rebrand), CM-002 (Windows path separators).**

---

## CM-001 — Rebrand the product surface from Twenty to La Vivenzia CRM

| | |
|---|---|
| **Date** | 2026-09-09 |
| **Requested by** | Karan Patil (founder-side instruction: the Twenty name must not remain anywhere, including Docker) |
| **Reviewer** | *pending* |
| **Issue / PR** | *pending* |

### Requirement

No user-visible surface may present the product as "Twenty". This covers the
browser title, the installable app name, transactional emails in every locale,
Docker Compose, the Helm chart and the repository README.

### Why an app extension is insufficient

Product branding lives in the platform shell, not in application metadata. The
browser title, PWA manifest, email templates and deployment descriptors are all
owned by `twenty-front`, `twenty-emails` and `twenty-docker`. An application
package can name itself, but it cannot rename the host product. There is no
configuration hook for any of these strings.

### Files changed

| File | Change |
|---|---|
| `packages/twenty-front/index.html` | `<title>`, `og:title`, `twitter:title`, description; social-card URL repointed off the upstream GitHub asset to a local icon; runtime-env markers renamed |
| `packages/twenty-front/scripts/inject-runtime-env.sh` | Renamed in lockstep with `index.html`. **These markers are functional** — the script `sed`s on `<!-- BEGIN/END: … Config -->` and the `id="…-env-config"` element to inject runtime environment variables into the built page. Renaming one file without the other silently breaks env injection in Docker. |
| `packages/twenty-front/public/manifest.json` | PWA `name` / `short_name` |
| `packages/twenty-emails/src/components/{BaseHead,Footer,Logo,WhatIsTwenty}.tsx` | Visible strings and `aria-label`s |
| `packages/twenty-emails/src/emails/*.tsx` (4 files) | Body copy naming the product |
| `packages/twenty-emails/src/locales/*.po` (33) | `msgid` realigned to the new source strings; `msgstr` rebranded in place, preserving each language's grammar |
| `packages/twenty-emails/src/locales/generated/*.ts` (33) | Compiled catalogues kept in step with the `.po` sources |
| `packages/twenty-docker/docker-compose.yml` | Compose project `name`; image repointed to `${LV_IMAGE:-lavivenziacrm/lavivenzia-crm}` **with a `build:` context added** |
| `packages/twenty-docker/docker-compose.dev.yml` | Compose project `name` |
| `packages/twenty-docker/helm/twenty/` → `helm/lavivenzia-crm/` | Directory renamed |
| `.../helm/lavivenzia-crm/Chart.yaml` | Chart `name`, `description`; upstream `icon` URL removed |
| `.../helm/lavivenzia-crm/values.yaml` | `image.repository` |
| `.../helm/lavivenzia-crm/{QUICKSTART,README}.md`, `templates/NOTES.txt` | Documentation |
| `README.md` | Replaced with a La Vivenzia README carrying the attribution notice |

### Deliberately NOT changed, and why

- **Package directory and import names** (`twenty-server`, `twenty-shared/utils`, …)
  — over 60,000 occurrences across the monorepo. These are code identifiers, not
  branding; renaming them breaks every import path and the entire build while
  changing nothing a user sees.
- **`LICENSE`** — untouched. AGPL-3.0 requires the licence and upstream copyright
  notices to be preserved in modified distributions. Removing them would be a
  licence violation, not a rebrand.
- **`.github/TRADEMARK.md`** — retained. It records Twenty's trademark position,
  which continues to apply to the upstream project.
- **Helm template helper identifiers** (`twenty.fullname`, `twenty.name`) — internal
  template function names. `twenty.name` resolves from `.Chart.Name`, so renaming
  the chart already makes every deployed Kubernetes resource `lavivenzia-crm-*`.
  Renaming the helpers themselves is cosmetic and risks breaking the chart.
- **Grafana datasource `twenty_clickhouse` / `twenty_dev`** — these are live
  hostnames and database names, not labels. Changing them breaks the connection
  unless the corresponding services are renamed too.

### Risk

**Medium.**

1. **Upgrade conflicts.** Every file above will conflict on the next upstream
   merge. All changes are string-level and confined to branding, so conflicts
   should be mechanical, but they are guaranteed.
2. **Docker image no longer pulls.** `lavivenziacrm/lavivenzia-crm` is published
   nowhere. A `build:` context was added so `docker compose build` produces it
   locally; a real deployment must build and push this image, or set `LV_IMAGE`
   back to a registry that exists. **Renaming the image without the build block
   would have silently broken `docker pull` — this is why the build context is
   part of the change, not an optional extra.**
3. **Legal.** Rebranding a modified AGPL distribution is permitted and is
   generally the *correct* action, since presenting a fork as official upstream
   software is what trademark policy prohibits. Copyright notices and the licence
   are preserved. **A lawyer should still confirm before any public launch**, and
   the AGPL §13 network-use obligation is unaffected by the rename.

### Tests

- `nx test twenty-shared` — 234 suites / 1,882 tests, unaffected.
- `nx lint twenty-front`, `nx lint twenty-server` — clean.
- `docker compose config` on both Compose files — valid.
- La Vivenzia application suite — 294 tests, typecheck and build clean.
- **Not covered:** no automated test asserts branding. Email rendering across 33
  locales was verified by catalogue inspection (0 remaining `Twenty` strings in
  either `.po` or compiled catalogues), not by rendering each template.

### Defect found and fixed during this change

The catalogue sweep rebranded every `msgid` before two source strings had been
rebranded — `'Join your team on Twenty'` and the account-verification body. Since
a Lingui `msgid` **is** the lookup key, those two would have missed their
translations in all 33 locales and fallen back to English text still reading
"Twenty". Both source strings were corrected to match the rebranded keys, and
alignment was re-verified.

This is the specific hazard of rebranding a translated product: source strings
and catalogue keys must move together, or the rename silently breaks
localisation. Any future brand change must edit both sides in one pass.

### Rollback plan

Every change is a string edit or a directory rename, and no schema, API or
behaviour changed. To roll back:

1. `git revert` the rebrand commit (once the repository has Git — see BLOCKER-01).
2. `mv packages/twenty-docker/helm/lavivenzia-crm packages/twenty-docker/helm/twenty`.
3. The upstream README was preserved at `/tmp/README.upstream.bak` during this
   session; recover it from upstream if that scratch copy is gone.

No data migration is involved, so rollback is safe at any time.

---

## CM-002 — Windows path separators in storage keys and manifest paths

| | |
|---|---|
| **Date** | 2026-09-09 |
| **Requested by** | Not requested — required to install the application at all |
| **Reviewer** | *pending* |
| **Issue / PR** | *pending — should be reported upstream* |

### Requirement

`twenty apply` could not install the La Vivenzia application on Windows. Every
file upload was refused with *"Resource path must not contain backslashes"*, and
after that was cleared the manifest sync was refused with *"File folder
built-logic-function\src\... is not allowed"*.

### Root cause

Three places build a path with `path.join` / `path.relative` and then use it as
an **identifier** — a storage key, or a value persisted in the manifest and
validated server-side. Those APIs are backslash-separated on Windows. On Linux
the bug is invisible, which is why it survives upstream.

### Files changed

| File | Change |
|---|---|
| `packages/twenty-server/src/engine/core-modules/file-storage/services/file-storage.service.ts` | `join()` → `posix.join()` for `resourcePath` and `onStoragePath`. **This is the root cause of the failure that also broke `workspace:seed:dev` earlier in the project.** |
| `packages/twenty-sdk/src/cli/utilities/file/file-uploader.ts` | Added `toResourcePath()`; three call sites normalised to POSIX |
| `packages/twenty-sdk/src/cli/utilities/build/manifest/manifest-build.ts` | Added `toManifestPath()`; normalises `sourceHandlerPath`, `builtHandlerPath`, `sourceComponentPath`, `builtComponentPath` |

### Why an app extension is insufficient

These are platform code paths executed before any application code runs. An
application cannot influence how the CLI serialises its own manifest or how the
server derives a storage key.

### Risk

**Low.** POSIX separators are correct on every platform for these values — they
are keys and identifiers, never filesystem paths handed to the OS. Behaviour on
Linux is unchanged, because `path.join` already produced `/` there.

The changes are additive helpers plus call-site substitutions; no signature,
schema or API changed.

### Tests

- `nx test twenty-shared` — 1,882 tests, unaffected.
- Application install now succeeds: 602 metadata entities created, 0 errors.
- 8 integration tests pass against the live server with the app installed.
- **Not covered:** no regression test asserts POSIX output. Upstream would want
  one; on Linux CI it would pass with or without the fix, so the test would need
  to force the Windows separator.

### Rollback plan

Revert the three files. The application then cannot be installed from a Windows
machine, but Linux and CI are unaffected.

### Recommendation

**Report upstream.** This is a genuine cross-platform defect in Twenty, not a La
Vivenzia concern, and carrying the patch in a fork is worse than having it
merged. Three further Windows issues were found but NOT patched, and are
recorded in `docs/LA-VIVENZIA-BUILD-AUDIT.md`.

---

## CM-003 — Windows-safe linking in the logic function executor

| | |
|---|---|
| **Date** | 2026-09-10 |
| **Requested by** | Not requested — no logic function could execute at all |
| **Reviewer** | *pending* |
| **Issue / PR** | *pending — should be reported upstream* |

### Requirement

Every La Vivenzia logic function failed on every invocation. Lead assignment,
assignment history, notifications, interaction processing and follow-up task
creation had therefore **never run once**, despite their triggers being
correctly registered.

### Root cause

The failure was not registration, queueing, worker startup, handler discovery
or dependency injection. The queues showed the opposite of the assumed
"enqueued but not consumed":

| Queue | completed | failed |
|---|---|---|
| `trigger-queue` | 31 | 0 |
| `logic-function-queue` | **0** | **11** |

The worker consumed every job and every job threw the same error:

```
EPERM: operation not permitted, symlink
  '…\logic-function-executor-tmpdir\deps\default\node_modules\.yarn-state.yml'
→ '…\lambda-build-<uuid>\node_modules\.yarn-state.yml'
```

`local-child-process-runner.service.ts` assembles each function's
`node_modules` with `fs.symlink`. On Windows, creating a symlink requires
`SeCreateSymbolicLinkPrivilege` — Administrator, or Developer Mode enabled. An
ordinary server process has neither, so the call fails and the handler is never
imported. On Linux the same code is correct, which is why it survives upstream.

### Why an app extension is insufficient

This is platform code that runs *before* any application code is loaded. The
application cannot influence how the server materialises its own execution
sandbox.

### Files changed

| File | Change |
|---|---|
| `packages/twenty-server/src/engine/core-modules/logic-function/logic-function-drivers/drivers/local/services/local-child-process-runner.service.ts` | Added `linkModuleEntry()` and `resolveIsDirectory()`. POSIX keeps `fs.symlink` exactly as before. Windows uses a **junction** for directories and a **hard link** for files, falling back to `copyFile` across volumes. |

`resolveIsDirectory` follows a symlinked package before choosing, because
`readdir` reports a symlink as "not a directory" and hard-linking a directory
fails.

### Alternative considered and rejected

Enabling Windows Developer Mode, or running the server elevated, would also fix
it. Both were rejected: they are machine configuration rather than a fix, they
do not help the next developer or CI runner, and elevating a server process to
work around a file-linking detail is worse than the bug.

### Risk

**Low.** Behaviour on Linux and in Docker is byte-identical — the POSIX branch
is the original code path. Junctions and hard links resolve identically to
symlinks for Node's module loader. No signature, schema or API changed.

### Tests

- Application unit suite: **654 tests pass**, typecheck clean, lint clean.
- Real execution, which is what actually matters here: a lead created through
  the GraphQL API is now routed end to end — `logic-function-queue` went from
  0 completed / 11 failed to **8 completed**, and the database gained owners,
  assignment history and notifications for the first time.
- **Not covered:** no regression test asserts the Windows branch. On Linux CI
  such a test passes with or without the fix, so it would have to force the
  platform check.

### Rollback plan

Revert the single file. Logic functions then work on Linux and in Docker, and
fail on Windows exactly as before.

### Recommendation

**Report upstream**, together with CM-002. This is a genuine cross-platform
defect in Twenty, and it is more severe than CM-002: CM-002 blocked
installation, this one silently disabled every application's automation.

---

## CM-004 — Application-level record scoping and server-resolved actor identity

| | |
|---|---|
| **Date** | 2026-09-11 |
| **Requested by** | Remediation 3: "Authorization MUST happen server-side… Do NOT use Twenty's paid RLS" |
| **Reviewer** | *pending* |
| **Issue / PR** | *pending* |

### Requirement

Any authenticated member could read every lead, every onboarding and every
partner identity document. Twenty's row-level predicates would fix this but
are licensed Enterprise (`resolve-row-level-permission-record-filter.util.ts`
carries the `@license Enterprise` banner) and La Vivenzia has decided not to
depend on any paid feature.

### Why an app extension is insufficient — verified, not assumed

A Twenty application can hook exactly three things: cron, database events
(after the fact) and HTTP routes (`packages/twenty-sdk/src/sdk/define/logic-functions/triggers/`).
**It cannot intercept a record read.** Anything that must filter rows *before*
they are returned has to run inside the ORM. There is no app-only path.

### What changed

**A. Record scoping — `lv-record-scope.util.ts` (new) + `workspace-repository.ts`**

A La Vivenzia scoping rule evaluated at the same choke point as the Enterprise
predicate (`applyRowLevelPermissionPredicateForAlias`), so it covers the main
alias and every join, on select/update/delete, for GraphQL, REST, the metadata
API and internal services alike. **It shares no code with the Enterprise path.**

| Object | Visible when |
|---|---|
| `lvLead` | `ownerId` = caller, or NULL (unassigned must stay pickable) |
| `lvOnboarding` | `reviewerId` = caller, or NULL |
| `lvInteraction` | `actorId` = caller, or NULL |
| `lvNotification` | `recipientId` = caller — **never** NULL (a notification with no recipient is an error, not a broadcast). Added Day 4A. |
| `lvOnboardingDocument` | its onboarding is visible — via `EXISTS` subquery, so a guessed file id reaches nothing |

Governed roles: Experience Hunter, Lead Coordinator, Onboarding Expert,
Experience Team, Marketing. Unscoped: Main Admin, Operations, Management (read
oversight of the whole pipeline; its role denies every write). Callers with no
LV role — Twenty Admin, API keys, the app role — are untouched and remain
constrained by object permissions.

**Fail closed:** a governed caller with no resolved member gets `WHERE FALSE`,
never everything.

Policy is keyed on role **universal identifiers** (stable, declared by the
manifest), translated from per-workspace role ids via a map added to
`ORMWorkspaceContext` / `WorkspaceInternalContext`, populated from the
already-cached `flatRoleMaps` in `workspace-orm.manager.ts`.

**B. Actor identity — `LogicFunctionEvent.workspaceMemberId`**

Route handlers previously had to trust a body-supplied `actorWorkspaceMemberId`.
The platform already resolves the session's member; it is now carried into the
event (`twenty-shared/.../LogicFunctionEvent.ts`, `route-trigger.service.ts`,
`logic-function-trigger.service.ts`, `build-logic-function-event.util.ts`).
LV routes use it as the only actor and ignore identity fields in the body.

### Files changed

| File | Change |
|---|---|
| `twenty-orm/utils/lv-record-scope.util.ts` | **new** — the policy, 100% LV-owned |
| `twenty-orm/repository/workspace-repository.ts` | `applyLvRecordScopeForAlias`, called from the existing per-alias hook |
| `twenty-orm/storage/orm-workspace-context.storage.ts` | `lvRoleUniversalIdentifierByRoleId` |
| `twenty-orm/interfaces/workspace-internal-context.interface.ts` | same |
| `twenty-orm/datasource/workspace-data-source.service.ts` | pass-through |
| `twenty-orm/workspace-orm.manager.ts` | fetch `flatRoleMaps`, build the map (both loaders) |
| `twenty-shared/src/types/LogicFunctionEvent.ts` | `workspaceMemberId: string \| null` |
| `.../route/route-trigger.service.ts` | extract from auth context |
| `.../logic-function-trigger.service.ts`, `.../build-logic-function-event.util.ts` | thread it through |
| `.../__tests__/build-logic-function-event.util.spec.ts` | expectation updated + new case |
| `twenty-orm/utils/__tests__/lv-record-scope.util.spec.ts` | **new** — 13 policy tests incl. fail-closed, SQL-injection and notification scoping |

### Risk

**Medium.** This is authorization code in the query path.

- Applies only to objects listed in `LV_SCOPED_OBJECTS` / `LV_PARENT_SCOPED_OBJECTS`
  and only to callers holding an LV team role. Everything else is byte-identical.
- A parameter is bound (`:alias_lvActor`), never interpolated — covered by a test.
- `flatRoleMaps` is one more cached map on the hot path; it is already cached
  per workspace and used elsewhere.
- Upgrade conflicts are guaranteed in `workspace-repository.ts` and the two
  context types.

### Tests

- Core: 78 specs pass across the touched files, including 11 new for the policy.
- App: 722 unit tests pass.
- **Live, against the running server with a real user session** (see TESTING-QA.md):
  13/13 scope checks, 8/8 impersonation checks, 5/5 scoped-creator assignment
  checks, 29/29 regression checks.

### Rollback plan

Revert the eleven files. Row visibility returns to object-level only; routes
return to trusting the body's actor. Both are the pre-Remediation-3 state.

### Amendment — Day 4A (notifications)

`LvScopeRule` gained an optional `includeNull` flag (default `true`, preserving
every existing rule) and `LV_SCOPED_OBJECTS` gained
`lvNotification: { ownerColumn: 'recipientId', includeNull: false }`. Without it
a governed role could read every team member's notifications — and the
notification centre would have been "hiding" rows in the front end, which is
exactly what SECURITY-RBAC.md forbids. Two specs cover the new rule. No other
core file changed for Day 4A; the notification system itself is entirely in the
application (`packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-notifications`).

Verified live: a Hunter cannot list, fetch by id, or mark read another member's
notification; an unscoped Main Admin can read all (see TESTING-QA.md).

### Amendment — Day 4B (SLA)

`LV_SCOPED_OBJECTS` gained `lvSla: { ownerColumn: 'ownerId' }` (NULL visible,
matching the lead rule it mirrors). Two specs added (15 total). Nothing else
in core changed for Day 4B; the SLA engine is entirely in the application
(`modules/lv-sla`). Verified live: Hunter/reviewer isolation on SLAs, unscoped
admin sees all.

### A limitation worth stating plainly

Role changes made **outside** `updateWorkspaceMemberRole` (for example, a
direct SQL update) do not invalidate Twenty's in-process role cache; the old
role stays in effect until restart. This is Twenty's caching, not CM-004, but
CM-004 makes the consequence visible. Assign roles through Settings or the API.

---

## CM-005 — La Vivenzia visual identity for the Twenty shell

| | |
|---|---|
| **Date** | 2026-09-15 (Day 7B) |
| **Requested by** | Day 7B brief: "Transform the employee-facing CRM from a default-Twenty look into a premium La Vivenzia product… remove demo identity" |
| **Reviewer** | *pending* |
| **Issue / PR** | *pending* |

### Requirement

Everything La Vivenzia builds runs inside Twenty's shell: sidebar, top bar,
record tables, record pages, sign-in. An application can theme its own front
components (and does — see `lv-core/ui`), but it cannot change the colours,
type face or branding of the shell around them. Without this change the
product read as "Twenty with green cards": Inter, indigo accents, grey
surfaces, a "20" logo on the sign-in page, "Welcome, Apple", and Twenty's
terms of service in the footer.

### Why an app extension is insufficient

Twenty's theme is a set of CSS custom properties (`--t-*`) declared on the
`.light` / `.dark` root classes (`twenty-ui/theme-light.css`,
`theme-dark.css`) and read back at runtime by `ThemeProvider`. Nothing in the
application SDK reaches the host document's stylesheet, the workspace default
logo, the sign-in copy or the PWA icons.

### What changed — presentation only, no component forked

| File | Change |
|---|---|
| `packages/twenty-front/src/lv/lv-theme.css` (new) | Imported after the two twenty-ui theme files. Declares the `--lv-*` semantic tokens (generated from the application's `tokens.ts`; a unit test keeps them identical) and **redefines the `--t-*` tokens the shell is built from**: the neutral scale (warm ivory / deep pine instead of grey), the accent scale (pine green instead of indigo), font family (Sora), shadows, snackbar and focus colours. Every Twenty primitive restyles itself through its tokens. |
| `packages/twenty-front/src/index.tsx` | One import line for the stylesheet above. |
| `packages/twenty-front/public/fonts/lv/` (new) | Self-hosted Cinzel and Sora (variable, latin + latin-ext, WOFF2, SIL Open Font License — licence files included). No font CDN is contacted. |
| `packages/twenty-front/public/images/lv/` (new) | The La Vivenzia mark and lockup, from the approved brand assets. |
| `packages/twenty-front/public/images/icons/**` | Every PWA / favicon icon regenerated from the mark (pine tile, gold mark). Same file names and sizes; `manifest.json` untouched. |
| `modules/ui/navigation/navigation-drawer/constants/DefaultWorkspaceLogo.ts` | Default workspace logo → `/images/lv/logo-mark.png` (was Twenty's placeholder on GitHub Pages). |
| `pages/auth/SignInUp.tsx` | Titles: "Welcome to La Vivenzia CRM" (global scope), "Welcome back" / "Welcome to {workspace}" (workspace scope). Was "Welcome to Twenty" / "Welcome, {workspace}." |
| `modules/auth/components/Title.tsx` | Sign-in title set in the display face and the LV heading colour (falls back to the Twenty tokens if the LV variables are absent). |
| `modules/auth/sign-in-up/components/FooterNote.tsx` | The links to twenty.com's terms, DPA and privacy policy replaced by an internal-use notice. Those agreements are Twenty's, for Twenty's hosted service; they do not bind users of a self-hosted La Vivenzia system. The "Bypass SSO" control is kept. |
| `modules/activities/timeline-activities/utils/getTimelineActivityAuthorFullName.ts` (+ its test) | System-authored timeline events attributed to "La Vivenzia CRM" instead of "Twenty". |
| `pages/not-found/NotFound.tsx` | Page title suffix. |

### Deliberately NOT changed, and why

- **No Twenty React component is forked or restructured.** The sidebar, header,
  tables, record pages, dialogs and menus are upstream code reading new token
  values. This keeps the next Twenty upgrade a merge, not a rewrite.
- **Settings pages** still mention Twenty in places (billing, MCP setup,
  community, the legal DPA generator). They are admin-only, most are
  irrelevant to a self-hosted install, and rewording them buys nothing for
  employees. Listed as a remaining gap in DAY_7B_DESIGN_SYSTEM.md.
- **`twenty-ui/theme-*.css` themselves** are untouched; the overrides live in
  one LV file so a diff against upstream stays trivial.
- **Workspace name and logo** are data, not code: `scripts/brand-workspace.mjs`
  in the application sets them through the ordinary admin API.

### Risk

Low. The change is CSS variables and copy. If `lv-theme.css` fails to load the
shell falls back to Twenty's own theme and every LV component still renders
(the components carry their tokens inline). The only behavioural change is the
sign-in footer no longer linking to Twenty's legal pages — a founder decision
on employee legal pages is still open.

### Tests

- `lv-core/ui/__tests__/tokens.test.ts` asserts the `--lv-*` blocks in
  `lv-theme.css` are byte-identical to the application's tokens, that the font
  files and licences exist, that no font CDN is referenced, and WCAG AA
  contrast for text, status colours and focus rings in both schemes.
- `getTimelineActivityAuthorFullName.test.ts` updated for the new label.
- Visual verification in Chromium (light / dark, 390 / 1440) is recorded in
  TESTING-QA.md.

### Rollback plan

Remove the import line in `index.tsx` and delete `src/lv/`; revert the seven
edited files and the icon folder with `git checkout`. No data migration is
involved.

### Amendment — same day

Two more presentation-only touches, same rationale and rollback:

| File | Change |
|---|---|
| `modules/auth/components/Logo.tsx` | On a single-product install the workspace logo *replaces* the default product icon on the sign-in page rather than sitting on it as a badge (both are the La Vivenzia mark). Instances with a custom primary logo keep the badge. |
| `modules/object-record/record-table/empty-state/utils/getEmptyStateSubTitle.ts` | Empty-list subtitle no longer says "Use our API or add … manually". |
| `src/lv/lv-theme.css` | Twenty's blue empty-state illustrations are tinted toward pine with a CSS filter; the PNG assets are untouched. SELECT option chips (the `--t-tag-*` palette) are remapped to muted, brand-harmonious tints with AA text contrast in both schemes. |
