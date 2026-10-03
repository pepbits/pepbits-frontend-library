/**
 * Review aid: compares each ported file with its Phial source. For the pair it lists what the port lost or added in
 *   - Tailwind class strings (`className` literals, any string with spaces inside clsx/cx calls),
 *   - lucide icons and
 *   - API paths (string/template literals that start with "/" and look like an endpoint).
 * Differences are expected where the port replaces raw elements or localizes copy; read the list, do not expect it empty.
 *
 *   node scripts/pharmacy/fidelity.mjs [Name ...]       (source component base names, default all)
 */
import ts from 'typescript';
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const source = process.env.PHARMACY_REFERENCE_ROOT ?? '/home/pepadmin/pb/saas/reference/frontend/pharmacy-1/phial/frontend/src';
const port = resolve(import.meta.dirname, '../../packages/reference-pharmacy/src');
const FILES = ['components/views/Dashboard', 'components/views/Workbench', 'components/views/Counter', 'components/views/Orders', 'components/views/Sales', 'components/views/Inventory', 'components/views/Purchasing', 'components/views/Authorizations', 'components/views/Claims', 'components/views/Remittance', 'components/views/Patients', 'components/views/Audit', 'components/views/Settings', 'components/rx/RxDetail', 'components/rx/NewRxDialog', 'components/rx/dialogs', 'components/rx/RxChain', 'components/ui/charts', 'components/ui/lookup', 'components/ui/reason', 'components/ui/primitives', 'components/shell/CommandPalette'];
const only = process.argv.slice(2);
const read = f => { for (const e of ['.tsx', '.ts']) if (existsSync(f + e)) return readFileSync(f + e, 'utf8'); return ''; };
function facts(text) {
  const sf = ts.createSourceFile('x.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const classes = new Map(), icons = new Set(), paths = new Set();
  const addClass = s => s.split(/\s+/).filter(Boolean).forEach(c => classes.set(c, (classes.get(c) ?? 0) + 1));
  const visit = n => {
    if (ts.isImportDeclaration(n) && n.moduleSpecifier.getText(sf).includes('lucide-react') && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) n.importClause.namedBindings.elements.forEach(e => icons.add((e.propertyName ?? e.name).text));
    const lit = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) ? n.text : null;
    if (lit !== null) {
      const inClass = (() => { for (let p = n.parent; p; p = p.parent) { if (ts.isJsxAttribute(p)) return p.name.getText(sf) === 'className'; if (ts.isCallExpression(p) && /^(clsx|cx)$/.test(p.expression.getText(sf))) return true; if (ts.isStatement(p)) return false; } return false; })();
      if (inClass) addClass(lit);
      if (/^\/[a-z-]+([/?&=][\w$-]*)*/.test(lit.trim()) && /^\/(dashboard|prescriptions|dispensings|claims|authorizations|remittances|payments|patients|products|batches|movements|purchase-orders|reorder-suggestions|orders|sales|payers|audit|search|meta)/.test(lit.trim())) paths.add(lit.trim().replace(/\?.*$/, '').replace(/\$\{[^}]*\}/g, ':x'));
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return {classes, icons, paths};
}
let any = false;
for (const f of FILES.filter(f => !only.length || only.some(o => f.endsWith('/' + o)))) {
  const a = facts(read(join(source, f))), b = facts(read(join(port, f)));
  const lostClasses = [...a.classes.keys()].filter(c => !b.classes.has(c));
  const addedClasses = [...b.classes.keys()].filter(c => !a.classes.has(c));
  const lostIcons = [...a.icons].filter(i => !b.icons.has(i)), lostPaths = [...a.paths].filter(p => ![...b.paths].some(q => q === p));
  if (!lostClasses.length && !addedClasses.length && !lostIcons.length && !lostPaths.length) { console.log(`ok     ${f}`); continue; }
  any = true;
  console.log(`diff   ${f}`);
  if (lostClasses.length) console.log('  classes missing from port:', lostClasses.join(' '));
  if (addedClasses.length) console.log('  classes only in port:', addedClasses.join(' '));
  if (lostIcons.length) console.log('  icons missing:', lostIcons.join(' '));
  if (lostPaths.length) console.log('  api paths missing:', lostPaths.join(' '));
}
if (!any) console.log('no differences');
