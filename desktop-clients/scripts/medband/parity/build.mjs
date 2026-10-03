/**
 * Builds the diagnostic MedBand parity page into an output directory (default /tmp/medband-parity):
 *   host.css    the module as the host serves it: reference-medband styles.css + host Tailwind (tokens, reference-host theme, ops-ui)
 *   source.css  the ORIGINAL MedBand stylesheet (its globals.css + utilities of the original src), unscoped, the oracle
 *   bundle.js   the real module mounted over the test transport (diagnostic only, never shipped)
 *   index.html  host page; oracle.html  source page
 * Run with Node 24 from desktop-clients. MEDBAND_REFERENCE_ROOT defaults to the original source `src`.
 */
import {createRequire} from 'node:module';
import {mkdirSync, readFileSync, writeFileSync, cpSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(root, 'package.json'));
const esbuild = require('esbuild'), postcss = require('postcss'), tailwind = require('@tailwindcss/postcss');
export const reference = process.env.MEDBAND_REFERENCE_ROOT ?? '/home/pepadmin/pb/saas/reference/frontend/medband-patient-access-1/medband/src';
export async function build(out = process.env.MEDBAND_PARITY_OUT ?? '/tmp/medband-parity') {
  mkdirSync(out, {recursive: true});
  cpSync(resolve(root,"packages/tokens/src/fonts"),resolve(out,"fonts"),{recursive:true});
  const bundledFonts=readFileSync(resolve(root,"packages/tokens/src/reference-fonts.css"),"utf8");
  await esbuild.build({
    entryPoints: [resolve(import.meta.dirname, 'entry.tsx')], bundle: true, outfile: resolve(out, 'bundle.js'), format: 'iife', platform: 'browser',
    jsx: 'automatic', loader: {'.json': 'json'}, alias: {vitest: resolve(import.meta.dirname, 'shim-vitest.js')}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'error', absWorkingDir: root,
  });
  const medband = resolve(root, 'packages/reference-medband/src');
  const hostInput = `@import "${medband}/styles.css";
@import "tailwindcss";
@import "@pepbits/tokens/tokens.css";
@import "@pepbits/reference-host/styles.css";
@source "${root}/packages/ops-ui/src";
@source "${root}/packages/reference-host/src";
@source "${medband}";
@source not "${medband}/**/*.test.{ts,tsx}";
@source not "${medband}/test-*.{ts,tsx}";
@source not "${medband}/styles.css";`;
  const host = await postcss([tailwind({optimize: false})]).process(hostInput, {from: resolve(root, 'apps/web/src/app/parity.css')});
  writeFileSync(resolve(out, 'host.css'), bundledFonts+'\n'+host.css);
  const design = readFileSync(resolve(root, 'scripts/medband/source-design/globals.css'), 'utf8')
    .replace('@import "tailwindcss";', `@import "tailwindcss/theme.css" layer(theme);\n@import "tailwindcss/preflight.css" layer(base);\n@import "tailwindcss/utilities.css" layer(utilities) source(none);\n@source "${reference}";\n@source not "${reference}/server";\n@source not "${reference}/app/api";`);
  const source = await postcss([tailwind({optimize: false})]).process(design, {from: resolve(root, 'scripts/medband/parity/source.css')});
  writeFileSync(resolve(out, 'source.css'), bundledFonts+'\n'+source.css);
  const page = (css, body) => `<!doctype html><html lang="en" data-theme="nexora"><head><meta charset="utf-8"><link rel="stylesheet" href="${css}"></head>${body}</html>`;
  writeFileSync(resolve(out, 'index.html'), page('host.css', '<body style="--font-ui:Inter,ui-sans-serif,system-ui,sans-serif"><div id="app"></div><script src="bundle.js"></script></body>'));
  writeFileSync(resolve(out, 'oracle.html'), page('source.css', '<body class="bg-canvas text-ink antialiased"><div id="app"></div></body>'));
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) console.log('built', await build());
