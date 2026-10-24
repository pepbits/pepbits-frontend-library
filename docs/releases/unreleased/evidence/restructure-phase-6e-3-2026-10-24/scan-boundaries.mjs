import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';

const folder = 'docs/releases/unreleased/evidence/restructure-phase-6e-3-2026-10-24';
const run = (command, args) => {const result = spawnSync(command, args, {encoding: 'utf8'}); return {exit: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim()};};
const protectedPaths = ['source', 'demo-pages', 'desktop-clients', 'dummy-api', 'Jenkinsfile', 'deploy', 'run.sh', 'run_all.sh', '.github'];
const protectedStatus = run('git', ['status', '--short', '--', ...protectedPaths]);
const protectedDiff = run('git', ['diff', '--name-only', 'HEAD', '--', ...protectedPaths]);
const whitespace = run('git', ['diff', '--check']);
const forbidden = '@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-client|ai-config|ai-ui|reference-)|desktop-clients|/src/|demo-apps/(healthcare|erp|school|reports|tenant-admin)';
const forbiddenImports = run('grep', ['-rnE', forbidden, 'demo-apps/onboarding/src']);
const sensitive = 'https?://(?!localhost|127\\.0\\.0\\.1|www\\.w3\\.org)[a-z0-9.-]+\\.[a-z]{2,}|Bearer [A-Za-z0-9]{10}|password\\s*[:=]\\s*[\'\"][^\'\"]{4,}';
// Exclude only the output receipt to prevent recursive scan results. It stores hashes/reasons, never matching text.
const matches = run('grep', ['-rnP', '--exclude=boundary-scans.json', sensitive, 'demo-apps/onboarding/src', folder]);
assert.ok(matches.exit === 0 || matches.exit === 1, matches.stderr);
const lines = matches.stdout ? matches.stdout.split('\n') : [];
const justified = lines.map(line => {
  const parsed = line.match(/^([^:]+):(\d+):(.*)$/); assert.ok(parsed, 'Unexpected scanner output');
  const [, path, number, text] = parsed;
  let reason;
  if (path.endsWith('src/adapters/onboarding.test.ts') && text.includes('alnoor.orvia.health/login')) reason = 'Fictional workspace-address parser fixture; no request is made to this URL.';
  else if (path.endsWith('src/modules/orvia/auth/SignInFlow.tsx') && text.includes('next.password') && text.includes('Enter your password')) reason = 'Validation message assigned to the password field error, not a credential value.';
  else if (path.endsWith('.log') && text.includes('react.dev/')) reason = 'Upstream React diagnostic documentation link in local test/build output; no application endpoint or credential.';
  else if (path.endsWith('.log') && text.includes('nextjs.org/')) reason = 'Upstream Next.js build notice/documentation link; no application endpoint or credential.';
  else if (path.endsWith('.log') && text.includes('vitest.dev/')) reason = 'Upstream Vitest diagnostic documentation link; no application endpoint or credential.';
  else throw new Error(`Unjustified URL/credential match at ${path}:${number}; review locally without retaining secret content.`);
  return {path, line: Number(number), sha256: createHash('sha256').update(text).digest('hex'), reason};
});
assert.equal(protectedStatus.exit, 0); assert.equal(protectedStatus.stdout, '');
assert.equal(protectedDiff.exit, 0); assert.equal(protectedDiff.stdout, '');
assert.equal(whitespace.exit, 0); assert.equal(forbiddenImports.exit, 1);
writeFileSync(`${folder}/boundary-scans.json`, JSON.stringify({checkedAt: new Date().toISOString(), protectedPaths,
  protectedStatus: protectedStatus.stdout, protectedDiff: protectedDiff.stdout, whitespace, forbiddenImports,
  credentialUrlScan: {exit: matches.exit, matchingLines: justified.length, excludedOutputReceiptOnly: true, matches: justified}}, null, 2) + '\n');
console.log(`Protected paths unchanged; forbidden imports empty; ${justified.length} URL/credential-pattern lines justified.`);
