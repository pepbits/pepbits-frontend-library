import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {REFERENCE_MODULES,referenceNavigationTarget} from '/home/pepadmin/pb/saas/lib/pepbits-frontend-library/desktop-clients/packages/erp-config/src/reference-modules.ts';
import {loadPlaywright,BASE,DESKTOP,API} from '/home/pepadmin/pb/saas/lib/pepbits-frontend-library/desktop-clients/e2e/harness.mjs';

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
 const web=await login(BASE);const pages=REFERENCE_MODULES.flatMap(module=>module.pages.map(page=>({...page,moduleId:module.id,variant:module.variant})));
 assert.equal(pages.length,175);assert.equal(new Set(pages.map(page=>page.id)).size,175);
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
 assert.deepEqual(errors,[]);console.log(`PASS ${pages.length} public HTTPS static reference destinations and six dynamic URLs; no page errors.`);
}finally{writeFileSync(`${output}/results.json`,JSON.stringify({scope:'public HTTPS web only; 175 static and six dynamic destinations',base:BASE,api:API,sourceCommit:'cb679bea5171bbc6b4c440534a3f8cf8fc27fa3c',results,errors},null,2)+'\n');await browser.close();}
