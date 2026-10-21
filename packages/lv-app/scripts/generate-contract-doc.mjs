import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Regenerates the responsive-contract table inside docs/LV-DESIGN-SYSTEM.md
// from src/design/responsive.ts, so the document and the code cannot drift.
//
//   node packages/lv-app/scripts/generate-contract-doc.mjs
//
// The document owns everything outside the two markers; this script owns what
// is between them.

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const doc = resolve(repo, 'docs/LV-DESIGN-SYSTEM.md');

const { LV_RESPONSIVE_CONTRACT, LV_TIERS } = await import(
  `data:text/javascript;base64,${Buffer.from(
    (await import('esbuild')).buildSync({
      entryPoints: [resolve(here, '../src/design/responsive.ts')],
      bundle: true,
      format: 'esm',
      write: false,
      // responsive.ts imports tokens.ts through the `src` alias.
      alias: { src: resolve(here, '../src') },
    }).outputFiles[0].text,
  ).toString('base64')}`
);

const START = '<!-- generated:contract -->';
const END = '<!-- /generated:contract -->';

const cell = (value) => String(value ?? '—').replace(/\|/g, '\\|');

const section = (entry) =>
  [
    `### ${entry.family}`,
    '',
    `*${entry.purpose}*`,
    '',
    `Implemented by \`${entry.exports.join('`, `')}\`.`,
    '',
    '| Width | Behaviour |',
    '|---|---|',
    `| ${LV_TIERS.desktop.label} | ${cell(entry.desktop)} |`,
    `| ${LV_TIERS.tablet.label} | ${cell(entry.tablet)} |`,
    `| ${LV_TIERS.mobile.label} | ${cell(entry.mobile)} |`,
    '',
    `- **Interaction change:** ${cell(entry.interaction ?? 'None — the same interaction at every width.')}`,
    `- **Stacking:** ${cell(entry.stacking)}`,
    `- **Overflow:** ${cell(entry.overflow)}`,
    `- **Touch target:** ${entry.touchTarget ? `${entry.touchTarget}px minimum` : 'Not interactive'}`,
    `- **Bottom sheet on a phone:** ${entry.bottomSheet ? 'Yes' : 'No'}`,
    '',
  ].join('\n');

const summary = [
  '| Family | Kind | Phone behaviour in one line | Touch |',
  '|---|---|---|---|',
  ...LV_RESPONSIVE_CONTRACT.map(
    (entry) =>
      `| [${entry.family}](#${entry.family}) | ${entry.kind} | ${cell(entry.mobile.split('. ')[0])} | ${entry.touchTarget ? `${entry.touchTarget}px` : '—'} |`,
  ),
  '',
].join('\n');

const body = [
  '',
  `*Generated from \`packages/lv-app/src/design/responsive.ts\` — ${LV_RESPONSIVE_CONTRACT.length} families. Edit that file, then re-run \`node packages/lv-app/scripts/generate-contract-doc.mjs\`.*`,
  '',
  summary,
  ...LV_RESPONSIVE_CONTRACT.map(section),
].join('\n');

const current = readFileSync(doc, 'utf8');
const before = current.slice(0, current.indexOf(START) + START.length);
const after = current.slice(current.indexOf(END));

if (!current.includes(START) || !current.includes(END)) {
  throw new Error(`${doc} is missing the ${START} / ${END} markers.`);
}

writeFileSync(doc, `${before}\n${body}${after}`, 'utf8');
process.stdout.write(`Wrote ${LV_RESPONSIVE_CONTRACT.length} families into docs/LV-DESIGN-SYSTEM.md\n`);
