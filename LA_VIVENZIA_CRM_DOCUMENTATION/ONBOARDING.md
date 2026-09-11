# Partner Onboarding

## Flow
1. Basic information
2. About you
3. Experience
4. Location
5. Pricing
6. Availability
7. Images
8. Documents
9. Policies
10. Final review

## Requirements
Progress, save/resume, missing-info checklist, validation, documents, verification, reviewer, internal notes, partner communication and approval/rejection reasons.

## AI assistance
Explain fields, improve wording, extract data and detect missing/inconsistent information. Never fabricate partner facts. Clearly distinguish suggestions from verified facts.

## Health score
Form completeness + image completeness + document completeness + experience quality + pricing + availability + operational readiness.

## Statuses
Not Started, Invited, Initiated, In Progress, Waiting for Partner, Verification, Internal Review, Changes Requested, Approved, Rejected, Activated.

---

# Implementation status (2026-09-10, Remediation 2)

## Document upload — real

The Documents and Images steps previously rendered a text box asking the
partner to type "uploaded file paths, comma separated". Nothing was uploaded
and no reviewer could open anything. That is replaced by a real picker.

The flow, and where each part is enforced:

```
pick a file
  → browser validation        (fast feedback only)
  → uploadFile()              Twenty's own FILES upload; sniffs magic bytes
  → POST /onboarding/documents/register
      → validateUpload()      THE decision — allowlist, size, safe path
      → creates lvOnboardingDocument as PENDING, with an audit entry
```

The browser check is a courtesy; the route runs the identical check and that is
the one that counts, because anything a client validates a client can skip.

**Accepted:** PDF, JPEG, PNG, WEBP, up to 15 MB. Twenty derives the type from
the bytes, so a `.exe` renamed to `.pdf` is detected — verified against the
live route, which refused it with `UNSUPPORTED_TYPE`.

Bytes never touch the application container: a FILES field stores a reference,
and the driver puts the object wherever `STORAGE_TYPE` points (R2 in
production — see STORAGE-R2.md).

## Preview

Signed, short-lived URLs, fetched only when a reviewer opens a document.
Images render inline, PDFs in a frame, anything else is offered as a download.
The bucket stays private; no object is ever made public to simplify preview.

## Reviewer workflow

`lv-document-review` is the reviewer's workspace: assign a reviewer, see every
document with its metadata, open it, mark the issues found, and decide.

The seven verification checks — unreadable, missing page, expired, wrong type,
name mismatch, inconsistent information, duplicate — are **reviewer
judgements**. Nothing is automated, nothing is inferred, and nothing is ever
pre-ticked. AI-INTELLIGENCE.md places extraction in a later phase, where it
would populate these as a *suggestion* for a human to confirm.

The UI only offers transitions the state machine allows, but that is
convenience. The route applies the same guards, so a direct API call is
refused identically. Verified live:

| Attempt | Result |
|---|---|
| PENDING → VERIFIED (skipping review) | refused, `NOT_ALLOWED` |
| VERIFIED with no named human | refused, `ACTOR_REQUIRED` |
| PENDING → UNDER_REVIEW by a reviewer | applied |
| UNDER_REVIEW → VERIFIED by a reviewer | applied |

## Approval

`POST /onboarding/transition`, unchanged in its guards and now actually
reachable. A full run reached APPROVED through
INVITED → INITIATED → IN_PROGRESS → VERIFICATION → INTERNAL_REVIEW, and an
approval attempt with no human actor was refused with `ACTOR_REQUIRED`.

Approval still requires a named reviewer and every uploaded document VERIFIED.

## Document expiry

`lv-expire-documents` runs at 02:15 daily and moves verified documents to
EXPIRED once their date has passed. Executed for real against a document
back-dated to yesterday: it became EXPIRED, `verifiedAt` was cleared and the
EXPIRED flag was set, with the audit trail preserved.

**REMINDER POLICY IS NOT IMPLEMENTED, AND THAT IS A DECISION YOU STILL OWE.**
This document defines no lead time for warning a partner before a document
lapses — 30 days, 7 days, on the day, or not at all. Inventing a schedule would
be inventing a business rule, so the sweep detects expiry and records it, and
sends no advance warning.

## Health score — implemented, not invented

Unlike opportunity score and relationship health, the onboarding health score
*is* defined: `onboarding-progress.ts` weights required completeness 45,
optional richness 20, images 15 and document verification 20, and returns a
per-factor breakdown. It is arithmetic over answers the partner gave. It is not
a prediction and it is not AI.
