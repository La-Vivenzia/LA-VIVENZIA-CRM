# File storage — Cloudflare R2

## Summary

**R2 requires no code.** Twenty's existing `s3.driver.ts` already accepts a
custom endpoint, and R2 is S3-compatible, so production storage is a matter of
environment variables. No La Vivenzia storage driver exists, and none should be
written — a second driver would be a parallel implementation of something the
platform already does.

Verified in source before deciding:

| Question | Answer | Evidence |
|---|---|---|
| Does the S3 driver accept a custom endpoint? | Yes | `s3.driver.ts:49,66,82` — `endpoint` is passed to the `S3` client and to the presigner |
| Is `STORAGE_S3_ENDPOINT` exposed as config? | Yes | `config-variables.ts:620` |
| Will `region: auto` (which R2 requires) be rejected? | No | `config-variables.ts:599-602` validates only `@IsString() @IsNotEmpty()`. The `AwsRegion` template-literal type is compile-time only and never sees an env value. |

## Configuration

```bash
STORAGE_TYPE=S3
STORAGE_S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
STORAGE_S3_REGION=auto          # R2 ignores region; "auto" is its convention
STORAGE_S3_NAME=lavivenzia-crm  # bucket name
STORAGE_S3_ACCESS_KEY_ID=<R2 access key id>
STORAGE_S3_SECRET_ACCESS_KEY=<R2 secret access key>
```

Create the credentials in the Cloudflare dashboard under **R2 → Manage API
Tokens**, scoped to **Object Read & Write** on that one bucket. Do not use an
account-wide token.

## Binaries are never stored in PostgreSQL

This was an explicit requirement and Twenty's architecture already satisfies it:

- A `FILES` field stores a **resource path** (a storage key), not bytes.
- The bytes go to whichever driver `STORAGE_TYPE` selects — `local.driver.ts`
  in development, `s3.driver.ts` pointed at R2 in production.
- `lvOnboardingDocument.file` is a `FILES` field, so partner documents follow
  exactly this path.

The only thing in Postgres is the key, the metadata (`originalFilename`,
`mimeType`, `fileSizeBytes`, `uploadedAt`) and the verification state.

## Bucket layout

Keys are built by `file-storage.service.ts` as:

```
<workspaceId>/<applicationUniversalIdentifier>/<fileFolder>/<relativePath>
```

Partner documents therefore land under the workspace prefix, which
`validateStoragePathIsWithinWorkspaceOrThrow` enforces — one workspace cannot
read another's files even if a path is manipulated.

> **Windows note.** That path used to be built with `path.join`, which is
> backslash-separated on Windows and produced keys the server then rejected.
> Fixed in CM-002; see `CORE-MODIFICATIONS.md`. On Linux the bug is invisible,
> which is why it survived upstream.

## Recommended bucket settings

| Setting | Value | Why |
|---|---|---|
| Public access | **Disabled** | Documents are identity papers. They are served through the app's signed URLs, never directly. |
| Object versioning | Enabled | A replaced document keeps its predecessor; versioning is a second safety net under that. |
| Lifecycle rule | None on documents | `SECURITY-RBAC.md` requires an auditable trail; automatic expiry would delete the evidence of what was verified. |
| CORS | App origin only | Direct browser uploads, if enabled later, must not be callable from other origins. |

## Not yet done

- **Backups and restore testing.** R2 is durable but durability is not a backup;
  nothing here protects against an erroneous delete. `LICENSING-DEPLOYMENT.md`
  asks for a restore test, and that remains outstanding (LV-24).
- **Antivirus scanning on upload.** Partners upload arbitrary files. There is no
  scanning step today.
- **Signed-URL expiry policy.** Twenty presigns URLs; the TTL has not been
  reviewed against how long a reviewer realistically keeps a document open.
