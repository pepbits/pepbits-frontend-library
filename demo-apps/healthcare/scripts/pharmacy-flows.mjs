import assert from 'node:assert/strict';
/** Real local HTTP only. UI commands and HTTP fixture/workflow commands are reported separately. */
export async function pharmacyFlows({page,base,flows,createdRoutes}) {
 const root=page.locator('[data-reference-module="pharmacy"]');
 const request=async(path,{method='GET',body,key,branch='hq',expected=200}={})=>{
  const result=await page.evaluate(async({path,method,body,key,branch})=>{
   const response=await fetch('/api/reference-modules/pharmacy/api'+path,{method,headers:{Authorization:'Bearer '+localStorage.getItem('pepbits-session-token'),'X-Product-Id':'nexora','X-Reference-Module':'reference-pharmacy','X-Reference-Branch':branch,'Content-Type':'application/json',...(method==='GET'?{}:{'Idempotency-Key':key??crypto.randomUUID()})},body:body===undefined?undefined:JSON.stringify(body)});
   return {status:response.status,body:await response.json()};
  },{path,method,body,key,branch});
  assert.equal(result.status,expected,path+' returned '+result.status);return result.body;
 };
 const command=(path,body={},expected=200)=>request(path,{method:'POST',body,expected});
 const visit=async path=>{await page.goto(base+'/pharmacy'+path);await root.locator('[data-pharmacy-stage]').waitFor({timeout:60000});};
 const clickCommand=async(button,path)=>{
  const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/reference-modules/pharmacy/api'+path&&r.request().method()==='POST');
  await button.click();const response=await saved;assert.ok(response.ok(),path+' returned '+response.status());return response.json();
 };
 await visit('/patients');await root.getByRole('button',{name:'New patient',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Register patient'}),name='Pharmacy Port Synthetic';
 await dialog.getByRole('textbox',{name:'Full name',exact:true}).fill(name);await dialog.locator('input[type=date]').fill('1990-01-01');
 const patient=await clickCommand(dialog.getByRole('button',{name:'Register patient',exact:true}),'/patients');await dialog.waitFor({state:'hidden'});
 await page.waitForURL(/\/pharmacy\/patients\?id=/);await page.reload();await root.getByRole('heading',{name,exact:true}).waitFor();
 assert.equal((await request('/patients?q='+encodeURIComponent(name),{branch:'dubai'})).length,0);
 const meta=await request('/meta');assert.equal(meta.currentUser.role,'admin');assert.equal(meta.currentUser.name,'Prakash Mathew');
 flows.push({id:'HCD-09-patient',mode:'UI + HTTP assertions',result:'Registered fictional patient, reloaded profile, checked trusted actor and branch isolation'});
 createdRoutes.push('/pharmacy/patients?id='+patient.id);
 // Exercise original search palette and query navigation.
 await root.getByRole('button',{name:/Find a patient/}).first().click();const palette=page.getByRole('dialog');
 await palette.getByRole('textbox',{name:'Search or run a command'}).fill(name);await palette.getByRole('option',{name:new RegExp(name)}).first().click();await page.waitForURL(/\/pharmacy\/patients\?id=/);
 flows.push({id:'HCD-09-search',mode:'UI',result:'Command palette searched real API and opened the patient query link'});
 // Entire self-pay prescription chain is driven through the UI.
 await root.getByRole('button',{name:'New prescription',exact:true}).last().click();const rxDialog=page.getByRole('dialog',{name:'New prescription'});
 await rxDialog.getByPlaceholder('Name, MRN or phone').fill(name);await rxDialog.getByRole('option',{name:new RegExp(name)}).click();
 await rxDialog.getByRole('combobox',{name:'Prescriber',exact:true}).selectOption(meta.doctors[0].id);
 await rxDialog.getByPlaceholder('Add medicine by name or barcode').fill('Lipitor');await rxDialog.getByRole('option',{name:/Lipitor/}).first().click();
 await rxDialog.getByRole('spinbutton',{name:'Days',exact:true}).fill('2');
 let rx=await clickCommand(rxDialog.getByRole('button',{name:'Add to intake queue'}),'/prescriptions');await rxDialog.waitFor({state:'hidden'});await page.waitForURL(/\/pharmacy\/workbench\?rx=/);
 rx=await clickCommand(root.getByRole('button',{name:'Start review',exact:true}),'/prescriptions/'+rx.id+'/review');
 assert.equal(rx.alerts.filter(a=>a.severity==='major'&&!a.overridden).length,0,'Fixture requires no clinical overrides');
 rx=await clickCommand(root.getByRole('button',{name:'Verify prescription',exact:true}),'/prescriptions/'+rx.id+'/verify');
 await root.getByRole('button',{name:'Prepare supply',exact:true}).click();
 rx=await clickCommand(page.getByRole('dialog').getByRole('button',{name:'Reserve stock',exact:true}),'/prescriptions/'+rx.id+'/dispensings');await page.getByRole('dialog').waitFor({state:'hidden'});
 const supply=rx.dispensings[0];rx=await clickCommand(root.getByRole('button',{name:'Confirm final check',exact:true}),'/dispensings/'+supply.id+'/check');
 rx=await clickCommand(root.getByRole('button',{name:/^Hand over/}),'/dispensings/'+supply.id+'/handover');assert.equal(rx.status,'dispensed');
 await page.reload();await root.getByText(rx.rx_no,{exact:true}).first().waitFor();
 assert.equal((await request('/prescriptions/'+rx.id)).status,'dispensed');createdRoutes.push('/pharmacy/workbench?rx='+rx.id);
 flows.push({id:'HCD-10-prescription',mode:'UI',result:'Created prescription, started review, verified, reserved FEFO stock, checked, handed over and reloaded supplied record'});
 await visit('/counter');const search=root.getByRole('textbox',{name:'Scan barcode or search product'});await search.fill('Panadol');await root.getByRole('option',{name:/Panadol/}).first().click();
 const sale=await clickCommand(root.getByRole('button',{name:/^Take payment /}),'/sales');
 await visit('/sales?id='+sale.id);await root.getByRole('button',{name:'Receipt',exact:true}).click();await page.getByRole('dialog',{name:new RegExp('Receipt '+sale.bill_no)}).waitFor();await page.getByRole('dialog').getByText('Invoice '+sale.bill_no,{exact:true}).waitFor();await page.keyboard.press('Escape');
 const invoice=await request('/sales/'+sale.id);await command('/sales/'+sale.id+'/returns',{lines:[{bill_line_id:invoice.lines[0].id,qty:1}],reason:'Fictional demonstration return',method:'card'},201);
 assert.equal((await request('/sales/'+sale.id)).status,'reversed');createdRoutes.push('/pharmacy/sales?id='+sale.id);
 flows.push({id:'HCD-10-sale',mode:'UI sale/receipt + HTTP return',result:'Counter payment persisted, receipt preview opened and synthetic return reversed the invoice'});
 const products=await request('/products/lookup?q=Lipitor'),otc=(await request('/products/lookup?q=Panadol&schedule=otc'))[0];
 let order=await command('/orders',{customer_name:'Synthetic Order',phone:'0000000000',channel:'web',fulfilment:'delivery',address:'Fictional demonstration address',payment:'cash_on_delivery',items:[{product_id:otc.id,qty:2}]},201);
 for(const step of ['confirm','ready','dispatch'])order=await command('/orders/'+order.id+'/'+step,{rider:'Synthetic rider'});
 order=await command('/orders/'+order.id+'/complete',{payment_method:'cash'});assert.equal(order.status,'completed');createdRoutes.push('/pharmacy/orders?id='+order.id);
 flows.push({id:'HCD-11-order',mode:'HTTP',result:'Created, confirmed, packed, dispatched and completed delivery order with invoice'});
 const suppliers=await request('/suppliers');let po=await command('/purchase-orders',{supplier_id:suppliers[0].id,items:[{product_id:products[0].id,qty:5}]},201);
 po=await command('/purchase-orders/'+po.id+'/approve');po=await command('/purchase-orders/'+po.id+'/send');
 po=await command('/purchase-orders/'+po.id+'/receive',{lines:[{po_item_id:po.items[0].id,qty:5,batch_no:'PORT-SYNTHETIC',expiry:'2028-01-01'}]});assert.equal(po.status,'received');createdRoutes.push('/pharmacy/purchasing?po='+po.id,'/pharmacy/inventory?product='+products[0].id);
 flows.push({id:'HCD-11-purchasing',mode:'HTTP',result:'Created, approved, sent and received purchase order into a synthetic stock batch'});
 const patients=await request('/patients'),covered=patients.find(p=>p.payer_code&&p.coverage_to>=new Date().toISOString().slice(0,10));assert.ok(covered);
 // Make the fixture payer post-dispense so both batch claims and remittance can be demonstrated deterministically.
 const profile=await request('/patients/'+covered.id),payer=meta.payers.find(p=>p.code===covered.payer_code);assert.ok(payer);
 await request('/payers/'+payer.id,{method:'PATCH',body:{workflow:'post_dispense'}});
 const humira=(await request('/products/lookup?q=Humira'))[0];
 let arx=await command('/prescriptions',{patient_id:covered.id,doctor_id:meta.doctors[0].id,source:'paper',priority:'routine',diagnosis_code:'M06.9',items:[{product_id:humira.id,dose:1,frequency_per_day:1,days:2,qty:2,sig:'Fictional demonstration directions'}]},201);
 arx=await command('/prescriptions/'+arx.id+'/authorizations',{justification:'Synthetic demonstration authorization'});const auth=await request('/authorizations/'+arx.authorizations[0].id);
 await command('/authorizations/'+auth.id+'/decision',{decision:'approved',items:auth.items.map(i=>({id:i.id,qty_approved:i.qty_requested})),payer_ref:'SYNTHETIC-APPROVAL',valid_to:'2027-03-31',note:'Fictional demonstration'});
 assert.equal((await request('/authorizations/'+auth.id)).status,'approved');createdRoutes.push('/pharmacy/authorizations?id='+auth.id);
 flows.push({id:'HCD-11-authorization',mode:'HTTP',result:'Requested prior authorization and recorded a simulated payer approval'});
 let crx=await command('/prescriptions',{patient_id:covered.id,doctor_id:meta.doctors[0].id,source:'paper',priority:'routine',diagnosis_code:'E78.5',items:[{product_id:products[0].id,dose:1,frequency_per_day:1,days:2,qty:2,sig:'Fictional demonstration directions'}]},201);
 crx=await command('/prescriptions/'+crx.id+'/review');crx=await command('/prescriptions/'+crx.id+'/verify',{overrides:crx.alerts.filter(a=>a.severity==='major').map(a=>({key:a.key,reason:'Fictional software demonstration override'}))});
 crx=await command('/prescriptions/'+crx.id+'/dispensings',{items:[{prescription_item_id:crx.items[0].id,qty:2}]});const dispensing=crx.dispensings[0];
 crx=await command('/dispensings/'+dispensing.id+'/check');crx=await command('/dispensings/'+dispensing.id+'/handover',{payment_method:'card',override_rejected:true});
 const drafts=crx.claims.filter(c=>c.status==='draft').sort((a,b)=>a.priority-b.priority);assert.ok(drafts.length);
 let posted=0,resubmissions=0;
 for(const claim of drafts){
  let remittances=[];
  for(let attempt=0;attempt<2;attempt++){
   const submitted=await command('/claims/submit',{ids:[claim.id],...(attempt?{note:'Fictional correction of simulated first-submission denial'}:{})});assert.equal(submitted.submitted,1);
   const adjudicated=await command('/claims/adjudicate',{ids:[claim.id]});assert.ok(adjudicated.remittances.length);remittances.push(...adjudicated.remittances);
   if((await request('/claims/'+claim.id)).status!=='rejected')break;
   resubmissions++;
  }
  let latest;
  for(const id of remittances){const ra=await request('/remittances/'+id);if(ra.total_approved>0){await command('/remittances/'+id+'/post-payment',{method:'eft'},201);posted++;latest=id;}}
  assert.ok(latest);createdRoutes.push('/pharmacy/remittance?ra='+latest);
 }
 assert.ok(posted>0);createdRoutes.push('/pharmacy/claims?claim='+drafts[0].id);
 flows.push({id:'HCD-11-claims',mode:'HTTP',resubmissions,result:'Submitted primary before secondary claims, simulated adjudication, corrected any first-submission simulated denial and posted remittance payment'});

 const replayKey=crypto.randomUUID(),payload={name:'Synthetic Replay Patient',dob:'1991-02-03',gender:'F'};
 const first=await request('/patients',{method:'POST',body:payload,key:replayKey,expected:201});const replay=await request('/patients',{method:'POST',body:payload,key:replayKey,expected:201});assert.deepEqual(replay,first);
 const audit=await request('/audit?limit=200');assert.ok(audit.rows.some(row=>row.actor===meta.currentUser.id));
 flows.push({id:'HCD-12-replay',mode:'HTTP',result:'Repeated patient command returned identical result under the same operation key; audit attributed commands to the host actor'});
 // Denials use direct local HTTP to retain expected failures separately from browser error monitoring.
 for(const role of ['technician','viewer']) {
  const username='pharmacy-'+role;
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:username})});assert.equal(login.status,200);
  const session=await login.json();
  const headers={Authorization:'Bearer '+session.token,'X-Product-Id':'nexora','X-Reference-Module':'reference-pharmacy','X-Reference-Branch':'hq','Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()};
  try {
   const path=role==='technician'?'/prescriptions/'+rx.id+'/verify':'/patients';
   const denied=await fetch(base+'/api/reference-modules/pharmacy/api'+path,{method:'POST',headers,body:JSON.stringify(role==='technician'?{overrides:[]}:payload)});assert.equal(denied.status,403);
   const bypass=await fetch(base+'/api/reference-modules/pharmacy/api/auth/login',{method:'POST',headers,body:'{}'});assert.equal(bypass.status,403);
  } finally {await fetch(base+'/api/auth/logout',{method:'POST',headers});}
 }
 flows.push({id:'HCD-12-authority',mode:'HTTP negative assertions',result:'Technician verification, viewer mutation and source identity bypass returned the expected 403 responses'});

}
