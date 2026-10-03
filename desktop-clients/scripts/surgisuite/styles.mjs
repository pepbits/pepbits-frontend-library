/**
 * Generates src/styles.css for @pepbits/reference-surgisuite from the ORIGINAL SurgiSuite Tailwind 4 design.
 *
 *   node scripts/surgisuite/styles.mjs [--check]        (run with Node 24 from desktop-clients)
 *
 * Input:  scripts/surgisuite/source-design/globals.css (byte-exact copy of the source src/app/globals.css; set
 *         SURGISUITE_REFERENCE_ROOT to the source `src` to compare against the original) and the utilities used by
 *         packages/reference-surgisuite/src (Tailwind scans it with an explicit @source; nothing else is scanned).
 * Tooling: the repository's own tailwindcss/@tailwindcss/postcss 4.x and postcss; postcss-selector-parser is resolved from
 *         SURGISUITE_STYLE_TOOL (a package.json path), else scripts/diagnostics/style-tools, else the quality source's node_modules.
 *
 * Same pipeline as scripts/surgisuite/styles.mjs and scripts/quality/styles.mjs (kept separate: each is bound to its package):
 *  - every selector starts with `.reference-surgisuite` (or `[data-reduced-motion="true"] .reference-surgisuite`); html/body/:root
 *    become the scope, `:focus-visible` / `::selection` are scoped, the source's `html, body { height: 100% }` is dropped
 *  - Tailwind preflight sits under `:where(.reference-surgisuite)` at zero specificity, so host and shared component classes win ties
 *  - cascade layers are flattened, `@property` registrations become scoped initial values for the --tw-* variables
 *  - keyframes (rise, fade, slide-in) are prefixed `surgisuite-`, so they cannot collide with host animations
 *  - the source @theme palette, font stacks and monospace stack are KEPT EXACTLY (the reference skin is the default). The host
 *    theme tokens (--bg/--surface/--text/--border/--primary) re-express canvas, paper, ink, lines and the scrub family only under
 *    `[data-surgisuite-palette="host"]`, which the module sets when the user/tenant chose a non-default theme; the host font
 *    (--font-ui) applies only under `[data-surgisuite-font="host"]` (a non-default font preference)
 *  - utilities carry the scope class twice, so shared host rules such as `.library-preferences .rounded-lg { border-radius: var(--radius) }`
 *    cannot flatten the source geometry (radii, sizes) by specificity; preflight stays at zero specificity
 *  - font sizes multiply the host --fs-scale, radii follow the host --radius (source look at the default 14px; the full-pill
 *    wristband radius is a shape, not a corner, and is kept); the module root is the source body: 14px type, ink, steel
 *  - shared managed Table defaults (row padding, nowrap/ellipsis) are returned to the source cell classes while the table
 *    presentation preferences are at their defaults (`[data-surgisuite-table="reference"]`); a non-default density/wrap applies as managed
 *  - the source's `prefers-reduced-motion` media block is replaced by the host reduced-motion preference
 */
import {createRequire} from 'node:module';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const variant=process.env.REFERENCE_STYLE_VARIANT??'surgisuite';
if(!['surgisuite','medslot'].includes(variant))throw Error('Unknown reference style variant');
const design = resolve(root,'scripts',variant,'source-design/globals.css');
const reference = process.env.SURGISUITE_REFERENCE_ROOT && resolve(process.env.SURGISUITE_REFERENCE_ROOT, 'app/globals.css');
if (reference && existsSync(reference) && readFileSync(reference, 'utf8') !== readFileSync(design, 'utf8')) throw new Error('source-design/globals.css differs from the reference source; re-copy it deliberately');

const toolRequire = candidates => {
  for (const c of candidates.filter(Boolean)) { try { const r = createRequire(c); r.resolve('postcss-selector-parser'); return r; } catch { /* next */ } }
  throw new Error('postcss-selector-parser not found. Install scripts/diagnostics/style-tools or set SURGISUITE_STYLE_TOOL.');
};
const require = toolRequire([process.env.SURGISUITE_STYLE_TOOL, resolve(root, 'scripts/diagnostics/style-tools/package.json'), '/home/pepadmin/pb/saas/reference/frontend/allyvora-quality/allyvora-quality/web/package.json']);
const selectorParser = require('postcss-selector-parser');
const rootRequire = createRequire(resolve(root, 'package.json'));
const postcss = rootRequire('postcss'), tailwind = rootRequire('@tailwindcss/postcss');
if (!/^4\./.test(rootRequire('tailwindcss/package.json').version)) throw new Error('Tailwind 4 is required to reproduce the source design');

const SCOPE = 'reference-'+variant;
const S = '.' + SCOPE;
/** Source @theme color -> host token expression. The source hex is the fallback, so the module is complete without a host. */
const HOST_COLOR = {
  '--color-ink': 'var(--text,#15232b)',
  '--color-ink-soft': 'var(--text-muted,#46575f)',
  '--color-ink-faint': 'var(--text-subtle,#7f8e95)',
  '--color-canvas': 'var(--bg,#e9eeec)',
  '--color-paper': 'var(--surface,#ffffff)',
  '--color-line': 'var(--border,#d5dedb)',
  '--color-line-soft': 'color-mix(in srgb,var(--border,#d5dedb) 60%,var(--surface,#ffffff))',
  '--color-scrub-50': 'var(--primary-soft,#eaf3f4)',
  '--color-scrub-100': 'color-mix(in srgb,var(--primary,#1f7a8c) 22%,var(--surface,#ffffff))',
  '--color-scrub-200': 'color-mix(in srgb,var(--primary,#1f7a8c) 40%,var(--surface,#ffffff))',
  '--color-scrub-400': 'var(--primary-fill,#3f98a8)',
  '--color-scrub-500': 'var(--primary,#1f7a8c)',
  '--color-scrub-600': 'var(--primary-strong,#13616f)',
  '--color-scrub-700': 'color-mix(in srgb,var(--primary-strong,#0e4c58) 88%,black)',
  '--color-scrub-800': 'color-mix(in srgb,var(--primary-strong,#0b3943) 72%,black)',
  '--color-scrub-900': 'color-mix(in srgb,var(--primary-strong,#082a31) 55%,black)',
};

const original = readFileSync(design, 'utf8').replace(/^@import url\([^\n]+\);/gm,'');

// 0. Remove everything that cannot be emitted as is (the document-height rule, the OS reduced-motion block), read the keyframe names.
const source = postcss.parse(original);
source.walkAtRules('media', rule => { if (/prefers-reduced-motion/.test(rule.params)) rule.remove(); });
source.walkRules(rule => { if (/^html,\s*body$/.test(rule.selector.trim())) rule.walkDecls('height', d => d.remove()); });
const stripped = source.toString();
if (/^\s*html,\s*body\s*\{\s*height/m.test(stripped)) throw new Error('html/body height rule was not removed');

const input = stripped
  .replace('@import "tailwindcss";', `@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@source "../../packages/reference-${variant}/src";
@source not "../../packages/reference-${variant}/src/**/*.test.{ts,tsx}";
@source not "../../packages/reference-${variant}/src/test-*.{ts,tsx}";`)
  ;
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

// 2. Flatten cascade layers in LAYER order (theme, base, components, utilities), then unlayered rules, as the cascade resolves them.
// (The source's own `@layer base`/`components` blocks come after the utilities in the compiled file; keeping file order would let
// the base `:focus-visible { border-radius: 6px }` beat `rounded-lg`, which the original never does.)
const buckets = {theme: [], base: [], components: [], utilities: []}, unlayered = [], banner = [];
for (const node of css.nodes) {
  if (node.type === 'atrule' && node.name === 'layer' && node.nodes) { (buckets[node.params] ?? (buckets[node.params] = [])).push(...node.nodes); continue; }
  if (node.type === 'atrule' && node.name === 'layer') continue;
  (node.type === 'comment' ? banner : unlayered).push(node);
}
css.removeAll();
for (const node of [...banner, ...Object.values(buckets).flat(), ...unlayered]) { const copy = node.clone(); copy.raws.before = '\n'; css.append(copy); }

// 2b. Remember the source cell geometry as custom properties, so the shared managed Table defaults (padding-block, nowrap, max-width,
// all !important or element-level) can be handed back to the source cell classes while the table preferences are at their defaults.
const CELL = {'padding-top': ['pt'], 'padding-bottom': ['pb'], 'padding-block': ['pt', 'pb'], 'white-space': ['ws'], 'max-width': ['mw']};
css.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
  const bare = rule.selector.trim().replace(/\\./g, '_'); // a single class utility: no combinator, list, pseudo or attribute
  if (!/^\.[\w-]+$/.test(bare)) return;
  for (const decl of [...rule.nodes ?? []].filter(n => n.type === 'decl' && CELL[n.prop])) for (const key of CELL[decl.prop]) rule.append({prop: `--surgisuite-cell-${key}`, value: decl.value});
  const shorthand = rule.nodes?.find(n => n.type === 'decl' && n.prop === 'padding');
  if (shorthand) { rule.append({prop: '--surgisuite-cell-pt', value: shorthand.value}); rule.append({prop: '--surgisuite-cell-pb', value: shorthand.value}); }
});

// 3. Scope selectors. Preflight (element selectors, the universal rule) is zero specificity.
const frames = new Map();
css.walkAtRules(/keyframes$/, rule => { frames.set(rule.params, `surgisuite-${rule.params}`); rule.params = `surgisuite-${rule.params}`; });
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
    if (v !== null && v > 0 && v < 999) decl.value = `calc(var(--radius, 14px) * ${v} / 14)`;
  }
});
// The source's 13px data sizing follows the managed result scale (the shared Table sets --fs-scale).
css.walkDecls('font-size', decl => { if (/^13px$/.test(decl.value)) decl.value = 'calc(13px * var(--fs-scale, 1))'; });

// 5. Scope defaults, preferences and the scoped initial values.
const hostPalette = Object.entries({'--color-steel':'var(--bg)','--color-steel-2':'var(--surface-alt)','--color-surface':'var(--surface)','--color-ink':'var(--text)','--color-muted':'var(--muted)','--color-line':'var(--border)','--color-ceil':'var(--primary)','--color-ceil-2':'var(--primary-strong)'}).map(([name, value]) => `${name}:${value}`).join(';');
const extra = `
${S}{min-width:0;width:100%;--fs-scale:var(--fs-shell, 1);font-size:calc(14px * var(--fs-scale, 1));color:var(--color-ink);background:var(--color-steel)}
${S}[data-surgisuite-palette="host"]{${hostPalette}}
${S}[data-surgisuite-font="host"]{--font-sans:var(--font-ui, "IBM Plex Sans"), "IBM Plex Sans", "Segoe UI", ui-sans-serif, system-ui, -apple-system, sans-serif}
${S}[data-surgisuite-table="reference"] table[data-managed-table="true"] > :is(thead, tbody, tfoot) > tr > :is(th, td){padding-top:var(--surgisuite-cell-pt, 0px)!important;padding-bottom:var(--surgisuite-cell-pb, 0px)!important;white-space:var(--surgisuite-cell-ws, normal)!important;max-width:var(--surgisuite-cell-mw, none);overflow:visible;text-overflow:clip}
${S}[data-overlay]{width:auto;min-width:0;background:transparent;color:inherit}
${S} input,${S} select,${S} textarea{--fs-scale:var(--fs-form, 1)}
${S} table{--fs-scale:var(--fs-result, 1);--surgisuite-cell-pt:initial;--surgisuite-cell-pb:initial;--surgisuite-cell-mw:initial}
[data-reduced-motion="true"] ${S} *,[data-reduced-motion="true"] ${S} *::before,[data-reduced-motion="true"] ${S} *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
`;
const initialRule = initials.length
  ? `:where(${S}) *,:where(${S}) ::before,:where(${S}) ::after,:where(${S}) ::backdrop{${initials.map(([name, value]) => `${name}:${value}`).join(';')}}\n`
  : '';
let output = '/* Generated by scripts/surgisuite/styles.mjs from the original SurgiSuite Tailwind 4 design. Do not edit. */\n'
  + css.toString().replace(/^\/\*![^]*?\*\/\n?/, '') + '\n' + initialRule + extra;

output=output.replaceAll('surgisuite',variant);
if(variant==='medslot') output=output.replace('original SurgiSuite','original MedSlot');
if(variant==='medslot') output+=`\n${S}{background:var(--color-paper);font-family:var(--font-sans);--fs-scale:var(--fs-shell,1)}\n${S}[data-medslot-palette="host"]{--color-paper:var(--bg);--color-panel:var(--surface);--color-ink:var(--text);--color-ink-2:var(--text);--color-mute:var(--muted);--color-line:var(--border);--color-line-2:var(--surface-alt);--color-scrub:var(--primary);--color-scrub-dark:var(--primary-strong)}\n${S}[data-medslot-font="host"]{--font-sans:var(--font-ui)}\n`;
const out=resolve(root,'packages/reference-'+variant+'/src/styles.css');
if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== output) { console.error('styles.css is stale: run node scripts/surgisuite/styles.mjs'); process.exit(1); }
  console.log('styles.css is current');
} else { writeFileSync(out, output); console.log(`${variant} styles generated (${output.length} bytes)`); }
