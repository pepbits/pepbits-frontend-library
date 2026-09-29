import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {loadPlaywright} from '/home/pepadmin/pb/saas/lib/pepbits-frontend-library/desktop-clients/e2e/harness.mjs';
const base='https://frontend.test.pepbits.com',out='/tmp/healthcare-suite-existing-public';mkdirSync(out,{recursive:true});
const browser=await loadPlaywright().chromium.launch({chromiumSandbox:false});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('input').first().fill('admin');await page.locator('input[type=password]').fill('admin');await page.locator('button[type=submit]').click();await page.locator('header [data-tour=module]').waitFor();
 for(const [module,id,caption] of [['healthcare','healthcare-dashboard','Healthcare'],['healthcare','patient-master','Patient'],['library','library-dashboard','Library'],['library','list-of-pages','Page']]){
  await page.goto(`${base}/${module}/${id}`,{waitUntil:'networkidle'});await page.locator('header [data-tour=module]').waitFor();const main=page.locator('main').first();await main.waitFor();const text=await main.innerText();assert.ok(text.length>150,id);assert.equal(new URL(page.url()).pathname,`/${module}/${id}`);assert.ok(await page.locator('header [data-tour=module] button').count(),id);assert.ok(!text.includes('Page unavailable for your role'),id);await page.screenshot({path:`${out}/${id}.png`});results.push({module,pageId:id,status:'passed',readOnly:true});console.log('PASS existing '+id);
 }
 assert.deepEqual(errors,[]);
}finally{writeFileSync(`${out}/results.json`,JSON.stringify({base,sourceCommit:'cb679bea5171bbc6b4c440534a3f8cf8fc27fa3c',results,errors},null,2)+'\n');await browser.close();}
