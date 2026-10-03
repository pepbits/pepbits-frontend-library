/**
 * Maintenance helper: inserts `const { t } = useLocalization();` into every component that calls t( without
 * declaring it, and imports useLocalization from @pepbits/ops-ui.   node scripts/quality/add-t.mjs <files...>
 */
import ts from 'typescript';
import {readFileSync, writeFileSync} from 'node:fs';
for (const file of process.argv.slice(2)) {
  let text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  for (const st of sf.statements) {
    let name, body;
    if (ts.isFunctionDeclaration(st) && st.body && st.name) { name = st.name.text; body = st.body; }
    else if (ts.isVariableStatement(st)) { const d = st.declarationList.declarations[0]; if (d?.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) && ts.isBlock(d.initializer.body)) { name = d.name.getText(sf); body = d.initializer.body; } }
    if (!body || !/^[A-Z]/.test(name)) continue;
    let uses = false;
    const v = n => { if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 't') uses = true; ts.forEachChild(n, v); };
    v(body);
    if (!uses) continue;
    const declared = /const \{[^}]*\bt\b[^}]*\} = use(?:Localization|ReferenceFormat)\(\)/.test(body.getText(sf)) || /const t = /.test(body.getText(sf));
    if (!declared) edits.push(body.getStart(sf) + 1);
  }
  if (!edits.length) continue;
  for (const at of edits.sort((a, b) => b - a)) text = text.slice(0, at) + '\n  const { t } = useLocalization();' + text.slice(at);
  const m = /import \{([^}]*)\} from "@pepbits\/ops-ui";/.exec(text);
  if (m && !/useLocalization/.test(m[1])) text = text.replace(m[0], `import {${m[1].trimEnd()}, useLocalization } from "@pepbits/ops-ui";`);
  else if (!m) { const lines = text.split('\n'); const i = lines.findIndex(l => /^"use client";?$/.test(l)) + 1; lines.splice(i, 0, 'import { useLocalization } from "@pepbits/ops-ui";'); text = lines.join('\n'); }
  writeFileSync(file, text); console.log('added t to', file);
}
