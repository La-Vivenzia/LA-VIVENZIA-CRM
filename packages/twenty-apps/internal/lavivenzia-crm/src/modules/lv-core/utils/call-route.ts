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
    throw new Error(String(parsed.error ?? 'The server refused that action.'));
  }

  if (!response.ok) {
    throw new Error(String(parsed.error ?? 'Request failed.'));
  }

  return parsed;
};
