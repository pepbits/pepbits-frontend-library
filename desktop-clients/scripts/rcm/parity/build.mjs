/**
 * Builds the RCM parity page into an output directory (default /tmp/rcm-parity):
 *   host.css    the module as the host serves it: reference-rcm styles.css + host Tailwind 4 (tokens, reference-host theme, ops-ui, the
 *               global `.library-preferences` utilities that flatten radii and sizes)
 *   source.css  the ORIGINAL RCM stylesheet: its globals.css + tailwind.config.ts compiled by Tailwind 3, unscoped, the oracle. Its content
 *               is the original web source plus this package's src, so a utility the module uses exists in the oracle with the original
 *               config's semantics (the few source arbitrary hex values the port names, e.g. slate-soft, are added with the SAME hex)
 *   bundle.js   the real module mounted over the fixture transport (diagnostic only, never shipped)
 * Node 24, from desktop-clients. RCM_REFERENCE_ROOT defaults to the original source `web` folder.
 */
import {createRequire} from 'node:module';
import {mkdirSync, readFileSync, writeFileSync, cpSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(root, 'package.json'));
const esbuild = require('esbuild'), postcss = require('postcss'), tailwind4 = require('@tailwindcss/postcss');
export const reference = process.env.RCM_REFERENCE_ROOT ?? '/home/pepadmin/pb/saas/reference/frontend/rcm-app/workspace-app/web';
const toolRequire = createRequire(resolve(root, 'scripts/diagnostics/style-tools/package.json'));
const ts = require('typescript');

export async function build(out = process.env.RCM_PARITY_OUT ?? '/tmp/rcm-parity') {
  mkdirSync(out, {recursive: true});
  cpSync(resolve(root,"packages/tokens/src/fonts"),resolve(out,"fonts"),{recursive:true});
  const bundledFonts=readFileSync(resolve(root,"packages/tokens/src/reference-fonts.css"),"utf8");
  await esbuild.build({
    entryPoints: [resolve(import.meta.dirname, 'entry.tsx')], bundle: true, outfile: resolve(out, 'bundle.js'), format: 'iife', platform: 'browser',
    jsx: 'automatic', loader: {'.json': 'json'}, alias: {vitest: resolve(import.meta.dirname, 'shim-vitest.js')}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'error', absWorkingDir: root,
  });
  const rcm = resolve(root, 'packages/reference-rcm/src');
  const hostInput = `@import "${rcm}/styles.css";
@import "tailwindcss";
@import "@pepbits/tokens/tokens.css";
@import "@pepbits/reference-host/styles.css";
@source "${root}/packages/ops-ui/src";
@source "${root}/packages/reference-host/src";
@source "${rcm}";
@source not "${rcm}/**/*.test.{ts,tsx}";
@source not "${rcm}/test-*.{ts,tsx}";
@source not "${rcm}/styles.css";`;
  const host = await postcss([tailwind4({optimize: false})]).process(hostInput, {from: resolve(root, 'apps/web/src/app/parity.css')});
  writeFileSync(resolve(out, 'host.css'), bundledFonts+'\n'+host.css);

  // Oracle: the original config (evaluated unchanged) + the original globals.css, Tailwind 3.
  const tw3 = toolRequire('tailwindcss'), postcss3 = toolRequire('postcss');
  const configText = ts.transpileModule(readFileSync(resolve(root, 'scripts/rcm/source-design/tailwind.config.ts'), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
  const holder = {exports: {}}; new Function('module', 'exports', configText)(holder, holder.exports);
  const config = holder.exports.default ?? holder.exports;
  config.content = [`${reference}/app/**/*.{ts,tsx}`, `${reference}/components/**/*.{ts,tsx}`, `${reference}/lib/**/*.{ts,tsx}`, `${rcm}/**/*.{ts,tsx}`, `!${rcm}/**/*.test.{ts,tsx}`, `!${rcm}/test-*.{ts,tsx}`];
  // The source wrote these as arbitrary values ([#94A1B2], [#C3CECB], [#FCFDFE], shadow-[0_1px_0_#D6DCE4]); the port names them. Same values.
  config.theme.extend.colors = {...config.theme.extend.colors, 'slate-soft': '#94A1B2', 'switch-off': '#C3CECB', ledger: '#FCFDFE'};
  config.theme.extend.boxShadow = {...config.theme.extend.boxShadow, card: '0 1px 0 #D6DCE4'};
  const globals = readFileSync(resolve(root, 'scripts/rcm/source-design/globals.css'), 'utf8').replace(/^@import url\([^\n]*\);?\n/m, '');
  const source = await postcss3([tw3(config)]).process(globals, {from: resolve(root, 'scripts/rcm/parity/source.css')});
  writeFileSync(resolve(out, 'source.css'), bundledFonts+'\n'+source.css);

  const page = (css, body) => `<!doctype html><html lang="en" data-theme="nexora"><head><meta charset="utf-8"><link rel="stylesheet" href="${css}"></head>${body}</html>`;
  writeFileSync(resolve(out, 'index.html'), page('host.css', '<body style="--font-ui:Inter,ui-sans-serif,system-ui,sans-serif"><div id="app"></div><script src="bundle.js"></script></body>'));
  writeFileSync(resolve(out, 'oracle.html'), page('source.css', '<body><div id="app"></div></body>'));
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) console.log('built', await build());
