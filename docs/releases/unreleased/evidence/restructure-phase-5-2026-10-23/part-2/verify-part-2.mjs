import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const id='restructure-phase-5-2026-10-23';
const folder=`docs/releases/unreleased/evidence/${id}/part-2`;
const sha=value=>createHash('sha256').update(value).digest('hex');
const manifestPath=`docs/releases/unreleased/manifest-${id}.json`;
const manifest=JSON.parse(readFileSync(manifestPath));
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),manifest.baseCommit);
for(const file of manifest.files)assert.equal(sha(readFileSync(file.path)),file.sha256,file.path);
assert.equal(sha(manifest.files.map(file=>`${file.path}\0${file.sha256}\n`).join('')),manifest.implementationDigest);
// The original writer is preserved unchanged. Only descriptive part/limit metadata
// changes here; its source paths, hashes and aggregate remain exactly as generated.
manifest.part=2;
manifest.previousPartManifest=`evidence/${id}/part-2/part-1-manifest.json`;
manifest.limits=['Phase 5 priorities 1–6 complete in source; optional preferences/login and AI remain phase 5b.',
 'Native runtime and child-window data/state wiring belong to phase 6 hosts; no native executable or window acceptance.',
 'Unpublished source exports; zero executable build tasks; no browser/live-service/hosted acceptance.',
 'No consumer migration, original-workspace runtime checks, catalog/example changes, commit, push or deployment.',
 'Install retains one moderate and two critical audit findings; no dependency remediation.'];
writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(`PASS ${manifest.files.length} source hashes; SHA-256 ${manifest.implementationDigest}; part 2 metadata applied`);
const protectedPaths=['desktop-clients','dummy-api','Jenkinsfile','deploy','run.sh','run_all.sh','.github'];
for(const args of [['diff','--stat','--',...protectedPaths],['status','--short','desktop-clients'],['status','--short','--',...protectedPaths],['diff','--check']]){
 assert.equal(execFileSync('git',args,{encoding:'utf8'}),'');console.log(`PASS git ${args.join(' ')}: 0 output bytes`);
}
const historical=JSON.parse(readFileSync(`${folder}/preserved-part-1.json`));
for(const file of historical.files)assert.equal(sha(readFileSync(file.path)),file.sha256,file.path);
console.log(`PASS ${historical.files.length} historical part 1 evidence files unchanged`);
assert.equal(sha(readFileSync(`${folder}/part-1-manifest.json`)),sha(execFileSync('git',['show','HEAD:docs/releases/unreleased/manifest-restructure-phase-5-2026-10-23.json'])));
for(const name of ['enterprise-shell.module.css','enterprise-shell.module.css.d.ts','workspace-page.module.css','workspace-page.module.css.d.ts']){
 assert.equal(sha(readFileSync(`packages/shell/src/${name}`)),sha(readFileSync(`desktop-clients/packages/erp-shell/src/${name}`)));}
console.log('PASS both CSS modules and declarations are byte-identical');
const pattern='@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-|reference-)|desktop-clients|lucide-react|@tauri-apps|localhost|AED|nexora|ledger|patient|clinic|school|invoice|dubai|sharjah|kochi';
const scan=spawnSync('grep',['-rniE',pattern,'packages/shell/src'],{encoding:'utf8'});
assert.equal(scan.status,1);assert.equal(scan.stdout,'');assert.equal(scan.stderr,'');
writeFileSync(`${folder}/required-scan.log`,scan.stdout);
writeFileSync(`${folder}/required-scan-justifications.json`,JSON.stringify({command:`grep -rniE "${pattern}" packages/shell/src`,exitCode:1,matchLines:0,matches:[]},null,2)+'\n');
console.log('PASS exact required grep: zero matches; exit 1');
const ci=readFileSync(`${folder}/ci.log`,'utf8');
const tests=[...ci.matchAll(/@pepbits\/([^:]+):test: +Tests +(\d+) passed/g)];
const files=[...ci.matchAll(/@pepbits\/([^:]+):test: +Test Files +(\d+) passed/g)];
const packages=tests.map(match=>({package:`@pepbits/${match[1]}`,tests:Number(match[2]),files:Number(files.find(file=>file[1]===match[1])?.[2])}));
assert.equal(packages.length,11);assert.equal(packages.reduce((n,p)=>n+p.tests,0),1292);assert.equal(packages.reduce((n,p)=>n+p.files,0),115);
assert.match(ci,/# tests 19\n/);assert.match(ci,/# fail 0\n/);assert.match(ci,/No tasks were executed/);
assert.equal(packages.find(p=>p.package==='@pepbits/shell').tests,384);
const inventory=JSON.parse(readFileSync(`${folder}/test-port-inventory.json`));
assert.equal(inventory.executedFiles.length,29);assert.equal(inventory.executedFiles.reduce((n,f)=>n+f.cases,0),384);
writeFileSync(`${folder}/test-counts.json`,JSON.stringify({source:'ci.log',packages,tests:1292,files:115,tooling:19,shell:384,shellFiles:29,sourcePackageBuildTasks:0},null,2)+'\n');
console.log('PASS retained CI: 1292 tests / 115 files; shell 384 / 29; tooling 19; zero executable builds');
const environment={capturedAt:new Date().toISOString(),node:process.version,npm:execFileSync('npm',['--version'],{encoding:'utf8'}).trim()};
for(const pkg of ['turbo','vitest','typescript','react','react-dom','jsdom','@testing-library/react'])environment[pkg]=JSON.parse(readFileSync(`node_modules/${pkg}/package.json`)).version;
writeFileSync(`${folder}/environment.json`,JSON.stringify(environment,null,2)+'\n');
// Source-isolation output is being redirected while this executes; checksums are
// finalized by the separate receipt command after all validators finish.
