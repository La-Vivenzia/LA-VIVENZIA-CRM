#!/usr/bin/env node
// R2 data-path verification with the production credential, read from AWS Secrets Manager (never printed):
// PUT a small object → LIST → GET (content compared) → DELETE → LIST (gone). Exit 0 only if all four pass.
// usage: node deploy/aws/r2-verify.mjs   (authenticated AWS CLI session; bucket from task-web.json)
import { createHash, createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const td = JSON.parse(fs.readFileSync(path.join(ROOT, 'deploy/aws/task-web.json'), 'utf8')).containerDefinitions[0];
const env = Object.fromEntries(td.environment.map((e) => [e.name, e.value]));
const BUCKET = env.STORAGE_S3_NAME; const ENDPOINT = env.STORAGE_S3_ENDPOINT; const host = new URL(ENDPOINT).host;
if (!BUCKET || BUCKET.startsWith('<')) { console.error('bucket placeholder still present'); process.exit(2); }
const secret = (name) => execFileSync('aws', ['secretsmanager', 'get-secret-value', '--secret-id', name, '--query', 'SecretString', '--output', 'text'], { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1', AWS_PAGER: '' } }).trim();
const AK = secret('lv-crm-prod/r2-access-key-id'); const SK = secret('lv-crm-prod/r2-secret-access-key');

const sign = (method, key, body = '') => {
  const now = new Date(); const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); const day = amz.slice(0, 8);
  const uri = `/${BUCKET}${key ? `/${key}` : ''}`; const query = key ? '' : 'list-type=2&prefix=lv-verify%2F';
  const ph = createHash('sha256').update(body).digest('hex');
  const canonical = [method, uri, query, `host:${host}\nx-amz-content-sha256:${ph}\nx-amz-date:${amz}\n`, 'host;x-amz-content-sha256;x-amz-date', ph].join('\n');
  const scope = `${day}/auto/s3/aws4_request`;
  const sts = ['AWS4-HMAC-SHA256', amz, scope, createHash('sha256').update(canonical).digest('hex')].join('\n');
  const k = ['auto', 's3', 'aws4_request'].reduce((kk, part) => createHmac('sha256', kk).update(part).digest(), createHmac('sha256', `AWS4${SK}`).update(day).digest());
  const sig = createHmac('sha256', k).update(sts).digest('hex');
  return { url: `${ENDPOINT}${uri}${query ? `?${query}` : ''}`, headers: { 'x-amz-date': amz, 'x-amz-content-sha256': ph, Authorization: `AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}` } };
};
const call = async (method, key, body) => { const s = sign(method, key, body ?? ''); const r = await fetch(s.url, { method, headers: s.headers, body }); return { status: r.status, text: await r.text() }; };

const key = `lv-verify/${Date.now()}.txt`; const content = `la vivenzia r2 verify ${new Date().toISOString()}`;
let ok = true; const step = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` (${extra})` : ''}`); ok = ok && cond; };
const put = await call('PUT', key, content); step('PUT object', put.status === 200, `HTTP ${put.status}`);
const list = await call('GET', ''); step('LIST shows the object', list.status === 200 && list.text.includes(key), `HTTP ${list.status}`);
const get = await call('GET', key); step('GET returns the same content', get.status === 200 && get.text === content, `HTTP ${get.status}`);
const del = await call('DELETE', key); step('DELETE object', del.status === 204, `HTTP ${del.status}`);
const list2 = await call('GET', ''); step('LIST no longer shows it', list2.status === 200 && !list2.text.includes(key), `HTTP ${list2.status}`);
console.log(ok ? `R2 data path OK on ${BUCKET}` : `R2 data path FAILED on ${BUCKET}`);
process.exit(ok ? 0 : 1);
