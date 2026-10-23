import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const folder='docs/releases/unreleased/evidence/restructure-phase-6b-4-2026-10-23/';
const read=name=>JSON.parse(readFileSync(folder+name,'utf8'));
const log=readFileSync(folder+'verification-final.log','utf8'),workspaces={};
for(const [,name,kind,count,skipped] of log.matchAll(/^([^\s]+):test:\s+(Test Files|Tests)\s+(\d+) passed(?: \| (\d+) skipped)?/gm)){
 const row=workspaces[name]??={};row[kind==='Tests'?'tests':'files']=Number(count);row[kind==='Tests'?'skippedTests':'skippedFiles']=Number(skipped??0);
}
const [,successful,total]=log.match(/^ Tasks:\s+(\d+) successful, (\d+) total/m)??[];
const [,cached]=log.match(/^Cached:\s+(\d+) cached/m)??[];
assert.equal(successful,'30');assert.equal(total,'30');assert.equal(cached,'0');
const browser=read('browser-final.json'),identity=read('identity-final.json');
assert.ok(browser.checks.every(check=>!check.failure&&!check.violations.length&&!check.pageViolations.length));
assert.ok(browser.rcmPresentation.length>20&&browser.rcmPresentation.every(check=>!check.failures.length));
assert.equal(browser.errors.length,0);assert.equal(browser.consoleErrors.length,0);assert.equal(browser.responses.length,0);
assert.ok(identity.cleanup.every(child=>child.groupAlive===false));
const screenshots=readdirSync(folder+'screenshots').sort().map(path=>({path:'screenshots/'+path,sha256:createHash('sha256').update(readFileSync(folder+'screenshots/'+path)).digest('hex')}));
const docs=readFileSync(folder+'docs.log','utf8').trim(),wrappers=readFileSync(folder+'browser-wrappers.log','utf8');
assert.match(wrappers,/Tests\s+2 passed/);
assert.match(log,/\n\s*Tests\s+2 passed/);
const sum=key=>Object.values(workspaces).reduce((n,row)=>n+row[key],0);
const report={
 ci:{command:'npm run ci -- --concurrency=1',environment:'environment.json',tasks:Number(total),cached:Number(cached),tests:sum('tests'),files:sum('files'),skippedTests:sum('skippedTests'),skippedFiles:sum('skippedFiles'),toolingTests:Number(log.match(/^# pass (\d+)$/m)?.[1]),typechecks:[...log.matchAll(/^\S+:typecheck: cache bypass/gm)].length,builds:[...log.matchAll(/^\S+:build: cache bypass/gm)].length,workspaces},
 browserWrappers:{tests:2,files:1,result:'Passed separately against final real Chromium receipt; these were the two opt-in cases skipped in root CI, not additional cases.'},
 shellBrowser:{tests:2,files:1,scope:'Physical left/right Arabic RTL sidebar in headless Chromium'},
 browser:{scope:browser.scope,flows:browser.flows.length,rcmFlows:browser.flows.filter(flow=>/^HCD-(13|14|15|16)/.test(flow.id)).length,routes:browser.checks.length,rcmRoutes:browser.checks.filter(check=>check.route.startsWith('/rcm')).length,rcmPresentationChecks:browser.rcmPresentation.length,fullShellViolations:0,pageContentViolations:0,javascriptErrors:0,consoleErrors:0,unexpectedHttpFailures:0,incompleteRuleResults:browser.checks.reduce((sum,check)=>sum+check.incomplete,0),manualReview:'Incomplete automated checks and native-language/domain/assistive-technology review remain outside acceptance.',screenshots},
 documentation:{files:Number(docs.match(/^PASS (\d+)/)?.[1]),result:docs,command:'/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs'},
 cleanup:identity.cleanup,source:read('source-verification.json'),boundaries:read('boundary-scans.json').categories,
};
writeFileSync(folder+'summary.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ci:{...report.ci,workspaces:undefined},browser:{...report.browser,screenshots:report.browser.screenshots.length},cleanup:report.cleanup}));
