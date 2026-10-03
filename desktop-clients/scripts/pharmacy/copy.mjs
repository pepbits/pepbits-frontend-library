/**
 * English copy inventory for @pepbits/reference-pharmacy.
 *
 *   node scripts/pharmacy/copy.mjs [--check]
 *
 * Writes packages/reference-pharmacy/pharmacy-copy.json: a flat map of every English literal this package renders through the
 * localization boundary (<LocalizedText message>, t(), toast titles/bodies, Source controls, ui primitives' copy props,
 * labelled constants such as the status vocabulary) to a stable catalog key `ui.reference.pharmacy.copy.<words>.<hash8>`.
 * The map lives outside the canonical catalogs (dummy-api/config/localization/shared/*.json): the host merges it, translators fill
 * ar/hi/ml, and `npm run localization:sync` regenerates the fallbacks there. Until a literal is in the catalogs, t() returns the English
 * text, so the module is safe before the merge. The module installs the map as a LocalizationAliasProvider (text -> key).
 *
 * Where the canonical English catalog already holds the identical text under a generic `ui.<words>.<hash8>` key (for example
 * `ui.cancel.19766ed6`), that key is reused instead of minting a duplicate; the module's own earlier keys are never candidates, so
 * the output does not change once the catalogs contain them. Placeholders are {value0}, {value1}... filled by position; keep them
 * in translations. Values (names, codes, dates, amounts) are never translated. Server-supplied text passes through t() unchanged.
 */
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const pkg = join(root, 'packages/reference-pharmacy');
const out = join(pkg, 'pharmacy-copy.json');
const catalog = process.env.PHARMACY_EN_CATALOG ?? resolve(root, '../dummy-api/config/localization/shared/en.json');
const messages = new Set();
/** JSX props whose string value is copy because the ui primitives, ops-ui or the Source* controls localize them. */
const COPY_PROPS = new Set(['title', 'description', 'subtitle', 'label', 'hint', 'placeholder', 'aria-label', 'sub', 'body', 'confirm', 'confirmLabel', 'message', 'emptyMessage', 'alt']);
/** JSX props holding an array of copy strings (reason presets). */
const ARRAY_PROPS = new Set(['presets']);
/** Object keys carrying copy in constants (labelled lists, status maps, toast({title, body})). */
const COPY_KEYS = new Set(['label', 'description', 'title', 'group', 'short', 'message', 'sub', 'body', 'note', 'hint', 'presets']);
/** Whole-map constants whose every string value is copy. */
const COPY_MAPS = new Set(['ENTITY_LABEL', 'PLURAL_ONE', 'PLURAL_MANY', 'SYSTEM_ACTORS', 'TYPE_LABEL', 'FREQ', 'METHOD_LABEL', 'PRIORITY_LABEL', 'SOURCE_LABEL', 'CHANNEL_LABEL']);
const add = text => { const t = text.trim(); if (t && /[A-Za-z]/.test(t)) messages.add(t); };
const literal = node => {
  if (!node) return;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text);
  else if (ts.isConditionalExpression(node)) { literal(node.whenTrue); literal(node.whenFalse); }
  else if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) literal(node.expression);
  else if (ts.isArrayLiteralExpression(node)) node.elements.forEach(literal);
  else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)) { literal(node.left); literal(node.right); }
};
const objectValues = node => { if (ts.isAsExpression(node)) node = node.expression; if (ts.isObjectLiteralExpression(node)) node.properties.forEach(p => { if (ts.isPropertyAssignment(p)) literal(p.initializer); }); };
const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);

for (const file of walk(join(pkg, 'src')).filter(f => /\.tsx?$/.test(f) && !/\.test\.|\/test-[\w-]+\.tsx?$/.test(f))) {
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = node => {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      const init = node.initializer && (ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer);
      if ((COPY_PROPS.has(name) || ARRAY_PROPS.has(name)) && init) literal(init);
    }
    if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText(sf).replace(/^['"]|['"]$/g, '');
      if (COPY_KEYS.has(key)) literal(node.initializer);
    }
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(sf).split('.').pop();
      if (['t', 'tr', 'translate', 'toast'].includes(name)) literal(node.arguments[0]);
      // useAction().run(key, fn, success, body): the success title and body are copy (the key and server paths are not).
      if (name === 'run') node.arguments.slice(2).forEach(a => { if (!((ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && a.text.startsWith('/'))) literal(a); });
    }
    if (ts.isNewExpression(node) && node.expression.getText(sf) === 'ApiError') literal(node.arguments?.[2]); // transport fallbacks shown to the reader
    // {...}[key] lookup tables rendered as copy
    if (ts.isElementAccessExpression(node)) objectValues(ts.isParenthesizedExpression(node.expression) ? node.expression.expression : node.expression);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && COPY_MAPS.has(node.name.text) && node.initializer) {
      let init = node.initializer; if (ts.isAsExpression(init)) init = init.expression;
      if (ts.isArrayLiteralExpression(init)) init.elements.forEach(literal); else objectValues(init);
    }
    // {cond ? "A" : "B"} children and `&&` copy
    if (ts.isJsxExpression(node) && node.parent && ts.isJsxElement(node.parent) && node.expression && (ts.isConditionalExpression(node.expression) || ts.isBinaryExpression(node.expression))) literal(node.expression);
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
// Drop things that are plainly not copy (class lists, identifiers, urls, bare codes) that the broad key rules can pick up.
const NOT_COPY = /^(bg|text|border|rounded|px|py|flex|grid|size|ring|divide|space|gap|min|max|w|h|ml|mr|mt|mb)-|^[a-z]+(\.[a-z]+)+$|^\/|^[a-z]+:\/\/|^[\w-]+\.(png|svg|json)$/;
const keep = [...messages].filter(m => /[A-Za-z]{2,}/.test(m) && !NOT_COPY.test(m) && !/^[a-z0-9]+(-[a-z0-9]+)+$/.test(m) && !/^[a-z]+_[a-z_]+$/.test(m)).sort((a, b) => a.localeCompare(b, 'en'));

const hash = message => createHash('sha256').update(message).digest('hex').slice(0, 8);
const slugOf = message => message.toLowerCase().replace(/\{value\d+\}/g, ' ').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').split('.').filter(Boolean).slice(0, 6).join('.') || 'text';
/** Generic canonical keys `ui.<words>.<hash8>` whose catalog text is exactly the message: reused rather than duplicated. */
const canonical = new Map();
if (existsSync(catalog)) {
  const en = JSON.parse(readFileSync(catalog, 'utf8')).messages ?? {};
  for (const [key, value] of Object.entries(en)) {
    if (!/^ui\.[a-z0-9.]+\.[0-9a-f]{8}$/.test(key) || key.startsWith('ui.reference.')) continue;
    const known = canonical.get(value);
    if (!known || key < known) canonical.set(value, key);
  }
}
const keyOf = message => canonical.get(message) ?? `ui.reference.pharmacy.copy.${slugOf(message)}.${hash(message)}`;
const map = Object.fromEntries(keep.map(m => [m, keyOf(m)]));
const text = JSON.stringify(map, null, 2) + '\n';
const reused = keep.filter(m => canonical.has(m)).length;
if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== text) { console.error('pharmacy-copy.json is stale: run node scripts/pharmacy/copy.mjs'); process.exit(1); }
  console.log(`pharmacy-copy.json is current (${keep.length} messages, ${reused} reuse canonical ui.* keys)`);
} else { writeFileSync(out, text); console.log(`Pharmacy: ${keep.length} English strings written to pharmacy-copy.json (${reused} reuse canonical ui.* keys)`); }
