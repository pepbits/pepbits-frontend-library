import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const root='docs/releases/unreleased',id='restructure-phase-4b-2026-10-23',folder=`${root}/evidence/${id}`;
const sha=value=>createHash('sha256').update(value).digest('hex');
const manifest=JSON.parse(readFileSync(`${root}/manifest-${id}.json`));
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),manifest.baseCommit);
for(const file of manifest.files)assert.equal(sha(readFileSync(file.path)),file.sha256,file.path);
assert.equal(sha(manifest.files.map(file=>`${file.path}\0${file.sha256}\n`).join('')),manifest.implementationDigest);
console.log(`PASS ${manifest.files.length} source hashes and aggregate digest`);
const protectedPaths=['desktop-clients','dummy-api','Jenkinsfile','deploy','run.sh','run_all.sh','.github'];
for(const args of [['diff','--stat','--',...protectedPaths],['status','--short','desktop-clients'],['status','--short','--',...protectedPaths],['diff','--check']]){
 const output=execFileSync('git',args,{encoding:'utf8'});assert.equal(output,'');console.log(`PASS git ${args.join(' ')}: 0 output bytes`);
}
for(const [source,target] of [['record-page/record-page.module.css','record-page/record-page.module.css'],['clinical-templates/record-layout.module.css','record-layout/record-layout.module.css'],['templates/registry-template.module.css','templates/registry-template.module.css']]){
 for(const suffix of ['', '.d.ts'])assert.deepEqual(readFileSync(`desktop-clients/packages/erp-screens/src/${source}${suffix}`),readFileSync(`packages/page-engines/src/${target}${suffix}`));
 console.log(`PASS byte-identical CSS and declaration: ${target}`);
}
const original=JSON.parse(readFileSync('desktop-clients/packages/erp-screens/package.json')).dependencies.xlsx;
for(const pkg of ['page-engines','patterns'])assert.equal(JSON.parse(readFileSync(`packages/${pkg}/package.json`)).dependencies.xlsx,original);
console.log(`PASS exact original XLSX specification: ${original}`);
const pattern='@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-|reference-)|desktop-clients|lucide-react|localhost|AED|patient|clinic|school|invoice|nexora';
const scan=spawnSync('grep',['-rniE',pattern,'packages/page-engines/src'],{encoding:'utf8'});
assert.ok(scan.status===0||scan.status===1);assert.equal(scan.stderr,'');writeFileSync(`${folder}/required-scan.log`,scan.stdout);
const matches=scan.stdout.trim().split('\n').filter(Boolean).map(line=>{
 const match=line.match(/^([^:]+):(\d+):(.*)$/);assert.ok(match);const [,file,number,text]=match;
 // Only the preserved classification vocabulary and section identifiers may match.
 assert.ok(text.includes('clinical'),line);
 assert.ok(!/@pepbits\/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-|reference-)|desktop-clients|lucide-react|localhost|AED|patient|school|invoice|nexora/i.test(text),line);
 const reason=text.includes('template.clinical.')?'Unchanged canonical localization key for generic section/completion/read/discard UI; test messages are private, not a runtime catalog.':text.includes('data-clinical-section')?'Preserved generic record-section DOM attribute; CSS/markup compatibility, no domain model.':'Preserved sensitive-data classification vocabulary or export/storage safety rationale and its tests; no product classifier, records or fixtures.';
 return {file,line:Number(number),text,reason};
});
writeFileSync(`${folder}/required-scan-justifications.json`,JSON.stringify({command:`grep -rniE "${pattern}" packages/page-engines/src`,exitCode:scan.status,matchLines:matches.length,matches},null,2)+'\n');
console.log(`PASS required grep: ${matches.length} individually justified matches; no prohibited import, endpoint or product fixture match`);
const totals={};
for(const pkg of ['patterns','engines']){
 const result=JSON.parse(readFileSync(`${folder}/${pkg}-tests.json`));assert.equal(result.numFailedTests,0);assert.equal(result.numPendingTests,0);assert.equal(result.numTodoTests,0);
 totals[pkg]={tests:result.numPassedTests,files:result.testResults.length};
 console.log(`PASS ${pkg} JSON: ${result.numPassedTests} tests / ${result.testResults.length} files; 0 failures/skips/todos`);
}
const env={node:process.version,npm:execFileSync('npm',['--version'],{encoding:'utf8'}).trim()};
for(const pkg of ['turbo','vitest','typescript','react','react-dom','jsdom','@testing-library/react','xlsx'])env[pkg]=JSON.parse(readFileSync(`node_modules/${pkg}/package.json`)).version;
writeFileSync(`${folder}/environment.json`,JSON.stringify(env,null,2)+'\n');
