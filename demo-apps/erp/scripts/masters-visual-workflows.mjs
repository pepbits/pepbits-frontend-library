import assert from 'node:assert/strict';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const slugs=['countries','states','currencies','units','holidays','departments','leave-types','shifts','lab-tests'];
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1,`${label}: ${actual} differs from ${expected}`);
const measure=locator=>locator.evaluate(element=>{const css=getComputedStyle(element),rect=element.getBoundingClientRect();return {width:rect.width,height:rect.height,fontSize:parseFloat(css.fontSize),paddingInline:parseFloat(css.paddingInlineStart),paddingBlock:parseFloat(css.paddingTop),columnGap:parseFloat(css.columnGap),rowGap:parseFloat(css.rowGap),formScale:parseFloat(css.getPropertyValue('--fs-form'))||1,resultScale:parseFloat(css.getPropertyValue('--fs-result'))||1};});
export async function masterVisualWorkflows({page,visit,flows,visualChecks,capture}) {
 for(const variant of ['erp1','erp2'])for(const slug of slugs){
  const path=`/${variant}/masters/${slug}`;await visit(path);const table=page.locator('.erp-master-worklist table');await table.locator('tbody tr').first().waitFor();
  const header=await measure(table.locator('thead th').nth(variant==='erp1'?0:1)),cell=await measure(table.locator('tbody tr').first().locator('td').nth(variant==='erp1'?0:1));
  const density=await table.getAttribute('data-density'),block=density==='compact'?4:density==='spacious'?16:12,inline=density==='compact'?12:16;
  close(header.fontSize,12*header.resultScale,'header font');close(header.paddingInline,inline,'header inline padding');close(header.paddingBlock,block,'managed header padding');close(cell.fontSize,13*cell.resultScale,'row font');close(cell.paddingInline,inline,'row inline padding');close(cell.paddingBlock,block,'managed row density');
  const metrics={header,cell,density};
  if(slug==='states'&&variant==='erp1'){metrics.parent=await measure(page.locator('.erp-master-parent'));close(metrics.parent.width,288,'parent rail');await page.setViewportSize({width:1100,height:1000});metrics.parentMedium=await measure(page.locator('.erp-master-parent'));close(metrics.parentMedium.width,256,'medium parent rail');await page.setViewportSize({width:720,height:1000});await page.locator('.erp-master-parent-mobile').waitFor();assert.ok(await page.locator('.erp-master-parent-mobile').isVisible());await page.setViewportSize({width:1440,height:1000});}
  const row=table.locator('tbody tr').first(),id=await row.getByRole('button').getAttribute('aria-label');await row.getByRole('button').click();
  const editor=page.locator(variant==='erp1'?'[data-master-inline]':'[data-master-form]');await editor.waitFor();assert.equal(new URL(page.url()).pathname,path);
  if(variant==='erp1'){
   metrics.editCell=await measure(editor.locator('td').first());close(metrics.editCell.paddingInline,inline,'managed edit inline padding');close(metrics.editCell.paddingBlock,block,'managed edit block padding');
   metrics.input=await measure(editor.locator('input:not([disabled]),select:not([disabled])').first());close(metrics.input.height,density==='spacious'?36:28,'inline input');
  }else{
   metrics.dialog=await measure(page.locator('.erp-master-dialog'));metrics.fields=await measure(editor.locator('.erp-master-fields'));close(metrics.dialog.width,672,'quick dialog width');close(metrics.fields.columnGap,16,'form column gap');close(metrics.fields.rowGap,14,'form row gap');
  }
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const axe=await page.evaluate(selector=>window.axe.run(document.querySelector(selector)),variant==='erp1'?'[data-master-inline]':'[role=dialog]');assert.deepEqual(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],'master editor axe');metrics.axe={violations:0,incomplete:axe.incomplete.length};
  if(slug==='states'&&variant==='erp2'&&process.env.ERP_VISUAL_SCREENSHOT_DIR)await capture(join(process.env.ERP_VISUAL_SCREENSHOT_DIR,variant+'-states.png'));
  const saved=page.waitForResponse(response=>response.url().includes('/api/entities/'+slug+'/')&&response.request().method()==='PUT');await page.getByRole('button',{name:'Save',exact:true}).click();assert.ok((await saved).ok());await editor.waitFor({state:'detached'});await table.getByRole('button',{name:id,exact:true}).waitFor();
  visualChecks.push({path,state:'master-table-editor',source:variant==='erp1'?'WorkList.tsx / DependentTemplate.tsx':'QuickDialog.tsx / WorkList.tsx',metrics,result:'Source table/editor dimensions and save composition matched; toolbar/filter arrangement remains in parity-status.md.'});flows.push({id:variant+'-'+slug+'-master-editor',scope:'UI',result:'Source inline/dialog edit, measured table geometry, real versioned save, retained worklist and editor axe'});
  if(slug==='states'&&variant==='erp1'&&process.env.ERP_VISUAL_SCREENSHOT_DIR)await capture(join(process.env.ERP_VISUAL_SCREENSHOT_DIR,variant+'-states.png'));
 }
}
