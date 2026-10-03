/**
 * Generates src/styles.css for @pepbits/reference-rcm from the ORIGINAL RCM workspace Tailwind 3 design.
 *
 *   node scripts/rcm/styles.mjs [--check]        (run with Node 24 from desktop-clients)
 *
 * Input:  scripts/rcm/source-design/{tailwind.config.ts,globals.css} (byte-exact copies of the source web/ files; set
 *         RCM_REFERENCE_ROOT to the source `web` folder to compare against the original) and the utilities used by
 *         packages/reference-rcm/src (Tailwind scans only that folder, tests excluded).
 * Tooling: Tailwind 3 (the source's version), postcss and postcss-selector-parser from RCM_STYLE_TOOL (a package.json path),
 *         else scripts/diagnostics/style-tools, else the Allyvora Quality source's node_modules. TypeScript comes from the repository.
 *
 * What changes relative to the source build (everything else is the source's CSS as compiled):
 *  - every selector starts with `.reference-rcm`; html/body/:root become the scope; Tailwind preflight and the source's
 *    element rules sit under `:where(.reference-rcm)` at zero specificity, so host and shared component classes win ties
 *  - keyframes are prefixed `rcm-`; the Google Fonts @import is removed (the original fonts are supplied by the shared self-hosted font asset layer); no @font-face, @page or global at-rules
 *  - font sizes multiply the host --fs-scale (shell, form and result scales), radii follow the host --radius (the source look at 14px)
 *  - the source's neutrals (white surface, canvas, mist, line, muted, ink, tint) are routed through --rc-* variables: they equal the source
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
const reference = process.env.RCM_REFERENCE_ROOT && resolve(process.env.RCM_REFERENCE_ROOT);
if (reference && existsSync(reference)) {
  for (const [ours, theirs] of [[configPath, 'tailwind.config.ts'], [cssPath, 'app/globals.css']]) {
    const file = resolve(reference, theirs);
    if (existsSync(file) && readFileSync(file, 'utf8') !== readFileSync(ours, 'utf8')) throw new Error(`source-design/${theirs.split('/').pop()} differs from the reference source; re-copy it deliberately`);
  }
}

const toolRequire = candidates => {
  for (const c of candidates.filter(Boolean)) { try { const r = createRequire(c); r.resolve('postcss-selector-parser'); r.resolve('tailwindcss'); r.resolve('postcss'); return r; } catch { /* next */ } }
  throw new Error('Tailwind 3, postcss and postcss-selector-parser not found. Install scripts/diagnostics/style-tools or set RCM_STYLE_TOOL.');
};
const require = toolRequire([process.env.RCM_STYLE_TOOL, resolve(root, 'scripts/diagnostics/style-tools/package.json'), '/home/pepadmin/pb/saas/reference/frontend/allyvora-quality/allyvora-quality/web/package.json']);
if (!/^3\./.test(require('tailwindcss/package.json').version)) throw new Error('Tailwind 3 is required to reproduce the source design');
const postcss = require('postcss'), tailwind = require('tailwindcss'), selectorParser = require('postcss-selector-parser');
const ts = createRequire(resolve(root, 'package.json'))('typescript');

const SCOPE = 'reference-rcm';
const S = '.' + SCOPE;
const PREFIX = 'rcm-';
const DARK_THEMES = ['midnight', 'graphite', 'plum', 'nord'];

// 1. The source config, evaluated, with only its content globs changed and its neutrals routed through --rc-* variables.
const configText = ts.transpileModule(readFileSync(configPath, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
const holder = {exports: {}};
new Function('module', 'exports', configText)(holder, holder.exports);
const config = holder.exports.default ?? holder.exports;
const src = resolve(root, 'packages/reference-rcm/src');
config.content = [`${src}/**/*.{ts,tsx}`, `!${src}/**/*.test.{ts,tsx}`, `!${src}/test-*.{ts,tsx}`];

const mix = name => ({opacityValue}) => `color-mix(in srgb, var(${name}) calc(${opacityValue === undefined ? 1 : opacityValue} * 100%), transparent)`;
// The source's neutrals go through --rc-* variables: under light host themes they ARE the source hex values (nothing is remapped into
// the host palette); under the dark host themes they follow the host tokens. The brand colours (harbor-500..., signal, jade, saffron,
// cobalt, madder) and every tone background keep the source palette in every theme.
const NEUTRAL = {
  backgroundColor: {white: '--rc-surface', canvas: '--rc-canvas', mist: '--rc-mist', line: '--rc-line', ledger: '--rc-ledger', harbor: {50: '--rc-tint'}},
  borderColor: {line: '--rc-line', mist: '--rc-mist'},
  divideColor: {line: '--rc-line'},
  ringColor: {line: '--rc-line', white: '--rc-surface'},
  ringOffsetColor: {white: '--rc-surface'},
  textColor: {muted: '--rc-muted', harbor: {950: '--rc-ink', 900: '--rc-ink-9', 800: '--rc-ink-8', 700: '--rc-ink-7'}},
};
const remap = value => typeof value === 'string' ? mix(value) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remap(v)]));
config.theme ??= {}; config.theme.extend ??= {};
// Source colours the original wrote as arbitrary hex values ([#94A1B2], [#C3CECB], [#FCFDFE], shadow-[0_1px_0_#D6DCE4]) become named tokens.
config.theme.extend.colors = {...config.theme.extend.colors, 'slate-soft': '#94A1B2', 'switch-off': '#C3CECB', ledger: '#FCFDFE'};
config.theme.extend.boxShadow = {...config.theme.extend.boxShadow, card: '0 1px 0 var(--rc-line)'};
// `bg-white/20` on a navy chip is a light overlay, not a surface: faint white stays literal white; panels (`bg-white/70`) follow the surface.
const faintWhite = ({opacityValue}) => (opacityValue !== undefined && Number(opacityValue) <= 0.3 ? `rgb(255 255 255 / ${opacityValue})` : mix('--rc-surface')({opacityValue}));
for (const [property, tokens] of Object.entries(NEUTRAL)) {
  const base = config.theme.extend[property] ?? {};
  config.theme.extend[property] = {...base, ...remap(tokens)};
}
config.theme.extend.backgroundColor.white = faintWhite;
// The remapped source colours keep their other shades (harbor-500 ...): merge the harbor object rather than replace it.
for (const property of ['backgroundColor', 'textColor']) {
  const ext = config.theme.extend[property];
  ext.harbor = {...config.theme.extend.colors.harbor, ...ext.harbor};
}
config.corePlugins = {...(config.corePlugins ?? {})};

// 2. Compile the source stylesheet (its @tailwind directives, @layer blocks and @apply) with Tailwind 3.
const original = readFileSync(cssPath, 'utf8').replace(/^@import url\([^\n]*\);?\n/m, '');
const compiled = await postcss([tailwind(config)]).process(original, {from: resolve(designDir, 'globals.css')});
const css = postcss.parse(compiled.css);

// 3. html/body rules describe the page: they become the module root (height and scrolling belong to the host).
css.walkRules(rule => { if (rule.selector === 'html, body') { rule.walkDecls('height', d => d.remove()); } });

// 3b. The host's global managed-table rules (tokens.css) outrank consumer cell classes: padding-block, nowrap and max-width are !important and
// every cell gets `overflow:hidden; text-overflow:ellipsis`. So that the ORIGINAL cell geometry survives while the table preferences are at
// their defaults, each single-class source utility also records what it sets as `--rcm-cell-*` custom properties, and one scoped rule
// (below, `[data-rcm-table="reference"]`) hands them back to the cells. Under a non-default density or wrapping the host rules apply as is.
const CELL = {'background-color': ['bg'], 'padding-top': ['pt'], 'padding-bottom': ['pb'], 'padding-left': ['pl'], 'padding-right': ['pr'], 'white-space': ['ws'], 'max-width': ['mw'], 'overflow': ['ov'], 'text-overflow': ['to']};
css.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
  if (!/^\.[\w\\:.\[\]#%-]+$/.test(rule.selector.trim()) || /:(hover|focus|disabled|first|last|not)/.test(rule.selector)) return;
  for (const decl of [...rule.nodes ?? []].filter(n => n.type === 'decl' && CELL[n.prop])) for (const key of CELL[decl.prop]) rule.append({prop: `--rcm-cell-${key}`, value: decl.value});
  const shorthand = rule.nodes?.find(n => n.type === 'decl' && n.prop === 'padding' && !/\s/.test(n.value.trim()));
  if (shorthand) for (const key of ['pt', 'pb', 'pl', 'pr']) rule.append({prop: `--rcm-cell-${key}`, value: shorthand.value});
});

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
      const hasClass = selector.nodes.some(n => ['class', 'id'].includes(n.type));
      const preflight = !hasClass && !text.startsWith('[') && !/^(:focus-visible|::selection)$/.test(text);
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
      // Doubled scope class: the host's global `.library-preferences .rounded-lg / .text-sm` utilities (0,2,0) would otherwise tie with
      // `.reference-rcm .rounded-lg` and flatten the source's radii and sizes by source order. Preflight stays at zero specificity.
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
    if (v !== null && v > 0 && v < 9999) decl.value = `calc(var(--radius, 14px) * ${v} / 14)`;
  }
  // Public Sans (text) and Bricolage Grotesque (headings) stay the DEFAULT families, exactly as the source declares them; the host font is opt-in (extra below).
});
// Drop only empty rules and the Tailwind preflight rules that carry nothing for a scoped module (html font settings are the host's).
css.walkRules(rule => { if (!rule.nodes.length) rule.remove(); });

// 6. Palette, preferences, local layout helpers.
const darkSelectors = DARK_THEMES.map(t => `${S}[data-theme="${t}"]`).join(',');
const extra = `
${S}{--rc-surface:#ffffff;--rc-canvas:#EDF0F4;--rc-mist:#F6F8FA;--rc-line:#D6DCE4;--rc-muted:#5A6576;--rc-ink:#0A1A2E;--rc-ink-9:#10243E;--rc-ink-8:#17304F;--rc-ink-7:#1F3D63;--rc-tint:#EEF2F8;--rc-ledger:#FCFDFE;--rc-text:#0A1A2E;background-color:var(--rc-canvas);color:var(--rc-text);min-width:0;width:100%;--fs-scale:var(--fs-shell, 1)}
${S}${S}[data-rcm-font="host"],${S}${S}[data-rcm-font="host"] :is(.font-sans,.font-display,h1,h2,h3){font-family:var(--font-ui, ui-sans-serif),ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
${S}[data-overlay]{width:auto;background:transparent;color:var(--rc-text)}
${darkSelectors}{--rc-surface:var(--surface, #151b2b);--rc-canvas:var(--bg, #0e1220);--rc-mist:var(--surface-2, #1b2236);--rc-line:var(--border, #2a3350);--rc-muted:var(--text-muted, #9aa6c4);--rc-ink:var(--text, #e8ecf8);--rc-ink-9:var(--text, #e8ecf8);--rc-ink-8:var(--text, #e8ecf8);--rc-ink-7:var(--text, #e8ecf8);--rc-tint:var(--surface-3, #232c46);--rc-ledger:var(--surface, #151b2b);--rc-text:var(--text, #e8ecf8);color-scheme:dark}
${S} input,${S} select,${S} textarea{--fs-scale:var(--fs-form, 1)}
${S} table{--fs-scale:var(--fs-result, 1)}
${S} table{--rcm-cell-pt:initial;--rcm-cell-pb:initial;--rcm-cell-pl:initial;--rcm-cell-pr:initial;--rcm-cell-ws:initial;--rcm-cell-mw:initial;--rcm-cell-ov:initial;--rcm-cell-to:initial;--rcm-cell-bg:initial}
${S}${S}[data-rcm-table="reference"] table[data-managed-table="true"] > :is(thead, tbody, tfoot) > tr > :is(th, td){padding-top:var(--rcm-cell-pt, 1px)!important;padding-bottom:var(--rcm-cell-pb, 1px)!important;padding-left:var(--rcm-cell-pl, 1px);padding-right:var(--rcm-cell-pr, 1px);white-space:var(--rcm-cell-ws, normal)!important;max-width:var(--rcm-cell-mw, none);overflow:var(--rcm-cell-ov, visible);text-overflow:var(--rcm-cell-to, clip)}
${S}${S}[data-rcm-table="reference"] table[data-managed-table="true"] > thead{background-color:var(--rcm-cell-bg, transparent)}
[data-reduced-motion="true"] ${S} *,[data-reduced-motion="true"] ${S} *::before,[data-reduced-motion="true"] ${S} *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
`;
const output = '/* Generated by scripts/rcm/styles.mjs from the original RCM Tailwind 3 design. Do not edit. */\n' + css.toString() + '\n' + extra;

const out = resolve(root, 'packages/reference-rcm/src/styles.css');
if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== output) { console.error('styles.css is stale: run node scripts/rcm/styles.mjs'); process.exit(1); }
  console.log('styles.css is current');
} else { writeFileSync(out, output); console.log(`rcm styles generated (${output.length} bytes)`); }
