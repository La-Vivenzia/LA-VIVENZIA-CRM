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
