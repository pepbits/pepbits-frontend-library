// Run from the repository root: node docs/releases/unreleased/evidence/restructure-phase-6e-6-2026-10-24/write-manifest.mjs
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const recordId='restructure-phase-6e-6-2026-10-24';
const baseCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const fixed=['package.json','package-lock.json','turbo.json','tsconfig.base.json','docs/README.md','docs/features/README.md','docs/features/allyvora-patients-demo.md','docs/testing/README.md','docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md','docs/releases/unreleased/README.md'];
const paths=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(path=>path&&(path.startsWith('packages/')||path.startsWith('tooling/')||path.startsWith('demo-apps/')||fixed.includes(path))))].sort();
const sha=value=>createHash('sha256').update(value).digest('hex');
const files=paths.map(path=>({path,sha256:sha(readFileSync(path))}));
const implementationDigest=sha(files.map(file=>`${file.path}\0${file.sha256}\n`).join(''));
const manifest={schemaVersion:1,recordId,status:'unreleased-working-tree',baseCommit,testGuideVersion:'1.0.0',implementationDigest,digestAlgorithm:'SHA-256 of sorted path + NUL + file SHA-256 + LF entries',identityScope:'Root workspace configuration, all tracked/nonignored packages/tooling/demo-apps files, plan and affected documentation/indexes. Excludes this release record, manifest and evidence to avoid self-reference. The read-only AllyVora source and protected paths are identified by base commit and empty diff/status checks.',evidence:`${recordId}.md`,published:false,deployed:false,limits:['AllyVora patient registration pages, modes, five layouts and layout designer; command-palette patient search/recents/actions, header branch switcher, footer API status, reload-surviving drafts, keyboard drawing beyond the paper-form alternative and pixel comparison remain adapted or deferred.','Local Next build, mocked tests and real local HTTP against the unchanged shared demo API and unchanged AllyVora API with fictional data; not deployed, native or clinical acceptance.','Shared demo API runtimes reused from a source-matched checkout with hashes, not rebuilt; AllyVora API built with its own documented script.','AllyVora wording is not in the canonical catalogs; human language/accessibility review remains.','Protected desktop/backend/deployment/CI paths and the AllyVora source unchanged; no commit or push.'],files};
writeFileSync(`docs/releases/unreleased/manifest-${recordId}.json`,JSON.stringify(manifest,null,2)+'\n');
console.log(`${files.length} files; SHA-256 ${implementationDigest}`);
