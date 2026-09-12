import { defineLogicFunction, type DatabaseEventPayload, type ObjectRecordCreateEvent } from 'twenty-sdk/define';

import { FN_AI_ON_LEAD_CREATED_ID } from 'src/constants/universal-identifiers';
import { isAiConfigured, readAiConfig } from 'src/modules/lv-ai/config/ai-config';
import { createAiProvider } from 'src/modules/lv-ai/provider/create-provider';
import { applicationClient } from 'src/modules/lv-ai/runtime/clients';
import { loadLeadContext } from 'src/modules/lv-intelligence/services/lead-context';
import { generateClassification } from 'src/modules/lv-intelligence/services/model-operations';

// lvLead.created → one classification suggestion, only when a provider is
// configured and the lead has no category yet. This is the single automatic
// model call per lead; it never blocks or fails the creation (it runs as a
// separate function), and with no provider it exits before touching anything.

type LeadRow = { id: string; category?: string | null };

export const handler = async (payload: DatabaseEventPayload<ObjectRecordCreateEvent<LeadRow>>): Promise<Record<string, unknown>> => {
  const record = payload.properties.after;

  if (!record?.id) {
    return { skipped: true, reason: 'no record' };
  }

  const config = readAiConfig();

  if (!isAiConfigured(config)) {
    return { skipped: true, reason: 'AI_UNAVAILABLE' };
  }

  if (record.category) {
    return { skipped: true, reason: 'already categorised' };
  }

  try {
    const application = applicationClient();
    const context = await loadLeadContext(application, application, record.id);

    if (!context) {
      return { skipped: true, reason: 'lead not found' };
    }

    const result = await generateClassification({ provider: createAiProvider(config), application, context, actorWorkspaceMemberId: payload.workspaceMemberId ?? null });

    return { applied: result.ok, status: result.status, code: result.code };
  } catch (error) {
    console.error('[lv-ai-on-lead-created]', error instanceof Error ? error.message : String(error));

    return { applied: false, reason: 'error' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_AI_ON_LEAD_CREATED_ID,
  name: 'lv-ai-on-lead-created',
  description: 'Suggests a category for a new lead (AI, when configured); never changes the lead itself',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvLead.created' },
});
