const crypto = require('crypto');
const fs = require('fs');
const timId = '20202020-0000-4000-8000-000000000001';
const lead1Id = crypto.randomUUID();
const interaction1Id = crypto.randomUUID();
const interaction2Id = crypto.randomUUID();

const sql = `
INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvLead"
(
  "id", "name", "lvLeadId", "organisationName", "category", "subcategory",
  "location", "source", "status", "priority", "emailsPrimaryEmail",
  "phonesPrimaryPhoneNumber", "ownerId", "createdAt", "updatedAt",
  "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId"
) VALUES (
  '${lead1Id}', 'LV Test Account', 'LVT-001', 'LV Test Organisation', 'EXPERIENCE', 'HOST',
  'Goa, India', 'WEBSITE', 'NEW', 'HIGH', 'lvtest@example.com',
  '+919876543210', '${timId}', NOW(), NOW(),
  'Tim Cook', 'Tim Cook', '${timId}', '${timId}'
);

INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvInteraction"
(
  "id", "name", "channel", "direction", "occurredAt", "durationMinutes",
  "purpose", "summaryBlocknote", "sentiment", "outcome", "leadId", "actorId",
  "createdAt", "updatedAt",
  "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId"
) VALUES (
  '${interaction1Id}', 'Initial Call', 'PHONE', 'OUTBOUND', NOW() - INTERVAL '1 day', 15.5,
  'INTRODUCTION', '[{"type":"paragraph","content":"Discussed the potential of listing their experience on La Vivenzia."}]', 'POSITIVE', 'INTERESTED',
  '${lead1Id}', '${timId}', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
  'Tim Cook', 'Tim Cook', '${timId}', '${timId}'
);

INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvInteraction"
(
  "id", "name", "channel", "direction", "occurredAt", "durationMinutes",
  "purpose", "summaryBlocknote", "sentiment", "outcome", "leadId", "actorId",
  "createdAt", "updatedAt",
  "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId"
) VALUES (
  '${interaction2Id}', 'Follow up email', 'EMAIL', 'OUTBOUND', NOW() - INTERVAL '2 hours', 5,
  'FOLLOW_UP', '[{"type":"paragraph","content":"Sent the brochure and pricing details."}]', 'NEUTRAL', 'AWAITING_RESPONSE',
  '${lead1Id}', '${timId}', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours',
  'Tim Cook', 'Tim Cook', '${timId}', '${timId}'
);
`;
fs.writeFileSync('insert_dummy_data.sql', sql);
