/**
 * Wraps static JSX copy of @pepbits/reference-quality in the shared <LocalizedText/> boundary so it follows the
 * host language once the canonical catalogs hold the English source strings (see copy.mjs / quality-copy.json).
 *
 *   node scripts/quality/localize.mjs [--check]
 *
 * - A JSX element whose children are only text and {expressions} becomes ONE message with {value0..} placeholders, so a
 *   sentence is never translated in fragments: `Showing {a} of {b}` -> <LocalizedText message="Showing {value0} of {value1}" values={{...}}/>.
 * - Conditional/`&&` string branches inside JSX children are wrapped individually.
 * - Elements that mix text with child elements (<b>, links) are listed, not guessed: they are adapted by hand.
 * - <option>, <textarea>, <title>, <style>, <script> children are skipped (React accepts only text there; options are
 *   localized through SourceSelect's contract by wrapping the literal in <LocalizedText/> only when it is plain text).
 * Idempotent: wrapped copy is no longer a JSX text node. Values and API payloads are never touched.
 */
import ts from 'typescript';
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const base = join(root, 'packages/reference-quality/src');
const SKIP_PARENT = new Set(['textarea', 'title', 'style', 'script', 'code']);
const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const ENTITIES = {nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", middot: '·', mdash: '—', ndash: '–', rarr: '→', larr: '←', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', times: '×', bull: '•', minus: '−'};
const decode = s => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, n) => n[0] === '#' ? String.fromCodePoint(n[1].toLowerCase() === 'x' ? parseInt(n.slice(2), 16) : Number(n.slice(1))) : ENTITIES[n] ?? m);
/** React's JSX whitespace rule: trim each line, drop empty lines, join with a single space. */
function clean(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  let out = '';
  lines.forEach((line, i) => {
    let t = line.replace(/\t/g, ' ');
    if (i !== 0) t = t.replace(/^ +/, '');
    if (i !== lines.length - 1) t = t.replace(/ +$/, '');
    if (t) { if (out && i !== 0 && !/\s$/.test(out) ) out += ' '; out += t; }
  });
  return out;
}
const hasLetters = s => /[A-Za-z]/.test(s);
/** A conditional or `&&` whose branch is human copy (a string literal with letters) needs per-branch wrapping. */
const carriesCopy = e => ts.isParenthesizedExpression(e) ? carriesCopy(e.expression)
  : ts.isConditionalExpression(e) ? carriesCopy(e.whenTrue) || carriesCopy(e.whenFalse)
  : ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? carriesCopy(e.right)
  : ts.isStringLiteral(e) && hasLetters(e.text);
const check = process.argv.includes('--check');
let total = 0; const mixed = []; const pending = [];

for (const file of walk(base).filter(f => f.endsWith('.tsx') && !/\.test\.|test-utils/.test(f) && !f.slice(base.length + 1).startsWith('lib/'))) {
  let text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const at = n => `${file.slice(base.length + 1)}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
  const wrapLiteral = lit => edits.push([lit.getStart(sf), lit.end, `<LocalizedText message=${JSON.stringify(lit.text)} />`]);
  const branchLiterals = expr => {
    if (ts.isParenthesizedExpression(expr)) return branchLiterals(expr.expression);
    if (ts.isConditionalExpression(expr)) { branchLiterals(expr.whenTrue); branchLiterals(expr.whenFalse); return; }
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) { branchLiterals(expr.right); return; }
    if (ts.isStringLiteral(expr) && hasLetters(expr.text)) wrapLiteral(expr);
  };
  const visit = node => {
    if ((ts.isJsxElement(node) || ts.isJsxFragment(node))) {
      const tag = ts.isJsxElement(node) ? node.openingElement.tagName.getText(sf) : '';
      const kids = node.children;
      if (!SKIP_PARENT.has(tag) && kids.some(k => ts.isJsxText(k) && hasLetters(decode(k.text)))) {
        const onlyTextAndExpr = kids.every(k => ts.isJsxText(k) || ts.isJsxExpression(k));
        if (!onlyTextAndExpr) {
          // Text beside child elements: wrap each text node alone only when it is a complete phrase between elements
          // and the parent has no expression siblings; otherwise leave for hand adaptation.
          const exprs = kids.some(k => ts.isJsxExpression(k));
          kids.forEach(k => {
            if (ts.isJsxText(k) && hasLetters(decode(k.text))) {
              if (exprs) { mixed.push(`${at(k)} text beside elements and expressions: ${clean(k.text).slice(0, 60)}`); return; }
              const raw = k.text, lead = /^\s/.test(raw) && !/^\s*[\r\n]/.test(raw) ? ' ' : '', trail = /\s$/.test(raw) && !/[\r\n]\s*$/.test(raw) ? ' ' : '';
              edits.push([k.getStart(sf) - (k.pos < k.getStart(sf) ? 0 : 0), k.end, ''].slice(0, 0));
              const body = decode(clean(raw)).trim();
              if (body) edits.push([k.pos, k.end, `${lead}<LocalizedText message=${JSON.stringify(body)} />${trail}`]);
            }
          });
        } else if (tag !== 'option' || kids.every(k => ts.isJsxText(k))) {
          let message = '', values = [], bad = false;
          for (const k of kids) {
            if (ts.isJsxText(k)) message += decode(clean(k.text));
            else if (ts.isJsxExpression(k)) {
              const e = k.expression;
              if (!e) continue;
              if (ts.isStringLiteral(e) && /^\s*$/.test(e.text)) { message += e.text; continue; }
              if (ts.isStringLiteral(e) && hasLetters(e.text)) { message += e.text; continue; }
              if (carriesCopy(e) && !ts.isStringLiteral(e)) { bad = 'cond'; break; }
              message += `{value${values.length}}`; values.push(e.getText(sf));
            }
          }
          if (bad === 'cond') {
            // Keep structure; wrap text pieces and literal branches separately.
            kids.forEach(k => {
              if (ts.isJsxText(k) && hasLetters(decode(k.text))) { const body = decode(clean(k.text)).trim(); const raw = k.text; const lead = /^\s/.test(raw) && !/^\s*[\r\n]/.test(raw) ? ' ' : ''; const trail = /\s$/.test(raw) && !/[\r\n]\s*$/.test(raw) ? ' ' : ''; if (body) edits.push([k.pos, k.end, `${lead}<LocalizedText message=${JSON.stringify(body)} />${trail}`]); }
              else if (ts.isJsxExpression(k) && k.expression) branchLiterals(k.expression);
            });
          } else if (hasLetters(message.replace(/\{value\d+\}/g, ''))) {
            const start = kids[0].pos, end = kids[kids.length - 1].end;
            const lead = /^\s*[\r\n]/.test(kids[0].getFullText()) || !ts.isJsxText(kids[0]) ? '' : '';
            const props = values.length ? ` values={{ ${values.map((v, i) => `value${i}: ${v}`).join(', ')} }}` : '';
            edits.push([start, end, `<LocalizedText message=${JSON.stringify(message.trim() === message ? message : message.replace(/^\s+|\s+$/g, ''))}${props} />`]);
          }
        }
      }
      // Expression children carrying literal branches: {cond ? "A" : "B"}
      if (!SKIP_PARENT.has(tag) && node.children.every(k => !(ts.isJsxText(k) && hasLetters(decode(k.text))))) kids.forEach(k => { if (ts.isJsxExpression(k) && k.expression) branchLiterals(k.expression); });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  // Drop nested/overlapping edits: keep the outermost.
  const sorted = edits.filter(e => e[1] > e[0]).sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const kept = []; let last = -1;
  for (const e of sorted) { if (e[0] >= last) { kept.push(e); last = e[1]; } }
  if (!kept.length) continue;
  for (const [a, b, value] of kept.sort((x, y) => y[0] - x[0])) text = text.slice(0, a) + value + text.slice(b);
  if (!/import \{[^}]*\bLocalizedText\b[^}]*\} from "@pepbits\/ops-ui"/.test(text)) {
    const m = /import \{([^}]*)\} from "@pepbits\/ops-ui";/.exec(text);
    if (m) text = text.replace(m[0], `import {${m[1].trimEnd()}, LocalizedText } from "@pepbits/ops-ui";`);
    else { const lines = text.split('\n'); const i = lines.findIndex(l => /^"use client";?$/.test(l)) + 1; lines.splice(i, 0, 'import { LocalizedText } from "@pepbits/ops-ui";'); text = lines.join('\n'); }
  }
  total += kept.length;
  pending.push(file);
  if (!check) writeFileSync(file, text);
  console.log(String(kept.length).padStart(4), file.slice(base.length + 1));
}
console.log(`${total} static copy nodes ${check ? 'would be ' : ''}wrapped.`);
if (mixed.length) console.log('Hand adaptation needed:\n  ' + mixed.join('\n  '));
if (check && pending.length) process.exit(1);
