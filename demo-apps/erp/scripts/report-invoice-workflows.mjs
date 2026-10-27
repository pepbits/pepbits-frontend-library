import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),XLSX=require('xlsx');
/** Extends the existing local launcher; all setup uses authenticated real HTTP. */
export async function reportInvoiceWorkflows({page,visit,flows,screenshot}) {
  const base=new URL(page.url()).origin;
  const token=await page.evaluate(()=>localStorage.getItem('pepbits-session-token'));
  const me=await (await page.request.get(base+'/api/auth/me',{headers:{Authorization:'Bearer '+token}})).json();
  const headers=variant=>({Authorization:'Bearer '+token,'X-Product-Id':'nexora','X-Reference-Module':'reference-'+variant,'X-Reference-Branch':me.user?.branch??me.branch});
  const api=async(variant,path,options)=>{
    const response=await page.request.fetch(base+'/api/reference-modules/'+variant+path,{headers:headers(variant),...options});assert.ok(response.ok(),path+' '+response.status());return response.json();
  };
  const reports=[['sales-register','sales-invoices','total','Total','Invoice no.','status'],['purchase-register','purchase-orders','total','Total','PO no.','warehouse'],['stock-summary','stock-summary','value','Stock value','Item','category'],['receivables-aging','receivables-aging','total','Outstanding','Invoice no.','bucket']];
  for(const variant of ['erp1','erp2']) {
    await visit('/preferences');const exportFormat=variant==='erp1'?'csv':'xlsx';const changed=page.waitForResponse(response=>response.url().endsWith('/preferences')&&response.request().method()==='PUT');await page.getByRole('combobox',{name:'Export format',exact:true}).selectOption(exportFormat);assert.ok((await changed).ok());
    flows.push({id:variant+'-export-preference',scope:'UI',result:'Accepted preference selects '+exportFormat.toUpperCase()+' for report downloads'});
    for(const [slug,entity,key,label,sortLabel,group] of reports) {
      const all=await api(variant,'/api/entities/'+entity+'?size=5000'),maximum=Math.max(...all.rows.map(row=>Number(row[key])||0));
      await visit('/'+variant+'/reports/'+slug);
      await page.getByRole('button',{name:'Advanced filter',exact:true}).click();
      const panel=page.getByRole('region',{name:'Advanced filter',exact:true});
      await panel.getByLabel(label+' Min',{exact:true}).fill('0');await panel.getByLabel(label+' Max',{exact:true}).fill(String(maximum));
      if(slug==='sales-register') {await panel.getByRole('checkbox',{name:'Paid',exact:true}).check();await panel.getByRole('checkbox',{name:'Unpaid',exact:true}).check();}
      if(slug==='purchase-register') await panel.getByRole('textbox',{name:'Buyer',exact:true}).fill(String(all.rows[0].buyer).split(' ')[0]);
      const loaded=page.waitForResponse(response=>response.url().includes('/entities/'+entity+'?')&&response.request().method()==='GET');await panel.getByRole('button',{name:'Apply filters',exact:true}).click();
      const response=await loaded;assert.ok(response.ok());const data=await response.json();assert.ok(data.rows.length>0);assert.ok(data.rows.every(row=>Number(row[key])>=0&&Number(row[key])<=maximum));
      if(slug==='sales-register')assert.ok(data.rows.every(row=>['Paid','Unpaid'].includes(row.status)));
      const sorted=page.waitForResponse(response=>response.url().includes('/entities/'+entity+'?')&&new URL(response.url()).searchParams.has('sort'));await page.getByRole('button',{name:sortLabel,exact:true}).click();assert.ok((await sorted).ok());
      await page.getByRole('combobox',{name:'Group by',exact:true}).selectOption(group);await page.locator('[data-report-subtotal]').first().waitFor();
      const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:/^Export (CSV|XLSX)$/}).click();const download=await downloadPromise;assert.equal(await download.failure(),null);
      const book=XLSX.read(readFileSync(await download.path()),{type:'buffer'}),grid=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,raw:true});assert.equal(grid.length,data.total+2);assert.equal(grid.at(-1)[0],'Total');
      flows.push({id:variant+'-'+slug+'-advanced',scope:'UI',result:'Typed range'+(slug==='sales-register'?', multiple statuses':slug==='purchase-register'?', person text':'')+', server sorting, complete group subtotals and parsed full-result spreadsheet export',rows:data.total,format:download.suggestedFilename().split('.').at(-1)});
      if(screenshot&&variant==='erp1'&&slug==='sales-register')await page.screenshot({path:screenshot.replace('.png','-advanced-report.png'),fullPage:true});
    }
    if(variant==='erp2'){
      await visit('/preferences');await page.getByRole('tab',{name:'Page',exact:true}).click();const slider=page.getByRole('slider',{name:'Result / table size',exact:true});await slider.waitFor();
      const [changed]=await Promise.all([page.waitForResponse(response=>response.url().endsWith('/preferences')&&response.request().method()==='PUT'&&response.request().postDataJSON()?.preferences?.fontSizeResult===16),slider.press('End')]);
      assert.ok(changed.ok());assert.equal((await changed.json()).preferences.fontSizeResult,16);
      // The accepted HTTP response precedes the host's controlled React render.
      await slider.locator('..').getByText('16px',{exact:true}).waitFor();assert.equal(await slider.inputValue(),'16');
    }
    const original=(await api(variant,'/api/entities/sales-invoices?size=1')).rows[0];
    const lines=Array.from({length:75},(_,index)=>({item:`Fictional item ${String(index+1).padStart(3,'0')} `+(index%4===0?'with a deliberately wrapped description for measured pagination across several lines of invoice text. ':''),qty:1,rate:10.25,tax:5,kind:index===30?'Deduction':'Item'}));
    const saved=await api(variant,'/api/entities/sales-invoices/'+original.id,{method:'PUT',data:{lines,expectedVersion:original.version??0,operationId:crypto.randomUUID()}});assert.equal(saved.lines.length,75);
    flows.push({id:variant+'-long-invoice-fixture',scope:'direct HTTP',result:'75 fictional invoice lines persisted through versioned API for browser/PDF checks'});
    await visit('/'+variant+'/reports/invoice-print'+(variant==='erp2'?'/'+original.id:''));
    if(variant==='erp1') {const row=page.locator('tbody tr').filter({hasText:original.code}).first();await row.locator('td').nth(2).click();}
    await page.waitForFunction(()=>document.querySelector('[data-invoice-pages]')?.querySelectorAll('[data-print-line]').length===75);
    await page.getByRole('radio',{name:'Duplicate',exact:true}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-invoice-preview] button')].some(button=>button.textContent.includes('Print or save PDF')&&!button.disabled));
    await page.evaluate(()=>document.fonts.ready);
    const preview=page.locator('[data-invoice-pages]'),count=await preview.locator('[data-invoice-page]').count();assert.ok(count>2);
    assert.equal(await preview.locator('[data-print-final]').count(),1);assert.equal(await preview.locator('[data-print-line]').count(),75);
    const indices=await preview.locator('[data-print-line]').evaluateAll(rows=>rows.map(row=>Number(row.getAttribute('data-print-line'))));assert.deepEqual(indices,Array.from({length:75},(_,i)=>i));
    for(let index=0;index<count;index++){const sheet=preview.locator('[data-invoice-page]').nth(index);assert.ok((await sheet.locator('[data-print-heading]').innerText()).includes(saved.code));assert.equal(await sheet.locator('.invoice-lines thead th').count(),6);assert.ok((await sheet.locator('footer').innerText()).includes(`Page ${index+1} / ${count}`));}
    const carried=await preview.locator('[data-print-carried]').allTextContents(),brought=await preview.locator('[data-print-brought]').allTextContents();assert.deepEqual(carried.map(text=>text.split('·')[1]),brought.map(text=>text.split('·')[1]));
    await page.emulateMedia({media:'print'});const paper=page.locator('body > .erp-invoice-print');assert.equal(await paper.locator('[data-invoice-page]').count(),count);assert.equal(await page.locator('main').isVisible(),false);
    const geometry=await paper.locator('[data-invoice-page]').evaluateAll(pages=>pages.map(page=>{const r=page.getBoundingClientRect(),footer=page.querySelector('footer').getBoundingClientRect();return {width:r.width,height:r.height,footerBottom:footer.bottom-r.top,scrollHeight:page.scrollHeight,clientHeight:page.clientHeight};}));
    for(const box of geometry){assert.ok(Math.abs(box.width-793.7)<2);assert.ok(Math.abs(box.height-1122.52)<2);assert.ok(box.scrollHeight<=box.clientHeight+1,JSON.stringify(box));assert.ok(box.footerBottom<=box.height-46,JSON.stringify(box));}
    const pdf=screenshot?.replace('.png','-'+variant+'-long-invoice.pdf');if(pdf)await page.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});
    if(screenshot&&variant==='erp1')await paper.locator('[data-invoice-page]').first().screenshot({path:screenshot.replace('.png','-long-invoice-page1.png')});
    if(screenshot)await paper.locator('[data-invoice-page]').last().screenshot({path:screenshot.replace('.png','-'+variant+'-long-invoice-last.png')});
    await page.emulateMedia({media:'screen'});
    await page.getByRole('checkbox',{name:'Show terms',exact:true}).uncheck();assert.equal(await preview.locator('.invoice-terms').count(),0);await page.getByRole('button',{name:'Zoom out',exact:true}).click();assert.equal(await preview.locator('[data-print-line]').count(),75);
    const result={id:variant+'-long-invoice-print',scope:'UI',result:'Measured wrapped rows, repeated headers, carry equality, continuous numbering, one summary, terms/zoom and A4 layout'+(pdf?' with captured PDF':' (PDF capture not requested)'),pages:count,lines:75,total:saved.total,geometry,pdf:pdf?.split('/').at(-1)};flows.push(result);
    if(screenshot)writeFileSync(screenshot.replace('.png','-'+variant+'-pagination.json'),JSON.stringify(result,null,2)+'\n');
  }
}
