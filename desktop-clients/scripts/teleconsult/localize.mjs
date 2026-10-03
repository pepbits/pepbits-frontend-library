/**
 * Wraps static JSX copy in the shared <LocalizedText/> boundary so it follows the host language once the
 * canonical catalogs contain the English source strings (see localization-inventory.mjs).
 *
 *   node scripts/teleconsult/localize.mjs
 *
 * Only text nodes whose siblings contain no {expression} are wrapped: a sentence split around a value
 * would otherwise be translated in fragments. <option>, <textarea> and <title> children are skipped
 * because React accepts only text there. Unknown strings fall back to the English text, so this is safe
 * before the catalogs are updated. Idempotent: wrapped text is no longer a JSX text node.
 */
import ts from 'typescript';
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const base = join(root, 'packages/reference-teleconsult/src');
const SKIP_PARENT = new Set(['option', 'textarea', 'title', 'style', 'script']);
const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
let total = 0;
for (const file of ['provider', 'patient'].flatMap(v => walk(join(base, v))).filter(f => f.endsWith('.tsx') && !f.includes('.test.'))) {
  let text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const visit = node => {
    if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text) && !node.containsOnlyTriviaWhiteSpaces) {
      const parent = node.parent;
      const tag = (ts.isJsxElement(parent) ? parent.openingElement.tagName : undefined)?.getText(sf);
      const siblings = ts.isJsxElement(parent) || ts.isJsxFragment(parent) ? parent.children : [];
      const hasExpression = siblings.some(child => ts.isJsxExpression(child));
      if (!hasExpression && !(tag && SKIP_PARENT.has(tag))) {
        const raw = node.text, lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0], body = raw.trim().replace(/\s+/g, ' ');
        const decoded = body.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        edits.push([node.getStart(sf), node.end, `${lead}<LocalizedText message={${JSON.stringify(decoded)}} />${trail}`]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  for (const [a, b, value] of edits.sort((x, y) => y[0] - x[0])) text = text.slice(0, a) + value + text.slice(b);
  if (!/\bLocalizedText\b[^;]*from "@pepbits\/ops-ui"/.test(text) && !/import \{[^}]*\bLocalizedText\b[^}]*\} from "@pepbits\/ops-ui"/.test(text)) {
    const lines = text.split('\n');
    const at = lines.findIndex(line => /^"use client";?$/.test(line)) + 1;
    lines.splice(at, 0, 'import { LocalizedText } from "@pepbits/ops-ui";');
    text = lines.join('\n');
  }
  writeFileSync(file, text);
  total += edits.length;
  console.log(String(edits.length).padStart(4), file.slice(base.length + 1));
}
console.log(`${total} static copy strings wrapped.`);
