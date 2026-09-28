# La Vivenzia CRM — AWS teardown and restart

**Teardown executed:** 25 September 2026 · account `361964630667` · region `ap-south-1`
**Reason:** the CRM is unused while the UI/UX is redesigned; founder/CTO approved a controlled teardown to strict zero ongoing AWS cost (Option B — no snapshots retained).
**Pre-teardown run-rate (Cost Explorer, verified):** **$8.40/day ≈ $252/month ≈ ₹22,000/month.**

> The application code, GitHub repository, Cloudflare DNS, the `lavivenzia.com` domain, the Cloudflare R2 bucket `lavivenzia-crm-prod` and all main La Vivenzia product infrastructure were **not touched**.

---

## A. What was deleted

| Resource | Identifier | Was costing |
|---|---|---|
| ECS service (web) | `lv-crm-prod-web` (1 × 1 vCPU / 2 GiB Fargate) | ~$38/mo |
| ECS service (worker) | `lv-crm-prod-worker` (1 × 1 vCPU / 2 GiB Fargate) | ~$38/mo |
| Application Load Balancer | `lv-crm-prod-alb` + both listeners (80, 443) | ~$23/mo |
| Target group | `lv-crm-prod-web` | — |
| NAT Gateway | `nat-096ee468b4530fcef` | ~$41/mo |
| Elastic IP (NAT) | `eipalloc-02edc1bd7a6873a93` (15.252.170.156) | included above |
| Elastic IPs (ALB, 2) | released with the load balancer | ~$7/mo |
| ElastiCache Valkey | `lv-crm-prod-valkey` / node `lv-crm-prod-valkey-001` (cache.t4g.small) | ~$24/mo |
| ElastiCache snapshot | `automatic.lv-crm-prod-valkey-001-2026-09-25-05-31` (30 MB) | backup storage |
| RDS instance | `lv-crm-prod-db` (db.t3.small, PostgreSQL 16.15, Multi-AZ, 20 GB gp3) — deletion protection disabled, **no final snapshot**, automated backups deleted | ~$83/mo |
| CloudWatch log groups | `/ecs/lv-crm-prod/web`, `/ecs/lv-crm-prod/worker`, `/ecs/lv-crm-prod/ops` | storage |
| Secrets Manager (8) | `lv-crm-prod/pg-app-password`, `/pg-database-url`, `/redis-url`, `/encryption-key`, `/r2-access-key-id`, `/r2-secret-access-key`, `/smtp`, `/google-api-key` — force-deleted (no recovery window, no storage charge) | ~$3.20/mo |
| RDS-managed secret | `rds!db-04f7b500-…` — removed by AWS with the instance | — |
| ECR repository | `lv-crm` including all 3 images (~512 MB) | storage |

Teardown was performed by `deploy/aws/teardown.sh`, which asserts the account, verifies the backup checksum and validates every resource identifier before deleting it.

## B. What was preserved (all free, kept to make recreation simpler)

| Resource | Identifier |
|---|---|
| VPC | `vpc-056de77c7b30da916` (`lv-crm-prod-vpc`, 10.20.0.0/16) |
| Subnets (4) | public `subnet-023a3bee5e968f838` (1a) / `subnet-06b17aee4da5ef6ec` (1b); private `subnet-0352a03f9c9008b71` (1a) / `subnet-074fecfeaa62c4436` (1b) |
| Security groups (4) | `lv-crm-prod-alb`, `lv-crm-prod-ecs`, `lv-crm-prod-rds`, `lv-crm-prod-valkey` (rules intact) |
| Route tables, internet gateway | routes to the deleted NAT are now blackholed — **must be repointed at a new NAT on recreation** |
| S3 gateway endpoint | `vpce-0ca99cd292419be60` (gateway endpoints are free) |
| ECS cluster | `lv-crm-prod` (empty; Container Insights disabled, no capacity providers) |
| ECS task definitions | `lv-crm-prod-web:7`, `lv-crm-prod-worker:7`, `lv-crm-prod-ops:1` (revisions are free; they reference the now-deleted image and secret ARNs) |
| IAM roles | `lv-crm-prod-ecs-exec`, `lv-crm-prod-ecs-task` |
| ACM certificate | `arn:aws:acm:ap-south-1:361964630667:certificate/deddb9d7-b5ee-429f-a271-cc492fe90841` for `crm.lavivenzia.com` (public certificates are free) |
| Subnet/parameter groups | DB subnet group `default-vpc-056de77c7b30da916`; cache subnet group `lv-crm-prod-vpc`; cache parameter group `lv-crm-prod-valkey9` |
| Outside AWS | GitHub repo + `deploy/aws/*`, Cloudflare DNS record `crm.lavivenzia.com`, Cloudflare R2 bucket `lavivenzia-crm-prod` (all CRM file uploads) |

Full configuration snapshot (no secret values, key names only): **`deploy/aws/crm-infra-manifest.json`**.

## C. Where the verified database backup is stored

| | |
|---|---|
| File | `lavivenzia-prod-2026-09-25.sql.gz` — plain SQL, gzip -9, 1,064,001 bytes (5,588,863 bytes uncompressed) |
| SHA-256 | `e70a38fd0af9041b163a954ad58c1fdbb10b332227ffa48a5919a7eca0419b4b` (also in `D:\lv-crm-backup\SHA256SUMS.txt`) |
| Copy 1 | `D:\lv-crm-backup\lavivenzia-prod-2026-09-25.sql.gz` |
| Copy 2 | `<repo>\.notes\teardown\backup\lavivenzia-prod-2026-09-25.sql.gz` (gitignored — **never commit it**) |
| Source | `pg_dump --format=plain --no-owner --no-privileges` of database `lavivenzia`, taken from inside the VPC by an ECS one-off task on the `lv-crm-prod-ops` definition, transferred via CloudWatch Logs as base64 and checksum-verified end to end |
| Contents | schemas `core`, `public`, `workspace_6qdaa73m9jaq6bnaayxqtvvo9`; 120 tables |

**Verification performed before any deletion** (restored into a throwaway `postgres:16` container, matching the production engine):

| Table | Restored | Live production | |
|---|---|---|---|
| `core.workspace` / `core.user` | 1 / 2 | — | |
| `core.objectMetadata` / `fieldMetadata` / `view` / `application` | 46 / 1113 / 102 / 3 | — | |
| `_lvLead` | 2 | 2 | ✔ |
| `_lvInteraction` | 9 | 9 | ✔ |
| `_lvOnboarding` / `_lvOnboardingDocument` | 2 / 4 | 2 / 4 | ✔ |
| `_lvPartner` / `_lvProperty` / `_lvExperience` | 1 / 1 / 1 | 1 / 1 / 1 | ✔ |
| `_lvAiInsight` / `_lvAuditEvent` | 21 / 51 | 21 / 51 | ✔ |
| `person` / `company` / `task` | 4 / 3 / 15 | 4 / 3 / 15 | ✔ |

Restore exit code 0, no errors. **One required fix when restoring into PostgreSQL 16:** the dump was produced by `pg_dump` 18 (the container image ships `postgresql18`) and contains a `SET transaction_timeout = 0;` line that PostgreSQL 16 rejects. Delete that one line, or restore into PostgreSQL 17+:

```bash
gzip -dc lavivenzia-prod-2026-09-25.sql.gz | sed '/SET transaction_timeout = 0;/d' > lv.sql
psql -v ON_ERROR_STOP=1 -d lavivenzia -f lv.sql
```

## D. Secrets and configuration needed again (names only — no values are stored here)

Recreate these in Secrets Manager under the same names; the task definitions already reference these paths (ARNs will change, so update them):

| Secret name | What it holds | Where the value comes from |
|---|---|---|
| `lv-crm-prod/pg-database-url` | `postgres://…` for the app DB user | generated when the new RDS instance is created |
| `lv-crm-prod/pg-app-password` | password of the app DB role | generate new |
| `lv-crm-prod/redis-url` | `rediss://…` Valkey endpoint | new Valkey endpoint |
| `lv-crm-prod/encryption-key` | Twenty `APP_SECRET` | **must be regenerated**; existing encrypted application variables (AI key, SMTP password) will need to be re-entered |
| `lv-crm-prod/r2-access-key-id`, `/r2-secret-access-key` | Cloudflare R2 S3 credentials | Cloudflare dashboard (bucket `lavivenzia-crm-prod` still exists with all files) |
| `lv-crm-prod/smtp` | Resend API key (used as SMTP password, user `resend`, host `smtp.resend.com:465`, sender `crm@mail.lavivenzia.com`) | Resend dashboard |
| `lv-crm-prod/google-api-key` | Gemini API key for Twenty's native AI | Google AI Studio |

Application-level variables re-entered after the app is installed (encrypted by Twenty, not AWS): `LV_AI_PROVIDER=gemini`, `LV_AI_MODEL`, `LV_AI_API_KEY`, `LV_SMTP_HOST/PORT/SECURE/USER/PASSWORD`, `LV_EMAIL_FROM`, `LV_APP_BASE_URL=https://crm.lavivenzia.com`, `LV_ESCALATION_OWNER_EMAIL`.

## E. AWS resources required for recreation

Already present (B) — VPC, 4 subnets, 4 security groups, route tables, IGW, S3 endpoint, ECS cluster, IAM roles, ACM certificate, subnet/parameter groups.

To create again: **NAT Gateway + EIP**, **RDS** (PostgreSQL 16.x, db.t3.small — *Single-AZ is sufficient and halves the cost*, 20 GB gp3, private, SG `lv-crm-prod-rds`, `force_ssl` on), **ElastiCache Valkey** (cache.t4g.small, cluster mode disabled, TLS on, `maxmemory-policy noeviction`), **ALB + target group + 2 listeners**, **ECR repository + image**, **8 secrets**, **3 CloudWatch log groups** (30-day retention), **2 ECS services**.

## F. Recreation order

1. **NAT Gateway** in `subnet-023a3bee5e968f838` with a new EIP → **repoint the two private route tables** (`rtb-0c7eb53e315895b34`, `rtb-072c4a9615c65c075`) `0.0.0.0/0` at the new NAT (their old routes are blackholed).
2. **RDS** PostgreSQL 16.x from the settings in `crm-infra-manifest.json` → create database `lavivenzia` and the app role.
3. **Restore the database** (section C, including the `transaction_timeout` fix).
4. **ElastiCache Valkey**.
5. **Secrets Manager** — recreate the 8 secrets (section D).
6. **ECR** repository → build and push the image (`packages/twenty-docker/twenty/Dockerfile`, `--build-arg APP_VERSION=2.39.0`; build target `twenty-server` first, then `twenty`).
7. **Log groups** `/ecs/lv-crm-prod/{web,worker,ops}`, retention 30 days.
8. **Target group** (`/healthz`, port 3000, target type `ip`) → **ALB** (IPv4, subnets 1a+1b, SG `lv-crm-prod-alb`) → listener 80 (redirect to 443) and listener 443 (ACM cert, forward to the target group).
9. **Update the task definitions** in `deploy/aws/task-web.json` / `task-worker.json` / `task-ops.json` with the new image tag and the new secret ARNs, then register them.
10. **Cloudflare DNS** — point `crm.lavivenzia.com` at the new ALB DNS name (CNAME, DNS-only/grey cloud).
11. **ECS services** — `deploy/aws/deploy-services.sh` creates both services. **Pin them to `subnet-0352a03f9c9008b71` (1a)**: public DNS lookups failed intermittently from the 1b private subnet.
12. **Verify** — `VERIFY_ONLY=1 bash deploy/aws/deploy-services.sh` (ALB health, RDS/Valkey/R2 reachability, `/healthz`, HTTPS).
13. **Application** — `twenty-sdk apply -r lvprod --no-delete`. On a fresh workspace this needs the **two-phase apply**: move `leads-all|partners-all|experiences-all|properties-all.view.ts` aside, apply, restore them, apply again (index views collide with `RESERVED_SYSTEM_UNIVERSAL_IDENTIFIER`).
14. Re-enter the application variables (section D), invite the team, set `IS_SIGN_UP_DISABLED=true`.

## G. CRM start procedure (once the infrastructure exists)

```bash
aws ecs update-service --cluster lv-crm-prod --service lv-crm-prod-web    --desired-count 1 --region ap-south-1
aws ecs update-service --cluster lv-crm-prod --service lv-crm-prod-worker --desired-count 1 --region ap-south-1
VERIFY_ONLY=1 bash deploy/aws/deploy-services.sh
```

## H. CRM stop / teardown procedure

```bash
bash deploy/aws/teardown.sh                 # dry run — prints every action
CONFIRM=DELETE bash deploy/aws/teardown.sh  # executes
```
The script refuses to run unless a checksum-verified backup exists at the path in its header. Take a fresh dump first (section C describes the method; the override JSON is in `.notes/teardown/`).

## I. Known manual steps

- **`transaction_timeout`** must be stripped when restoring into PostgreSQL 16 (section C).
- **Blackholed routes** — the private route tables still point at the deleted NAT; fix before starting tasks or the CRM will have no outbound internet (AI, Resend, R2 all fail).
- **New `APP_SECRET`** means Twenty's encrypted application variables must be re-entered; workspace member passwords are unaffected (they are hashed in the dump).
- **Subnet 1a pin** (see F.11).
- **`APP_VERSION` must be a semver** (`2.39.0`); a git SHA is rejected at boot.
- **Cloudflare R2 credentials** were deleted from AWS but the bucket and its files are intact; generate a new bucket-scoped token.
- The **two AI paths** (LV app variables and Twenty's `GOOGLE_API_KEY`) share one Gemini key; the free tier is ~20 requests/day per model.

## J. Cost considerations

- Verified pre-teardown run-rate: **$8.40/day** (Cost Explorer, 19–23 Sep 2026). Largest items: RDS $21.36, ECS $15.57, ElastiCache $11.94, EC2-Other (NAT) $9.39, ELB $4.00, VPC $2.49 — month-to-date to 25 Sep.
- Everything recurring is now deleted. Retained resources (VPC, subnets, SGs, route tables, IGW, S3 gateway endpoint, empty ECS cluster with Container Insights **disabled**, task definitions, IAM roles, ACM public certificate, subnet/parameter groups) carry **no charge**.
- September's bill will still show the 1–25 September usage; that is historical and unavoidable.
- **On recreation, two easy savings:** run RDS **Single-AZ** (−$41/month) and Fargate on **ARM/Graviton** (−$33/month). Together they bring the same architecture to roughly $180/month instead of $258.
- If the CRM is only needed for demos, consider not recreating the NAT Gateway ($41/month) and instead using VPC endpoints plus a proxy for the three external services — or simply tearing down again after each demo with this script.
