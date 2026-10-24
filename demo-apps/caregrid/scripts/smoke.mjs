import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';

/** Browser workflows against the production build, the unchanged demo host API and the unchanged CareGrid API. */
const require=createRequire(import.meta.url),base=process.env.CAREGRID_BASE??'http://localhost:3390';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local demo checks only');
const fixtureSource=readFileSync(new URL('../../../dummy-api/server.mjs',import.meta.url),'utf8');
const secret=user=>fixtureSource.match(new RegExp(`username:\\s*"${user}",\\s*password:\\s*"([^"]+)"`))[1];
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
const flows=[],checks=[],errors=[],consoleErrors=[],httpErrors=[],expected=new Set();let current='login';
page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
page.on('pageerror',e=>errors.push({route:current,message:e.message}));page.on('console',e=>{if(e.type()==='error')consoleErrors.push({route:current,message:e.text()});});
page.on('response',r=>{const u=new URL(r.url());if((u.pathname.startsWith('/api/')&&!u.pathname.includes('/auth/')||u.pathname.startsWith('/caregrid-api/'))&&r.status()>=400&&!expected.has(u.pathname))httpErrors.push({route:current,path:u.pathname,status:r.status()});});
const idle=()=>page.waitForFunction(()=>!document.querySelector('main [aria-busy="true"]')&&document.getAnimations().every(a=>a.playState!=='running'||a.effect?.getComputedTiming().iterations===Infinity));
async function visit(path,ready){current=path;await page.goto(base+path);await page.locator('[data-page-id]').waitFor();await page.locator('header h1').first().waitFor();if(ready)await page.locator(ready).first().waitFor();await idle();}
const command=(method,fragment)=>page.waitForResponse(r=>r.request().method()===method&&new URL(r.url()).pathname.includes(fragment));
async function ok(promise,label){const response=await promise;if(!response.ok())throw new Error(label+' failed with '+response.status());return response.json().catch(()=>null);}
async function signIn(user){await page.evaluate(()=>localStorage.clear()).catch(()=>{});await page.goto(base+'/');await page.locator('input[autocomplete=username]').fill(user);await page.locator('input[type=password]').fill(secret(user));await page.getByRole('button',{name:/sign in/i}).click();await page.locator('[data-page-id]').waitFor();}
async function capture(path){if(path){await idle();await page.screenshot({path,fullPage:false});}}
try{
 await signIn('admin');await page.locator('[data-command-center] [data-tour="cg-busiest"] li').first().waitFor();flows.push({id:'CG-signin',result:'Fixture sign-in, shared provider chain and command center summary over HTTP'});
 await capture(process.env.CAREGRID_SCREENSHOT?.replace('.png','-dashboard.png'));
 await page.locator('[data-caregrid-inbox] [role=status]').filter({hasText:'Live updates on'}).waitFor();flows.push({id:'CG-live',result:'Server-Sent Events stream connected through the same-origin proxy'});
 await visit('/preferences');const saved=command('PUT','/preferences');await page.getByRole('combobox',{name:'Column layout is saved'}).selectOption('account');await ok(saved,'Preference update');flows.push({id:'CG-preferences',result:'Accepted host preference written through the shared update path'});

 // Book: patient, service, slot and an HTTP booking; the server's live notification reaches the toast.
 await visit('/book','[data-patient-option]');await page.locator('[data-patient-option]').first().click();await page.locator('[data-selected-patient]').waitFor();
 await page.getByRole('textbox',{name:'Search services'}).fill('consultation');await page.locator('[data-service-option]').first().click();await page.locator('[data-selected-service]').waitFor();
 const serviceName=(await page.locator('[data-selected-service] p.font-semibold').first().textContent()).trim();
 await page.locator('[data-slot]').first().click();await capture(process.env.CAREGRID_SCREENSHOT?.replace('.png','-booking.png'));const booked=command('POST','/caregrid-api/appointments');await page.getByRole('button',{name:/^Book \S+/}).click();const appointment=await ok(booked,'Booking');
 await page.locator('[data-booking-done]').filter({hasText:appointment.ref}).waitFor();await page.getByText(serviceName+' booked',{exact:false}).first().waitFor();flows.push({id:'CG-book',result:'Patient, service and free slot booked; live notification toast received',reference:'fictional'});
 await page.getByRole('button',{name:'View on schedule board'}).click();await page.locator('[data-row-timeline] [data-row-event]').first().waitFor();flows.push({id:'CG-book-board',result:'Confirmation opens the schedule board on the booked date'});

 // Schedule board: open an event, confirm through the drawer, keyboard quick booking.
 await visit('/schedule','[data-row-timeline]');if(!await page.locator('[data-row-event]').count())await visit('/schedule?department=','[data-row-event]');await page.locator('[data-row-event]').first().click();const actions=page.locator('[data-appointment-actions]');await actions.waitFor();
 flows.push({id:'CG-board-drawer',result:'Board event opens the appointment drawer with lifecycle actions'});
 await page.keyboard.press('Escape');await page.locator('[data-appointment-actions]').waitFor({state:'detached'});
 await page.locator('[data-row-timeline] button[aria-label^="Book on "]:not([disabled])').first().click();await page.locator('[data-quick-book]').waitFor();await page.getByRole('combobox',{name:/Service using this resource/}).waitFor();await page.keyboard.press('Escape');flows.push({id:'CG-board-quickbook',result:'Keyboard row command opens resource-scoped quick booking'});
 await page.getByRole('button',{name:'Next day'}).click();await page.waitForURL(/\/schedule\?date=/);await page.locator('[data-row-timeline]').waitFor();flows.push({id:'CG-board-day',result:'Day navigation updates the deep link'});
 await capture(process.env.CAREGRID_SCREENSHOT);

 // Front desk: full patient flow on one card.
 await visit('/frontdesk','[data-flow-card]');const card=page.locator('[data-flow-card]').filter({has:page.getByRole('button',{name:'Check in'})}).first();const id=await card.getAttribute('data-flow-card');
 await Promise.all([ok(command('POST',`/appointments/${id}/status`),'Check in'),card.getByRole('button',{name:'Check in'}).click()]);
 const started=page.locator(`[data-flow-card="${id}"]`);await Promise.all([ok(command('POST',`/appointments/${id}/status`),'Start'),started.getByRole('button',{name:'Start session'}).click()]);
 await Promise.all([ok(command('POST',`/appointments/${id}/status`),'Complete'),started.getByRole('button',{name:'Complete'}).click()]);flows.push({id:'CG-frontdesk-flow',result:'Check in, start and complete acknowledged by the API'});
 await visit('/frontdesk?tab=waitlist','[data-waitlist] li');await page.locator('[data-waitlist] li').first().getByRole('button',{name:'Find a slot'}).click();await page.waitForURL(/\/book\?.*waitlist=/);await page.locator('[data-selected-patient]').waitFor();await page.locator('[data-selected-service]').waitFor();flows.push({id:'CG-waitlist',result:'Waitlist entry opens booking with patient, service and waitlist preselected'});
 await visit('/frontdesk?tab=reminders');await page.locator('[data-reminders]').waitFor();flows.push({id:'CG-reminders',result:'Reminder outbox reads the API'});

 // Availability: impact preview, block, queue suggestions, automatic fixes and holidays.
 await visit('/exceptions?resource=265','[data-impact]');await page.locator('[data-impact]:not([data-impact=""])').waitFor();
 const blocked=command('POST','/caregrid-api/exceptions');await page.getByRole('button',{name:/^(Save block|Block and queue)/}).click();await ok(blocked,'Block');flows.push({id:'CG-block',result:'Impact preview and block creation acknowledged'});
 const queued=page.locator('[data-queue-item]').first();await queued.waitFor();await queued.getByRole('button',{name:/New times/}).click();const suggestion=queued.locator('[data-suggestion]').first();
 await suggestion.waitFor();await Promise.all([ok(command('POST','/reschedule'),'Queue move'),suggestion.click()]);flows.push({id:'CG-queue-move',result:'Reschedule queue suggestion moved through the API'});
 const fixAll=page.getByRole('button',{name:'Fix all automatically'});await Promise.all([ok(command('POST','/queue/auto'),'Fix all'),fixAll.click()]);flows.push({id:'CG-queue-auto',result:'Fix all automatically acknowledged'});
 await page.getByLabel('Holiday date').fill('2026-12-26');await page.getByLabel('Holiday name').fill('Fictional closure');await Promise.all([ok(command('POST','/caregrid-api/holidays'),'Holiday'),page.getByRole('button',{name:'Add holiday'}).click()]);
 const holiday=page.getByRole('button',{name:'Remove holiday Fictional closure'});await holiday.waitFor();await Promise.all([ok(command('DELETE','/caregrid-api/holidays/'),'Holiday removal'),holiday.click()]);flows.push({id:'CG-holiday',result:'Facility holiday added and removed'});

 // Resources, catalog, insights, patients, pharmacy.
 await visit('/resources?id=1','[data-hours-editor]');await page.getByRole('button',{name:'Copy Monday to weekdays'}).click();const start=page.locator('[data-hours-editor]').getByLabel('Start',{exact:true}).first();await start.fill((await start.inputValue())==='08:15'?'08:20':'08:15');const hours=page.getByRole('button',{name:'Save hours'});await Promise.all([ok(command('PUT','/templates'),'Hours'),hours.click()]);flows.push({id:'CG-hours',result:'Weekly working hours edited and saved'});
 await visit('/catalog?type=1','[data-type-drawer="1"] input');const duration=page.getByLabel('Patient duration (min)');const value=Number(await duration.inputValue());await duration.fill(String(value+5));await Promise.all([ok(command('PATCH','/caregrid-api/types/1'),'Rules'),page.getByRole('button',{name:'Save rules'}).click()]);flows.push({id:'CG-catalog-rules',result:'Service rules validated and saved'});
 await visit('/insights','tbody tr');const set=page.getByRole('button',{name:/^Set /}).first();await Promise.all([ok(command('PATCH','/caregrid-api/types/'),'Slot advice'),set.click()]);flows.push({id:'CG-insights-apply',result:'Slot-length advice applied'});
 await page.getByRole('tab',{name:'Utilization'}).click();await page.locator('[data-utilization] li').first().waitFor();flows.push({id:'CG-utilization',result:'Utilization by resource read for the day'});
 await visit('/patients','[data-patient-profile]');await page.getByRole('textbox',{name:'Name, MRN or phone'}).fill('a');await page.locator('[data-patient-option]').nth(1).click();await page.waitForURL(/\/patients\?id=/);await page.locator('[data-patient-profile]').waitFor();
 await page.locator('[data-tour="cg-patient-book"] button').click();await page.waitForURL(/\/book\?patient=/);await page.locator('[data-selected-patient]').waitFor();flows.push({id:'CG-patients',result:'Patient search, profile and book-from-profile'});
 await visit('/pharmacy','[data-pharmacy-queue]');const arrived=page.locator('[data-pharmacy-queue]').getByRole('button',{name:'Arrived'}).first();await Promise.all([ok(command('POST','/status'),'Pharmacy arrival'),arrived.click()]);flows.push({id:'CG-pharmacy',result:'Pharmacy arrival acknowledged; queue and counter load read'});
 await visit('/help','[data-concept]');await page.getByRole('textbox',{name:'Search help'}).fill('breakdown');await page.locator('[data-concept="exceptions"]').waitFor();flows.push({id:'CG-help',result:'Help center search'});

 // Command palette record search and contextual helper.
 await page.keyboard.press('Control+k');const palette=page.getByRole('dialog');await palette.getByRole('textbox').fill('MRI');const group=palette.getByRole('group',{name:'Book a service'});await group.waitFor();await group.getByRole('button').first().click();await page.waitForURL(/\/book\?type=/);await page.locator('[data-selected-service]').waitFor();flows.push({id:'CG-palette',result:'Command palette searches API records and opens a preselected booking'});
 await page.keyboard.press('Shift+Slash');await page.getByRole('dialog',{name:/help/i}).waitFor();await page.keyboard.press('Escape');flows.push({id:'CG-page-help',result:'Contextual page helper opens with CareGrid guidance'});

 // Full-document axe on every destination and deep link (colour contrast included).
 const routes=['/','/book','/schedule','/frontdesk','/frontdesk?tab=waitlist','/frontdesk?tab=reminders','/exceptions','/resources','/resources?id=1','/catalog','/catalog?type=1','/patients','/pharmacy','/insights','/insights?tab=util','/help','/preferences','/book?patient=1&type=1'];
 for(const path of routes){await visit(path);await page.waitForTimeout(300);await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});await idle();const axe=await page.evaluate(()=>window.axe.run(document));checks.push({path,violations:axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),incomplete:axe.incomplete.length});}

 // Read-only role: writes disabled in the UI (the scheduling API itself has no authorization).
 await signIn('user1');await visit('/book?patient=1&type=1','[data-slot]');await page.locator('[data-slot]').first().click();if(await page.getByRole('button',{name:/^Book \S+/}).isEnabled())throw new Error('Read-only role could book');flows.push({id:'CG-readonly',result:'Finance role sees booking disabled (presentation gating only)'});
}catch(error){const state=await page.evaluate(()=>({url:location.pathname+location.search,timeline:!!document.querySelector('[data-row-timeline]'),rows:document.querySelectorAll('[data-row-timeline-row]').length,events:document.querySelectorAll('[data-row-event]').length,alert:document.querySelector('[role=alert]')?.textContent?.slice(0,200)??null})).catch(()=>null);errors.push({route:current,message:error.message.split('\n')[0],state});if(process.env.CAREGRID_SCREENSHOT)await page.screenshot({path:process.env.CAREGRID_SCREENSHOT.replace('.png','-failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await browser.close();const result={scope:'Local production Next server, unchanged demo host API and unchanged CareGrid scheduling API with fictional data',flows,checks,errors,consoleErrors,httpErrors};writeFileSync(process.env.CAREGRID_RESULT??'/tmp/caregrid-browser.json',JSON.stringify(result,null,2)+'\n');if(errors.length||consoleErrors.length||httpErrors.length||checks.some(c=>c.violations.length))process.exitCode=1;console.log(JSON.stringify({workflows:flows.length,routes:checks.length,errors:errors.length,consoleErrors:consoleErrors.length,httpErrors:httpErrors.length,violations:checks.reduce((n,c)=>n+c.violations.length,0)}));}
