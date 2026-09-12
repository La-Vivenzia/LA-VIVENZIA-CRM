import { type LeadFacts } from 'src/modules/lv-intelligence/engines/lead-facts';
import { PROMPT_VERSIONS } from 'src/modules/lv-ai/prompts/prompt-registry';

// Next Best Action v1 — one primary action per lead, from an ordered rule
// ladder. The first rule whose condition holds wins; the rest that also hold
// become alternatives. Every recommendation names the evidence (record ids)
// and a suggested deadline; confidence is HIGH when the rule is a hard fact
// (an overdue task exists), MEDIUM for a strong pattern (positive reply, no
// task), LOW for a default (nothing else applies, qualify the lead).
//
// The engine never executes anything. Accepting a recommendation creates a
// task through the existing task system, with the accepting person's
// permissions.

export const NBA_RULES_VERSION = PROMPT_VERSIONS.nextBestAction;

export const NBA_ACTIONS = [
  'CONTACT_LEAD',
  'FOLLOW_UP',
  'SCHEDULE_MEETING',
  'REQUEST_DOCUMENT',
  'REVIEW_DOCUMENT',
  'CLARIFY_REQUIREMENT',
  'ESCALATE',
  'WAIT_FOR_RESPONSE',
  'UPDATE_CONTACT_DATA',
  'QUALIFY_LEAD',
  'START_ONBOARDING',
  'NONE',
] as const;

export type NbaAction = (typeof NBA_ACTIONS)[number];

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type Recommendation = {
  action: NbaAction;
  title: string;
  reason: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  targetObject: 'lvLead' | 'task' | 'lvOnboarding' | 'lvSla';
  targetRecordId: string;
  suggestedDeadline: string; // ISO date-time
  deadlineLabel: 'Now' | 'Today' | 'Tomorrow' | 'This week';
  evidence: string[];
  evidenceRecordIds: string[];
  confidence: Confidence;
  // What "Accept" would create.
  proposedTask: { title: string; dueAt: string; priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' } | null;
};

export type NextBestActionResult = { primary: Recommendation | null; alternatives: Recommendation[]; rulesVersion: string; generatedAt: string };

const DAY = 86_400_000;

const deadline = (now: string, label: Recommendation['deadlineLabel']): string => {
  const base = new Date(now);

  if (label === 'Now') {
    return new Date(base.getTime() + 2 * 3_600_000).toISOString();
  }

  const days = label === 'Today' ? 0 : label === 'Tomorrow' ? 1 : 3;
  const at = new Date(base.getTime() + days * DAY);

  at.setUTCHours(12, 30, 0, 0); // 18:00 IST

  return at.toISOString();
};

export const recommendNextBestAction = (facts: LeadFacts): NextBestActionResult => {
  const generatedAt = facts.now;
  const found: Recommendation[] = [];
  const make = (partial: Omit<Recommendation, 'suggestedDeadline' | 'proposedTask'> & { taskTitle?: string | null }): Recommendation => ({
    ...partial,
    suggestedDeadline: deadline(facts.now, partial.deadlineLabel),
    proposedTask: partial.taskTitle ? { title: partial.taskTitle, dueAt: deadline(facts.now, partial.deadlineLabel), priority: partial.priority } : null,
  });

  if (facts.isInactive && facts.status !== 'FOLLOW_UP_LATER') {
    return { primary: null, alternatives: [], rulesVersion: NBA_RULES_VERSION, generatedAt };
  }

  // 1. Breached SLA → escalate / act now
  if (facts.breachedSlas.length > 0) {
    found.push(
      make({
        action: 'ESCALATE',
        title: 'Resolve the breached SLA',
        reason: `${facts.breachedSlas.length} SLA(s) are breached or escalated on this lead; the clock stopped waiting.`,
        priority: 'CRITICAL',
        targetObject: 'lvSla',
        targetRecordId: facts.breachedSlas[0]!.id,
        deadlineLabel: 'Now',
        evidence: facts.breachedSlas.map((sla) => `SLA ${sla.rule ?? ''} is ${sla.status}`),
        evidenceRecordIds: facts.breachedSlas.map((sla) => sla.id),
        confidence: 'HIGH',
        taskTitle: `Resolve breached SLA for ${facts.label}`,
      }),
    );
  }

  // 2. Overdue follow-up task
  if (facts.overdueTasks.length > 0) {
    const task = facts.overdueTasks[0]!;

    found.push(
      make({
        action: 'FOLLOW_UP',
        title: `Complete the overdue follow-up: ${task.title ?? 'follow-up'}`,
        reason: `The follow-up "${task.title ?? 'follow-up'}" is ${task.overdueDays} day(s) overdue.`,
        priority: 'HIGH',
        targetObject: 'task',
        targetRecordId: task.id,
        deadlineLabel: 'Today',
        evidence: [`Task due ${task.dueAt?.slice(0, 10) ?? '—'}, still open`],
        evidenceRecordIds: [task.id],
        confidence: 'HIGH',
        taskTitle: null,
      }),
    );
  }

  // 3. No contact channel
  if (!facts.hasEmail && !facts.hasPhone) {
    found.push(
      make({
        action: 'UPDATE_CONTACT_DATA',
        title: 'Add an email or phone number',
        reason: 'The lead has neither an email nor a phone number, so nobody can reach them.',
        priority: 'HIGH',
        targetObject: 'lvLead',
        targetRecordId: facts.leadId,
        deadlineLabel: 'Today',
        evidence: ['emails.primaryEmail empty', 'phones.primaryPhoneNumber empty'],
        evidenceRecordIds: [facts.leadId],
        confidence: 'HIGH',
        taskTitle: `Find contact details for ${facts.label}`,
      }),
    );
  }

  // 4. Never contacted
  if (facts.interactionCount === 0 && ['NEW', 'ASSIGNED', 'QUALIFYING', 'DISCOVERED'].includes(facts.status)) {
    found.push(
      make({
        action: 'CONTACT_LEAD',
        title: 'Make first contact',
        reason: `The lead is ${facts.status.toLowerCase()} and no interaction has been recorded${facts.ageDays > 0 ? ` in ${facts.ageDays} day(s)` : ''}.`,
        priority: facts.priority === 'CRITICAL' || facts.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
        targetObject: 'lvLead',
        targetRecordId: facts.leadId,
        deadlineLabel: 'Today',
        evidence: ['No interaction on record', `Lead created ${facts.ageDays} day(s) ago`],
        evidenceRecordIds: [facts.leadId],
        confidence: 'HIGH',
        taskTitle: `First contact with ${facts.label}`,
      }),
    );
  }

  // 5. Onboarding: documents
  if (facts.onboarding) {
    const onboarding = facts.onboarding;

    if (onboarding.rejectedDocs > 0 || onboarding.expiredDocs > 0 || (onboarding.status === 'WAITING_FOR_PARTNER' || onboarding.status === 'CHANGES_REQUESTED')) {
      found.push(
        make({
          action: 'REQUEST_DOCUMENT',
          title: 'Ask the partner for the missing or replacement documents',
          reason: `${onboarding.rejectedDocs} rejected / replacement and ${onboarding.expiredDocs} expired document(s); onboarding is ${(onboarding.status ?? '').toLowerCase().replace(/_/g, ' ')}.`,
          priority: 'MEDIUM',
          targetObject: 'lvOnboarding',
          targetRecordId: onboarding.id,
          deadlineLabel: 'Tomorrow',
          evidence: [`Onboarding ${onboarding.status}`, `${onboarding.rejectedDocs} rejected, ${onboarding.expiredDocs} expired`],
          evidenceRecordIds: [onboarding.id],
          confidence: 'MEDIUM',
          taskTitle: `Request documents from ${facts.label}`,
        }),
      );
    }

    if (onboarding.pendingDocs > 0 || onboarding.status === 'INTERNAL_REVIEW') {
      found.push(
        make({
          action: 'REVIEW_DOCUMENT',
          title: 'Review the submitted documents',
          reason: `${onboarding.pendingDocs} document(s) await verification${onboarding.status === 'INTERNAL_REVIEW' ? ' and the onboarding is in internal review' : ''}.`,
          priority: 'MEDIUM',
          targetObject: 'lvOnboarding',
          targetRecordId: onboarding.id,
          deadlineLabel: 'Tomorrow',
          evidence: [`${onboarding.pendingDocs} pending document(s)`],
          evidenceRecordIds: [onboarding.id],
          confidence: 'HIGH',
          taskTitle: `Review documents for ${facts.label}`,
        }),
      );
    }
  }

  // 6. Partner replied, no follow-up planned
  const repliedRecently = facts.daysSinceLastInbound !== null && facts.daysSinceLastInbound <= 3;
  const noPlan = facts.openTasks.length === 0 && !facts.nextFollowUpAt;

  if (repliedRecently && noPlan && facts.lastInteraction?.direction === 'INBOUND') {
    found.push(
      make({
        action: 'FOLLOW_UP',
        title: 'Follow up on the partner’s reply',
        reason: `The partner replied ${facts.daysSinceLastInbound} day(s) ago and no follow-up task or date exists.`,
        priority: 'HIGH',
        targetObject: 'lvLead',
        targetRecordId: facts.leadId,
        deadlineLabel: 'Today',
        evidence: [`Inbound ${facts.lastInteraction.channel ?? ''} interaction ${facts.lastInteraction.occurredAt?.slice(0, 10) ?? ''}`, 'No open task, no next follow-up date'],
        evidenceRecordIds: [facts.lastInteraction.id],
        confidence: 'MEDIUM',
        taskTitle: `Follow up with ${facts.label}`,
      }),
    );
  }

  // 7. Waiting for a response
  if (facts.awaitingResponseDays !== null) {
    if (facts.awaitingResponseDays > 5) {
      found.push(
        make({
          action: 'FOLLOW_UP',
          title: 'Nudge the partner — no reply yet',
          reason: `We have been waiting for a response for ${facts.awaitingResponseDays} day(s).`,
          priority: 'MEDIUM',
          targetObject: 'lvLead',
          targetRecordId: facts.leadId,
          deadlineLabel: 'Today',
          evidence: [`Outcome AWAITING_RESPONSE since ${facts.awaitingResponseSince?.slice(0, 10) ?? ''}`],
          evidenceRecordIds: facts.lastInteraction ? [facts.lastInteraction.id] : [],
          confidence: 'MEDIUM',
          taskTitle: `Gentle reminder to ${facts.label}`,
        }),
      );
    } else {
      found.push(
        make({
          action: 'WAIT_FOR_RESPONSE',
          title: 'Wait for the partner’s response',
          reason: `The last interaction is awaiting the partner's reply (${facts.awaitingResponseDays} day(s) ago); give it a few more days.`,
          priority: 'LOW',
          targetObject: 'lvLead',
          targetRecordId: facts.leadId,
          deadlineLabel: 'This week',
          evidence: [`Outcome AWAITING_RESPONSE since ${facts.awaitingResponseSince?.slice(0, 10) ?? ''}`],
          evidenceRecordIds: facts.lastInteraction ? [facts.lastInteraction.id] : [],
          confidence: 'MEDIUM',
          taskTitle: `Check for a reply from ${facts.label}`,
        }),
      );
    }
  }

  // 8. Interested / negotiating without a meeting or next step
  if ((facts.status === 'INTERESTED' || facts.status === 'NEGOTIATION') && noPlan) {
    found.push(
      make({
        action: 'SCHEDULE_MEETING',
        title: 'Schedule the next conversation',
        reason: `The lead is ${facts.status.toLowerCase()} but nothing is scheduled next.`,
        priority: 'HIGH',
        targetObject: 'lvLead',
        targetRecordId: facts.leadId,
        deadlineLabel: 'Tomorrow',
        evidence: [`Status ${facts.status}`, 'No open task, no next follow-up date'],
        evidenceRecordIds: [facts.leadId],
        confidence: 'MEDIUM',
        taskTitle: `Schedule a meeting with ${facts.label}`,
      }),
    );
  }

  // 9. Approved / verified with no onboarding record
  if ((facts.status === 'APPROVED' || facts.status === 'VERIFICATION' || facts.status === 'NEGOTIATION') && !facts.onboarding && facts.status !== 'NEGOTIATION') {
    found.push(
      make({
        action: 'START_ONBOARDING',
        title: 'Start the partner onboarding',
        reason: `The lead is ${facts.status.toLowerCase()} and has no onboarding record yet.`,
        priority: 'MEDIUM',
        targetObject: 'lvLead',
        targetRecordId: facts.leadId,
        deadlineLabel: 'This week',
        evidence: [`Status ${facts.status}`, 'No onboarding linked'],
        evidenceRecordIds: [facts.leadId],
        confidence: 'MEDIUM',
        taskTitle: `Start onboarding for ${facts.label}`,
      }),
    );
  }

  // 10. Stuck: contacted/engaged with silence and no plan
  if (facts.isOpen && facts.interactionCount > 0 && (facts.daysSinceLastInteraction ?? 0) > 14 && noPlan && found.length === 0) {
    found.push(
      make({
        action: 'FOLLOW_UP',
        title: 'Re-engage — the conversation has gone quiet',
        reason: `${facts.daysSinceLastInteraction} day(s) since the last interaction and nothing is planned.`,
        priority: 'MEDIUM',
        targetObject: 'lvLead',
        targetRecordId: facts.leadId,
        deadlineLabel: 'This week',
        evidence: [`Last interaction ${facts.daysSinceLastInteraction} day(s) ago`],
        evidenceRecordIds: facts.lastInteraction ? [facts.lastInteraction.id] : [],
        confidence: 'MEDIUM',
        taskTitle: `Re-engage ${facts.label}`,
      }),
    );
  }

  // 11. Missing qualification data
  if (found.length === 0 && facts.isOpen && (!facts.hasCategory || !facts.hasLocation || (facts.dataCompleteness !== null && facts.dataCompleteness < 60))) {
    found.push(
      make({
        action: 'QUALIFY_LEAD',
        title: 'Complete the qualification',
        reason: `Qualification is incomplete${facts.dataCompleteness !== null ? ` (${facts.dataCompleteness}%)` : ''}: ${[!facts.hasCategory ? 'category' : null, !facts.hasLocation ? 'location' : null].filter(Boolean).join(', ') || 'key fields'} missing.`,
        priority: 'LOW',
        targetObject: 'lvLead',
        targetRecordId: facts.leadId,
        deadlineLabel: 'This week',
        evidence: [`dataCompleteness ${facts.dataCompleteness ?? 'unknown'}`],
        evidenceRecordIds: [facts.leadId],
        confidence: 'LOW',
        taskTitle: `Qualify ${facts.label}`,
      }),
    );
  }

  // 12. Engaged but requirement unclear (no next action text and status early)
  if (found.length === 0 && facts.isOpen && !facts.hasNextAction && facts.interactionCount > 0 && ['CONTACTED', 'ENGAGED'].includes(facts.status)) {
    found.push(
      make({
        action: 'CLARIFY_REQUIREMENT',
        title: 'Clarify what the partner wants',
        reason: 'There have been conversations but no next action is recorded; the requirement is not yet clear in the CRM.',
        priority: 'LOW',
        targetObject: 'lvLead',
        targetRecordId: facts.leadId,
        deadlineLabel: 'This week',
        evidence: ['nextAction empty', `${facts.interactionCount} interaction(s)`],
        evidenceRecordIds: [facts.leadId],
        confidence: 'LOW',
        taskTitle: `Clarify requirement with ${facts.label}`,
      }),
    );
  }

  const [primary = null, ...alternatives] = found;

  return { primary, alternatives: alternatives.slice(0, 3), rulesVersion: NBA_RULES_VERSION, generatedAt };
};
