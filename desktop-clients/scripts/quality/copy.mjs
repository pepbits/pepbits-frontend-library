/**
 * English copy inventory for @pepbits/reference-quality.
 *
 *   node scripts/quality/copy.mjs [--check]
 *
 * Writes packages/reference-quality/quality-copy.json: a flat map of every English literal this package renders through the
 * localization boundary (<LocalizedText message>, t()/tr(), toast(), Source controls and ui.tsx copy props, labelled constants) to a stable
 * catalog key `quality.<words>.<hash8>`. It lives outside the canonical catalogs (dummy-api/config/localization/shared/*.json):
 * the host merges it, translators fill ar/hi/ml, and `npm run localization:sync` regenerates the fallbacks there. Until a literal
 * is in the catalogs, t() returns the English text, so the module is safe before the merge.
 *
 * Placeholders are {value0}, {value1}... filled by position; keep them in translations. Values (names, codes, dates, numbers)
 * are never translated. Server-supplied labels (facility, indicator, report names, API error messages) pass through t() unchanged
 * unless the catalogs know them.
 */
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const pkg = resolve(import.meta.dirname, '../../packages/reference-quality');
const out = join(pkg, 'quality-copy.json');
const messages = new Set();
/** Props whose string value is copy because ui.tsx, ops-ui or the Source* controls localize them. */
const COPY_PROPS = new Set(['title', 'description', 'subtitle', 'label', 'hint', 'placeholder', 'aria-label', 'sub', 'meta', 'confirmLabel', 'message', 'emptyMessage', 'selectedLabel', 'name']);
/** Object keys carrying copy in constants (labelled lists, status maps). `name` only counts in series/bars definitions below. */
const COPY_KEYS = new Set(['label', 'description', 'title', 'group', 'selectedLabel', 'short', 'message']);
/** Whole-map constants whose every string value is copy. */
const COPY_MAPS = new Set(['CHANNEL', 'DAYS', 'PERIOD_RULE', 'STATUS_LABEL', 'ROLE_LABEL', 'GREETING']);
const human = text => /[A-Za-z]{2,}/.test(text) && !/^[a-z0-9]+(-[a-z0-9]+)+$/.test(text) && !/^[a-z]+_[a-z_]+$/.test(text);
const add = text => { const t = text.trim(); if (t && /[A-Za-z]/.test(t)) messages.add(t); };
const literal = node => {
  if (!node) return;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text);
  else if (ts.isConditionalExpression(node)) { literal(node.whenTrue); literal(node.whenFalse); }
  else if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) literal(node.expression);
  else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)) { literal(node.left); literal(node.right); }
};
const objectValues = node => { if (ts.isAsExpression(node)) node = node.expression; if (ts.isObjectLiteralExpression(node)) node.properties.forEach(p => { if (ts.isPropertyAssignment(p)) literal(p.initializer); }); };
const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);

for (const file of walk(join(pkg, 'src')).filter(f => /\.tsx?$/.test(f) && !/\.test\.|\/test-[\w-]+\.tsx?$/.test(f))) {
  const rel = file.slice(pkg.length + 1);
  if (/lib\/(api|navigation|hooks|types)\.ts$/.test(rel)) { /* identifiers only, except the transport's user-facing fallbacks */ }
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = node => {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      const tag = ts.isJsxOpeningElement(node.parent.parent) || ts.isJsxSelfClosingElement(node.parent.parent) ? node.parent.parent.tagName.getText(sf) : '';
      if (COPY_PROPS.has(name) && !(name === 'name' && !/^(Line|Bar)$/.test(tag)) && node.initializer) literal(ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer);
    }
    if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText(sf).replace(/^['"]|['"]$/g, '');
      if (COPY_KEYS.has(key)) literal(node.initializer);
      if (key === 'name' && ts.isObjectLiteralExpression(node.parent) && node.parent.properties.some(p => p.name?.getText(sf) === 'values')) literal(node.initializer); // chart series
      if (key === 'name' && ts.isObjectLiteralExpression(node.parent) && node.parent.properties.some(p => p.name?.getText(sf) === 'key')) literal(node.initializer); // chart bars
      if (key === 'title' || key === 'label') literal(node.initializer);
    }
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(sf).split('.').pop();
      if (['t', 'tr', 'translate', 'toast', 'confirm'].includes(name)) literal(node.arguments[0]);
    }
    // {...}[key] lookup tables rendered as copy
    if (ts.isElementAccessExpression(node)) objectValues(ts.isParenthesizedExpression(node.expression) ? node.expression.expression : node.expression);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && COPY_MAPS.has(node.name.text) && node.initializer) {
      let init = node.initializer; if (ts.isAsExpression(init)) init = init.expression;
      if (ts.isArrayLiteralExpression(init)) init.elements.forEach(literal); else objectValues(init);
    }
    // Tab / queue / step lists: { id, label } handled by COPY_KEYS. Status-label records inside functions:
    if (ts.isJsxExpression(node) && node.parent && ts.isJsxElement(node.parent)) { /* children expressions with literal fallbacks */ if (node.expression && (ts.isConditionalExpression(node.expression) || ts.isBinaryExpression(node.expression))) literal(node.expression); }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
// Route titles and sidebar copy live in routes.ts and are caught by the `title`/`description`/`group` keys above.
// Drop things that are plainly not copy (class lists, identifiers) that the broad key rules can pick up.
const keep = [...messages].filter(m => human(m) && !/^(bg|text|border|rounded|px|py|flex|grid|size)-/.test(m) && !/^[A-Za-z]+\/[A-Za-z]+$/.test(m)).sort((a, b) => a.localeCompare(b, 'en'));
const keyOf = message => {
  const slug = message.toLowerCase().replace(/\{value\d+\}/g, ' ').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').split('.').filter(Boolean).slice(0, 6).join('.') || 'text';
  return `quality.${slug}.${createHash('sha256').update(message).digest('hex').slice(0, 8)}`;
};
const map = Object.fromEntries(keep.map(m => [m, keyOf(m)]));
const text = JSON.stringify(map, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== text) { console.error('quality-copy.json is stale: run node scripts/quality/copy.mjs'); process.exit(1); }
  console.log(`quality-copy.json is current (${keep.length} messages)`);
} else { writeFileSync(out, text); console.log(`Quality: ${keep.length} English strings written to quality-copy.json`); }
