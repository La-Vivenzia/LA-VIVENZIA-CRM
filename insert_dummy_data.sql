
INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvLead"
(
  "id", "name", "lvLeadId", "organisationName", "category", "subcategory",
  "location", "source", "status", "priority", "emailsPrimaryEmail",
  "phonesPrimaryPhoneNumber", "ownerId", "createdAt", "updatedAt",
  "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId"
) VALUES (
  'a9bbe55d-4994-447a-85a8-0a937a8a1fb0', 'LV Test Account', 'LVT-001', 'LV Test Organisation', 'EXPERIENCE', 'HOST',
  'Goa, India', 'WEBSITE', 'NEW', 'HIGH', 'lvtest@example.com',
  '+919876543210', '20202020-0000-4000-8000-000000000001', NOW(), NOW(),
  'Tim Cook', 'Tim Cook', '20202020-0000-4000-8000-000000000001', '20202020-0000-4000-8000-000000000001'
);

INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvInteraction"
(
  "id", "name", "channel", "direction", "occurredAt", "durationMinutes",
  "purpose", "summaryBlocknote", "sentiment", "outcome", "leadId", "actorId",
  "createdAt", "updatedAt",
  "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId"
) VALUES (
  '05a31637-4efc-4b4f-9e1c-71fbd0a30889', 'Initial Call', 'PHONE', 'OUTBOUND', NOW() - INTERVAL '1 day', 15.5,
  'INTRODUCTION', '[{"type":"paragraph","content":"Discussed the potential of listing their experience on La Vivenzia."}]', 'POSITIVE', 'INTERESTED',
  'a9bbe55d-4994-447a-85a8-0a937a8a1fb0', '20202020-0000-4000-8000-000000000001', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
  'Tim Cook', 'Tim Cook', '20202020-0000-4000-8000-000000000001', '20202020-0000-4000-8000-000000000001'
);

INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvInteraction"
(
  "id", "name", "channel", "direction", "occurredAt", "durationMinutes",
  "purpose", "summaryBlocknote", "sentiment", "outcome", "leadId", "actorId",
  "createdAt", "updatedAt",
  "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId"
) VALUES (
  '4f3bf14f-a891-4950-b838-21ca239b3bdb', 'Follow up email', 'EMAIL', 'OUTBOUND', NOW() - INTERVAL '2 hours', 5,
  'FOLLOW_UP', '[{"type":"paragraph","content":"Sent the brochure and pricing details."}]', 'NEUTRAL', 'AWAITING_RESPONSE',
  'a9bbe55d-4994-447a-85a8-0a937a8a1fb0', '20202020-0000-4000-8000-000000000001', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours',
  'Tim Cook', 'Tim Cook', '20202020-0000-4000-8000-000000000001', '20202020-0000-4000-8000-000000000001'
);
