import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {loadPlaywright,BASE,API} from './harness.mjs';
const output=process.env.E2E_ARTIFACTS??'/tmp/pepbits-teleconsult-localization';mkdirSync(output,{recursive:true});
assert.ok(['127.0.0.1','localhost'].includes(new URL(BASE).hostname),'Preference-changing checks require an isolated local API');
const catalogs=Object.fromEntries(['en','ar','hi','ml'].map(l=>[l,JSON.parse(readFileSync(new URL(`../../dummy-api/config/localization/shared/${l}.json`,import.meta.url))).messages]));
const reverse=new Map(Object.entries(catalogs.en).map(([k,v])=>[v,k]));const text=(l,s)=>catalogs[l][s]??catalogs[l][reverse.get(s)]??s;
const b=await loadPlaywright().chromium.launch({chromiumSandbox:false});const context=await b.newContext({viewport:{width:1440,height:1000}}),p=await context.newPage(),results=[],errors=[];p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
let before,token;const request=async(path,method='GET',body)=>{const r=await fetch(API+path,{method,headers:{Authorization:'Bearer '+token,'X-Product-Id':'nexora','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,200,path);return r.json()};
try{
 await p.goto(BASE);await p.locator('input').first().fill('admin');await p.locator('input[type=password]').fill('admin');await p.locator('button[type=submit]').click();await p.locator('header [data-tour=module]').waitFor();token=await p.evaluate(()=>localStorage.getItem('nexora-session-token'));before=await request('/preferences');
 for(const language of ['en','ar','hi','ml']){
  const current=await request('/preferences');await request('/preferences','PUT',{preferences:{...current.overrides,language,reducedMotion:true,sidebarPinned:false,sidebarPlacement:'left'},policyRevision:current.policy.revision,userRevision:current.userRevision});
  for(const variant of ['provider','patient']){
   await p.setViewportSize({width:1440,height:1000});await p.goto(`${BASE}/reference-teleconsult-${variant}/reference-teleconsult-${variant}-${variant==='provider'?'today':'home'}`);const root=p.locator(`[data-reference-module="teleconsult-${variant}"]`);await root.waitFor();
   await root.getByText(text(language,variant==='provider'?'Virtual waiting room':'Book a visit'),{exact:true}).first().waitFor();assert.equal(await p.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');assert.equal(await root.getByText(/ui\.[a-z0-9.]+\.[a-f0-9]{8}/).count(),0);
   // The previous toggle click leaves the pointer on the rail, which hover mode expands on the next page; start collapsed.
   await p.mouse.move(700,70);await p.locator('aside[data-tour=sidebar] button[aria-expanded="false"]').first().waitFor();
   const toggle=p.locator('aside[data-tour=sidebar] button[aria-expanded]').first();await toggle.focus();await toggle.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.ok(await p.locator('header [data-tour=module] button').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}));await toggle.click();
   await p.screenshot({path:`${output}/${language}-${variant}.png`});results.push({language,variant,type:'translations-direction-sidebar-and-header',status:'PASS'});
   if(variant==='patient')for(const height of [1000,800,600]){
    await p.setViewportSize({width:1440,height});await p.waitForTimeout(100);const geometry=await root.evaluate(n=>{const phone=n.querySelector('.tc-phone').getBoundingClientRect(),nav=n.querySelector('.tc-phone nav').getBoundingClientRect(),main=n.closest('main').getBoundingClientRect();return{phoneBottom:phone.bottom,navBottom:nav.bottom,mainBottom:main.bottom,phoneTop:phone.top,navTop:nav.top,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth}});assert.ok(geometry.phoneBottom<=geometry.mainBottom+1,JSON.stringify(geometry));assert.ok(Math.abs(geometry.phoneBottom-geometry.navBottom)<2);assert.ok(geometry.navTop>geometry.phoneTop);assert.ok(geometry.scrollWidth<=geometry.clientWidth+1);results.push({language,height,type:'phone-and-bottom-navigation-fit',status:'PASS',geometry});
   }
  }
 }
 // The print check needs a signed visit. Each suite gets its own API, so sign the synthetic a8 visit here (the same
 // commands the main Teleconsult acceptance uses) unless an earlier run on this API already did.
 const module=async(variant,path,method='GET',body)=>{const r=await fetch(`${API}/reference-modules/teleconsult-${variant}/api${path}`,{method,headers:{Authorization:'Bearer '+token,'X-Product-Id':'nexora','X-Reference-Branch':'hq','Content-Type':'application/json',...(body!==undefined?{'Idempotency-Key':randomUUID()}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json().catch(()=>null)}};
 let draft=await module('provider','/appointments/a8/encounter');assert.equal(draft.status,200);
 if(draft.body.status!=='signed'){
  assert.equal((await module('patient','/appointments/a8/join','POST',{})).status,200);
  assert.equal((await module('provider','/appointments/a8','PATCH',{status:'in-call'})).status,200);
  draft=await module('provider','/appointments/a8/encounter');
  const saved=await module('provider',`/encounters/${draft.body.id}`,'PUT',{...draft.body,allergiesReviewed:true,soap:{subjective:'Synthetic localization acceptance',objective:'Demo observations',assessment:'Synthetic review',plan:'Demo follow-up'},diagnoses:[{code:'R42',display:'Dizziness',type:'primary',certainty:'confirmed',addToProblemList:false}]});assert.equal(saved.status,200,JSON.stringify(saved.body));
  const signed=await module('provider',`/encounters/${draft.body.id}/sign`,'POST',{encounter:saved.body,signerId:saved.body.clinicianId});assert.equal(signed.status,200,JSON.stringify(signed.body));
 }
 assert.equal((await module('patient','/appointments/a8/summary')).status,200);
 await p.setViewportSize({width:1440,height:1000});await p.goto(`${BASE}/reference-teleconsult-patient/reference-teleconsult-patient-summary/${encodeURIComponent('/visit/a8/summary')}`);await p.locator('.ops-print-document').waitFor({state:'attached'});await p.emulateMedia({media:'print'});const doc=p.locator('body > .ops-print-document');await doc.waitFor({state:'visible'});assert.equal(await doc.getAttribute('class'),'ops-print-document');assert.ok((await doc.innerText()).includes(text('ml','Printed from the CareCall demo with fictional data. This page is not a clinical document, a prescription or medical advice.')));const pdf=await p.pdf({format:'A4',printBackground:true});assert.ok(pdf.length>1000);writeFileSync(output+'/synthetic-patient-summary.pdf',pdf);results.push({type:'shared-print-document-and-synthetic-pdf',status:'PASS',bytes:pdf.length});assert.deepEqual(errors,[]);
}catch(e){await p.screenshot({path:output+'/failure.png'}).catch(()=>{});writeFileSync(output+'/failure.txt',await p.locator('body').innerText().catch(()=>''));throw e}
finally{if(before&&token){const current=await request('/preferences');await request('/preferences','PUT',{preferences:before.overrides,policyRevision:current.policy.revision,userRevision:current.userRevision})}writeFileSync(output+'/results.json',JSON.stringify({results,errors,humanReview:false,nativeExecutable:false},null,2));await b.close();}
console.log('PASS '+results.length+' Teleconsult language/layout/print checks');
