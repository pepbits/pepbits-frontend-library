import {masterVisualWorkflows} from './masters-visual-workflows.mjs';
import assert from 'node:assert/strict';
import {join} from 'node:path';

/** Source dimensions are from the read-only JSX/CSS audit; this does not render the original app. */
export async function visualWorkflows({page,visit,flows,visualChecks,capture}) {
 await masterVisualWorkflows({page,visit,flows,visualChecks,capture});
 const measure=async(selector)=>page.locator(selector).first().evaluate(element=>{const css=getComputedStyle(element),rect=element.getBoundingClientRect();return {width:rect.width,height:rect.height,fontSize:parseFloat(css.fontSize),padding:css.padding,gap:css.gap,gridTemplateColumns:css.gridTemplateColumns,density:element.closest('[data-density]')?.getAttribute('data-density'),formScale:parseFloat(css.getPropertyValue('--fs-form'))||1,resultScale:parseFloat(css.getPropertyValue('--fs-result'))||1};});
 const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1,`geometry ${actual} differs from source ${expected}`);
 const receipt=(path,state,source,metrics)=>{visualChecks.push({path,state,source,metrics,result:'Selected source dimensions match; whole-destination differences remain in parity-status.md.'});flows.push({id:path+'-'+state,scope:'UI',result:'Computed-style comparison against original source CSS: '+state});};
 const screenshot=async(name)=>{if(process.env.ERP_VISUAL_SCREENSHOT_DIR)await capture(join(process.env.ERP_VISUAL_SCREENSHOT_DIR,name+'.png'));};
 for(const variant of ['erp1','erp2']) {
  for(const slug of ['appointments','room-bookings']) {
   const path=`/${variant}/transactions/${slug}`;await visit(path);
   const slot=await measure('[data-timeline-resource] button:not([data-timeline-event])'),gutter=await measure('[data-resource-timeline] > div > div:first-child');
   close(slot.height,30*(slot.density==='compact'?.8:slot.density==='spacious'?1.2:1));close(gutter.width,56);
   await page.getByRole('radio',{name:'List',exact:true}).click();await page.locator('tbody tr').first().locator('td').nth(2).click();await page.locator('[data-booking-summary]').waitFor();
   const metrics={slot,gutter,summary:await measure('[data-booking-summary]'),time:await measure('[data-booking-summary] strong')};
   close(metrics.time.fontSize,(variant==='erp1'?20:26)*metrics.time.formScale);
   if(variant==='erp1'){metrics.drawer=await measure('[role=dialog] > aside');close(metrics.drawer.width,360);assert.equal(await page.locator('[data-erp-booking]').count(),1);}else{metrics.aside=await measure('[data-record-aside]');close(metrics.aside.width,340);}
   receipt(path,'booking-composition','BookingTemplate.tsx / MoreRecords.tsx',metrics);
   if(slug==='appointments')await screenshot(variant+'-booking');
  }
  for(const slug of ['customers','suppliers','items','employees','patients','doctors','students','vehicles']) {
   const path=`/${variant}/masters/${slug}`;await visit(path);
   if(variant==='erp2')await page.locator('tbody tr').first().locator('td').nth(2).click();
   else if(await page.getByRole('radio',{name:'Full table',exact:true}).getAttribute('aria-checked')==='true'){await page.getByRole('radio',{name:'List and details side by side',exact:true}).click();}
   await page.locator('[data-profile-summary]').waitFor();await page.waitForFunction(()=>!document.querySelector('main [aria-busy=true]'));
   const avatar=await measure('.erp-profile-avatar'),stats=await measure('.erp-profile-stats'),label=await measure('[data-record-page] .erp-field-label'),value=await measure('[data-record-page] .erp-field-value');close(avatar.width,48);close(label.fontSize,12*label.resultScale);close(value.fontSize,13.5*value.resultScale);
   receipt(path,'profile-statistics',variant==='erp1'?'ProfileTemplate.tsx':'ProfileRecord.tsx',{avatar,stats,label,value});
  }
  for(const slug of ['support-tickets','maintenance-requests']) {
   const path=`/${variant}/transactions/${slug}`;await visit(path);await page.locator('[data-board-item]').first().getByRole('button').click();await page.locator('[data-case-conversation]').waitFor();
   const context=await measure(variant==='erp1'?'[role=dialog] > aside':'[data-record-aside]');close(context.width,variant==='erp1'?460:340);
   receipt(path,'case-context',variant==='erp1'?'CaseTemplate.tsx':'MoreRecords.tsx',{context});
   if(variant==='erp1') {
    await page.getByRole('dialog').getByRole('button',{name:'Back',exact:true}).click();
    await page.getByRole('radio',{name:'List',exact:true}).click();
    const row=page.locator('tbody tr').first();await row.waitFor();
    const code=(await row.locator('td').nth(1).textContent()).trim(),subject=(await row.locator('td').nth(2).textContent()).trim();
    const search=page.getByRole('textbox',{name:'Search',exact:true});await search.fill(subject);
    const selectedRow=page.locator('tbody tr').filter({has:page.getByText(code,{exact:true})});
    await selectedRow.getByText(subject,{exact:true}).click();
    const dialog=page.getByRole('dialog'),stage=dialog.getByRole('combobox',{name:'Stage'});
    const previous=await stage.inputValue(),next=await stage.locator('option').evaluateAll((options,current)=>options.find(option=>option.value&&!option.disabled&&option.value!==current).value,previous);
    const saved=page.waitForResponse(response=>response.url().includes('/api/entities/'+slug+'/')&&response.request().method()==='PUT');
    await stage.selectOption(next);assert.ok((await saved).ok());
    await dialog.getByRole('button',{name:'Back',exact:true}).click();
    await selectedRow.getByText(next,{exact:true}).waitFor();
    assert.equal(await search.inputValue(),subject);assert.equal(await page.getByRole('radio',{name:'List',exact:true}).getAttribute('aria-checked'),'true');
    flows.push({id:variant+'-'+slug+'-list-save',scope:'UI',result:'Drawer stage save refreshes the retained list through HTTP and preserves search'});
   }
  }
  if(variant==='erp2')for(const slug of ['org-structure','chart-of-accounts','product-categories']) {
   const path=`/${variant}/masters/${slug}`;await visit(path);await page.locator('[data-hierarchy] button[aria-pressed]').first().click();await page.locator('.erp-tree-breadcrumbs').waitFor();
   const context=await measure('[data-record-aside]'),breadcrumbs=await measure('.erp-tree-breadcrumbs');close(context.width,380);
   receipt(path,'hierarchy-record','MoreRecords.tsx',{context,breadcrumbs});
  }
  for(const slug of ['sales-register','purchase-register','stock-summary','receivables-aging']) {
   const path=`/${variant}/reports/${slug}`;const layoutRead=()=>page.waitForResponse(response=>response.url().includes('/api/view-state?key=keystone.cols.'+slug)&&response.request().method()==='GET');let layoutLoaded=layoutRead();await visit(path);assert.ok((await layoutLoaded).ok());await page.locator('tbody tr').first().waitFor();const count=await page.locator('thead th').count();
   const saved=key=>page.waitForResponse(response=>response.url().includes('/api/view-state')&&response.request().method()==='PUT'&&response.request().postDataJSON()?.key===key);
   await page.getByRole('button',{name:'Columns',exact:true}).click();let dialog=page.getByRole('dialog');const chosen=dialog.locator('button[aria-pressed=true]').last(),label=await chosen.getAttribute('aria-label');
   let accepted=saved('keystone.cols.'+slug);await chosen.click();assert.ok((await accepted).ok());await dialog.getByRole('button',{name:'Done',exact:true}).click();
   layoutLoaded=layoutRead();await page.reload();assert.ok((await layoutLoaded).ok());await page.getByRole('button',{name:'Columns',exact:true}).waitFor();await page.waitForFunction(expected=>document.querySelectorAll('thead th').length===expected,count-1);
   await page.getByRole('button',{name:'Saved views',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('textbox',{name:'View name'}).fill('Fictional report columns');accepted=saved('keystone.views.'+slug);await dialog.getByRole('button',{name:'Save column set',exact:true}).click();assert.ok((await accepted).ok());
   await dialog.getByRole('button',{name:'Apply Fictional report columns',exact:true}).click();
   await page.getByRole('button',{name:'Columns',exact:true}).click();dialog=page.getByRole('dialog');accepted=saved('keystone.cols.'+slug);await dialog.getByRole('button',{name:'Reset',exact:true}).click();assert.ok((await accepted).ok());await dialog.getByRole('button',{name:'Done',exact:true}).click();
   await page.getByRole('button',{name:'Saved views',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Apply Fictional report columns',exact:true}).click();await page.waitForFunction(expected=>document.querySelectorAll('thead th').length===expected,count-1);
   await page.getByRole('button',{name:'Saved views',exact:true}).click();dialog=page.getByRole('dialog');accepted=saved('keystone.views.'+slug);await dialog.getByRole('button',{name:'Delete Fictional report columns',exact:true}).click();assert.ok((await accepted).ok());await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'Columns',exact:true}).click();dialog=page.getByRole('dialog');accepted=saved('keystone.cols.'+slug);await dialog.getByRole('button',{name:'Reset',exact:true}).click();assert.ok((await accepted).ok());await dialog.getByRole('button',{name:'Done',exact:true}).click();
   flows.push({id:variant+'-'+slug+'-column-layout',scope:'UI',result:'Hide '+label+', reload persisted layout; save/apply/delete column snapshot and reset through real HTTP'});
   if(variant==='erp2'&&slug==='sales-register')await screenshot('erp2-report-columns');
  }
 }
}

export async function catalogueGeometry(page,path) {
 return page.locator('main').evaluate((main,path)=>{const root=main.querySelector('[data-erp-page]')??main.querySelector('section'),cell=main.querySelector('tbody td'),timeline=main.querySelector('[data-resource-timeline]');const styles=element=>element?{width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height,padding:getComputedStyle(element).padding,fontSize:getComputedStyle(element).fontSize}:null;return {path,page:styles(root),firstCell:styles(cell),timeline:styles(timeline),scope:'Demo computed styles; see source-visual-audit.json and parity-status.md for source comparisons and remaining differences.'};},path);
}
