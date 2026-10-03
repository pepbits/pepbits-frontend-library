/**
 * English copy inventory for the host's canonical catalogs (dummy-api/config/localization/shared/*.json).
 *
 *   node scripts/teleconsult/localization-inventory.mjs
 *
 * Writes packages/reference-teleconsult/localization-inventory.en.json: every static string this package
 * renders through <LocalizedText/>, t()/tr() calls, Source* labels/placeholders and toasts. Translated
 * catalogs and the generated fallbacks stay owned by the host repository; run `npm run localization:sync`
 * there after adding these. Dynamic strings built from values at runtime are not inventoried.
 */
import ts from 'typescript';
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const pkg = resolve(import.meta.dirname, '../../packages/reference-teleconsult');
const messages = new Set();
const PROPS = new Set(['label', 'title', 'subtitle', 'placeholder', 'aria-label', 'message', 'hint', 'alt', 'description', 'sub', 'text', 'short', 'cls']);
const SKIP_PROPS = new Set(['cls', 'text']);
const add = value => { const text = value.trim(); if (/[A-Za-z]/.test(text) && !/^[#.\[\]a-z0-9_\-:/\s]+$/.test(text) || /^[A-Z]/.test(text)) messages.add(text); };
const literal = node => {
  if (!node) return;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text);
  if (ts.isConditionalExpression(node)) { literal(node.whenTrue); literal(node.whenFalse); }
  if (ts.isParenthesizedExpression(node)) literal(node.expression);
};
const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
for (const file of walk(join(pkg, 'src')).filter(f => /\.tsx?$/.test(f) && !/\.test\.|test-utils/.test(f))) {
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = node => {
    if (ts.isJsxAttribute(node) && PROPS.has(node.name.getText(sf)) && !SKIP_PROPS.has(node.name.getText(sf)) && node.initializer) literal(ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer);
    if (ts.isPropertyAssignment(node) && ['label', 'title', 'short', 'description', 'sub', 'hint'].includes(node.name.getText(sf))) literal(node.initializer);
    if (ts.isCallExpression(node) && ['toast', 't', 'tr'].includes(node.expression.getText(sf))) literal(node.arguments[0]);
    if (ts.isVariableDeclaration(node) && ['QUICK', 'STEPS', 'DURATIONS', 'RED_FLAGS', 'titles'].includes(node.name.getText(sf)) && node.initializer && ts.isArrayLiteralExpression(node.initializer)) node.initializer.elements.forEach(literal);
    if (ts.isVariableDeclaration(node) && node.name.getText(sf) === 'STATUS' && node.initializer && ts.isObjectLiteralExpression(node.initializer)) node.initializer.properties.forEach(p => { if (ts.isPropertyAssignment(p) && ts.isObjectLiteralExpression(p.initializer)) p.initializer.properties.forEach(q => { if (ts.isPropertyAssignment(q) && q.name.getText(sf) === 'label') literal(q.initializer); }); });
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
writeFileSync(join(pkg, 'localization-inventory.en.json'), JSON.stringify([...messages].sort(), null, 2) + '\n');
console.log(`Teleconsult: ${messages.size} English strings inventoried.`);
