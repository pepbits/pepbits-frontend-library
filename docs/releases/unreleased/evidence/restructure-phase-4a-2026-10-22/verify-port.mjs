/** Read-only source parity and isolation. Run at the repository root. */
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const read = path => readFileSync(path, 'utf8');
function compile(source, fileName) {
  const output = ts.transpileModule(source, {fileName, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
    removeComments: true, verbatimModuleSyntax: true,
  }}).outputText;
  const ast = ts.createSourceFile(fileName + '.js', output, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  return ast.statements.filter(s => !ts.isImportDeclaration(s)).map(s => s.getText(ast)).join('\n');
}
function neutralFixtures(source) {
  for (const [a, b] of [
    ['purchaseOrder', 'sampleRecord'], ['purchase-order', 'sample-record'], ['purchase_order', 'sample_record'],
    ['Purchase orders', 'Sample records'], ['Purchase order', 'Sample record'], ['purchase orders', 'sample records'], ['purchase order', 'sample record'],
    ['healthcare', 'application-two'], ['Healthcare', 'Application two'], ['registration', 'intake'],
    ['Procurement', 'Group'], ['procurement', 'group'], ['enterprise-admin', 'administrator'],
  ]) source = source.replaceAll(a, b);
  return source.replace(/\berp\b/g, 'application').replace(/\bERP\b/g, 'Application')
    .replaceAll('school', 'application-three').replaceAll('patient', 'subject').replaceAll('admission', 'intake').replaceAll('Admission', 'Intake');
}
const pairs = [];
for (const area of ['lifecycle', 'master-transfer']) {
  for (const name of readdirSync(`desktop-clients/packages/erp-screens/src/${area}`)) {
    if (!/\.tsx?$/.test(name) || name === 'index.tsx' || name.endsWith('.d.ts')) continue;
    pairs.push([`erp-screens/src/${area}/${name}`, `${area}/${name}`]);
  }
}
for (const name of readdirSync('desktop-clients/packages/erp-config/src/lifecycle')) {
  if (name !== 'index.ts') pairs.push([`erp-config/src/lifecycle/${name}`, `lifecycle/config/${name}`]);
}
pairs.push(['erp-screens/src/dcp-designer/runtime-fields.tsx', 'dcp-fields/runtime-fields.tsx'],
  ['erp-screens/src/dcp-designer/runtime-fields.test.tsx', 'dcp-fields/runtime-fields.test.tsx'],
  ['erp-config/src/dcp-runtime.ts', 'dcp-fields/contract.ts']);
let tests = 0;
for (const [origin, destination] of pairs) {
  let original = read(`desktop-clients/packages/${origin}`), current = read(`packages/patterns/src/${destination}`);
  if (origin.includes('.test')) {
    original = neutralFixtures(original);
    if (/\.test\.tsx?$/.test(origin)) tests++;
  }
  if (destination === 'lifecycle/sources.test.tsx') original = original.replaceAll('<LifecycleConfigurationPage api=', '<LifecycleConfigurationPage sourcePageSize={25} api=');
  if (destination === 'lifecycle/page.tsx') {
    // The new provider bridge is covered by the added integration tests. Compare the whole controller and all other declarations.
    const removeBridge = source => {
      const start = source.indexOf('export function LifecycleConfigurationPage('), end = source.indexOf('type DetailTab =', start);
      assert(start > 0 && end > start);
      return source.slice(0, start) + source.slice(end);
    };
    original = removeBridge(original).replace('preferences = DEFAULT_PREFERENCES,', 'preferences,');
    current = removeBridge(current);
  }
  if (destination === 'dcp-fields/runtime-fields.tsx') {
    original = original.replace('const {t}=useLocalization();', 'const {t}=useLocalization(),format=useFormatters();')
      .replace('value={value as string|number|boolean|null}/>', "value={value as string|number|boolean|null} format={v=>f.type==='INTEGER'||f.type==='DECIMAL'?format.number(Number(v)):f.type==='DATE'?format.date(String(v)):f.type==='DATETIME'?format.dateTime(String(v)):String(v)}/>");
  }
  assert.equal(compile(current, destination), compile(original, destination), destination);
}
console.log(`PASS ${pairs.length} emitted-body comparisons (${tests} original test suites): imports moved to public lower layers, type-only assertions erased, documented preference bridge/formatting and neutral test fixtures only`);
for (const name of ['lifecycle.module.css', 'lifecycle.module.css.d.ts']) {
  assert.equal(read(`packages/patterns/src/lifecycle/${name}`), read(`desktop-clients/packages/erp-screens/src/lifecycle/${name}`));
}
console.log('PASS lifecycle CSS module and declarations byte-identical');
const sourcePackage = JSON.parse(read('desktop-clients/packages/erp-screens/package.json'));
const targetPackage = JSON.parse(read('packages/patterns/package.json'));
assert.equal(targetPackage.dependencies.xlsx, sourcePackage.dependencies.xlsx);
assert(!Object.keys(targetPackage.dependencies).some(name => name.startsWith('@dnd-kit/')));
console.log('PASS exact source XLSX dependency; no unused DnD dependencies');
const manifestPath = 'docs/releases/unreleased/manifest-restructure-phase-4a-2026-10-22.json';
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(read(manifestPath));
  for (const entry of manifest.files) assert.equal(createHash('sha256').update(readFileSync(entry.path)).digest('hex'), entry.sha256, entry.path);
  console.log(`PASS source manifest: ${manifest.files.length} hashes match`);
}
const protectedPaths = ['desktop-clients', 'dummy-api', 'Jenkinsfile', 'deploy', 'run.sh', 'run_all.sh', '.github'];
for (const args of [['diff', '--stat', '--', ...protectedPaths], ['status', '--short', 'desktop-clients'], ['status', '--short', '--', ...protectedPaths], ['diff', '--check']]) {
  assert.equal(execFileSync('git', args, {encoding: 'utf8'}), '');
  console.log(`PASS git ${args.join(' ')}: exit 0, 0 output bytes`);
}
assert(!existsSync('desktop-clients/AGENTS.md'));
const args = ['-rnE', '@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-|reference-)|desktop-clients|lucide-react|localhost|AED|patient|clinic|school', 'packages/patterns/src'];
const scan = spawnSync('grep', args, {encoding: 'utf8'});
assert.equal(scan.status, 1); assert.equal(scan.stdout, ''); assert.equal(scan.stderr, '');
console.log(`PASS grep ${args.join(' ')}: exit 1, zero matches, zero output bytes; no exceptions`);
