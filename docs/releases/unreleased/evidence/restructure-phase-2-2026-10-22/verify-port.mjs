/** Read-only port parity, source identity and protected-path verification; run at the repository root. */
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ts from 'typescript';

const ui = 'cn button form-controls choice-fields date-time quantity-unit-field scanner-input option-filter search-select segmented badge avatar skeleton nav-link'.split(' ');
const components = 'card stat-card tabs dropdown overlay table presentation pagination calendar empty-state data-value inline-edit reference-data form-error-summary print-document recovery-notice error-mapper'.split(' ');
const owners = Object.fromEntries([...ui.map(name => [name, 'ui']), ...components.map(name => [name, 'components'])]);
const original = 'desktop-clients/packages/ops-ui/src';
const compiled = (source, fileName) => ts.transpileModule(source, {fileName, compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
  removeComments: true, verbatimModuleSyntax: true,
}}).outputText.split('\n').filter(line => line.trim()).join('\n');
let checked = 0;
for (const [name, pkg] of Object.entries({...owners, localization: 'i18n'})) {
  const file = readdirSync(original).find(file => file === `${name}.tsx` || file === `${name}.ts`);
  let old = readFileSync(`${original}/${file}`, 'utf8');
  let current = readFileSync(`packages/${pkg}/src/${name === 'localization' ? 'react.tsx' : file}`, 'utf8');
  old = old.replace(/from (['"])\.\/([^'"]+)\1/g, (match, quote, target) => {
    const path = target === 'localization' ? '@pepbits/i18n/react' :
      owners[target] && owners[target] !== pkg ? `@pepbits/${owners[target]}` : `./${target}`;
    return `from ${quote}${path}${quote}`;
  }).replaceAll('from "lucide-react"', 'from "@pepbits/icons"');
  if (name === 'cn') old = old.slice(0, old.indexOf('export function formatCurrency')) + old.slice(old.indexOf('export function formatCompact'));
  if (name === 'localization') old = old.replace("import { ENGLISH_MESSAGES } from './messages.en';", "import { CORE_CATALOG } from './core';").replaceAll('ENGLISH_MESSAGES', 'CORE_CATALOG.en');
  if (name === 'presentation') current = current.slice(0, current.indexOf('/** Project the host'));
  assert.equal(compiled(current, file), compiled(old, file), `${pkg}/${file}: behavior differs beyond the documented import/currency/catalog/helper changes`);
  checked++;
}
console.log(`PASS ${checked} implementation modules: emitted JavaScript matches the original after documented import, currency removal, core catalog and additive helper adjustments; comments and type-only assertions erase`);
assert(!existsSync('packages/ui/src/messages.en.ts') && !existsSync('packages/components/src/messages.en.ts') && !existsSync('packages/i18n/src/messages.en.ts'));
for (const pkg of ['ui', 'components']) {
  for (const name of ['source-controls', 'source-dialog']) assert(!existsSync(`packages/${pkg}/src/${name}.tsx`));
}
console.log('PASS product catalog and source-parity controls are absent');

const manifest = JSON.parse(readFileSync('docs/releases/unreleased/manifest-restructure-phase-2-2026-10-22.json'));
for (const entry of manifest.files) assert.equal(createHash('sha256').update(readFileSync(entry.path)).digest('hex'), entry.sha256, entry.path);
console.log(`PASS source manifest: ${manifest.files.length} hashes match the working tree`);
const protectedPaths = ['desktop-clients', 'dummy-api', 'Jenkinsfile', 'deploy', 'run.sh', 'run_all.sh', '.github'];
for (const args of [['diff', '--stat', '--', ...protectedPaths], ['status', '--short', 'desktop-clients'], ['status', '--short', '--', ...protectedPaths], ['diff', '--check']]) {
  assert.equal(execFileSync('git', args, {encoding: 'utf8'}), '');
  console.log(`PASS git ${args.join(' ')}: exit 0, 0 output bytes`);
}
assert(!existsSync('desktop-clients/AGENTS.md'));
const args = ['-rn', 'AED\\|lucide-react\\|@pepbits/ops-ui\\|desktop-clients', 'packages/ui/src', 'packages/components/src'];
const scan = spawnSync('grep', args, {encoding: 'utf8'});
assert.equal(scan.status, 1); assert.equal(scan.stdout, ''); assert.equal(scan.stderr, '');
console.log(`PASS grep ${args.join(' ')}: exit 1 (no matches), 0 output bytes; no exceptions`);
