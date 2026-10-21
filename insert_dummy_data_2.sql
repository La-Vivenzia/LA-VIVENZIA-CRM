
INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."person"
(
  "id", "nameFirstName", "nameLastName", "emailsPrimaryEmail",
  "createdAt", "updatedAt",
  "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId"
) VALUES (
  'cca3bc0d-ff74-4045-929d-88677b16c3f9', 'Tim', 'Cook (Contact)', 'tim@apple.dev',
  NOW(), NOW(),
  'Tim Cook', 'Tim Cook', '20202020-0000-4000-8000-000000000001', '20202020-0000-4000-8000-000000000001'
);

INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvProperty"
(
  "id", "name", "propertyCode", "status", "propertyType", "location", "destination",
  "ownerId", "managerId", "createdAt", "updatedAt",
  "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId"
) VALUES (
  '6dc4b055-c825-48ee-9418-215960432743', 'Sunset Villa', 'PRP-001', 'LIVE', 'VILLA', 'Goa, India', 'Goa',
  '20202020-0000-4000-8000-000000000001', 'cca3bc0d-ff74-4045-929d-88677b16c3f9', NOW(), NOW(),
  'Tim Cook', 'Tim Cook', '20202020-0000-4000-8000-000000000001', '20202020-0000-4000-8000-000000000001'
);

INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvExperience"
(
  "id", "name", "experienceCode", "status", "category", "location", "destination",
  "ownerId", "hostId", "createdAt", "updatedAt",
  "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId"
) VALUES (
  'fe884545-6e94-4b33-b98e-6e83ffd363dc', 'Sunset Yacht Tour', 'EXP-001', 'LIVE', 'EXPERIENCE', 'Goa, India', 'Goa',
  '20202020-0000-4000-8000-000000000001', 'cca3bc0d-ff74-4045-929d-88677b16c3f9', NOW(), NOW(),
  'Tim Cook', 'Tim Cook', '20202020-0000-4000-8000-000000000001', '20202020-0000-4000-8000-000000000001'
);
