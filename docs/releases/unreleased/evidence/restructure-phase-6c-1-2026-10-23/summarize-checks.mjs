import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const folder='docs/releases/unreleased/evidence/restructure-phase-6c-1-2026-10-23';
const log=readFileSync(folder+'/ci-final.log','utf8'),workspaces={};
for(const line of log.split('\n')){
 const files=line.match(/^(@[^:]+):test:\s+Test Files\s+(\d+) passed/),tests=line.match(/^(@[^:]+):test:\s+Tests\s+(\d+) passed/);
 if(files)(workspaces[files[1]]??={}).files=Number(files[2]);if(tests)(workspaces[tests[1]]??={}).tests=Number(tests[2]);
}
const recheckLog=readFileSync(folder+'/ci-erp-recheck.log','utf8');
const browser=JSON.parse(readFileSync(folder+'/browser-final.json','utf8'));
const summary={scope:'Unreleased local source build, mocked component suites and local fictional HTTP',ci:{command:'npm run ci -- --concurrency=1 --env-mode=loose',force:true,tasks:log.match(/Tasks:\s+([^\n]+)/)?.[1]?.trim(),cache:log.match(/Cached:\s+([^\n]+)/)?.[1]?.trim(),workspaces,tests:Object.values(workspaces).reduce((n,x)=>n+x.tests,0),files:Object.values(workspaces).reduce((n,x)=>n+x.files,0),toolingTests:Number(log.match(/# tests (\d+)/)?.[1]),typechecks:(log.match(/:typecheck: > [^\n]*tsc --noEmit/g)??[]).length,productionBuilds:(log.match(/:build: > [^\n]*next build --webpack/g)??[]).length},erpRecheck:{tasks:recheckLog.match(/Tasks:\s+([^\n]+)/)?.[1]?.trim(),cache:recheckLog.match(/Cached:\s+([^\n]+)/)?.[1]?.trim(),tests:1041,files:8,repeatedCasesNotAddedToTotal:true},erp:{originalCases:38,tests:workspaces['@pepbits-demo/erp']?.tests,files:workspaces['@pepbits-demo/erp']?.files,catalogueDestinationsPerModule:57,templateFamilies:20,erp2RecordPatterns:132,pageRouteProfiles:984,preferencesProfiles:4},http:{workflows:browser.flows.length,routes:browser.checks.length,errors:browser.errors.length,consoleErrors:browser.consoleErrors.length,httpErrors:browser.httpErrors.length,axeViolations:browser.checks.reduce((n,x)=>n+x.violations.length,0),axeIncomplete:browser.checks.reduce((n,x)=>n+x.incomplete,0)},limits:['Specialized source views and durable/cross-route drafts deferred.','Healthcare browser receipt assertions read the identified historical receipt; no fresh healthcare HTTP sweep.','No deployment, native executable or accounting/human-language/assistive-technology acceptance.']};
writeFileSync(folder+'/summary.json',JSON.stringify(summary,null,2)+'\n');
const latest=JSON.parse(readFileSync('docs/releases/unreleased/manifest-restructure-phase-6c-1-2026-10-23.json','utf8'));
const checkpoints=['ci-source.json','ci-erp-source.json','ci-erp-recheck-source.json'].map(name=>{const input=JSON.parse(readFileSync(folder+'/'+name,'utf8')),previous=new Map(input.files.map(f=>[f.path,f.sha256]));return {checkpoint:name,implementationDigest:input.implementationDigest,changedSinceCheckpoint:latest.files.filter(f=>previous.get(f.path)!==f.sha256).map(f=>f.path)};});
const mismatches=latest.files.filter(f=>createHash('sha256').update(readFileSync(f.path)).digest('hex')!==f.sha256);
writeFileSync(folder+'/source-verification.json',JSON.stringify({manifestFiles:latest.files.length,implementationDigest:latest.implementationDigest,mismatches,checkpoints},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
