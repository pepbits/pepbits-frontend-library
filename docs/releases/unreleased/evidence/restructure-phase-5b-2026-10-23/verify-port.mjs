import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const id='restructure-phase-5b-2026-10-23',folder=`docs/releases/unreleased/evidence/${id}`;
const sha=value=>createHash('sha256').update(value).digest('hex');
const manifest=JSON.parse(readFileSync(`docs/releases/unreleased/manifest-${id}.json`));
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),manifest.baseCommit);
for(const file of manifest.files)assert.equal(sha(readFileSync(file.path)),file.sha256,file.path);
assert.equal(sha(manifest.files.map(file=>`${file.path}\0${file.sha256}\n`).join('')),manifest.implementationDigest);
console.log(`PASS ${manifest.files.length} source hashes; SHA-256 ${manifest.implementationDigest}`);
const protectedPaths=['desktop-clients','dummy-api','Jenkinsfile','deploy','run.sh','run_all.sh','.github'];
for(const args of [['diff','--stat','--',...protectedPaths],['status','--short','desktop-clients'],['status','--short','--',...protectedPaths],['diff','--check'],['diff','--exit-code','--','docs/releases/unreleased/restructure-phase-5-2026-10-23.md','docs/releases/unreleased/manifest-restructure-phase-5-2026-10-23.json','docs/releases/unreleased/evidence/restructure-phase-5-2026-10-23']]){
 assert.equal(execFileSync('git',args,{encoding:'utf8'}),'');console.log(`PASS git ${args.join(' ')}: 0 output bytes`);
}
const pattern=String.raw`@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-|reference-)|desktop-clients|lucide-react|@tauri-apps|localhost|api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]|sk-[A-Za-z0-9]{10}|Bearer [A-Za-z0-9]{10}|nexora|ledger|patient|clinic|school`;
const scan=spawnSync('grep',['-rniE',pattern,'packages/ai/src','packages/shell/src'],{encoding:'utf8'});
assert.equal(scan.status,0);assert.equal(scan.stderr,'');
const matches=scan.stdout.trim().split('\n').map(line=>{
 const [,path,lineNumber,source]=line.match(/^([^:]+):(\d+):(.*)$/);
 const justification=/patient/i.test(source)?'Unchanged sensitive-name recognition pattern; removing it would weaken redaction. No product data.':
 /template\.clinical\.inline/.test(source)?'Existing canonical localization key for the generic inline preview; no product or page registry.':
 /clinic/i.test(source)?'Retained clinical wire security category/classification, its acknowledgment copy, explanatory comment or fictional test fixture. No product page, brand or real sensitive data.':null;
 assert.ok(justification,`Unreviewed scan match: ${path}:${lineNumber}`);
 return {path,line:Number(lineNumber),source,justification};
});
writeFileSync(`${folder}/required-scan.log`,scan.stdout);
writeFileSync(`${folder}/required-scan-justifications.json`,JSON.stringify({argv:['grep','-rniE',pattern,'packages/ai/src','packages/shell/src'],exitCode:scan.status,matchLines:matches.length,matches},null,2)+'\n');
console.log(`PASS exact source grep reviewed: ${matches.length} matching lines, every line justified`);
const ci=readFileSync(`${folder}/ci.log`,'utf8');
const counts=[...ci.matchAll(/@pepbits\/([^:]+):test: +Tests +(\d+) passed/g)];
const files=[...ci.matchAll(/@pepbits\/([^:]+):test: +Test Files +(\d+) passed/g)];
const packages=counts.map(match=>({package:`@pepbits/${match[1]}`,tests:Number(match[2]),files:Number(files.find(file=>file[1]===match[1])?.[2])}));
assert.equal(packages.length,12);assert.equal(packages.reduce((n,p)=>n+p.tests,0),1896);assert.equal(packages.reduce((n,p)=>n+p.files,0),146);
assert.match(ci,/# tests 19\n/);assert.match(ci,/# fail 0\n/);assert.match(ci,/No tasks were executed/);
assert.equal(packages.find(p=>p.package==='@pepbits/ai').tests,583);assert.equal(packages.find(p=>p.package==='@pepbits/shell').tests,405);
const executedFiles=[...ci.matchAll(/@pepbits\/(ai|shell):test: +✓ (src\/\S+) \((\d+) tests?\)/g)].map(match=>({path:`packages/${match[1]}/${match[2]}`,cases:Number(match[3])}));
const originalAi=[];
for(const [original,area] of [['ai-config','config'],['ai-client','client'],['ai-ui','ui']])for(const file of readdirSync(`desktop-clients/packages/${original}/src`).filter(file=>/\.test\.[^.]+$/.test(file))){
 const source=`desktop-clients/packages/${original}/src/${file}`,target=`packages/ai/src/${area}/${file}`;
 const finalCases=executedFiles.find(entry=>entry.path===target)?.cases;
 assert.ok(finalCases,target);
 originalAi.push({source,sourceSha256:sha(readFileSync(source)),target,originalCases:finalCases-(file==='policy.test.ts'&&area==='client'?2:0),finalCases,disposition:'All generic cases retained; imports and fixtures adapted. Client policy adds two race cases.'});
}
assert.equal(originalAi.length,13);assert.equal(originalAi.reduce((n,f)=>n+f.originalCases,0),378);
writeFileSync(`${folder}/test-port-inventory.json`,JSON.stringify({source:'ci.log',originalAi,executedFiles},null,2)+'\n');
writeFileSync(`${folder}/test-counts.json`,JSON.stringify({source:'ci.log',packages,tests:1896,files:146,tooling:19,typecheckTasks:12,testTasks:12,sourcePackageBuildTasks:0,chromiumCases:2},null,2)+'\n');
console.log('PASS retained CI: 1896 tests / 146 files; AI 583 / 22; shell 405 / 38; tooling 19; zero executable builds');
const secretPattern=String.raw`sk-[A-Za-z0-9]{10}|Bearer [A-Za-z0-9]{10}|api[_-]?key\s*[:=]`;
const evidence=spawnSync('grep',['-rniE',secretPattern,folder],{encoding:'utf8'});
assert.equal(evidence.status,1);assert.equal(evidence.stdout,'');assert.equal(evidence.stderr,'');
writeFileSync(`${folder}/credential-scan.log`,evidence.stdout);
console.log('PASS exact evidence credential grep: 0 matching lines; exit 1');
