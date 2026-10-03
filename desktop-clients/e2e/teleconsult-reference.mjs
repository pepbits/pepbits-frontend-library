import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {TELECONSULT_REFERENCES} from '../packages/erp-config/src/teleconsult-reference.ts';
import {referenceNavigationTarget} from '../packages/erp-config/src/reference-modules.ts';
import {loadPlaywright,BASE,API} from './harness.mjs';
const output=process.env.E2E_ARTIFACTS??'/tmp/pepbits-teleconsult-browser';mkdirSync(output,{recursive:true});
const browser=await loadPlaywright().chromium.launch({chromiumSandbox:false});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(30000);
const results=[],pageErrors=[],consoleErrors=[],failedResponses=[],aborted=[];
page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});page.on('response',r=>{if(r.status()>=400)failedResponses.push({url:r.url(),status:r.status()})});page.on('requestfailed',r=>aborted.push({url:r.url(),error:r.failure()?.errorText}));
const record=(name,details={})=>{results.push({name,status:'PASS',...details});console.log('PASS '+name)};
const url=(module,path)=>{const t=referenceNavigationTarget(module.id,path);return `${BASE}/${module.id}/${t.pageId}/${encodeURIComponent(t.recordId)}`};
async function ready(variant){const root=page.locator(`[data-reference-module="${variant}"]`);await root.waitFor();await page.waitForFunction(v=>{const n=document.querySelector(`[data-reference-module="${v}"]`);return n&&n.innerText.length>70&&!/Loading Teleconsult workspace/.test(n.innerText)},variant);return root;}
async function login(username){await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('input').first().fill(username);await page.locator('input[type=password]').fill(username);await page.locator('button[type=submit]').click();await page.locator('header [data-tour=module]').waitFor();}
async function api(variant,path,method='GET',body,extra={}){const token=await page.evaluate(()=>localStorage.getItem('nexora-session-token'));const r=await fetch(API+'/reference-modules/'+variant+'/api'+path,{method,headers:{Authorization:'Bearer '+token,'X-Product-Id':'nexora','X-Reference-Branch':'hq','Content-Type':'application/json',...(body!==undefined?{'Idempotency-Key':crypto.randomUUID()}:{}),...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};}
try{
 await login('admin');
 for(const module of TELECONSULT_REFERENCES){
  await page.locator('header [data-tour=module] button').click();await page.getByRole('listbox').getByRole('option',{name:new RegExp('^'+module.title+'(?:\\s|$)')}).click();await ready(module.variant);record(module.title+' header selection');
  const side=page.locator('aside[data-tour=sidebar]');
  for(const dest of module.pages.filter(p=>!p.path.includes('[id]'))){
   await page.mouse.move(750,70);const toggle=side.locator('button[aria-expanded]').first();if(await toggle.getAttribute('aria-expanded')==='false'){await toggle.focus();await toggle.press('Enter');}
   await side.locator(`a[href="/${module.id}/${dest.id}"]`).click();await page.waitForURL(`${BASE}/${module.id}/${dest.id}`);const root=await ready(module.variant);await page.waitForTimeout(250);assert.ok(!/Teleconsult page not found|API offline|Something went wrong/.test(await root.innerText()));await root.screenshot({path:output+'/'+dest.id+'.png'});record(module.title+' '+dest.path,{pageId:dest.id});
  }
 }
 const provider=TELECONSULT_REFERENCES[0],patient=TELECONSULT_REFERENCES[1];
 await page.goto(url(provider,'/consult/a3'),{waitUntil:'domcontentloaded'});let root=await ready(provider.variant);await root.getByRole('tab',{name:'Notes',exact:true}).click();await root.getByText('Subjective',{exact:true}).first().waitFor();assert.ok(await root.locator('[data-demo-notice]').count());await root.screenshot({path:output+'/provider-consultation.png'});record('actual appointment opens Provider consultation');
 await page.goto(url(patient,'/visit/a8'),{waitUntil:'domcontentloaded'});root=await ready(patient.variant);await page.waitForTimeout(700);assert.ok((await root.innerText()).includes('Demo'));await root.screenshot({path:output+'/patient-visit.png'});record('actual appointment opens CareCall visit');
 // Complete the current patient's actual visit through the signed-note command and browser action.
 const aid='a8';let draft=await api(provider.variant,`/appointments/${aid}/encounter`);assert.equal(draft.status,200);
 if(draft.body.status!=='signed'){
  assert.equal((await api(patient.variant,`/appointments/${aid}/join`,'POST',{})).status,200);
  assert.equal((await api(provider.variant,`/appointments/${aid}`,'PATCH',{status:'in-call'})).status,200);
  draft=await api(provider.variant,`/appointments/${aid}/encounter`);
  const saved=await api(provider.variant,`/encounters/${draft.body.id}`,'PUT',{...draft.body,allergiesReviewed:true,soap:{subjective:'Synthetic browser acceptance',objective:'Demo observations',assessment:'Synthetic review',plan:'Demo follow-up'},diagnoses:[{code:'R42',display:'Dizziness',type:'primary',certainty:'confirmed',addToProblemList:false}]});assert.equal(saved.status,200,JSON.stringify(saved.body));
  await page.goto(url(provider,'/consult/'+aid),{waitUntil:'domcontentloaded'});root=await ready(provider.variant);await root.getByRole('tab',{name:'Sign off',exact:true}).click();await root.getByRole('button',{name:'Sign and complete visit',exact:true}).click();await root.getByText('Signed and locked',{exact:true}).first().waitFor();record('Doctor browser sign publishes the patient summary');
 }
 const ownSummary=await api(patient.variant,`/appointments/${aid}/summary`);assert.equal(ownSummary.status,200);assert.equal(ownSummary.body.appointment.patientId,'p8');
 await page.goto(url(patient,'/visit/'+aid+'/summary'),{waitUntil:'domcontentloaded'});root=await ready(patient.variant);await root.getByText(/Visit summary|Your visit summary/).first().waitFor();await root.screenshot({path:output+'/patient-summary.png'});record('signed record opens distinct summary route');
 await page.goto(url(provider,'/patients'),{waitUntil:'domcontentloaded'});root=await ready(provider.variant);const reg=await api(provider.variant,'/session');assert.equal(reg.status,200);assert.equal(reg.body.role,'doctor');assert.deepEqual(reg.body.roles,['doctor','nurse']);record('Provider modes come from the authenticated session');
 await page.evaluate(()=>localStorage.clear());
 await context.clearCookies();await page.evaluate(()=>localStorage.clear());await login('teleconsult-nurse');await page.goto(url(provider,'/'),{waitUntil:'domcontentloaded'});root=await ready(provider.variant);await root.getByRole('group',{name:'Working mode'}).waitFor();await root.getByRole('group',{name:'Working mode'}).getByRole('radio',{name:'Nurse',exact:true}).waitFor();assert.equal(await root.getByRole('group',{name:'Working mode'}).getByRole('radio').count(),1);assert.equal((await api(provider.variant,'/session?role=doctor')).status,403);record('dedicated Nurse has one mode and cannot spoof Doctor');
 await page.evaluate(()=>localStorage.clear());await login('teleconsult-patient');await page.goto(url(patient,'/home'),{waitUntil:'domcontentloaded'});root=await ready(patient.variant);await page.waitForTimeout(400);assert.equal((await api(patient.variant,'/patients/p1')).status,403);const ps=await api(patient.variant,'/session');assert.equal(ps.body.patient.id,'p8');assert.equal(ps.body.patients.length,1);record('dedicated Patient is limited to its linked identity');
 assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failedResponses,[]);record('no failed browser API calls or console errors');
}catch(error){await page.screenshot({path:output+'/failure.png'}).catch(()=>{});writeFileSync(output+'/failure.txt',await page.locator('body').innerText().catch(()=>''));throw error;}
finally{writeFileSync(output+'/results.json',JSON.stringify({base:BASE,api:API,results,pageErrors,consoleErrors,failedResponses,aborted},null,2));await browser.close();}
