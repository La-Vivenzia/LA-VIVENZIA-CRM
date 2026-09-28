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

// Day 5 — dashboards, Control Tower, destructive-action governance.
export const FN_DASHBOARD_SUMMARY_ID = '0a28d03b-0fa6-4326-926e-0b52d26f950d';
export const FN_CONTROL_TOWER_SUMMARY_ID = 'a08d4490-5820-4fc1-826f-2da96175c586';
export const FN_LEAD_LIFECYCLE_ACTION_ID = '6e765dac-a5f4-4f38-8f72-e17e017e5ddc';
export const FN_PERMANENT_DELETE_ID = 'bf06de30-db89-4ed0-8be7-3a9414d93b89';
export const FC_MY_DASHBOARD_ID = 'a9645f61-d97a-406c-ab06-70853d693c16';
export const FC_CONTROL_TOWER_ID = '0cf9a24d-0395-4a1c-a995-75a0b57d3f38';
export const FC_LEAD_GOVERNANCE_ID = '23e875d0-23c9-45bc-9589-d550fca4aefc';
export const PL_MY_DASHBOARD_ID = 'aaf8c718-ac15-488f-b3ef-b484869474e0';
export const PL_MY_DASHBOARD_TAB_ID = '34acd1e1-b41c-4044-bdc4-d37c7d961ca4';
export const PL_MY_DASHBOARD_WIDGET_ID = 'ec7ae727-5780-4969-823c-d875fc0be1ef';
export const PL_CONTROL_TOWER_ID = '7374abea-34b9-473f-aaf1-3202e875d5ff';
export const PL_CONTROL_TOWER_TAB_ID = '72a5067c-5cfd-402a-911b-0d06c33aae13';
export const PL_CONTROL_TOWER_WIDGET_ID = 'e11bb412-0def-4f0a-b9af-9e7c6053fd38';
export const NAV_MY_DASHBOARD_ID = '6d197d6d-db67-4be6-bb4c-81f714cb06b2';
export const NAV_FOLDER_MANAGEMENT_ID = '51c38ebe-26d9-4414-8c4a-76dee5edec9e';
export const NAV_CONTROL_TOWER_ID = '2aa8ba16-a41f-4fbb-a791-e64246aaef50';
export const AUDIT_EVENT_OBJECT_ID = '925fc798-c278-4be6-b4b0-875eca201aa0';
export const AUDIT_EVENT_NAME_ID = '869698a3-7b28-4363-9c27-7ca0374113e1';
export const AUDIT_EVENT_ACTION_ID = '636ad212-774c-4778-b18b-7f30a697261a';
export const AUDIT_EVENT_TARGET_OBJECT_ID = '9a3b0741-021a-4d06-99ee-8d1d573f0ece';
export const AUDIT_EVENT_TARGET_RECORD_ID = '10a24818-95a0-44ed-a71e-a0c773bcc810';
export const AUDIT_EVENT_TARGET_LABEL_ID = '5fdd062a-9dce-4220-9ee8-597e71f127ef';
export const AUDIT_EVENT_ACTOR_ID = '0c184593-b104-423d-b59d-f48f232d0454';
export const AUDIT_EVENTS_ON_MEMBER_ID = 'df5b59b8-1c63-481d-867c-5155c58ba303';
export const AUDIT_EVENT_AT_ID = '284053d5-ea77-446c-9eed-3b54edb4c8a3';
export const AUDIT_EVENT_REASON_ID = 'cfc27674-bfe9-4720-a24a-bb0f52be442d';
export const AUDIT_EVENT_OUTCOME_ID = '3fc540f1-694e-402d-9fa4-58900244cc6d';
export const AUDIT_EVENT_METADATA_ID = '162fd5f1-e635-4aa5-ab8c-b8ada42f56f4';
export const LEAD_PROFILE_GOVERNANCE_TAB_ID = '72da06bd-8a3e-4c1f-a886-14986dec039c';
export const LEAD_PROFILE_GOVERNANCE_WIDGET_ID = 'f3fa8a80-0410-46ef-b1e2-c6f6b1c3d766';
export const FN_AUDIT_LEAD_DELETED_ID = '930a820f-d53f-4059-aed8-bdde4c6c6940';
export const FN_AUDIT_LEAD_RESTORED_ID = '66985f94-b945-44ea-bd5e-b0bbb9cbc8b9';
export const FN_AUDIT_LEAD_DESTROYED_ID = '6fc1ee8f-c9f5-4fc6-b756-ec5de018fe70';
export const FN_AUDIT_ONBOARDING_DELETED_ID = 'cb0749cd-a3cb-44b9-9d7c-5df82b54a022';
export const FN_AUDIT_ONBOARDING_DESTROYED_ID = 'dd7d3225-f9a3-4dc3-8d62-1bb6dc4998bb';
export const FN_AUDIT_DOCUMENT_DELETED_ID = 'c3b4193f-ac0d-40d7-be05-302a8655b2ba';
export const FN_AUDIT_DOCUMENT_DESTROYED_ID = '3abd08ad-a711-47dd-9206-93faf69a678c';

// Day 6 — AI intelligence, Copilot, data quality, next best action.
export const AI_INSIGHT_OBJECT_ID = 'c8742d41-b8df-44e1-8892-82e05be95157';
export const AI_INSIGHT_NAME_ID = '27654344-fbb8-4d79-833a-d85db53fd980';
export const AI_INSIGHT_TYPE_ID = '09b1f120-4712-409f-9ce4-db011ec41055';
export const AI_INSIGHT_STATUS_ID = '4f6898d7-3c91-4667-821c-9e48e6672651';
export const AI_INSIGHT_ORIGIN_ID = '4bc8a6d1-ecdc-431c-a017-4e4749f325a7';
export const AI_INSIGHT_TARGET_OBJECT_ID = 'f5e7e7ae-f332-4977-a1cb-66db8facebef';
export const AI_INSIGHT_TARGET_RECORD_ID = 'fcfc5f76-4589-4e0c-8888-0c797f6d7efe';
export const AI_INSIGHT_LEAD_ID = '64670dd7-9c6b-468d-891f-9086e0e25300';
export const AI_INSIGHTS_ON_LEAD_ID = 'a01e5e5f-fbdc-491f-9acd-480609a65410';
export const AI_INSIGHT_PROVIDER_ID = '9f51e286-915e-414e-96a8-5d508b211d8e';
export const AI_INSIGHT_MODEL_ID = '4fe6da9f-3b19-419a-867f-36477d97f0dd';
export const AI_INSIGHT_PROMPT_VERSION_ID = '44cf82d1-3981-49e6-9876-400ca5cb5cf9';
export const AI_INSIGHT_GENERATED_AT_ID = '48819e1d-dfc1-4a09-91e3-be1da4579ad2';
export const AI_INSIGHT_CONFIDENCE_ID = '370c3cb6-99be-4519-8d4d-77ac4c04e488';
export const AI_INSIGHT_SOURCE_RECORDS_ID = '590f6883-b3db-4b33-a8f0-25e744ca2bd5';
export const AI_INSIGHT_PAYLOAD_ID = 'fc317fa3-c4ca-4111-8cbb-4275b4d5711e';
export const AI_INSIGHT_SUMMARY_ID = '19869b0c-9182-4ff9-ae1d-5e5ae1b8b8f3';
export const AI_INSIGHT_FINGERPRINT_ID = '44a37b1b-cbce-4341-8246-3ced3ed995c3';
export const AI_INSIGHT_REVIEWER_ID = '68064a86-5fcc-4661-9c0a-26a11e94e1b8';
export const AI_INSIGHTS_ON_MEMBER_ID = 'e96123dc-ea27-4289-b3dd-dab4f991ebbe';
export const AI_INSIGHT_REVIEWED_AT_ID = 'a880890b-5030-427f-a7f7-bfdbeb74d762';
export const AI_INSIGHT_DECISION_ID = '2b9b87da-f962-421e-a55a-6ed8216e6b93';
export const AI_INSIGHT_DECISION_NOTE_ID = 'ff9b14a5-6ca9-4149-b223-aefa1b0d05c8';
export const AI_INSIGHT_ERROR_CODE_ID = 'becae310-8b84-457c-93d1-f175d0bcf8e2';
export const AI_RUN_OBJECT_ID = '75e8cd15-e8e4-49f5-899c-16a01c90b83e';
export const AI_RUN_NAME_ID = 'af463a14-6a65-4596-8fa3-fb4dd12585e2';
export const AI_RUN_OPERATION_ID = 'b330797c-8fa8-490a-b69a-5041eae49f5b';
export const AI_RUN_PROMPT_VERSION_ID = '8d9f8a74-ac74-4641-8670-8ed5b0b1c9fd';
export const AI_RUN_PROVIDER_ID = '2dcdd566-9010-4e6a-b4b0-57b4ce83c477';
export const AI_RUN_MODEL_ID = 'f606a557-c082-43e4-b6ef-7627dbfcb38c';
export const AI_RUN_STATUS_ID = '1bdace5e-b25a-4a63-a29c-c7fc16b3c291';
export const AI_RUN_ERROR_CODE_ID = 'bf41c746-4a66-48ac-8819-6023b731c4f8';
export const AI_RUN_LATENCY_ID = '8b8bc167-6005-475f-a9cb-63348a368927';
export const AI_RUN_INPUT_TOKENS_ID = '70665dee-9884-4735-b0f3-d6f716637bd7';
export const AI_RUN_OUTPUT_TOKENS_ID = '576f0884-6878-4eab-b4b6-e63a629d3111';
export const AI_RUN_TARGET_OBJECT_ID = 'da68f79d-8afe-4ef9-a579-fd37c89318da';
export const AI_RUN_TARGET_RECORD_ID = '48e3118f-3aea-4b4b-aa9a-ee28672987ee';
export const AI_RUN_ACTOR_ID = '0c5f8367-0092-4b1d-8db4-56683da5d377';
export const AI_RUNS_ON_MEMBER_ID = 'cdf5fc70-8e32-46f4-ae6d-76b4d04e9795';
export const AI_RUN_SOURCE_RECORDS_ID = '48c5b9aa-e17e-470f-bef5-043c92b23ed1';
export const AI_RUN_STARTED_AT_ID = 'c403f949-cd5f-4a4f-a653-c743f2ade761';
export const AI_RUN_METADATA_ID = 'ee35aa13-bf78-4e56-8e50-e3530e044d09';
export const PROBLEM_OBJECT_ID = '188511e6-7932-4f6d-9f6b-d4d646c6e693';
export const PROBLEM_NAME_ID = '8808efd7-32b3-43bd-b020-8095c96621df';
export const PROBLEM_TYPE_ID = '45c0e995-63ff-455b-a0df-9bc46dd1c0d4';
export const PROBLEM_SEVERITY_ID = '1d343664-72e5-4ef3-bbae-1b2c87171a55';
export const PROBLEM_STATUS_ID = '76ceeca9-0ae8-4460-90c8-b61a2063c62c';
export const PROBLEM_DESCRIPTION_ID = 'd0649b6d-312a-4fbb-b1d8-ee07d4a59656';
export const PROBLEM_ROOT_CAUSE_ID = 'd02edb47-0162-425f-837b-9f3be5b9d9d4';
export const PROBLEM_RESOLUTION_ID = '8bfbbd2f-fe7b-47d5-aff4-067e56fff431';
export const PROBLEM_AI_RECOMMENDATION_ID = '0c0ecd02-0744-49c1-8f55-2b8ff9f3de1d';
export const PROBLEM_LEAD_ID = '5607f33f-2677-4073-afb2-b23e2873bd5d';
export const PROBLEMS_ON_LEAD_ID = 'ebf86404-00a2-4d4b-99f0-4b70c62161e0';
export const PROBLEM_INTERACTION_ID = '8182a21c-bbab-455f-ba94-14753b572485';
export const PROBLEMS_ON_INTERACTION_ID = '719842f2-c554-488c-a3b2-13f5cc238bca';
export const PROBLEM_REPORTER_ID = 'e7584327-22f5-4361-b747-aa9f0b6ddad0';
export const PROBLEMS_ON_MEMBER_ID = '32d86ff6-5487-47bd-88d8-b7b49c691bbe';
export const PROBLEM_SOURCE_INSIGHT_ID = '50005cf6-8697-42c3-b21f-daea58cde577';
export const PROBLEM_RESOLVED_AT_ID = '6e899560-93ac-4ce8-860b-23d08e8e8a40';
export const FN_AI_LEAD_INSIGHTS_ID = '5a559acd-710a-4679-ae0a-d40cb0cd0dc9';
export const FN_AI_LEAD_GENERATE_ID = '5a98317c-64e8-4ad2-aa18-98f5149222be';
export const FN_AI_INSIGHT_DECIDE_ID = '3fea6efa-d2be-4cbf-bf06-2e8cdbbf68ff';
export const FN_AI_BRIEFING_ID = '5f6e672d-3f82-4ab8-b000-36e0681dbe6f';
export const FN_AI_ON_LEAD_CREATED_ID = '7a1d9275-8a03-4e17-b44b-27f4ac650aee';
export const FN_AI_ON_INTERACTION_CREATED_ID = '02ad3992-dee6-4188-a1c6-12b3ec888646';
export const FN_AI_SCORE_REFRESH_ID = '4896b53f-bce8-42bc-b55c-5890cfa242cb';
export const FN_COPILOT_ASK_ID = '082ad175-e8f3-4f88-b292-2046f395edb7';
export const FN_COPILOT_CONFIRM_ID = 'ee902852-cd0b-40d6-b4ab-5eefd3fff7d8';
export const FC_LEAD_INTELLIGENCE_ID = '10e45c71-39a4-4339-92a6-024b6aaf3932';
export const FC_COPILOT_ID = 'dc5b1812-fb62-40df-91a7-94788caf56d0';
export const PL_COPILOT_ID = 'ce27bb88-66b8-4b5d-930c-a91d5d417255';
export const PL_COPILOT_TAB_ID = 'adbea5eb-4903-4b1a-b91a-b9b031c545fa';
export const PL_COPILOT_WIDGET_ID = '0afb160d-2ba2-46c8-b2b6-746360d64e89';
export const NAV_COPILOT_ID = '4dfc9eca-f16e-4819-b5a4-ce552df1aa67';
export const LEAD_PROFILE_INTELLIGENCE_TAB_ID = '6ec5ed8c-55df-4d39-8e2f-e8af77cb007d';
export const LEAD_PROFILE_INTELLIGENCE_WIDGET_ID = '3eccaf4f-601a-432d-87eb-c3056fe438af';
export const APPVAR_AI_PROVIDER_ID = '7228038c-4816-4793-87a4-e3a955cafc3c';
export const APPVAR_AI_API_KEY_ID = '571da046-cdac-4225-9cf1-7fa93e3a053e';
export const APPVAR_AI_BASE_URL_ID = '2028fc88-09da-4231-93a6-e5a693efc1ae';
export const APPVAR_AI_MODEL_ID = '4633bdb5-ee1e-4a58-9118-15b17f06112b';
export const APPVAR_AI_TIMEOUT_ID = '5319eefc-5d28-4e60-af0a-f4e3395f75f8';
export const APPVAR_AI_MAX_OUTPUT_TOKENS_ID = '726f01c4-9e38-4cd3-bb3e-db9a1167c8ad';
export const APPVAR_AI_MAX_RETRIES_ID = 'b73a32a0-ebb0-4874-ad44-4d9d9d65e0d3';
export const APPVAR_AI_TEMPERATURE_ID = 'f6ac3468-f4b7-4f7b-931e-7d00b2fe138f';

// --- Day 7: Lead 360 & relationship operations -----------------------------
export const FN_LEAD_360_ID = '7bbfe3a3-5b3c-4188-a23e-279b0819a72d';
export const FN_LOG_INTERACTION_ID = 'ffbf29a0-ea13-4f52-9dd3-74f40dbd3bad';
export const FN_TASK_CREATE_ID = 'f81b5694-23f1-413b-a328-98ea2293e189';
export const FN_TASK_UPDATE_ID = '72a909a0-6cbf-4393-a034-126e4f9d7cdc';
export const FN_NOTE_CREATE_ID = 'ac132522-ac15-43de-af03-b3deea9f19d6';
export const FN_LEAD_ASSIGN_ID = '5d2d0339-9367-4602-b2c2-02777a22c737';
export const FC_LEAD_360_ID = '09a76f9d-0603-4e6a-b7ab-54d97197db26';
export const LEAD_PROFILE_360_TAB_ID = 'f2ef6750-5350-4916-abe3-104415359a8b';
export const LEAD_PROFILE_360_WIDGET_ID = 'f54a8437-457f-4e83-b2d3-dab69cb715a1';
export const PL_QUICK_ADD_ID = '01eb6ada-d1f4-4204-ba09-113d830e9ee1';
export const PL_QUICK_ADD_TAB_ID = '3c3a693f-aab5-4b55-b577-12768a75e2f1';
export const PL_QUICK_ADD_WIDGET_ID = 'fb3e8c6a-e03d-49d0-a439-38b02db178ee';
export const NAV_QUICK_ADD_ID = 'e0f2611c-6a7d-4988-b4a5-d4256bf39cdd';
export const PL_ONBOARDING_RECORD_ID = '3af05840-f932-4b7b-8752-118b924f7261';
export const PL_ONBOARDING_RECORD_WIZARD_TAB_ID = '1ddd8f45-e265-4eaa-a607-5881cb212b95';
export const PL_ONBOARDING_RECORD_WIZARD_WIDGET_ID = 'c81711d1-204a-411e-95dc-efbd56692eab';
export const PL_ONBOARDING_RECORD_DOCUMENTS_TAB_ID = 'c8413352-6d04-4d6d-bf37-caa6c1004aa3';
export const PL_ONBOARDING_RECORD_DOCUMENTS_WIDGET_ID = 'a8f077f4-7a7e-42dc-9efd-1b07a8e3f69c';
export const PL_ONBOARDING_RECORD_FIELDS_TAB_ID = '74f75a18-eff7-4319-ab4d-c7c50f7b7959';
export const PL_ONBOARDING_RECORD_FIELDS_WIDGET_ID = 'c1378947-8571-4ad8-978d-86210548d797';
export const VIEW_LEADS_ALL_ID = '93fb8c72-3996-4f17-94a1-780ebb84b5c2';
export const CMI_QUICK_ADD_LEAD_ID = 'ab7220cf-fbb5-42a9-aa88-369eb3a45a1b';

// Day 7B — navigation regrouped into Workspace / Relationships / Intelligence /
// Insights / Administration. Twenty's own root items (Opportunities, Dashboards,
// Workflows) get LV-owned entries so the sidebar is entirely ours.
export const NAV_FOLDER_INTELLIGENCE_ID = '0bcf464e-2f4b-4a9c-9c2e-56af4b3a3674';
export const NAV_OPPORTUNITIES_ID = 'bd5ec4ed-e2a7-45d0-b2a7-3e6c7b080b5f';
export const NAV_DASHBOARDS_ID = 'fa7d0300-bfdb-4a59-b87a-ff8ecc176abc';
export const NAV_WORKFLOW_RUNS_ID = '6116d102-38a3-4222-a340-2c2d936bdea5';
export const NAV_WORKFLOW_VERSIONS_ID = '8f659941-2eeb-4574-bb2b-fb3bdf721ee7';

// Day 8 — universal lead capture.
export const LEAD_SOCIAL_PROFILES_FIELD_ID = '89f5b5ec-eb8b-4983-b00e-2dd94996a66d';
export const LEAD_JOB_TITLE_FIELD_ID = '6b2d7ef2-a640-415c-aa65-c485a5f5f0b7';
export const LEAD_CAPTURE_PROVENANCE_FIELD_ID = '24b5a87f-2467-4ca4-9a35-5c736715ec41';
export const LEAD_CAPTURE_KEY_FIELD_ID = 'a9da5164-eae8-4a10-a993-88d363040001';
export const LEAD_CAPTURE_FILES_FIELD_ID = 'cec05fc1-2cca-412f-af1c-9dccb9cf6fc6';
export const FN_CAPTURE_EXTRACT_ID = 'f8731f7e-bc25-444a-a15b-ce8727b051dc';
export const FN_CAPTURE_PREFLIGHT_ID = 'a36112d8-5afb-4e4a-93f7-caf256ef27c8';

export const FN_CAPTURE_CREATE_ID = '413f8f3c-1685-44a7-bfef-33d32ece47bb';
export const FN_CAPTURE_IMPORT_VALIDATE_ID = '761979cb-034d-4696-82c6-fa0f251b271b';
export const FN_CAPTURE_IMPORT_COMMIT_ID = '4681690e-f87d-4322-b677-a6f6c18963ac';


// Day 8 — CSV import batches (the uploaded file, its mapping, validation summary and report).
export const IMPORT_BATCH_OBJECT_ID = 'd796d1f8-08e0-4702-a7f0-083321a3837c';
export const IMPORT_BATCH_NAME_ID = '8baa5d9c-7358-4ffa-92ff-9475ea3e09e7';
export const IMPORT_BATCH_KEY_ID = '50fb7a09-cad4-48f4-9ff8-7d0073a63d80';
export const IMPORT_BATCH_FILE_ID = 'c3362583-b2fa-4576-aeed-b428118b1c1f';
export const IMPORT_BATCH_STATUS_ID = '6c4fcca7-3984-4190-ae1d-40e89d7fcf95';
export const IMPORT_BATCH_ROW_COUNT_ID = 'e964128d-3cff-4305-b094-a4b708408acc';
export const IMPORT_BATCH_MAPPING_ID = '14ed1df8-60fb-4bdd-869f-8355a74ff71c';
export const IMPORT_BATCH_SUMMARY_ID = 'd28008e1-2510-4472-8137-b56182c0eae9';
export const IMPORT_BATCH_REPORT_ID = '3aee8d1a-b0f0-4122-8204-0a4ab0f051a2';
export const IMPORT_BATCH_IMPORTED_BY_ID = '494c1b03-58cf-45a3-bbc7-69446eddb705';
export const FN_CAPTURE_IMPORT_INSPECT_ID = '5e9916de-c297-4814-9726-ea1bd2c85f2e';

// Day 9 — ecosystem entities (partners, experiences, properties): fields, relations, routes, pages.
export const PARTNER_SOURCE_KEY_FIELD_ID = '75e7a918-2664-4e6e-bef4-ad14665d47b1';
export const PARTNER_CATEGORY_FIELD_ID = 'a699c36a-8cd8-4104-bdc0-eee9b85284f0';
export const PARTNER_SUBCATEGORY_FIELD_ID = '73233b9f-8f75-40f8-8b2e-7f08dc47f252';
export const PARTNER_OWNER_FIELD_ID = '94362a0a-8276-49f6-b377-d8342fe853e6';
export const PARTNERS_ON_WORKSPACE_MEMBER_FIELD_ID = 'f4864878-a787-4a6a-bbc3-46e20e5be4e9';
export const PARTNER_CONTACT_FIELD_ID = '29d8ec75-8454-485b-b5c3-d99ea49906f0';
export const PARTNERS_ON_PERSON_FIELD_ID = '712d2cc9-1e2d-44c0-aef2-e5ada5bcba48';
export const PARTNER_ORGANISATION_FIELD_ID = '15a16c6a-8af4-404d-9f61-1dea008ad36b';
export const PARTNERS_ON_COMPANY_FIELD_ID = 'fe2af0e6-088f-4cd6-bf78-98e550fae300';
export const PARTNER_EMAILS_FIELD_ID = 'a2444627-b173-4d9e-bc50-3f02a77f9e07';
export const PARTNER_PHONES_FIELD_ID = 'f95eb0aa-0a35-4849-bfc3-e023f86663e5';
export const PARTNER_WEBSITE_FIELD_ID = '6a2842cb-5bce-48e6-b930-0f3548164a2d';
export const PARTNER_INSTAGRAM_FIELD_ID = '23b53e50-ad7d-4917-8c9b-ef757c786cb9';
export const PARTNER_GEOGRAPHY_FIELD_ID = '909f1930-2d7a-405d-a1f0-76f162724de2';
export const PARTNER_LANGUAGES_FIELD_ID = '344354b0-c5bf-4b4d-a503-acd22b89abcd';
export const PARTNER_DESCRIPTION_FIELD_ID = '7aadbc6a-d447-4475-9ec3-9f2d809303ed';
export const PARTNER_PRICING_FIELD_ID = '48dea80c-9bac-4be6-b3ea-b37fb993efc9';
export const PARTNER_AVAILABILITY_FIELD_ID = '5ac6988e-583b-41aa-9be5-524f035d7d11';
export const PARTNER_POLICIES_FIELD_ID = '98afa81e-bec9-494d-b98a-d6851904f4a8';
export const PARTNER_APPROVED_AT_FIELD_ID = '33f7739e-573c-4176-86c2-1001bcdf1e0a';
export const PARTNER_ACTIVATED_AT_FIELD_ID = '62b48ab0-13ed-461a-a180-314a811d3cf0';
export const PARTNER_STATUS_REASON_FIELD_ID = 'a853d079-95af-4abc-97e9-4c26479aa4e9';
export const PARTNER_PROVENANCE_FIELD_ID = '632b8b8f-ec3a-4104-a6b2-c8aacee9ed6e';
export const EXPERIENCE_SOURCE_KEY_FIELD_ID = '749922ed-91f5-43be-a9fe-b067f55d061e';
export const EXPERIENCE_SUBCATEGORY_FIELD_ID = 'd63293d1-10f1-48cd-a27c-01226ffe029a';
export const EXPERIENCE_SHORT_DESCRIPTION_FIELD_ID = '8b14bd59-8d3a-4a77-924f-13f117c565d5';
export const EXPERIENCE_OWNER_FIELD_ID = '32ebb0fb-6769-4433-9307-d24affee244d';
export const EXPERIENCES_ON_WORKSPACE_MEMBER_FIELD_ID = '54b2f997-c7eb-40f7-b2b1-4cda616f11bf';
export const EXPERIENCE_HOST_FIELD_ID = '12ab89d8-5a65-4805-bc37-147dfae4fa88';
export const EXPERIENCES_ON_PERSON_FIELD_ID = '2a219ebc-d615-42dc-8f1d-8e3bf0e66d0f';
export const EXPERIENCE_HOST_NAME_FIELD_ID = '0f9b5e5e-7965-4148-bcc3-5d79078c3855';
export const EXPERIENCE_DESTINATION_FIELD_ID = 'a525e284-95d8-4415-9df3-626b941b5426';
export const EXPERIENCE_MEETING_POINT_FIELD_ID = '0956b740-021d-4f6c-bedf-96fd2c619a05';
export const EXPERIENCE_DURATION_FIELD_ID = '33256c0f-df67-44a9-9f90-6af13b3762f8';
export const EXPERIENCE_MIN_PARTICIPANTS_FIELD_ID = 'f4bd24c8-2ff6-4d47-a5bf-c797abfe94ab';
export const EXPERIENCE_BASE_PRICE_FIELD_ID = '26752d4a-9fd3-4277-96e4-fbd68ca4c8f0';
export const EXPERIENCE_PRICE_UNIT_FIELD_ID = 'c9ca92b6-a7d8-4b89-b272-fe6f0216d96c';
export const EXPERIENCE_AVAILABILITY_FIELD_ID = '8b61bc68-c206-4594-ab29-7df8a71b86aa';
export const EXPERIENCE_AGE_REQUIREMENT_FIELD_ID = 'b80ad83f-73a4-4b0f-b1b1-daec9bc233b1';
export const EXPERIENCE_DIFFICULTY_FIELD_ID = 'c9dc06c4-88c4-40b7-9b17-df563dc96979';
export const EXPERIENCE_ACCESSIBILITY_FIELD_ID = '51a6d80e-a9cb-4084-8b92-06e1beed39dc';
export const EXPERIENCE_INCLUDED_FIELD_ID = '6f6edb9f-3ad9-410b-9a65-3e2dd43959bb';
export const EXPERIENCE_EXCLUDED_FIELD_ID = 'f0eef310-3026-405b-9ed7-d704737d2b67';
export const EXPERIENCE_REQUIREMENTS_FIELD_ID = '9c9f76bd-e45a-4661-a827-7614f7e87dcd';
export const EXPERIENCE_SAFETY_FIELD_ID = '57cc8d66-fe1c-414a-a14a-74a4dbbb476e';
export const EXPERIENCE_CANCELLATION_POLICY_FIELD_ID = '7a16ecbd-5771-4408-be64-66efde7b6214';
export const EXPERIENCE_IMAGES_FIELD_ID = '30cd317f-a6a3-4616-bbd1-f39fd5e194b8';
export const EXPERIENCE_DOCUMENTS_FIELD_ID = '8000e2a4-6b28-4b5e-af26-0a023b77f6e9';
export const EXPERIENCE_REVIEWER_FIELD_ID = '0b8f87eb-ce48-4ee3-b512-cd49550ec1c0';
export const EXPERIENCES_REVIEWED_ON_MEMBER_FIELD_ID = '2a328861-c7b6-45d8-b450-e3aa200cee4c';
export const EXPERIENCE_SUBMITTED_AT_FIELD_ID = '235bab12-432d-4f9b-b538-294095e9baf6';
export const EXPERIENCE_APPROVED_AT_FIELD_ID = '0a5797ad-d527-4606-b6ef-8721487b58ad';
export const EXPERIENCE_ACTIVATED_AT_FIELD_ID = 'cb4ff94f-c918-4fb5-933d-a74429ad61c7';
export const EXPERIENCE_STATUS_REASON_FIELD_ID = '4e98afd5-f9ee-4a57-9e77-9aa2743d0bed';
export const EXPERIENCE_ONBOARDING_FIELD_ID = 'd80a037f-5f48-4847-8b8e-00a9e567faa4';
export const EXPERIENCES_ON_ONBOARDING_FIELD_ID = '9de312d4-d954-4652-9377-cfb248538c33';
export const PROPERTY_SOURCE_KEY_FIELD_ID = '9b43db5f-2557-4faa-90d5-991da5688460';
export const PROPERTY_OWNER_FIELD_ID = '7477bae4-e2bc-408b-8ed2-d74279c982f8';
export const PROPERTIES_ON_WORKSPACE_MEMBER_FIELD_ID = 'dc8f44a3-a00d-4655-934a-8a992e6f44c3';
export const PROPERTY_MANAGER_FIELD_ID = '09a41a74-6a49-491c-8bbe-1ce57f290e54';
export const PROPERTIES_MANAGED_ON_PERSON_FIELD_ID = '3031faf3-bf7c-4fa8-82c6-d8ad484ec6d9';
export const PROPERTY_ADDRESS_FIELD_ID = '1d8cd31e-9e95-43f8-9aa2-1daeb12836b4';
export const PROPERTY_DESTINATION_FIELD_ID = '76b2e7d7-e314-4f56-9a37-abb46b036ff7';
export const PROPERTY_DESCRIPTION_FIELD_ID = 'baef4469-822d-4cef-ad23-71398396e98a';
export const PROPERTY_ROOMS_FIELD_ID = '40fd8c54-ed0e-4e7b-aaac-133b72147117';
export const PROPERTY_AMENITIES_FIELD_ID = '890f7fdd-2905-458f-9ed9-93e078d7d3a8';
export const PROPERTY_BASE_PRICE_FIELD_ID = 'b70ca585-be55-494b-b6a1-298dacf0ceeb';
export const PROPERTY_PRICE_UNIT_FIELD_ID = 'ebb517bb-a4ed-451b-bb39-3753c6e9542d';
export const PROPERTY_AVAILABILITY_FIELD_ID = '9df9af06-3a01-412f-ac07-bc7480ca56ea';
export const PROPERTY_CHECK_IN_FIELD_ID = 'f61e1ba3-2056-4ad2-b192-0828e1bb8065';
export const PROPERTY_CHECK_OUT_FIELD_ID = '6674e76a-4e83-4542-93d7-50c15afb7294';
export const PROPERTY_CANCELLATION_POLICY_FIELD_ID = 'ed3bdf7e-ad04-40e4-9cc4-c79b7a0725bd';
export const PROPERTY_HOUSE_RULES_FIELD_ID = 'ad60761a-a042-442c-9b94-d392bc056298';
export const PROPERTY_IMAGES_FIELD_ID = '94949215-3972-4295-acb5-6f250a0fc3b0';
export const PROPERTY_DOCUMENTS_FIELD_ID = '51fbd3ac-01e6-4d9a-930c-1e6d52365fea';
export const PROPERTY_REVIEWER_FIELD_ID = '04bba377-18a0-4bbe-9b38-af8d9c075a01';
export const PROPERTIES_REVIEWED_ON_MEMBER_FIELD_ID = 'b7ec211b-e5d3-4bbe-9aed-313a596b649d';
export const PROPERTY_SUBMITTED_AT_FIELD_ID = 'ddda5098-de7e-4f01-81ea-28ab70692bfc';
export const PROPERTY_APPROVED_AT_FIELD_ID = '2a13b0f2-ba07-4d8b-a9e8-36838858819b';
export const PROPERTY_ACTIVATED_AT_FIELD_ID = '3e598935-b65c-4d1e-87fe-a4c1a472c31e';
export const PROPERTY_STATUS_REASON_FIELD_ID = 'f0f72a69-f1bc-4a77-9e3b-4a481882f06f';
export const PROPERTY_ONBOARDING_FIELD_ID = 'a7d5dcb7-c7a5-4d0a-a256-791e35678261';
export const PROPERTIES_ON_ONBOARDING_FIELD_ID = '30d29e40-2949-4aa2-ab73-4a5f344d065f';
export const FN_ON_PARTNER_APPROVAL_ID = 'e050905e-b88b-4438-b44d-cda3e75c9b8d';
export const FN_PARTNER_360_ID = 'a8526e48-4f18-4c44-9575-e88214d9c50b';
export const FN_EXPERIENCE_360_ID = '342c3f73-f42c-4fe6-ac6a-d1577b2f9010';
export const FN_PROPERTY_360_ID = '8c1d045a-947c-4006-af9f-8e972a8b004e';
export const FN_ECOSYSTEM_TRANSITION_ID = '1eac9d68-07ed-4cf4-b7fc-a05da21a0500';
export const FN_ECOSYSTEM_CREATE_ID = '3895d90e-3ab7-498f-b65e-12ca7784809d';
export const FN_ECOSYSTEM_READINESS_ID = '02324415-48e6-4e7d-9976-dbb5f5740741';
export const FC_PARTNER_360_ID = '984ca243-26e5-4f78-a584-336fdea413d2';
export const FC_EXPERIENCE_360_ID = 'bdbe8cf7-1cbd-4304-b92e-8c36ee0d3e12';
export const FC_PROPERTY_360_ID = 'cfc75f1d-8ea0-40b9-8296-0ff7af02deef';
export const PL_PARTNER_PROFILE_ID = '6a5fda0c-00a5-4cd8-8924-9a8d1ba0f1aa';
export const PL_PARTNER_360_TAB_ID = '70484f22-2b93-4d9e-8240-77d13e319ef4';
export const PL_PARTNER_360_WIDGET_ID = 'ebe21184-d663-49d5-9c79-7b6279756824';
export const PL_PARTNER_DETAILS_TAB_ID = 'fa1ea01b-3e7c-4c67-8772-24a738cee63c';
export const PL_PARTNER_DETAILS_WIDGET_ID = '2244e88b-c20c-45b7-9d32-77c505823a44';
export const PL_EXPERIENCE_PROFILE_ID = '646fb921-cba6-437e-b453-9485003e61b9';
export const PL_EXPERIENCE_360_TAB_ID = '539548af-0e7b-4934-8560-644e795986ce';
export const PL_EXPERIENCE_360_WIDGET_ID = '2fa18dfe-b296-437b-811f-08b045f9f5ce';
export const PL_EXPERIENCE_DETAILS_TAB_ID = 'c580ed0c-a7fe-4beb-a383-9de4dc7699c1';
export const PL_EXPERIENCE_DETAILS_WIDGET_ID = 'e78af19f-9ec0-46a8-b5b8-45ed6ffeb7ad';
export const PL_PROPERTY_PROFILE_ID = 'da8e9d55-00e6-431c-9e00-613c7deaee78';
export const PL_PROPERTY_360_TAB_ID = 'a810d474-fec1-4e6f-aa38-cc3b24838e80';
export const PL_PROPERTY_360_WIDGET_ID = '7c197ec3-a560-45e6-9571-90f72a0359c3';
export const PL_PROPERTY_DETAILS_TAB_ID = '29a5e461-5e28-4213-9a3b-722ea36d6250';
export const PL_PROPERTY_DETAILS_WIDGET_ID = 'cb41d705-207a-43dc-a768-3821832e3b42';

// The La Vivenzia shell — the six-door workspace (docs/UI-EXACT-MATCH-PLAN.md).
export const FC_LV_HOME_ID = '49dc0101-7649-4445-8776-859e57967505';
export const PL_LV_HOME_ID = 'fe15eb21-6f12-465e-951f-22e8c07f23e8';
export const PL_LV_HOME_TAB_ID = '8df65126-81a9-4cec-b67f-11037ec3bdf6';
export const PL_LV_HOME_WIDGET_ID = '2bcfac1e-6b57-4b46-aa4a-a27ccd0ad4be';
export const NAV_LV_HOME_ID = '3318d241-d11d-400f-bd1d-3a4df907ffae';
