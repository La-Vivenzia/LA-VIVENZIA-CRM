// Stable universal identifiers for every entity this application declares.
// Twenty matches installed metadata by these, so they must never change once a
// version has been installed anywhere — renaming a field is safe, changing its
// identifier orphans the column and its data.

export const APPLICATION_UNIVERSAL_IDENTIFIER =
  'c9a2e367-05d5-4faf-af14-599a67aa496c';

export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER =
  'fb69ccbd-471e-474b-9aa2-02a712e17134';

// --- lvLead ----------------------------------------------------------------
export const LEAD_OBJECT_ID = '05cdcb74-08d7-4769-a1c3-c2b5188ee380';
export const LEAD_NAME_FIELD_ID = '1d98e1a6-bdbf-4604-96dc-ef33b5bafee0';
export const LEAD_LV_ID_FIELD_ID = 'afa29513-d8b1-44d4-90b5-e4b8f625bbbe';
export const LEAD_ORGANISATION_FIELD_ID = '55af934b-8e01-4a2f-9c06-d3722728ce4c';
export const LEAD_CATEGORY_FIELD_ID = '2395810c-7779-478e-b604-b429c83ac399';
export const LEAD_SUBCATEGORY_FIELD_ID = '70d788af-0a65-4dc7-8647-5fabfc945e3b';
export const LEAD_LOCATION_FIELD_ID = '0446e3a8-e267-45cb-8f0d-ebe530555daf';
export const LEAD_SOURCE_FIELD_ID = 'c4d744f6-6127-49f6-ac1e-63d1884da1f9';
export const LEAD_CAPTURE_MODE_FIELD_ID = '7d72416f-fac2-4b64-af37-1acddb3771e7';
export const LEAD_STATUS_FIELD_ID = '8adf1303-983f-4d59-abb7-be075944e976';
export const LEAD_PRIORITY_FIELD_ID = 'e6ec040b-5048-4adb-b5a1-44f7485ea44c';
export const LEAD_OWNER_FIELD_ID = '4221368e-0579-42a9-90a5-69cb7f2344e3';
export const LEADS_ON_WORKSPACE_MEMBER_FIELD_ID =
  '0338ae8a-de8d-4feb-92cf-9e8307fe66fb';
export const LEAD_OPPORTUNITY_SCORE_FIELD_ID =
  'c57867ec-1144-43e9-af88-85249bb39bcc';
export const LEAD_RELATIONSHIP_HEALTH_FIELD_ID =
  '7c769052-4fd8-4222-8ada-f7954810b40c';
export const LEAD_LAST_INTERACTION_FIELD_ID =
  '1cdd2092-3184-47c0-88df-f5fc1ca08895';
export const LEAD_NEXT_ACTION_FIELD_ID = 'f5467f59-6478-486f-aac5-7a96e0ef4288';
export const LEAD_NEXT_FOLLOW_UP_FIELD_ID =
  'ec26bb03-dedd-4e67-a7a7-e277c51924fc';
export const LEAD_ONBOARDING_STATUS_FIELD_ID =
  '843a0746-9c9c-44cb-b20a-4bf276a53fd2';
export const LEAD_EMAIL_FIELD_ID = '63045871-862f-4d6d-ab9c-bf26317292f8';
export const LEAD_PHONE_FIELD_ID = '1f24e04d-cf78-4c01-896a-4b442bfaa9ef';
export const LEAD_WEBSITE_FIELD_ID = 'fce7c848-2753-45ee-8f79-bd96b6e368af';
export const LEAD_INSTAGRAM_FIELD_ID = '29b860bc-8810-4f96-a0de-301b1a3939fc';
export const LEAD_LANGUAGES_FIELD_ID = '2c3f084c-cb62-4ab7-aa4e-0a41b48c25fb';
export const LEAD_REFERRER_FIELD_ID = '73891dd7-875f-4e09-8c09-ebf71bab124b';
export const LEAD_RAW_INPUT_FIELD_ID = '6ead51c9-462a-4ddc-b961-322c0f39a61e';
export const LEAD_PROVENANCE_FIELD_ID = '6a26bf33-ea8c-4410-bfe6-847dea582f38';
export const LEAD_DUPLICATE_KEYS_FIELD_ID =
  'daae7e35-9875-44a1-92ad-96f517d71751';
export const LEAD_ASSIGNED_AT_FIELD_ID = 'd8aef69c-92b5-4e74-816b-e6a121f76610';
export const LEAD_COMPLETENESS_FIELD_ID = '178768d1-383a-494a-9adc-cc86117cb9af';

// --- lvAssignmentHistory ---------------------------------------------------
export const ASSIGNMENT_HISTORY_OBJECT_ID =
  '3103cec5-032a-41b7-b919-ee59aebaf7bf';
export const ASSIGNMENT_HISTORY_NAME_FIELD_ID =
  '2adb8a13-05e3-4a68-a72c-216dbdbcea4d';
export const ASSIGNMENT_HISTORY_LEAD_FIELD_ID =
  'c37335eb-480b-4eb7-9350-559ff32315f2';
export const ASSIGNMENT_HISTORY_ON_LEAD_FIELD_ID =
  '8bd57a5a-e13d-4094-93ae-65f971c2dffa';
export const ASSIGNMENT_HISTORY_FROM_FIELD_ID =
  'bc6de45a-b221-4bfd-8a9c-7dd197ec1c05';
export const ASSIGNMENT_HISTORY_TO_FIELD_ID =
  '7246b601-f7a2-49c4-8b39-96a2c99d6161';
export const ASSIGNMENT_HISTORY_REASON_FIELD_ID =
  'a9536704-ffe7-4af8-9237-74270d888fec';
export const ASSIGNMENT_HISTORY_STRATEGY_FIELD_ID =
  '5e122cbf-fbcf-4d77-ac9d-a50673e4be46';
export const ASSIGNMENT_HISTORY_SCORE_FIELD_ID =
  '54c652ad-4595-47e9-8934-a901942fb520';
export const ASSIGNMENT_HISTORY_AT_FIELD_ID =
  '59e9b748-7cd0-4c6f-9f83-31c2a20c74d1';
export const ASSIGNMENT_HISTORY_EVENT_KEY_FIELD_ID =
  'c7005ff3-cf0d-40ca-ba38-66e52756d271';

// --- lvAssignmentRule ------------------------------------------------------
export const ASSIGNMENT_RULE_OBJECT_ID = 'c709c604-99e9-4b80-ba68-d48ede005b3a';
export const ASSIGNMENT_RULE_NAME_FIELD_ID =
  '9b98e9b7-5441-4987-b2e3-700694df5b83';
export const ASSIGNMENT_RULE_ACTIVE_FIELD_ID =
  '6a54940d-3fe2-4ea2-8cdd-8d11e9695e18';
export const ASSIGNMENT_RULE_PRIORITY_FIELD_ID =
  '44a9b719-8f87-42d5-abf1-b440f61a2fbf';
export const ASSIGNMENT_RULE_CATEGORY_FIELD_ID =
  'efb2a1fa-5460-490b-8392-f0024c7f069a';
export const ASSIGNMENT_RULE_REGION_FIELD_ID =
  '6f7fdf8a-4ee4-4350-951b-98e61a43cc64';
export const ASSIGNMENT_RULE_LANGUAGE_FIELD_ID =
  'e624a45b-e060-49b2-9b48-a92a1b236159';
export const ASSIGNMENT_RULE_ASSIGNEE_FIELD_ID =
  'e349788f-9d36-4e23-9124-e677ca7685e3';
export const ASSIGNMENT_RULES_ON_MEMBER_FIELD_ID =
  '6a840422-84e5-4e02-a244-ce3c278255ed';

// --- lvNotification --------------------------------------------------------
export const NOTIFICATION_OBJECT_ID = '83d98242-5a37-48cf-8829-4fd3d96d6d09';
export const NOTIFICATION_NAME_FIELD_ID =
  'f56059ea-a0e9-4a94-85fa-17f283777ebe';
export const NOTIFICATION_RECIPIENT_FIELD_ID =
  '59e2f837-e384-43b5-b7a4-0fee7a343396';
export const NOTIFICATIONS_ON_MEMBER_FIELD_ID =
  'bcc2c1f0-4547-4bcb-83a8-bc5c49c191a9';
export const NOTIFICATION_TYPE_FIELD_ID =
  '789bd69f-48a1-4950-a048-a41703aaab99';
export const NOTIFICATION_BODY_FIELD_ID =
  '7c7f205f-adde-4fb6-9dcf-85c24650522d';
export const NOTIFICATION_LINK_FIELD_ID =
  'd4a5136b-3fcb-42c1-82e3-19f4ec3f849c';
export const NOTIFICATION_READ_FIELD_ID =
  'bbab880d-d7b8-428e-93af-24e51d13f6ec';
export const NOTIFICATION_DEDUPE_KEY_FIELD_ID =
  'd687ef97-78e2-46ed-b0fc-59cf828b35e1';

// --- routing attributes added to the standard workspaceMember object -------
export const MEMBER_REGIONS_FIELD_ID = '9439ecd5-cfef-4df8-99f1-1ca709a8a57d';
export const MEMBER_CATEGORIES_FIELD_ID =
  '62ba9a89-4081-4908-8416-540d2465eef6';
export const MEMBER_SUBCATEGORIES_FIELD_ID =
  '83ad3b16-08e4-41a1-b33c-72e27c861234';
export const MEMBER_LANGUAGES_FIELD_ID =
  'b4f1d8a2-3c60-4e7b-9a15-8d2e6f0c4b91';

// Reverse sides of lvAssignmentHistory.fromOwner / .toOwner.
export const ASSIGNMENT_HISTORY_FROM_ON_MEMBER_FIELD_ID =
  '9a1b2c3d-4e5f-4a61-8b72-9c0d1e2f3a46';
export const ASSIGNMENT_HISTORY_TO_ON_MEMBER_FIELD_ID =
  'ab2c3d4e-5f6a-4b72-9c83-0d1e2f3a4b57';
export const MEMBER_LEAD_CAPACITY_FIELD_ID =
  '70da4873-e29c-43d0-ac6f-29daf4e3c263';
export const MEMBER_ACCEPTS_LEADS_FIELD_ID =
  '8ab52190-c1e4-4ad6-bd22-959938c4dda2';

// --- logic functions, views, navigation ------------------------------------
export const FN_ON_LEAD_CREATED_ID = '0e38b08a-5b37-4844-ae46-6e2b27535de0';
export const FN_CAPTURE_LEAD_ID = '4a9deb8d-a533-42c7-9ae7-55b8ff0f9a27';
export const FN_ASSIGN_LEAD_ID = '2897f170-5156-4884-b67e-bc322616c865';
export const VIEW_ALL_LEADS_ID = 'be7aa0ff-0da6-46c4-b9f2-828a89b34b93';
export const VIEW_MY_LEADS_ID = 'bfd9e778-ecb5-4c3b-b484-9f27e341bacc';
export const VIEW_UNASSIGNED_LEADS_ID = 'c2c3e74f-ccc3-4dae-a0ec-56fd14de1fd1';
export const NAV_LEADS_ID = '86a1497c-b1fe-400d-9fbf-557ce56aa930';
export const CMD_QUICK_ADD_LEAD_ID = 'c649c668-54c9-4582-bf7d-da0f1945c5e6';
export const FC_QUICK_ADD_LEAD_ID = '5cd7bcab-f79d-49e0-bb3a-f228ad60fd31';

// --- lvInteraction (interaction + follow-up layer) -------------------------
export const INTERACTION_OBJECT_ID = 'e72bae19-7858-552e-8e6b-b9b2a17e98a7';
export const INTERACTION_NAME_ID = '34f33fba-96cd-562c-898a-45cfe8f857e6';
export const INTERACTION_LEAD_ID = '1b58da8f-b55a-5cf8-bb05-4a31547a9f0a';
export const INTERACTIONS_ON_LEAD_ID = '23a00e0e-be90-56df-91bd-1688c5c88ed6';
export const INTERACTION_CHANNEL_ID = '32e97c34-b098-5577-9b11-4a6d6fd2edeb';
export const INTERACTION_OCCURRED_AT_ID = 'af5929ac-830f-52aa-9944-4ae2cf50fd76';
export const INTERACTION_ACTOR_ID = '30ffcb1e-198f-582d-b336-6a465cfddf68';
export const INTERACTIONS_ON_MEMBER_ID = 'f98b816c-32ac-5158-a6e9-f297c6f155fa';
export const INTERACTION_DURATION_ID = '88e51fca-a4df-5660-8618-d945c261f7c0';
export const INTERACTION_PURPOSE_ID = '893c6416-3c27-59d5-ad24-f1e2e984acc1';
export const INTERACTION_SUMMARY_ID = '9cc10664-4ff7-5812-9fef-6ac8ae2c504a';
export const INTERACTION_SENTIMENT_ID = '6b3b8f61-8d31-534e-8bd6-6230c25d6be1';
export const INTERACTION_OUTCOME_ID = 'bd549e48-2cc7-5ee9-82e4-952c2e2d9aac';
export const INTERACTION_OBJECTIONS_ID = '0e64616f-615e-5274-ba6b-abf0ff061769';
export const INTERACTION_COMMITMENTS_ID = 'bbf3b7d7-248f-516f-964b-b3206fa3284a';
export const INTERACTION_NEXT_ACTION_ID = '8902ac14-1d2d-565a-98cf-3bb1209c1b32';
export const INTERACTION_NEXT_FOLLOW_UP_ID = '92e9f8f3-b722-5b00-9406-9182baa678e3';

// Fields added to Twenty's standard `task`, which IS the follow-up. No
// follow-up object exists: task already carries title, body, dueAt, status and
// assignee, and taskTarget attaches it to lvLead through its `custom` relation.
export const TASK_LV_PRIORITY_ID = '39fada9e-2084-54a5-ba0d-3004e632312a';
export const TASK_LV_SOURCE_INTERACTION_ID = '951f7f7f-3038-5309-9f45-61e81371b8af';
export const FOLLOWUPS_ON_INTERACTION_ID = '7d788d0b-ece2-5b1f-823e-f07a5c7a86a8';

export const FN_ON_INTERACTION_CREATED_ID = 'f7dba54e-36df-5d84-9adc-cc82587dbe91';
export const VIEW_FOLLOWUPS_TODAY_ID = 'bfa900b8-ea83-5ac7-86a0-f71954a855b7';
export const VIEW_FOLLOWUPS_UPCOMING_ID = '74c60b0e-4217-5e57-babc-73347d1e6855';
export const VIEW_FOLLOWUPS_OVERDUE_ID = '9ed954e6-80a5-508f-995e-35a03527aaf1';
export const VIEW_FOLLOWUPS_COMPLETED_ID = 'eef0dabd-12a2-570a-ba69-e1df70e27517';
export const VIEW_INTERACTIONS_ALL_ID = 'b6fce91e-a422-5883-81e4-ee4f1e0f6e29';

// --- lvOnboarding (external partner onboarding) ----------------------------
// NOT Twenty's core-modules/onboarding, which onboards a workspace USER.
export const ONBOARDING_OBJECT_ID = 'e7ffd786-9373-59b7-b145-4063c3c98fb0';
export const ONBOARDING_NAME_ID = '04d5f030-26a4-5561-b93b-9299bc341558';
export const ONBOARDING_LEAD_ID = '7e3d1e96-b824-55dc-bce6-45857318709d';
export const ONBOARDINGS_ON_LEAD_ID = 'aaf95359-5aca-5cbe-8d65-735312d30d8b';
export const ONBOARDING_STATUS_ID = '8df0d2ad-82b7-5790-9181-c02fe9605dba';
export const ONBOARDING_CURRENT_STEP_ID = 'fa2766e1-9995-54bf-93af-42b7f65d5f4e';
export const ONBOARDING_PROGRESS_ID = '8c95964d-c851-5c67-9b3f-ef1c34a39ca9';
export const ONBOARDING_HEALTH_ID = '14847d95-8ec6-5b3f-80df-0d05e3555b1b';
export const ONBOARDING_DATA_ID = '4e00431f-7bb5-50e0-b7a7-8e1badf4b0ee';
export const ONBOARDING_REVIEWER_ID = '123cca3e-3c87-55e5-ac53-24cad38a0044';
export const ONBOARDINGS_ON_MEMBER_ID = '15d66d76-ca65-503a-b7d9-5b92433df4f0';
export const ONBOARDING_REJECTION_REASON_ID = 'd138daed-b460-5b58-8167-c1c6cba2ccbb';
export const ONBOARDING_INTERNAL_NOTES_ID = '115b3dae-a51d-5a25-8d02-b04db0d0a74d';
export const ONBOARDING_AUDIT_ID = '2e1f1b2a-496e-5559-9a2e-02e1b53c5290';
export const ONBOARDING_INVITED_AT_ID = '259cb95b-4c79-5559-92c1-31d740c75654';
export const ONBOARDING_SUBMITTED_AT_ID = '97fdb027-453c-590a-b698-d29795a105f6';
export const ONBOARDING_DECIDED_AT_ID = 'cb345809-3726-5658-b982-e203c8396af3';
export const ONBOARDING_ACTIVATED_AT_ID = '452f8664-88a9-5461-b248-e31749a2f4ce';
export const DOC_OBJECT_ID = '8b25278f-74c5-5a3b-bfde-ad197058925f';
export const DOC_NAME_ID = 'b08468c0-8dcc-50df-bd69-8577b4e0529d';
export const DOC_ONBOARDING_ID = '154eb5af-d0db-5a0a-bbf7-cdfd5c3a6e5e';
export const DOCS_ON_ONBOARDING_ID = 'e1053b6e-e630-5223-baf5-ca79ec8fa404';
export const DOC_TYPE_ID = '163b643a-ee19-52b0-b56e-cb2d6c326940';
export const DOC_FILE_ID = 'b1e288f0-dcf3-5815-8c38-6912aedaa515';
export const DOC_STATE_ID = 'efe9de53-f5fd-5e6d-8a63-7a19025ec91d';
export const DOC_EXPIRY_ID = 'bcbbeb58-385b-537c-bdcd-c928e83cbd75';
export const DOC_REVIEWER_ID = '411685f0-bb98-5c49-a9db-84ef38c502ab';
export const DOCS_ON_MEMBER_ID = '42161a0c-40af-5f04-83f5-171aa12ed0a9';
export const DOC_REJECTION_REASON_ID = '2d0300b8-2ae9-5517-bc2d-03cd9987011e';
export const FN_ON_ONBOARDING_STATUS_ID = 'ed1a1432-4608-572c-ae91-7f9c38f8f1e6';
export const FC_ONBOARDING_WIZARD_ID = 'dc23db99-c6a5-5d08-ad74-6c156770280d';
export const VIEW_ONBOARDING_ACTIVE_ID = '6e3f2908-c91c-5828-bab6-a26ba4561c24';
export const VIEW_ONBOARDING_REVIEW_ID = '5382d0dd-4b20-55b7-b68c-f66bd0fdef4c';
export const PAGE_ONBOARDING_ID = 'de4e6fe0-cb07-5a9b-8715-105530ddd034';

// --- document management layer (states, flags, metadata, replacement) ------
export const DOC_FLAGS_ID = 'cd9c6846-6fdb-5ca4-8d87-3ada306ff8ac';
export const DOC_AUDIT_ID = '14c473dc-5e74-5261-99b5-0822f64ab3da';
export const DOC_MIME_ID = 'bef9ca2f-2799-5861-bb9a-8bc1ec9aee28';
export const DOC_SIZE_ID = '1c736016-9b20-5e31-90ab-d17443b96709';
export const DOC_ORIGINAL_NAME_ID = '6886c9ba-acdb-58fe-a994-4944a59d69f1';
export const DOC_UPLOADED_AT_ID = 'b91be117-92a4-5728-b088-8a50ff118326';
export const DOC_VERIFIED_AT_ID = '768dce44-1c8d-58be-a600-c4305d3ae6a1';
export const DOC_REPLACES_ID = 'c70fc115-8cca-5411-b4e1-3fb7f2480b1f';
export const DOC_REPLACED_BY_ID = 'f2ee7fb0-a653-534b-be53-a7a6be8ace85';

// La Vivenzia team roles (SECURITY-RBAC.md).
export const ROLE_MAIN_ADMIN_ID =
  'c1253597-4b22-4659-97e2-b74b18fb57d9';
export const ROLE_EXPERIENCE_HUNTER_ID =
  'fbda0f69-8c2b-44e3-b5a3-005762d20a39';
export const ROLE_LEAD_COORDINATOR_ID =
  '45ea5a71-b058-45e6-84ba-7ee4885883db';
export const ROLE_ONBOARDING_EXPERT_ID =
  'be99c1d8-2c34-4841-ab31-359c3aa9e73a';
export const ROLE_EXPERIENCE_TEAM_ID =
  '15afad08-afbc-4d49-b6b0-483aac7777c3';
export const ROLE_MARKETING_ID =
  '8e231881-c27f-494c-8113-93e027b8d69b';
export const ROLE_OPERATIONS_ID =
  '13919940-3648-4780-a6c2-8ded8b9bb76f';
export const ROLE_MANAGEMENT_ID =
  'e5a958bd-a4a5-431f-91e5-0c221f8d1edd';

// Onboarding document workflow (Remediation 2).
export const FN_REGISTER_DOCUMENT_ID =
  '122b22fa-d815-4258-aebf-064c5202ba4b';
export const FN_REVIEW_DOCUMENT_ID =
  '2b6cc02e-b4a5-4968-bb82-2c60f520e4af';
export const FN_EXPIRE_DOCUMENTS_ID =
  '0382880f-5c18-4fcf-92f0-6d426ef017f5';
export const FN_ASSIGN_REVIEWER_ID =
  'c70ff2ce-a618-4d7f-84b7-c4c7f9cbef90';
export const FC_DOCUMENT_REVIEW_ID = '36986e7d-e338-489f-a81c-ef7e95c5ca5f';

// Partner / Experience / Property (Day 1 foundation objects).
export const PARTNER_OBJECT_ID =
  '9bd9bc0b-50f4-47cf-9cca-f630653c71e5';
export const PARTNER_NAME_FIELD_ID =
  '43890c24-7a9a-4448-abdc-333b7ced82c1';
export const PARTNER_CODE_FIELD_ID =
  '4a373544-807d-4cb9-9e95-1ccc0f58b56e';
export const PARTNER_STATUS_FIELD_ID =
  '9e0aa6ad-d773-4cf3-878f-d2f22c5609f6';
export const PARTNER_TYPE_FIELD_ID =
  '2610b9b9-16dd-40b4-b965-ed82e44b085c';
export const PARTNER_LOCATION_FIELD_ID =
  '02935a0c-3aab-4167-ac48-abc163e21a4e';
export const PARTNER_LEAD_FIELD_ID =
  'bedf747f-8a2b-48ba-b67b-bc71ce450744';
export const PARTNER_ON_LEAD_FIELD_ID =
  'f190dd0f-86bd-4495-b982-89e2f65984b6';
export const PARTNER_ONBOARDING_FIELD_ID =
  '072fb0ee-9c98-40a8-bb9a-c6d55aa91599';
export const PARTNER_ON_ONBOARDING_FIELD_ID =
  'e6897e6b-5dd1-4158-b60d-b16db516f878';
export const EXPERIENCE_OBJECT_ID =
  '6c9613ca-a68a-4879-b289-dd1a22b67d5b';
export const EXPERIENCE_NAME_FIELD_ID =
  '9a0aa170-f284-4d43-95e6-9fa5efecd224';
export const EXPERIENCE_CODE_FIELD_ID =
  '9f676646-50ee-45b1-a58d-b017ac9fab06';
export const EXPERIENCE_STATUS_FIELD_ID =
  'd0788358-9994-47f4-93b7-a1409a32745d';
export const EXPERIENCE_CATEGORY_FIELD_ID =
  'a79fb4b4-2fd2-4865-9bae-51e03f7583b3';
export const EXPERIENCE_DESCRIPTION_FIELD_ID =
  '610f8ec3-c5ce-43e8-858d-acf82c7251f7';
export const EXPERIENCE_LOCATION_FIELD_ID =
  'a7c7b44d-96cc-40d5-b74d-a1caba432983';
export const EXPERIENCE_CAPACITY_FIELD_ID =
  '890f60f7-e82f-425c-ac66-1d7fa1045086';
export const EXPERIENCE_LANGUAGES_FIELD_ID =
  '9abb4b52-37a3-4301-a927-3b957a7c20df';
export const EXPERIENCE_PARTNER_FIELD_ID =
  '1e07c634-5f1e-420c-8613-81d583246d6e';
export const EXPERIENCE_ON_PARTNER_FIELD_ID =
  'fe8cd5e4-e770-41d8-9054-a212a33fb143';
export const PROPERTY_OBJECT_ID =
  'e4a7b2dd-0a2a-4b60-8833-33d0813762b1';
export const PROPERTY_NAME_FIELD_ID =
  'fdae6792-129c-4f82-be56-683bb689137c';
export const PROPERTY_CODE_FIELD_ID =
  '2bb0a7eb-c79a-4bbf-b270-a4407668da88';
export const PROPERTY_STATUS_FIELD_ID =
  '33f6c86d-42dc-469c-9ceb-532a63f05f0b';
export const PROPERTY_TYPE_FIELD_ID =
  '9ee687e1-d657-4d47-b597-d6cc32557907';
export const PROPERTY_LOCATION_FIELD_ID =
  '7cf5ae9a-3152-4576-90d5-c528fe004ddf';
export const PROPERTY_CAPACITY_FIELD_ID =
  '67176611-7aea-47d6-b50e-5049ac065b38';
export const PROPERTY_PARTNER_FIELD_ID =
  '6898df7a-da45-43f7-8b86-c4f6dedd7317';
export const PROPERTY_ON_PARTNER_FIELD_ID =
  '75eb4a98-b055-4051-a6fc-5b399c47e326';
export const FN_ON_ONBOARDING_UPDATED_ID =
  '1ce9cf78-2aaf-4b18-bfe0-db82e51ea022';

// La Vivenzia navigation (Remediation 3).
export const NAV_FOLDER_CRM_ID = 'ee6c9d4b-59c8-4f86-b1a4-705f85944089';
export const NAV_FOLDER_WORK_ID = '03a31c28-c6bc-4d28-8157-31852cb58609';
export const NAV_FOLDER_AUTOMATION_ID = '2a1cf0ce-78ed-463d-840c-e63603a08561';
export const NAV_PEOPLE_ID = '8a27a12f-167b-49da-8bde-ec9c784d845f';
export const NAV_ORGANISATIONS_ID = 'f7f5b678-dc74-4aa7-9cb4-57a078fa422a';
export const NAV_EXPERIENCES_ID = 'c4a8ca9f-4e82-4a51-bcff-3f6cdddd4092';
export const NAV_PROPERTIES_ID = '09da17bc-5787-4093-a3c9-7268711bdc62';
export const NAV_PARTNERS_ID = '4e871f40-ae88-469a-8917-b64aafb3a247';
export const NAV_ONBOARDING_ID = '95057e5a-9092-4c81-8f29-b4b512fafa97';
export const NAV_TASKS_ID = 'bde6c2ce-2338-46e5-b589-3504041d0f8c';
export const NAV_ACTIVITIES_ID = '4f7503ed-da17-4e8d-a334-b9de5e27c8d2';
export const NAV_NOTES_ID = '24158c5f-2d9c-4017-ae8d-f9d2cc827038';
export const NAV_WORKFLOWS_ID = '1fa67b02-8edf-4cf4-bb62-7303fc353216';

// Day 4A — notification system.
export const NOTIFICATION_PRIORITY_FIELD_ID =
  '91985025-9d2d-4b45-864c-a8b33d1fe5f9';
export const NOTIFICATION_READ_AT_FIELD_ID =
  '6bf2f298-a982-4982-bb5b-94f7783b4372';
export const NOTIFICATION_TARGET_OBJECT_FIELD_ID =
  'e626a924-ce64-4386-9521-d3b7a87dd067';
export const NOTIFICATION_TARGET_RECORD_FIELD_ID =
  '4d839b15-85bc-4e97-9341-e3e6a66105b5';
export const NOTIFICATION_LEAD_FIELD_ID =
  '50df1e89-4867-4249-bb3e-67fcf534c5cf';
export const NOTIFICATIONS_ON_LEAD_FIELD_ID =
  '17ba43a0-d953-40b1-9b3b-df65608aa92c';
export const NOTIFICATION_TRIGGERED_BY_FIELD_ID =
  '38fa6f46-1074-4612-b18b-0a85462ef929';
export const TRIGGERED_NOTIFICATIONS_ON_MEMBER_FIELD_ID =
  'f2df7be3-2394-4369-a994-9713cd8f49d5';
export const NOTIFICATION_SOURCE_EVENT_FIELD_ID =
  '0ad3a219-1b43-4a55-bb35-979ad5e7a2d4';
export const NOTIFICATION_EMAIL_STATUS_FIELD_ID =
  'b15b5b2a-0df2-4267-afac-f868b99ea1db';
export const NOTIFICATION_EMAIL_SENT_AT_FIELD_ID =
  '69495e73-3adb-4161-abde-83b5a47c37da';
export const NOTIFICATION_EMAIL_ERROR_FIELD_ID =
  '159a090f-c998-4998-b0dc-c2f305f51ad1';
export const NOTIFICATION_METADATA_FIELD_ID =
  '6b03e22e-d9cd-46e6-86d1-d58bdf901114';
export const INTERACTION_DIRECTION_ID = '3444206e-3306-487a-97a5-2a109caf00a6';
export const FN_ON_LEAD_UPDATED_ID = 'a70834d7-5360-49b7-b661-c7f35812bdda';
export const FN_ON_DOCUMENT_UPDATED_ID = 'c4b3e634-0bfd-4ebb-9f7f-b272d98f8be8';
export const FN_ON_NOTE_CREATED_ID = 'e6931698-884e-4c36-ac09-03d6c97ea4c3';
export const FN_ON_NOTE_UPDATED_ID = '042467ae-87ba-47aa-985c-cd56b30c415e';
export const FN_FOLLOW_UP_REMINDERS_ID = '65ee08f9-7c75-4bb9-9574-2ea60c9595a7';
export const FN_ON_NOTIFICATION_CREATED_ID =
  '64c6cbb9-f8b2-4164-a620-015c80759e76';
export const FN_MARK_NOTIFICATION_READ_ID =
  '7eeaec83-49fd-498b-81ba-6bea07c3ee02';
export const FN_MARK_ALL_NOTIFICATIONS_READ_ID =
  '5b016ae4-891d-406f-a51d-d1f9181dc31e';
export const FC_NOTIFICATION_CENTRE_ID = '509a4e1d-6156-4a05-8471-52ad9e0049b8';
export const PL_NOTIFICATION_CENTRE_ID = 'f67ad42b-fa0b-4ee3-82ac-951dbb681fd5';
export const PL_NOTIFICATION_CENTRE_TAB_ID =
  '4551d0ef-875d-4e4c-9b79-0d14847bcfc4';
export const PL_NOTIFICATION_CENTRE_WIDGET_ID =
  'b7be242d-e20b-4d2f-a605-f2b4a475faf5';
export const NAV_NOTIFICATIONS_ID = 'b10cd363-4461-4a71-a3dd-90399aca7bd6';

// Day 4B — SLA engine.
export const SLA_OBJECT_ID = 'c6435167-58e0-4fe5-bba8-deefd7b81269';
export const SLA_NAME_ID = 'b1194424-996f-4c3c-82c5-9d9d4a794e80';
export const SLA_RULE_ID = '0dc6a1ce-990e-4514-98d9-9975e41fd201';
export const SLA_STATUS_ID = 'f8648b2d-0f03-4343-9bb8-a6a9fec00fcf';
export const SLA_PREVIOUS_STATUS_ID = '4842f7a5-a4a9-4450-9c69-c9cd9b66884d';
export const SLA_TARGET_OBJECT_ID = '038e8195-16fc-4328-945a-7f94a6e0f208';
export const SLA_TARGET_RECORD_ID = 'c24e4616-a2ce-42fe-8815-e6046204a324';
export const SLA_LEAD_ID = 'a7fa192d-b861-4c82-a7a8-6dc7657a3182';
export const SLAS_ON_LEAD_ID = '9afd356e-8323-4cfc-b667-639d3a88ed74';
export const SLA_ONBOARDING_ID = '64438c3f-a955-4191-9c26-eb96f91f0fd1';
export const SLAS_ON_ONBOARDING_ID = '8d2f8ccf-3bf5-4740-8c8f-d41c7ff06e5e';
export const SLA_DOCUMENT_ID = '1bcce716-3127-4fe9-b26f-a982f1ed4add';
export const SLAS_ON_DOCUMENT_ID = '4f6091cd-fe47-4e7e-9d3c-376f8db3f289';
export const SLA_OWNER_ID = 'b57d1cf7-daf6-4be7-ab69-19159bb723b2';
export const SLAS_ON_MEMBER_ID = '80f96ee0-f369-46f4-ac91-4bf5dd712040';
export const SLA_ESCALATION_OWNER_ID = 'b2e7c13a-6644-4680-a3f0-fa95611a2e0f';
export const ESCALATED_SLAS_ON_MEMBER_ID = '9bd38b48-a4e1-4ed8-8763-e1cea44372ed';
export const SLA_ESCALATION_TASK_ID = '330980d5-c5b9-4034-9858-28b6a0ff5992';
export const SLA_ON_TASK_ID = '003bbe6d-c309-4d9a-ac66-e480385985eb';
export const SLA_STARTED_AT_ID = '681bf4fb-6845-42ec-ab99-e27f9278957b';
export const SLA_DUE_SOON_AT_ID = '1f8fb13d-b76b-459b-bef1-e848ea78cbd6';
export const SLA_DUE_AT_ID = 'ab79dcf4-f143-4d30-b3dd-fc74611771e5';
export const SLA_BREACHED_AT_ID = '0901edb7-6ba1-447b-9f23-69d83ce929db';
export const SLA_ESCALATED_AT_ID = '449ac8f5-368e-4295-a1d4-3d898b899a4b';
export const SLA_RESOLVED_AT_ID = '8bfb4cfc-a1e0-4e6a-b130-0c85f44a9385';
export const SLA_LAST_EVALUATED_AT_ID = 'cb9cb6d0-0d76-4040-a081-09b3a9ffb43b';
export const SLA_LAST_NOTIFIED_AT_ID = 'b1a7e2f5-c0cb-47f1-966c-28ed7ef5e1bd';
export const SLA_PRIORITY_ID = 'c17e6968-ff0e-4c68-93dc-fa6eae9442bf';
export const SLA_DEDUPE_KEY_ID = '868a3440-ef9b-4ba4-866c-69eb14aaa67f';
export const SLA_SOURCE_EVENT_ID = 'c3449387-51f0-4ed4-9256-c9f9b4836b9c';
export const SLA_RESOLUTION_REASON_ID = 'fad127e4-44a8-47a3-86a2-5b3477075280';
export const SLA_AUDIT_ID = '281348fb-4205-4def-8030-400b4c3d9716';
export const SLA_METADATA_ID = 'c419f440-5214-4d13-b8a8-b286241e2ab4';
export const FN_SLA_EVALUATOR_ID = '304388e8-0b9c-4b88-b094-e7cfe953ddb3';
export const FN_SLA_SUMMARY_ID = 'd18ced48-20e9-4b3a-b1e6-78a63393c4ae';
export const VIEW_SLA_ATTENTION_ID = '5f5c3ad2-d3e2-4bcd-b2ab-9782fbcd7b2a';
export const NAV_SLAS_ID = '89fcaedb-aaf9-4357-8730-769c06deda33';
export const APPVAR_ESCALATION_OWNER_ID = '26d5f082-8deb-4498-9d9d-86186de55050';
export const SLA_ESCALATION_BLOCKED_ID = 'ffdbcb64-15e3-4c23-a790-8b7d9528f5ea';
