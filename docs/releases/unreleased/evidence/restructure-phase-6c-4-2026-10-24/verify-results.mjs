import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,statSync,readdirSync} from 'node:fs';
import {createConnection} from 'node:net';
const folder='docs/releases/unreleased/evidence/restructure-phase-6c-4-2026-10-24';
const read=name=>readFileSync(`${folder}/${name}`,'utf8'),json=name=>JSON.parse(read(name)),write=(name,value)=>writeFileSync(`${folder}/${name}`,JSON.stringify(value,null,2)+'\n');
const hash=value=>createHash('sha256').update(value).digest('hex');
assert.equal(json('ci-exit.json').exitCode,0);
const ci=read('ci-final.log').replace(/\x1b\[[0-9;]*m/g,'');
assert.match(ci,/Tasks:\s+33 successful, 33 total/);assert.match(ci,/Cached:\s+0 cached, 33 total/);assert.match(ci,/# tests 19\s/);
assert.equal((ci.match(/\[phase6c4\] Vitest testTimeout=120000 ms/g)??[]).length,15);
const workspaces=[...ci.matchAll(/^(@[^:]+):test:\s+Tests\s+(\d+) passed \((\d+)\)/gm)].map(([,workspace,tests,total])=>{
 assert.equal(tests,total);const files=ci.split('\n').find(line=>line.startsWith(workspace+':test:')&&line.includes('Test Files'))?.match(/Test Files\s+(\d+) passed/);assert.ok(files,workspace);return {workspace,tests:Number(tests),files:Number(files[1])};
}).sort((a,b)=>a.workspace.localeCompare(b.workspace));
const tests=workspaces.reduce((n,w)=>n+w.tests,0),files=workspaces.reduce((n,w)=>n+w.files,0);assert.equal(workspaces.length,15);
const ciResult={command:json('environment.json').ciCommand,exitCode:0,tasks:33,cached:0,tests,files,toolingTests:19,typechecks:[...ci.matchAll(/:typecheck: cache bypass/g)].length,productionBuilds:[...ci.matchAll(/:build: cache bypass/g)].length,perTestTimeoutMs:120000,timeoutMechanism:'ci-vitest-timeout.mjs through NODE_OPTIONS; every configured file/assertion retained',workspaces,sourceCheckpoint:'ci-source.json'};
assert.equal(ciResult.typechecks,15);assert.equal(ciResult.productionBuilds,3);write('ci-summary.json',ciResult);
const browser=json('browser-final.json'),identity=json('identity-final.json');
assert.equal(browser.checks.length,114);assert.ok(browser.flows.length>=68);assert.equal(new Set(browser.flows.map(flow=>flow.id)).size,browser.flows.length);
for(const key of ['errors','consoleErrors','httpErrors'])assert.equal(browser[key].length,0,key);
assert.equal(browser.checks.flatMap(check=>check.violations).length,0);assert.equal(browser.panelChecks.length,15);assert.equal(browser.panelChecks.flatMap(check=>check.violations).length,0);assert.equal(identity.integrationExit,0);assert.equal(json('launcher-exit.json').exitCode,0);assert.equal(identity.runtimeArtifacts.sourceFilesCompared,483);assert.equal(identity.runtimeArtifacts.mismatches,0);
const live={workflows:browser.flows.length,ui:browser.flows.filter(flow=>flow.scope==='UI').length,directHttp:browser.flows.filter(flow=>flow.scope!=='UI').length,routes:browser.checks.length,panelStates:browser.panelChecks.length,panelViolations:0,violations:0,incompleteRuleResults:browser.checks.reduce((n,check)=>n+check.incomplete,0),panelIncompleteRuleResults:browser.panelChecks.reduce((n,check)=>n+check.incomplete,0),javascriptErrors:0,consoleErrors:0,unexpectedHttpErrors:0};
const shell=read('shell-browser.log');assert.match(shell,/Test Files\s+1 passed/);assert.match(shell,/Tests\s+4 passed/);
assert.match(read('docs-final.log'),/PASS 197 documentation files/);
const boundaries=json('boundary-scans.json');assert.equal(boundaries.protectedDiff,'');assert.equal(boundaries.protectedStatus,'');assert.equal(boundaries.parallelDiff,'');assert.equal(boundaries.forbiddenImports.exit,1);assert.equal(boundaries.whitespace.exit,0);assert.ok(boundaries.credentialUrlScan.justifications.every(match=>match.reason!=='REVIEW REQUIRED'));assert.ok(boundaries.credentialUrlScan.justifications.every(match=>!match.line.startsWith('demo-apps/erp/src/')));
const manifest=JSON.parse(readFileSync('docs/releases/unreleased/manifest-restructure-phase-6c-4-2026-10-24.json','utf8'));
const checkpoints=['ci-source.json','verification-source.json'].map(name=>{
 const snapshot=json(name),before=new Map(snapshot.files.map(file=>[file.path,file.sha256]));
 const changes=manifest.files.filter(file=>before.get(file.path)!==file.sha256).map(file=>file.path);assert.ok(changes.every(path=>path.endsWith('.md')||['demo-apps/erp/scripts/panel-workflows.mjs','demo-apps/erp/scripts/personal-workflows.mjs','demo-apps/erp/scripts/smoke.mjs'].includes(path)),name); assert.equal(manifest.files.length,snapshot.files.length);return {checkpoint:name,implementationDigest:snapshot.implementationDigest,changedFiles:changes};
});
for(const file of manifest.files)assert.equal(hash(readFileSync(file.path)),file.sha256,file.path);

write('source-verification.json',{baseCommit:manifest.baseCommit,files:manifest.files.length,implementationDigest:manifest.implementationDigest,checkpoints,finalFileHashesMatch:true});
const buildPath='demo-apps/erp/.next/BUILD_ID';write('build-identity.json',{httpBuild:json('http-build-identity.json'),ciBuildScope:'Final forced CI production build of identical runtime source; HTTP used the separately identified preceding build.',buildId:readFileSync(buildPath,'utf8').trim(),buildIdSha256:hash(readFileSync(buildPath)),builtAt:statSync(buildPath).mtime.toISOString(),command:ciResult.command,runtimeSourceCheckpoint:'ci-source.json',integrationSourceCheckpoint:'verification-source.json',sourceChangesSinceCi:checkpoints[0].changedFiles,runtimeSourceChangesSinceCi:[]});
const portOpen=port=>new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port});const done=open=>{socket.destroy();resolve(open);};socket.setTimeout(1000);socket.once('connect',()=>done(true));socket.once('error',()=>done(false));socket.once('timeout',()=>done(false));});
const cleanup=[];
for(const name of readdirSync(folder).filter(name=>/^identity-.*\.json$/.test(name))){
 const receipt=json(name);assert.equal(receipt.cleanup.length,3,name);assert.ok(receipt.cleanup.every(service=>service.groupAlive===false),name);
 const ports=[];for(const port of [receipt.apiPort,receipt.appPort]){const open=await portOpen(port);assert.equal(open,false,`${name}:${port}`);ports.push({port,open});}
 cleanup.push({receipt:name,integrationExit:receipt.integrationExit,services:receipt.cleanup,ports});
}
write('cleanup.json',{checkedAt:new Date().toISOString(),integrationRuns:cleanup,shellBrowser:'Completed with awaited fixture/browser teardown. CI commands completed; documentation/source checks start no services.',allStartedIntegrationGroupsStopped:true});
const pdfs=readdirSync(folder).filter(name=>/^erp-final-erp[12]-invoice\.pdf$/.test(name)).map(name=>{const bytes=readFileSync(`${folder}/${name}`),text=bytes.toString('latin1');assert.ok(text.startsWith('%PDF-'));const boxes=[...text.matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)].map(match=>match[1].trim().split(/\s+/).map(Number));assert.ok(boxes.length);for(const box of boxes){assert.ok(Math.abs(box[2]-595.28)<2);assert.ok(Math.abs(box[3]-841.89)<2);}return {file:name,bytes:bytes.length,sha256:hash(bytes),pages:[...text.matchAll(/\/Type\s*\/Page\b/g)].length,mediaBoxes:boxes};});
assert.equal(pdfs.length,2);write('print-verification.json',{scope:'Chromium print CSS and generated PDF page geometry. No physical printer or exhaustive long-document pagination acceptance.',pdfs});
write('summary.json',{status:'verified-subset',sourceDigest:manifest.implementationDigest,ci:ciResult,shellChromium:{tests:4,files:1},documentation:{files:197},live,print:pdfs,boundaries:{protectedPathsUnchanged:true,forbiddenImportsEmpty:true,justifiedMatchingLines:boundaries.credentialUrlScan.matchingLines},cleanup:'All owned service groups stopped; all allocated integration ports closed.',scope:'destination-status.json',limitations:'See release record and destination-status.json; not full source parity, deployment, native or accounting acceptance.'});
console.log(JSON.stringify({tests,files,live,manifestFiles:manifest.files.length,cleanupRuns:cleanup.length,pdfFiles:pdfs.length}));
