# Changeset 2/3 — email DNS remediation plan (NOT APPLIED)

Read-only investigation, 13 October 2026. **No DNS record was created, modified or
deleted.** Cloudflare access for this work was read-only (`#dns_records:read`).
Not committed.

Zone `lavivenzia.com` / `fe3e69b29578fb05ba41fdb6a3d00d8a`, account
`de0f88c61c4da81f1827a2c918a4f6ed`, Free plan, 19 records.

---

## Observed defects

### D1 — DMARC is void (two records)

`_dmarc.lavivenzia.com` carries two valid `v=DMARC1` records:

| ID | Value |
|---|---|
| `8add2daefe65926aebe95288b248fc64` | `v=DMARC1; p=none;` |
| `f53066d27c350f1dc7f15602e54a30f1` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` |

RFC 7489 section 6.6.3: when more than one valid record remains, receivers MUST
treat the domain as publishing no DMARC record. **Effective live policy is
therefore none** — the quarantine record is not being enforced anywhere.

No record at `_dmarc.mail.lavivenzia.com`, so the subdomain inherits the
organizational-domain policy.

### D2 — apex SPF is permerror

`lavivenzia.com` TXT `fe349fb36e047194d58c10a5ae37a161`:

    v=spf1 include:dc-aa8e722993._spfm.lavivenzia.com ~all

`dc-aa8e722993._spfm.lavivenzia.com` **does not exist** — confirmed against the
full 19-record inventory, not just a single query. RFC 7208 section 5.2: an
`include` whose target has no SPF record yields **permerror**; the trailing `~all`
is never reached.

Root cause: `_spfm` is GoDaddy's SPF-merge service and the zone's
`original_name_servers` are `ns67` / `ns68.domaincontrol.com`. The record was not
carried across in the migration to Cloudflare.

**Consequence:** all Google Workspace mail from `@lavivenzia.com` currently
evaluates to SPF permerror.

---

## Sending services (verified)

| Service | Visible From | Envelope / return path | DKIM |
|---|---|---|---|
| Resend (transactional CRM) | `crm@mail.lavivenzia.com` | `send.mail.lavivenzia.com` to Resend | `resend` selector, `d=mail.lavivenzia.com` |
| Google Workspace (human mail) | `@lavivenzia.com` | apex | `google` selector |

**Resend is unaffected by D2.** SPF authenticates the envelope sender, not the
visible From. `send.mail.lavivenzia.com` is a CNAME to `send.forge.rmta.net`, which
publishes its own `v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24
~all` plus bounce MX `feedback.forge.rmta.net`. Resend's SPF already passes and
aligns relaxed. **Do not add a Resend include to the apex, and do not add an SPF
record at `mail.lavivenzia.com`** — neither is consulted.

`_spf.google.com` is flat (ip4/ip6 only, no nested includes) = 1 DNS lookup of 10.

The `resend._domainkey` record has no `v=DKIM1` tag. That is valid — RFC 6376
section 3.6.1 makes `v=` optional with an implicit `DKIM1` default. Not a defect.

---

## Proposed changes (require founder approval + Zone / DNS / Edit)

| # | Action | ID | Before | After |
|---|---|---|---|---|
| 1 | DELETE | `f53066d27c350f1dc7f15602e54a30f1` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | removed |
| 2 | UPDATE | `8add2daefe65926aebe95288b248fc64` | `v=DMARC1; p=none;` | `v=DMARC1; p=none; rua=mailto:dmarc_rua@onsecureserver.net;` |
| 3 | UPDATE | `fe349fb36e047194d58c10a5ae37a161` | `v=spf1 include:dc-aa8e722993._spfm.lavivenzia.com ~all` | `v=spf1 include:_spf.google.com ~all` |

Nothing to add. Preserve untouched: all 5 Google MX, both DKIM records, both Resend
CNAMEs, Google and Vercel verification TXTs, the ACM validation CNAME, and the
apex / www / demo web records. No TTL or proxy-status changes.

Changes 1+2 are independent of change 3 and can ship as separate changesets.
Pairing them is preferable, since DMARC reporting is what proves the SPF fix worked.

### Why keep `p=none` rather than the quarantine record

Because the live effective policy is already none, retaining the quarantine record
would *raise* enforcement in one step rather than preserve current behaviour. There
is not yet evidence that every legitimate sender passes alignment: Google
Workspace's SPF is broken (D2), and DKIM signing cannot be confirmed from DNS alone
— that needs `Authentication-Results` from a delivered message. Keep `p=none`,
collect aggregate reports, then raise enforcement on evidence.

The `rua` is carried forward because external reporting is verified functional:
RFC 7489 section 7.1 requires an authorization record at the third-party domain, and
`lavivenzia.com._report._dmarc.onsecureserver.net` returns `"v=DMARC1"`. Without
`rua` there is no visibility and no path to enforcement.

Caveat: `onsecureserver.net` is GoDaddy infrastructure, consistent with the old
nameservers. Reports go to a third party the team may not monitor. Preserve for
continuity; decide separately whether to redirect to a mailbox La Vivenzia controls.

---

## Risks and rollback

DMARC (1+2): negligible. "No policy" to explicit `p=none` changes no receiver's
delivery decision. Alignment failures merely become visible in reports.

SPF (3): the real risk is an **unknown apex sender**. Today the apex is permerror
for everyone, which many receivers treat leniently; afterwards anything sending as
`@lavivenzia.com` that is not Google gets an explicit softfail. `~all` limits the
damage and `p=none` means DMARC will not act on it, but it must be resolved before
any enforcement increase. See open question 1.

Rollback — exact prior values:

- Re-create TXT `_dmarc.lavivenzia.com` = `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` (TTL Auto, unproxied)
- Set `8add2daefe65926aebe95288b248fc64` back to `v=DMARC1; p=none;`
- Set `fe349fb36e047194d58c10a5ae37a161` back to `v=spf1 include:dc-aa8e722993._spfm.lavivenzia.com ~all`

Record IDs change on re-creation; names, types and values are what matter. At Auto
TTL (300 s) rollback is visible within about 5 minutes. Rollback restores both
defects, so it is a safety valve, not a resting place.

---

## Verification after applying

    nslookup -type=TXT lavivenzia.com chuck.ns.cloudflare.com        # one SPF, Google include, no _spfm
    nslookup -type=TXT _dmarc.lavivenzia.com chuck.ns.cloudflare.com # exactly ONE DMARC record
    nslookup -type=TXT _dmarc.lavivenzia.com nola.ns.cloudflare.com  # same on both NS
    nslookup -type=MX  lavivenzia.com 1.1.1.1                        # expect 5
    nslookup -type=TXT google._domainkey.lavivenzia.com 1.1.1.1      # unchanged
    nslookup -type=TXT resend._domainkey.mail.lavivenzia.com 1.1.1.1 # unchanged
    nslookup -type=TXT send.mail.lavivenzia.com 1.1.1.1              # Resend SPF via CNAME, unchanged

Via the read-only Cloudflare API: record count stays 19;
`_dmarc.lavivenzia.com` returns exactly one record;
`f53066d27c350f1dc7f15602e54a30f1` returns `81044 Record does not exist`.

Query authoritative nameservers first. Recursive resolvers may serve old values for
up to the 300 s TTL, so a stale answer is not a failed change. Real proof arrives
with the first aggregate reports showing `spf=pass dmarc=pass` for both senders.

---

## Open questions

1. **Does anything other than Google Workspace send as `@lavivenzia.com`?** The
   only genuine blocker on change 3. A website contact form, invoicing or
   e-signature tool, or newsletter platform would each need its own mechanism. Not
   determinable from DNS or from this repository.
2. **Is `dmarc_rua@onsecureserver.net` monitored by anyone at La Vivenzia?**
   Authorized and functional, but GoDaddy-side.
3. **What does `LV_EMAIL_FROM` resolve to in production?** See the finding below.
4. **Is Google DKIM actually signing?** The DNS record exists; confirmation needs a
   delivered message's `Authentication-Results` header or the Workspace console.

Items 2 to 4 do not block the DMARC fix. Item 1 blocks the SPF fix.

---

## New finding — `LV_EMAIL_FROM` example points at the apex

`packages/twenty-apps/internal/lavivenzia-crm/src/application-config.ts` lines 67-71
declare `LV_EMAIL_FROM` with `value: ''` and this description:

> From address for notification email, e.g. "La Vivenzia CRM &lt;crm@lavivenzia.com&gt;".

That example uses the **apex** domain, while Twenty's `EMAIL_FROM_ADDRESS` uses
`crm@mail.lavivenzia.com`. Only `mail.lavivenzia.com` is set up in Resend — its
DKIM and return-path records live there. Whoever configures the application
variable is steered toward an apex From address that Resend may refuse to send,
since the apex is not the verified sending domain.

This does not change the SPF plan: even with an apex From, Resend's envelope domain
is still `send.mail.lavivenzia.com`, so SPF passes there and aligns relaxed. The
risk is Resend rejecting the send outright, plus unnecessary divergence between the
two sender paths.

Recommended (change-set C/D, not this changeset): correct the example to
`crm@mail.lavivenzia.com` so the two paths agree. A one-line description change,
deliberately not made here, since this task is DNS-only.
