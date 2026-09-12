import { defineLogicFunction, type DatabaseEventPayload, type ObjectRecordCreateEvent } from 'twenty-sdk/define';

import { FN_AI_ON_INTERACTION_CREATED_ID } from 'src/constants/universal-identifiers';
import { isAiConfigured, readAiConfig } from 'src/modules/lv-ai/config/ai-config';
import { createAiProvider } from 'src/modules/lv-ai/provider/create-provider';
import { applicationClient } from 'src/modules/lv-ai/runtime/clients';
import { loadLeadContext } from 'src/modules/lv-intelligence/services/lead-context';
import { computeDeterministicInsights } from 'src/modules/lv-intelligence/services/lead-intelligence';
import { summarizeConversation } from 'src/modules/lv-intelligence/services/model-operations';

// lvInteraction.created → refresh the lead's deterministic insights (free:
// score, health, next best action, data quality) and, when a provider is
// configured AND the interaction carries notes worth reading (≥ 20
// characters), one conversation-summary call. Interactions without notes
// never reach the model. Runs after the Day 3 interaction orchestrator as a
// separate function so that path is untouched and this one can fail alone.

type InteractionRow = { id: string; leadId?: string | null; summary?: string | null };

const MIN_NOTES_LENGTH = 20;

export const handler = async (payload: DatabaseEventPayload<ObjectRecordCreateEvent<InteractionRow>>): Promise<Record<string, unknown>> => {
  const record = payload.properties.after;

  if (!record?.id || !record.leadId) {
    return { skipped: true, reason: 'no lead' };
  }

  try {
    const application = applicationClient();
    const context = await loadLeadContext(application, application, record.leadId);

    if (!context) {
      return { skipped: true, reason: 'lead not found' };
    }

    const actor = payload.workspaceMemberId ?? null;
    const deterministic = await computeDeterministicInsights({ context, delegated: application, application, actorWorkspaceMemberId: actor, includeDuplicates: false });
    const config = readAiConfig();

    if (!isAiConfigured(config)) {
      return { deterministic: deterministic.persisted, model: 'AI_UNAVAILABLE' };
    }

    const interaction = context.interactions.find((row) => row.id === record.id) ?? null;

    if (!interaction || !interaction.summary || interaction.summary.trim().length < MIN_NOTES_LENGTH) {
      return { deterministic: deterministic.persisted, model: 'SKIPPED_NO_NOTES' };
    }

    const result = await summarizeConversation({ provider: createAiProvider(config), application, context, actorWorkspaceMemberId: actor }, interaction);

    return { deterministic: deterministic.persisted, model: result.status, code: result.code };
  } catch (error) {
    console.error('[lv-ai-on-interaction-created]', error instanceof Error ? error.message : String(error));

    return { applied: false, reason: 'error' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_AI_ON_INTERACTION_CREATED_ID,
  name: 'lv-ai-on-interaction-created',
  description: 'Refreshes deterministic lead insights after an interaction and, when AI is configured, summarises the conversation',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvInteraction.created' },
});
