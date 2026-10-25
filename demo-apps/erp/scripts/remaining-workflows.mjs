import assert from 'node:assert/strict';
/** Real HTTP only: the caller owns the browser, local services and teardown. */
export async function remainingWorkflows({page,visit,flows,capture,screenshot}) {
  const record=(id,result)=>flows.push({id,scope:'UI',result});
  const shot=async name=>{if(screenshot)await capture(screenshot.replace('.png','-'+name+'.png'));};
  for(const variant of ['erp1','erp2']) {
    for(const slug of ['appointments','room-bookings']) {
      await visit('/'+variant+'/transactions/'+slug);
      await page.locator('[data-resource-timeline]').waitFor();
      const date=new Date();date.setDate(date.getDate()+14);const day=date.toISOString().slice(0,10);
      const loaded=page.waitForResponse(response=>response.url().includes('/entities/'+slug+'?')&&response.request().method()==='GET');
      await page.getByLabel('Date',{exact:true}).fill(day);assert.ok((await loaded).ok());await page.locator('[data-resource-timeline]').waitFor();
      const resource=await page.locator('[data-timeline-resource]').first().getAttribute('data-timeline-resource');
      await page.getByRole('button',{name:resource,exact:true}).click();assert.equal(await page.locator('[data-timeline-resource]').evaluateAll((elements,resource)=>elements.filter(element=>element.getAttribute('data-timeline-resource')===resource).length,resource),0);
      await page.getByRole('button',{name:resource,exact:true}).click();
      await page.locator('[data-timeline-resource]').first().locator('button:not([data-timeline-event]):enabled').first().click();
      await page.locator('[data-record-page]').waitFor();
      await page.getByRole('textbox',{name:slug==='appointments'?'Patient':'Booked by',exact:true}).fill('Fictional '+variant+' scheduled visitor');
      assert.equal(await page.locator('[data-record-page]').getByLabel('Date',{exact:true}).inputValue(),day);
      const created=page.waitForResponse(response=>response.url().endsWith('/entities/'+slug)&&response.request().method()==='POST');await page.getByRole('button',{name:'Confirm booking',exact:true}).click();const response=await created;assert.ok(response.ok());const row=await response.json();assert.equal(row.resource,resource);assert.equal(row.date,day);assert.equal(row.status,'Booked');
      if(slug==='appointments'){const checked=page.waitForResponse(response=>response.url().includes('/entities/'+slug+'/'+row.id)&&response.request().method()==='PUT');await page.getByRole('button',{name:'Check in',exact:true}).click();assert.equal((await (await checked).json()).status,'Checked in');}
      const closed=page.waitForResponse(response=>response.url().includes('/entities/'+slug+'/'+row.id)&&response.request().method()==='PUT');await page.getByRole('button',{name:slug==='appointments'?'Complete':'Cancel booking',exact:true}).click();assert.equal((await (await closed).json()).status,slug==='appointments'?'Completed':'Cancelled');
      await page.getByRole('button',{name:'Back',exact:true}).click();await page.locator('[data-resource-timeline]').waitFor();
      if(await page.getByLabel('Date',{exact:true}).inputValue()!==day)await page.getByLabel('Date',{exact:true}).fill(day);
      await page.locator('[data-timeline-event="'+row.id+'"]').waitFor();
      record(variant+'-'+slug+'-schedule','Date and resource visibility, free-slot creation, '+(slug==='appointments'?'check-in and completion':'cancellation')+' and schedule reload through real HTTP');
      if(variant==='erp1'&&slug==='appointments')await shot('calendar');
      await page.getByRole('radio',{name:'List',exact:true}).click();await page.locator('tbody tr').first().waitFor();await page.getByRole('radio',{name:'Schedule',exact:true}).click();await page.locator('[data-resource-timeline]').waitFor();
      record(variant+'-'+slug+'-views','Resource timeline and shared worklist switch');
    }
    await visit('/'+variant+'/reports/invoice-print');
    if(variant==='erp2'){await page.locator('tbody tr').first().locator('td').nth(2).click();}
    await page.locator('[data-invoice-pages] .erp-invoice').waitFor();
    await page.getByRole('radio',{name:'Duplicate',exact:true}).click();await page.getByRole('checkbox',{name:'Show terms',exact:true}).uncheck();assert.equal(await page.locator('[data-invoice-preview] .invoice-terms').count(),0);await page.getByRole('checkbox',{name:'Show terms',exact:true}).check();await page.getByRole('button',{name:'Zoom in',exact:true}).click();
    if(variant==='erp1')await shot('invoice');
    const downloadName=screenshot?.replace('.png','-'+variant+'-invoice.pdf');
    await page.emulateMedia({media:'print'});
    const paper=page.locator('body > .ops-print-document .erp-invoice'),box=await paper.boundingBox();assert.ok(box&&Math.abs(box.width-793.7)<2&&box.height>=1122);
    assert.equal(await page.locator('main').isVisible(),false);assert.ok((await paper.innerText()).includes('Duplicate'));
    if(variant==='erp1')await shot('invoice-paper');
    if(downloadName)await page.pdf({path:downloadName,preferCSSPageSize:true,printBackground:true});
    await page.emulateMedia({media:'screen'});
    record(variant+'-invoice-print','Server company profile, copy/terms/zoom, A4 print CSS hides shell; Chromium PDF generated (no physical printer)');
    await visit('/'+variant+'/reports/sales-register');await page.locator('tbody tr').first().waitFor();
    await page.getByRole('combobox',{name:'Group by',exact:true}).selectOption('status');await page.locator('th[scope=rowgroup]').first().waitFor();
    await page.getByRole('combobox',{name:'Period',exact:true}).selectOption('custom');await page.getByLabel('From',{exact:true}).fill('2000-01-01');await page.getByLabel('To',{exact:true}).fill('2099-12-31');await page.locator('tbody tr td').first().waitFor();
    const exported=page.waitForEvent('download');await page.getByRole('button',{name:/^Export (CSV|XLSX)$/}).click();const download=await exported;assert.match(download.suggestedFilename(),/^sales-register\.(csv|xlsx)$/);assert.equal(await download.failure(),null);
    record(variant+'-report-controls','Custom date range, status grouping, totals and preference-selected export download');
    if(variant==='erp2'){await page.locator('tbody tr td').first().click();await page.waitForURL(/\/erp2\/transactions\/sales-invoices\/[^/]+$/);await page.locator('[data-record-page]').waitFor();record(variant+'-report-record','Report drill-down opens the owning invoice route');}
    await visit('/'+variant+'/reports/customer-ledger');await page.getByRole('combobox',{name:'Customer',exact:true}).waitFor();
    await page.getByRole('combobox',{name:'Period',exact:true}).selectOption('all');await page.waitForFunction(()=>!document.querySelector('main [aria-busy="true"]'));
    const customer=page.getByRole('combobox',{name:'Customer',exact:true});
    for(const option of await customer.locator('option').evaluateAll(options=>options.map(option=>option.value))){if(await page.locator('tbody tr td').count())break;if(option===await customer.inputValue())continue;const loaded=page.waitForResponse(response=>response.url().includes('/entities/ledger-entries?')&&response.request().method()==='GET');await customer.selectOption(option);assert.ok((await loaded).ok());await page.waitForFunction(()=>!document.querySelector('main [aria-busy="true"]'));}
    await page.locator('tbody tr td').first().waitFor();
    const balance=await page.locator('tfoot tr').innerText(),voucher=(await page.locator('tbody tr td').first().innerText()).trim();await page.getByRole('textbox',{name:'Search',exact:true}).fill(voucher);await page.waitForFunction(voucher=>[...document.querySelectorAll('tbody tr')].every(row=>row.textContent.includes(voucher)),voucher);assert.equal(await page.locator('tfoot tr').innerText(),balance);
    const statementExport=page.waitForEvent('download');await page.getByRole('button',{name:/^Export (CSV|XLSX)$/}).click();assert.match((await statementExport).suggestedFilename(),/^customer-ledger\.(csv|xlsx)$/);record(variant+'-ledger','All-time statement, opening/closing totals, search preserves closing balance and complete-statement export');
    if(variant==='erp1')await shot('ledger');
    await visit('/'+variant+'/transactions/attendance');await page.locator('[data-erp-matrix] tbody tr').first().waitFor();
    await page.getByRole('button',{name:'Next period',exact:true}).click();await page.getByRole('button',{name:'Previous period',exact:true}).click();await page.locator('[data-erp-matrix] tbody tr select').first().waitFor();
    const today=new Date().toISOString().slice(0,10),period=today.slice(0,7);assert.equal(await page.getByLabel('Period',{exact:true}).inputValue(),period);
    // Deliberately clear one mark, then bulk fill; this makes the run independent of the seed's current-day marks.
    const cells=page.locator('[data-erp-matrix] tbody tr').first().locator('select');const index=new Date().getDate()-1;if(await cells.nth(index).inputValue()!==''){await cells.nth(index).selectOption('');await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-erp-matrix] [role=status]'));}
    await page.getByRole('button',{name:'Mark all present today',exact:true}).click();const bulk=page.waitForResponse(response=>response.url().includes('/entities/attendance/')&&response.request().method()==='PUT');await page.getByRole('button',{name:'Save',exact:true}).click();assert.ok((await bulk).ok());await page.waitForFunction(()=>!document.querySelector('[data-erp-matrix] [role=status]'));assert.equal(await cells.nth(index).inputValue(),'P');
    await page.reload();await page.locator('[data-erp-matrix] tbody tr select').first().waitFor();assert.equal(await page.locator('[data-erp-matrix] tbody tr').first().locator('select').nth(index).inputValue(),'P');record(variant+'-matrix-attendance','Period navigation, mark clearing, bulk-fill blanks, save and reload persistence');
    await visit('/'+variant+'/transactions/timesheets');const hours=page.locator('[data-erp-matrix] tbody tr input[type=number]').first();await hours.waitFor();const hourValue=await hours.inputValue()==='6.5'?7:6.5;await hours.fill(String(hourValue));const hoursSaved=page.waitForResponse(response=>response.url().includes('/entities/timesheets/')&&response.request().method()==='PUT');await page.getByRole('button',{name:'Save',exact:true}).click();const hoursResponse=await hoursSaved;assert.ok(hoursResponse.ok());assert.equal((await hoursResponse.json()).cells[0],hourValue);record(variant+'-matrix-hours','Week-normalized hours, fractional edit, summary and period-scoped HTTP save');
    await visit('/'+variant+'/transactions/marks-entry');await page.getByRole('combobox',{name:'Term',exact:true}).selectOption('Term 2');const mark=page.locator('[data-erp-matrix] tbody tr input[type=number]').first();await mark.waitFor();const markValue=await mark.inputValue()==='88'?89:88;await mark.fill(String(markValue));const marksSaved=page.waitForResponse(response=>response.url().includes('/entities/marks-entry/')&&response.request().method()==='PUT');await page.getByRole('button',{name:'Save',exact:true}).click();const marksResponse=await marksSaved;assert.ok(marksResponse.ok());assert.equal((await marksResponse.json()).cells[0],markValue);record(variant+'-matrix-marks','Term selection, score edit, grade summary and period-scoped HTTP save');
    await visit('/'+variant+'/workspace/dashboard');for(const label of ['Recent sales orders','Largest receivables','Invoice value by status'])await page.getByRole('heading',{name:label,exact:true}).waitFor();await page.getByRole('combobox',{name:'Monthly sales and purchases for the last twelve months',exact:true}).selectOption('1');if(variant==='erp1')await shot('dashboard');await page.getByRole('button',{name:'All orders',exact:true}).click();await page.waitForURL('**/'+variant+'/transactions/sales-orders');record(variant+'-dashboard','All source dashboard panels, keyboard trend inspection and module-owned orders drill-down');
    if(variant==='erp2'){await visit('/erp2/workspace/dashboard');await page.locator('[data-erp-dashboard] tbody tr').first().click();await page.waitForURL(/\/erp2\/transactions\/sales-orders\/[^/]+$/);await page.locator('[data-record-page]').waitFor();record('erp2-dashboard-record','Recent-order drill-down opens its record route');}
  }
}
