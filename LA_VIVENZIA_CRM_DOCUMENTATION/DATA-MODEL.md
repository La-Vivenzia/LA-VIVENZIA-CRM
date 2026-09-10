# Data Model

## Lead
lvLeadId, person, organisation, category, subcategory, location, source, owner, status, priority, opportunityScore, relationshipHealth, lastInteractionAt, nextAction, nextFollowUpAt, onboardingStatus.

## Person
Name, phone, email, location, languages, social profiles, roles, consent, relationship health.

## Organisation
Name, type, location, website, social profiles, description, people, experiences, properties, status.

## Experience
Name, category, description, location, capacity, pricing, availability, languages, images, quality signals, operational readiness, partner.

## Property
Type, location, capacity, pricing, availability, images, documents, owner/manager, partner.

## Onboarding
Lead/partner, current step, progress, health score, missing information, documents, verification state, reviewer, approval state.

## Activity
Channel, timestamp, actor, duration, purpose, summary, sentiment, outcome, objections, commitments, next action, next follow-up.

## Problem
Type, severity, lead, reporter, description, root cause, status, resolution, AI recommendation.

## Document
Type, owner, uploadedAt, expiry, verification status, OCR/extraction result, mismatch flags, reviewer.

## Notification
Recipient, type, priority, related record, message, deep link, read state, createdAt, dueAt, delivery channel.

## AI Insight
Entity, type, score, explanation, evidence, confidence, createdAt, expiry, human decision/status.

## Audit event
Actor, action, entity, entity ID, timestamp, before, after, reason, request/source context.

Use a stable human-readable LV Lead ID while preserving Twenty internal IDs as technical identifiers.
