import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SHOWCASE_PLAYWRIGHT_PATH??'playwright');
const base=process.env.SHOWCASE_BASE??'http://127.0.0.1:3300';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local smoke only');
const evidence=resolve(process.env.SHOWCASE_EVIDENCE??'docs/releases/unreleased/evidence/restructure-phase-6a-2026-10-23');mkdirSync(evidence,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.SHOWCASE_CHROMIUM});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
let currentArea='startup';
const errors=[],checks=[];page.on('pageerror',error=>errors.push({area:currentArea,message:error.message}));
const consoleErrors=[];page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
const routes=['foundations','ui','components','patterns','page-engines','playground','shell','ai'];
try {
 for(const area of routes){currentArea=area;
  await page.goto(base+'/'+area);await page.locator('.page-heading h1').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.theme==='nexora');
  await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const result=await page.evaluate(async()=>{const result=await window.axe.run(document);return {violations:result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))})),passes:result.passes.length,incomplete:result.incomplete.length};});
  checks.push({area,...result});
 }
 await page.goto(base+'/playground');await page.getByRole('switch',{name:'Lock density',exact:true}).click();
 const density=page.getByRole('combobox',{name:'Density',exact:true}).first();if(!await density.isDisabled()||await density.inputValue()!=='compact')throw new Error('Density lock failed');
 await page.getByRole('switch',{name:'Restrict page sizes',exact:true}).click();if(await page.getByRole('combobox',{name:'pageSize',exact:true}).locator('option').count()!==2)throw new Error('Allowed page sizes failed');
 await page.locator('aside').getByRole('combobox',{name:'Language',exact:true}).selectOption('ar');await page.waitForFunction(()=>document.documentElement.dir==='rtl');
 await page.screenshot({path:resolve(evidence,'playground-rtl.png'),fullPage:false});
 // Client navigation retains the accepted session-only preferences and policy.
 await page.locator('nav a[href="/components"]').click();await page.locator('.page-heading h1').waitFor();if(await page.locator('html').getAttribute('dir')!=='rtl')throw new Error('Client navigation reset language');
 await page.locator('aside select').nth(1).selectOption('en');await page.waitForFunction(()=>document.documentElement.dir==='ltr');
 await page.getByRole('button',{name:'Modal',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.locator('nav a[href="/page-engines"]').click();await page.getByRole('textbox',{name:/Item name/}).fill('Browser fictional item');await page.locator('[data-example="form"]').getByRole('button',{name:'Save',exact:true}).click();await page.locator('[data-example="form"]').getByText('Saved',{exact:true}).waitFor();
 await page.screenshot({path:resolve(evidence,'page-engines.png'),fullPage:false});
 for(const language of ['hi','ml']){await page.locator('aside select').nth(1).selectOption(language);await page.waitForFunction(language=>document.documentElement.lang===language,language);}
 const summary={scope:'Local next start, fictional in-memory adapters; not deployed/native',routes:checks.length,checks,interactionChecks:8,pageErrors:errors,consoleErrors};writeFileSync(resolve(evidence,'browser.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify(summary,null,2));
 if(errors.length||consoleErrors.length||checks.some(check=>check.violations.length))process.exitCode=1;
} finally {await browser.close();}
