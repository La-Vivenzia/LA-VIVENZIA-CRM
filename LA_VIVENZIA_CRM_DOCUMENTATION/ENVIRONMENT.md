# Environment

Use a clean Git fork of the selected Twenty baseline.

Workflow: clone/fork → confirm baseline → install → start infrastructure → configure local env → verify unchanged Twenty → add LV modules incrementally → test → commit small logical units.

Environments: local, development, staging, production.

Secrets include DB, Redis, OAuth, email, AI, storage, webhooks and encryption keys. Never commit secrets.

Production requires backups, restore tests, monitoring, alerting, error tracking, migration runbook, rollback runbook and incident response.


## Cron-triggered logic functions need the scheduler registered (found Day 4B)

Twenty runs cron-triggered logic functions through a BullMQ repeatable job
(`CronTriggerCronJob`, every minute) that must be registered **once per
environment**:

```
cd packages/twenty-server
node dist/command/command cron:trigger:start-cron-trigger
```

(`cron:register:all` registers every Twenty cron, including trash cleanup and
billing reminders — use it for production, not for a dev box.) Until this is
done, `lv-expire-documents`, `lv-follow-up-reminders` and `lv-sla-evaluator`
never fire on schedule, although they run fine on demand. Check with
`redis-cli keys 'bull:cron-queue:repeat*'`.

## Front components need the renderer built (found Day 4A)

Twenty renders application front components through
`packages/twenty-front-component-renderer`, which the Vite dev server imports
from its `dist/`. A fresh checkout has no `dist/`, and the import fails silently
until a page with a front component is opened (a red Vite overlay:
"Failed to resolve import twenty-front-component-renderer"). Build it once:

```
cd packages/twenty-front-component-renderer
npx tsx -r tsconfig-paths/register scripts/front-component-sandbox/build-sandbox-document.ts
npx vite build
```

then restart the front-end dev server. Both generated outputs are gitignored.

## AI provider is optional (Day 6)

The AI layer is configured from the application's own variables (Settings →
Applications → La Vivenzia CRM): `LV_AI_PROVIDER` (`openai` — the default
when a key is set — `anthropic`, `openai-compatible`, or `none`),
`LV_AI_API_KEY` (secret), and optional `LV_AI_BASE_URL`, `LV_AI_MODEL`,
`LV_AI_TIMEOUT_MS`, `LV_AI_MAX_OUTPUT_TOKENS`, `LV_AI_MAX_RETRIES`,
`LV_AI_TEMPERATURE`. No key = every model feature reports `AI_UNAVAILABLE`
and the rest of the CRM (including the rules-based intelligence and the
structured Copilot) is unaffected. Twenty's own `OPENAI_API_KEY` /
`ANTHROPIC_API_KEY` server variables are not used by the app: its generate
endpoint is gated by the administrator-only `AI` settings permission.
Keys are never placed in `.env` files of this repository.

Logic functions are child `node` processes: when the C: drive is (nearly)
full they fail to start with `Exited with code 3221225794` on Windows
(STATUS_DLL_INIT_FAILED) and every route answers 500 — free disk space and
restart the API server.

## Lead 360 (Day 7) — nothing new to configure

The Lead 360 page, Quick Add page, onboarding record page and the six
relationship routes (`/leads/360`, `/interactions/log`, `/tasks/create`,
`/tasks/update`, `/notes/create`, `/leads/assign`) are part of the application
manifest: `apply` installs them, no server variable is involved. They run as
logic functions, so `LOGIC_FUNCTION_TYPE=LOCAL` (production) and free disk on
the executor's temp drive (see the 3221225794 note above) are prerequisites —
when the executor cannot start, every Lead 360 action shows "Unable to load this
lead" with a retry, and the lead's Details / Relationship / Notes tabs (native
Twenty widgets) keep working.

The Quick Add "Owner" field is a manual assignment: `lv-on-lead-created` passes
a capture-time `ownerId` to the assignment engine as `manualAssigneeId`
(precedence rule 1), so the engine records MANUAL and does not re-route it.

## Design system (Day 7B) — one script per fresh workspace

The theme itself needs nothing: `packages/twenty-front/src/lv/lv-theme.css`
is imported by the front-end build, the fonts and the brand mark are static
files under `packages/twenty-front/public/`, and the sidebar groups and views
come with `apply`.

What is **data**, and therefore done once per workspace, is the workspace's
own name and logo. From the application directory, as a Main Admin:

```
LV_ADMIN_EMAIL=… LV_ADMIN_PASSWORD=… node scripts/brand-workspace.mjs [--api http://localhost:3000] [--front http://localhost:3001]
```

It renames the workspace to "La Vivenzia" and uploads the mark through the
ordinary admin API. Credentials come from the environment only.

Twenty's own root sidebar entries (Opportunities, Dashboards, Workflows) are
not application-owned; an admin removes them by hand (right-click › Delete
in layout customisation) after the first `apply`, because the application
ships its own entries for those objects under Relationships / Insights /
Administration.

If `tokens.ts` changes, regenerate the stylesheet's token blocks with
`node scripts/sync-lv-theme-css.mjs` (the unit test fails until you do).

## Universal lead capture (Day 8)

- **Rebuild the renderer after CM-006.** `packages/twenty-front-component-renderer`
  changed (file handles for `uploadFile`); its `dist/` is what the front-end
  imports, so on a fresh checkout — or after pulling Day 8 — run the build in
  the Day 4A note above (plus the declaration step from `project.json` if you
  need types: `npx tsgo -p tsconfig.lib.json --declaration --emitDeclarationOnly
  --noEmit false --outDir dist --rootDir src && npx tsc-alias -p tsconfig.lib.json
  --outDir dist`). Without it image and CSV capture fail with
  "The upload did not complete (invalid-params)" and the screen offers "Type it
  instead" — nothing else is affected.
- **`TWENTY_API_URL` must be the server's own reachable origin** for the logic
  functions: the capture routes read uploaded images and CSVs back from
  `${TWENTY_API_URL}/file/files-field/<id>?token=…` and refuse any other origin.
  In the dev setup this is `http://localhost:3000`; in production it is the
  server's public URL (which must also be reachable from the server itself —
  a split-horizon DNS that resolves the public name to nothing from inside the
  container would break image capture with "The uploaded file could not be
  read").
- **Vision OCR and draft classification use the Day 6 provider** (`LV_AI_PROVIDER`
  / `LV_AI_API_KEY`); the OpenAI and Anthropic dialects both carry images. With
  no key configured the capture screen states "Unable to extract information
  automatically" and continues by hand. The model chosen must accept images
  (e.g. `gpt-4o-mini`, `claude-3-5-sonnet` or later) — a text-only model makes
  extraction report FAILED with the provider's error, never a made-up result.
- **Permission flags.** `apply` grants `UPLOAD_FILE` and `DOWNLOAD_FILE` to
  Experience Hunter, Lead Coordinator and Operations. Workspaces that customised
  those roles by hand need the two flags added in Settings → Roles for image
  capture and CSV import to work for them.
- Outbound: page-metadata extraction fetches public websites from the server
  (6-second timeout, 512 KB). Nothing else leaves the server; social platforms
  are never contacted.
- No new server variables, no queue, no cron.

## Ecosystem entities (Day 9) — nothing new to configure

- `apply --no-delete` creates the new fields on `lvPartner` / `lvExperience` /
  `lvProperty`, twelve reverse relations (on workspace member, person, company and
  onboarding), the 360 page layouts, sixteen views and the six routes. No server
  variable, no cron, no queue, no core change.
- Twenty reserves the field name `address`; the property's street address is
  `streetAddress` (label "Address").
- The roles grant Experience Team write on experiences and Operations write on all
  three objects; workspaces that customised roles by hand need the same grants in
  Settings → Roles for those teams to operate the records.
- The approval → partner chain runs in the worker (`lvOnboarding.updated`); with the
  worker stopped an approval still succeeds but the partner appears only when the
  worker catches up. The Control Tower's "Approved, partner not yet active" tile
  shows the gap.
