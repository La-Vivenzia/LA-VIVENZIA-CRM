import { type SelectOption } from 'src/modules/lv-core/constants/select-options.generated';

// Vocabulary for the partner foundation objects.
//
// Deterministic option ids (UUIDv5-style, derived from the value) so a rebuild
// never renumbers them and existing rows keep their meaning.

export const PARTNER_STATUS_OPTIONS: SelectOption[] = [
  { id: '0c7a17a7-c61c-41fe-b8c4-9fa0a3827e83', value: 'PROSPECTIVE', label: 'Prospective', position: 0, color: 'gray' },
  { id: '9cce106f-27b7-4f90-827f-056536719678', value: 'ONBOARDING', label: 'Onboarding', position: 1, color: 'blue' },
  // Day 9: APPROVED (onboarding approved, not yet live) and SUSPENDED added;
  // PROSPECTIVE/ONBOARDING remain for partners created ahead of an onboarding.
  { id: 'e3f0a1b2-1d9a-4c1e-8f7b-6a5c4d3e2f10', value: 'APPROVED', label: 'Approved', position: 2, color: 'turquoise' },
  { id: 'b4d2eea2-8ab6-41fa-9e4a-b9d054b3b2f5', value: 'ACTIVE', label: 'Active', position: 3, color: 'green' },
  { id: '2a9a0782-60cb-47e2-a029-5d7dd8bc2392', value: 'PAUSED', label: 'Paused', position: 4, color: 'yellow' },
  { id: 'f4a1b2c3-2eab-4d2f-9a8c-7b6d5e4f3a21', value: 'SUSPENDED', label: 'Suspended', position: 5, color: 'red' },
  { id: '5cdb691c-cba1-4c0f-a471-b93ed1fd13ac', value: 'INACTIVE', label: 'Inactive', position: 6, color: 'orange' },
  { id: 'c75b7a7f-72c8-484a-b24e-83ac0d48f284', value: 'OFFBOARDED', label: 'Offboarded', position: 7, color: 'gray' },
];

export const PARTNER_TYPE_OPTIONS: SelectOption[] = [
  { id: '8bdee160-224c-47aa-b2cf-9055f53ab178', value: 'HOST', label: 'Host', position: 0, color: 'blue' },
  { id: 'c573abc3-9a26-4c58-8a4b-d0c60c33139d', value: 'BUSINESS', label: 'Business', position: 1, color: 'purple' },
  { id: '3a73cf36-935a-48b2-a44b-fa0b008248a6', value: 'PROFESSIONAL', label: 'Professional', position: 2, color: 'turquoise' },
  { id: '09b192a8-24c2-4182-a821-60e209616546', value: 'VENUE', label: 'Venue', position: 3, color: 'green' },
  { id: '3a03bd6a-a048-422d-abcb-827b5e7b2799', value: 'COMMUNITY', label: 'Community', position: 4, color: 'yellow' },
  { id: '8ea12119-6209-465a-865e-af01c0e3551c', value: 'OTHER', label: 'Other', position: 5, color: 'gray' },
];

// Day 9: one lifecycle for experiences and properties (ecosystem-lifecycle.ts).
// Values kept from Day 1; CHANGES_REQUIRED and SUSPENDED added; labels read as
// the Founder lifecycle (READY = approved, LIVE = active, RETIRED = archived).
export const EXPERIENCE_STATUS_OPTIONS: SelectOption[] = [
  { id: '1d41e1ae-74f9-4efb-a490-6ceb64d132cf', value: 'DRAFT', label: 'Draft', position: 0, color: 'gray' },
  { id: 'a91d2388-ab61-417b-82c4-f7ddb7e6a324', value: 'IN_REVIEW', label: 'In review', position: 1, color: 'blue' },
  { id: '0a5b6c7d-3fbc-4e30-8b9d-8c7e6f5a4b32', value: 'CHANGES_REQUIRED', label: 'Changes required', position: 2, color: 'orange' },
  { id: '8b3ca44d-e09d-4661-8b38-cd80d474457b', value: 'READY', label: 'Approved', position: 3, color: 'turquoise' },
  { id: 'b233b709-cc6d-461f-8c77-5519888cd853', value: 'LIVE', label: 'Active', position: 4, color: 'green' },
  { id: '2a9a0782-60cb-47e2-a029-5d7dd8bc2392', value: 'PAUSED', label: 'Paused', position: 5, color: 'yellow' },
  { id: '1b6c7d8e-40cd-4f41-9cae-9d8f7a6b5c43', value: 'SUSPENDED', label: 'Suspended', position: 6, color: 'red' },
  { id: '2bd41af6-6a34-4b32-8f99-a751617c7417', value: 'RETIRED', label: 'Archived', position: 7, color: 'gray' },
];

export const PROPERTY_STATUS_OPTIONS: SelectOption[] = EXPERIENCE_STATUS_OPTIONS;

// Founder V1 property categories. Day 1 values kept (relabelled where the
// Founder's name differs); the missing types added.
export const PROPERTY_TYPE_OPTIONS: SelectOption[] = [
  { id: '0e0df73d-368f-457e-91fd-d4a7009e3cde', value: 'VILLA', label: 'Villa', position: 0, color: 'blue' },
  { id: '84b71854-8085-43e2-95c0-4a92d0f7cd4e', value: 'HOMESTAY', label: 'Homestay', position: 1, color: 'turquoise' },
  { id: 'fecbc44d-f6de-443c-bbaf-3ffd9795d442', value: 'BOUTIQUE_HOTEL', label: 'Boutique stay', position: 2, color: 'purple' },
  { id: '3c1d2e3f-51de-4a52-8bcf-ae9f8b7c6d54', value: 'RESORT', label: 'Resort', position: 3, color: 'green' },
  { id: '4d2e3f4a-62ef-4b63-9cd0-bfa09c8d7e65', value: 'HOTEL', label: 'Hotel', position: 4, color: 'blue' },
  { id: '3e854941-9de9-4a6a-8a1c-b910238da3e6', value: 'FARMSTAY', label: 'Farm stay', position: 5, color: 'green' },
  { id: '5e3f4a5b-73fa-4c74-8de1-c0b1ad9e8f76', value: 'HERITAGE_PROPERTY', label: 'Heritage property', position: 6, color: 'orange' },
  { id: '6f4a5b6c-840b-4d85-9ef2-d1c2bea0a087', value: 'LUXURY_STAY', label: 'Luxury stay', position: 7, color: 'yellow' },
  { id: '705b6c7d-951c-4e96-8a03-e2d3cfb1b198', value: 'UNIQUE_STAY', label: 'Unique stay', position: 8, color: 'pink' },
  { id: '58f05a36-d0d9-493a-af53-0540fe182b8d', value: 'CAMP', label: 'Glamping property', position: 9, color: 'yellow' },
  { id: '816c7d8e-a62d-4fa7-9b14-f3e4d0c2c2a9', value: 'HOSTEL', label: 'Hostel', position: 10, color: 'turquoise' },
  { id: '927d8e9f-b73e-40b8-8c25-04f5e1d3d3ba', value: 'RETREAT_CENTRE', label: 'Retreat centre', position: 11, color: 'purple' },
  { id: 'a38e9fa0-c84f-41c9-9d36-1506f2e4e4cb', value: 'PROPERTY_MANAGER', label: 'Property manager', position: 12, color: 'gray' },
  { id: 'b49fa0b1-d950-42da-8e47-2617a3f5f5dc', value: 'PROPERTY_OWNER', label: 'Property owner', position: 13, color: 'gray' },
  { id: '09b192a8-24c2-4182-a821-60e209616546', value: 'VENUE', label: 'Venue', position: 14, color: 'orange' },
  { id: '8ea12119-6209-465a-865e-af01c0e3551c', value: 'OTHER', label: 'Other', position: 15, color: 'gray' },
];

export const EXPERIENCE_DIFFICULTY_OPTIONS: SelectOption[] = [
  { id: 'c5a0b1c2-ea61-43eb-9f58-3728b4a6a6ed', value: 'EASY', label: 'Easy', position: 0, color: 'green' },
  { id: 'd6b1c2d3-fb72-44fc-8a69-4839c5b7b7fe', value: 'MODERATE', label: 'Moderate', position: 1, color: 'yellow' },
  { id: 'e7c2d3e4-0c83-450d-9b7a-594ad6c8c80f', value: 'CHALLENGING', label: 'Challenging', position: 2, color: 'orange' },
  { id: 'f8d3e4f5-1d94-461e-8c8b-6a5be7d9d910', value: 'EXPERT', label: 'Expert only', position: 3, color: 'red' },
];
