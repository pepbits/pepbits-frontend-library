/**
 * Generates src/styles.css for @pepbits/reference-pharmacy from the ORIGINAL Phial Tailwind 4 design.
 *
 *   node scripts/pharmacy/styles.mjs [--check]        (run with Node 24 from desktop-clients)
 *
 * Input:  scripts/pharmacy/source-design/globals.css (byte-exact copy of the source src/app/globals.css; set
 *         PHARMACY_REFERENCE_ROOT to the source `frontend/src` to compare against the original) and the utilities used by
 *         packages/reference-pharmacy/src (Tailwind scans it with an explicit @source; nothing else is scanned).
 * Tooling: the repository's own tailwindcss/@tailwindcss/postcss 4.x and postcss; postcss-selector-parser is resolved from
 *         PHARMACY_STYLE_TOOL (a package.json path), else scripts/diagnostics/style-tools, else the quality source's node_modules.
 *
 * Same pipeline as scripts/quality/styles.mjs (kept separate: that generator is bound to the Quality package), with the
 * differences the Phial design needs:
 *  - every selector starts with `.reference-pharmacy` (or `[data-reduced-motion="true"] .reference-pharmacy`); html/body/:root
 *    become the scope, `:focus-visible` / `::selection` are scoped, `@page` and the document-wide `@media print` block (it hides
 *    everything but `.print-area`) are dropped: printing goes through the shared PrintDocument surface instead
 *  - Tailwind preflight sits under `:where(.reference-pharmacy)` at zero specificity, so host and shared component classes win ties
 *  - cascade layers are flattened, `@property` registrations become scoped initial values for the --tw-* variables
 *  - keyframes are prefixed `pharmacy-`, so pop-in/pulse cannot collide with host animations
 *  - the source's `:root` palette is NOT emitted as is: it would redefine the host's --surface/--surface-2/--surface-3/--danger inside
 *    the module. Instead the original values are read from the source file and re-expressed: canvas, lines, ink and the cobalt (action)
 *    family follow the host theme tokens with the source hex as fallback; surface levels and danger are the host's own; amber, ok,
 *    violet, their washes, the rail and the shadows keep the source values, and the source's dark values apply under the host's dark themes
 *  - font sizes multiply the host --fs-scale, radii follow the host --radius (source look at the default 14px), fonts follow --font-ui
 */
import {createRequire} from 'node:module';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const design = resolve(import.meta.dirname, 'source-design/globals.css');
const reference = process.env.PHARMACY_REFERENCE_ROOT && resolve(process.env.PHARMACY_REFERENCE_ROOT, 'app/globals.css');
if (reference && existsSync(reference) && readFileSync(reference, 'utf8') !== readFileSync(design, 'utf8')) throw new Error('source-design/globals.css differs from the reference source; re-copy it deliberately');

const toolRequire = candidates => {
  for (const c of candidates.filter(Boolean)) { try { const r = createRequire(c); r.resolve('postcss-selector-parser'); return r; } catch { /* next */ } }
  throw new Error('postcss-selector-parser not found. Install scripts/diagnostics/style-tools or set PHARMACY_STYLE_TOOL.');
};
const require = toolRequire([process.env.PHARMACY_STYLE_TOOL, resolve(root, 'scripts/diagnostics/style-tools/package.json'), '/home/pepadmin/pb/saas/reference/frontend/allyvora-quality/allyvora-quality/web/package.json']);
const selectorParser = require('postcss-selector-parser');
const rootRequire = createRequire(resolve(root, 'package.json'));
const postcss = rootRequire('postcss'), tailwind = rootRequire('@tailwindcss/postcss');
if (!/^4\./.test(rootRequire('tailwindcss/package.json').version)) throw new Error('Tailwind 4 is required to reproduce the source design');

const SCOPE = 'reference-pharmacy';
const S = '.' + SCOPE;
const DARK_THEMES = ['midnight', 'graphite', 'plum', 'nord'];
/** Source token -> host token it follows (source value is the fallback). */
const HOST_ALIAS = {canvas: '--bg', line: '--border', 'line-strong': '--border-strong', ink: '--text', 'ink-2': '--text-muted', 'ink-3': '--text-subtle', cobalt: '--primary', 'cobalt-strong': '--primary-strong', 'cobalt-wash': '--primary-soft'};
/** Source tokens that share a name with a host token and must keep the host's value inside the module. */
const HOST_OWNED = new Set(['surface', 'surface-2', 'surface-3', 'danger']);

const original = readFileSync(design, 'utf8');

// 0. Read the source palette, then remove everything that cannot be emitted as is.
const source = postcss.parse(original);
const light = new Map(), dark = new Map();
source.walkRules(rule => {
  const target = rule.selector === ':root' ? light : rule.selector === ':root[data-theme="dark"]' ? dark : null;
  if (!target) return;
  rule.walkDecls(d => { if (d.prop.startsWith('--')) target.set(d.prop.slice(2), d.value.trim()); });
  rule.remove();
});
if (!light.size || !dark.size) throw new Error('source palette (:root, :root[data-theme="dark"]) not found in globals.css');
source.walkAtRules('media', rule => { if (/print/.test(rule.params)) rule.remove(); });
source.walkRules(rule => { if (rule.selector === 'html, body') rule.walkDecls('height', d => d.remove()); });
const stripped = source.toString();

const input = stripped
  .replace('@import "tailwindcss";', `@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@source "../../packages/reference-pharmacy/src";
@source not "../../packages/reference-pharmacy/src/**/*.test.{ts,tsx}";
@source not "../../packages/reference-pharmacy/src/test-*.{ts,tsx}";`)
  .replace(/--font-sans:[^;]+;/, '--font-sans: var(--font-ui, ui-sans-serif), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;');
if (input === stripped) throw new Error('globals.css no longer starts with @import "tailwindcss"');

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
for (const rule of [...layerOf.keys()].reverse()) rule.replaceWith(rule.nodes.map(n => { const c = n.clone(); c.raws.before = '\n'; return c; }));
css.walkAtRules('layer', rule => { if (!rule.nodes) rule.remove(); });

// 3. Scope selectors. Preflight (element selectors, the universal rule) is zero specificity.
const frames = new Map();
css.walkAtRules(/keyframes$/, rule => { frames.set(rule.params, `pharmacy-${rule.params}`); rule.params = `pharmacy-${rule.params}`; });
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

// 4. Host-driven declarations.
const px = value => { const m = /^(-?\d*\.?\d+)(rem|px)$/.exec(value.trim()); return m ? Number(m[1]) * (m[2] === 'rem' ? 16 : 1) : null; };
const RADIUS = /^border(-(top|bottom)-(left|right)|-(start|end)-(start|end))?-radius$/;
css.walkDecls(decl => {
  if (/animation|^--animate-/.test(decl.prop)) for (const [from, to] of frames) decl.value = decl.value.replace(new RegExp(`(^|[\\s,])${from}(?=[\\s,;]|$)`, 'g'), `$1${to}`);
  if (decl.prop === 'font-size' || (/^--text-/.test(decl.prop) && !decl.prop.includes('--line-height'))) {
    const v = px(decl.value);
    if (v !== null) decl.value = `calc(${decl.value.trim()} * var(--fs-scale, 1))`;
  }
  if (/^--radius-/.test(decl.prop) || RADIUS.test(decl.prop)) {
    const v = px(decl.value);
    if (v !== null && v > 0 && v < 9999) decl.value = `calc(var(--radius, 14px) * ${+(v / 14).toFixed(4)})`;
  }
});
// Keep the source's monospace, if any, and follow the host font everywhere else (set in the input).
css.walkDecls('--font-mono', decl => { decl.value = 'ui-monospace, SFMono-Regular, Menlo, monospace'; });
// The source's 13px data sizing follows the managed result scale (the shared Table sets --fs-scale).
css.walkDecls('font-size', decl => { if (/^13px$/.test(decl.value)) decl.value = 'calc(13px * var(--fs-scale, 1))'; });

// 5. Palette, preferences and the scoped initial values.
const own = ([name]) => !HOST_OWNED.has(name);
const lightDecls = [...light].filter(own).map(([name, value]) => `--${name}:${HOST_ALIAS[name] ? `var(${HOST_ALIAS[name]},${value})` : value}`).join(';');
const darkDecls = [...dark].filter(([name]) => own([name]) && !HOST_ALIAS[name]).map(([name, value]) => `--${name}:${value}`).join(';');
const darkSelectors = DARK_THEMES.map(t => `${S}[data-theme="${t}"]`).join(',');
const extra = `
${S}{${lightDecls};min-width:0;width:100%;--fs-scale:var(--fs-shell, 1)}
${S}[data-overlay]{width:auto;min-width:0;background:transparent;color:inherit}
${S} input,${S} select,${S} textarea{--fs-scale:var(--fs-form, 1)}
${S} table{--fs-scale:var(--fs-result, 1)}
${darkSelectors}{${darkDecls};color-scheme:dark}
[data-reduced-motion="true"] ${S} *,[data-reduced-motion="true"] ${S} *::before,[data-reduced-motion="true"] ${S} *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
`;
const initialRule = initials.length
  ? `:where(${S}) *,:where(${S}) ::before,:where(${S}) ::after,:where(${S}) ::backdrop{${initials.map(([name, value]) => `${name}:${value}`).join(';')}}\n`
  : '';
const output = '/* Generated by scripts/pharmacy/styles.mjs from the original Phial Tailwind 4 design. Do not edit. */\n'
  + css.toString().replace(/^\/\*![^]*?\*\/\n?/, '') + '\n' + initialRule + extra;

const out = resolve(root, 'packages/reference-pharmacy/src/styles.css');
if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== output) { console.error('styles.css is stale: run node scripts/pharmacy/styles.mjs'); process.exit(1); }
  console.log('styles.css is current');
} else { writeFileSync(out, output); console.log(`pharmacy styles generated (${output.length} bytes)`); }
