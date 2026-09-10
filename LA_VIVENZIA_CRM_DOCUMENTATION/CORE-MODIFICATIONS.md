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
