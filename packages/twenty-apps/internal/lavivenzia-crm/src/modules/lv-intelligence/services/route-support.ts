import { describeAiAvailability, readAiConfig } from 'src/modules/lv-ai/config/ai-config';
import { createAiProvider } from 'src/modules/lv-ai/provider/create-provider';
import { type AiProvider } from 'src/modules/lv-ai/provider/ai-provider';
import { applicationClient, delegatedClient } from 'src/modules/lv-ai/runtime/clients';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { type LeadContext, loadLeadContext } from 'src/modules/lv-intelligence/services/lead-context';
import { type DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';

// Shared preamble for the AI routes: authenticate (session only — an API key
// has no person behind it), load the lead under the caller's token (CM-004
// decides whether it exists for them), and hand back both clients and the
// provider. A refusal is a plain object the route returns as-is.

export type Refusal = { ok: false; refusal: 'NOT_AUTHENTICATED' | 'NOT_FOUND' | 'INVALID_INPUT' | 'NOT_AUTHORIZED'; error: string };

export type LeadRouteSession<T> = {
  input: T;
  actorWorkspaceMemberId: string;
  delegated: DelegatedGraphqlClient;
  application: DelegatedGraphqlClient;
  provider: AiProvider;
  availability: ReturnType<typeof describeAiAvailability>;
  context: LeadContext;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

export const beginLeadRoute = async <T extends { leadId?: unknown }>(event: unknown): Promise<LeadRouteSession<T> | Refusal> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<T>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'AI features are for signed-in team members.' };
  }

  if (!isUuid(input.leadId)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'leadId must be a UUID.' };
  }

  const delegated = delegatedClient();
  const application = applicationClient();
  const context = await loadLeadContext(delegated, application, input.leadId);

  if (!context) {
    return { ok: false, refusal: 'NOT_FOUND', error: 'Lead not found or not accessible.' };
  }

  const config = readAiConfig();

  return {
    input,
    actorWorkspaceMemberId,
    delegated,
    application,
    provider: createAiProvider(config),
    availability: describeAiAvailability(config),
    context,
  };
};

export const isRefusal = (value: unknown): value is Refusal => typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === false;

export const internalError = (scope: string, error: unknown): { ok: false; error: string } => {
  console.error(`[${scope}]`, error instanceof Error ? error.message : String(error));

  return { ok: false, error: 'The request could not be completed. Please try again.' };
};
