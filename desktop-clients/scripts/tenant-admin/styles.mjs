/**
 * Generates src/styles.css for @pepbits/reference-tenant-admin from the ORIGINAL Tenant Admin Tailwind 3 design.
 *
 *   node scripts/tenant-admin/styles.mjs [--check]        (run with Node 24 from desktop-clients)
 *
 * Input:  scripts/tenant-admin/source-design/{tailwind.config.ts,globals.css} (byte-exact copies of the source web/ files; set
 *         TENANT_ADMIN_REFERENCE_ROOT to the source `web` folder to compare against the original) and the utilities used by
 *         packages/reference-tenant-admin/src (Tailwind scans only that folder, tests excluded).
 * Tooling: Tailwind 3 (the source's version), postcss and postcss-selector-parser from TENANT_ADMIN_STYLE_TOOL (a package.json path),
 *         else scripts/diagnostics/style-tools, else the Allyvora Quality source's node_modules. TypeScript comes from the repository.
 *
 * What changes relative to the source build (everything else is the source's CSS as compiled):
 *  - every selector starts with `.reference-tenant-admin`; html/body/:root become the scope; Tailwind preflight and the source's
 *    element rules sit under `:where(.reference-tenant-admin)` at zero specificity, so host and shared component classes win ties
 *  - keyframes are prefixed `tenant-admin-`; the Google Fonts @import is removed (the host font is used); no @font-face, @page or global at-rules
 *  - font sizes multiply the host --fs-scale (shell, form and result scales), radii follow the host --radius (the source look at 14px)
 *  - the source's neutrals (white surface, canvas, mist, line, muted, ink, tint) are routed through --ta-* variables: they equal the source
 *    hex values under light host themes and follow the host tokens under the dark host themes
 *  - host reduced-motion (data-reduced-motion) switches animation and transitions off
 */
import {createRequire} from 'node:module';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const designDir = resolve(import.meta.dirname, 'source-design');
const configPath = resolve(designDir, 'tailwind.config.ts');
const cssPath = resolve(designDir, 'globals.css');
const reference = process.env.TENANT_ADMIN_REFERENCE_ROOT && resolve(process.env.TENANT_ADMIN_REFERENCE_ROOT);
if (reference && existsSync(reference)) {
  for (const [ours, theirs] of [[configPath, 'tailwind.config.ts'], [cssPath, 'app/globals.css']]) {
    const file = resolve(reference, theirs);
    if (existsSync(file) && readFileSync(file, 'utf8') !== readFileSync(ours, 'utf8')) throw new Error(`source-design/${theirs.split('/').pop()} differs from the reference source; re-copy it deliberately`);
  }
}

const toolRequire = candidates => {
  for (const c of candidates.filter(Boolean)) { try { const r = createRequire(c); r.resolve('postcss-selector-parser'); r.resolve('tailwindcss'); r.resolve('postcss'); return r; } catch { /* next */ } }
  throw new Error('Tailwind 3, postcss and postcss-selector-parser not found. Install scripts/diagnostics/style-tools or set TENANT_ADMIN_STYLE_TOOL.');
};
const require = toolRequire([process.env.TENANT_ADMIN_STYLE_TOOL, resolve(root, 'scripts/diagnostics/style-tools/package.json'), '/home/pepadmin/pb/saas/reference/frontend/allyvora-quality/allyvora-quality/web/package.json']);
if (!/^3\./.test(require('tailwindcss/package.json').version)) throw new Error('Tailwind 3 is required to reproduce the source design');
const postcss = require('postcss'), tailwind = require('tailwindcss'), selectorParser = require('postcss-selector-parser');
const ts = createRequire(resolve(root, 'package.json'))('typescript');

const SCOPE = 'reference-tenant-admin';
const S = '.' + SCOPE;
const PREFIX = 'tenant-admin-';
const DARK_THEMES = ['midnight', 'graphite', 'plum', 'nord'];

// 1. The source config, evaluated, with only its content globs changed and its neutrals routed through --ta-* variables.
const configText = ts.transpileModule(readFileSync(configPath, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
const holder = {exports: {}};
new Function('module', 'exports', configText)(holder, holder.exports);
const config = holder.exports.default ?? holder.exports;
const src = resolve(root, 'packages/reference-tenant-admin/src');
config.content = [`${src}/**/*.{ts,tsx}`, `!${src}/**/*.test.{ts,tsx}`, `!${src}/test-*.{ts,tsx}`];

const mix = name => ({opacityValue}) => `color-mix(in srgb, var(${name}) calc(${opacityValue === undefined ? 1 : opacityValue} * 100%), transparent)`;
const NEUTRAL = {
  backgroundColor: {white: '--ta-surface', canvas: '--ta-canvas', mist: '--ta-mist', line: '--ta-line', spruce: {50: '--ta-tint'}},
  borderColor: {line: '--ta-line', mist: '--ta-mist'},
  divideColor: {line: '--ta-line'},
  ringOffsetColor: {white: '--ta-surface'},
  textColor: {muted: '--ta-muted', spruce: {950: '--ta-ink', 900: '--ta-ink', 800: '--ta-ink-2', 700: '--ta-ink-2'}},
};
const remap = value => typeof value === 'string' ? mix(value) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remap(v)]));
config.theme ??= {}; config.theme.extend ??= {};
for (const [property, tokens] of Object.entries(NEUTRAL)) {
  const base = config.theme.extend[property] ?? {};
  config.theme.extend[property] = {...base, ...remap(tokens)};
}
// The remapped source colours keep their other shades (spruce-500 ...): merge the spruce object rather than replace it.
for (const property of ['backgroundColor', 'textColor']) {
  const ext = config.theme.extend[property];
  ext.spruce = {...config.theme.extend.colors.spruce, ...ext.spruce};
}
config.corePlugins = {...(config.corePlugins ?? {})};

// 2. Compile the source stylesheet (its @tailwind directives, @layer blocks and @apply) with Tailwind 3.
const original = readFileSync(cssPath, 'utf8').replace(/^@import url\([^\n]*\);?\n/m, '');
const compiled = await postcss([tailwind(config)]).process(original, {from: resolve(designDir, 'globals.css')});
const css = postcss.parse(compiled.css);

// 3. html/body rules describe the page: they become the module root (height and scrolling belong to the host).
css.walkRules(rule => { if (rule.selector === 'html, body') { rule.walkDecls('height', d => d.remove()); } });

// 4. Keyframes, scoped selectors. Preflight and element rules are zero specificity; classes and attributes are scoped as is.
const frames = new Map();
css.walkAtRules(/keyframes$/, rule => { frames.set(rule.params, PREFIX + rule.params); rule.params = PREFIX + rule.params; });
const nested = [];
css.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
  if (rule.parent?.type === 'rule') { nested.push(rule.selector); return; }
  rule.selector = selectorParser(selectors => {
    selectors.each(selector => {
      const first = selector.nodes[0];
      const rootish = first && ((first.type === 'tag' && ['html', 'body'].includes(first.value)) || (first.type === 'pseudo' && first.value === ':root'));
      if (rootish && selector.nodes.length === 1) { selector.nodes[0].replaceWith(selectorParser.className({value: SCOPE})); return; }
      const text = selector.toString().trim();
      const preflight = !(first && ['class', 'id'].includes(first.type)) && !text.startsWith('[') && !/^(:focus-visible|::selection)$/.test(text);
      if (preflight) {
        selector.empty();
        selector.append(selectorParser.pseudo({value: ':where', nodes: [selectorParser.selector({nodes: [selectorParser.className({value: SCOPE})]})]}));
        selector.append(selectorParser.combinator({value: ' '}));
        const parsed = selectorParser().astSync(text).first;
        // Pseudo-elements cannot sit inside :where(); keep them on the compound that carries them.
        if (text.includes('::')) parsed.nodes.forEach(n => selector.append(n.clone())); else selector.append(selectorParser.pseudo({value: ':where', nodes: [parsed.clone()]}));
        return;
      }
      selector.prepend(selectorParser.combinator({value: ' '}));
      selector.prepend(selectorParser.className({value: SCOPE}));
    });
  }).processSync(rule.selector);
  rule.selectors = [...new Set(rule.selectors)];
});
if (nested.length) throw new Error('Nested rules found (selectors would escape the scope): ' + nested.slice(0, 5).join(' | '));

// 5. Host-driven declarations.
const px = value => { const m = /^(-?\d*\.?\d+)(rem|px)$/.exec(value.trim()); return m ? Number(m[1]) * (m[2] === 'rem' ? 16 : 1) : null; };
const RADIUS = /^border(-(top|bottom)-(left|right)|-(start|end)-(start|end))?-radius$/;
css.walkDecls(decl => {
  if (/^animation/.test(decl.prop)) for (const [from, to] of frames) decl.value = decl.value.replace(new RegExp(`(^|[\\s,])${from}(?=[\\s,;]|$)`, 'g'), `$1${to}`);
  if (decl.prop === 'font-size') { if (px(decl.value) !== null) decl.value = `calc(${decl.value.trim()} * var(--fs-scale, 1))`; }
  if (RADIUS.test(decl.prop)) {
    const v = px(decl.value);
    if (v !== null && v > 0 && v < 9999) decl.value = `calc(var(--radius, 14px) * ${+(v / 14).toFixed(4)})`;
  }
  // The source fonts (Public Sans, Bricolage Grotesque) are not loaded here: the host font applies.
  if (decl.prop === 'font-family' && /Public Sans|Bricolage/.test(decl.value)) decl.value = 'var(--font-ui, ui-sans-serif), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
});
// Drop only empty rules and the Tailwind preflight rules that carry nothing for a scoped module (html font settings are the host's).
css.walkRules(rule => { if (!rule.nodes.length) rule.remove(); });

// 6. Palette, preferences, local layout helpers.
const darkSelectors = DARK_THEMES.map(t => `${S}[data-theme="${t}"]`).join(',');
const extra = `
${S}{--ta-surface:#ffffff;--ta-canvas:#ECF0EE;--ta-mist:#F6F8F7;--ta-line:#D5DDDA;--ta-muted:#5B6B68;--ta-ink:#091F1D;--ta-ink-2:#18413A;--ta-tint:#EAF2F0;--ta-text:#091F1D;background-color:var(--ta-canvas);color:var(--ta-text);font-family:var(--font-ui, ui-sans-serif),ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;min-width:0;width:100%;--fs-scale:var(--fs-shell, 1)}
${S}[data-overlay]{width:auto;background:transparent;color:var(--ta-text)}
${darkSelectors}{--ta-surface:var(--surface, #151b2b);--ta-canvas:var(--bg, #0e1220);--ta-mist:var(--surface-2, #1b2236);--ta-line:var(--border, #2a3350);--ta-muted:var(--text-muted, #9aa6c4);--ta-ink:var(--text, #e8ecf8);--ta-ink-2:var(--text, #e8ecf8);--ta-tint:var(--surface-3, #232c46);--ta-text:var(--text, #e8ecf8);color-scheme:dark}
${S} input,${S} select,${S} textarea{--fs-scale:var(--fs-form, 1)}
${S} table{--fs-scale:var(--fs-result, 1)}
${S} .ta-fields-box{container:ta-fields / inline-size}
${S} .ta-fields{display:grid;grid-template-columns:minmax(0,1fr);gap:1rem 1.25rem}
${S} .ta-spacer{display:none}
@container ta-fields (min-width: 34rem){${S} .ta-fields{grid-template-columns:repeat(2,minmax(0,1fr))}${S} .ta-fields .ta-span-2{grid-column:span 2 / span 2}${S} .ta-spacer{display:block}}
[data-reduced-motion="true"] ${S} *,[data-reduced-motion="true"] ${S} *::before,[data-reduced-motion="true"] ${S} *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
`;
const output = '/* Generated by scripts/tenant-admin/styles.mjs from the original Tenant Admin Tailwind 3 design. Do not edit. */\n' + css.toString() + '\n' + extra;

const out = resolve(root, 'packages/reference-tenant-admin/src/styles.css');
if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== output) { console.error('styles.css is stale: run node scripts/tenant-admin/styles.mjs'); process.exit(1); }
  console.log('styles.css is current');
} else { writeFileSync(out, output); console.log(`tenant-admin styles generated (${output.length} bytes)`); }
