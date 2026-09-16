# Capture, OCR & Voice

## Goal
Experience Hunters capture a lead in under 30 seconds.

## Modes
Instagram, website, image, visiting card, manual, referral, voice and offline event.

*Implemented on Day 8 as the Capture Lead experience — 19 methods, one workflow:
see `docs/CRM-LEAD-CAPTURE.md` and `DAY_8_LEAD_CAPTURE.md`. Voice remains
unimplemented (no recording or transcription is offered).*

## Visiting card
Photo → OCR → Review → Confirm → Lead.

Extract name, organisation, phone, email, website, location and role. Always show confirmation before creation.

## Social capture
Accept handle, profile URL, screenshot, post URL and uploaded image. AI can provide preliminary classification and missing-information suggestions.

## Voice
Extract person, organisation, location, category, interest, objection, commitment, follow-up and next action.

## Future mobile hardening
Offline queue, retry, local draft, camera integration and background upload.

## Provenance
Every automated extraction must identify whether data was user-entered, OCR-extracted, AI-suggested, imported or synced.
