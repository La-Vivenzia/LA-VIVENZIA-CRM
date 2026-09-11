import { describe, expect, it } from 'vitest';

import { readRouteInput } from 'src/modules/lv-core/utils/route-event';

const proxyEvent = (body: unknown, userWorkspaceId: string | null = 'uw-1') => ({
  headers: { authorization: 'Bearer x' },
  queryStringParameters: {},
  pathParameters: {},
  body,
  isBase64Encoded: false,
  requestContext: { http: { method: 'POST', path: '/onboarding/x' } },
  userWorkspaceId,
});

describe('readRouteInput', () => {
  it('reads the body of a proxy event, not the event itself', () => {
    const result = readRouteInput<{ onboardingId: string }>(
      proxyEvent({ onboardingId: 'ob-1' }),
    );

    expect(result.input.onboardingId).toBe('ob-1');
    expect(result.isHttpRequest).toBe(true);
  });

  it('parses a body that arrived as a JSON string', () => {
    const result = readRouteInput<{ onboardingId: string }>(
      proxyEvent(JSON.stringify({ onboardingId: 'ob-2' })),
    );

    expect(result.input.onboardingId).toBe('ob-2');
  });

  it('surfaces the platform-authenticated caller', () => {
    expect(readRouteInput(proxyEvent({}, 'uw-42')).userWorkspaceId).toBe('uw-42');
  });

  it('reports no caller when the platform supplied none', () => {
    expect(readRouteInput(proxyEvent({}, null)).userWorkspaceId).toBeNull();
  });

  it('does not confuse the event envelope for input', () => {
    // The regression this helper exists to prevent: reading userWorkspaceId or
    // headers as though they were the caller's payload.
    const result = readRouteInput<Record<string, unknown>>(proxyEvent({}));

    expect(result.input).toEqual({});
    expect(result.input.userWorkspaceId).toBeUndefined();
    expect(result.input.headers).toBeUndefined();
  });

  it('tolerates an unparseable body rather than throwing', () => {
    expect(readRouteInput(proxyEvent('not json at all')).input).toEqual({});
  });

  it.each([null, undefined])('tolerates a %p body', (body) => {
    expect(readRouteInput(proxyEvent(body)).input).toEqual({});
  });

  it('passes a directly-invoked payload straight through', () => {
    // How dev:function:exec and the unit tests call a handler.
    const result = readRouteInput<{ documentId: string }>({
      documentId: 'doc-1',
    });

    expect(result.input.documentId).toBe('doc-1');
    expect(result.isHttpRequest).toBe(false);
    expect(result.userWorkspaceId).toBeNull();
  });
});
