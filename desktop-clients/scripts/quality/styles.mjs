/**
 * Generates src/styles.css for @pepbits/reference-quality from the ORIGINAL AllyVora Quality Tailwind 4 design.
 *
 *   node scripts/quality/styles.mjs [--check]        (run with Node 24 from desktop-clients)
 *
 * Input:  scripts/quality/source-design/globals.css (byte-exact copy of the source src/app/globals.css; set
 *         QUALITY_REFERENCE_ROOT to the source `web/src` to compare against the original) and the utilities used by
 *         packages/reference-quality/src (Tailwind scans it with an explicit @source; nothing else is scanned).
 * Tooling: the repository's own tailwindcss/@tailwindcss/postcss 4.x and postcss; postcss-selector-parser is resolved from
 *         QUALITY_STYLE_TOOL (a package.json path), else scripts/diagnostics/style-tools, else the source's node_modules.
 *
 * Isolation rules (asserted by packages/reference-quality/src/styles.test.ts and the repo's verify-parity gate):
 *  - every selector starts with `.reference-quality` (or `[data-reduced-motion="true"] .reference-quality`); html/body/:root
 *    become the scope, `:focus-visible` / `::selection` are scoped, and `@page` (a document-wide at-rule that cannot be scoped)
 *    is dropped, leaving page size and margins to the host's print surface
 *  - Tailwind preflight sits under `:where(.reference-quality)` at zero specificity, so host and shared component classes always win ties
 *  - cascade layers are flattened (an unlayered host rule would otherwise beat every layered utility) and `@property` registrations,
 *    which are global, become scoped initial values for the --tw-* variables
 *  - keyframes are prefixed `quality-`, so spin/pulse cannot collide with host animations
 *  - font sizes multiply the host --fs-scale, radii follow the host --radius (source look at the default 14px), fonts follow --font-ui
 *  - neutral colors (surface, panel, ink, line) follow the host theme tokens with the source hex as fallback; status colors keep source hues,
 *    and their soft tints are re-derived for the host's dark themes
 */
import {createRequire} from 'node:module';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const design = resolve(import.meta.dirname, 'source-design/globals.css');
const reference = process.env.QUALITY_REFERENCE_ROOT && resolve(process.env.QUALITY_REFERENCE_ROOT, 'app/globals.css');
if (reference && existsSync(reference) && readFileSync(reference, 'utf8') !== readFileSync(design, 'utf8')) throw new Error('source-design/globals.css differs from the reference source; re-copy it deliberately');

const toolRequire = candidates => {
  for (const c of candidates.filter(Boolean)) { try { const r = createRequire(c); r.resolve('postcss-selector-parser'); return r; } catch { /* next */ } }
  throw new Error('postcss-selector-parser not found. Install scripts/diagnostics/style-tools or set QUALITY_STYLE_TOOL.');
};
const require = toolRequire([process.env.QUALITY_STYLE_TOOL, resolve(root, 'scripts/diagnostics/style-tools/package.json'), '/home/pepadmin/pb/saas/reference/frontend/allyvora-quality/allyvora-quality/web/package.json']);
const selectorParser = require('postcss-selector-parser');
const rootRequire = createRequire(resolve(root, 'package.json'));
const postcss = rootRequire('postcss'), tailwind = rootRequire('@tailwindcss/postcss');
if (!/^4\./.test(rootRequire('tailwindcss/package.json').version)) throw new Error('Tailwind 4 is required to reproduce the source design');

const SCOPE = 'reference-quality';
const S = '.' + SCOPE;
const NEUTRALS = {surface: ['--bg', '#f4f7f6'], panel: ['--surface', '#ffffff'], ink: ['--text', '#102a34'], 'ink-2': ['--text-muted', '#3d5560'], 'ink-3': ['--text-subtle', '#6b7f87'], line: ['--border', '#dde5e3'], 'line-strong': ['--border-strong', '#c6d2cf']};
const DARK_THEMES = ['midnight', 'graphite', 'plum', 'nord'];
const SOFT = {primary: '#0e6b5c', ok: '#2f855a', warn: '#b7791f', bad: '#c53030', info: '#2b6cb0'};

const original = readFileSync(design, 'utf8');
const input = original
  .replace('@import "tailwindcss";', `@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@source "../../packages/reference-quality/src";
@source not "../../packages/reference-quality/src/**/*.test.{ts,tsx}";
@source not "../../packages/reference-quality/src/test-*.{ts,tsx}";`)
  .replace('@theme {', '@theme static {');
if (input === original) throw new Error('globals.css no longer starts with @import "tailwindcss"');

const compiled = await postcss([tailwind({optimize: false})]).process(input, {from: resolve(import.meta.dirname, 'entry.css')});
const css = postcss.parse(compiled.css);

// 1. Global @property registrations -> scoped initial values; drop the fallback `properties` layer and @page.
const initials = [];
css.walkAtRules('property', rule => {
  const initial = rule.nodes?.find(d => d.prop === 'initial-value')?.value;
  if (initial !== undefined) initials.push([rule.params.trim(), initial.trim()]);
  rule.remove();
});
css.walkAtRules('layer', rule => { if (rule.params === 'properties') rule.remove(); });
css.walkAtRules('page', rule => rule.remove());
css.walkAtRules('supports', rule => { if (!rule.nodes?.length) rule.remove(); });

// 2. Flatten cascade layers (keeps order: theme, base, utilities).
const layerOf = new Map();
css.walkAtRules('layer', rule => { if (rule.nodes) layerOf.set(rule, rule.params); });
for (const rule of [...layerOf.keys()].reverse()) { const parent = rule.parent; rule.replaceWith(rule.nodes.map(n => { const c = n.clone(); c.raws.before = '\n'; return c; })); void parent; }
css.walkAtRules('layer', rule => { if (!rule.nodes) rule.remove(); });

// 3. Scope selectors. Preflight (element selectors, the universal rule) is zero specificity.
const frames = new Map();
css.walkAtRules(/keyframes$/, rule => { frames.set(rule.params, `quality-${rule.params}`); rule.params = `quality-${rule.params}`; });
const nested = [];
css.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
  if (rule.parent?.type === 'rule') { nested.push(rule.selector); return; }
  rule.selector = selectorParser(selectors => {
    selectors.each(selector => {
      const first = selector.nodes[0];
      const rootish = first && ((first.type === 'tag' && ['html', 'body'].includes(first.value)) || (first.type === 'pseudo' && first.value === ':root') || (first.type === 'pseudo' && first.value === ':host'));
      if (rootish && selector.nodes.length === 1) { selector.nodes[0].replaceWith(selectorParser.className({value: SCOPE})); return; }
      const text = selector.toString().trim();
      // Preflight: anything that does not start with a class, id or attribute selector (elements, *, pseudo-elements, :where).
      const preflight = !(first && ['class', 'id'].includes(first.type)) && !text.startsWith('[') && !/^(:focus-visible|::selection)$/.test(text);
      if (preflight) {
        const inner = text.includes('::') && !text.startsWith('::') && !text.startsWith('*') ? text : text;
        selector.empty();
        selector.append(selectorParser.pseudo({value: ':where', nodes: [selectorParser.selector({nodes: [selectorParser.className({value: SCOPE})]})]}));
        selector.append(selectorParser.combinator({value: ' '}));
        const parsed = selectorParser().astSync(inner).first;
        // Pseudo-elements cannot sit inside :where(); keep them on the compound that carries them.
        if (inner.includes('::')) parsed.nodes.forEach(n => selector.append(n.clone())); else selector.append(selectorParser.pseudo({value: ':where', nodes: [parsed.clone()]}));
        return;
      }
      selector.prepend(selectorParser.combinator({value: ' '}));
      selector.prepend(selectorParser.className({value: SCOPE}));
    });
  }).processSync(rule.selector);
  rule.selectors = [...new Set(rule.selectors)];
});
if (nested.length) throw new Error('Nested rules found (selectors would escape the scope): ' + nested.slice(0, 5).join(' | '));

// 4. Host-driven declarations.
const px = value => { const m = /^(-?\d*\.?\d+)(rem|px)$/.exec(value.trim()); return m ? Number(m[1]) * (m[2] === 'rem' ? 16 : 1) : null; };
const RADIUS = /^border(-(top|bottom)-(left|right)|-(start|end)-(start|end))?-radius$/;
css.walkDecls(decl => {
  if (/animation|^--animate-/.test(decl.prop)) for (const [from, to] of frames) decl.value = decl.value.replace(new RegExp(`(^|[\\s,])${from}(?=[\\s,;]|$)`, 'g'), `$1${to}`);
  const inPreflight = false;
  if (decl.prop === 'font-size' || (/^--text-/.test(decl.prop) && !decl.prop.includes('--line-height'))) {
    const v = px(decl.value);
    if (v !== null) decl.value = `calc(${decl.value.trim()} * var(--fs-scale, 1))`;
  }
  if (/^--radius-/.test(decl.prop) || RADIUS.test(decl.prop)) {
    const v = px(decl.value);
    if (v !== null && v > 0 && v < 9999) decl.value = `calc(var(--radius, 14px) * ${+(v / 14).toFixed(4)})`;
  }
  void inPreflight;
});
// Fonts: follow the host font; keep the source's monospace.
css.walkDecls('--font-sans', decl => { decl.value = 'var(--font-ui, ui-sans-serif), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'; });
css.walkDecls('--font-mono', decl => { decl.value = 'ui-monospace, SFMono-Regular, Menlo, monospace'; });
// The source's data-table sizing (13px) follows the managed result scale (the shared Table sets --fs-scale).
css.walkDecls('font-size', decl => { if (/^13px$/.test(decl.value)) decl.value = 'calc(13px * var(--fs-scale, 1))'; });

// 5. Preferences, theme neutrals and the scoped initial values.
const neutral = Object.entries(NEUTRALS).map(([k, [token, fallback]]) => `--color-${k}:var(${token},${fallback})`).join(';');
const tints = (theme) => Object.entries(SOFT).map(([k, hex]) => `--color-${k}-soft:color-mix(in srgb, ${hex} 22%, var(--surface, #0d1626))`).join(';');
const darkSelectors = DARK_THEMES.map(t => `${S}[data-theme="${t}"]`).join(',');
const extra = `
${S}{${neutral};min-width:0;width:100%;font-family:var(--font-ui, var(--font-sans));font-size:calc(16px * var(--fs-scale, 1));line-height:1.5;--fs-scale:var(--fs-shell, 1);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;background:var(--color-surface);color:var(--color-ink)}
${S}[data-overlay]{width:auto;min-width:0;background:transparent;color:inherit}
${S} input,${S} select,${S} textarea{--fs-scale:var(--fs-form, 1)}
${S} table{--fs-scale:var(--fs-result, 1)}
${darkSelectors}{${tints()};color-scheme:dark}
${S}[data-theme="print"]{${Object.entries(NEUTRALS).map(([k, [, fallback]]) => `--color-${k}:${fallback}`).join(';')};background:#fff;color:#102a34}
[data-reduced-motion="true"] ${S} *,[data-reduced-motion="true"] ${S} *::before,[data-reduced-motion="true"] ${S} *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
`;
const initialRule = initials.length
  ? `:where(${S}) *,:where(${S}) ::before,:where(${S}) ::after,:where(${S}) ::backdrop{${initials.map(([name, value]) => `${name}:${value}`).join(';')}}\n`
  : '';
// Preflight's pseudo-element selectors need the same zero-specificity scope.
const output = '/* Generated by scripts/quality/styles.mjs from the original AllyVora Quality Tailwind 4 design. Do not edit. */\n'
  + css.toString().replace(/^\/\*![^]*?\*\/\n?/, '') + '\n' + initialRule + extra;

const out = resolve(root, 'packages/reference-quality/src/styles.css');
if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== output) { console.error('styles.css is stale: run node scripts/quality/styles.mjs'); process.exit(1); }
  console.log('styles.css is current');
} else { writeFileSync(out, output); console.log(`quality styles generated (${output.length} bytes)`); }
