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
