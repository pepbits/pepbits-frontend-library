// From the repository root, after collect-evidence.mjs and the final documentation/cleanup checks.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
const directory = new URL('./', import.meta.url);
const json = name => JSON.parse(readFileSync(new URL(name, directory), 'utf8'));
const ci = json('ci-summary.json'), browser = json('browser-final.json'), identity = json('identity-final.json');
assert.equal(ci.exit, 0);
assert.equal(ci.tasks.successful, ci.tasks.total);
assert.equal(ci.cached.cached, 0);
assert.equal(Object.keys(ci.workspaces).length, 16);
assert.equal(ci.workspaces['@pepbits-demo/settle'].tests, 161);
assert.equal(ci.workspaces['@pepbits-demo/settle'].files, 9);
assert.equal(browser.flows.length, 20);
assert.equal(new Set(browser.flows.map(f => f.id)).size, 20);
assert.equal(browser.checks.length, 29);
assert.equal(browser.checks.flatMap(c => c.violations).length, 0);
for (const key of ['errors', 'httpErrors', 'consoleErrors']) assert.deepEqual(browser[key], []);
assert.equal(identity.integrationExit, 0);
assert.equal(identity.cleanup.length, 4);
assert.ok(identity.cleanup.every(service => !service.groupAlive));
assert.equal(identity.runtimeArtifacts.mismatches, 0);
const source = json('source-verification.json');
assert.deepEqual(source.mismatches, []);
assert.equal(source.beforeCiDigest, source.finalDigest);
const boundary = json('boundary-scans.json');
for (const field of ['protectedDiff', 'protectedStatus', 'sourceAndDemoPagesStatus']) assert.equal(boundary[field], '');
assert.equal(boundary.whitespace.exit, 0);
assert.equal(boundary.forbiddenImports.exit, 1);
assert.ok(boundary.credentialUrlScan.matches.every(match => match.reason));
assert.match(readFileSync(new URL('shell-browser.log', directory), 'utf8'), /Tests\s+4 passed/);
assert.match(readFileSync(new URL('docs-final.log', directory), 'utf8'), /PASS \d+ documentation files/);
const cleanup = json('cleanup.json');
assert.ok(cleanup.ports.every(port => !port.open));
const summary = {status: 'passed', scope: browser.scope, implementationDigest: source.finalDigest,
  ci: {tasks: ci.tasks.total, cached: ci.cached.cached, tests: ci.totalTests, files: ci.totalFiles, toolingTests: ci.toolingTests},
  settle: ci.workspaces['@pepbits-demo/settle'], routeProfileAxeCases: 116, shellBrowser: {tests: 4, files: 1},
  http: {workflows: browser.flows.length, ui: browser.flows.filter(f => f.scope === 'UI').length,
    directHttp: browser.flows.filter(f => f.scope === 'direct HTTP').length, routes: browser.checks.length,
    violations: 0, incompleteAxeResults: browser.checks.reduce((sum, c) => sum + c.incomplete, 0)},
  documentationFiles: Number(readFileSync(new URL('docs-final.log', directory), 'utf8').match(/PASS (\d+)/)[1]),
  ownedServiceGroupsStopped: identity.cleanup.length, deployed: false, published: false};
writeFileSync(new URL('summary.json', directory), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
