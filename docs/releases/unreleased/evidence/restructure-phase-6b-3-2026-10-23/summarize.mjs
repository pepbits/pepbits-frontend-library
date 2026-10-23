import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const folder='docs/releases/unreleased/evidence/restructure-phase-6b-3-2026-10-23/';
const read=name=>JSON.parse(readFileSync(folder+name,'utf8'));
const log=readFileSync(folder+'ci-force.log','utf8'),workspaces={};
for(const [,name,kind,count] of log.matchAll(/^([^\s]+):test:\s+(Test Files|Tests)\s+(\d+) passed/gm)){
 (workspaces[name]??={})[kind==='Tests'?'tests':'files']=Number(count);
}
const [,successful,total]=log.match(/^ Tasks:\s+(\d+) successful, (\d+) total/m)??[];
const [,cached]=log.match(/^Cached:\s+(\d+) cached/m)??[];
assert.equal(successful,'30');assert.equal(total,'30');assert.equal(cached,'0');
const browser=read('browser-final.json'),identity=read('identity-final.json');
assert.ok(browser.checks.every(check=>!check.failure&&!check.violations.length&&!check.pageViolations.length));
assert.equal(browser.errors.length,0);assert.equal(browser.consoleErrors.length,0);assert.equal(browser.responses.length,0);
assert.ok(identity.cleanup.every(child=>child.groupAlive===false));
const screenshots=readdirSync(folder+'screenshots').sort().map(path=>({path:'screenshots/'+path,sha256:createHash('sha256').update(readFileSync(folder+'screenshots/'+path)).digest('hex')}));
const docs=readFileSync(folder+'docs.log','utf8').trim();
const report={
 ci:{command:'npm run ci -- --concurrency=1 (TURBO_ENV_MODE=loose, TURBO_CONCURRENCY=1, NEXT_PUBLIC_API_URL=/api, HEALTHCARE_BUILD_DIR=.next-phase6b3, NODE_OPTIONS=--max-old-space-size=4096)',tasks:Number(total),cached:Number(cached),tests:Object.values(workspaces).reduce((sum,row)=>sum+row.tests,0),files:Object.values(workspaces).reduce((sum,row)=>sum+row.files,0),toolingTests:Number(log.match(/^# pass (\d+)$/m)?.[1]),typechecks:[...log.matchAll(/^\S+:typecheck: cache bypass/gm)].length,builds:[...log.matchAll(/^\S+:build: cache bypass/gm)].length,workspaces},
 shellBrowser:{tests:2,files:1,scope:'Physical left/right Arabic RTL sidebar in headless Chromium; same final library source'},
 browser:{scope:browser.scope,flows:browser.flows.length,pharmacyFlows:browser.flows.filter(flow=>/^HCD-(09|10|11|12)/.test(flow.id)).length,routes:browser.checks.length,pharmacyRoutes:browser.checks.filter(check=>check.route.startsWith('/pharmacy')).length,fullShellViolations:0,pageContentViolations:0,javascriptErrors:0,consoleErrors:0,unexpectedHttpFailures:0,incompleteRuleResults:browser.checks.reduce((sum,check)=>sum+check.incomplete,0),manualReview:'Incomplete automated checks and native-language/domain/assistive-technology review are not acceptance.',screenshots},
 documentation:{files:Number(docs.match(/^PASS (\d+)/)?.[1]),result:docs,command:'/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs'},
 cleanup:identity.cleanup,source:read('source-verification.json'),boundaries:read('boundary-scans.json').categories,
};
writeFileSync(folder+'summary.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ci:{...report.ci,workspaces:undefined},browser:{...report.browser,screenshots:report.browser.screenshots.length},cleanup:report.cleanup}));
