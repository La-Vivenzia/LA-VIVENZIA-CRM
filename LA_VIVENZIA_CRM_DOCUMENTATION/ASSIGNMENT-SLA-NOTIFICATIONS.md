# Assignment, SLA & Notifications

## Assignment
Use geography, category, workload, expertise, language, lead value and existing relationship. Support manual, rule-based and round-robin/least-loaded assignment where available.

## Initial SLAs
- New lead contact: 24h
- Interested follow-up: 48h
- Onboarding first action: 24h
- Missing document reminder: 48h

## SLA states
On Track, Due Soon, Due, Breached, Escalated, Resolved.

## Breach behaviour
Notify owner, notify manager according to rule, increase priority where configured, create escalation task, audit the event and surface it in Control Tower.

## Notification types
Assignment, follow-up due/overdue, SLA breach, lead reply, onboarding started/completed, document rejected, reassignment, approval required, mention and escalation.

Delivery: in-app first, email second, optional WhatsApp/push. Notifications must be idempotent.

## Control Tower
Hot leads without follow-up, stuck onboarding, unowned leads, duplicates, incomplete contact information and SLA breaches.
