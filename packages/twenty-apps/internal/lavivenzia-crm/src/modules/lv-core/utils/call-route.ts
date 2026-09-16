// Calls one of this application's HTTP-route logic functions from a front
// component, with the signed-in user's delegated token. The server resolves
// the actor from that token (route-event.ts); nothing in the body is identity.

export const callRoute = async (
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const apiBaseUrl = process.env.TWENTY_API_URL;
  const token = process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;

  if (!apiBaseUrl || !token) {
    throw new Error('API configuration missing.');
  }

  const response = await fetch(`${apiBaseUrl}/s${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};

  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(text.slice(0, 200) || 'Request failed.');
  }

  // A refusal is a 200 with ok:false. Treating it as success would show the
  // user a change that never happened.
  if (parsed.ok === false) {
    // Routes attach the platform's own message as `detail` when a write was
    // refused; without it the person only sees "refused" and cannot tell a
    // permission problem from a validation one.
    const detail = typeof parsed.detail === 'string' && parsed.detail.length > 0 ? ` (${parsed.detail})` : '';

    // AI operations refuse with { code, message } (e.g. AI_QUOTA_EXHAUSTED);
    // show the real reason rather than a generic refusal.
    const reason = parsed.error ?? parsed.message ?? 'The server refused that action.';
    const code = typeof parsed.code === 'string' && parsed.code.startsWith('AI_') ? `${parsed.code}: ` : '';

    throw new Error(`${code}${String(reason)}${detail}`);
  }

  if (!response.ok) {
    // Twenty's REST error body is { statusCode, error: <name>, messages: [...] };
    // the name alone ("Error") tells the user nothing, so prefer the message.
    const messages = Array.isArray(parsed.messages) ? parsed.messages.filter((item) => typeof item === 'string') : [];
    const detail = messages[0] ?? (typeof parsed.message === 'string' ? parsed.message : null) ?? parsed.error;

    throw new Error(`${String(detail ?? 'Request failed.')} (HTTP ${response.status})`);
  }

  return parsed;
};
