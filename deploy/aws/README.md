# AWS deployment artefacts (production, ap-south-1)

Task definitions registered with `aws ecs register-task-definition --cli-input-json file://…`.
They reference Secrets Manager ARNs only — no secret value lives in this folder.

| File | Family | Purpose |
|---|---|---|
| `task-web.json` | `lv-crm-prod-web` | web/API + front-end, port 3000, migrations + cron registration at boot |
| `task-worker.json` | `lv-crm-prod-worker` | `yarn worker:prod`, logic functions, queues |
| `task-ops.json` | `lv-crm-prod-ops` | one-off `psql` maintenance (database bootstrap); command overridden per run |

Placeholders `<R2_BUCKET_NAME>`, `<CF_ACCOUNT_ID>`, `<R2_*_SECRET_ARN>` are filled once the Cloudflare R2
bucket and API token exist (secrets `lv-crm-prod/r2-access-key-id`, `lv-crm-prod/r2-secret-access-key`).
The image tag is the git SHA of the deployed commit; `APP_VERSION` inside the image is the Twenty semver.
Full plan, decisions and execution log: `docs/AWS-DEPLOYMENT-PLAN.md`.
