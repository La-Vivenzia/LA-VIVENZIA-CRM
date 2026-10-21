const crypto = require('crypto');
const fs = require('fs');

const timId = '20202020-0000-4000-8000-000000000001';

// Generate UUIDs
const ids = {
  persons: Array.from({ length: 5 }, () => crypto.randomUUID()),
  leads: Array.from({ length: 5 }, () => crypto.randomUUID()),
  properties: Array.from({ length: 3 }, () => crypto.randomUUID()),
  experiences: Array.from({ length: 3 }, () => crypto.randomUUID()),
  partners: Array.from({ length: 2 }, () => crypto.randomUUID()),
  onboardings: Array.from({ length: 3 }, () => crypto.randomUUID()),
  problems: Array.from({ length: 4 }, () => crypto.randomUUID()),
  slas: Array.from({ length: 2 }, () => crypto.randomUUID()),
  assignmentHistories: Array.from({ length: 3 }, () => crypto.randomUUID()),
  interactions: Array.from({ length: 15 }, () => crypto.randomUUID())
};

// Common values
const tsNow = `NOW()`;
const commonAuditFields = `'Tim Cook', 'Tim Cook', '${timId}', '${timId}'`;

// Data Definitions
const personsData = [
  { id: ids.persons[0], first: 'Rahul', last: 'Sharma', email: 'rahul.s@luxuryvillasgoa.com' },
  { id: ids.persons[1], first: 'Ayesha', last: 'Desai', email: 'ayesha.desai@heritagegoa.in' },
  { id: ids.persons[2], first: 'Carlos', last: 'Mendes', email: 'carlos.m@yachtclub.in' },
  { id: ids.persons[3], first: 'Meera', last: 'Rao', email: 'meera.rao@wellnessretreat.com' },
  { id: ids.persons[4], first: 'Vikram', last: 'Singh', email: 'vikram.singh@goanadventures.com' }
];

const leadsData = [
  { id: ids.leads[0], name: 'Luxury Villas Goa', code: 'LVT-100', org: 'LVG Pvt Ltd', category: 'STAY', subcategory: 'VILLA', location: 'Assagao, Goa', source: 'WEBSITE', status: 'NEW', priority: 'HIGH', email: 'rahul.s@luxuryvillasgoa.com', phone: '+919876500001' },
  { id: ids.leads[1], name: 'Heritage Farmstay', code: 'LVT-101', org: 'Heritage Stays', category: 'STAY', subcategory: 'HERITAGE_PROPERTY', location: 'Divar Island, Goa', source: 'REFERRAL', status: 'QUALIFYING', priority: 'MEDIUM', email: 'ayesha.desai@heritagegoa.in', phone: '+919876500002' },
  { id: ids.leads[2], name: 'Private Yacht Charter', code: 'LVT-102', org: 'Mendes Marine', category: 'EXPERIENCE', subcategory: 'ADVENTURE_PROVIDER', location: 'Panjim, Goa', source: 'INSTAGRAM', status: 'INTERESTED', priority: 'HIGH', email: 'carlos.m@yachtclub.in', phone: '+919876500003' },
  { id: ids.leads[3], name: 'Ayurvedic Wellness Retreat', code: 'LVT-103', org: 'Rao Wellness', category: 'EXPERIENCE', subcategory: 'WELLNESS_PROVIDER', location: 'Mandrem, Goa', source: 'LINKEDIN', status: 'NEGOTIATION', priority: 'CRITICAL', email: 'meera.rao@wellnessretreat.com', phone: '+919876500004' },
  { id: ids.leads[4], name: 'Spice Plantation Walk', code: 'LVT-104', org: 'Goan Adventures', category: 'EXPERIENCE', subcategory: 'NATURE_EXPERT', location: 'Ponda, Goa', source: 'WEBSITE', status: 'ONBOARDING_INITIATED', priority: 'MEDIUM', email: 'vikram.singh@goanadventures.com', phone: '+919876500005' }
];

const propertiesData = [
  { id: ids.properties[0], name: 'Casa de Assagao', code: 'PRP-101', status: 'READY', type: 'VILLA', location: 'Assagao', destination: 'North Goa', manager: ids.persons[0] },
  { id: ids.properties[1], name: 'Divar Heritage Home', code: 'PRP-102', status: 'LIVE', type: 'HERITAGE_PROPERTY', location: 'Divar Island', destination: 'Central Goa', manager: ids.persons[1] },
  { id: ids.properties[2], name: 'Mandrem Bliss', code: 'PRP-103', status: 'IN_REVIEW', type: 'RETREAT_CENTRE', location: 'Mandrem', destination: 'North Goa', manager: ids.persons[3] }
];

const experiencesData = [
  { id: ids.experiences[0], name: 'Mandovi Sunset Cruise', code: 'EXP-101', status: 'LIVE', category: 'EXPERIENCE', location: 'Panjim', destination: 'Goa', host: ids.persons[2] },
  { id: ids.experiences[1], name: 'Ponda Spice Tour', code: 'EXP-102', status: 'IN_REVIEW', category: 'EXPERIENCE', location: 'Ponda', destination: 'Goa', host: ids.persons[4] },
  { id: ids.experiences[2], name: 'Ayurvedic Detox Weekend', code: 'EXP-103', status: 'DRAFT', category: 'EXPERIENCE', location: 'Mandrem', destination: 'Goa', host: ids.persons[3] }
];

const partnersData = [
  { id: ids.partners[0], name: 'Mendes Marine', code: 'PTN-001', status: 'ACTIVE', type: 'BUSINESS', category: 'EXPERIENCE', subcategory: 'ADVENTURE_PROVIDER', desc: 'Premium yacht charters in Goa.', email: 'carlos.m@yachtclub.in', lead: ids.leads[2] },
  { id: ids.partners[1], name: 'Heritage Stays', code: 'PTN-002', status: 'ONBOARDING', type: 'HOST', category: 'STAY', subcategory: 'HERITAGE_PROPERTY', desc: 'Curators of authentic Goan heritage properties.', email: 'ayesha.desai@heritagegoa.in', lead: ids.leads[1] }
];

const onboardingsData = [
  { id: ids.onboardings[0], name: 'Onboarding: Heritage Stays', status: 'IN_PROGRESS', step: 'DOCUMENTS', health: 85, lead: ids.leads[1] },
  { id: ids.onboardings[1], name: 'Onboarding: Rao Wellness', status: 'WAITING_FOR_PARTNER', step: 'PRICING', health: 60, lead: ids.leads[3] },
  { id: ids.onboardings[2], name: 'Onboarding: Goan Adventures', status: 'INITIATED', step: 'BASIC_INFORMATION', health: 100, lead: ids.leads[4] }
];

const problemsData = [
  { id: ids.problems[0], name: 'Pricing Discrepancy', type: 'PRICING', severity: 'HIGH', status: 'OPEN', desc: 'The base price provided during the call does not match the pricing document.', lead: ids.leads[2] },
  { id: ids.problems[1], name: 'Missing Trade License', type: 'DOCUMENTATION', severity: 'CRITICAL', status: 'IN_PROGRESS', desc: 'Partner has not uploaded the mandatory trade license for the yacht.', lead: ids.leads[2] },
  { id: ids.problems[2], name: 'Location Pin Inaccurate', type: 'LOCATION', severity: 'LOW', status: 'RESOLVED', desc: 'Google Maps pin is pointing to the wrong side of the river.', lead: ids.leads[0] },
  { id: ids.problems[3], name: 'Availability Sync Issue', type: 'AVAILABILITY', severity: 'MEDIUM', status: 'OPEN', desc: 'Calendar sync via iCal is failing.', lead: ids.leads[1] }
];

const slasData = [
  { id: ids.slas[0], name: 'New Lead Contact SLA - Luxury Villas', rule: 'NEW_LEAD_CONTACT', status: 'DUE_SOON', priority: 'HIGH', lead: ids.leads[0] },
  { id: ids.slas[1], name: 'Missing Document SLA - Yacht Charter', rule: 'MISSING_DOCUMENT', status: 'BREACHED', priority: 'CRITICAL', lead: ids.leads[2] }
];

const assignmentHistoriesData = [
  { id: ids.assignmentHistories[0], name: 'Assigned Luxury Villas to Tim', strategy: 'ROUND_ROBIN', score: 95, lead: ids.leads[0] },
  { id: ids.assignmentHistories[1], name: 'Assigned Wellness Retreat to Tim', strategy: 'SCORED', score: 88, lead: ids.leads[3] },
  { id: ids.assignmentHistories[2], name: 'Assigned Heritage Farmstay to Tim', strategy: 'MANUAL', score: 100, lead: ids.leads[1] }
];

let sql = '';

// Helper for strings
const q = str => str ? "'" + str.replace(/'/g, "''") + "'" : 'NULL';

// Persons
personsData.forEach(p => {
  sql += `INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."person" ("id", "nameFirstName", "nameLastName", "emailsPrimaryEmail", "createdAt", "updatedAt", "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId") VALUES ('${p.id}', ${q(p.first)}, ${q(p.last)}, ${q(p.email)}, ${tsNow}, ${tsNow}, ${commonAuditFields});\n`;
});

// Leads
leadsData.forEach(l => {
  sql += `INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvLead" ("id", "name", "lvLeadId", "organisationName", "category", "subcategory", "location", "source", "status", "priority", "emailsPrimaryEmail", "phonesPrimaryPhoneNumber", "ownerId", "createdAt", "updatedAt", "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId") VALUES ('${l.id}', ${q(l.name)}, ${q(l.code)}, ${q(l.org)}, '${l.category}', '${l.subcategory}', ${q(l.location)}, '${l.source}', '${l.status}', '${l.priority}', ${q(l.email)}, ${q(l.phone)}, '${timId}', ${tsNow}, ${tsNow}, ${commonAuditFields});\n`;
});

// Properties
propertiesData.forEach(p => {
  sql += `INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvProperty" ("id", "name", "propertyCode", "status", "propertyType", "location", "destination", "ownerId", "managerId", "createdAt", "updatedAt", "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId") VALUES ('${p.id}', ${q(p.name)}, ${q(p.code)}, '${p.status}', '${p.type}', ${q(p.location)}, ${q(p.destination)}, '${timId}', '${p.manager}', ${tsNow}, ${tsNow}, ${commonAuditFields});\n`;
});

// Experiences
experiencesData.forEach(e => {
  sql += `INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvExperience" ("id", "name", "experienceCode", "status", "category", "location", "destination", "ownerId", "hostId", "createdAt", "updatedAt", "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId") VALUES ('${e.id}', ${q(e.name)}, ${q(e.code)}, '${e.status}', '${e.category}', ${q(e.location)}, ${q(e.destination)}, '${timId}', '${e.host}', ${tsNow}, ${tsNow}, ${commonAuditFields});\n`;
});

// Partners
partnersData.forEach(p => {
  sql += `INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvPartner" ("id", "name", "partnerCode", "status", "partnerType", "category", "subcategory", "description", "emailsPrimaryEmail", "ownerId", "leadId", "createdAt", "updatedAt", "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId") VALUES ('${p.id}', ${q(p.name)}, ${q(p.code)}, '${p.status}', '${p.type}', '${p.category}', '${p.subcategory}', ${q(p.desc)}, ${q(p.email)}, '${timId}', '${p.lead}', ${tsNow}, ${tsNow}, ${commonAuditFields});\n`;
});

// Onboardings
onboardingsData.forEach(o => {
  sql += `INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvOnboarding" ("id", "name", "status", "currentStep", "healthScore", "leadId", "createdAt", "updatedAt", "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId") VALUES ('${o.id}', ${q(o.name)}, '${o.status}', '${o.step}', ${o.health}, '${o.lead}', ${tsNow}, ${tsNow}, ${commonAuditFields});\n`;
});

// Problems
problemsData.forEach(p => {
  sql += `INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvProblem" ("id", "name", "problemType", "severity", "status", "description", "leadId", "createdAt", "updatedAt", "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId") VALUES ('${p.id}', ${q(p.name)}, '${p.type}', '${p.severity}', '${p.status}', ${q(p.desc)}, '${p.lead}', ${tsNow}, ${tsNow}, ${commonAuditFields});\n`;
});

// SLAs
slasData.forEach(s => {
  sql += `INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvSla" ("id", "name", "rule", "status", "priority", "ownerId", "leadId", "createdAt", "updatedAt", "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId") VALUES ('${s.id}', ${q(s.name)}, '${s.rule}', '${s.status}', '${s.priority}', '${timId}', '${s.lead}', ${tsNow}, ${tsNow}, ${commonAuditFields});\n`;
});

// Assignment Histories
assignmentHistoriesData.forEach(a => {
  sql += `INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvAssignmentHistory" ("id", "name", "strategy", "score", "leadId", "toOwnerId", "createdAt", "updatedAt", "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId") VALUES ('${a.id}', ${q(a.name)}, '${a.strategy}', ${a.score}, '${a.lead}', '${timId}', ${tsNow}, ${tsNow}, ${commonAuditFields});\n`;
});

// Interactions (generate 3 interactions per lead)
leadsData.forEach((lead, idx) => {
  for(let i=0; i<3; i++) {
    const intId = ids.interactions[idx*3 + i];
    const purposes = ['INTRODUCTION', 'QUALIFICATION', 'NEGOTIATION'];
    const channels = ['PHONE', 'EMAIL', 'WHATSAPP'];
    const outcomes = ['INTERESTED', 'AWAITING_RESPONSE', 'CONNECTED'];
    const desc = `Detailed notes regarding the ${purposes[i]} phase via ${channels[i]}. Discussed various aspects of La Vivenzia partnership.`;
    const blocknote = `[{"type":"paragraph","content":"${desc}"}]`;
    sql += `INSERT INTO workspace_1wgvd1injqtife6y4rvfbu3h5."_lvInteraction" ("id", "name", "channel", "direction", "occurredAt", "durationMinutes", "purpose", "summaryBlocknote", "sentiment", "outcome", "leadId", "actorId", "createdAt", "updatedAt", "createdByName", "updatedByName", "createdByWorkspaceMemberId", "updatedByWorkspaceMemberId") VALUES ('${intId}', 'Interaction ${i+1} for ${lead.name.replace(/'/g,"''")}', '${channels[i]}', 'OUTBOUND', NOW() - INTERVAL '${i+1} days', ${Math.floor(Math.random()*20 + 5)}, '${purposes[i]}', ${q(blocknote)}, 'POSITIVE', '${outcomes[i]}', '${lead.id}', '${timId}', NOW() - INTERVAL '${i+1} days', NOW() - INTERVAL '${i+1} days', ${commonAuditFields});\n`;
  }
});

fs.writeFileSync('insert_comprehensive_data.sql', sql);
