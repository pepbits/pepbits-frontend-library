/**
 * Generates src/styles.css for @pepbits/reference-teleconsult from the two ORIGINAL Tailwind 3 designs
 * (clinician and patient). Run from desktop-clients with Node 24:
 *
 *   node scripts/teleconsult/styles.mjs
 *
 * Input: scripts/teleconsult/source-design/{clinician,patient}/{tailwind.config.ts,app/globals.css} (retained byte-exact);
 * set TELECONSULT_REFERENCE_ROOT to the original reference tree to regenerate from it instead.
 *
 * Tooling: tailwindcss 3.4.x, postcss and postcss-selector-parser are resolved from
 * TELECONSULT_STYLE_TOOL (a package.json path), else scripts/diagnostics/style-tools, else the source
 * reference's own node_modules (read only). The repository root keeps Tailwind 4; this never touches it.
 *
 * Isolation rules enforced here (and asserted by packages/reference-teleconsult/src/styles.test.ts):
 *  - every selector is scoped to .teleconsult-provider / .teleconsult-patient; html/body/:root become the scope
 *  - Tailwind preflight element selectors sit inside :where() under the scope class, so they never out-rank host or
 *    shared component classes of equal weight; every selector still starts with the scope (verify-parity enforces it)
 *  - keyframes are prefixed per variant, so `spin`/`pulse`/`rise` cannot collide with host animations
 *  - font sizes read the host font scale (--fs-scale), radii read the host --radius, fonts read --font-ui
 *  - provider neutrals (ink/canvas/line) resolve to host theme tokens; the accent palette keeps source colors
 *  - the patient design stays an isolated light palette (CareCall brand), and says so in its scope rule
 */
import {createRequire} from 'node:module';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '../..');
// Default input: the retained byte-exact copies of the original Tailwind configs and global CSS in ./source-design.
// TELECONSULT_REFERENCE_ROOT points at the original reference tree (reference/frontend/teleconsult-01/teleconsult) to compare against it.
const source = process.env.TELECONSULT_REFERENCE_ROOT ?? resolve(import.meta.dirname, 'source-design');

function toolRequire() {
  const candidates = [process.env.TELECONSULT_STYLE_TOOL, resolve(root, 'scripts/diagnostics/style-tools/package.json'), resolve(source, 'clinician/package.json')].filter(Boolean);
  for (const candidate of candidates) {
    try { const r = createRequire(candidate); r.resolve('tailwindcss/package.json'); r.resolve('postcss'); r.resolve('postcss-selector-parser'); return r; } catch { /* try next */ }
  }
  throw new Error('Tailwind 3 tooling not found. Install scripts/diagnostics/style-tools or set TELECONSULT_STYLE_TOOL.');
}
const require = toolRequire();
const postcss = require('postcss'), tailwind = require('tailwindcss'), selectorParser = require('postcss-selector-parser');
if (!/^3\./.test(require('tailwindcss/package.json').version)) throw new Error('Tailwind 3 is required to reproduce the source designs');

const loadConfig = file => {
  const out = ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
  const holder = {exports: {}};
  new Function('module', 'exports', out)(holder, holder.exports);
  return holder.exports.default ?? holder.exports;
};

/** A color that follows a host theme token and still supports Tailwind opacity modifiers. */
const token = name => ({opacityValue}) => opacityValue === undefined ? `var(--${name})` : `color-mix(in srgb, var(--${name}) calc(${opacityValue} * 100%), transparent)`;

const VARIANTS = [
  {
    key: 'provider', scope: '.teleconsult-provider', folder: 'clinician', css: 'app/globals.css', dirs: ['provider', 'shared'],
    // Neutrals follow the effective host theme; teal/red/amber/green accents and the monitor palette stay source colors.
    themed: config => {
      const colors = config.theme.extend.colors;
      colors.ink = {...colors.ink, DEFAULT: token('text'), 700: token('text'), 600: token('text-muted'), 400: token('text-subtle')};
      colors.canvas = token('bg');
      colors.line = token('border');
    },
    root: `font-family:var(--font-ui,inherit);color:var(--text);background:var(--bg);`,
    // Panels drawn as bg-white follow the theme surface, like every other reference module.
    whiteSurface: true,
  },
  {
    key: 'patient', scope: '.teleconsult-patient', folder: 'patient', css: 'app/globals.css', dirs: ['patient', 'shared'],
    themed: () => {},
    // CareCall is an isolated light brand palette inside its phone column; theme tokens do not recolor it.
    root: `font-family:var(--font-ui,inherit);color:#1F2A2E;background:#DCEBE6;-webkit-tap-highlight-color:transparent;`,
    // The whole module is bounded by the height the host leaves under its header and above its footer (and the content
    // padding), never by a fixed phone height. The phone fills what is left (flex 1, min-height 0) and does not scroll
    // itself: it is the transform context that holds the source's fixed bottom navigation, action bars and call overlay,
    // while .tc-phone-scroll is the scroller. Fixed children therefore stay in place instead of scrolling away.
    extra: `.teleconsult-patient{display:flex;flex-direction:column;min-height:0;flex:1 1 0;height:auto}
.teleconsult-patient .tc-phone{position:relative;display:flex;flex-direction:column;flex:1 1 0;min-height:0;max-height:56rem;overflow:hidden;transform:translateZ(0);border-radius:var(--radius,14px);color:#1F2A2E}
.teleconsult-patient .tc-phone-scroll{display:flex;flex-direction:column;flex:1 1 0;min-height:0;overflow-y:auto}`,
  },
];

const RADIUS_PROP = /^(?:border(?:-(?:top|bottom)-(?:left|right)|-(?:start|end)-(?:start|end))?-radius)$/;
const rewriteRadius = value => value.replace(/(-?\d*\.?\d+)(rem|px)\b/g, (whole, n, unit) => {
  const px = Number(n) * (unit === 'rem' ? 16 : 1);
  if (px === 0 || px >= 9999) return whole; // 0 and pill/full stay as drawn
  return `calc(var(--radius, 14px) * ${+(px / 14).toFixed(4)})`;
});
const rewriteFont = value => value.replace(/^(-?\d*\.?\d+(?:rem|px))$/, 'calc($1 * var(--fs-scale, 1))');

function scopeRules(rootNode, variant, mode, names) {
  const {scope} = variant;
  rootNode.walkAtRules(/keyframes$/, rule => { if (!names.has(rule.params)) names.set(rule.params, `tc-${variant.key}-${rule.params}`); rule.params = names.get(rule.params); });
  rootNode.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    // Rules whose result must beat host rules of equal weight (.bg-white, .text-*, .rounded-*) get a doubled scope class.
    const wins = mode === 'plain' && (rule.selector === '.bg-white' || rule.nodes?.some(d => d.type === 'decl' && (d.prop === 'font-size' || RADIUS_PROP.test(d.prop))));
    const cls = scope.slice(1);
    rule.selector = selectorParser(selectors => {
      selectors.each(selector => {
        const first = selector.nodes[0];
        const rootish = first && ((first.type === 'tag' && ['html', 'body'].includes(first.value)) || (first.type === 'pseudo' && first.value === ':root'));
        if (rootish) { first.replaceWith(selectorParser.className({value: cls})); if (wins) selector.prepend(selectorParser.className({value: cls})); return; }
        const text = selector.toString().trim();
        // Preflight keeps its element selectors at zero extra weight (.scope :where(button)), so host and shared
        // component classes of equal weight win; pseudo-elements cannot sit inside :where() and stay plain.
        const inner = mode === 'where' && !text.includes('::') ? selectorParser().astSync(`:where(${text})`).first : selector;
        if (inner !== selector) selector.empty().append(...inner.nodes.map(n => n.clone()));
        selector.prepend(selectorParser.combinator({value: ' '}));
        selector.prepend(selectorParser.className({value: cls}));
        if (wins) selector.prepend(selectorParser.className({value: cls}));
      });
    }).processSync(rule.selector);
  });
  if (variant.whiteSurface) rootNode.walkRules('.' + 'teleconsult-provider.teleconsult-provider .bg-white', rule => { rule.removeAll(); rule.append({prop: 'background-color', value: 'var(--surface)'}); });
  rootNode.walkDecls(decl => {
    if (decl.prop.startsWith('animation')) for (const [from, to] of names) decl.value = decl.value.replace(new RegExp(`(^|[\\s,])${from}(?=[\\s,;]|$)`, 'g'), `$1${to}`);
    if (RADIUS_PROP.test(decl.prop)) decl.value = rewriteRadius(decl.value);
    if (decl.prop === 'font-size') decl.value = rewriteFont(decl.value);
  });
  rootNode.walkRules(rule => { if (!rule.nodes.length) rule.remove(); });
}

const chunks = ['/* Generated by scripts/teleconsult/styles.mjs from the original Tailwind 3 designs. Do not edit. */'];
for (const variant of VARIANTS) {
  const config = loadConfig(resolve(source, variant.folder, 'tailwind.config.ts'));
  config.content = variant.dirs.map(dir => resolve(root, 'packages/reference-teleconsult/src', dir, '**/*.{ts,tsx}'));
  config.theme.extend.fontFamily = {sans: ['var(--font-ui)', ...config.theme.extend.fontFamily.sans]};
  variant.themed(config);
  // The source stylesheet minus its html/body height reset: the host owns page height.
  const original = readFileSync(resolve(source, variant.folder, variant.css), 'utf8').replace(/html,\s*body\s*\{\s*height:\s*100%;\s*\}/, '');
  const names = new Map();
  const base = await postcss([tailwind(config)]).process('@tailwind base;', {from: undefined});
  const rest = await postcss([tailwind(config)]).process(original.replace('@tailwind base;', ''), {from: undefined});
  scopeRules(base.root, variant, 'where', names);
  scopeRules(rest.root, variant, 'plain', names);
  const s = variant.scope;
  const preferences = `
${s}{min-width:0;width:100%;${variant.root}font-size:calc(16px * var(--fs-scale,1));line-height:1.5;}
${s}[data-density="compact"]{line-height:1.35}
${s}[data-density="spacious"]{line-height:1.65}
${s} input,${s} select,${s} textarea{--fs-scale:var(--fs-form,1)}
${variant.extra ?? ''}
[data-reduced-motion="true"] ${s} *,[data-reduced-motion="true"] ${s} *::before,[data-reduced-motion="true"] ${s} *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
`;
  chunks.push(`/* ---- ${variant.key} (${s}) ---- */\n${base.root.toString()}\n${rest.root.toString()}\n${preferences}`);
  console.log(variant.key, 'scoped styles generated');
}
const output = chunks.join('\n');
const out = resolve(root, 'packages/reference-teleconsult/src/styles.css');
if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== output) { console.error('styles.css is stale: run node scripts/teleconsult/styles.mjs'); process.exit(1); }
  console.log('styles.css is current');
} else writeFileSync(out, output);
