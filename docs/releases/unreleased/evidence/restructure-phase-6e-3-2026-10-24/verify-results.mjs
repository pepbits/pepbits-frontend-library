import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, statSync} from 'node:fs';
import {createConnection} from 'node:net';

const folder = 'docs/releases/unreleased/evidence/restructure-phase-6e-3-2026-10-24';
const read = name => readFileSync(`${folder}/${name}`, 'utf8');
const json = name => JSON.parse(read(name));
const write = (name, value) => writeFileSync(`${folder}/${name}`, JSON.stringify(value, null, 2) + '\n');
const sha = value => createHash('sha256').update(value).digest('hex');
const ci = read('ci-final.log').replace(/\x1b\[[0-9;]*m/g, '');
assert.match(ci, /Tasks:\s+36 successful, 36 total/);
assert.match(ci, /Cached:\s+0 cached, 36 total/);
assert.match(ci, /# tests 19\s/);
const workspaces = [...ci.matchAll(/^(@[^:]+):test:\s+Tests\s+(\d+) passed \((\d+)\)/gm)].map(([, workspace, tests, total]) => {
  assert.equal(tests, total);
  const line = ci.split('\n').find(line => line.startsWith(`${workspace}:test:`) && line.includes('Test Files'));
  const files = line?.match(/Test Files\s+(\d+) passed \((\d+)\)/);
  assert.ok(files, workspace); assert.equal(files[1], files[2]);
  return {workspace, tests: Number(tests), files: Number(files[1])};
}).sort((a, b) => a.workspace.localeCompare(b.workspace));
assert.equal(workspaces.length, 16);
const tests = workspaces.reduce((n, entry) => n + entry.tests, 0), files = workspaces.reduce((n, entry) => n + entry.files, 0);
const ciResult = {command: json('environment.json').ciCommand, tasks: 36, cached: 0, tests, files, toolingTests: 19,
  typechecks: [...ci.matchAll(/:typecheck: cache bypass/g)].length, productionBuilds: [...ci.matchAll(/:build: cache bypass/g)].length, workspaces};
assert.equal(ciResult.typechecks, 16); assert.equal(ciResult.productionBuilds, 4);
write('ci-summary.json', ciResult);

const browser = json('browser-final.json'), identity = json('identity-final.json');
assert.equal(browser.flows.length, 12); assert.equal(browser.checks.length, 44);
for (const profile of ['default', 'Arabic RTL', 'reduced motion', 'locked preference']) assert.equal(browser.checks.filter(check => check.profile === profile).length, 11);
for (const key of ['errors', 'consoleErrors', 'httpErrors']) assert.deepEqual(browser[key], [], key);
assert.deepEqual(browser.checks.flatMap(check => check.violations), []);
assert.equal(identity.integrationExit, 0); assert.equal(identity.runtimeArtifacts.mismatches, 0);
const live = {workflows: browser.flows.length, ui: browser.flows.filter(flow => flow.scope === 'UI').length,
  httpAndUi: browser.flows.filter(flow => flow.scope !== 'UI').length, routeProfiles: browser.checks.length, violations: 0,
  incompleteRuleResults: browser.checks.reduce((n, check) => n + check.incomplete, 0), javascriptErrors: 0, consoleErrors: 0, unexpectedHttpErrors: 0};
assert.match(read('shell-browser.log'), /Tests\s+4 passed/);
assert.match(read('shell-browser.log'), /Test Files\s+1 passed/);
const docs = read('docs-final.log').match(/PASS (\d+) documentation files/); assert.ok(docs);
const scans = json('boundary-scans.json');
assert.equal(scans.protectedStatus, ''); assert.equal(scans.protectedDiff, '');
assert.equal(scans.forbiddenImports.exit, 1); assert.equal(scans.whitespace.exit, 0);

const manifest = JSON.parse(readFileSync('docs/releases/unreleased/manifest-restructure-phase-6e-3-2026-10-24.json', 'utf8'));
for (const file of manifest.files) assert.equal(sha(readFileSync(file.path)), file.sha256, file.path);
const current = JSON.parse(execFileSync(process.execPath, [`${folder}/capture-source.mjs`], {encoding: 'utf8'}));
for (const checkpoint of ['ci-source.json', 'integration-source.json']) {
  assert.equal(json(checkpoint).sha256, current.sha256, checkpoint);
  assert.equal(json(checkpoint).files, current.files, checkpoint);
}
write('source-verification.json', {baseCommit: manifest.baseCommit, manifestFiles: manifest.files.length, implementationDigest: manifest.implementationDigest,
  runtimeFiles: current.files, runtimeDigest: current.sha256, matches: ['ci-source.json', 'integration-source.json'], finalFileHashesMatch: true,
  afterChecks: 'Only Markdown documentation, this release record, manifest and evidence finalized afterward.'});
const buildPath = 'demo-apps/onboarding/.next/BUILD_ID';
write('build-identity.json', {buildId: readFileSync(buildPath, 'utf8').trim(), sha256: sha(readFileSync(buildPath)), builtAt: statSync(buildPath).mtime.toISOString(), runtimeDigest: current.sha256});

const portOpen = port => new Promise(resolve => {
  const socket = createConnection({host: '127.0.0.1', port}); const finish = open => {socket.destroy(); resolve(open);};
  socket.setTimeout(1000); socket.once('connect', () => finish(true)); socket.once('error', () => finish(false)); socket.once('timeout', () => finish(false));
});
assert.equal(identity.cleanup.length, 3); assert.ok(identity.cleanup.every(service => service.groupAlive === false));
const ports = [];
for (const port of [identity.apiPort, identity.appPort]) {const open = await portOpen(port); assert.equal(open, false); ports.push({port, open});}
write('cleanup.json', {checkedAt: new Date().toISOString(), services: identity.cleanup, ports,
  earlierSession: 'prior-session-summary.json and prior-port-cleanup.json', shellBrowser: 'Awaited browser/Vite teardown; command completed before integration.',
  originalSourceBackend: 'None started by this resume or identified in the earlier onboarding service receipts.', allOwnedIntegrationGroupsStopped: true});
write('summary.json', {status: 'verified-local-demo', baseCommit: manifest.baseCommit, implementationDigest: manifest.implementationDigest, ci: ciResult,
  shellChromium: {tests: 4, files: 1}, documentation: {files: Number(docs[1])}, live,
  boundaries: {protectedPathsUnchanged: true, forbiddenImportsEmpty: true, justifiedMatchingLines: scans.credentialUrlScan.matchingLines},
  limits: 'Fictional device-local Orvia adapter; local HTTP host only. No deployment, real identity/registration, native executable or human language/accessibility acceptance.'});
console.log(JSON.stringify({tests, files, live, manifestFiles: manifest.files.length}));
