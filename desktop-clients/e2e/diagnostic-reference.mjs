import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {REFERENCE_MODULES,referenceNavigationTarget} from '../packages/erp-config/src/reference-modules.ts';
import {loadPlaywright,BASE,API} from './harness.mjs';
const output=process.env.E2E_ARTIFACTS??'/tmp/pepbits-diagnostic-browser';mkdirSync(output,{recursive:true});
const browser=await loadPlaywright().chromium.launch({chromiumSandbox:false});
const results=[],pageErrors=[],consoleErrors=[],responses=[],aborted=[];
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(30000);
page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
page.on('requestfailed',r=>aborted.push({url:r.url(),error:r.failure()?.errorText}));
page.on('response',r=>{if(r.status()>=400)responses.push({url:r.url(),status:r.status()});});
const record=(name,detail={})=>{results.push({name,status:'PASS',...detail});console.log('PASS '+name);writeFileSync(output+'/progress.json',JSON.stringify({checks:results.length,last:name}));};
async function ready(variant){const node=page.locator(`[data-reference-module="${variant}"]`);await node.waitFor();await page.waitForFunction(v=>{const n=document.querySelector(`[data-reference-module="${v}"]`);return n&&n.innerText.length>30&&!/Loading diagnostic workspace|Loading\.\.\./.test(n.innerText);},variant);return node;}
async function api(variant,path,method='GET',body,branch='hq'){
 const token=await page.evaluate(()=>localStorage.getItem('nexora-session-token'));
 const response=await fetch(`${API}/reference-modules/${variant}/api${path}`,{method,headers:{Authorization:`Bearer ${token}`,'X-Product-Id':'nexora','X-Reference-Branch':branch,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json()};
}
const url=(module,path)=>{const t=referenceNavigationTarget(module.id,path);return `${BASE}/${module.id}/${t.pageId}/${encodeURIComponent(t.recordId)}`;};
try{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('input').first().fill('admin');await page.locator('input[type=password]').fill('admin');await page.locator('button[type=submit]').click();await page.locator('header [data-tour=module]').waitFor();
 for(const module of REFERENCE_MODULES.filter(m=>['lis1','lis2','ris1'].includes(m.variant))){
  await page.locator('header [data-tour=module] button').click();await page.getByRole('listbox').getByRole('option',{name:new RegExp('^'+module.title+'(?:\\s|$)')}).click();await ready(module.variant);record(module.title+' header selection');
  const side=page.locator('aside[data-tour=sidebar]');
  const openMenu=async()=>{await page.mouse.move(700,70);const toggle=side.locator('button[aria-expanded]').first();if(await toggle.getAttribute('aria-expanded')==='false'){await toggle.focus();await toggle.press('Enter');}await side.getByRole('button',{name:'Collapse navigation',exact:true}).waitFor();};
  await openMenu();
  assert.equal(await page.locator('header [data-tour=module] button').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'Expanded sidebar must not cover module selection');
  await page.locator('header [data-tour=module] button').click();await page.getByRole('listbox').waitFor();await page.keyboard.press('Escape');await side.getByRole('button',{name:'Expand navigation',exact:true}).waitFor();record(module.title+' expanded sidebar leaves header clickable and closes outside');
  await page.mouse.move(700,70);await side.hover();await side.getByRole('button',{name:'Collapse navigation',exact:true}).waitFor();await page.mouse.move(700,70);await side.getByRole('button',{name:'Expand navigation',exact:true}).waitFor();record(module.title+' effective hover preference expands and collapses');
  await openMenu();await page.keyboard.press('Escape');await side.getByRole('button',{name:'Expand navigation',exact:true}).waitFor();record(module.title+' keyboard Escape closes sidebar');
  await openMenu();await side.getByRole('button',{name:'Collapse navigation',exact:true}).click();record(module.title+' collapsed sidebar toggles');
  const session=await api(module.variant,'/session');assert.equal(session.status,200);assert.equal(session.body.user.role,'ADMIN');record(module.title+' authenticated host actor');
  for(const destination of module.pages){
   const before=responses.length;await openMenu();await side.locator(`a[href="/${module.id}/${destination.id}"]`).click();await page.waitForURL(`${BASE}/${module.id}/${destination.id}`);const root=await ready(module.variant);await side.getByRole('button',{name:'Expand navigation',exact:true}).waitFor();
   await page.waitForTimeout(350);assert.deepEqual(responses.slice(before),[],destination.id);
   const text=await root.innerText();assert.ok(!/Diagnostic service failed|Diagnostic service unavailable|Page not found|Something went wrong/.test(text),destination.id);
   await root.screenshot({path:`${output}/${destination.id}.png`});record(module.title+' '+destination.path,{pageId:destination.id});
  }
  const name='BrowserDiagnostic'+Date.now().toString(36);
  const body=module.variant==='lis1'?{firstName:name,lastName:'Synthetic',dob:'1990-01-01',gender:'M'}:{first_name:name,last_name:'Synthetic',dob:'1990-01-01',gender:'M',sex:'M'};
  const created=await api(module.variant,'/patients','POST',body);assert.ok([200,201].includes(created.status),JSON.stringify(created.body));
  const list=await api(module.variant,'/patients?q='+name);const rows=Array.isArray(list.body)?list.body:list.body.data;assert.equal(rows.length,1);
  const other=await api(module.variant,'/patients?q='+name,'GET',undefined,'dubai');assert.equal((Array.isArray(other.body)?other.body:other.body.data).length,0);
  record(module.title+' actual API write and branch isolation');
  await page.goto(url(module,'/patients'),{waitUntil:'domcontentloaded'});const root=await ready(module.variant);const search=root.locator('input').first();await search.fill(name);await root.getByText(name,{exact:false}).first().waitFor();record(module.title+' browser renders created API record');
 }
 assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);record('no browser page or console errors');
}catch(e){await page.screenshot({path:output+'/failure.png'}).catch(()=>{});writeFileSync(output+'/failure.txt',await page.locator('body').innerText().catch(()=>''));throw e;}
finally{writeFileSync(output+'/results.json',JSON.stringify({base:BASE,api:API,results,pageErrors,consoleErrors,responses,aborted},null,2));await browser.close();}
