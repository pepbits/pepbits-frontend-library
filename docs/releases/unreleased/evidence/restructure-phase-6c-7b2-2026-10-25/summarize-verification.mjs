import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const folder=new URL('./',import.meta.url),read=name=>readFileSync(new URL(name,folder),'utf8');
const ci=read('ci.log').replace(/\x1b\[[0-9;]*m/g,''),workspaces={};
for(const line of ci.split('\n')) {
 const tests=line.match(/^(@[^:]+):test:\s+Tests\s+(\d+) passed/),files=line.match(/^(@[^:]+):test:\s+Test Files\s+(\d+) passed/);
 if(tests)(workspaces[tests[1]]??={}).tests=Number(tests[2]);
 if(files)(workspaces[files[1]]??={}).files=Number(files[2]);
}
const tasks=ci.match(/Tasks:\s+(\d+) successful,\s+(\d+) total/),cache=ci.match(/Cached:\s+(\d+) cached/);
assert.ok(tasks&&cache,'CI summary missing');assert.equal(tasks[1],tasks[2]);assert.equal(Number(cache[1]),0);assert.ok(ci.includes('--force'));
const browser=JSON.parse(read('browser-final.json')),identity=JSON.parse(read('identity-final.json'));
for(const key of ['errors','consoleErrors','httpErrors'])assert.equal(browser[key].length,0,key);
const states=[...browser.checks,...browser.panelChecks],violations=states.reduce((sum,state)=>sum+state.violations.length,0);assert.equal(violations,0);
assert.equal(identity.integrationExit,0);assert.equal(identity.cleanup.length,3);assert.ok(identity.cleanup.every(service=>!service.groupAlive));
assert.equal(browser.checks.length,114);assert.equal(browser.visualChecks.length,65);
const shell=read('shell-browser.log').match(/Tests\s+(\d+) passed/);assert.ok(shell);
const summary={scope:'Local production-demo HTTP/Chromium, mocked unit suites and local builds; no deployed, original-desktop-runtime or native-executable acceptance',ci:{command:'npm run ci -- --concurrency=3 --env-mode=loose (root script supplies --force)',tasks:Number(tasks[1]),cached:0,vitestTests:Object.values(workspaces).reduce((sum,item)=>sum+item.tests,0),vitestFiles:Object.values(workspaces).reduce((sum,item)=>sum+item.files,0),toolingTests:Number(ci.match(/# tests (\d+)/)?.[1]),workspaces},shellBrowserTests:Number(shell[1]),integration:{workflows:browser.flows.length,ui:browser.flows.filter(flow=>flow.scope==='UI').length,directHTTP:browser.flows.filter(flow=>flow.scope==='direct HTTP').length,routes:browser.checks.length,panelStates:browser.panelChecks.length,geometryChecks:browser.visualChecks.length,newTransactionGeometryChecks:browser.visualChecks.filter(check=>check.state==='deferred-transaction-composition').length,catalogueStyleReceipts:browser.catalogueStyles.length,errors:0,consoleErrors:0,httpErrors:0,axeViolations:violations,axeIncomplete:states.reduce((sum,state)=>sum+state.incomplete,0)},apiSourcesCompared:identity.runtimeArtifacts.sourceFilesCompared,apiSourceMismatches:identity.runtimeArtifacts.mismatches,cleanup:identity.cleanup,completedAt:read('verification-finished.txt').trim()};
writeFileSync(new URL('verification-summary.json',folder),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
