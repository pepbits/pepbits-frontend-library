/**
 * Type-driven localization pass over packages/reference-medband/src (run after scripts/medband/import.mjs; idempotent).
 *
 *   node scripts/medband/localize.mjs [--check]
 *
 * import.mjs finds copy by syntax (JSX text, template literals). It cannot tell that `{s}` is a status or `{t.label}` an
 * encounter-type name. This pass asks the TypeScript checker: an expression whose type is a union of the domain's display
 * vocabulary (statuses, priorities, kinds...) or a property declared as copy in encounter-config (label, short, description,
 * hint) is shown through the localization boundary:
 *   - as a JSX child:                    {s}            ->  <LocalizedText message={s} />
 *   - as a value of tr(...)/<LocalizedText values>:  value0: x.status ?? ""  ->  value0: tr(x.status ?? "")
 * Record data (names, codes, dates) is never touched: its type is a plain string. With --check it only reports.
 */
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '../..');
const pkg = join(root, 'packages/reference-medband');
const check = process.argv.includes('--check');
const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const files = walk(join(pkg, 'src')).filter(f => /\.tsx$/.test(f) && !/\.test\./.test(f) && !/\/test-/.test(f));

const configPath = join(pkg, 'tsconfig.json');
const cfg = ts.getParsedCommandLineOfConfigFile(configPath, {}, {...ts.sys, onUnRecoverableConfigFileDiagnostic: d => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n')); }});
const program = ts.createProgram(cfg.fileNames, cfg.options);
const checker = program.getTypeChecker();

// Display vocabulary: members of the domain's string unions in lib/types.ts.
const VOCAB_TYPES = new Set(['Gender', 'CoveragePriority', 'Relationship', 'EpisodeStatus', 'EpisodeKind', 'CaseStatus', 'DurationUnit', 'EncounterStatus', 'Priority', 'BillingMode', 'TeleChannel', 'TriageLevel', 'AdmissionUrgency', 'AdmissionRequestStatus', 'AuthStatus', 'BedCategory', 'Isolation']);
const vocab = new Set();
const typesFile = program.getSourceFile(join(pkg, 'src/lib/types.ts'));
typesFile.forEachChild(node => {
  if (ts.isTypeAliasDeclaration(node) && VOCAB_TYPES.has(node.name.text) && ts.isUnionTypeNode(node.type)) node.type.types.forEach(m => { if (ts.isLiteralTypeNode(m) && ts.isStringLiteral(m.literal)) vocab.add(m.literal.text); });
});
const COPY_PROPS = new Set(['label', 'short', 'description', 'hint']);

function isCopy(expr) {
  let e = expr;
  while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e)) e = e.expression;
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return isCopy(e.left);
  if (ts.isConditionalExpression(e)) return isCopy(e.whenTrue) && isCopy(e.whenFalse);
  if (ts.isPropertyAccessExpression(e)) {
    const sym = checker.getSymbolAtLocation(e.name);
    const decl = sym?.declarations?.[0];
    if (decl && COPY_PROPS.has(e.name.text) && /encounter-config\.ts$/.test(decl.getSourceFile().fileName)) return true;
  }
  const type = checker.getNonNullableType(checker.getTypeAtLocation(e));
  const members = type.isUnion() ? type.types : [type];
  return members.length > 0 && members.every(m => m.isStringLiteral() && vocab.has(m.value));
}
const maybeUndefined = expr => { const t = checker.getTypeAtLocation(expr); return t.isUnion() && t.types.some(m => m.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)); };

let total = 0;
for (const file of files) {
  const sf = program.getSourceFile(file);
  if (!sf) continue;
  const text = sf.text;
  const edits = [];
  let usesTr = false, usesLt = false;
  const src = n => text.slice(n.getStart(sf), n.getEnd());
  const inLocalized = n => { for (let p = n.parent; p; p = p.parent) if (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p)) return /LocalizedText|Copy$/.test(p.tagName.getText(sf)); return false; };

  const visit = node => {
    // {expr} child
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      const e = node.expression;
      if (!ts.isStringLiteral(e) && !ts.isTemplateExpression(e) && isCopy(e)) {
        usesLt = true;
        edits.push({start: node.getStart(sf), end: node.getEnd(), text: `<LocalizedText message={${src(e).replace(/\s*\?\?\s*""$/, '')}${maybeUndefined(e) ? ' ?? ""' : ''}} />`});
        return;
      }
    }
    // valueN: expr inside tr(..., {...}) or <LocalizedText values={{...}}>
    if (ts.isPropertyAssignment(node) && /^value\d+$/.test(node.name.getText(sf)) && ts.isObjectLiteralExpression(node.parent)) {
      const holder = node.parent.parent;
      const trCall = ts.isCallExpression(holder) && ['tr', 't'].includes(holder.expression.getText(sf));
      const attr = ts.isJsxExpression(holder) && ts.isJsxAttribute(holder.parent) && holder.parent.name.getText(sf) === 'values';
      let init = node.initializer;
      if (trCall || attr) {
        const inner = ts.isParenthesizedExpression(init) ? init.expression : init;
        const core = ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && ts.isStringLiteral(inner.right) && inner.right.text === '' ? inner.left : inner;
        if (!/^tr\(/.test(src(core)) && !ts.isStringLiteral(core) && isCopy(core)) {
          usesTr = true;
          edits.push({start: init.getStart(sf), end: init.getEnd(), text: `tr(${src(core)} ?? "")`});
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  total += edits.length;
  console.log(`${check ? 'would change' : 'change'} ${file.slice(pkg.length + 1)}: ${edits.length}`);
  if (check) continue;

  let out = text;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);

  // Hook and import for what the edits introduced.
  const re = parse => ts.createSourceFile(file, out, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (usesTr) {
    const nsf = re();
    const inserts = [];
    for (const st of nsf.statements) {
      let name, body;
      if (ts.isFunctionDeclaration(st) && st.name && st.body) { name = st.name.text; body = st.body; }
      else if (ts.isVariableStatement(st)) { const d = st.declarationList.declarations[0]; if (d?.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) && ts.isBlock(d.initializer.body)) { name = d.name.getText(nsf); body = d.initializer.body; } }
      if (!body || !/^[A-Z]/.test(name)) continue;
      const bodyText = body.getText(nsf);
      if (/\btr\(/.test(bodyText) && !/const \{[^}]*\bt: tr\b[^}]*\} = useLocalization\(\)/.test(bodyText)) inserts.push(body.getStart(nsf) + 1);
    }
    for (const at of inserts.sort((a, b) => b - a)) out = out.slice(0, at) + '\n  const { t: tr } = useLocalization();' + out.slice(at);
  }
  const need = [];
  if (usesLt && !/\bLocalizedText\b[^;]*from "@pepbits\/ops-ui"|import \{[^}]*\bLocalizedText\b[^}]*\} from "@pepbits\/ops-ui"/.test(out)) need.push('LocalizedText');
  if ((usesTr || /useLocalization\(\)/.test(out)) && !/import \{[^}]*\buseLocalization\b[^}]*\} from "@pepbits\/ops-ui"/.test(out)) need.push('useLocalization');
  if (need.length) {
    const m = /import \{([^}]*)\} from "@pepbits\/ops-ui";/.exec(out);
    if (m) out = out.replace(m[0], `import { ${[...m[1].split(',').map(s => s.trim()).filter(Boolean), ...need].join(', ')} } from "@pepbits/ops-ui";`);
    else out = out.replace(/^("use client";\n)/, `$1import { ${need.join(', ')} } from "@pepbits/ops-ui";\n`);
  }
  writeFileSync(file, out);
}
console.log(`${total} expression(s) ${check ? 'to localize' : 'localized'}`);
if (check && total) process.exit(1);
