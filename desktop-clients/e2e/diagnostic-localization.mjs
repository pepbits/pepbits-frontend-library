import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {DOCUMENTATION_RELEASE} from '../packages/erp-config/src/documentation.ts';
import {REFERENCE_MODULES} from '../packages/erp-config/src/reference-modules.ts';
import {loadPlaywright,BASE,API} from './harness.mjs';
const output=process.env.E2E_ARTIFACTS??'/tmp/pepbits-diagnostic-localization';mkdirSync(output,{recursive:true});
assert.ok(['127.0.0.1','localhost'].includes(new URL(BASE).hostname),'This test changes synthetic preferences: use an isolated local API.');
const catalogs=Object.fromEntries(['en','ar','hi','ml'].map(l=>[l,JSON.parse(readFileSync(new URL(`../../dummy-api/config/localization/shared/${l}.json`,import.meta.url),'utf8')).messages]));
const reverse=new Map(Object.entries(catalogs.en).map(([key,value])=>[value,key]));
const text=(language,source)=>catalogs[language][source]??catalogs[language][reverse.get(source)]??source;
const modules=REFERENCE_MODULES.filter(m=>['lis1','lis2','ris1'].includes(m.variant));
const browser=await loadPlaywright().chromium.launch({chromiumSandbox:false}),results=[],errors=[];
try{
 for(const language of ['ar','hi','ml']){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(BASE);await page.locator('input').first().fill('admin');await page.locator('input[type=password]').fill('admin');await page.locator('button[type=submit]').click();await page.locator('header [data-tour=module]').waitFor();
  const token=await page.evaluate(()=>localStorage.getItem('nexora-session-token'));
  const request=async(path,method='GET',body)=>{const response=await fetch(API+path,{method,headers:{Authorization:`Bearer ${token}`,'X-Product-Id':'nexora','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.equal(response.status,200,path);return response.json();};
  const before=await request('/preferences');
  await request('/preferences','PUT',{preferences:{...before.overrides,language,reducedMotion:true,sidebarPinned:false,sidebarPlacement:'left'},policyRevision:before.policy.revision,userRevision:before.userRevision});
  for(const module of modules){
   await page.goto(`${BASE}/${module.id}/${module.pages[0].id}`);
   const root=page.locator(`[data-reference-module="${module.variant}"]`);await root.waitFor();
   const label={lis1:'Orders today',lis2:'Needs attention',ris1:'Department flow right now'}[module.variant];
   assert.notEqual(text(language,label),label,'Dashboard label is translated');
   await root.getByText(text(language,label),{exact:true}).first().waitFor();
   const caption={lis1:'All notified',ris1:'All matched to orders'}[module.variant];if(caption)await root.getByText(text(language,caption),{exact:true}).first().waitFor();
   assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
   // The previous collapse click leaves the pointer on the rail; in hover mode the next page opens it under the
   // pointer. Start from the collapsed state, as a user whose pointer is elsewhere would.
   await page.mouse.move(700,70);
   const expand=page.getByRole('button',{name:text(language,'Expand navigation'),exact:true});await expand.focus();await expand.press('Enter');
   const collapse=page.getByRole('button',{name:text(language,'Collapse navigation'),exact:true});
   assert.equal(await collapse.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'Expanded sidebar toggle remains physically clickable');
   await collapse.click();
   assert.equal(await root.getByText(/ui\.[a-z0-9.]+\.[0-9a-f]{8}/).count(),0,'No message-key leakage');
   if(module.variant==='ris1'){
    const destination=module.pages.find(p=>p.path==='/integration');assert.ok(destination);
    await page.goto(`${BASE}/${module.id}/${destination.id}`);await root.waitFor();
    const select=root.getByRole('combobox',{name:text(language,'Status'),exact:true});await select.selectOption('REJECTED');assert.equal(await select.inputValue(),'REJECTED','Localized label preserves API enum');
   }
   await page.screenshot({path:`${output}/${language}-${module.variant}.png`,fullPage:true});
   results.push({language,module:module.variant,checks:['translated-dashboard','direction','sidebar-toggle','no-key-leakage',...(module.variant==='ris1'?['stable-filter-enum']:[])],status:'PASS'});
   for(const destination of module.pages){
    const {guide}=await request(`/documentation?releaseId=${DOCUMENTATION_RELEASE}&pageId=${destination.id}&language=${language}`);
    assert.equal(guide.language,language,destination.id);assert.equal(guide.translationStatus,'current',destination.id);assert.equal(guide.reviewStatus,'pending','Automated translation does not claim human review');
    results.push({language,pageId:destination.id,type:'complete-guide-translation',status:'PASS'});
   }
  }
  const current=await request('/preferences');await request('/preferences','PUT',{preferences:{...current.overrides,sidebarPlacement:'right'},policyRevision:current.policy.revision,userRevision:current.userRevision});
  for(const module of modules){
   await page.goto(`${BASE}/${module.id}/${module.pages[0].id}`);await page.locator(`[data-reference-module="${module.variant}"]`).waitFor();
   await page.mouse.move(700,70);await page.locator('aside[data-tour=sidebar] button[aria-expanded="false"]').first().waitFor();
   const toggle=page.locator('aside[data-tour=sidebar] button[aria-expanded]').first();await toggle.focus();await toggle.press('Enter');
   assert.equal(await toggle.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'Right-side toggle is clickable');
   assert.equal(await page.locator('header [data-tour=module] button').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'Right-side rail leaves module selector clickable');
   await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');results.push({language,module:module.variant,placement:'right',type:'physical-toggle-and-header-access',status:'PASS'});
  }
  await context.close();console.log(`PASS ${language}: three dashboards, both sidebar placements, stable enum and 55 complete API guides`);
 }
 assert.deepEqual(errors,[]);
}finally{writeFileSync(output+'/results.json',JSON.stringify({base:BASE,api:API,results,errors,humanReview:false},null,2));await browser.close();}
