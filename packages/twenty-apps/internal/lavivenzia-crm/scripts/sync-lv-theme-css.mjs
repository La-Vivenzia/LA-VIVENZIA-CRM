// Writes the generated `--lv-*` blocks from src/modules/lv-core/ui/tokens.ts
// into packages/twenty-front/src/lv/lv-theme.css, between the
// `/* @lv-tokens <scheme> */` … `/* @lv-tokens end */` markers.
//
//   node scripts/sync-lv-theme-css.mjs          # write
//   node scripts/sync-lv-theme-css.mjs --check  # exit 1 if out of date
//
// tokens.ts is plain TypeScript with only type annotations, so it is
// transpiled here by stripping the types rather than pulling in a compiler.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tokensPath = path.resolve(here, '../src/modules/lv-core/ui/tokens.ts');
const cssPath = path.resolve(here, '../../../../twenty-front/src/lv/lv-theme.css');

const source = fs.readFileSync(tokensPath, 'utf8');
const js = source
  .replace(/^import.*$/gm, '')
  .replace(/^export type[\s\S]*?^};?\s*$/gm, '')
  .replace(/: Record<[^=]*=/g, ' =')
  .replace(/ as const/g, '')
  .replace(/: LvTypeStyle\b/g, '')
  .replace(/\(scheme: ColorScheme\): string/g, '(scheme)')
  .replace(/\(token: keyof LvTokenSet\): string/g, '(token)')
  .replace(/\(Object\.keys\(LV_TOKENS\[scheme\]\) as \(keyof LvTokenSet\)\[\]\)/, 'Object.keys(LV_TOKENS[scheme])');
const tmp = path.join(here, '.tokens-eval.tmp.mjs');
fs.writeFileSync(tmp, js);
let lvCssDeclarations;
try {
  ({ lvCssDeclarations } = await import(pathToFileURL(tmp).href));
} finally {
  fs.unlinkSync(tmp);
}

let css = fs.readFileSync(cssPath, 'utf8');
const before = css;
for (const scheme of ['light', 'dark']) {
  const re = new RegExp(`(/\\* @lv-tokens ${scheme} \\*/\\r?\\n)[\\s\\S]*?(/\\* @lv-tokens end \\*/)`);
  if (!re.test(css)) throw new Error(`marker for ${scheme} not found in ${cssPath}`);
  css = css.replace(re, `$1${lvCssDeclarations(scheme)}\n$2`);
}
if (process.argv.includes('--check')) {
  if (css !== before) { console.error('lv-theme.css is out of date; run node scripts/sync-lv-theme-css.mjs'); process.exit(1); }
  console.log('lv-theme.css is in sync');
} else {
  fs.writeFileSync(cssPath, css);
  console.log('lv-theme.css updated');
}
