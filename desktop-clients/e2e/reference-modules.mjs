import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {REFERENCE_MODULES,referenceNavigationTarget} from '../packages/erp-config/src/reference-modules.ts';
import {loadPlaywright,BASE,DESKTOP,API} from './harness.mjs';

const output=process.env.E2E_ARTIFACTS??'/tmp/reference-modules-browser';mkdirSync(output,{recursive:true});
const browser=await loadPlaywright().chromium.launch({chromiumSandbox:false}),results=[],errors=[];
const login=async(url,username='admin')=>{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url,{waitUntil:'networkidle'});
 if(await page.locator('input[type=password]').count()){await page.locator('input').first().fill(username);await page.locator('input[type=password]').fill(username);await page.locator('button[type=submit]').click();}
 await page.locator('header [data-tour=module]').waitFor();return page;
};
const ready=async page=>{
 const root=page.locator('.pepbits-reference-module:visible');await root.waitFor();await page.waitForLoadState('networkidle');
 await page.waitForFunction(()=>{const root=[...document.querySelectorAll('.pepbits-reference-module')].find(node=>node.getBoundingClientRect().width);return root&&root.textContent.trim().length>35&&!/Loading saved layout/.test(root.textContent);});
 return root;
};
try{
 // This sweep owns the five original reference modules (the header choices checked below). Later imports such as
 // RCM, Quality or Pharmacy have dedicated suites. Page ids must stay unique across every registered module.
 const SWEPT=['reference-reports','reference-erp1','reference-erp2','reference-school','reference-healthcare-suite'];
 const allIds=REFERENCE_MODULES.flatMap(module=>module.pages.map(page=>page.id));assert.equal(new Set(allIds).size,allIds.length,'duplicate reference page id');
 assert.deepEqual(SWEPT.filter(id=>!REFERENCE_MODULES.some(module=>module.id===id)),[],'swept module missing from the registry');
 const web=await login(BASE);const pages=REFERENCE_MODULES.filter(module=>SWEPT.includes(module.id)).flatMap(module=>module.pages.map(page=>({...page,moduleId:module.id,variant:module.variant})));
 assert.ok(pages.length>0);
 for(const page of pages){
  const failures=[];const watch=response=>{if(response.url().includes('/reference-modules/')&&response.status()>=400)failures.push({url:response.url(),status:response.status()});};web.on('response',watch);
  await web.goto(`${BASE}/${page.moduleId}/${page.id}`,{waitUntil:'networkidle'});const root=await ready(web);const text=await root.innerText();
  assert.ok(!/\b(?:school|erp)\.[a-zA-Z]+\b/.test(text),`${page.id}: untranslated service code`);assert.ok(!/Something went wrong on the server|Invalid lookup response|Missing or invalid lookup/.test(text),`${page.id}: API contract failure`);
  assert.deepEqual(failures,[],`${page.id}: failed API response`);web.off('response',watch);results.push({pageId:page.id,path:page.path,status:'passed',textLength:text.length});writeFileSync(`${output}/progress.json`,JSON.stringify({completed:results.length,lastPageId:page.id})+'\n');if(results.length%20===0)console.log(`Checked ${results.length}/${pages.length} reference pages`);
 }
 const token=await web.evaluate(()=>localStorage.getItem('nexora-session-token'));
 const schoolResources=async resource=>{const response=await fetch(`${API}/reference-modules/school/api/${resource}`,{headers:{Authorization:`Bearer ${token}`,'X-Reference-Branch':'hq'}});assert.equal(response.status,200);return(await response.json()).data;};
 const quizId=(await schoolResources('quizzes'))[0].id,liveId=(await schoolResources('live'))[0].id;
 const dynamic=[['reference-reports','/reports/trial-balance'],['reference-reports','/builder/new'],['reference-reports','/dashboards/finance-daily'],['reference-erp2','/masters/customers/new'],['reference-school',`/quizzes/${quizId}`],['reference-school',`/live/${liveId}`]];
 for(const[moduleId,path]of dynamic){const target=referenceNavigationTarget(moduleId,path);const url=`${BASE}/${moduleId}/${target.pageId}/${encodeURIComponent(target.recordId)}`;await web.goto(url,{waitUntil:'networkidle'});const root=await ready(web);assert.ok((await root.innerText()).length>35);results.push({moduleId,path,status:'passed'});await root.screenshot({path:`${output}/${moduleId}-${path.replace(/[^a-zA-Z0-9]+/g,'-')}.png`});}
 const desktop=await login(DESKTOP);await desktop.locator('header [data-tour=module] button').click();const menu=desktop.getByRole('listbox');await menu.waitFor();
 for(const label of ['Reports','ERP 1','ERP 2','School Administrator','Healthcare Suite'])assert.ok(await menu.getByText(label,{exact:true}).count(),`missing module choice ${label}`);await desktop.keyboard.press('Escape');
 for(const page of [pages.find(page=>page.id==='reference-reports-overview'),pages.find(page=>page.id==='reference-erp1-masters-customers'),pages.find(page=>page.id==='reference-erp2-masters-customers'),pages.find(page=>page.id==='reference-school-students')]){
  await desktop.keyboard.press('Control+k');const dialog=desktop.getByRole('dialog');await dialog.locator('input').first().fill(page.id);await dialog.locator('button.group').first().click();const root=await ready(desktop);await root.screenshot({path:`${output}/${page.id}.png`});results.push({desktopPageId:page.id,status:'passed'});
 }
 assert.deepEqual(errors,[]);console.log(`PASS ${pages.length} static reference destinations, dynamic host URLs, five reference header module choices and desktop rendering; no page errors.`);
}finally{writeFileSync(`${output}/results.json`,JSON.stringify({results,errors},null,2)+'\n');await browser.close();}
