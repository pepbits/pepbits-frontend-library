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
 const pages=REFERENCE_MODULES.flatMap(module=>module.pages.map(page=>({...page,moduleId:module.id,variant:module.variant})));
 const desktop=await login(DESKTOP);await desktop.locator('header [data-tour=module] button').click();const menu=desktop.getByRole('listbox');await menu.waitFor();
 for(const label of ['Reports','ERP 1','ERP 2','School Administrator','Healthcare Suite'])assert.ok(await menu.getByText(label,{exact:true}).count(),`missing module choice ${label}`);await desktop.keyboard.press('Escape');
 for(const page of [pages.find(page=>page.id==='reference-reports-overview'),pages.find(page=>page.id==='reference-erp1-masters-customers'),pages.find(page=>page.id==='reference-erp2-masters-customers'),pages.find(page=>page.id==='reference-school-students')]){
  await desktop.keyboard.press('Control+k');const dialog=desktop.getByRole('dialog');await dialog.locator('input').first().fill(page.id);await dialog.locator('button.group').first().click();const root=await ready(desktop);await root.screenshot({path:`${output}/${page.id}.png`});results.push({desktopPageId:page.id,status:'passed'});
 }
 assert.deepEqual(errors,[]);console.log(`PASS four production desktop-browser destinations and five reference header module choices; no page errors.`);
}finally{writeFileSync(`${output}/results.json`,JSON.stringify({scope:'four local production desktop-browser destinations, five header choices',desktop:DESKTOP,api:API,sourceCommit:'cb679bea5171bbc6b4c440534a3f8cf8fc27fa3c',results,errors},null,2)+'\n');await browser.close();}
