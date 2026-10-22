/** Records the exact root-workspace source bytes; excludes its own evidence/receipt. */
import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--',
  'package.json', 'package-lock.json', 'turbo.json', 'tsconfig.base.json', 'packages', 'tooling',
  'docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md', 'docs/releases/unreleased/README.md'], {encoding: 'utf8'}).trim().split('\n'))].sort();
const files = paths.map(path => ({path, sha256: sha(readFileSync(path))}));
const implementationDigest = sha(files.map(file => `${file.path}\0${file.sha256}\n`).join(''));
const manifest = {
  schemaVersion: 1, recordId: 'restructure-phase-3-2026-10-22', status: 'unreleased-working-tree',
  baseCommit: 'e18c01d5800e75859c4fa097e6ad02b521f2b1bd', testGuideVersion: '1.0.0', implementationDigest,
  digestAlgorithm: 'SHA-256 of sorted path + NUL + file SHA-256 + LF entries',
  identityScope: 'Root workspace manifests/configuration, all tracked and nonignored package/tooling files, restructure plan and delivery index. Excludes delivery record, evidence and this manifest to avoid self-reference; unchanged files are included. Protected legacy source is identified by baseCommit and empty diff/status checks.',
  evidence: 'restructure-phase-3-2026-10-22.md', published: false, deployed: false,
  limits: ['Source exports only; zero build tasks and no publication/deployment.',
    'Local unit/jsdom and typecheck only; no old-workspace, backend/API, browser, native, live-service or hosted CI runs.',
    'Memory record transport is an additive volatile adapter, not a durable or multi-tenant backend.',
    'Generic browser namespace requires new sign-in; token migration and consumer rewiring are not included.',
    'npm install reports 3 audit vulnerabilities; dependency remediation outside this port.'], files,
};
writeFileSync('docs/releases/unreleased/manifest-restructure-phase-3-2026-10-22.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Source manifest: ${files.length} files; SHA-256 ${implementationDigest}`);
