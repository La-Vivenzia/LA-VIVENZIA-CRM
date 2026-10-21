import 'src/modules/lv-core/runtime/resilient-fetch';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_AI_DIAGNOSTICS_ID } from 'src/constants/universal-identifiers';
import { readAiConfig } from 'src/modules/lv-ai/config/ai-config';
import { configurationError, describeAiDiagnostics, PROBE_EXPLANATION, probeOutcomeFor } from 'src/modules/lv-ai/config/ai-diagnostics';
import { createAiProvider } from 'src/modules/lv-ai/provider/create-provider';
import { checkThrottle } from 'src/modules/lv-ai/runtime/throttle';
import { resolveCaller } from 'src/modules/lv-dashboard/services/caller-context';
import { DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';
import { describeError } from 'src/modules/lv-core/utils/describe-error';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';

// POST /ai/diagnostics { probe?: boolean }
//
// The administrator's answer to "is the AI configured, and does it work?".
//
// Administrator-only, and authenticated like every other LV route — the same
// WORKSPACE settings permission the Control Tower uses. It is not a public
// health endpoint: it would otherwise let anyone who can reach the server
// spend the workspace's model quota a request at a time.
//
// Without `probe` it reads configuration only and makes no network call, so it
// is free and safe to call at any time. With `probe: true` it sends one
// deliberately tiny request to the provider and classifies the answer, which
// is the only way to tell a missing key from a rejected key from an exhausted
// quota. The probe goes through the same throttle as every other model call,
// so diagnosing a problem cannot become the thing that causes one.
//
// Nothing here returns the key, a prefix of it, an authorization header or a
// request payload. The key is identified by a one-way fingerprint so two keys
// can be told apart without either being revealed.

type Input = { probe?: unknown };

const PROBE_PROMPT = 'Reply with the single word: ok';

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'AI diagnostics are for signed-in administrators.' };
  }

  const delegated = new DelegatedGraphqlClient();

  try {
    const caller = await resolveCaller(delegated);

    if (!caller.isAdmin) {
      return { ok: false, refusal: 'NOT_PERMITTED', error: 'AI diagnostics are administrator-only.' };
    }

    const config = readAiConfig();
    const diagnostics = describeAiDiagnostics(config);
    const configError = configurationError(config);

    if (input.probe !== true) {
      return { ok: true, diagnostics, configurationError: configError, probe: null };
    }

    if (!diagnostics.ready) {
      // Nothing to ask: say which part is missing rather than making a request
      // that is certain to fail.
      return {
        ok: true,
        diagnostics,
        configurationError: configError,
        probe: { outcome: 'CONFIGURATION_MISSING', explanation: PROBE_EXPLANATION.CONFIGURATION_MISSING, latencyMs: 0, attempts: 0, called: false },
      };
    }

    const provider = createAiProvider(config);
    const throttle = await checkThrottle(delegated, { provider: provider.name, actorWorkspaceMemberId });

    if (!throttle.allowed) {
      return {
        ok: true,
        diagnostics,
        configurationError: configError,
        probe: {
          outcome: 'THROTTLED_LOCALLY',
          explanation: `${PROBE_EXPLANATION.THROTTLED_LOCALLY} ${throttle.message}`,
          reason: throttle.reason,
          latencyMs: 0,
          attempts: 0,
          called: false,
        },
      };
    }

    const started = Date.now();
    // The smallest request the contract allows: a handful of tokens out, so a
    // probe costs as close to nothing as a real call can.
    const result = await provider.structuredOutput<{ reply: string }>(
      { purpose: 'ai-diagnostics-probe', system: 'You are a connectivity probe. Answer only with the JSON object {"reply":"ok"}.', user: PROBE_PROMPT, maxOutputTokens: 64, temperature: 0, json: true },
      (value: unknown) => {
        const reply = (value as { reply?: unknown } | null)?.reply;

        return typeof reply === 'string' ? { ok: true as const, value: { reply } } : { ok: false as const, error: 'The probe response had no reply field.' };
      },
    );

    const outcome = probeOutcomeFor(result.ok ? null : result.code, result.ok);

    return {
      ok: true,
      diagnostics,
      configurationError: configError,
      probe: {
        outcome,
        explanation: PROBE_EXPLANATION[outcome],
        // The provider's own sentence is useful and is already redacted of any
        // credential by `http-provider`.
        providerMessage: result.ok ? null : result.message,
        code: result.ok ? null : result.code,
        latencyMs: result.ok ? result.latencyMs : Date.now() - started,
        attempts: result.attempts,
        called: true,
      },
    };
  } catch (error) {
    console.error('[lv-ai] diagnostics failed:', describeError(error));

    return { ok: false, error: 'The AI diagnostics could not be read.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_AI_DIAGNOSTICS_ID,
  name: 'lv-ai-diagnostics',
  description: "Administrator-only AI configuration read-out, and an optional one-request provider probe that tells a missing key from a rejected key from an exhausted quota. Never returns the key.",
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: { path: '/ai/diagnostics', httpMethod: 'POST', isAuthRequired: true },
});
