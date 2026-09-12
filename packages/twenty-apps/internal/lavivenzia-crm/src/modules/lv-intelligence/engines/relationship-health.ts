import { type LeadFacts } from 'src/modules/lv-intelligence/engines/lead-facts';
import { PROMPT_VERSIONS } from 'src/modules/lv-ai/prompts/prompt-registry';

// Relationship Health v1 — a state, not a number, derived from evidence the
// CRM holds. The rules, in order of precedence:
//
//   UNKNOWN   no interaction has ever been recorded (silence is not a state
//             of the relationship; it is an absence of data)
//   DORMANT   the lead is in a closed / archived status, or the last
//             interaction is more than 60 days old
//   AT_RISK   an unresolved SLA breach, an open HIGH/CRITICAL problem, a
//             recorded negative sentiment in the last two interactions,
//             status NO_RESPONSE, or 31–60 days of silence on an open lead
//   ATTENTION an overdue follow-up, waiting for the partner's reply for more
//             than 7 days, no next action on an engaged lead, or 15–30 days
//             of silence
//   HEALTHY   none of the above
//
// Each state comes with the reasons that triggered it and the record ids
// behind them. No emotional state is inferred; "negative" means the team
// member recorded sentiment NEGATIVE on an interaction.

export const HEALTH_RULES_VERSION = PROMPT_VERSIONS.relationshipHealth;

export const HEALTH_STATES = ['HEALTHY', 'ATTENTION', 'AT_RISK', 'DORMANT', 'UNKNOWN'] as const;

export type HealthState = (typeof HEALTH_STATES)[number];

export type HealthReason = { reason: string; evidence: string; recordIds: string[] };

export type RelationshipHealthResult = {
  state: HealthState;
  reasons: HealthReason[];
  positives: HealthReason[];
  rulesVersion: string;
  generatedAt: string;
};

export const assessRelationshipHealth = (facts: LeadFacts): RelationshipHealthResult => {
  const generatedAt = facts.now;
  const reasons: HealthReason[] = [];
  const positives: HealthReason[] = [];

  if (facts.interactionCount === 0) {
    return {
      state: 'UNKNOWN',
      reasons: [{ reason: 'No interaction recorded', evidence: 'The relationship cannot be assessed until a conversation is logged.', recordIds: [facts.leadId] }],
      positives,
      rulesVersion: HEALTH_RULES_VERSION,
      generatedAt,
    };
  }

  const silence = facts.daysSinceLastInteraction ?? 0;

  if (facts.isInactive && facts.status !== 'FOLLOW_UP_LATER' && facts.status !== 'NO_RESPONSE') {
    reasons.push({ reason: 'Lead is closed or archived', evidence: `Status ${facts.status.toLowerCase().replace(/_/g, ' ')}`, recordIds: [facts.leadId] });

    return { state: 'DORMANT', reasons, positives, rulesVersion: HEALTH_RULES_VERSION, generatedAt };
  }

  if (silence > 60) {
    reasons.push({ reason: 'No contact for over 60 days', evidence: `Last interaction ${silence} day(s) ago`, recordIds: facts.lastInteraction ? [facts.lastInteraction.id] : [facts.leadId] });

    return { state: 'DORMANT', reasons, positives, rulesVersion: HEALTH_RULES_VERSION, generatedAt };
  }

  // AT_RISK signals
  if (facts.breachedSlas.length > 0) {
    reasons.push({ reason: 'SLA breached', evidence: `${facts.breachedSlas.length} unresolved breach(es)`, recordIds: facts.breachedSlas.map((sla) => sla.id) });
  }

  const severeProblems = facts.openProblems.filter((problem) => problem.severity === 'HIGH' || problem.severity === 'CRITICAL');

  if (severeProblems.length > 0) {
    reasons.push({ reason: 'Open high-severity problem', evidence: `${severeProblems.length} problem(s) marked high or critical`, recordIds: severeProblems.map((problem) => problem.id) });
  }

  if (facts.recentSentiments.slice(0, 2).includes('NEGATIVE')) {
    reasons.push({ reason: 'Negative sentiment recorded', evidence: 'A team member recorded NEGATIVE sentiment on a recent interaction', recordIds: facts.lastInteraction ? [facts.lastInteraction.id] : [] });
  }

  if (facts.status === 'NO_RESPONSE') {
    reasons.push({ reason: 'Status is No response', evidence: 'The partner has not answered repeated attempts', recordIds: [facts.leadId] });
  }

  if (silence > 30) {
    reasons.push({ reason: 'No contact for over 30 days', evidence: `Last interaction ${silence} day(s) ago`, recordIds: facts.lastInteraction ? [facts.lastInteraction.id] : [] });
  }

  if (reasons.length > 0) {
    return { state: 'AT_RISK', reasons, positives, rulesVersion: HEALTH_RULES_VERSION, generatedAt };
  }

  // ATTENTION signals
  if (facts.overdueTasks.length > 0) {
    reasons.push({ reason: 'Overdue follow-up', evidence: `"${facts.overdueTasks[0]?.title ?? 'Follow-up'}" overdue by ${facts.overdueTasks[0]?.overdueDays ?? 0} day(s)`, recordIds: facts.overdueTasks.map((task) => task.id) });
  }

  if (facts.awaitingResponseDays !== null && facts.awaitingResponseDays > 7) {
    reasons.push({ reason: 'Waiting for the partner', evidence: `No reply for ${facts.awaitingResponseDays} day(s)`, recordIds: facts.lastInteraction ? [facts.lastInteraction.id] : [] });
  }

  if (!facts.hasNextAction && !facts.nextFollowUpAt && facts.openTasks.length === 0 && facts.isOpen && facts.status !== 'NEW' && facts.status !== 'DISCOVERED') {
    reasons.push({ reason: 'No next step', evidence: 'No next action, follow-up date or open task', recordIds: [facts.leadId] });
  }

  if (silence > 14) {
    reasons.push({ reason: 'Quiet for over two weeks', evidence: `Last interaction ${silence} day(s) ago`, recordIds: facts.lastInteraction ? [facts.lastInteraction.id] : [] });
  }

  if (facts.recentSentiments[0] === 'POSITIVE') {
    positives.push({ reason: 'Recent positive interaction', evidence: 'Sentiment POSITIVE recorded on the latest interaction', recordIds: facts.lastInteraction ? [facts.lastInteraction.id] : [] });
  }

  if (facts.inboundCount > 0) {
    positives.push({ reason: 'Partner engages', evidence: `${facts.inboundCount} inbound interaction(s)`, recordIds: [] });
  }

  return { state: reasons.length > 0 ? 'ATTENTION' : 'HEALTHY', reasons, positives, rulesVersion: HEALTH_RULES_VERSION, generatedAt };
};
