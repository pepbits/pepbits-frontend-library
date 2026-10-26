import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
const slugs=['sales-orders','sales-invoices','purchase-orders','goods-receipts','journal-vouchers','payment-vouchers','petty-cash'];
/** Read-only source JSX/CSS targets; browser measurements cover this demo, not the original runtime. */
export async function transactionVisualWorkflows({page,visit,flows,visualChecks,checks,capture}) {
 const measure=selector=>page.locator(selector).first().evaluate(element=>{const css=getComputedStyle(element),rect=element.getBoundingClientRect();return {width:rect.width,height:rect.height,fontSize:parseFloat(css.fontSize),paddingTop:parseFloat(css.paddingTop),paddingInlineStart:parseFloat(css.paddingInlineStart),gap:parseFloat(css.gap),columns:css.gridTemplateColumns,formScale:parseFloat(css.getPropertyValue('--fs-form'))||1,resultScale:parseFloat(css.getPropertyValue('--fs-result'))||1,density:element.closest('[data-density]')?.getAttribute('data-density')};});
 const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1,`${label}: ${actual} differs from source ${expected}`);
 let sourceCascade;
 for(const variant of ['erp1','erp2'])for(const slug of slugs) {
  const path=`/${variant}/transactions/${slug}`;await visit(path);await page.locator('tbody tr').first().locator('td').nth(2).click();await page.locator('[data-transaction-document]').waitFor();await page.waitForFunction(()=>!document.querySelector('main [aria-busy=true]'));
  const voucher=['journal-vouchers','payment-vouchers','petty-cash'].includes(slug),root=page.locator('[data-transaction-document]'),table=root.locator('[data-tabular-field-rows]');
  // A small source-class fixture verifies specificity using the same Tailwind generator.
  // It is not a render of the original desktop module and is removed before axe/capture.
  sourceCascade??=await page.evaluate(()=>['compact','comfortable','spacious'].map(density=>{
   const table=document.createElement('table'),body=document.createElement('tbody'),row=document.createElement('tr'),cell=document.createElement('td');
   table.className=density==='compact'?'[&_td]:px-3 [&_td]:py-1':density==='spacious'?'[&_td]:px-4 [&_td]:py-4':'[&_td]:px-4 [&_td]:py-3';
   table.style.cssText='position:absolute;visibility:hidden;inset:0';cell.className='border-b px-1.5 py-1';cell.textContent='Source padding';row.append(cell);body.append(row);table.append(body);document.body.append(table);
   const css=getComputedStyle(cell),result={density,block:parseFloat(css.paddingTop),inline:parseFloat(css.paddingInlineStart)};table.remove();return result;
  }));
  for(const sample of sourceCascade){close(sample.block,sample.density==='compact'?4:sample.density==='spacious'?16:12,'source density cascade block');close(sample.inline,sample.density==='compact'?12:16,'source density cascade inline');}
  const metrics={sourceCascade,aside:await measure('[data-transaction-document] [data-record-aside]'),composition:await measure('[data-transaction-document] [data-record-composition]'),heading:await measure('[data-tabular-field-rows] h3'),columnHeading:await measure('[data-tabular-field-rows] th'),cell:await measure('[data-tabular-field-rows] tbody tr:first-child td:nth-child(2)'),total:await measure('.erp-document-totals [data-total] dd')};
  close(metrics.aside.width,variant==='erp1'?300:320,'summary rail');close(metrics.composition.gap,variant==='erp1'?12:16,'composition gap');close(metrics.heading.fontSize,13*metrics.heading.formScale,'line title');close(metrics.columnHeading.fontSize,12*metrics.columnHeading.resultScale,'column title');close(metrics.total.fontSize,(voucher?13:20)*metrics.total.resultScale,'summary total');
  const expectedCell=metrics.cell.density==='compact'?4:metrics.cell.density==='spacious'?16:12;close(metrics.cell.paddingTop,expectedCell,'line padding');close(metrics.cell.paddingInlineStart,metrics.cell.density==='compact'?12:16,'managed line inline padding');
  assert.equal(await table.locator('thead th').count(),(voucher?5:6)+(await table.getByRole('button',{name:'Add line'}).count()?1:0));
  assert.ok(await table.locator('tfoot').count());assert.ok(await root.locator('[data-document-status] li').count());
  if(await root.locator('[data-template-section]').count()) {metrics.header=await measure('[data-template-section] .grid');assert.equal(metrics.header.columns.split(' ').length,4);metrics.control=await measure('[data-template-section] input');close(metrics.control.height,metrics.control.density==='compact'?24:metrics.control.density==='spacious'?38:variant==='erp1'?28:32,'header control');}
  else {metrics.header=await measure('.erp-document-field-grid');assert.equal(metrics.header.columns.split(' ').length,4);}
  visualChecks.push({path,state:'transaction-document-composition',source:variant==='erp1'?'DocumentTemplate.tsx + LinesEditor.tsx':'DocRecord.tsx + LinesEditor.tsx',metrics,result:'Selected document/line-table/summary dimensions match source targets; destination-level differences are retained in parity-status.md.'});
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const axe=await page.evaluate(()=>window.axe.run(document));checks.push({path:path+'-document',violations:axe.violations.map(item=>({id:item.id,targets:item.nodes.map(node=>node.target)})),incomplete:axe.incomplete.length});
  if(process.env.ERP_TRANSACTION_SCREENSHOT_DIR&&slug==='sales-orders')await capture(join(process.env.ERP_TRANSACTION_SCREENSHOT_DIR,variant+'-document.png'));
  flows.push({id:variant+'-'+slug+'-document-geometry',scope:'UI',result:'Source-derived header, line table, rail and totals measurements; full-shell axe'});
  // Copy is a real UI navigation. A fresh copy starts at Draft and supports editable rows.
  await root.getByRole('button',{name:'Copy to new',exact:true}).click();await root.getByRole('button',{name:'Save draft',exact:true}).waitFor();
  const quantity=root.getByRole('spinbutton',{name:voucher?'Debit 1':'Qty 1',exact:true});await quantity.waitFor();
  if(!voucher) {await quantity.fill('2');await root.getByRole('spinbutton',{name:'Rate 1',exact:true}).fill('10');}
  const saved=page.waitForResponse(response=>response.url().endsWith('/entities/'+slug)&&response.request().method()==='POST');await root.getByRole('button',{name:'Save draft',exact:true}).click();const response=await saved;assert.ok(response.ok());const row=await response.json();assert.equal(row.status,'Draft');assert.ok(row.id);if(!voucher)assert.equal(row.lines[0].amount,20);
  await page.waitForFunction(code=>document.querySelector('.erp-document-identity')?.textContent.includes(code),row.code);
  flows.push({id:variant+'-'+slug+'-document-copy',scope:'UI',result:'Copied source record to a new Draft, edited line values and saved through the real API'});
  if(slug==='sales-orders') {const advance=page.waitForResponse(response=>response.url().includes('/entities/'+slug+'/'+row.id)&&response.request().method()==='PUT');await root.getByRole('button',{name:'Submit',exact:true}).click();assert.equal((await (await advance).json()).status,'Submitted');await root.locator('[aria-current=step]').filter({hasText:'Submitted'}).waitFor();flows.push({id:variant+'-document-transition',scope:'UI',result:'Submit advances a versioned order and refreshes the status stepper'});}
  const cancelled=page.waitForResponse(response=>response.url().includes('/entities/'+slug+'/'+row.id)&&response.request().method()==='PUT');await root.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await (await cancelled).json()).status,'Cancelled');await root.getByRole('button',{name:'Copy to new',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('[data-transaction-document] input'));flows.push({id:variant+'-'+slug+'-document-cancel',scope:'UI',result:'Source cancellation writes a versioned terminal state and removes edit controls'});
  if(slug==='sales-invoices') {await root.getByRole('button',{name:'Print preview',exact:true}).click();await page.locator('[data-invoice-preview]').waitFor();flows.push({id:variant+'-document-print',scope:'UI',result:variant==='erp1'?'Invoice shortcut opens the source invoice selector':'Invoice shortcut opens the selected invoice preview'});}
 }
}
