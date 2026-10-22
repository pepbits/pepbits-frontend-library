/** Read-only emitted-code parity, manifest and isolation checks. Run at repository root. */
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ts from 'typescript';

const read = path => readFileSync(path, 'utf8');
const compile = (source, fileName) => ts.transpileModule(source, {fileName, compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
  removeComments: true, verbatimModuleSyntax: true,
}}).outputText.split('\n').filter(line => line.trim()).join('\n');
let checked = 0;
for (const [original, destination] of [
  ...['records', 'drafts', 'csv-import', 'approvals', 'record-panels'].map(name => [`erp-data/src/${name}.ts`, `data/src/${name}.ts`]),
  ['erp-config/src/draft-policy.ts', 'data/src/draft-policy.ts'],
  ...['sentinel.ts', 'recovery.ts'].map(file => [`auth/src/${file}`, `platform/src/${file}`]),
  ...['devices.ts', 'navigation.tsx', 'windows.tsx'].map(file => [`platform-ports/src/${file}`, `platform/src/${file}`]),
]) {
  let old = read(`desktop-clients/packages/${original}`);
  const current = read(`packages/${destination}`);
  old = old.replaceAll('@pepbits/erp-config', './draft-policy').replaceAll('nexora-sentinel', 'pepbits-sentinel');
  if (original.endsWith('/devices.ts')) old = old.slice(0, old.indexOf('/** Provider-issued'));
  if (original.endsWith('/recovery.ts')) {
    const start = old.indexOf('/** Typed transport failure'), end = old.indexOf('export async function recoveryRequest');
    assert.equal(compile(old.slice(start, end), 'failure.ts'), compile(read('packages/data/src/request-failure.ts'), 'failure.ts'));
    checked++;
    old = old.slice(0, start) + "import {RequestFailure} from '@pepbits/data';\nexport {RequestFailure} from '@pepbits/data';\n" + old.slice(end);
  }
  assert.equal(compile(current, destination), compile(old, destination), destination);
  checked++;
}
console.log(`PASS ${checked} implementation module comparisons: original emitted JS after documented imports, error extraction, event rename and identity exclusion; type-only annotations erase`);
// Session's intentional host configuration changes are checked against an explicit transform.
let session = read('desktop-clients/packages/auth/src/session.tsx');
session = session.replaceAll('nexora-session', 'pepbits-session');
const configStart = session.indexOf('/* Read once at module scope');
const configEnd = session.indexOf('/**\n * The session token', configStart);
session = session.slice(0, configStart) + session.slice(configEnd);
session = session.replace('export function SessionProvider({ children }: { children: React.ReactNode }) {', 'export function SessionProvider({ children, apiBaseUrl, fetch: fetcher = globalThis.fetch }: SessionProviderProps) {')
  .replaceAll('fetch(`${API}', 'fetcher(`${apiBaseUrl}')
  .replaceAll('}, []);', '}, [apiBaseUrl, fetcher]);')
  .replace('}, [expired]);', '}, [expired, apiBaseUrl, fetcher]);')
  .replace('export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {', 'export function createAuthedFetch({apiBaseUrl, fetch: fetcher = globalThis.fetch}: SessionOptions) {\nreturn async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {');
const accountsStart = session.indexOf('export const DEMO_ACCOUNTS:');
const accountsEnd = session.indexOf('/** Host-owned cookie', accountsStart);
session = session.slice(0, accountsStart).trimEnd().replace(/}$/, '};\n}') + '\n\n' + session.slice(accountsEnd);
assert.equal(compile(read('packages/platform/src/session.tsx'), 'session.tsx'), compile(session, 'session.tsx'));
console.log('PASS session emitted JS: only explicit URL/fetch/provider dependencies, configured request factory, generic browser namespace and account exclusion changes');

const manifest = JSON.parse(read('docs/releases/unreleased/manifest-restructure-phase-3-2026-10-22.json'));
for (const entry of manifest.files) assert.equal(createHash('sha256').update(readFileSync(entry.path)).digest('hex'), entry.sha256, entry.path);
console.log(`PASS source manifest: ${manifest.files.length} hashes match the working tree`);
const protectedPaths = ['desktop-clients', 'dummy-api', 'Jenkinsfile', 'deploy', 'run.sh', 'run_all.sh', '.github'];
for (const args of [['diff', '--stat', '--', ...protectedPaths], ['status', '--short', 'desktop-clients'], ['status', '--short', '--', ...protectedPaths], ['diff', '--check']]) {
  assert.equal(execFileSync('git', args, {encoding: 'utf8'}), '');
  console.log(`PASS git ${args.join(' ')}: exit 0, 0 output bytes`);
}
assert(!existsSync('desktop-clients/AGENTS.md'));
const args = ['-rnE', '@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-|reference-)|desktop-clients|localhost|AED', 'packages/data/src', 'packages/platform/src'];
const scan = spawnSync('grep', args, {encoding: 'utf8'});
assert.equal(scan.status, 1); assert.equal(scan.stdout, ''); assert.equal(scan.stderr, '');
console.log(`PASS grep ${args.join(' ')}: exit 1 (no matches), 0 output bytes; no exceptions`);
for (const file of ['report-data.ts', 'mock.ts', 'care-pages.ts', 'clinic-billing.ts', 'clinical-consultation.ts', 'clinical-document.ts', 'clinical-templates.ts', 'clinical-triage.ts', 'comprehensive-consultation.ts', 'op-registration.ts', 'label-printing.ts', 'identity-devices.ts', 'device-integrations.ts', 'dcp-host.ts', 'dcp-runtime.ts', 'dcp-designer.ts', 'fixtures']) assert(!existsSync(`packages/data/src/${file}`));
assert(!read('packages/platform/src/devices.ts').includes('IdentityCapture'));
assert(!read('packages/platform/src/session.tsx').includes('DEMO_ACCOUNTS'));
console.log('PASS excluded product modules, fixtures, identity capture and demo accounts are absent');
