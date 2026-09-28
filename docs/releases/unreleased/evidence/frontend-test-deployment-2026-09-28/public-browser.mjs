import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {REFERENCE_MODULES,referenceNavigationTarget} from '../../../../../desktop-clients/packages/erp-config/src/reference-modules.ts';
import {loadPlaywright,BASE,DESKTOP,API} from '../../../../../desktop-clients/e2e/harness.mjs';

const output=process.env.E2E_ARTIFACTS??'/tmp/reference-modules-browser';mkdirSync(output,{recursive:true});
const browser=await loadPlaywright().chromium.launch({chromiumSandbox:false,args:process.env.E2E_DNS_OVERRIDE?['--host-resolver-rules=MAP frontend.test.pepbits.com '+process.env.E2E_DNS_OVERRIDE]:[]}),results=[],errors=[];
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
 const web=await login(BASE);const pages=REFERENCE_MODULES.flatMap(module=>module.pages.map(page=>({...page,moduleId:module.id,variant:module.variant})));
 assert.equal(pages.length,152);assert.equal(new Set(pages.map(page=>page.id)).size,152);
 for(const page of pages){
  const failures=[];const watch=response=>{if(response.url().includes('/reference-modules/')&&response.status()>=400)failures.push({url:response.url(),status:response.status()});};web.on('response',watch);
  await web.goto(`${BASE}/${page.moduleId}/${page.id}`,{waitUntil:'networkidle'});const root=await ready(web);const text=await root.innerText();
  assert.ok(!/\b(?:school|erp)\.[a-zA-Z]+\b/.test(text),`${page.id}: untranslated service code`);assert.ok(!/Something went wrong on the server|Invalid lookup response|Missing or invalid lookup/.test(text),`${page.id}: API contract failure`);
  assert.deepEqual(failures,[],`${page.id}: failed API response`);web.off('response',watch);results.push({pageId:page.id,path:page.path,status:'passed',textLength:text.length});writeFileSync(`${output}/progress.json`,JSON.stringify({completed:results.length,lastPageId:page.id})+'\n');if(results.length%20===0)console.log(`Checked ${results.length}/${pages.length} reference pages`);
 }
 const schoolResources=async resource=>{const result=await web.evaluate(async resource=>{const token=localStorage.getItem('nexora-session-token');const response=await fetch('/api/reference-modules/school/api/'+resource,{headers:{Authorization:'Bearer '+token,'X-Reference-Branch':'hq'}});return{status:response.status,data:await response.json()};},resource);assert.equal(result.status,200);return result.data.data;};
 const quizId=(await schoolResources('quizzes'))[0].id,liveId=(await schoolResources('live'))[0].id;
 const dynamic=[['reference-reports','/reports/trial-balance'],['reference-reports','/builder/new'],['reference-reports','/dashboards/finance-daily'],['reference-erp2','/masters/customers/new'],['reference-school',`/quizzes/${quizId}`],['reference-school',`/live/${liveId}`]];
 for(const[moduleId,path]of dynamic){const target=referenceNavigationTarget(moduleId,path);const url=`${BASE}/${moduleId}/${target.pageId}/${encodeURIComponent(target.recordId)}`;await web.goto(url,{waitUntil:'networkidle'});const root=await ready(web);assert.ok((await root.innerText()).length>35);results.push({moduleId,path,status:'passed'});await root.screenshot({path:`${output}/${moduleId}-${path.replace(/[^a-zA-Z0-9]+/g,'-')}.png`});}
 await web.locator('header [data-tour=module] button').click();const menu=web.getByRole('listbox');await menu.waitFor();
 for(const label of ['Reports','ERP 1','ERP 2','School'])assert.ok(await menu.getByText(label,{exact:true}).count(),'missing module '+label);await web.keyboard.press('Escape');
 for(const page of [pages.find(p=>p.id==='reference-reports-overview'),pages.find(p=>p.id==='reference-erp1-masters-customers'),pages.find(p=>p.id==='reference-erp2-masters-customers'),pages.find(p=>p.id==='reference-school-students')]){await web.goto(BASE+'/'+page.moduleId+'/'+page.id,{waitUntil:'networkidle'});await ready(web);await web.screenshot({path:output+'/'+page.id+'.png'});results.push({publicWebModulePage:page.id,status:'passed'});}
 assert.deepEqual(errors,[]);console.log('PASS public HTTPS web: 152 static destinations, six dynamic URLs, four module-header choices and four representative rendered pages; no page errors. Certificate verification enabled; any DNS override is supplied explicitly through E2E_DNS_OVERRIDE.');
}finally{writeFileSync(`${output}/results.json`,JSON.stringify({results,errors},null,2)+'\n');await browser.close();}
