# Change-set C — application configuration and code follow-ups

Recorded during the Cloudflare security and DNS remediation task. **Nothing in this
file has been implemented.** These items are deliberately out of scope for the
Cloudflare task and must not be bundled into it.

Not committed. No commits or pushes were made while recording this.

---

## C1 — Invitation email failure is now uncaught (introduced by the SMTP fix)

**Severity:** high — breaks team invitation at exactly the moment email is misconfigured.

**Do not reimplement or revert the SMTP fix.** The driver change is correct and its
tests pass. This item is about the *call site* that the corrected driver now exposes.

### What changed upstream of it

`packages/twenty-server/src/engine/core-modules/email/drivers/smtp.driver.ts`
previously used fire-and-forget `.then().catch()`, so a send failure was swallowed
and logged. It now `await`s `transport.sendMail` and rethrows. That is the right
behaviour for a driver.

### The defect

`packages/twenty-server/src/engine/core-modules/workspace-invitation/services/workspace-invitation.service.ts`

- Invitation tokens are created first, via `Promise.allSettled`, and are therefore
  already committed before any email is attempted.
- The send loop (`for (const invitation of invitationResults)`) ends in a bare
  `await this.emailService.send({ ... })` at approximately line 410, with **no
  try/catch**.
- `await this.onboardingService.completeOnboardingInviteTeamStep({ ... })` runs
  *after* the loop.

With the driver now rethrowing, one SMTP failure throws out of the whole method:

1. the loop aborts, so every invitee after the failing one is never emailed;
2. `completeOnboardingInviteTeamStep` is skipped;
3. the mutation returns a GraphQL error even though invitation records exist.

The old failure mode was silent success. The new one is total failure plus partial
state. Both are wrong; the new one is louder, which is an improvement, but it is
not the intended end state.

### Also relevant

- No queue retry exists for this path. Every `emailService.send` caller is a service
  (auth, reset-password, invitation, email-verification, billing-reminder,
  approved-access-domain, admin-panel); none is a job, processor or cron.
  Invitation email is sent **synchronously inside the mutation**. Any handoff note
  claiming BullMQ will retry these sends is incorrect for this codebase.

### Suggested direction (not implemented, not approved)

Collect per-recipient outcomes inside the loop instead of letting the first failure
escape: wrap each `send` in try/catch, accumulate failed recipients, always run
`completeOnboardingInviteTeamStep`, and return per-recipient success/failure so the
UI can report "3 of 4 invitations emailed" rather than a blanket error. Needs a
decision on the GraphQL response shape before anyone writes code.

---

## C2 — `IS_SIGN_UP_DISABLED` is absent from all task definitions

`deploy/aws/task-web.json`, `task-worker.json` and `task-ops.json` contain no
`IS_SIGN_UP_DISABLED` entry. It exists only as a manual post-first-signup step in
`docs/AWS-DEPLOYMENT-PLAN.md` (§12) and in
`deploy/aws/CRM-TEARDOWN-AND-RESTART.md` (§F step 14).

Leaving it to a manual step means any future origin is, between first signup and
that step, an open-registration CRM on a public hostname. It belongs in the task
definition as an explicit value. Deferred: editing task definitions is AWS
configuration, which is frozen.

---

## C3 — `docs/AWS-DEPLOYMENT-PLAN.md` is stale on email configuration

The plan states `EMAIL_DRIVER=LOGGER` and lists "Resend SMTP for `EMAIL_DRIVER`" as
outstanding. `deploy/aws/task-web.json` already sets:

- `EMAIL_DRIVER=SMTP`
- `EMAIL_SMTP_HOST=smtp.resend.com`, `EMAIL_SMTP_PORT=465`, `EMAIL_SMTP_USER=resend`
- `EMAIL_FROM_ADDRESS` / `EMAIL_SYSTEM_ADDRESS` = `crm@mail.lavivenzia.com`
- `EMAIL_FROM_NAME=La Vivenzia CRM`

with `EMAIL_SMTP_PASSWORD` supplied from Secrets Manager. The doc should be
corrected so nobody re-does work that is already in the task definition. Belongs in
change-set D (docs).

---

## Verified as *not* a problem (no action needed)

Checked while auditing for Cloudflare compatibility; recorded so it is not
re-investigated.

- **Invitation and reset links are not Host-header dependent.** They are built by
  `workspaceDomainsService.buildWorkspaceURL` -> `getTwentyWorkspaceUrl` ->
  `domainServerConfigService.getFrontUrl()`. With `IS_MULTIWORKSPACE_ENABLED=false`
  the hostname is used unmodified, so links derive from `FRONTEND_URL`
  (`https://crm.lavivenzia.com` in `task-web.json`), not from the request.
- **`TRUST_PROXY` default is correct for this topology.** Default
  `loopback, linklocal, uniquelocal` honours `X-Forwarded-Proto` from an in-VPC ALB
  (`10.20.0.0/16`, RFC1918), so `request.protocol` resolves to `https` when TLS is
  terminated upstream.
- **`SERVER_URL` and `FRONTEND_URL` are the same origin**, so CORS is not a concern
  for the proxied path.
- **No WebSockets and no GraphQL subscriptions** anywhere in server or front, so
  Cloudflare proxying introduces no long-lived-connection concerns.
