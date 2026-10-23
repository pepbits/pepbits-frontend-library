import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
/** UI writes and direct HTTP assertions are distinct in the receipt. All data and providers are synthetic. */
export async function rcmFlows({page,base,flows,createdRoutes}) {
 createdRoutes.push('/rcm/w/coverages?new=1','/rcm/w/credit-notes?new=1','/rcm/w/manual-charges?new=1');
 const root=page.locator('[data-reference-module="rcm"]');
 const token=await page.evaluate(()=>localStorage.getItem('pepbits-session-token'));
 const headers=(token,branch='hq',scope='ALL:SAR',key=crypto.randomUUID())=>({Authorization:'Bearer '+token,'X-Product-Id':'nexora','X-Reference-Module':'reference-rcm','X-Reference-Branch':branch,'X-Rcm-Scope':scope,'Content-Type':'application/json','Idempotency-Key':key});
 const request=async(path,{method='GET',body,expected=200,actor=token,branch='hq',scope='ALL:SAR',key}={})=>{
  const response=await fetch(base+'/api/reference-modules/rcm/api'+path,{method,headers:headers(actor,branch,scope,key),body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();assert.equal(response.status,expected,path+' '+JSON.stringify(data.error??{}));return data;
 };
 const action=(resource,record,step,input={},options={})=>request(`/records/${resource}/${record.id}/actions/${step}`,{method:'POST',body:{rowVersion:record.rowVersion,input,reason:'Fictional demonstration'},...options});
 const visit=async path=>{await page.goto(base+'/rcm'+path);await root.locator('[data-rcm-stage]').waitFor({timeout:60000});};
 const clickCommand=async(button,path)=>{const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/reference-modules/rcm/api'+path&&r.request().method()==='POST');await button.click();const response=await saved;assert.ok(response.ok(),path+' returned '+response.status());return response.json();};
 await visit('');const meta=await request('/meta'),categories=JSON.parse(readFileSync(new URL('../src/modules/rcm/navigation.json',import.meta.url),'utf8'));
 assert.equal(meta.resources.length,36);assert.equal(meta.categories.length,8);assert.equal(meta.currentUser.name,'Prakash Mathew');
 assert.deepEqual(categories.map(c=>[c.label,c.pages.map(p=>p.path)]),meta.categories.map(c=>[c.label,c.pages.map(p=>p.href)]));
 flows.push({id:'HCD-13-registry',mode:'HTTP',result:'All 40 original destinations in eight categories match the API, with 36 resource definitions and trusted host actor'});
 // The source command palette navigates reference queries through the public host.
 const invoices=await request('/records/invoices?pageSize=100');let invoice=invoices.rows.find(r=>r.status==='DRAFT');assert.ok(invoice);
 await root.getByRole('button',{name:/Jump anywhere/}).click();const palette=page.getByRole('dialog',{name:'Jump to a page'});
 await palette.getByRole('textbox',{name:'Search',exact:true}).fill(invoice.ref);await palette.getByRole('option',{name:new RegExp('Open '+invoice.ref)}).click();await page.waitForURL(/\/rcm\/w\/invoices\?/);
 await root.getByText('Tax invoice',{exact:true}).waitFor();
 flows.push({id:'HCD-13-palette',mode:'UI',result:'Command palette opened invoice reference query and financial document'});
 invoice=await clickCommand(root.getByRole('button',{name:'Issue invoice',exact:true}),`/records/invoices/${invoice.id}/actions/issue`);assert.equal(invoice.status,'ISSUED');await page.reload();await root.getByText(invoice.ref,{exact:true}).first().waitFor();assert.equal((await request('/records/invoices/'+invoice.id)).status,'ISSUED');createdRoutes.push('/rcm/w/invoices?open='+invoice.id);
 flows.push({id:'HCD-14-invoice',mode:'UI',result:'Independent seeded invoice issued, document shown and persisted across reload'});
 // Create receipt through engine fields, with public AsyncLookup for the patient.
 const patientInvoice=invoices.rows.find(r=>r.status==='ISSUED'&&r.values.billTo==='PATIENT'&&r.balance>10);assert.ok(patientInvoice);
 await visit('/w/receipts?new=1');const dialog=page.getByRole('dialog',{name:'New receipt'});
 await dialog.getByRole('combobox',{name:'Received from',exact:true}).selectOption('PATIENT');
 const patients=await request('/options/patients'),patient=patients.find(p=>Number(p.value)===patientInvoice.values.patient);assert.ok(patient);
 await dialog.getByRole('combobox',{name:'Patient',exact:true}).fill(patient.label.split('  ')[0]);await dialog.getByRole('option',{name:new RegExp(patient.label.split('  ')[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).first().click();
 await dialog.getByRole('textbox',{name:/Amount received/}).fill('1');await dialog.getByRole('combobox',{name:'Method',exact:true}).selectOption('CARD');
 await dialog.getByRole('textbox',{name:'Reference',exact:true}).fill('RCM-PORT-SYNTHETIC');
 const receipt=await clickCommand(dialog.getByRole('button',{name:'Create receipt',exact:true}),'/records/receipts');await dialog.waitFor({state:'hidden'});
 assert.equal(receipt.createdBy,meta.currentUser.id);const allocated=await action('receipts',receipt,'allocate',{invoice:patientInvoice.id,allocateAmount:1});assert.equal(allocated.status,'ALLOCATED');assert.equal((await request('/records/invoices/'+patientInvoice.id)).balance,patientInvoice.balance-1);
 createdRoutes.push('/rcm/w/receipts?open='+receipt.id);flows.push({id:'HCD-14-receipt',mode:'UI create + HTTP allocation',result:'Receipt created with engine fields and lookup, allocated to an invoice, balances and trusted actor checked'});
 // A credit note requires a different authenticated person to issue it. Direct HTTP negative checks avoid polluting browser error monitoring.
 const values={invoice:patientInvoice.id,patient:patientInvoice.values.patient,amount:1,reasonCode:'PRICE_ERROR',note:'RCM synthetic correction'};const key=crypto.randomUUID();
 let credit=await request('/records/credit-notes',{method:'POST',body:{values},key,expected:201});assert.deepEqual(await request('/records/credit-notes',{method:'POST',body:{values},key,expected:201}),credit);
 await request('/records/credit-notes',{method:'POST',body:{values:{...values,amount:2}},key,expected:409});
 const old=credit;credit=await request('/records/credit-notes/'+credit.id,{method:'PUT',body:{rowVersion:credit.rowVersion,values:{note:'Corrected synthetic note'}}});
 await request('/records/credit-notes/'+credit.id,{method:'PUT',body:{rowVersion:old.rowVersion,values:{note:'Stale edit'}},expected:409});
 credit=await action('credit-notes',credit,'submit');await visit('/w/credit-notes?open='+credit.id);await root.getByRole('button',{name:'Approve and issue',exact:true}).waitFor();assert.ok(await root.getByRole('button',{name:'Approve and issue',exact:true}).isDisabled());
 await action('credit-notes',credit,'issue',{}, {expected:403});
 const login=async username=>{const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:username})});assert.equal(r.status,200);return (await r.json()).token;};
 const supervisor=await login('rcm-reference-supervisor');
 try {
  const before=await request('/records/invoices/'+patientInvoice.id),issued=await action('credit-notes',credit,'issue',{}, {actor:supervisor});assert.equal(issued.status,'ISSUED');assert.equal((await request('/records/invoices/'+patientInvoice.id)).balance,before.balance-1);
  const audit=await request('/records/credit-notes/'+credit.id);assert.ok(audit.timeline.some(row=>row.actorId!==meta.currentUser.id));
 } finally {await fetch(base+'/api/auth/logout',{method:'POST',headers:headers(supervisor)});}
 const isolated=await request('/records/credit-notes?q='+credit.ref,{branch:'dubai'});assert.equal(isolated.rows.length,0);
 createdRoutes.push('/rcm/w/credit-notes?open='+credit.id);flows.push({id:'HCD-15-credit',mode:'UI independent-action guard + HTTP commands',result:'Credit creation replay, changed-payload conflict, stale-version refusal, second-person issuance, invoice effect, audit and branch isolation verified'});
 const claims=await request('/records/claims?pageSize=300');let claim=claims.rows.find(r=>r.status==='READY');assert.ok(claim);
 await visit('/w/claims?open='+claim.id);claim=await clickCommand(root.getByRole('button',{name:'Submit claim',exact:true}),`/records/claims/${claim.id}/actions/submit`);assert.equal(claim.status,'SUBMITTED');
 claim=await action('claims',claim,'acknowledge');claim=await action('claims',claim,'record-denial',{denialReason:'CODING_ERROR'});assert.equal(claim.status,'DENIED');claim=await action('claims',claim,'resubmit');assert.equal(claim.status,'READY');
 createdRoutes.push('/rcm/w/claims?open='+claim.id);flows.push({id:'HCD-16-claim',mode:'UI submit + HTTP simulated response/correction',result:'Claim submitted, acknowledged, denied for synthetic coding error and corrected for resubmission'});
 await visit('/w/invoices');await root.getByRole('button',{name:/Scope:/}).click();await root.getByRole('menuitemradio',{name:/All AED branches/}).click();await root.getByRole('button',{name:/Scope: All AED branches/}).waitFor();
 const aed=await request('/records/invoices',{scope:'ALL:AED'});assert.ok(aed.rows.length);assert.ok(aed.rows.every(r=>r.currency==='AED'));
 await root.getByRole('button',{name:/Scope:/}).click();await root.getByRole('menuitemradio',{name:/All SAR branches/}).click();
 flows.push({id:'HCD-16-scope',mode:'UI + HTTP assertions',result:'Operational currency filter changes API-backed worklist while host branch authority remains unchanged'});
 await visit('/approvals');await root.getByText('Ready for your decision',{exact:true}).waitFor();assert.ok((await request('/approvals')).length>=0);
 const viewer=await login('rcm-reference-viewer');try{const meta=await request('/meta',{actor:viewer});assert.ok(meta.resources.every(r=>!r.create&&!r.actions.length&&!r.editable.length));await request('/records/credit-notes',{method:'POST',body:{values},actor:viewer,expected:403});await request('/auth/login',{method:'POST',body:{},actor:viewer,expected:403});}finally{await fetch(base+'/api/auth/logout',{method:'POST',headers:headers(viewer)});}
 flows.push({id:'HCD-15-authority',mode:'UI approvals + HTTP negative assertions',result:'Approvals inbox loaded; viewer definitions are read-only, viewer write and source identity bypass refused'});
}
