/**
 * Review aid for the RCM port: lists what the repository gates would reject in packages/reference-rcm/src.
 *
 *   node scripts/rcm/scan.mjs [file ...]        (files relative to packages/reference-rcm/src; default: everything)
 *
 * Mirrors scripts/localization/check-copy.mjs (raw JSX copy, template literals in copy props), scripts/verify-shared-components.mjs
 * and scripts/verify-form-controls.mjs (raw table/select/textarea/checkbox/radio/file, Input type=date), and adds checks for the
 * RCM rules: no fixed locale formatting, no direct network, no source localStorage actor / session handling, no raw
 * <button>/<input>/<dialog> outside the shared controls. Exits 1 when anything is listed.
 */
import ts from 'typescript';
import {readFileSync, readdirSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';

const base = resolve(import.meta.dirname, '../../packages/reference-rcm/src');
const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const args = process.argv.slice(2);
const files = (args.length ? args.map(f => resolve(base, f)) : walk(base)).filter(f => /\.tsx?$/.test(f) && !/\.test\.|test-/.test(f));
const COPY_PROPS = new Set(['label', 'title', 'subtitle', 'description', 'placeholder', 'aria-label', 'alt', 'message', 'hint', 'confirmLabel', 'cancelLabel', 'emptyMessage', 'sub', 'note', 'body']);
const RAW = {button: 'SourceButton', input: 'SourceInput (SourceDateInput for dates)', select: 'SourceSelect', textarea: 'SourceTextarea', table: 'Table', thead: 'TableHeader', tbody: 'TableBody', tr: 'TableRow', th: 'TableHead / Th', td: 'TableCell / Td', dialog: 'Dialog / Modal / Drawer'};
const FIXED = /toLocale(Date|Time)?String|Intl\.(NumberFormat|DateTimeFormat)\(\s*["'](en|ar)|"en-(US|GB)"|localStorage|sessionStorage|fetch\(|x-actor-id|\/api\//;
const SHARED_HOME = /components\/ui\/(controls|primitives)\.tsx$/;
/** The command palette is a combobox/listbox overlay with no dialog chrome: the one specialised native <dialog>. */
const NATIVE_DIALOG = /components\/shell\/CommandPalette\.tsx$/;
const failures = [];
for (const file of files) {
  const rel = relative(base, file);
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const at = n => `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
  const fail = (n, msg) => failures.push(`${at(n)}: ${msg}`);
  const visit = node => {
    if (ts.isJsxText(node)) {
      const t = text.slice(node.pos, node.end).split(/\r?\n/).map(s => s.trim()).filter(Boolean).join(' ');
      if (/[A-Za-z]/.test(t)) fail(node, `raw JSX copy ${JSON.stringify(t.slice(0, 70))} (wrap in <LocalizedText message=... />)`);
    }
    if (ts.isJsxAttribute(node) && COPY_PROPS.has(node.name.getText(sf)) && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isTemplateExpression(node.initializer.expression)) {
      fail(node, `template literal in ${node.name.getText(sf)}: translate the whole message with t("... {value0}", { value0 })`);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      if (RAW[tag] && !SHARED_HOME.test(rel) && !(tag === 'dialog' && NATIVE_DIALOG.test(rel))) fail(node, `raw <${tag}>: use ${RAW[tag]}`);
      const type = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(sf) === 'type')?.initializer?.getText(sf) ?? '';
      if (tag === 'Input' && /date|time|month|week/.test(type)) fail(node, 'use DateInput for dates');
    }
    if (ts.isTemplateExpression(node) && node.parent && ts.isCallExpression(node.parent) && ['t'].includes(node.parent.expression.getText(sf))) fail(node, 't() needs a literal message with {value0} placeholders, not a template literal');
    ts.forEachChild(node, visit);
  };
  visit(sf);
  text.split('\n').forEach((line, i) => { if (FIXED.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) failures.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)} (fixed locale / direct network / local session)`); });
}
if (failures.length) { console.error(failures.join('\n')); console.error(`\n${failures.length} finding(s) in ${files.length} file(s).`); process.exit(1); }
console.log(`scan clean: ${files.length} file(s).`);
