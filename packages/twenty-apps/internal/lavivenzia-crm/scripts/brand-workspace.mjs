// Workspace identity for a La Vivenzia CRM workspace.
//
// This is ordinary workspace administration — what a Main Admin would do by
// hand in Settings › General — done through the same GraphQL API so it is
// reproducible on a fresh environment. It touches no schema and no
// application code, and it deletes nothing.
//
//   1. Names the workspace ("La Vivenzia" unless --name is given).
//   2. Uploads the La Vivenzia mark as the workspace logo, so the sidebar
//      header, the sign-in page and the workspace picker stop showing the
//      seeded "Apple" identity.
//
// Twenty's own root sidebar entries (Opportunities, Dashboards, the Workflows
// folder) are NOT touched here. The La Vivenzia application ships its own
// entries for those objects under Relationships / Insights / Administration
// (see src/navigation), so an admin can remove the duplicates from the
// sidebar by hand (right-click › Delete in layout customisation) — see
// docs/CRM-DESIGN-SYSTEM.md.
//
// Usage (from the app directory):
//   LV_ADMIN_EMAIL=… LV_ADMIN_PASSWORD=… node scripts/brand-workspace.mjs [--api http://localhost:3000] [--front http://localhost:3001] [--name "La Vivenzia"]
//
// Credentials are read from the environment only. Nothing is stored.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);

  return index >= 0 ? process.argv[index + 1] : fallback;
};
const API = arg('--api', 'http://localhost:3000');
const FRONT = arg('--front', 'http://localhost:3001');
const WORKSPACE_NAME = arg('--name', 'La Vivenzia');
const email = process.env.LV_ADMIN_EMAIL;
const password = process.env.LV_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Set LV_ADMIN_EMAIL and LV_ADMIN_PASSWORD (a Main Admin).');
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.resolve(here, '../../../../twenty-front/public/images/lv/logo-mark.png');

const post = async (endpoint, body, token) => {
  const response = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: FRONT, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(`${endpoint}: ${json.errors.map((e) => e.message).join('; ')}`);
  }

  return json.data;
};
const meta = (query, token, variables) => post('metadata', { query, variables }, token);

const signIn = async () => {
  const login = await meta(`mutation { getLoginTokenFromCredentials(email: "${email}", password: "${password}", origin: "${FRONT}") { loginToken { token } } }`);
  const tokens = await meta(`mutation { getAuthTokensFromLoginToken(loginToken: "${login.getLoginTokenFromCredentials.loginToken.token}", origin: "${FRONT}") { tokens { accessOrWorkspaceAgnosticToken { token } } } }`);

  return tokens.getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken.token;
};

const uploadLogo = async (token) => {
  const form = new FormData();

  form.append('operations', JSON.stringify({ query: 'mutation($file: Upload!) { uploadWorkspaceLogo(file: $file) { path } }', variables: { file: null } }));
  form.append('map', JSON.stringify({ 0: ['variables.file'] }));
  form.append('0', new Blob([fs.readFileSync(LOGO)], { type: 'image/png' }), 'logo-mark.png');
  const response = await fetch(`${API}/metadata`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: FRONT, 'apollo-require-preflight': 'true' }, body: form });
  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(`uploadWorkspaceLogo: ${json.errors.map((e) => e.message).join('; ')}`);
  }

  return json.data.uploadWorkspaceLogo.path;
};

const run = async () => {
  const token = await signIn();
  const current = await meta('query { currentWorkspace { id displayName logo } }', token);

  console.log(`Workspace: "${current.currentWorkspace.displayName}"`);

  if (current.currentWorkspace.displayName !== WORKSPACE_NAME) {
    await meta(`mutation { updateWorkspace(data: { displayName: "${WORKSPACE_NAME}" }) { displayName } }`, token);
    console.log(`  renamed to "${WORKSPACE_NAME}"`);
  }

  const logoPath = await uploadLogo(token);

  console.log(`  logo set (${logoPath})`);
  console.log('Done.');
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
