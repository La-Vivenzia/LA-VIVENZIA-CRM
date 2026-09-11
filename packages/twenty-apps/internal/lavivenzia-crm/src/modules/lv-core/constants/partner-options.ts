import { type SelectOption } from 'src/modules/lv-core/constants/select-options.generated';

// Vocabulary for the partner foundation objects.
//
// Deterministic option ids (UUIDv5-style, derived from the value) so a rebuild
// never renumbers them and existing rows keep their meaning.

export const PARTNER_STATUS_OPTIONS: SelectOption[] = [
  { id: '0c7a17a7-c61c-41fe-b8c4-9fa0a3827e83', value: 'PROSPECTIVE', label: 'Prospective', position: 0, color: 'gray' },
  { id: '9cce106f-27b7-4f90-827f-056536719678', value: 'ONBOARDING', label: 'Onboarding', position: 1, color: 'blue' },
  { id: 'b4d2eea2-8ab6-41fa-9e4a-b9d054b3b2f5', value: 'ACTIVE', label: 'Active', position: 2, color: 'green' },
  { id: '2a9a0782-60cb-47e2-a029-5d7dd8bc2392', value: 'PAUSED', label: 'Paused', position: 3, color: 'yellow' },
  { id: '5cdb691c-cba1-4c0f-a471-b93ed1fd13ac', value: 'INACTIVE', label: 'Inactive', position: 4, color: 'orange' },
  { id: 'c75b7a7f-72c8-484a-b24e-83ac0d48f284', value: 'OFFBOARDED', label: 'Offboarded', position: 5, color: 'red' },
];

export const PARTNER_TYPE_OPTIONS: SelectOption[] = [
  { id: '8bdee160-224c-47aa-b2cf-9055f53ab178', value: 'HOST', label: 'Host', position: 0, color: 'blue' },
  { id: 'c573abc3-9a26-4c58-8a4b-d0c60c33139d', value: 'BUSINESS', label: 'Business', position: 1, color: 'purple' },
  { id: '3a73cf36-935a-48b2-a44b-fa0b008248a6', value: 'PROFESSIONAL', label: 'Professional', position: 2, color: 'turquoise' },
  { id: '09b192a8-24c2-4182-a821-60e209616546', value: 'VENUE', label: 'Venue', position: 3, color: 'green' },
  { id: '3a03bd6a-a048-422d-abcb-827b5e7b2799', value: 'COMMUNITY', label: 'Community', position: 4, color: 'yellow' },
  { id: '8ea12119-6209-465a-865e-af01c0e3551c', value: 'OTHER', label: 'Other', position: 5, color: 'gray' },
];

export const EXPERIENCE_STATUS_OPTIONS: SelectOption[] = [
  { id: '1d41e1ae-74f9-4efb-a490-6ceb64d132cf', value: 'DRAFT', label: 'Draft', position: 0, color: 'gray' },
  { id: 'a91d2388-ab61-417b-82c4-f7ddb7e6a324', value: 'IN_REVIEW', label: 'In review', position: 1, color: 'blue' },
  { id: '8b3ca44d-e09d-4661-8b38-cd80d474457b', value: 'READY', label: 'Ready', position: 2, color: 'turquoise' },
  { id: 'b233b709-cc6d-461f-8c77-5519888cd853', value: 'LIVE', label: 'Live', position: 3, color: 'green' },
  { id: '2a9a0782-60cb-47e2-a029-5d7dd8bc2392', value: 'PAUSED', label: 'Paused', position: 4, color: 'yellow' },
  { id: '2bd41af6-6a34-4b32-8f99-a751617c7417', value: 'RETIRED', label: 'Retired', position: 5, color: 'red' },
];

export const PROPERTY_STATUS_OPTIONS: SelectOption[] = [
  { id: '1d41e1ae-74f9-4efb-a490-6ceb64d132cf', value: 'DRAFT', label: 'Draft', position: 0, color: 'gray' },
  { id: 'a91d2388-ab61-417b-82c4-f7ddb7e6a324', value: 'IN_REVIEW', label: 'In review', position: 1, color: 'blue' },
  { id: '8b3ca44d-e09d-4661-8b38-cd80d474457b', value: 'READY', label: 'Ready', position: 2, color: 'turquoise' },
  { id: 'b233b709-cc6d-461f-8c77-5519888cd853', value: 'LIVE', label: 'Live', position: 3, color: 'green' },
  { id: '2a9a0782-60cb-47e2-a029-5d7dd8bc2392', value: 'PAUSED', label: 'Paused', position: 4, color: 'yellow' },
  { id: '2bd41af6-6a34-4b32-8f99-a751617c7417', value: 'RETIRED', label: 'Retired', position: 5, color: 'red' },
];

export const PROPERTY_TYPE_OPTIONS: SelectOption[] = [
  { id: '0e0df73d-368f-457e-91fd-d4a7009e3cde', value: 'VILLA', label: 'Villa', position: 0, color: 'blue' },
  { id: '84b71854-8085-43e2-95c0-4a92d0f7cd4e', value: 'HOMESTAY', label: 'Homestay', position: 1, color: 'turquoise' },
  { id: '3e854941-9de9-4a6a-8a1c-b910238da3e6', value: 'FARMSTAY', label: 'Farmstay', position: 2, color: 'green' },
  { id: 'fecbc44d-f6de-443c-bbaf-3ffd9795d442', value: 'BOUTIQUE_HOTEL', label: 'Boutique hotel', position: 3, color: 'purple' },
  { id: '58f05a36-d0d9-493a-af53-0540fe182b8d', value: 'CAMP', label: 'Camp', position: 4, color: 'yellow' },
  { id: '09b192a8-24c2-4182-a821-60e209616546', value: 'VENUE', label: 'Venue', position: 5, color: 'orange' },
  { id: '8ea12119-6209-465a-865e-af01c0e3551c', value: 'OTHER', label: 'Other', position: 6, color: 'gray' },
];
