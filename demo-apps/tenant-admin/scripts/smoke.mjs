import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
/**
 * Real local HTTP workflows for the Tenant Admin demo: production Next server, unchanged fictional demo API, Chromium.
 * Fixture credentials are read from the API fixture source at run time and are never printed or written to receipts.
 */
const require=createRequire(import.meta.url),base=process.env.TENANT_ADMIN_BASE??'http://localhost:3360';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local demo checks only');
const fixtureSource=readFileSync(new URL('../../../mock-api/server.mjs',import.meta.url),'utf8');
// Access-reference fixture accounts use the role name as both username and password (see mock-api/server.mjs).
if(!/ACCOUNTS\.push\(\{username:role,password:role,/.test(fixtureSource))throw new Error('Access fixture account convention changed');
const secretFor=role=>fixtureSource.includes("'"+role+"'")?role:null;
const ADMIN='tenant-config-admin',APPROVER='tenant-config-approver',VIEWER='tenant-config-viewer';
const NS='/api/reference-modules/tenant-admin';
const shots=process.env.TENANT_ADMIN_SCREENSHOTS_DIR;if(shots)mkdirSync(shots,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const flows=[],checks=[],errors=[],httpErrors=[],consoleErrors=[],expected=[];let current='login';
page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
page.on('pageerror',e=>errors.push({route:current,message:e.message}));
page.on('console',e=>{if(e.type()==='error'&&!expected.some(x=>x.console&&e.text().includes(String(x.status))))consoleErrors.push({route:current,message:e.text()});});
page.on('response',r=>{const u=new URL(r.url());if(!u.pathname.startsWith('/api/')||u.pathname.includes('/auth/')||r.status()<400)return;const hit=expected.findIndex(x=>x.status===r.status()&&u.pathname.endsWith(x.path)&&x.method===r.request().method());if(hit>=0){expected[hit].seen=true;return;}httpErrors.push({route:current,path:u.pathname,status:r.status()});});
const expect=(method,path,status)=>{const entry={method,path,status,console:true};expected.push(entry);return entry;};
const settled=()=>page.waitForFunction(()=>!document.querySelector('[role="status"].animate-spin,[data-tenant-admin-stage] [role="status"]')&&document.getAnimations().every(a=>a.playState!=='running'||a.effect?.getComputedTiming().iterations===Infinity));
async function waitData(){
 await page.locator('[data-page-id]').first().waitFor();
 const path=new URL(page.url()).pathname;
 if(path==='/preferences'){await page.getByRole('combobox',{name:'Default rows per page'}).waitFor();return settled();}
 await page.locator('[data-tenant-admin-toolbar] h1').waitFor();
 if(path==='/')await page.getByRole('heading',{name:/Billing is (open|closed) for/}).waitFor();
 if(path.startsWith('/config/'))await page.locator('[data-tenant-admin-body] tbody tr').first().waitFor();
 if(path==='/activity')await page.locator('[data-tenant-admin-body] tbody tr').first().waitFor();
 await settled();
}
async function capture(name){if(!shots)return;await settled();await page.screenshot({path:join(shots,name+'.png'),fullPage:false});}
async function visit(path){current=path;await page.goto(base+path);await waitData();}
async function signIn(role){
 await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await page.goto(base+'/');current='login:'+role;
 await page.locator('input[autocomplete=username]').fill(role);await page.locator('input[type=password]').fill(secretFor(role));
 await page.getByRole('button',{name:/sign in/i}).click();await waitData();
}
async function apiSession(role){const r=await page.request.post(base+'/api/auth/login',{data:{username:role,password:secretFor(role)}});if(!r.ok())throw new Error('Fixture API sign-in failed for '+role);const body=await r.json();return {token:body.token,branch:body.user?.branch??'hq'};}
const api=(session,method,path,data)=>page.request.fetch(base+NS+path,{method,headers:{Authorization:'Bearer '+session.token,'X-Product-Id':'nexora','X-Reference-Module':'reference-tenant-admin','X-Reference-Branch':session.branch,...(method!=='GET'?{'Idempotency-Key':crypto.randomUUID()}:{})},...(data?{data}:{})});
const drawer=()=>page.locator('[role="dialog"]').filter({has:page.locator('[data-overlay="true"]')}).last();
const until=(method,fragment)=>page.waitForResponse(r=>r.request().method()===method&&new URL(r.url()).pathname.includes(fragment));
async function ok(promise,label,status=[200,201]){const r=await promise;if(!status.includes(r.status()))throw new Error(label+' returned '+r.status());return r.json().catch(()=>null);}
const today=new Date().toISOString().slice(0,10),suffix=Date.now().toString(36).slice(-5).toUpperCase();

try{
 await page.goto(base+'/');
 if(process.env.TENANT_ADMIN_CAPTURE){
  // Fixture capture for mocked component tests: real responses of the unchanged API before any workflow changes data.
  const session=await apiSession(ADMIN),out={};const get=async path=>{const r=await api(session,'GET',path);if(!r.ok())throw new Error('Capture failed '+path+' '+r.status());out[path.split('?')[0]]=await r.json();return out[path.split('?')[0]];};
  const meta=await get('/meta');for(const path of ['/pending','/overview','/approvals','/audit?limit=300'])await get(path);
  for(const resource of meta.resources){const list=await get('/resources/'+resource.key+'?status=ALL&page=1&pageSize=10&sort=updated&dir=desc');await get('/resources/'+resource.key+'/options');if(list.rows[0])await get('/resources/'+resource.key+'/'+list.rows[0].id);}
  writeFileSync(process.env.TENANT_ADMIN_CAPTURE,JSON.stringify(out,null,1)+'\n');flows.push({id:'TA-capture',scope:'direct HTTP',result:'Captured '+Object.keys(out).length+' fixture responses for mocked tests'});
 }

 await signIn(ADMIN);flows.push({id:'TA-01',scope:'UI',result:'Fixture sign-in through the shared login and host chain; overview from GET /overview'});
 const stages=await page.locator('[aria-label="Activation path"] ol > li').count();if(stages<4)throw new Error('Activation path missing');
 const navLinks=await page.locator('aside a[href^="/config/"], nav a[href^="/config/"]').evaluateAll(links=>[...new Set(links.map(a=>a.getAttribute('href')))]);
 if(navLinks.length!==30)throw new Error('Sidebar should list 30 registry pages, found '+navLinks.length);
 flows.push({id:'TA-02',scope:'UI',result:'Sidebar derived from GET /meta lists 30 configuration pages',count:navLinks.length});
 await capture('overview');

 await visit('/preferences');const saved=until('PUT','/preferences');await page.getByRole('combobox',{name:'Default rows per page'}).selectOption('10');await ok(saved,'Preference update');
 const listed=page.waitForResponse(r=>r.url().includes('/resources/tax-rules?')&&new URL(r.url()).searchParams.get('pageSize')==='10');await visit('/config/tax-rules');await listed;
 flows.push({id:'TA-03',scope:'UI',result:'Accepted host page-size preference drives the configuration list query'});

 // Versioned page: search, status filter, sort, server validation, draft, submit.
 const firstName=(await page.locator('[data-tenant-admin-body] tbody tr').first().locator('td').nth(1).textContent()).trim();
 const searched=page.waitForResponse(r=>r.url().includes('/resources/tax-rules?')&&new URL(r.url()).searchParams.get('q')===firstName.split(' ')[0]);
 await page.getByRole('textbox',{name:'Search records'}).fill(firstName.split(' ')[0]);await searched;await page.getByRole('textbox',{name:'Search records'}).fill('');
 const filtered=page.waitForResponse(r=>r.url().includes('/resources/tax-rules?')&&new URL(r.url()).searchParams.get('status')==='APPROVED');await page.getByRole('tab',{name:/^Approved/}).click();await filtered;
 const sorted=page.waitForResponse(r=>r.url().includes('/resources/tax-rules?')&&new URL(r.url()).searchParams.get('sort')==='name');await page.getByRole('button',{name:'Name',exact:true}).click();await sorted;
 await page.getByRole('tab',{name:/^All/}).click();
 flows.push({id:'TA-04',scope:'UI',result:'Registry list search, status filter and sort issue API queries'});
 await page.getByRole('button',{name:'New tax rule'}).click();let dialog=page.getByRole('dialog',{name:'New tax rule'});await dialog.waitFor();
 const name='Fictional tax rule '+suffix;
 await dialog.locator('#f-name').fill(name);await dialog.locator('#f-jurisdiction').fill('ZZ');await dialog.locator('#f-taxCategory').selectOption('EXEMPT');await dialog.locator('#f-treatment').selectOption('EXEMPT');await dialog.locator('#f-ratePercent').fill('5');await dialog.locator('#f-appliesTo').selectOption('ALL_PATIENTS');
 const created=until('POST','/resources/tax-rules');await page.getByRole('button',{name:'Save draft'}).click();const draft=await ok(created,'Draft creation');
 flows.push({id:'TA-05',scope:'UI',result:'Incomplete draft saved without strict validation',record:draft.code});
 dialog=page.getByRole('dialog',{name:'Tax rule'});await dialog.waitFor();
 // Submission applies the strict cross-field rule: the refusal is shown on the field and the typed values stay.
 const submitPath='/resources/tax-rules/'+draft.id+'/submit',refused=expect('POST',submitPath,422);
 await page.getByRole('button',{name:'Submit for approval'}).click();let reason=page.getByRole('dialog',{name:'Submit for approval'});
 const invalid=until('POST',submitPath);await reason.getByRole('button',{name:'Submit for approval'}).click();const invalidResponse=await invalid;
 if(invalidResponse.status()<400)throw new Error('Server accepted a non-taxable rate on submission');refused.status=invalidResponse.status();
 await dialog.getByText('Only taxable treatment can carry a rate above zero.').first().waitFor();
 if(await dialog.locator('#f-name').inputValue()!==name)throw new Error('Typed values were not preserved after refusal');
 flows.push({id:'TA-06',scope:'UI',result:'Strict submission refusal shown on the field; typed values preserved',status:invalidResponse.status()});
 await dialog.locator('#f-ratePercent').fill('0');
 const resaved=until('PUT','/resources/tax-rules/'+draft.id);await page.getByRole('button',{name:'Submit for approval'}).click();reason=page.getByRole('dialog',{name:'Submit for approval'});await reason.getByLabel('Reason (optional)').fill('Fictional annual review');
 const submitted=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith(submitPath)&&r.status()<400);await reason.getByRole('button',{name:'Submit for approval'}).click();await ok(resaved,'Corrected draft save');await submitted;await page.getByText('You submitted this, so someone else must decide it.').waitFor();
 if(!(await page.getByRole('button',{name:'Approve'}).isDisabled()))throw new Error('Self-approval was offered');
 flows.push({id:'TA-07',scope:'UI',result:'Corrected draft saved and submitted with a reason; self-approval disabled',record:draft.code});
 await capture('record-drawer');
 await page.keyboard.press('Escape');await page.waitForURL(base+'/config/tax-rules');

 await visit('/approvals');await page.getByRole('tab',{name:/Your submissions/}).click();await page.locator('li',{hasText:name}).getByText('Waiting for another approver').waitFor();
 flows.push({id:'TA-08',scope:'UI',result:'Approvals inbox separates own submissions from decisions'});

 // Direct HTTP refusals: the server, not the UI, enforces independence, roles and row versions.
 const adminApi=await apiSession(ADMIN);
 const self=await api(adminApi,'POST','/resources/tax-rules/'+draft.id+'/approve',{rowVersion:(await (await api(adminApi,'GET','/resources/tax-rules/'+draft.id)).json()).rowVersion});
 if(self.status()<400)throw new Error('Server allowed self-approval');flows.push({id:'TA-09',scope:'direct HTTP',result:'Server refuses approval by the submitter',status:self.status()});
 const viewerApi=await apiSession(VIEWER);const denied=await api(viewerApi,'POST','/resources/categories',{name:'Fictional denied',data:{type:'CATEGORY'}});
 if(denied.status()!==403)throw new Error('Viewer write was not refused');flows.push({id:'TA-10',scope:'direct HTTP',result:'Viewer role write refused by the server',status:403});

 await signIn(APPROVER);await visit('/approvals');const item=page.locator('li',{hasText:name});await item.waitFor();
 await item.getByRole('button',{name:'Approve'}).click();const approve=page.getByRole('dialog',{name:'Approve '+draft.code});const approved=until('POST','/'+draft.id+'/approve');await approve.getByRole('button',{name:'Approve'}).click();await ok(approved,'Approval');
 await item.waitFor({state:'detached'});flows.push({id:'TA-11',scope:'UI',result:'Independent approver decides from the inbox through the reason dialog'});

 await visit('/activity');const audit=page.waitForResponse(r=>r.url().includes('/audit?')&&new URL(r.url()).searchParams.get('action')==='APPROVED');await page.getByLabel('Filter by action').selectOption('APPROVED');await audit;
 await page.getByRole('link',{name:draft.code}).first().click();await page.waitForURL(url=>url.pathname==='/config/tax-rules'&&url.searchParams.get('open')===String(draft.id));
 dialog=page.getByRole('dialog',{name:'Tax rule'});await dialog.waitFor();await dialog.getByRole('button',{name:'History and versions'}).click();await page.getByText('Audit trail for '+draft.code).waitFor();await page.getByText('Approved',{exact:true}).first().waitFor();
 flows.push({id:'TA-12',scope:'UI',result:'Audit filter, record deep link and history/revisions tab'});
 await page.reload();await waitData();await page.getByRole('dialog',{name:'Tax rule'}).waitFor();flows.push({id:'TA-13',scope:'UI',result:'?open= deep link survives reload'});

 await signIn(ADMIN);await visit('/config/tax-rules?open='+draft.id);dialog=page.getByRole('dialog',{name:'Tax rule'});await dialog.waitFor();
 await page.getByRole('button',{name:'New version'}).click();const start=page.getByRole('dialog',{name:'Start a new version'});const versioned=until('POST','/'+draft.id+'/new-version');await start.getByRole('button',{name:'Start new version'}).click();const revision=await ok(versioned,'New version');
 if(revision.revision!==2)throw new Error('New version is not revision 2');await page.getByRole('button',{name:'Discard draft'}).click();const confirm=page.getByRole('dialog',{name:'Discard draft'});const discarded=until('DELETE','/'+revision.id);await confirm.getByRole('button',{name:'Discard draft'}).click();await ok(discarded,'Discard');
 flows.push({id:'TA-14',scope:'UI',result:'Approved version stays locked; new revision started then discarded'});
 const stale=expect('PUT','/resources/tax-rules/'+draft.id,409);const staleResponse=await api(adminApi,'PUT','/resources/tax-rules/'+draft.id,{name,rowVersion:0,data:{}});stale.seen=true;
 if(![409,422].includes(staleResponse.status()))throw new Error('Stale or locked write was not refused: '+staleResponse.status());flows.push({id:'TA-15',scope:'direct HTTP',result:'Write against an approved version or stale row version refused',status:staleResponse.status(),code:(await staleResponse.json()).error?.code});

 // Simple (non-versioned) page: create, edit, deactivate, activate.
 await visit('/config/categories');await page.getByRole('button',{name:'New category'}).click();dialog=page.getByRole('dialog',{name:'New category'});await dialog.waitFor();
 const category='Fictional category '+suffix;await dialog.locator('#f-name').fill(category);await dialog.locator('#f-type').selectOption('GROUP');
 const made=until('POST','/resources/categories');await page.getByRole('button',{name:'Create category'}).click();const row=await ok(made,'Category create');
 await page.getByRole('dialog',{name:'Category'}).waitFor();await page.getByRole('dialog',{name:'Category'}).locator('#f-description').fill('Fictional description');const edited=until('PUT','/resources/categories/'+row.id);await page.getByRole('button',{name:'Save changes'}).click();await ok(edited,'Category edit');
 await page.getByRole('button',{name:'Deactivate'}).click();const off=until('POST','/'+row.id+'/deactivate');await page.getByRole('dialog',{name:'Deactivate'}).getByRole('button',{name:'Deactivate'}).click();await ok(off,'Deactivate');
 const on=until('POST','/'+row.id+'/activate');await page.getByRole('button',{name:'Activate'}).click();await ok(on,'Activate');
 flows.push({id:'TA-16',scope:'UI',result:'Simple configuration record created, edited, deactivated and activated'});
 await page.keyboard.press('Escape');

 await visit('/config/reimbursement-routes');await page.getByRole('button',{name:'Test route selection'}).click();const tester=page.getByRole('dialog',{name:'Test route selection'});await tester.waitFor();
 await tester.locator('#rt-item').click();await tester.getByRole('option').first().click();const tested=until('POST','/tools/route-test');await tester.getByRole('button',{name:'Run test'}).click();await ok(tested,'Route test');await tester.getByText('Candidates, in evaluation order').waitFor();
 flows.push({id:'TA-17',scope:'UI',result:'Reimbursement route tester runs against approved routes'});await capture('route-tester');await page.keyboard.press('Escape');

 await visit('/');await page.keyboard.press('Control+k');const palette=page.getByRole('dialog',{name:'Jump to a page'});await palette.waitFor();await palette.getByLabel('Search').fill('new tax');await palette.getByLabel('Search').press('Enter');
 await page.waitForURL(url=>url.pathname==='/config/tax-rules'&&url.searchParams.get('new')==='1');await page.getByRole('dialog',{name:'New tax rule'}).waitFor();
 flows.push({id:'TA-18',scope:'UI',result:'Ctrl+K palette opens a New entry deep link'});await page.keyboard.press('Escape');

 await visit('/approvals');await page.getByRole('link',{name:'Approvals'}).first().waitFor();await capture('approvals');
 // Accessibility sweep: every workspace and registry route, deep links and not-found.
 const routes=['/','/approvals','/activity','/preferences',...navLinks,'/config/tax-rules?new=1','/config/tax-rules?open='+draft.id];
 for(const path of routes){await visit(path);if(path.includes('?'))await page.locator('[data-overlay="true"]').first().waitFor();
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});await settled();const axe=await page.evaluate(()=>window.axe.run(document));
  checks.push({path,violations:axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),incomplete:axe.incomplete.length});}
 current='/nope';await page.goto(base+'/nope');await page.getByText('This page doesn’t exist').waitFor();await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const missing=await page.evaluate(()=>window.axe.run(document));checks.push({path:'/nope',violations:missing.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),incomplete:missing.incomplete.length});
 await capture('configuration');
}catch(error){errors.push({route:current,message:error.message});process.exitCode=1;if(shots)await page.screenshot({path:join(shots,'failure.png'),fullPage:true}).catch(()=>{});}
finally{
 await browser.close();
 const unseen=expected.filter(x=>!x.seen).map(({method,path,status})=>({method,path,status}));
 const result={scope:'Local production Next server and unchanged fictional HTTP API',flows,checks,errors,consoleErrors,httpErrors,expectedRefusals:expected.map(({method,path,status,seen})=>({method,path,status,seen:!!seen})),unseenExpected:unseen};
 writeFileSync(process.env.TENANT_ADMIN_RESULT??'/tmp/tenant-admin-browser.json',JSON.stringify(result,null,2)+'\n');
 if(errors.length||consoleErrors.length||httpErrors.length||checks.some(c=>c.violations.length))process.exitCode=1;
 console.log(JSON.stringify({workflows:flows.length,routes:checks.length,errors:errors.length,consoleErrors:consoleErrors.length,httpErrors:httpErrors.length,violations:checks.reduce((n,c)=>n+c.violations.length,0)}));
}
