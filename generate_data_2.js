const crypto = require('crypto');
const fs = require('fs');
const timWorkspaceMemberId = '20202020-0000-4000-8000-000000000001';
const personId = crypto.randomUUID();
const propertyId = crypto.randomUUID();
const expId = crypto.randomUUID();

const sql = `
INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."person"
(
  "id", "nameFirstName", "nameLastName", "emailsPrimaryEmail",
  "createdAt", "updatedAt",
  "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId"
) VALUES (
  '${personId}', 'Tim', 'Cook (Contact)', 'tim@apple.dev',
  NOW(), NOW(),
  'Tim Cook', 'Tim Cook', '${timWorkspaceMemberId}', '${timWorkspaceMemberId}'
);

INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvProperty"
(
  "id", "name", "propertyCode", "status", "propertyType", "location", "destination",
  "ownerId", "managerId", "createdAt", "updatedAt",
  "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId"
) VALUES (
  '${propertyId}', 'Sunset Villa', 'PRP-001', 'LIVE', 'VILLA', 'Goa, India', 'Goa',
  '${timWorkspaceMemberId}', '${personId}', NOW(), NOW(),
  'Tim Cook', 'Tim Cook', '${timWorkspaceMemberId}', '${timWorkspaceMemberId}'
);

INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvExperience"
(
  "id", "name", "experienceCode", "status", "category", "location", "destination",
  "ownerId", "hostId", "createdAt", "updatedAt",
  "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId"
) VALUES (
  '${expId}', 'Sunset Yacht Tour', 'EXP-001', 'LIVE', 'EXPERIENCE', 'Goa, India', 'Goa',
  '${timWorkspaceMemberId}', '${personId}', NOW(), NOW(),
  'Tim Cook', 'Tim Cook', '${timWorkspaceMemberId}', '${timWorkspaceMemberId}'
);
`;
fs.writeFileSync('insert_dummy_data_2.sql', sql);
