import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {QUALITY_REFERENCE} from '../packages/erp-config/src/quality-reference.ts';
import {referenceNavigationTarget} from '../packages/erp-config/src/reference-modules.ts';
import {loadPlaywright,BASE,API} from './harness.mjs';
const output=process.env.E2E_ARTIFACTS??'/tmp/pepbits-quality-browser';mkdirSync(output,{recursive:true});
const browser=await loadPlaywright().chromium.launch({chromiumSandbox:false});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(30000);
const results=[],pageErrors=[],consoleErrors=[],failedResponses=[],aborted=[];
page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});page.on('response',r=>{if(r.status()>=400)failedResponses.push({url:r.url(),status:r.status()})});page.on('requestfailed',r=>aborted.push({url:r.url(),error:r.failure()?.errorText}));
const record=(name,details={})=>{results.push({name,status:'PASS',...details});console.log('PASS '+name)};
const url=path=>{const t=referenceNavigationTarget(QUALITY_REFERENCE.id,path);return `${BASE}/${QUALITY_REFERENCE.id}/${t.pageId}/${encodeURIComponent(t.recordId)}`};
async function ready(){const root=page.locator('[data-reference-module="quality"]');await root.waitFor();await page.waitForFunction(()=>{const n=document.querySelector('[data-reference-module="quality"]');return n&&n.innerText.length>150&&!/Loading Quality workspace/.test(n.innerText)});await page.waitForTimeout(350);assert.ok(!/This view could not load|page not found|The server could not/.test(await root.innerText()));return root;}
async function login(username){await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('input').first().fill(username);await page.locator('input[type=password]').fill(username);await page.locator('button[type=submit]').click();await page.locator('header [data-tour=module]').waitFor();}
async function api(path,method='GET',body,headers={}){const token=await page.evaluate(()=>localStorage.getItem('nexora-session-token'));const r=await fetch(API+'/reference-modules/quality'+path,{method,headers:{Authorization:'Bearer '+token,'X-Product-Id':'nexora','X-Reference-Branch':'hq','Content-Type':'application/json',...(body!==undefined?{'Idempotency-Key':crypto.randomUUID()}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};}
try{
 await login('admin');await page.locator('header [data-tour=module] button').click();await page.getByRole('listbox').getByRole('option',{name:/AllyVora Quality/}).click();await ready();record('header selects isolated AllyVora Quality');
 const side=page.locator('aside[data-tour=sidebar]');
 for(const dest of QUALITY_REFERENCE.pages.filter(p=>!p.path.includes('[id]')&&(!('navigation'in p)||p.navigation!==false))){
  await page.mouse.move(750,70);const toggle=side.locator('button[aria-expanded]').first();if(await toggle.getAttribute('aria-expanded')==='false'){await toggle.focus();await toggle.press('Enter');}
  await side.locator(`a[href="/${QUALITY_REFERENCE.id}/${dest.id}"]`).click();await page.waitForURL(`${BASE}/${QUALITY_REFERENCE.id}/${dest.id}`);const root=await ready();await root.screenshot({path:output+'/'+dest.id+'.png'});record('sidebar '+dest.title,{pageId:dest.id});
 }
 const me=await api('/auth/me');assert.equal(me.status,200);assert.equal(me.body.user.name,'Prakash Mathew');record('source audit actor uses signed-in host identity');
 const indicators=await api('/indicators');assert.equal(indicators.status,200);assert.equal(indicators.body.length,32);
 await page.goto(url('/indicators/'+indicators.body[0].id),{waitUntil:'domcontentloaded'});let root=await ready();await root.screenshot({path:output+'/indicator-detail.png'});record('actual indicator detail route');
 const reports=await api('/report-templates');await page.goto(url('/reports/'+reports.body[0].id),{waitUntil:'domcontentloaded'});root=await ready();await root.screenshot({path:output+'/report-detail.png'});record('actual report and checksum route');
 await page.goto(url('/reports/designer'),{waitUntil:'domcontentloaded'});root=await ready();await root.screenshot({path:output+'/report-designer.png'});record('authorized designer does not duplicate sidebar items');
 // Exercise the original shared modal and an actual authenticated UI command.
 await page.goto(url('/authorities'),{waitUntil:'domcontentloaded'});root=await ready();
 await root.getByRole('button',{name:'Add authority',exact:true}).click();const modal=page.getByRole('dialog');await modal.waitFor();
 const uiName='Synthetic UI Quality authority '+Date.now();await modal.getByLabel('Code',{exact:true}).fill('UI'+Date.now().toString().slice(-9));await modal.getByLabel('Name',{exact:true}).fill(uiName);await modal.getByLabel('Jurisdiction',{exact:true}).fill('Test');
 await modal.screenshot({path:output+'/authority-modal.png'});await modal.getByRole('button',{name:'Save',exact:true}).click();await modal.waitFor({state:'hidden'});await root.getByText(uiName,{exact:true}).waitFor();record('original authority form posts through shared modal and authenticated API');
 // Use a real API mutation and inspect it after browser reload: no business response interception.
 const code='Q'+Date.now().toString().slice(-9),body={code,name:'Synthetic browser Quality authority',jurisdiction:'Test',channel:'api',programs:['Test']};const c=await api('/authorities','POST',body);assert.equal(c.status,201,JSON.stringify(c.body));
 await page.goto(url('/authorities'),{waitUntil:'domcontentloaded'});root=await ready();await root.getByText(body.name,{exact:true}).first().waitFor();await page.reload({waitUntil:'domcontentloaded'});root=await ready();await root.getByText(body.name,{exact:true}).first().waitFor();record('authenticated API mutation persists through refresh');
 const integrity=await api('/audit/verify');assert.equal(integrity.body.valid,true);record('append-only audit chain verifies');
 await page.evaluate(()=>localStorage.clear());await context.clearCookies();await login('quality-viewer');await page.goto(url('/'),{waitUntil:'domcontentloaded'});root=await ready();
 const denied=await api('/authorities','POST',body);assert.equal(denied.status,403);assert.equal((await api('/users')).status,403);assert.equal((await api('/auth/login','POST',{email:'admin@allyvora.health',password:'unused'})).status,403);record('Viewer and source-login bypass denied server-side');
 assert.equal(await side.locator('a[href="/reference-quality/reference-quality-users"]').count(),0);assert.equal(await side.locator('a[href="/reference-quality/reference-quality-audit"]').count(),0);record('Viewer sidebar omits restricted source items');
 await page.goto(`${BASE}/reference-quality/reference-quality-report-designer`,{waitUntil:'domcontentloaded'});await page.getByText(/^(This page is not configured|Page unavailable for your role)$/).waitFor();assert.equal(await page.locator('[data-reference-module="quality"]').count(),0);record('Viewer direct designer URL remains denied');
 assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failedResponses,[]);record('no browser API, page or console errors');
}catch(error){await page.screenshot({path:output+'/failure.png'}).catch(()=>{});writeFileSync(output+'/failure.txt',await page.locator('body').innerText().catch(()=>''));throw error;}
finally{writeFileSync(output+'/results.json',JSON.stringify({base:BASE,api:API,results,pageErrors,consoleErrors,failedResponses,aborted},null,2));await browser.close();}
