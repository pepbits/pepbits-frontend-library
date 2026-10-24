import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
/* Real-HTTP browser check of the desktop web build (vite preview) against the unchanged demo API.
   Web mode only: no Tauri runtime, so separate windows are correctly unavailable here. */
const require=createRequire(import.meta.url),base=process.env.DESKTOP_BASE??'http://localhost:3410';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local demo checks only');
// The fixture credential is read from the unchanged API fixture at runtime and never written to receipts.
const fixtureSource=readFileSync(new URL('../../../dummy-api/server.mjs',import.meta.url),'utf8');
const credential=fixtureSource.match(/username:\s*"admin",\s*password:\s*"([^"]+)"/)[1];
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const flows=[],checks=[],errors=[],httpErrors=[],consoleErrors=[],aiRequests=[];let current='login';
page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
page.on('pageerror',e=>errors.push({route:current,message:e.message}));
page.on('console',e=>{if(e.type()==='error')consoleErrors.push({route:current,message:e.text()});});
page.on('response',r=>{const u=new URL(r.url());if(!u.pathname.startsWith('/api/'))return;if(u.pathname.startsWith('/api/ai/'))aiRequests.push(u.pathname);if(!u.pathname.startsWith('/api/auth/')&&r.status()>=400)httpErrors.push({route:current,path:u.pathname,status:r.status()});});
const settle=()=>page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]')&&document.getAnimations().every(a=>a.playState!=='running'||a.effect?.getComputedTiming().iterations===Infinity));
async function visit(path,ready){current=path;await page.goto(base+path);await page.locator(ready+' >> visible=true').first().waitFor();await settle();}
const tabs=()=>page.getByRole('tablist',{name:'Open documents'}).getByRole('tab');
async function tabOption(name){const strip=page.getByRole('navigation',{name:'Open documents'});await strip.getByRole('button',{name:'Tab options'}).click();await strip.getByRole('button',{name}).click();}
async function capture(suffix){if(process.env.DESKTOP_SCREENSHOT){await settle();await page.screenshot({path:process.env.DESKTOP_SCREENSHOT.replace('.png',`-${suffix}.png`)});}}
async function axeRoute(path,ready,label=path){await visit(path,ready);await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const result=await page.evaluate(()=>window.axe.run(document));checks.push({path:label,dir:await page.evaluate(()=>document.documentElement.dir),violations:result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),incomplete:result.incomplete.length});}
async function savePreference(change){const saved=page.waitForResponse(r=>r.url().endsWith('/api/preferences')&&r.request().method()==='PUT');await change();const response=await saved;if(!response.ok())throw new Error('Preference save failed '+response.status());await settle();}
try{
 // Sign-in through the shared login screen; the session, preferences and catalog then load over HTTP.
 await page.goto(base+'/finance/customers');await page.locator('input[autocomplete=username]').fill('admin');await page.locator('input[type=password]').fill(credential);await page.getByRole('button',{name:/sign in/i}).click();
 await page.locator('tbody tr').first().waitFor();await settle();flows.push({id:'DSK-01',result:'Fixture sign-in, API preferences/catalog and deep link to Customer Master'});
 if((await tabs().count())!==2)throw new Error('Expected home and Customer Master tabs');
 const firstName=(await page.locator('tbody tr').first().locator('td').nth(2).textContent()).trim();
 const searched=page.waitForResponse(r=>r.url().endsWith('/api/worklists/search')&&r.request().method()==='POST'&&(r.request().postData()??'').includes(firstName.split(' ')[0]));
 await page.locator('input[placeholder^="Search Customer Master"]').fill(firstName.split(' ')[0]);if(!(await searched).ok())throw new Error('Search failed');await page.locator('tbody tr').first().waitFor();
 flows.push({id:'DSK-02',result:'Worklist search posts the classified query and shows API rows'});
 await page.locator('input[placeholder^="Search Customer Master"]').fill('');await settle();
 const rows=page.locator('tbody tr');await rows.nth(1).waitFor();const recordId=(await rows.first().locator('td').nth(1).textContent()).trim(),secondId=(await rows.nth(1).locator('td').nth(1).textContent()).trim();
 await rows.first().locator('td').nth(2).click();await page.waitForURL(url=>url.pathname==='/finance/customers/'+encodeURIComponent(recordId));await page.locator('[data-page-id="customer-master"] input[disabled]:visible').first().waitFor();
 if((await tabs().count())!==3)throw new Error('Record did not open in its own tab');flows.push({id:'DSK-03',result:'Row opens the record in a third tab and the address follows the active document',recordId});
 // Edit, complete the server-required fields and save through the shared record editor.
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.waitForURL(url=>url.pathname.endsWith('/edit'));
 const legal=page.getByRole('textbox',{name:/Legal name/});await legal.waitFor();const updated='Fictional desktop '+recordId;await legal.fill(updated);
 await page.locator('[data-tour=form-nav] button:visible',{hasText:'Contacts'}).click();await page.getByRole('textbox',{name:/Email/}).fill('desktop.fixture@example.invalid');
 await page.locator('[data-tour=form-nav] button:visible',{hasText:'Address'}).click();await page.getByRole('textbox',{name:/Address line 1/}).fill('Fictional street 7');
 const saved=page.waitForResponse(r=>decodeURIComponent(r.url()).includes('form:customer-master:'+recordId)&&r.request().method()==='PUT'&&!r.url().includes('/draft'));
 await page.getByRole('button',{name:'Save',exact:true}).click();const saveResponse=await saved;if(!saveResponse.ok())throw new Error('Record save failed '+saveResponse.status());
 await page.getByText(/^Changes saved/).first().waitFor({timeout:10000}).catch(()=>{});flows.push({id:'DSK-04',result:'Edit and save to the demo API record store; server validation accepted the completed required fields'});
 await page.reload();await legal.waitFor();await page.waitForFunction(value=>[...document.querySelectorAll('input')].some(input=>input.value===value),updated);
 if((await tabs().count())!==2)throw new Error('Deep-link reload should rebuild home plus the record');flows.push({id:'DSK-05',result:'Reloaded edit deep link restores the saved value with a fresh workspace'});
 // Unsaved work: closing asks first; Cancel keeps the value; confirming discards.
 await legal.fill(updated+' unsaved');await page.getByRole('tab',{selected:true}).filter({hasText:/./}).waitFor();
 await page.evaluate(()=>{history.pushState(null,'','/hr/employees');dispatchEvent(new PopStateEvent('popstate'));});
 const leave=page.getByRole('dialog',{name:'Leave Finance?'});await leave.waitFor();await leave.getByRole('button',{name:'Cancel'}).click();
 await page.waitForURL(url=>url.pathname==='/finance/customers/'+encodeURIComponent(recordId)+'/edit');
 if(await legal.inputValue()!==updated+' unsaved')throw new Error('Cancelled module navigation lost unsaved input');
 flows.push({id:'DSK-15',result:'Cancel address-driven module navigation restores the active record URL and keeps typed values'});
 await page.getByRole('navigation',{name:'Open documents'}).getByRole('button',{name:/^Close /}).first().click();const dialog=page.getByRole('dialog',{name:'Discard changes?'});await dialog.waitFor();await dialog.getByRole('button',{name:'Cancel'}).click();
 if(await legal.inputValue()!==updated+' unsaved')throw new Error('Cancel lost unsaved input');
 await page.getByRole('navigation',{name:'Open documents'}).getByRole('button',{name:/^Close /}).first().click();await dialog.getByRole('button',{name:'Discard and close'}).click();await page.waitForURL(url=>url.pathname==='/overview'||url.pathname==='/');
 flows.push({id:'DSK-06',result:'Dirty-close confirmation keeps work on Cancel and discards only after confirmation'});
 // Split comparison of two customer records, then back to one pane.
 await visit('/finance/customers','tbody tr');await page.locator('tbody tr').filter({hasText:recordId}).first().locator('td').nth(2).click();await page.waitForURL(url=>url.pathname==='/finance/customers/'+encodeURIComponent(recordId));
 await page.getByRole('tab',{name:/^Customer Master/}).click();await page.waitForURL(url=>url.pathname==='/finance/customers');await page.locator('tbody tr').nth(1).waitFor();
 await page.locator('tbody tr').filter({hasText:secondId}).first().locator('td').nth(2).click();await page.waitForURL(url=>url.pathname==='/finance/customers/'+encodeURIComponent(secondId));
 await tabOption(/^Split with the last document/);await page.getByRole('separator',{name:'Resize the split'}).waitFor();await capture('split');
 await tabOption(/^Swap the panes/);await tabOption(/^Make full screen/);await page.getByRole('separator',{name:'Resize the split'}).waitFor({state:'detached'});
 flows.push({id:'DSK-07',result:'Split two customer records, swap panes and return to one pane'});
 await page.getByRole('button',{name:'Tab options'}).click();await page.getByRole('button',{name:'Close other tabs'}).waitFor();
 if(await page.getByRole('button',{name:'Open in its own window'}).count())throw new Error('Web mode offered a native window');await page.keyboard.press('Escape');
 flows.push({id:'DSK-08',result:'Browser web mode uses the unavailable window port: separate windows are not offered'});
 // Preferences: one update path; floating windows replace tabs with frames and a taskbar.
 await visit('/preferences','[data-page-id="preferences"] select');
 await savePreference(()=>page.getByRole('checkbox',{name:/Floating windows/}).or(page.getByRole('switch',{name:/Floating windows/})).first().click());
 await page.getByRole('toolbar',{name:'Open windows'}).waitFor();await capture('floating');
 await savePreference(()=>page.getByRole('checkbox',{name:/Floating windows/}).or(page.getByRole('switch',{name:/Floating windows/})).first().click());
 await page.getByRole('tablist',{name:'Open documents'}).waitFor();flows.push({id:'DSK-09',result:'Floating windows preference saved over HTTP switches to MDI frames and back to tabs'});
 // HR module: cross-module deep link, read-only employee record.
 await visit('/hr/employees','tbody tr');if((await tabs().allTextContents()).some(text=>text.includes('Customer')))throw new Error('Module switch kept finance tabs');
 if(await page.getByRole('button',{name:'New',exact:true}).isEnabled())throw new Error('Read-only worklist allowed New');
 await page.locator('tbody tr').first().locator('td').nth(2).click();await page.locator('[data-record-page] dl').first().waitFor();if(await page.getByRole('button',{name:'Edit',exact:true}).count())throw new Error('Read-only record offered Edit');
 flows.push({id:'DSK-10',result:'HR module replaces the tab set, employee worklist and read-only record from API rows'});
 await visit('/library/components','[data-library-examples] dl');await page.getByRole('tab',{name:'Chart'}).click();await page.locator('[data-library-examples] svg').first().waitFor();await page.getByRole('tab',{name:'Calendar'}).click();await page.locator('[data-library-examples] [data-date]').first().waitFor();
 flows.push({id:'DSK-11',result:'Library examples render shared values, chart and calendar inside the desktop frame'});
 // A detached-window address in web mode: one document, no tab strip; another tenant is refused.
 const me=await page.evaluate(async()=>{const token=localStorage.getItem('pepbits-session-token');const response=await fetch('/api/auth/me',{headers:{Authorization:'Bearer '+token}});const body=await response.json();return body.user?.tenantId??body.tenantId??null;});
 if(!me)throw new Error('Tenant lookup failed');
 await visit('/index.html?document='+encodeURIComponent(`${me}:CUSTOMER-MASTER:view~${encodeURIComponent(recordId)}`),'[data-page-id="customer-master"] input[disabled]');
 if(await page.getByRole('tablist',{name:'Open documents'}).count())throw new Error('Detached document showed a tab strip');
 await visit('/index.html?document='+encodeURIComponent(`another-tenant:CUSTOMER-MASTER:view~${encodeURIComponent(recordId)}`),'text=This window belongs to another tenant');
 flows.push({id:'DSK-12',result:'Detached-window address renders one record; a foreign-tenant key is refused'});
 if(aiRequests.length||await page.getByRole('button',{name:'Open the AI assistant'}).count())throw new Error('AI is not off by default');flows.push({id:'DSK-13',result:'AI off by default: no assistant control and no /ai request'});
 // Create a customer whose generated ID is absent from the synthetic worklist, then reload its saved URL.
 await visit('/finance/customers/new','[data-page-id="customer-master"] input:not([disabled])');
 await page.getByRole('textbox',{name:/Customer code/}).fill('DESKTOP-FIXTURE');
 await page.getByRole('textbox',{name:/Legal name/}).fill('Fictional Created Desktop Customer');
 await page.getByLabel(/^Customer type/).selectOption('Corporate');
 await page.locator('[data-tour=form-nav] button:visible',{hasText:'Contacts'}).click();
 await page.getByRole('textbox',{name:/Primary contact/}).fill('Fictional Contact');
 await page.getByRole('textbox',{name:/Email/}).fill('created.desktop@example.invalid');
 await page.locator('[data-tour=form-nav] button:visible',{hasText:'Address'}).click();
 await page.getByRole('textbox',{name:/Address line 1/}).fill('Fictional street 8');
 await page.getByRole('textbox',{name:/City/}).fill('Fictional City');
 const created=page.waitForResponse(r=>r.url().endsWith('/create')&&r.request().method()==='PUT');
 await page.getByRole('button',{name:'Save',exact:true}).click();if(!(await created).ok())throw new Error('Customer create failed');
 await page.waitForURL(url=>url.pathname.endsWith('/edit'));await page.reload();
 await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(input=>input.value==='Fictional Created Desktop Customer'));
 flows.push({id:'DSK-16',result:'Create a customer through the UI and reload its generated record URL from the saved store'});
 // Full-document axe on every route pattern, then Arabic RTL on three representative routes.
 const routeChecks=[['/overview','[data-desktop-overview]'],['/finance/customers','tbody tr'],['/finance/customers/'+encodeURIComponent(recordId),'[data-page-id="customer-master"] input[disabled]'],['/finance/customers/'+encodeURIComponent(recordId)+'/edit','[data-page-id="customer-master"] input:not([disabled])'],['/finance/customers/new','[data-page-id="customer-master"] input:not([disabled])'],['/library/components','[data-library-examples] dl'],['/hr/employees','tbody tr'],['/hr/employees/EMP-01001','[data-record-page] dl'],['/preferences','[data-page-id="preferences"] select'],['/finance/unknown','[data-page-id="not-found"]']];
 for(const [path,ready] of routeChecks)await axeRoute(path,ready);
 await visit('/preferences','[data-page-id="preferences"] select');await savePreference(()=>page.getByLabel('Language').first().selectOption('ar'));await page.waitForFunction(()=>document.documentElement.dir==='rtl');
 for(const [path,ready] of routeChecks.slice(0,3))await axeRoute(path,ready,'ar '+path);await capture('arabic');
 await visit('/preferences','[data-page-id="preferences"] select');await savePreference(()=>page.locator('select').filter({has:page.locator('option[value="en"]')}).first().selectOption('en'));await page.waitForFunction(()=>document.documentElement.dir==='ltr');
 flows.push({id:'DSK-14',result:'Language preference to Arabic applies RTL after the API catalog loads, then restores English'});
 await visit('/overview','[data-desktop-overview]');await capture('overview');
}catch(error){errors.push({route:current,message:error.message});process.exitCode=1;}
finally{await browser.close();const result={scope:'Local vite preview of the desktop web build (browser web mode, no Tauri runtime) and the unchanged fictional HTTP API',flows,checks,errors,consoleErrors,httpErrors,aiRequests};
 writeFileSync(process.env.DESKTOP_RESULT??'/tmp/desktop-browser.json',JSON.stringify(result,null,2)+'\n');
 if(errors.length||consoleErrors.length||httpErrors.length||checks.some(c=>c.violations.length))process.exitCode=1;
 console.log(JSON.stringify({workflows:flows.length,routes:checks.length,errors:errors.length,consoleErrors:consoleErrors.length,httpErrors:httpErrors.length,violations:checks.reduce((n,c)=>n+c.violations.length,0)}));}
