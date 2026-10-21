import { failure, type AiImageInput, type AiProvider, type AiResult } from 'src/modules/lv-ai/provider/ai-provider';
import { type PromptDefinition } from 'src/modules/lv-ai/prompts/prompt-registry';
import { boundedJson, type GraphqlClient } from 'src/modules/lv-ai/runtime/clients';
import { checkThrottle } from 'src/modules/lv-ai/runtime/throttle';
import { type AiRunStatus } from 'src/modules/lv-ai/objects/ai-run.object';

// Runs one prompt through the provider and records the run — the AI audit
// (§31) and the observability signal (§52) in one place. What is recorded:
// operation, prompt version, provider, model, status, error code, latency,
// token usage, target, actor, source record ids. What is NOT recorded: the
// prompt, the response, keys, or anything from the request that is not an id.

export type RunContext = {
  operation: string;
  actorWorkspaceMemberId: string | null;
  targetObject: string | null;
  targetRecordId: string | null;
  sourceRecordIds: string[];
  metadata?: Record<string, unknown>;
};

export type RecordedRun<T> = { result: AiResult<T>; runId: string | null };

export const recordRun = async (
  application: GraphqlClient,
  context: RunContext,
  details: {
    status: AiRunStatus;
    promptVersion: string;
    provider: string;
    model: string | null;
    errorCode?: string | null;
    latencyMs?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    startedAt: string;
  },
): Promise<string | null> => {
  try {
    const { data, errors } = await application.query<{ createLvAiRun?: { id: string } }>(
      `mutation($data: LvAiRunCreateInput!) { createLvAiRun(data: $data) { id } }`,
      {
        data: {
          name: `${context.operation} · ${details.status}`.slice(0, 120),
          operation: context.operation,
          promptVersion: details.promptVersion,
          provider: details.provider,
          model: details.model,
          status: details.status,
          errorCode: details.errorCode ?? null,
          latencyMs: details.latencyMs ?? null,
          inputTokens: details.inputTokens ?? null,
          outputTokens: details.outputTokens ?? null,
          targetObject: context.targetObject,
          targetRecordId: context.targetRecordId,
          actorId: context.actorWorkspaceMemberId,
          sourceRecordIds: boundedJson(context.sourceRecordIds.slice(0, 200)),
          startedAt: details.startedAt,
          metadata: boundedJson(context.metadata ?? null, 4_000),
        },
      },
    );

    if (errors.length > 0) {
      console.warn('[lv-ai] run audit not written:', errors[0]?.message);
    }

    return data.createLvAiRun?.id ?? null;
  } catch (caught) {
    console.warn('[lv-ai] run audit not written:', caught instanceof Error ? caught.message : String(caught));

    return null;
  }
};

export const runPrompt = async <T>(
  provider: AiProvider,
  application: GraphqlClient,
  prompt: PromptDefinition<T>,
  userMessage: string,
  context: RunContext,
  // Day 8: images for vision prompts (capture extraction). Never logged.
  images: readonly AiImageInput[] = [],
): Promise<RecordedRun<T>> => {
  const startedAt = new Date().toISOString();

  // Before the provider is asked anything: has it just told us, repeatedly,
  // that there is no quota left? The breaker reads that from this very table.
  // A refusal here is recorded like any other run, so the history stays honest
  // about what was attempted and why it stopped.
  const throttle = await checkThrottle(application, { provider: provider.name, actorWorkspaceMemberId: context.actorWorkspaceMemberId });

  if (!throttle.allowed) {
    console.info(`[lv-ai] op=${context.operation} prompt=${prompt.id} provider=${provider.name} status=THROTTLED code=${throttle.code} reason=${throttle.reason}`);

    const blocked = failure(throttle.code, throttle.message, { provider: provider.name, model: provider.model, latencyMs: 0, attempts: 0, retryable: false });
    const throttledRunId = await recordRun(
      application,
      { ...context, metadata: { ...(context.metadata ?? {}), throttled: throttle.reason } },
      { status: 'FAILED', promptVersion: prompt.id, provider: provider.name, model: provider.model, errorCode: throttle.code, latencyMs: 0, startedAt },
    );

    return { result: blocked, runId: throttledRunId };
  }

  const result = await provider.structuredOutput<T>(
    { purpose: prompt.id, system: prompt.system, user: userMessage, maxOutputTokens: prompt.maxOutputTokens, temperature: prompt.temperature, json: true, images: images.length > 0 ? images : undefined },
    prompt.validate,
  );

  const status: AiRunStatus = result.ok ? 'SUCCESS' : result.code === 'AI_UNAVAILABLE' ? 'UNAVAILABLE' : 'FAILED';

  // Observability line: no content, only the shape of what happened.
  console.info(
    `[lv-ai] op=${context.operation} prompt=${prompt.id} provider=${result.provider} model=${result.model ?? '-'} status=${status}${result.ok ? '' : ` code=${result.code}`} latencyMs=${result.latencyMs} attempts=${result.attempts}`,
  );

  const runId = await recordRun(application, context, {
    status,
    promptVersion: prompt.id,
    provider: result.provider,
    model: result.model,
    errorCode: result.ok ? null : result.code,
    latencyMs: result.latencyMs,
    inputTokens: result.ok ? result.usage.inputTokens : null,
    outputTokens: result.ok ? result.usage.outputTokens : null,
    startedAt,
  });

  return { result, runId };
};

// Deterministic engines are recorded too (status SUCCESS, provider "rules"),
// so the audit shows every insight's origin, not only the model calls.
export const recordRulesRun = (application: GraphqlClient, context: RunContext, rulesVersion: string, latencyMs: number): Promise<string | null> =>
  recordRun(application, context, { status: 'SUCCESS', promptVersion: rulesVersion, provider: 'rules', model: null, latencyMs, startedAt: new Date(Date.now() - latencyMs).toISOString() });
