# La Vivenzia CRM — AWS production deployment plan (for review, nothing deployed)

Account `361964630667` · region `ap-south-1` · repository commit `d12a962e` · Twenty 2.39.0 + LV application.
Prepared 2026-09-17 from the repository and a **read-only** inspection of the account. Nothing below has been
created or changed yet.

## 0. What the repository actually builds and runs (verified)

| Fact | Evidence |
|---|---|
| One image serves web/API **and** the front-end: Dockerfile target `twenty` copies the built front-end into `packages/twenty-server/dist/front`; target `twenty-server` alone is API-only | `packages/twenty-docker/twenty/Dockerfile` lines 87–187 |
| Entrypoint on every container start: `psql` check → `database:init:prod` if the `core` schema is missing → `cache:flush` → `upgrade` → `cache:flush` → `cron:register:all` (unless `DISABLE_DB_MIGRATIONS` / `DISABLE_CRON_JOBS_REGISTRATION` are `true`) → `exec "$@"` | `packages/twenty-docker/twenty/entrypoint.sh` |
| Web/API command: `node dist/main`; listens on `NODE_PORT` (default **3000**); health endpoint **`GET /healthz`** | `CMD ["node","dist/main"]`; `config-variables.ts:1454`; compose healthcheck |
| Worker command: **`yarn worker:prod`** = `node dist/queue-worker/queue-worker`; same image; migrations and cron registration disabled on the worker | compose `worker` service; `packages/twenty-server/package.json:11` |
| `cron:register:all` registers Twenty's crons **and** the logic-function cron trigger the LV app needs (`lv-sla-evaluator`, `lv-follow-up-reminders`, `lv-expire-documents`, `lv-ai-score-refresh`) | `cron-register-all.command.ts` imports `CronTriggerCronCommand` |
| Logic functions run **in the worker** with `LOGIC_FUNCTION_TYPE=LOCAL` (default). On first use the worker installs the app's runtime dependencies with `yarn workspaces focus --all --production` → **needs outbound internet** (npm registry) | `local-layer-manager.service.ts`, `copy-yarn-engine-and-build-dependencies.ts` |
| Postgres TLS: the server only supports `PG_SSL_ALLOW_SELF_SIGNED=true` → `ssl: { rejectUnauthorized: false }` (encrypted, certificate not verified); no CA-bundle option | `core.datasource.ts:74`, `workspace-data-source.service.ts:149` |
| Redis: `new IORedis(REDIS_URL)` — **standalone client, no cluster mode**; `rediss://` works for TLS | `redis-client.service.ts` |
| Files: `STORAGE_TYPE=S3` with a custom endpoint (Cloudflare R2) is the production design; `local` storage on Fargate is ephemeral and lost on every task restart | `docs/STORAGE-R2.md` |
| The LV application is **not in the image**: after the server is up, an operator runs `twenty-sdk apply --no-delete` against the production URL with an admin API key (`twenty remote:add`, then `apply -r <remote>`), followed by the one-time workspace branding script | `ENVIRONMENT.md` (Day 7B, Day 9, Day 10), `packages/twenty-sdk` CLI |
| Local production build: `docker build --target twenty` — result recorded in §13 | this plan, §13 |

## 1. Docker image

One image, one build, two services.

```
docker build --platform linux/amd64 --target twenty \
  -f packages/twenty-docker/twenty/Dockerfile --build-arg APP_VERSION=2.39.0 \
  -t 361964630667.dkr.ecr.ap-south-1.amazonaws.com/lv-crm:<git-sha> .
```
(`APP_VERSION` must be the Twenty semver — see §13; the git SHA is the image tag only.)

- Base `node:24.19.0-alpine`, runs as UID 1000, ~1.8 GB. Contains server, front-end, `psql`, `curl`, `jq`, Yarn engine.
- No `twenty-aws` target needed (it only adds `aws-cli`).

## 2. ECR

- Existing repository `lv-crm` (`361964630667.dkr.ecr.ap-south-1.amazonaws.com/lv-crm`), scan-on-push on, **tags immutable**.
- Tag scheme: the git SHA only (`lv-crm:d12a962e`). No `latest` (immutable repository); a task definition revision pins the SHA, which is also the rollback pointer.
- First push from this workstation (`aws ecr get-login-password | docker login`); later pushes from the `image` job of `ci-lavivenzia.yaml` once an OIDC role exists (not part of this plan).

## 3. ECS task definitions (Fargate, `awsvpc`, Linux/x86_64)

| | `lv-crm-prod-web` | `lv-crm-prod-worker` |
|---|---|---|
| Image | `…/lv-crm:<sha>` | same |
| Container | `web` | `worker` |
| Command | image default (`entrypoint.sh` → `node dist/main`) | `["yarn","worker:prod"]` |
| Port | `3000/tcp` | none |
| CPU / memory | **1024 / 2048 MiB** (Helm limits are 1 vCPU / 1 GiB; 2 GiB leaves room for `upgrade` at boot and the front-end serving) | **1024 / 2048 MiB** (Helm limit 1 vCPU / 2 GiB; the worker builds the logic-function dependency layer with Yarn) |
| Ephemeral storage | 21 GiB default | 21 GiB default (layer build + tmp dirs) |
| Health check (container) | `curl --fail http://localhost:3000/healthz`, interval 30 s, timeout 5 s, retries 3, **start period 300 s** (first boot runs `database:init:prod` + `upgrade`) | none (no port); ECS restarts on exit |
| Log config | awslogs → `/ecs/lv-crm-prod/web` | awslogs → `/ecs/lv-crm-prod/worker` |
| Roles | execution role `lv-crm-prod-ecs-exec` (ECR pull, CloudWatch, Secrets Manager read of the listed secrets); task role `lv-crm-prod-ecs-task` (no AWS permissions needed by the app today) | same |

Environment (plain) — identical on both unless noted:

```
NODE_PORT=3000                       # web only
SERVER_URL=https://<crm-domain>       # public URL, also used for links in email
FRONTEND_URL=https://<crm-domain>     # front-end is served by the same container
PG_SSL_ALLOW_SELF_SIGNED=true         # RDS enforces TLS (rds.force_ssl=1); only supported TLS mode
STORAGE_TYPE=S3
STORAGE_S3_REGION=auto
STORAGE_S3_NAME=<r2-bucket>
STORAGE_S3_ENDPOINT=https://<cf-account-id>.r2.cloudflarestorage.com
LOGIC_FUNCTION_TYPE=LOCAL
IS_MULTIWORKSPACE_ENABLED=false
SIGN_IN_PREFILLED=false
EMAIL_DRIVER=LOGGER                   # Twenty's own transactional mail (invites, password reset) — set SMTP when Resend is ready (§9)
DISABLE_DB_MIGRATIONS=true            # worker only
DISABLE_CRON_JOBS_REGISTRATION=true   # worker only
```

Secrets (from Secrets Manager, injected as env by ECS): `PG_DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`,
`STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY` (+ `EMAIL_SMTP_*` later). Nothing else is required by
the server to boot (`PG_DATABASE_URL` is the only `@IsDefined` variable; `REDIS_URL` is required at runtime).

Application variables (`LV_AI_*`, `LV_SMTP_*`, `LV_APP_BASE_URL`, `LV_ESCALATION_OWNER_EMAIL`) are **not** ECS
environment: they are set on the application after `apply` (encrypted by Twenty with `ENCRYPTION_KEY`).

## 4. Load balancer

- **New** internet-facing ALB `lv-crm-prod-alb` in the two **public** subnets (`subnet-023a3bee5e968f838` 1a,
  `subnet-06b17aee4da5ef6ec` 1b), security group `lv-crm-prod-alb` (existing).
- Listener **443** (ACM certificate for `<crm-domain>`, TLS 1.3 policy) → target group; listener **80** → redirect 301 to 443.
- Target group `lv-crm-prod-web`: `ip` targets, HTTP **3000**, health check `GET /healthz` (200), interval 30 s,
  healthy 2 / unhealthy 3, deregistration delay 30 s. Idle timeout 120 s (GraphQL and file uploads).
- DNS: Cloudflare CNAME `<crm-domain>` → ALB DNS name, **DNS-only (grey cloud)** initially. ACM validation via
  a Cloudflare CNAME record (ACM is a certificate service, not Route 53 — permitted).

## 5. Networking

| Item | Value |
|---|---|
| VPC | `vpc-056de77c7b30da916` (`lv-crm-prod-vpc`, 10.20.0.0/16) |
| ECS tasks | private subnets `subnet-0352a03f9c9008b71` (1a) + `subnet-074fecfeaa62c4436` (1b); `assignPublicIp: DISABLED`; SG `lv-crm-prod-ecs` (`sg-019afa6022ef1b7f4`) |
| ALB | public subnets; SG `lv-crm-prod-alb` (`sg-03f2459b9668e0ed5`) |
| RDS | `lv-crm-prod-db.ctokeoqcczuh.ap-south-1.rds.amazonaws.com:5432`, not public, SG `lv-crm-prod-rds` already allows 5432 from `lv-crm-prod-ecs` ✔ |
| Valkey | SG `lv-crm-prod-valkey` already allows 6379 from `lv-crm-prod-ecs` ✔ (see the blocker in §15) |

**Findings that must be fixed before the tasks can run (all documented, none done):**

1. **No NAT gateway.** Both private route tables have no `0.0.0.0/0` route. Tasks there cannot pull from ECR,
   write CloudWatch logs, read Secrets Manager, reach Gemini / Resend / R2, or run `yarn` for the logic-function
   layer. Proposed: one NAT gateway (`lv-crm-prod-nat`, Elastic IP) in `subnet-023a3bee5e968f838`, and a
   `0.0.0.0/0 → nat` route added to `rtb-072c4a9615c65c075` and `rtb-0c7eb53e315895b34`. Single-AZ NAT is
   accepted for V1 (1 task each). Alternative that avoids the NAT for AWS traffic only: VPC endpoints
   (ecr.api, ecr.dkr, logs, secretsmanager + S3 gateway) — still leaves Gemini/Resend/R2/npm unreachable, so the
   NAT is required either way.
2. **ALB security group only allows IPv6** (`::/0` on 443); no IPv4 rule. Add `0.0.0.0/0` on 443 and 80.
3. **ECS SG ingress is 3000 from the ALB SG only** ✔ — correct; egress default allow-all ✔.

## 6. Secrets Manager

| Secret | Content | Source |
|---|---|---|
| `rds!db-04f7b500-…` (exists, AWS-managed) | RDS master `lvadmin` password | created with the instance |
| `lv-crm-prod/pg-database-url` | `postgres://lvadmin:<pwd>@lv-crm-prod-db….rds.amazonaws.com:5432/lavivenzia` | built from the managed secret; database `lavivenzia` created once (§12 step 4) |
| `lv-crm-prod/redis-url` | `rediss://<valkey-primary-endpoint>:6379` | after §15 blocker is resolved |
| `lv-crm-prod/encryption-key` | 32+ random bytes, base64 — **generated once, never rotated without `FALLBACK_ENCRYPTION_KEY`** | `openssl rand -base64 32` |
| `lv-crm-prod/r2-access-key-id`, `lv-crm-prod/r2-secret-access-key` | Cloudflare R2 API token | Founder / Cloudflare dashboard |
| `lv-crm-prod/smtp` (later) | Resend SMTP user + password | Founder / Resend |

Post-boot (not in ECS): the production admin API key for `twenty-sdk apply` — kept in the operator's
`~/.twenty/config.json` only; the Gemini key and `LV_SMTP_PASSWORD` — stored **encrypted by Twenty** as
application variables (Settings → Apps), never in ECS.

## 7. CloudWatch

Log groups `/ecs/lv-crm-prod/web` and `/ecs/lv-crm-prod/worker`, retention 30 days. Container Insights on the
cluster (CPU/memory per service). Alarms (V1 minimum): ALB `UnHealthyHostCount ≥ 1` for 5 min; ECS running
tasks < desired for either service; RDS `FreeStorageSpace < 2 GB`.

## 8. Health checks and boot sequence

- First web start on an empty database: `database:init:prod` + `upgrade` can take 2–5 minutes → the ALB health
  check grace period on the service is **600 s** and the container start period 300 s, so ECS does not kill the
  task mid-migration.
- Worker depends on the web having initialised the schema: **start the worker only after the web task is healthy**.
- Steady state: `/healthz` every 30 s from the ALB; container `curl` every 30 s.

## 9. Email

Twenty's own mail (invites, password reset) uses `EMAIL_DRIVER=SMTP` + `EMAIL_SMTP_HOST/PORT/USER/PASSWORD` +
`EMAIL_FROM_ADDRESS/NAME`; LV notification mail uses the application variables `LV_SMTP_*`. Both point at
Resend's SMTP relay (`smtp.resend.com:465`, user `resend`, password = API key). Until the Resend key exists the
server boots with `EMAIL_DRIVER=LOGGER` (mail is logged, not sent) — acceptable for the first smoke deployment,
not for go-live.

## 10. Cost impact (ap-south-1, approximate, monthly, on-demand)

| Resource | New? | Estimate |
|---|---|---|
| Fargate web 1 vCPU / 2 GiB ×1 | new | ≈ US$ 36 |
| Fargate worker 1 vCPU / 2 GiB ×1 | new | ≈ US$ 36 |
| ALB + LCUs (low traffic) | new | ≈ US$ 20 |
| NAT gateway + EIP (+ data) | new | ≈ US$ 35 + data |
| CloudWatch logs / Insights | new | ≈ US$ 5 |
| Secrets Manager (6 secrets) | new | ≈ US$ 3 |
| ECR storage (2–3 images) | existing repo | ≈ US$ 1 |
| RDS `db.t3.small` Multi-AZ, 20 GB | existing | ≈ US$ 70 |
| Valkey **cluster-mode 9 × cache.t4g.small** | existing | ≈ US$ 210 — see §15: this must become 1–2 nodes (≈ US$ 25–50) |
| **Total new** | | **≈ US$ 135 / month** + the existing DB/cache |

## 11. Rollback

- Application: `aws ecs update-service --task-definition lv-crm-prod-web:<previous revision>` (and worker);
  ECS drains the new task after the old one is healthy. Image tags are immutable, so the previous revision is
  always re-deployable.
- Database: Twenty migrations run forward only; roll back the code only within the same Twenty version (2.39.0
  here). A Twenty version upgrade needs an RDS snapshot first (`aws rds create-db-snapshot`) and restore-to-new-
  instance as the rollback path.
- LV application metadata: `twenty-sdk apply --no-delete` never deletes; re-applying the previous git checkout
  restores previous definitions.
- Infrastructure: everything new is tagged `Project=lv-crm`, `Environment=prod`; deletion order for a full
  rollback: services → ALB/target group → task definitions → NAT → secrets → log groups.

## 12. Deployment order (nothing done yet)

1. Fix networking: NAT gateway + private routes; ALB SG IPv4 rules. *(new resources, documented in §5)*
2. Resolve the Valkey blocker (§15).
3. Secrets Manager entries (§6) — `ENCRYPTION_KEY` generated locally, never printed.
4. IAM: execution role `lv-crm-prod-ecs-exec` (AmazonECSTaskExecutionRolePolicy + `secretsmanager:GetSecretValue`
   on the six ARNs), task role `lv-crm-prod-ecs-task` (empty policy).
5. CloudWatch log groups.
6. Build the image for `linux/amd64`, push `lv-crm:<sha>` to ECR (scan result checked).
7. Create database `lavivenzia` on RDS with a one-off Fargate task from the same image
   (`psql "$ADMIN_URL" -c 'CREATE DATABASE lavivenzia'`) — RDS is private, so this runs inside the VPC.
8. ACM certificate for `<crm-domain>` (DNS validation record added in Cloudflare) → ALB, listeners, target group.
9. Register task definitions; create **web** service (desired 1, grace 600 s, private subnets, no public IP);
   wait for healthy targets; open `https://<crm-domain>/healthz`.
10. Create **worker** service (desired 1); confirm in its log that the queue worker started and
    `bull:cron-queue:repeat*` entries exist (cron registered by the web's entrypoint).
11. First sign-up on the public URL = production workspace and Main Admin. Then `IS_SIGN_UP_DISABLED=true`
    on the web service (later members are invited from Settings).
12. Admin creates an API key → operator: `twenty remote:add --name lvprod …` → `twenty apply -r lvprod --no-delete`
    from `packages/twenty-apps/internal/lavivenzia-crm` (137 files) → `node scripts/brand-workspace.mjs` →
    remove Twenty's own sidebar entries by hand (ENVIRONMENT.md, Day 7B) → set application variables
    (`LV_AI_PROVIDER=gemini`, `LV_AI_API_KEY`, `LV_AI_MODEL=gemini-3.6-flash`, `LV_APP_BASE_URL`,
    `LV_SMTP_*`, `LV_ESCALATION_OWNER_EMAIL`) → invite the team, assign LV roles.
13. Smoke: capture a lead, log an interaction, open Lead 360 / Intelligence (AI available), upload a document
    (lands in R2), check `/ecs/lv-crm-prod/worker` for the assignment run.
14. Cloudflare: switch the CNAME to proxied only after confirming the ALB certificate; keep "Full (strict)".

## 13. Local production build verification (done 2026-09-17)

| Check | Result |
|---|---|
| `docker build --target twenty` | **OK** — `lv-crm:d12a962e`, linux/amd64, 1.78 GB, UID 1000, entrypoint `/app/entrypoint.sh`, cmd `node dist/main`, front-end bundle at `dist/front/index.html` (title "La Vivenzia CRM"), `psql` 18.6, Node 24.19.0, Yarn 4.13.0 |
| Build note | BuildKit runs the server and front-end stages in parallel; on an 8 GB Docker VM the server `lingui extract` worker timed out. Building `--target twenty-server` first and then `--target twenty` (cached) succeeds. CI/CD runners with ≥ 16 GB do not need the split. |
| **`APP_VERSION` must be semver** | Building with the git SHA as `APP_VERSION` makes the server exit at boot (`APP_VERSION must be a valid semantic version`); it is also what `twenty-sdk apply` checks the app's engine requirement against. Production build arg: `APP_VERSION=2.39.0`; the SHA goes in the image tag. |
| Empty database first boot (throwaway Postgres 16 + Redis 7) | "Database appears to be empty, running migrations." → `Successfully migrated DB!` → 74 `core` tables → `cron:register:all` incl. **`CronTrigger`** (the LV app's cron trigger) and `WorkflowCronTrigger` → `/healthz` **200 after 115 s** |
| Port | web listens on **3000** (`NODE_PORT=3000`); `GET /healthz` → `{"status":"ok"}`; `GET /` and `/welcome` serve the front-end (200, `text/html`) |
| Worker | `yarn worker:prod` from the same image with `DISABLE_DB_MIGRATIONS=true` / `DISABLE_CRON_JOBS_REGISTRATION=true`: prints "skipping" for both, `QueueWorkerModule` initialised, stays up; Redis holds 71 `bull:cron-queue:repeat*` entries (8 for `CronTrigger`) |
| Operational gotcha | If a first boot fails **after** the entrypoint created the `core` schema (e.g. bad env), every later boot skips `database:init:prod` ("schema exists") and `upgrade` fails on missing tables. Recovery: drop and recreate the database, then restart. Applies to §12 step 9. |

Test containers were removed afterwards; nothing of this touched the dev workspace or AWS.

## 14. Prerequisites the Founder must provide

- Production domain name for the CRM (`<crm-domain>`) and access to Cloudflare DNS for the ACM validation CNAME.
- Cloudflare R2: bucket name, account id, an R2 API token (object read/write on that bucket).
- Resend: API key (used as SMTP password) and the sender address/domain verified in Resend.
- Gemini: the working key (rotate the one pasted in chat) and billing enabled on the Google project.
- Decision on §15.

## 15. Blockers found in the existing infrastructure (documented, not changed)

| # | Finding | Impact | Proposal |
|---|---|---|---|
| B1 | **Valkey `lv-crm-prod-valkey` is cluster-mode enabled** (3 shards × 3 nodes, 9 × cache.t4g.small, TLS on). Twenty connects with a standalone `ioredis` client and BullMQ; a cluster-mode endpoint answers cross-slot commands with `MOVED`/`CROSSSLOT` — **queues, cache and pub/sub will not work**. | Hard blocker for both services | Replace with a **cluster-mode-disabled** replication group: 1 primary (+1 replica for Multi-AZ if wanted), `cache.t4g.small`, TLS on, same SG/subnet group, `maxmemory-policy noeviction` parameter group (compose uses it). `REDIS_URL=rediss://<primary-endpoint>:6379`. Saves ≈ US$ 160–185/month. **Needs your approval — it deletes the existing cache (no data in it yet).** |
| B2 | No NAT gateway on the private subnets | Tasks cannot start (image pull) or reach any external API | Add one NAT gateway + routes (§5) — new resource, ≈ US$ 35/month |
| B3 | ALB security group has no IPv4 ingress | Nobody on IPv4 can reach the CRM | Add 443 and 80 from `0.0.0.0/0` |
| B4 | No ECS task execution role, no log groups, no ALB, no ACM certificate, no non-RDS secrets exist yet | Expected — created in §12 | — |
| B5 | RDS master user is `lvadmin` on the `postgres` default database; Twenty needs its own database | Minor | create `lavivenzia` (§12 step 7) |

Everything above stays as a plan until reviewed. No AWS resource has been created or modified.

## 16. Execution log

| When | Step | Result |
|---|---|---|
| 2026-09-17 | §15 B3 — ALB SG | `sg-03f2459b9668e0ed5`: added TCP 443 and 80 from `0.0.0.0/0` (IPv6 443 kept) |
| 2026-09-17 | §15 B2 — NAT | EIP `eipalloc-02edc1bd7a6873a93`, NAT `nat-096ee468b4530fcef` in `subnet-023a3bee5e968f838`; `0.0.0.0/0` routes on `rtb-072c4a9615c65c075` and `rtb-0c7eb53e315895b34` |
| 2026-09-17 | §15 B1 — Valkey | cluster-mode group deleted (empty, no snapshot); new `lv-crm-prod-valkey`: cluster mode disabled, 1 × `cache.t4g.small`, Valkey 9.0, TLS + at-rest, param group `lv-crm-prod-valkey9` (`maxmemory-policy=noeviction`), SG `sg-0c58d59926e971352`, endpoint `master.lv-crm-prod-valkey.vpvtkp.aps1.cache.amazonaws.com:6379` |
| 2026-09-17 | §12.3 secrets | `lv-crm-prod/pg-app-password`, `pg-database-url` (user `lavivenzia_app`, db `lavivenzia`), `redis-url` (`rediss://…`), `encryption-key` — values generated locally, never displayed |
| 2026-09-17 | §12.4 IAM | roles `lv-crm-prod-ecs-exec` (AmazonECSTaskExecutionRolePolicy + `read-prod-secrets` on `lv-crm-prod/*` and the RDS managed secret) and `lv-crm-prod-ecs-task` (no policy) |
| 2026-09-17 | §12.5 logs | `/ecs/lv-crm-prod/web`, `/worker`, `/ops`, retention 30 days |
| 2026-09-17 | §12.6 image | `lv-crm:d12a962e` (APP_VERSION 2.39.0) pushed, digest `sha256:4de30132…` |
| 2026-09-17 | §12.7 database | ops task def `lv-crm-prod-ops:1`; one-off run (private subnet, ECS SG) created role `lavivenzia_app`, database `lavivenzia` (owner `lavivenzia_app`), extensions uuid-ossp / unaccent / citext — this also proved ECR-through-NAT, Secrets Manager, CloudWatch and RDS TLS connectivity from the private subnets |

Decision taken with approval: the application connects as the dedicated `lavivenzia_app` user, never as the RDS master.
| 2026-09-18 | §12.8 ACM + DNS | certificate `deddb9d7-…` requested for `crm.lavivenzia.com`; Cloudflare zone active (14 pre-existing records untouched); validation CNAME `_6d55c1ff…crm` and `crm → lv-crm-prod-alb-423039597.ap-south-1.elb.amazonaws.com` added DNS-only; both resolve on 1.1.1.1 and 8.8.8.8; ACM **ISSUED** on 2026-09-18 |
| 2026-09-18 | §12.8 ALB | `lv-crm-prod-alb` (IPv4 — the public subnets carry no IPv6 block), public subnets, SG `lv-crm-prod-alb`, idle 120 s; target group `lv-crm-prod-web` (ip, HTTP 3000, `/healthz`, 30 s, 2/3, dereg 30 s); listener 80 → 301 HTTPS (verified publicly). 443 listener created (TLS 1.3 policy, ACM cert → `lv-crm-prod-web`); `https://crm.lavivenzia.com` serves the certificate and answers 503 until the web service registers a target |
| 2026-09-18 | §12.9 task definitions | drafted in `deploy/aws/task-web.json` / `task-worker.json` (all variables validated against the server config; R2 placeholders only); `task-ops.json` registered as `lv-crm-prod-ops:1` |
| 2026-09-18 | preflight run | **26 passed, 0 failed**; connectivity task: RDS 16.15 as `lavivenzia_app` with `ssl=t`, extensions present, Valkey `PING PONG` over TLS with `maxmemory_policy noeviction` |
| 2026-09-18 | preflight | `deploy/aws/preflight.sh` — ACM/listener, redirect, ALB/TG, IAM least-privilege, log retention, secret references, RDS/Valkey settings, ECR image; `RUN_CONNECTIVITY=1` adds a one-off task proving RDS TLS as `lavivenzia_app` and Valkey TLS PING |

### Remaining before the services (in order)
1. ~~preflight / 443 listener~~ done.
2. R2 (Founder enables R2 on Cloudflare account `de0f88c6…`, then a token with *Workers R2 Storage: Edit* + *Account API Tokens: Edit*) → `node deploy/aws/r2-provision.mjs` creates the private bucket `lavivenzia-crm-prod`, a bucket-scoped Object Read & Write credential, the two secrets, and fills the task definitions.
3. `bash deploy/aws/deploy-services.sh` → task definitions → `lv-crm-prod-web` (grace 600 s, circuit breaker) → healthy target → `lv-crm-prod-worker` → log / HTTPS / smoke verification → **stop before first sign-up / `twenty-sdk apply`**.
