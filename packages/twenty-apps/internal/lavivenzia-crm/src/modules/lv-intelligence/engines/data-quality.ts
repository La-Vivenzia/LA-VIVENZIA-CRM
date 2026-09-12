import { type LeadContext } from 'src/modules/lv-intelligence/services/lead-context';
import { type LeadFacts } from 'src/modules/lv-intelligence/engines/lead-facts';
import { normalizeNameForMatching, normalizeWebsiteUrl } from 'src/modules/lv-capture/utils/normalize-input';
import { PROMPT_VERSIONS } from 'src/modules/lv-ai/prompts/prompt-registry';

// Data Quality v1 — deterministic checks over one lead's context. Each issue
// names its target, severity, evidence and a recommended correction; nothing
// here changes a record. The checks are exactly the ones the brief lists and
// the data model supports; anything that would need a source the CRM does
// not have (e.g. verifying a phone number is reachable) is not claimed.

export const DATA_QUALITY_RULES_VERSION = PROMPT_VERSIONS.dataQuality;

export type DataQualityIssue = {
  code:
    | 'MISSING_CONTACT'
    | 'MISSING_EMAIL'
    | 'MISSING_PHONE'
    | 'MALFORMED_WEBSITE'
    | 'MALFORMED_EMAIL'
    | 'INCONSISTENT_ORGANISATION'
    | 'STALE_LEAD'
    | 'MISSING_NEXT_ACTION'
    | 'MISSING_NEXT_FOLLOW_UP'
    | 'OVERDUE_FOLLOW_UP_DATE'
    | 'CONTRADICTORY_STATUS'
    | 'INCOMPLETE_ONBOARDING'
    | 'DOCUMENT_MISMATCH'
    | 'MISSING_CATEGORY'
    | 'MISSING_LOCATION'
    | 'DUPLICATE_FLAGGED';
  target: { object: string; recordId: string; field: string | null };
  issue: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence: string;
  recommendedCorrection: string;
};

export type DataQualityResult = { issues: DataQualityIssue[]; score: number; rulesVersion: string; generatedAt: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const assessDataQuality = (context: LeadContext, facts: LeadFacts): DataQualityResult => {
  const { lead } = context;
  const issues: DataQualityIssue[] = [];
  const target = (field: string | null) => ({ object: 'lvLead', recordId: lead.id, field });

  if (!facts.hasEmail && !facts.hasPhone) {
    issues.push({ code: 'MISSING_CONTACT', target: target('emails'), issue: 'No contact channel', severity: 'HIGH', evidence: 'Both primary email and primary phone are empty.', recommendedCorrection: 'Record at least one of email or phone from the source (website, Instagram, referral).' });
  } else {
    if (!facts.hasEmail) {
      issues.push({ code: 'MISSING_EMAIL', target: target('emails'), issue: 'No email address', severity: 'LOW', evidence: 'Primary email is empty.', recommendedCorrection: 'Ask for an email address at the next contact.' });
    }

    if (!facts.hasPhone) {
      issues.push({ code: 'MISSING_PHONE', target: target('phones'), issue: 'No phone number', severity: 'LOW', evidence: 'Primary phone is empty.', recommendedCorrection: 'Ask for a phone / WhatsApp number at the next contact.' });
    }
  }

  const email = lead.emails?.primaryEmail?.trim();

  if (email && !EMAIL.test(email)) {
    issues.push({ code: 'MALFORMED_EMAIL', target: target('emails'), issue: 'Email looks malformed', severity: 'MEDIUM', evidence: `"${email}" is not a valid address shape.`, recommendedCorrection: 'Correct the address or remove it.' });
  }

  const website = lead.website?.primaryLinkUrl?.trim();

  if (website && normalizeWebsiteUrl(website) === null) {
    issues.push({ code: 'MALFORMED_WEBSITE', target: target('website'), issue: 'Website URL looks malformed', severity: 'MEDIUM', evidence: `"${website}" could not be parsed as a URL.`, recommendedCorrection: 'Enter the full address, e.g. https://example.in.' });
  }

  if (lead.organisationName) {
    const tidy = lead.organisationName.trim().replace(/\s+/g, ' ');

    if (tidy !== lead.organisationName) {
      issues.push({ code: 'INCONSISTENT_ORGANISATION', target: target('organisationName'), issue: 'Organisation name has stray whitespace', severity: 'LOW', evidence: `"${lead.organisationName}"`, recommendedCorrection: `Save it as "${tidy}".` });
    } else if (lead.name && normalizeNameForMatching(lead.name) === normalizeNameForMatching(lead.organisationName) && lead.name !== lead.organisationName) {
      issues.push({ code: 'INCONSISTENT_ORGANISATION', target: target('organisationName'), issue: 'Lead and organisation names differ only in formatting', severity: 'LOW', evidence: `"${lead.name}" vs "${lead.organisationName}"`, recommendedCorrection: 'Use one spelling for both, or make the lead name the contact person.' });
    }
  }

  if (!facts.hasCategory && facts.isOpen) {
    issues.push({ code: 'MISSING_CATEGORY', target: target('category'), issue: 'No category', severity: 'MEDIUM', evidence: 'category is empty.', recommendedCorrection: 'Set the ecosystem category (the AI classification suggestion can help).' });
  }

  if (!facts.hasLocation && facts.isOpen) {
    issues.push({ code: 'MISSING_LOCATION', target: target('location'), issue: 'No location', severity: 'LOW', evidence: 'location is empty.', recommendedCorrection: 'Record the town or region; assignment and search depend on it.' });
  }

  if (facts.isOpen && facts.interactionCount > 0 && (facts.daysSinceLastInteraction ?? 0) > 30) {
    issues.push({ code: 'STALE_LEAD', target: target('status'), issue: 'Lead has gone stale', severity: 'MEDIUM', evidence: `Open status but the last interaction was ${facts.daysSinceLastInteraction} day(s) ago.`, recommendedCorrection: 'Re-engage, or move the lead to Follow up later / Dormant so the pipeline stays honest.' });
  }

  if (facts.isOpen && facts.status !== 'NEW' && facts.status !== 'DISCOVERED' && !facts.hasNextAction) {
    issues.push({ code: 'MISSING_NEXT_ACTION', target: target('nextAction'), issue: 'No next action recorded', severity: 'MEDIUM', evidence: 'nextAction is empty on an active lead.', recommendedCorrection: 'Write the next step (the Next Best Action suggestion can be accepted).' });
  }

  if (facts.isOpen && facts.status !== 'NEW' && facts.status !== 'DISCOVERED' && !facts.nextFollowUpAt && facts.openTasks.length === 0) {
    issues.push({ code: 'MISSING_NEXT_FOLLOW_UP', target: target('nextFollowUpAt'), issue: 'No follow-up scheduled', severity: 'MEDIUM', evidence: 'nextFollowUpAt is empty and there is no open task.', recommendedCorrection: 'Schedule the next follow-up.' });
  }

  if (facts.nextFollowUpOverdue) {
    issues.push({ code: 'OVERDUE_FOLLOW_UP_DATE', target: target('nextFollowUpAt'), issue: 'Next follow-up date is in the past', severity: 'LOW', evidence: `nextFollowUpAt ${lead.nextFollowUpAt?.slice(0, 10)}`, recommendedCorrection: 'Log the interaction that happened, or move the date.' });
  }

  if ((facts.status === 'LIVE_ACTIVE' || facts.status === 'APPROVED') && (!context.onboarding || !['APPROVED', 'ACTIVATED'].includes(context.onboarding.status ?? ''))) {
    issues.push({ code: 'CONTRADICTORY_STATUS', target: target('status'), issue: 'Lead status disagrees with onboarding', severity: 'HIGH', evidence: `Lead is ${facts.status} but onboarding is ${context.onboarding?.status ?? 'absent'}.`, recommendedCorrection: 'Align the lead status with the onboarding outcome.' });
  }

  if (context.onboarding && lead.onboardingStatus && lead.onboardingStatus !== context.onboarding.status) {
    issues.push({ code: 'CONTRADICTORY_STATUS', target: target('onboardingStatus'), issue: 'Mirrored onboarding status is out of date', severity: 'LOW', evidence: `lead.onboardingStatus ${lead.onboardingStatus} ≠ onboarding ${context.onboarding.status}`, recommendedCorrection: 'The mirror refreshes on the next onboarding update; no manual action needed unless it persists.' });
  }

  if (context.onboarding && ['IN_PROGRESS', 'WAITING_FOR_PARTNER', 'CHANGES_REQUESTED'].includes(context.onboarding.status ?? '') && (facts.onboarding?.daysSinceUpdate ?? 0) > 14) {
    issues.push({ code: 'INCOMPLETE_ONBOARDING', target: { object: 'lvOnboarding', recordId: context.onboarding.id, field: 'status' }, issue: 'Onboarding incomplete and idle', severity: 'MEDIUM', evidence: `${context.onboarding.status} with no update for ${facts.onboarding?.daysSinceUpdate} day(s)${context.onboarding.progressPercentage !== null ? `, ${context.onboarding.progressPercentage}% complete` : ''}.`, recommendedCorrection: 'Contact the partner about the remaining steps.' });
  }

  for (const doc of context.onboarding?.documents ?? []) {
    if (doc.verificationState === 'VERIFIED' && doc.expiresAt && Date.parse(doc.expiresAt) < Date.parse(facts.now)) {
      issues.push({ code: 'DOCUMENT_MISMATCH', target: { object: 'lvOnboardingDocument', recordId: doc.id, field: 'verificationState' }, issue: 'Verified document has expired', severity: 'HIGH', evidence: `${doc.documentType ?? 'Document'} expired ${doc.expiresAt.slice(0, 10)} but is still VERIFIED.`, recommendedCorrection: 'Mark it expired and request a replacement.' });
    }
  }

  const weights = { HIGH: 25, MEDIUM: 12, LOW: 5 } as const;
  const penalty = issues.reduce((sum, issue) => sum + weights[issue.severity], 0);

  return { issues, score: Math.max(0, 100 - penalty), rulesVersion: DATA_QUALITY_RULES_VERSION, generatedAt: facts.now };
};
