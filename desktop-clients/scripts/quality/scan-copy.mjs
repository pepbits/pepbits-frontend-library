/**
 * Lists string/template literals in @pepbits/reference-quality that look like human copy but do not reach the
 * localization boundary (LocalizedText message, t(), Source* label props, ui.tsx Copy props, toast keys).
 *
 *   node scripts/quality/scan-copy.mjs [--json]
 *
 * It is a review aid for the hand-adaptation pass and a regression gate (copy.test.ts runs it): the allowlist
 * in scan-copy.allow.json names the literals that are intentionally not copy (CSS values, API identifiers, enum codes).
 */
import ts from 'typescript';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const base = join(root, 'packages/reference-quality/src');
const allowFile = join(import.meta.dirname, 'scan-copy.allow.json');
const allow = existsSync(allowFile) ? JSON.parse(readFileSync(allowFile, 'utf8')) : {};
const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const IGNORE_ATTR = new Set(['className', 'key', 'href', 'type', 'id', 'name', 'htmlFor', 'role', 'style', 'tone', 'variant', 'size', 'value', 'target', 'rel', 'width', 'height', 'viewBox', 'd', 'fill', 'stroke', 'stroke-width', 'strokeDasharray', 'dataKey', 'xKey', 'color', 'icon', 'bodyClassName', 'as', 'step', 'min', 'max', 'autoComplete', 'inputMode', 'aria-current', 'aria-haspopup', 'aria-busy', 'aria-selected', 'aria-live', 'data-quality-toolbar', 'iconType', 'position', 'interval', 'tickLine', 'axisLine', 'domain', 'barCategoryGap', 'content', 'src', 'alt',
  // Props that ui.tsx / ops-ui / Source* localize themselves (Copy, SourceInput placeholder, Modal title, ...).
  'title', 'description', 'subtitle', 'label', 'hint', 'placeholder', 'aria-label', 'sub', 'meta', 'confirmLabel', 'message', 'emptyMessage', 'error']);
const COPY = /[A-Za-z]{2,}/;
const out = [];
for (const file of walk(base).filter(f => /\.tsx?$/.test(f) && !/\.test\./.test(f))) {
  const rel = file.slice(base.length + 1);
  if (rel.startsWith('lib/') && !rel.startsWith('lib/auth')) continue;
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = node => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) && !ts.isImportDeclaration(node.parent) && !ts.isExternalModuleReference(node.parent) && !(ts.isLiteralTypeNode(node.parent)) && !ts.isTypeNode(node.parent)) {
      const text = ts.isTemplateExpression(node) ? node.head.text + node.templateSpans.map(s => '{}' + s.literal.text).join('') : node.text;
      if (COPY.test(text) && /(^[A-Z])|[A-Za-z]+ [A-Za-z]+|[.?!…:]$/.test(text.trim())) {
        const p = node.parent;
        let skip = false;
        if (ts.isJsxAttribute(p) && IGNORE_ATTR.has(p.name.getText(sf))) skip = true;
        if (ts.isJsxAttribute(p) && p.name.getText(sf) === 'message') skip = true;           // LocalizedText message
        if (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent) && IGNORE_ATTR.has(p.parent.name.getText(sf))) skip = true;
        if (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent) && p.parent.name.getText(sf) === 'message') skip = true;
        if (ts.isCallExpression(p) && ['t', 'cls', 'api', 'download', 'toast', 'withQuery', 'useApi', 'matchRoute', 'useState', 'set', 'get', 'has', 'delete', 'createContext', 'require', 'push', 'replace', 'includes', 'startsWith', 'endsWith', 'split', 'join', 'Number', 'String', 'JSON', 'padStart', 'localeCompare', 'toLocaleString', 'getElementById', 'querySelector', 'addEventListener', 'removeEventListener', 'setAttribute', 'append', 'Error'].includes(p.expression.getText(sf).split('.').pop())) skip = true;
        for (let a = p; a && !ts.isSourceFile(a) && !ts.isBlock(a); a = a.parent) if (ts.isCallExpression(a) && /^(toast|t|referenceT|confirm)$/.test(a.expression.getText(sf).split('.').pop())) skip = true;
        if (/^(GET|PUT|POST|PATCH|DELETE|STAT|SFTP|API|JAWDA|BOARD|DOH|Asia\/Dubai)$/.test(text.trim())) skip = true;
        if (/className|cls\(/.test(p.getText(sf).slice(0, 14)) ) skip = true;
        let q = p; while (q && !ts.isSourceFile(q)) { if (ts.isJsxAttribute(q) && /^(className|style|d)$/.test(q.name.getText(sf))) skip = true; q = q.parent; }
        if (/^[a-z0-9_.:\/\-\[\]#%, ()'"*@+=>~&|^$!?<]+$/.test(text) && !/ [a-z]+ [a-z]+/.test(text)) skip = true;
        const key = `${rel}: ${text.trim().slice(0, 90)}`;
        if (!skip && !allow[key]) out.push(`${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: ${JSON.stringify(text.trim().slice(0, 110))}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2)); else console.log(out.join('\n') + `\n${out.length} candidate literals`);
process.exitCode = out.length && process.argv.includes('--fail') ? 1 : 0;
