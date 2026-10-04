// Isolated API only. Preferences are intercepted; no real account preferences change.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const editLabels=Object.fromEntries(['en','ar','hi','ml'].map(lang=>[lang,JSON.parse(readFileSync(new URL(`../../dummy-api/config/localization/shared/${lang}.json`,import.meta.url),'utf8')).messages['Edit {item}'].replace('{item}','CUS-02401')]));
import {loadPlaywright} from './harness.mjs';
const {chromium}=loadPlaywright();
const browser=await chromium.launch({chromiumSandbox:false});
const errors=[];
async function openPage(page,query){
 await page.keyboard.press('Control+k');
 const dialog=page.getByRole('dialog');
 await dialog.locator('input').first().fill(query);
 await dialog.locator('button.group').first().click();
}
async function changeLanguage(page,language){
 await openPage(page,'My Preferences');
 await page.getByRole('tab').filter({hasText:/Language & help|اللغة والمساعدة|भाषा और सहायता|ഭാഷയും സഹായവും/}).click();
 await page.locator('[data-tour="prefs-lang"] select').selectOption(language);
}

try {
 for(const placement of ['left','right']) {
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  let preferences={sidebarPinned:true,sidebarPlacement:placement,reducedMotion:true,floatingWindows:false,openRecordsIn:'same-tab',language:'en'};
  await context.route(url=>url.pathname==='/preferences',async route=>{if(route.request().method()==='PUT')Object.assign(preferences,route.request().postDataJSON().preferences??route.request().postDataJSON());await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({preferences})});});
  await page.goto(process.env.E2E_DESKTOP??'http://127.0.0.1:3109');
  await page.getByPlaceholder('user1').fill('admin');await page.locator('input[type=password]').fill('admin');await page.locator('button[type=submit]').click();await page.locator('header').waitFor();
  await page.keyboard.press('Control+k');await page.getByPlaceholder('Search pages, modules and actions…').fill('Customer Master');await page.getByRole('dialog').getByRole('button').filter({hasText:'Customer Master'}).first().click();
  await page.getByRole('button',{name:'Edit CUS-02401',exact:true}).waitFor();
  for(const [language,title] of [['ar','سجل العملاء'],['hi','ग्राहक मास्टर'],['ml','ഉപഭോക്തൃ മാസ്റ്റർ'],['en','Customer Master']]){
   await changeLanguage(page,language);
   await openPage(page,'Customer Master');
   await page.waitForFunction(lang=>document.documentElement.lang===lang,language);
   assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
   const heading=await page.locator('header h1').innerText();assert.equal(heading,title);
   const sidebar=await page.locator('aside[data-tour=sidebar]').boundingBox(),main=await page.locator('main').boundingBox();
   assert.ok(placement==='left'?main.x>=sidebar.x+sidebar.width-1:main.x+main.width<=sidebar.x+1,`${language}: ${placement} sidebar overlaps content`);
   assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true);
   // Wait for the re-rendered rows; count() does not wait, and the table can lag the language switch.
   assert.ok(await page.getByRole('button',{name:editLabels[language],exact:true}).first().waitFor({timeout:15000}).then(()=>true,()=>false),'record IDs remain stable');
   if(placement==='left'&&language==='ar')await page.screenshot({path:'/tmp/localization-ar.png'});
  }
  assert.equal(await page.locator('header select').count(),0,'language setting belongs in Preferences');
  await changeLanguage(page,'ml');
  await page.waitForTimeout(700);await page.reload();await page.locator('header').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'ml');
  await context.close();console.log(`PASS four languages, ${placement} sidebar geometry, stable record IDs, preference reload`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
