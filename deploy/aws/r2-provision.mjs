#!/usr/bin/env node
// La Vivenzia CRM — production file storage on Cloudflare R2 (steps 1–3 of the R2 sequence).
//
// Idempotent. Needs, in the environment (never in a file that is committed):
//   CLOUDFLARE_R2_TOKEN   Cloudflare API token with "Workers R2 Storage: Edit" on the account and
//                         "Account API Tokens: Edit" (to mint the bucket-scoped S3 credential).
//   or, if the credential was created by hand in the dashboard (R2 → Manage API tokens → Object Read & Write, this bucket):
//   R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY  — then only the bucket is created/verified and the two secrets stored.
//
// What it does:
//   1. creates the private bucket (default: lavivenzia-crm-prod, location hint APAC) if it does not exist
//   2. creates an account-owned API token limited to Object Read & Write on that bucket, and derives the
//      S3 credential pair (access key id = token id, secret = SHA-256 of the token value), unless supplied
//   3. stores lv-crm-prod/r2-access-key-id and lv-crm-prod/r2-secret-access-key in AWS Secrets Manager
//      (create or update), then rewrites the four placeholders in deploy/aws/task-web.json and task-worker.json
//   4. verifies the credential with a real S3 ListObjects against the bucket endpoint
// Nothing is printed except names, ARNs and outcomes.
import { createHash, createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ACCOUNT = 'de0f88c61c4da81f1827a2c918a4f6ed';
const BUCKET = process.env.R2_BUCKET ?? 'lavivenzia-crm-prod';
const REGION_AWS = 'ap-south-1';
const ENDPOINT = `https://${ACCOUNT}.r2.cloudflarestorage.com`;
const ROOT = path.resolve(import.meta.dirname, '../..');
const token = process.env.CLOUDFLARE_R2_TOKEN ?? '';
let accessKeyId = process.env.R2_ACCESS_KEY_ID ?? '';
let secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? '';

if (!token && !(accessKeyId && secretAccessKey)) {
  console.error('Provide CLOUDFLARE_R2_TOKEN, or R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY.');
  process.exit(2);
}

const cf = async (p, init = {}) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4${p}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  const j = await r.json();
  if (!j.success) throw new Error(`${p}: ${JSON.stringify(j.errors).slice(0, 300)}`);
  return j.result;
};
const aws = (args) => execFileSync('aws', args, { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1', AWS_PAGER: '' } }).trim();

// 1. bucket ------------------------------------------------------------------------------------
if (token) {
  const buckets = (await cf(`/accounts/${ACCOUNT}/r2/buckets?per_page=100`)).buckets ?? [];
  if (buckets.some((b) => b.name === BUCKET)) console.log(`bucket ${BUCKET}: exists`);
  else { await cf(`/accounts/${ACCOUNT}/r2/buckets`, { method: 'POST', body: JSON.stringify({ name: BUCKET, locationHint: 'apac', storageClass: 'Standard' }) }); console.log(`bucket ${BUCKET}: created (private, APAC)`); }
} else console.log(`bucket ${BUCKET}: assumed to exist (no R2 token to check)`);

// 2. bucket-scoped credential ---------------------------------------------------------------------
if (!(accessKeyId && secretAccessKey)) {
  const name = `lv-crm-prod-r2-${BUCKET}`;
  const existing = (await cf(`/accounts/${ACCOUNT}/tokens?per_page=100`)).filter((t) => t.name === name && t.status === 'active');
  for (const t of existing) { await cf(`/accounts/${ACCOUNT}/tokens/${t.id}`, { method: 'DELETE' }); console.log(`credential ${name}: previous token ${t.id.slice(0, 8)}… revoked (secret is only readable at creation)`); }
  const groups = await cf(`/accounts/${ACCOUNT}/tokens/permission_groups?per_page=100`);
  const rw = groups.find((g) => /Workers R2 Storage Bucket Item Write/i.test(g.name));
  if (!rw) throw new Error('permission group "Workers R2 Storage Bucket Item Write" not found');
  const created = await cf(`/accounts/${ACCOUNT}/tokens`, { method: 'POST', body: JSON.stringify({ name, policies: [{ effect: 'allow', permission_groups: [{ id: rw.id }], resources: { [`com.cloudflare.edge.r2.bucket.${ACCOUNT}_default_${BUCKET}`]: '*' } }] }) });
  accessKeyId = created.id;
  secretAccessKey = createHash('sha256').update(created.value).digest('hex');
  console.log(`credential ${name}: created, scoped to bucket ${BUCKET} (Object Read & Write)`);
}

// 3. Secrets Manager + task definitions -----------------------------------------------------------
const put = (secretName, value) => {
  const tmp = path.join(process.env.TEMP ?? '/tmp', `lv-secret-${process.pid}.tmp`);
  fs.writeFileSync(tmp, value, { encoding: 'utf8' });
  let arn;
  try { arn = aws(['secretsmanager', 'create-secret', '--name', secretName, '--description', 'La Vivenzia CRM production (Cloudflare R2)', '--secret-string', `file://${tmp}`, '--tags', 'Key=Project,Value=lv-crm', 'Key=Environment,Value=prod', '--query', 'ARN', '--output', 'text']); console.log(`${secretName}: created`); }
  catch { arn = aws(['secretsmanager', 'put-secret-value', '--secret-id', secretName, '--secret-string', `file://${tmp}`, '--query', 'ARN', '--output', 'text']); console.log(`${secretName}: updated`); }
  finally { fs.rmSync(tmp, { force: true }); }
  return arn;
};
const idArn = put('lv-crm-prod/r2-access-key-id', accessKeyId);
const secretArn = put('lv-crm-prod/r2-secret-access-key', secretAccessKey);
for (const f of ['task-web.json', 'task-worker.json']) {
  const p = path.join(ROOT, 'deploy/aws', f);
  const s = fs.readFileSync(p, 'utf8').replaceAll('<R2_BUCKET_NAME>', BUCKET).replaceAll('<CF_ACCOUNT_ID>', ACCOUNT).replaceAll('<R2_ACCESS_KEY_ID_SECRET_ARN>', idArn).replaceAll('<R2_SECRET_ACCESS_KEY_SECRET_ARN>', secretArn);
  fs.writeFileSync(p, s);
  console.log(`${f}: placeholders filled`);
}

// 4. verify with SigV4 ListObjectsV2 --------------------------------------------------------------
const now = new Date(); const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); const day = amz.slice(0, 8);
const host = `${ACCOUNT}.r2.cloudflarestorage.com`; const canonicalUri = `/${BUCKET}`; const query = 'list-type=2&max-keys=1';
const payloadHash = createHash('sha256').update('').digest('hex');
const canonical = ['GET', canonicalUri, query, `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amz}\n`, 'host;x-amz-content-sha256;x-amz-date', payloadHash].join('\n');
const scope = `${day}/auto/s3/aws4_request`;
const sts = ['AWS4-HMAC-SHA256', amz, scope, createHash('sha256').update(canonical).digest('hex')].join('\n');
const k = ['auto', 's3', 'aws4_request'].reduce((key, part) => createHmac('sha256', key).update(part).digest(), createHmac('sha256', `AWS4${secretAccessKey}`).update(day).digest());
const sig = createHmac('sha256', k).update(sts).digest('hex');
const r = await fetch(`${ENDPOINT}${canonicalUri}?${query}`, { headers: { 'x-amz-date': amz, 'x-amz-content-sha256': payloadHash, Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}` } });
console.log(`S3 ListObjectsV2 on ${BUCKET}: HTTP ${r.status} ${r.ok ? '(credential works)' : '(check bucket name / credential)'}`);
console.log(`STORAGE_S3_ENDPOINT=${ENDPOINT}  STORAGE_S3_NAME=${BUCKET}  STORAGE_S3_REGION=auto`);
process.exit(r.ok ? 0 : 1);
