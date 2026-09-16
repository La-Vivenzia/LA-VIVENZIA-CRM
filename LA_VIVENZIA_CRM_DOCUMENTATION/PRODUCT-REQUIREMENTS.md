# La Vivenzia CRM — Product Requirements V1

## Vision
The CRM is the operating system for the relationship journey: **Discovery → Lead → Qualification → Engagement → Conversion → Onboarding → Activation → Experience → Relationship → Growth**.

## Objectives
- Capture hosts, partners, experiences, businesses, professionals and communities.
- Classify, assign and track every relationship.
- Make follow-up visible and actionable.
- Support partner onboarding and verification.
- Provide role-specific dashboards and management visibility.
- Maintain permissions, auditability and data integrity.
- Allow configurable categories, fields and workflows.
- Become the foundation for the La Vivenzia Experience Operating System.

## Categories
Experience ecosystem: host, expert, creator, curator, guide, facilitator, instructor, mentor, local/cultural/adventure/wellness/food/heritage/nature expert, artist, performer, chef, storyteller, photographer, travel expert, community/event organiser.

Stay ecosystem: villa, homestay, boutique stay, resort, hotel, farm stay, heritage/luxury/unique stay, glamping, hostel, retreat, manager/owner.

Business partners: restaurant, cafe, bar, cloud kitchen, event company, travel company, tour operator, transport, concierge, wedding/event venue, corporate, retail and brand partner.

People/community: volunteer, experience hunter, ambassador, community member, creator/influencer, photographer, content creator, affiliate/referral, intern, freelancer, consultant, mentor, investor, advisor, potential employee, alumni.

Lead sources: website, Instagram, Facebook, LinkedIn, WhatsApp, referral, phone, walk-in, event, imported, partner referral, other.

## Dynamic categories
Admin can create a category, define fields, define workflow, define responsible role and activate it without developer intervention.

*Cross-check (Day 9): not yet implemented — categories are code constants plus generated SELECT options; the design for a taxonomy object is recorded in DAY_9_ECOSYSTEM.md §3.*

## Universal lead profile
Name, organisation, LV Lead ID, category/subcategory, location, source, owner, status, priority, opportunity score, last interaction, next action, next follow-up, onboarding status, relationship health, AI recommendation and custom fields.

## Lifecycle
Discovered → New → Qualifying → Assigned → Contacted → Engaged → Interested → Negotiation/Discussion → Onboarding Initiated → Onboarding in Progress → Verification → Approved → Live/Active → Growth.

Additional states: Not Interested, Follow Up Later, No Response, Wrong Contact, Duplicate, Not Eligible, Temporarily Closed, Lost, Rejected, Dormant.

## Lead capture
Instagram profile/screenshot/post URL/image/handle, website URL, images, visiting card, brochure/poster/flyer, manual, referral, offline events, cafe/hotel/market/exhibition/networking/community. AI can create a preliminary lead, but humans confirm critical fields.

## Duplicate detection
Show similarity before creation, e.g. 91%. Actions: Merge, Create New, Ignore. Merge/delete must be permission controlled and audited.

## Interactions
Record date/time, team member, channel, duration, purpose, summary, sentiment, outcome, problems, commitments, next action and next follow-up. Channels include phone, email, WhatsApp, Instagram, LinkedIn, video call, meeting, event, website, internal note, document and form.

## Smart follow-up
Every interaction can produce a next action, due date, priority and reminder. Priority: Critical / High / Medium / Low.

## Role workspaces
Experience Hunter: leads, qualification, high-potential records, AI lead scanner, quick capture and problems.

Lead Coordinator: calls, email/WhatsApp follow-ups, meetings, overdue, waiting response, likely conversion, stuck and onboarding-ready.

Onboarding Expert: new onboardings, pending documents, incomplete forms, verification, help required, review, delays and approval-ready records.

Admin: funnel, team performance, control tower, SLA breaches, duplicates, unowned leads, incomplete records and management intelligence.

## Partner onboarding
*Cross-check (Day 9): implemented end to end — approval creates / links the Partner (LVP code), the Experience or Property for its category, links Person and Organisation, mirrors the lead lifecycle and gates activation on a deterministic readiness check; see docs/CRM-ECOSYSTEM.md.*

Ten steps: Basic Information → About You → Experience → Location → Pricing → Availability → Images → Documents → Policies → Final Review. Include progress, save/resume, missing information, verification, reviewer, internal notes and approval/rejection reasons.

AI can explain fields, improve wording, extract document data and detect missing information/inconsistency, but never fabricate partner facts.

## Document verification
Check readability, missing pages, expiry, name mismatch, inconsistencies, duplicate document and wrong type. Human approval remains authoritative.

## Communication assistant
Email, WhatsApp, Instagram, follow-ups, meeting invitations, explanations and objections. Controls: Professional, Friendly, Shorter, Persuasive, Human, Translate, Explain Simply, Generate Follow-up.

## Assignment
Use geography, category, workload, expertise, language, lead value and existing relationship. Support manual assignment and round robin.

## SLA
New lead contact 24h; interested follow-up 48h; onboarding first action 24h; missing document reminder 48h. Breaches must be visible and escalated.

## Search/Copilot
Natural language examples: Raj; Lonavala villas; leads generated by Saumay; pending documents; high-potential Pune leads; not contacted in 48 hours. Copilot should answer what to work on today, likely converters, overdue work, why a lead is stuck, relationship summary and draft communications.

## Security
RBAC, field/row controls where available, MFA, encryption, secure sessions, auditability, backups, export controls, restricted deletion and API authentication.

## Mobile
Lead capture under 30 seconds. Quick capture: image, website, Instagram, manual, referral, voice. Visiting card: Photo → OCR → Confirm → Lead.

## North star
**La Vivenzia Experience Operating System** with an Experience Graph of People + Places + Businesses + Experiences + Communities + Relationships + Behaviour + Demand.
