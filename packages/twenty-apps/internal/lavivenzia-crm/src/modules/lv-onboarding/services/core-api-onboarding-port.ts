import { type CoreApiClient } from 'twenty-client-sdk/core';

import {
  type OnboardingPort,
  type OnboardingRecord,
} from 'src/modules/lv-onboarding/services/onboarding-orchestrator';
import { type DocumentVerificationState } from 'src/modules/lv-onboarding/utils/onboarding-progress';
import { isOnboardingStatus } from 'src/modules/lv-onboarding/constants/onboarding-status';

// CoreApiClient implementation of the onboarding port. All workspace I/O for
// the onboarding review path lives here so the orchestrator stays pure.

export const createCoreApiOnboardingPort = (
  client: CoreApiClient,
): OnboardingPort => ({
  getOnboarding: async (id: string): Promise<OnboardingRecord | null> => {
    const result = await client.query({
      lvOnboarding: {
        __args: { filter: { id: { eq: id } } },
        id: true,
        leadId: true,
        status: true,
        answers: true,
        auditTrail: true,
        reviewerId: true,
      },
    });

    const row = (
      result as {
        lvOnboarding?: {
          id?: string;
          leadId?: string | null;
          status?: string | null;
          answers?: unknown;
          auditTrail?: unknown;
          reviewerId?: string | null;
        };
      }
    ).lvOnboarding;

    if (!row?.id) {
      return null;
    }

    return {
      id: row.id,
      leadId: row.leadId ?? null,
      // An unrecognised status is treated as the safest starting point rather
      // than crashing a reviewer's action.
      status:
        typeof row.status === 'string' && isOnboardingStatus(row.status)
          ? row.status
          : 'NOT_STARTED',
      answers: (row.answers as OnboardingRecord['answers']) ?? {},
      auditTrail: Array.isArray(row.auditTrail)
        ? (row.auditTrail as OnboardingRecord['auditTrail'])
        : [],
      reviewerWorkspaceMemberId: row.reviewerId ?? null,
    };
  },

  getDocumentStates: async (onboardingId: string) => {
    const result = await client.query({
      lvOnboardingDocuments: {
        __args: { first: 100, filter: { onboardingId: { eq: onboardingId } } },
        edges: { node: { id: true, documentType: true, verificationState: true } },
      },
    });

    const edges = (
      result as {
        lvOnboardingDocuments?: {
          edges?: { node?: { id?: string; documentType?: string; verificationState?: string } }[];
        };
      }
    ).lvOnboardingDocuments?.edges;

    const states: Record<string, DocumentVerificationState> = {};

    for (const edge of edges ?? []) {
      const node = edge?.node;

      if (!node?.id) {
        continue;
      }

      // Keyed by document id, not type: a partner may upload two of the same
      // type, and every one of them must be verified before approval.
      states[node.id] =
        (node.verificationState as DocumentVerificationState) ?? 'PENDING';
    }

    return states;
  },

  applyPatch: async ({ id, patch }) => {
    await client.mutation({
      updateLvOnboarding: {
        __args: { id, data: patch },
        id: true,
      },
    });
  },

  syncLeadOnboardingStatus: async ({ leadId, status }) => {
    await client.mutation({
      updateLvLead: {
        __args: { id: leadId, data: { onboardingStatus: status } },
        id: true,
      },
    });
  },
});
