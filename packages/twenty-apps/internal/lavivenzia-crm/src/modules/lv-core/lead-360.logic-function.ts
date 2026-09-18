import 'src/modules/lv-core/runtime/resilient-fetch';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_LEAD_360_ID } from 'src/constants/universal-identifiers';
import {
  type AssignmentHistoryRow,
  type AuditRow,
  type InsightDecisionRow,
  LEAD_360_LIMITS,
  type MemberSummary,
  composeLead360,
} from 'src/modules/lv-core/services/lead-360';
import { loadEcosystemForLead } from 'src/modules/lv-core/services/lead-ecosystem';
import { resolveCaller } from 'src/modules/lv-dashboard/services/caller-context';
import { assessDataQuality } from 'src/modules/lv-intelligence/engines/data-quality';
import { deriveLeadFacts } from 'src/modules/lv-intelligence/engines/lead-facts';
import { recommendNextBestAction } from 'src/modules/lv-intelligence/engines/next-best-action';
import { scoreOpportunity } from 'src/modules/lv-intelligence/engines/opportunity-score';
import { assessRelationshipHealth } from 'src/modules/lv-intelligence/engines/relationship-health';
import { beginLeadRoute, internalError, isRefusal } from 'src/modules/lv-intelligence/services/route-support';
import { stepProgress } from 'src/modules/lv-onboarding/utils/onboarding-progress';
import { type OnboardingData } from 'src/modules/lv-onboarding/utils/validate-onboarding';

// POST /leads/360 { leadId }
//
// One request builds the whole Lead 360 page. The records come from
// loadLeadContext under the CALLER's token (CM-004 and object permissions
// already applied — a lead the caller cannot open is NOT_FOUND here too), the
// deterministic Day 6 engines run on them without persisting anything, and
// the caller's own permissions decide which actions the page may offer. The
// page therefore never has to compose data or infer permissions itself, and
// there is no second scoring rule anywhere.

type Input = { leadId?: unknown };

type MemberRow = { id: string; name?: { firstName?: string | null; lastName?: string | null } | null; userEmail?: string | null };

const toMember = (row: MemberRow): MemberSummary => {
  const displayName = [row.name?.firstName, row.name?.lastName].filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ');

  return { id: row.id, displayName: displayName.length > 0 ? displayName : null, email: row.userEmail ?? null };
};

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const session = await beginLeadRoute<Input>(event);

  if (isRefusal(session)) {
    return session;
  }

  try {
    const now = new Date().toISOString();
    const { context, delegated, application } = session;
    const leadId = context.lead.id;
    const caller = await resolveCaller(delegated);

    if (caller.workspaceMemberId === null) {
      return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Lead 360 is for signed-in team members.' };
    }

    // Everything the caller may read, in one round trip: the team (for owner,
    // assignee and actor names), the assignment history and the governance
    // audit of this lead. Team roles read all three; CM-004 does not scope
    // them, so nothing here leaks another lead's rows.
    const { data } = await delegated.query<{
      workspaceMembers?: { edges: { node: MemberRow }[] };
      lvAssignmentHistories?: { edges: { node: AssignmentHistoryRow }[] };
      lvAuditEvents?: { edges: { node: AuditRow }[] };
    }>(
      `query($history: LvAssignmentHistoryFilterInput!, $audit: LvAuditEventFilterInput!) {
        workspaceMembers(first: ${LEAD_360_LIMITS.members}) { edges { node { id name { firstName lastName } userEmail } } }
        lvAssignmentHistories(first: 10, filter: $history, orderBy: [{ assignedAt: DescNullsLast }]) { edges { node { id assignedAt fromOwnerId toOwnerId strategy reason } } }
        lvAuditEvents(first: 20, filter: $audit, orderBy: [{ at: DescNullsLast }]) { edges { node { id action outcome at actorId reason targetObject targetRecordId metadata } } }
      }`,
      { history: { leadId: { eq: leadId } }, audit: { targetRecordId: { eq: leadId } } },
    );

    const members = (data.workspaceMembers?.edges ?? []).map((edge) => toMember(edge.node));
    const memberById = new Map(members.map((member) => [member.id, member]));

    // Insight rows are private to the AI layer (no team role reads them), so
    // the human decisions are read with the application role — only for the
    // lead the caller has just proven they can open.
    let insightDecisions: InsightDecisionRow[] = [];

    try {
      const { data: insightData } = await application.query<{ lvAiInsights?: { edges: { node: InsightDecisionRow }[] } }>(
        `query($filter: LvAiInsightFilterInput) { lvAiInsights(first: 10, filter: $filter, orderBy: [{ reviewedAt: DescNullsLast }]) { edges { node { id insightType status humanDecision decidedAt: reviewedAt decidedById: reviewerId } } } }`,
        { filter: { leadId: { eq: leadId }, reviewedAt: { is: 'NOT_NULL' } } },
      );

      insightDecisions = (insightData.lvAiInsights?.edges ?? []).map((edge) => edge.node);
    } catch {
      insightDecisions = [];
    }

    const facts = deriveLeadFacts(context, now);
    const onboardingProgress = context.onboarding ? stepProgress((context.onboarding.answers ?? {}) as OnboardingData) : [];
    const ecosystem = await loadEcosystemForLead(delegated, leadId, now);

    return composeLead360({
      ecosystem,
      context,
      caller: { ...caller, workspaceMemberId: caller.workspaceMemberId },
      now,
      memberById,
      members,
      assignmentHistory: (data.lvAssignmentHistories?.edges ?? []).map((edge) => edge.node),
      auditRows: (data.lvAuditEvents?.edges ?? []).map((edge) => edge.node),
      insightDecisions,
      onboardingProgress,
      intelligence: {
        opportunity: scoreOpportunity(facts),
        health: assessRelationshipHealth(facts),
        nextBestAction: recommendNextBestAction(facts),
        dataQuality: assessDataQuality(context, facts),
      },
    });
  } catch (error) {
    return internalError('lv-lead-360', error);
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_LEAD_360_ID,
  name: 'lv-lead-360',
  description: 'Composes the Lead 360 page for one lead under the caller’s permissions: header, capabilities, next action, timeline, onboarding, documents, SLAs and rules-based intelligence',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: { path: '/leads/360', httpMethod: 'POST', isAuthRequired: true },
});
