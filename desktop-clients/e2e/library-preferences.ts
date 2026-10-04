import assert from 'node:assert/strict';
import {MODULES,PAGE_REGISTRY} from '../packages/erp-config/src/navigation.ts';
import {loadPlaywright} from './harness.mjs';
const ids=new Set<string>();
function collect(value:unknown){if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object'){const node=value as Record<string,unknown>;if(typeof node.pageId==='string')ids.add(node.pageId);Object.values(node).forEach(collect);}}
collect(MODULES.library.navigation);
const checkedIds=process.env.E2E_LIBRARY_PAGES?.split(',')??[...ids];
for(const id of checkedIds)assert.ok(ids.has(id),`Unknown Library page ${id}`);
const LIBRARY_SURFACES=['[data-component-catalog]','[data-library-reference]','[data-page-library-catalog]','[data-designer]','[data-care-page]','[data-billing-clinic]','[data-clinical-document]','[data-op-registration]','[data-label-library]','[data-device-library]','[data-identity-library]'].join(', ');
const engine=process.env.E2E_BROWSER??'chromium';
const browser=await loadPlaywright()[engine].launch({chromiumSandbox:false});
try {
 const context=await browser.newContext({viewport:{width:1800,height:1100}}),page=await context.newPage();page.setDefaultTimeout(30000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const preferences:Record<string,unknown>={sidebarPinned:true,reducedMotion:true,floatingWindows:false,formNavigation:'rail',resultView:'table',previewMode:'left-drawer',pageSize:10,density:'spacious',zebraStripes:false,wrapCellText:true,stickyTableHeader:false,cornerRadius:0,fontSizeForm:17,fontSizeResult:15,currencyCode:'USD',language:'en',keyboardShortcuts:true};
 const density=process.env.E2E_DENSITY??'spacious';preferences.density=density;
 const expectedPadding=density==='compact'?'4px':density==='comfortable'?'12px':'16px';
 const policy={revision:1,rules:Object.fromEntries(['formNavigation','resultView','pageSize','previewMode','density','zebraStripes'].map(key=>[key,{locked:true,value:preferences[key]}]))};
 await context.route('**/preferences',async route=>{if(route.request().method()==='PUT'){const body=route.request().postDataJSON();for(const [key,value] of Object.entries(body.preferences??body))if(!policy.rules[key])preferences[key]=value;}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({preferences,policy})});});
 await page.goto(process.env.E2E_DESKTOP??'http://127.0.0.1:3109');await page.getByPlaceholder('user1').fill('admin');await page.locator('input[type=password]').fill('admin');await page.locator('button[type=submit]').click();await page.locator('header').first().waitFor();
 async function open(id:string){
  if(await page.getByRole('tab').count()>=10 && await page.getByRole('button',{name:'Tab options',exact:true}).count()){await page.getByRole('button',{name:'Tab options',exact:true}).click();await page.getByRole('button',{name:'Close other tabs',exact:true}).click();}
  await page.keyboard.press('Control+k');const dialog=page.getByRole('dialog');await dialog.locator('input').first().fill(id);await dialog.locator('button.group').first().click();const root=page.locator(`.library-preferences[data-page-id="${id}"]:visible`).last();await root.waitFor();return root;
 }
 for(const id of checkedIds){
  const root=await open(id),definition=PAGE_REGISTRY[id];
  if(id.startsWith('template-')||id==='page-templates')await root.locator(`[data-template-library="${id}"]`).waitFor();
  else if(id.startsWith('allyvora-'))await root.locator(`[data-clinical-library="${id}"]`).waitFor();
  // Every Library page must render a recognised Library surface: the component catalog or reference pages, or the
  // root of a dedicated feature page added later (Page Library list, DCP designer, care pages, billing, clinical
  // documents, OP registration, labels, devices, identity readers).
  else if(definition.kind==='library')await root.locator(LIBRARY_SURFACES).first().waitFor();
  assert.equal(await root.locator('table:not([data-managed-table="true"])').count(),0,id);
  for(const table of await root.locator('table[data-managed-table="true"]:visible').all()){
   assert.equal(await table.getAttribute('data-density'),density,id);assert.equal(await table.getAttribute('data-striped'),'false',id);assert.equal(await table.getAttribute('data-wrap'),'true',id);
   const cell=table.locator('tbody td').first();if(await cell.count()){const style=await cell.evaluate(e=>({padding:getComputedStyle(e).paddingTop,wrap:getComputedStyle(e).whiteSpace}));assert.equal(style.padding,expectedPadding,id);assert.equal(style.wrap,'normal',id);}
  }
  console.log(`PASS route ${id}`);
 }
 let root=await open('template-patient-master');assert.ok(await root.getByLabel('Preview layout').isDisabled());
 root=await open('table-components');assert.ok(await root.getByRole('switch',{name:'Compact',exact:true}).isDisabled());
 root=await open('allyvora-patient-query');await root.locator('[data-clinical-query]').waitFor();await root.getByRole('textbox',{name:'MRN / UHID',exact:true}).fill('DEMO-');await root.getByRole('button',{name:'Search',exact:true}).click();await root.locator('tbody tr').first().waitFor();
 assert.equal(await root.getByRole('tab',{name:'Cards',exact:true}).count(),0);assert.equal(await root.getByRole('tab',{name:'Inline',exact:true}).count(),0);assert.ok(await root.getByRole('combobox',{name:'Rows per page'}).isDisabled());
 assert.equal(await root.locator('tbody td').first().evaluate(e=>getComputedStyle(e).paddingTop),expectedPadding);const scales=await root.locator('[data-clinical-query]').evaluate(e=>({form:parseFloat(getComputedStyle(e).getPropertyValue('--fs-scale')),result:parseFloat(getComputedStyle(e.querySelector('table')!).getPropertyValue('--fs-scale')),radius:getComputedStyle(e.firstElementChild!).borderRadius}));
 assert.ok(Math.abs(scales.form-17/13)<0.001);assert.ok(Math.abs(scales.result-15/13)<0.001);assert.equal(scales.radius,'0px');
 const badge=root.locator('table').getByText('Active',{exact:true}).first();if(await badge.count())assert.equal(await badge.evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');
 await root.locator('tbody tr').first().locator('button').first().click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.screenshot({path:'/tmp/library-preferences-query.png'});
 assert.deepEqual(errors,[]);console.log(`PASS ${checkedIds.length} Library destinations, managed table CSS, template/query locks and clinical preview`);await context.close();
}finally{await browser.close();}
