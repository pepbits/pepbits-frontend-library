// From the repository root: node <this-file> <verification-run-directory>.
// Keep only small, credential-free receipts. Source checkpoints and diagnostics stay distinct.
import {execFileSync, spawnSync} from 'node:child_process';
import {copyFileSync, existsSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const evidence = 'docs/releases/unreleased/evidence/restructure-phase-6e-4-2026-10-24';
const run = process.argv[2];
if (!run) throw new Error('Pass the verification run directory');
const strip = text => text.replace(/\x1b\[[0-9;]*m/g, '');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (name, data) => writeFileSync(join(evidence, name), JSON.stringify(data, null, 2) + '\n');
for (const [from, to] of [['install.log', 'install.log'], ['integration.log', 'integration-final.log'], ['browser.json', 'browser-final.json'], ['identity.json', 'identity-final.json'], ['ci.log', 'ci-final.log'], ['shell-browser.log', 'shell-browser.log'], ['settle-bill.png', 'settle-bill.png'], ['resources-tests-final.log', 'focused-regressions.log']]) {
  const source = join(run, from);
  if (!existsSync(source)) continue;
  if (/\.log$/.test(from)) writeFileSync(join(evidence, to), strip(readFileSync(source, 'utf8')));
  else copyFileSync(source, join(evidence, to));
}
const ci = strip(readFileSync(join(run, 'ci.log'), 'utf8'));
const workspaces = {};
for (const line of ci.split('\n')) {
  const tests = line.match(/^(@[\w./-]+):test:\s+Tests\s+(\d+) passed(?: \((\d+)\))?/);
  if (tests) (workspaces[tests[1]] ??= {}).tests = Number(tests[2]);
  const files = line.match(/^(@[\w./-]+):test:\s+Test Files\s+(\d+) passed/);
  if (files) (workspaces[files[1]] ??= {}).files = Number(files[2]);
}
const tasks = ci.match(/Tasks:\s+(\d+) successful, (\d+) total/), cached = ci.match(/Cached:\s+(\d+) cached, (\d+) total/);
write('ci-summary.json', {tasks: tasks && {successful: +tasks[1], total: +tasks[2]}, cached: cached && {cached: +cached[1], total: +cached[2]}, toolingTests: Number(ci.match(/# pass (\d+)/)?.[1]), workspaces,
  totalTests: Object.values(workspaces).reduce((n, w) => n + (w.tests ?? 0), 0), totalFiles: Object.values(workspaces).reduce((n, w) => n + (w.files ?? 0), 0), exit: Number(ci.match(/ci exit (\d+)/)?.[1])});
writeFileSync(join(evidence, 'build-final.log'), ci.split('\n').filter(line => line.startsWith('@pepbits-demo/settle:build:')).join('\n') + '\n');
const sh = (cmd, args) => {const r = spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 1 << 26}); return {exit: r.status, out: r.stdout.trim()};};
const forbidden = sh('grep', ['-rnE', '@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-client|ai-config|ai-ui|reference-)|desktop-clients|/src/|demo-apps/(healthcare|erp|school|reports|tenant-admin)', 'demo-apps/settle/src']);
const sensitive = sh('grep', ['-rnP', String.raw`https?://(?!localhost|127\.0\.0\.1|www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}|Bearer [A-Za-z0-9]{10}|password\s*[:=]\s*['"][^'"]{4,}`, 'demo-apps/settle/src', evidence]);
const matches = sensitive.out ? sensitive.out.split('\n').map(line => {
  const [, path, number, content] = line.match(/^(.+?):(\d+):(.*)$/) ?? [];
  if (!path) throw new Error('Unparseable scan match');
  const reason = /react\.dev/.test(content) ? 'Public React diagnostic documentation link emitted by inherited tests.' : null;
  return {path, line: Number(number), sha256: sha(content), reason};
}) : [];
const protectedPaths = ['desktop-clients', 'dummy-api', 'source', 'demo-pages', 'Jenkinsfile', 'deploy', 'run.sh', 'run_all.sh', '.github'];
write('boundary-scans.json', {protectedPaths, protectedDiff: sh('git', ['diff', '--stat', '--', ...protectedPaths]).out,
  protectedStatus: sh('git', ['status', '--short', '--', ...protectedPaths]).out,
  sourceAndDemoPagesStatus: sh('git', ['status', '--short', 'source', 'demo-pages']).out,
  whitespace: sh('git', ['diff', '--check']), forbiddenImports: forbidden, credentialUrlScan: {exit: sensitive.exit, matches}});
const checkpoint = JSON.parse(readFileSync(join(run, 'source-before-ci.json'), 'utf8'));
const final = JSON.parse(readFileSync('docs/releases/unreleased/manifest-restructure-phase-6e-4-2026-10-24.json', 'utf8'));
write('source-verification.json', {baseCommit: final.baseCommit, beforeCiDigest: checkpoint.implementationDigest, finalDigest: final.implementationDigest, files: final.files.length,
  mismatches: final.files.filter(f => checkpoint.files.find(p => p.path === f.path)?.sha256 !== f.sha256 || sha(readFileSync(f.path)) !== f.sha256).map(f => f.path),
  scope: final.identityScope});
const receipt = 'docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json';
write('environment.json', {time: new Date().toISOString(), baseCommit: final.baseCommit, node: process.version, npm: sh('npm', ['--version']).out,
  ciCommand: 'NEXT_PUBLIC_API_URL=/api NEXT_PUBLIC_SETTLE_API_URL=/settle-api RCM_BROWSER_PARITY_RESULT=<absolute retained receipt> MEDBAND_BROWSER_PARITY_RESULT=<same> npm run ci -- --concurrency=1 --env-mode=loose',
  receiptInput: {path: receipt, sha256: sha(readFileSync(receipt)), scope: 'Four inherited healthcare receipt assertions; not a new healthcare HTTP run.'},
  integration: 'SETTLE_RUNTIME_ARTIFACTS=<source-identical checkout dummy-api> SETTLE_API_NODE=<Node 24> npm run test:integration -w @pepbits-demo/settle',
  shellBrowser: 'LD_LIBRARY_PATH=$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu npm run test:browser -w @pepbits/shell', lock: 'flock /home/pepadmin/.cache/pepbits-heavy.lock'});
const nextBuild = 'demo-apps/settle/.next/BUILD_ID';
const nativeBinding = 'source/settle/backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node';
write('build-identity.json', {baseCommit: final.baseCommit, implementationDigest: final.implementationDigest,
  nextBuildId: readFileSync(nextBuild, 'utf8').trim(), nextBuildIdSha256: sha(readFileSync(nextBuild)),
  sqliteBinding: {path: nativeBinding, sha256: sha(readFileSync(nativeBinding)),
    version: JSON.parse(readFileSync('source/settle/backend/node_modules/better-sqlite3/package.json', 'utf8')).version},
  scope: 'Local production Next build used by integration; preinstalled native Settle dependency. No backend source or runtime rebuild.'});
const sourceFiles = execFileSync('git', ['ls-files', 'source/settle', '-z'], {encoding: 'utf8'}).split('\0').filter(Boolean);
write('source-references.json', {baseCommit: final.baseCommit, files: sourceFiles.map(path => ({path, sha256: sha(readFileSync(path))})), originalTestFiles: sourceFiles.filter(path => /[.](test|spec)[.]/.test(path))});
console.log(JSON.stringify({workspaces: Object.keys(workspaces).length, tests: Object.values(workspaces).reduce((n, w) => n + w.tests, 0), urlMatches: matches.length, unjustified: matches.filter(m => !m.reason).length}));
