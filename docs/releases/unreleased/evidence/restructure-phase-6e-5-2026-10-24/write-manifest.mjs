import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
// Run from the repository root: node docs/releases/unreleased/evidence/restructure-phase-6e-5-2026-10-24/write-manifest.mjs
const recordId='restructure-phase-6e-5-2026-10-24';
const baseCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const fixed=['package.json','package-lock.json','turbo.json','tsconfig.base.json','docs/README.md','docs/features/README.md','docs/features/caregrid-demo.md','docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md','docs/releases/unreleased/README.md'];
const paths=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(path=>path&&(path.startsWith('packages/')||path.startsWith('tooling/')||path.startsWith('demo-apps/')||fixed.includes(path))))].sort();
const sha=value=>createHash('sha256').update(value).digest('hex');
const files=paths.map(path=>({path,sha256:sha(readFileSync(path))}));
const implementationDigest=sha(files.map(file=>`${file.path}\0${file.sha256}\n`).join(''));
const manifest={schemaVersion:1,recordId,status:'unreleased-working-tree',baseCommit,testGuideVersion:'1.0.0',implementationDigest,digestAlgorithm:'SHA-256 of sorted path + NUL + file SHA-256 + LF entries',
 identityScope:'Root workspace configuration, all tracked/nonignored packages/tooling/demo-apps files, plan and affected documentation/indexes. Excludes this release record, manifest and evidence to avoid self-reference. Protected source (including source/caregrid) is identified by base commit and empty diff/status checks.',
 evidence:`${recordId}.md`,published:false,deployed:false,
 limits:['CareGrid demo with all eleven source screens on public packages; fictional data only, not clinical acceptance.','Local production build, 25 real-HTTP workflows and 18 Chromium axe routes passed with zero violations; incomplete axe results remain in the receipt. Full CI and the separate shell browser suite were not rerun in this follow-up; not deployed or native.','Write controls are presentation gating; the unchanged scheduling API has no authorization.','CareGrid copy is English inside the translated shell; canonical catalog keys and human language review remain.','The HTTP launcher reused demo host API runtimes read-only from a source-matched checkout: 483 source files compared with zero mismatches, runtime hashes retained. All started service groups, including the original scheduling backend, stopped.','Protected desktop/backend/deployment/CI/source paths unchanged; no commit, merge or push in this follow-up.'],files};
writeFileSync(`docs/releases/unreleased/manifest-${recordId}.json`,JSON.stringify(manifest,null,2)+'\n');
console.log(`${files.length} files; SHA-256 ${implementationDigest}`);
