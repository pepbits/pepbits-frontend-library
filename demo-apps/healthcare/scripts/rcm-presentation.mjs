import assert from 'node:assert/strict';
/** Real Chromium interaction and computed-presentation checks for the engine-composed RCM port. */
export async function rcmPresentation({page,base}) {
 const checks=[];
 const check=async(name,run)=>{try{await run();checks.push({name,failures:[]});}catch(error){checks.push({name,failures:[error.message]});}console.log(JSON.stringify({rcmPresentation:checks.at(-1)}));};
 const root=page.locator('[data-reference-module="rcm"]');
 const visit=async path=>{await page.goto(base+'/rcm'+path);await root.locator('[data-rcm-stage]').waitFor();};
 await visit('/w/receipts?new=1');
 await check('creation drawer frame, shared fields and focus entry',async()=>{const dialog=page.getByRole('dialog',{name:'New receipt'});await dialog.waitFor();assert.ok(await dialog.evaluate(node=>node.contains(document.activeElement)));assert.equal(await dialog.getAttribute('aria-modal'),'true');assert.ok(await dialog.locator('[data-template-section]').count());});
 await check('reference lookup keyboard selection',async()=>{const input=page.getByRole('dialog').getByRole('combobox',{name:'Patient',exact:true});await input.fill('');await input.focus();await page.getByRole('dialog').getByRole('listbox').getByRole('option').first().waitFor();await input.press('ArrowDown');await input.press('Enter');assert.equal(await input.getAttribute('aria-expanded'),'false');});
 await check('drawer Tab containment and Escape closure',async()=>{const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Create receipt',exact:true}).focus();await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(node=>node.contains(document.activeElement)));await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});});
 await check('command palette keyboard opening and closing',async()=>{await page.keyboard.press('Control+k');await page.getByRole('dialog',{name:'Jump to a page'}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Jump to a page'}).waitFor({state:'hidden'});});
 // Change accepted preferences through the same HTTP protocol, then refresh the mounted host.
 const token=await page.evaluate(()=>localStorage.getItem('pepbits-session-token')),headers={Authorization:'Bearer '+token,'X-Product-Id':'nexora','Content-Type':'application/json'};
 const get=async()=>{const r=await fetch(base+'/api/preferences',{headers});assert.ok(r.ok);return r.json();};
 const original=await get();
 const set=async patch=>{const current=await get(),r=await fetch(base+'/api/preferences',{method:'PUT',headers,body:JSON.stringify({preferences:{...current.overrides,...patch},userRevision:current.userRevision,policyRevision:current.policy.revision})});assert.ok(r.ok,'preference write '+r.status);await page.evaluate(()=>window.dispatchEvent(new Event('pepbits-preference-policy-changed')));};
 try {
  await visit('/w/invoices');await root.locator('table tbody tr').first().waitFor();
  for(const density of ['compact','comfortable','spacious'])await check('effective '+density+' table density',async()=>{await set({density});await page.waitForFunction(d=>document.querySelector('.reference-rcm table')?.getAttribute('data-density')===d,density);});
  await check('effective row stripes, wrapping and sticky header',async()=>{await set({zebraStripes:true,wrapCellText:true,stickyTableHeader:false});await page.waitForFunction(()=>{const t=document.querySelector('.reference-rcm table');return t?.getAttribute('data-striped')==='true'&&t?.getAttribute('data-wrap')==='true'&&t?.getAttribute('data-sticky')==='false';});});
  await check('mounted shortcut disable removes palette listener',async()=>{await set({keyboardShortcuts:false});await page.waitForFunction(()=>!document.querySelector('.reference-rcm [data-rcm-toolbar]')?.textContent.includes('Ctrl'));await page.keyboard.press('Control+k');assert.equal(await page.getByRole('dialog',{name:'Jump to a page'}).count(),0);});
  await check('ordinary toolbar command works with shortcuts off',async()=>{await root.getByRole('button',{name:/Jump anywhere/}).click();await page.getByRole('dialog',{name:'Jump to a page'}).waitFor();await page.keyboard.press('Escape');});
  await check('reduced motion reaches computed styles',async()=>{await set({reducedMotion:true});await page.waitForFunction(()=>document.documentElement.dataset.reducedMotion==='true');assert.equal(await root.evaluate(node=>getComputedStyle(node.querySelector('button')).animationName),'none');});
  await check('zero corner radius reaches controls',async()=>{await set({cornerRadius:0});await page.waitForFunction(()=>getComputedStyle(document.querySelector('.reference-rcm input')).borderTopLeftRadius==='0px');});
  await check('host font applies to module and heading',async()=>{await set({fontFamily:'plex'});await page.waitForFunction(()=>getComputedStyle(document.querySelector('.reference-rcm h1')).fontFamily.includes('Plex'));});
  await check('Arabic direction and operable scope menu',async()=>{await set({language:'ar'});await page.waitForFunction(()=>document.documentElement.dir==='rtl');await root.locator('[data-rcm-toolbar] button[aria-haspopup=menu]').click();await root.getByRole('menu').waitFor();await root.getByRole('menuitemradio').first().click();});
  await check('Hindi and Malayalam layouts retain content',async()=>{for(const language of ['hi','ml']){await set({language});await page.waitForFunction(l=>document.documentElement.lang===l,language);assert.ok((await root.locator('h1').innerText()).length>0);}});
 } finally {const current=await get();const r=await fetch(base+'/api/preferences',{method:'PUT',headers,body:JSON.stringify({preferences:original.overrides,userRevision:current.userRevision,policyRevision:current.policy.revision})});assert.ok(r.ok);await page.goto(base+'/rcm');await root.locator('[data-rcm-stage]').waitFor();}
 return checks;
}
