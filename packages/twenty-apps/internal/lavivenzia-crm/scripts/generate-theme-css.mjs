// Regenerates the `--lv-*` blocks in the host stylesheet from the application
// tokens, so the two can never drift.
//
//   node scripts/generate-theme-css.mjs
//
// `src/modules/lv-core/ui/tokens.ts` is the single source of truth; the host
// stylesheet (packages/twenty-front/src/lv/lv-theme.css) restyles the Twenty
// shell with the same values, and a unit test asserts the blocks match
// verbatim. Before this script existed the blocks were maintained by hand,
// which is why the test exists at all — run this after every token change.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tokensPath = path.join(here, '../src/modules/lv-core/ui/tokens.ts');
const cssPath = path.join(here, '../../../../twenty-front/src/lv/lv-theme.css');

// The token file is TypeScript; rather than compile it, read the one object
// literal we need and resolve the brand references it uses.
const readTokens = () => {
  const src = fs.readFileSync(tokensPath, 'utf8');
  const brandMatch = src.match(/export const BRAND = \{([\s\S]*?)\} as const;/);

  if (!brandMatch) {
    throw new Error('BRAND literal not found in tokens.ts');
  }

  const brand = Object.fromEntries([...brandMatch[1].matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  const start = src.indexOf('export const LV_TOKENS');

  if (start === -1) {
    throw new Error('LV_TOKENS literal not found in tokens.ts');
  }

  const literal = src
    .slice(src.indexOf('=', start) + 1, src.indexOf('\n};', start) + 2)
    .replace(/\/\/[^\n]*/g, '')
    .replace(/BRAND\.(\w+)/g, (_, key) => JSON.stringify(brand[key]))
    .trim()
    .replace(/;$/, '');

  return JSON.parse(literal.replace(/'/g, '"').replace(/,(\s*[}\]])/g, '$1').replace(/([{,]\s*)([\w-]+):/g, '$1"$2":').replace(/""([\w-]+)"":/g, '"$1":'));
};

const declarations = (tokens, scheme, eol) =>
  Object.entries(tokens[scheme])
    .map(([key, value]) => `  --lv-${key}: ${value};`)
    .join(eol);

const tokens = readTokens();
const original = fs.readFileSync(cssPath, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
let css = original;

for (const scheme of ['light', 'dark']) {
  const marker = new RegExp(`(/\\* @lv-tokens ${scheme} \\*/\\r?\\n)[\\s\\S]*?(\\r?\\n/\\* @lv-tokens end \\*/)`);

  if (!marker.test(css)) {
    throw new Error(`@lv-tokens ${scheme} markers not found in ${cssPath}`);
  }

  css = css.replace(marker, `$1${declarations(tokens, scheme, eol)}$2`);
}

if (css === original) {
  console.log('lv-theme.css already up to date');
} else {
  fs.writeFileSync(cssPath, css);
  console.log(`lv-theme.css updated — ${Object.keys(tokens.light).length} tokens per scheme`);
}
