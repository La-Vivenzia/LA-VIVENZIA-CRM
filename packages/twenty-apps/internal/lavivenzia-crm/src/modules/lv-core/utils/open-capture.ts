import { AppPath, navigate } from 'twenty-sdk/front-component';

import { PL_QUICK_ADD_ID } from 'src/constants/universal-identifiers';

// Opens the Capture Lead page from anywhere in the shell (dashboard header,
// Lead 360, lead list). Page layouts are addressed by their per-workspace
// id, so the universal identifier is resolved once through the metadata API
// and remembered for the session.

let resolved: Promise<string | null> | null = null;

const resolveCapturePageId = (): Promise<string | null> => {
  if (resolved) {
    return resolved;
  }

  resolved = (async () => {
    const apiBaseUrl = process.env.TWENTY_API_URL;
    const token = process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;

    if (!apiBaseUrl || !token) {
      return null;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: 'query { getPageLayouts { id universalIdentifier } }' }),
      });
      const payload = (await response.json()) as { data?: { getPageLayouts?: { id: string; universalIdentifier: string | null }[] } };

      return payload.data?.getPageLayouts?.find((layout) => layout.universalIdentifier === PL_QUICK_ADD_ID)?.id ?? null;
    } catch {
      resolved = null;

      return null;
    }
  })();

  return resolved;
};

export const openCapturePage = async (): Promise<boolean> => {
  const pageLayoutId = await resolveCapturePageId();

  if (!pageLayoutId) {
    return false;
  }

  await navigate(AppPath.PageLayoutPage, { pageLayoutId });

  return true;
};
