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

## R2 sequence (one command each, once the Founder enables R2)

1. `CLOUDFLARE_R2_TOKEN=<token with Workers R2 Storage: Edit + Account API Tokens: Edit> node deploy/aws/r2-provision.mjs`
   — creates the private bucket `lavivenzia-crm-prod` (APAC), mints a bucket-scoped Object Read & Write
   credential, stores both halves in Secrets Manager, fills the placeholders in the task definitions and
   proves the credential with a signed ListObjects. If the credential was made in the dashboard instead:
   `R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… node deploy/aws/r2-provision.mjs`.
2. `bash deploy/aws/deploy-services.sh` — refuses while any placeholder remains; registers the task
   definitions; creates (or updates, never duplicates) `lv-crm-prod-web` with a 600 s grace period and a
   circuit breaker, waits for the ALB target to be healthy, then `lv-crm-prod-worker`; checks the logs for
   RDS / Valkey / worker readiness; verifies `https://crm.lavivenzia.com` (/healthz, front-end, redirect,
   GraphQL) and stops before the first sign-up.
