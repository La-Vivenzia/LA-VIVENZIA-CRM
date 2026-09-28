// Renders an LV screen to a standalone HTML file for pixel review against the
// approved reference boards.
//
//   node scripts/preview.mjs            # all screens
//   node scripts/preview.mjs home       # one screen
//
// Why this exists: the surfaces style themselves with inline styles and one
// injected stylesheet, so a static render is pixel-identical to what Twenty's
// sandboxed renderer shows. That turns "does this match the board?" into a
// five-second loop instead of a build-and-apply cycle.
//
// Output: .notes/preview/<screen>.html (gitignored).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

// esbuild rather than a TS loader: the surfaces are .tsx, and this is the same
// transform the real build uses, so what the preview shows is what ships.
const bundle = await esbuild.build({
  stdin: {
    contents: `
      export { themeFor } from 'src/modules/lv-core/ui/theme';
      export { LvStyles } from 'src/modules/lv-core/ui/kit';
      export * as screens from 'src/modules/lv-core/ui/__preview__/screens';
    `,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  alias: { src: path.join(root, 'src') },
  logLevel: 'error',
});

const outDir = path.join(root, '.notes/preview');

fs.mkdirSync(outDir, { recursive: true });

// Written inside the package rather than imported as a data: URL so that the
// externalised `react` / `react-dom` resolve from the workspace.
const bundlePath = path.join(outDir, '_bundle.mjs');

fs.writeFileSync(bundlePath, bundle.outputFiles[0].text);

const { themeFor, LvStyles, screens } = await import(pathToFileURL(bundlePath).href);

const theme = themeFor('light');

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — La Vivenzia preview</title>
<link rel="preconnect" href="http://localhost:3101">
<style>
  @font-face { font-family: 'Sora'; src: url('http://localhost:3101/fonts/lv/sora-latin.woff2') format('woff2'); font-weight: 400 600; font-display: swap; }
  @font-face { font-family: 'Cinzel'; src: url('http://localhost:3101/fonts/lv/cinzel-latin.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
  html, body { margin: 0; padding: 0; }
</style>
</head><body>${body}</body></html>`;

const only = process.argv[2];
let written = 0;

for (const [name, render] of Object.entries(screens)) {
  if (only && name !== only) {
    continue;
  }

  const markup = renderToStaticMarkup(createElement('div', null, createElement(LvStyles, { theme }), render(theme)));

  fs.writeFileSync(path.join(outDir, `${name}.html`), page(name, markup));
  console.log('preview:', path.join('.notes/preview', `${name}.html`));
  written += 1;
}

if (written === 0) {
  console.error(`no screen named "${only}". Available: ${Object.keys(screens).join(', ')}`);
  process.exit(1);
}
