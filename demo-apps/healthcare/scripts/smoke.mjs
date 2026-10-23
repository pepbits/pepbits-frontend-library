import {surgisuiteFlows} from './surgisuite-flows.mjs';
import {qualityFlows} from './quality-flows.mjs';
import {teleconsultFlows} from './teleconsult-flows.mjs';
import {rcmPresentation as checkRcmPresentation} from './rcm-presentation.mjs';
import {rcmFlows} from './rcm-flows.mjs';
import {pharmacyFlows} from './pharmacy-flows.mjs';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {routes,examples} from './route-cases.mjs';
const require=createRequire(import.meta.url),base=process.env.HEALTHCARE_BASE??'http://localhost:3310';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local synthetic demo checks only');
const resultPath=process.env.HEALTHCARE_RESULT??'/tmp/phase6b-browser.json';
const fixtureCapture=process.env.HEALTHCARE_CAPTURE;
const routeFilter=process.env.HEALTHCARE_ROUTE_FILTER;

const flows=[],createdRoutes=[],rcmPresentation=[];
const fixtureSource=readFileSync(new URL('../../../dummy-api/server.mjs',import.meta.url),'utf8');
const secret=fixtureSource.match(/username:\s*"admin",\s*password:\s*"([^\"]+)"/)[1];
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),checks=[],errors=[],consoleErrors=[],responses=[],captures=fixtureCapture&&existsSync(fixtureCapture)?JSON.parse(readFileSync(fixtureCapture,'utf8')):{},pending=[];
page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
function scrub(value){if(Array.isArray(value))return value.map(scrub);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,/password|secret|token|api.?key/i.test(key)&&item?'[redacted]':scrub(item)]));return value;}
let current='login',selectedDiagnostic='';
async function diagnosticMenu(route){
 const variant=route.split('/')[1],side=page.locator('aside[data-tour=sidebar]');
 if(selectedDiagnostic!==variant){
  await page.locator('header [data-tour=module] button').first().click();
  await page.getByRole('listbox').getByRole('option',{name:new RegExp(variant.startsWith('teleconsult-')?'^Teleconsult '+(variant.endsWith('provider')?'Provider':'Patient')+'(?:\\s|$)':variant==='surgisuite'?'^SurgiSuite(?:\\s|$)':variant==='quality'?'^Quality(?:\\s|$)':variant==='rcm'?'^RCM(?:\\s|$)':variant==='pharmacy'?'^Pharmacy\\b':'^'+variant.toUpperCase()+'(?:\\s|$)')}).click();
  await page.locator('[data-reference-module="'+variant+'"]').waitFor();selectedDiagnostic=variant;
 }
 const toggle=side.locator('button[aria-expanded]').first();
 await page.mouse.move(700,70);
 if(await toggle.getAttribute('aria-expanded')==='false'){await toggle.focus();await toggle.press('Enter');}
 const header=page.locator('header [data-tour=module] button').first();
 if(!await header.evaluate(node=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}))throw new Error('Diagnostic sidebar covers module selector');
 await side.locator('a[href="'+route+'"]').click();await page.waitForURL(base+route);
 await side.getByRole('button',{name:'Expand navigation',exact:true}).waitFor();
}

page.on('pageerror',error=>errors.push({route:current,message:error.message}));
page.on('console',message=>{if(message.type()==='error')consoleErrors.push({route:current,message:message.text()});});
page.on('response',response=>{
 const url=new URL(response.url());if(!url.pathname.startsWith('/api/')||url.pathname.startsWith('/api/auth/'))return;
 if(response.status()>=400)responses.push({route:current,path:url.pathname,status:response.status()});
 if(process.env.HEALTHCARE_DICOM_FIXTURE&&url.pathname==='/api/reference-modules/ris1/api/dicom/instances/1'&&response.ok())pending.push(response.body().then(bytes=>writeFileSync(process.env.HEALTHCARE_DICOM_FIXTURE,bytes)));
 if(!fixtureCapture||url.pathname==='/api/localization'||url.pathname==='/api/preferences')return;
 const request=response.request();const method=request.method();const body=request.postData();
 // Capture only read operations over fictional fixtures. Authentication and preference payloads are excluded.
 let parsed; try {parsed=body?JSON.parse(body):null;} catch {return;}
 const action=parsed?.action;
 if(method!=='GET'&&!['metadata','new','search','load','overview','saved-searches','config','worklist','list'].includes(action))return;
 pending.push(response.json().then(data=>{captures[JSON.stringify([method,url.pathname.slice(4)+url.search,parsed])]={status:response.status(),body:scrub(data)};}).catch(()=>{}));
});
try{
 await page.goto(base+'/patient-query',{timeout:120000});await page.locator('input[type=password]').waitFor({timeout:60000});
 await page.locator('input[autocomplete=username]').fill('admin');await page.locator('input[type=password]').fill(secret);
 await page.getByRole('button',{name:/sign in/i}).click();await page.locator('[data-page-id]').waitFor({state:'attached',timeout:60000});
 if(process.env.HEALTHCARE_FLOW==='1'&&(!routeFilter||new RegExp(routeFilter).test('/suite'))){
  await page.getByRole('textbox',{name:/Search/i}).first().fill('Alex');await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.getByText('Alex Morgan',{exact:true}).first().waitFor();flows.push({id:'HCD-02',result:'patient search returned the fictional patient'});
  await page.goto(base+'/patient-record/PT-0001');await page.getByRole('heading',{name:'Alex Morgan'}).waitFor({timeout:60000});flows.push({id:'HCD-03',result:'patient record opened'});
  await page.goto(base+'/clinical-consultation/PT-0001');const complaint=page.getByRole('textbox',{name:/Chief complaint/});await complaint.waitFor({timeout:60000});
  await complaint.fill('Fictional demonstration follow-up');const saved=page.waitForResponse(response=>response.url().endsWith('/clinical-consultation')&&response.request().postDataJSON()?.action==='save');
  await page.getByRole('button',{name:'Save draft',exact:true}).click();const response=await saved;if(!response.ok())throw new Error('Consultation draft save failed '+response.status());
  await page.reload();await page.getByRole('textbox',{name:/Chief complaint/}).waitFor();if(await page.getByRole('textbox',{name:/Chief complaint/}).inputValue()!=='Fictional demonstration follow-up')throw new Error('Consultation draft was not restored');flows.push({id:'HCD-04',result:'consultation draft saved through HTTP and survived reload'});
  await page.goto(base+'/suite/encounters/new?patientId=PT00001');
  await page.getByRole('combobox',{name:/^Department/}).selectOption('D001');await page.getByRole('combobox',{name:/^Treating provider/}).selectOption('P001');await page.getByRole('radio',{name:'Self-pay',exact:true}).click();
  const encounterSaved=page.waitForResponse(response=>response.url().endsWith('/healthcare-suite/api/encounters')&&response.request().method()==='POST');
  await page.getByRole('button',{name:/Create outpatient encounter/i}).click();const encounterResponse=await encounterSaved;if(!encounterResponse.ok())throw new Error('Encounter create failed '+encounterResponse.status());const encounter=await encounterResponse.json();await page.waitForURL(base+'/suite/encounters/'+encounter.id,{timeout:60000});await page.getByRole('heading',{name:new RegExp(encounter.encNo)}).first().waitFor({timeout:60000});createdRoutes.push('/suite/encounters/'+encounter.id);flows.push({id:'HCD-03-encounter',result:'Suite encounter created through the UI for a fictional patient'});
 }
 if(process.env.HEALTHCARE_FLOW==='1'&&!routeFilter){
  for(const variant of ['lis1','lis2','ris1']){
   current='/'+variant+'/patients';await page.goto(base+current);const root=page.locator('[data-reference-module="'+variant+'"]');
   await root.getByRole('button',{name:'Register patient',exact:true}).click();const dialog=page.getByRole('dialog');
   const name='DemoPort'+variant;
   await dialog.getByRole('textbox',{name:/First name/}).fill(name);await dialog.getByRole('textbox',{name:/Last name/}).fill('Synthetic');
   await dialog.locator('input[type=date]').fill('1990-01-01');if(variant==='ris1')await dialog.getByRole('combobox',{name:'Sex',exact:true}).selectOption('M');
   const saved=page.waitForResponse(r=>r.url().endsWith('/reference-modules/'+variant+'/api/patients')&&r.request().method()==='POST');
   await dialog.getByRole('button',{name:variant==='lis1'?'Save patient':'Register patient',exact:true}).click();
   const response=await saved;if(!response.ok())throw new Error(variant+' patient save failed '+response.status());const patient=await response.json();
   await dialog.waitFor({state:'hidden'});
   // Both modules navigate after saving; wait for that navigation before returning to search.
   if(variant!=='lis1'){await page.waitForURL(base+'/'+variant+'/patients/'+patient.id,{timeout:60000});await root.getByText(new RegExp(name)).first().waitFor({timeout:60000});}
   await page.goto(base+'/'+variant+'/patients');
   await root.getByRole('textbox').first().fill(name);await root.getByText(new RegExp(name)).first().waitFor();
   const isolation=await page.evaluate(async({variant,name})=>{const response=await fetch('/api/reference-modules/'+variant+'/api/patients?q='+name,{headers:{Authorization:'Bearer '+localStorage.getItem('pepbits-session-token'),'X-Product-Id':'nexora','X-Reference-Branch':'dubai','X-Reference-Module':'reference-'+variant}});const body=await response.json();return {status:response.status,count:(Array.isArray(body)?body:body.data).length};},{variant,name});
   if(isolation.status!==200||isolation.count!==0)throw new Error(variant+' branch isolation failed');
   if(variant!=='ris1'){
    const request=async(path,body)=>page.evaluate(async({variant,path,body})=>{const response=await fetch('/api/reference-modules/'+variant+'/api'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+localStorage.getItem('pepbits-session-token'),'X-Product-Id':'nexora','X-Reference-Branch':'hq','X-Reference-Module':'reference-'+variant,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!response.ok)throw new Error('Diagnostic fixture '+path+' failed '+response.status);return response.json();},{variant,path,body});
    const tests=await request('/masters/tests'),test=(Array.isArray(tests)?tests:tests.data).find(t=>t.active&&!t.requiresBodySite&&!t.body_site_required);
    const createdOrder=await request('/orders',variant==='lis1'?{patientId:patient.id,testIds:[test.id],profileIds:[],priority:'ROUTINE'}:{patientId:patient.id,tests:[{testId:test.id}],priority:'ROUTINE',encounter:{type:'OP'}});
    const order=await request('/orders/'+createdOrder.id);
    createdRoutes.push('/'+variant+'/orders/'+order.id,'/'+variant+'/masters/tests');
    if(variant==='lis1'){
     const invoice=await request('/billing/orders/'+order.id+'/invoice',{payerType:'SELF'});
     await request('/samples/collect',{orderTestIds:order.tests.map(t=>t.id)});
     createdRoutes.push('/lis1/billing/'+invoice.id,'/lis1/reports/'+order.id);
    }else{
     const collection=await request('/samples/collect',{itemIds:order.items.map(t=>t.id)}),sample=collection.samples[0];
     await request('/samples/receive',{barcode:sample.sample_no});
     createdRoutes.push('/lis2/patients/'+patient.id,'/lis2/results/sample/'+sample.id,'/lis2/print/order/'+order.id,'/lis2/print/labels?ids='+sample.id);
    }
   }else{
    createdRoutes.push('/ris1/patients/'+patient.id,'/ris1/orders/1','/ris1/reading/1','/ris1/print/report/1','/ris1/print/invoice/1');
   }
   flows.push({id:'HCD-07-'+variant,result:'Patient registered through UI and real HTTP, searchable in own branch, absent in other branch'});
  }
 }
 if(process.env.HEALTHCARE_FLOW==='1'&&(!routeFilter||routeFilter.includes('rcm'))){current='/rcm';try{await rcmFlows({page,base,flows,createdRoutes});}catch(error){checks.push({route:current,failure:error.message,rendered:await page.locator('body').innerText()});console.error(JSON.stringify({error:error.message,errors,consoleErrors,responses,rendered:await page.locator('body').innerText()}));if(!await page.locator('[data-rcm-stage]').count())throw error;}}
 if(process.env.HEALTHCARE_FLOW==='1'&&(!routeFilter||routeFilter.includes('pharmacy'))){current='/pharmacy';try{await pharmacyFlows({page,base,flows,createdRoutes});}catch(error){checks.push({route:current,failure:error.message});console.error(error.message);}}
 if(process.env.HEALTHCARE_FLOW==='1'&&(!routeFilter||routeFilter.includes('teleconsult'))){current='/teleconsult-provider';try{await teleconsultFlows({page,base,flows,createdRoutes});}catch(error){checks.push({route:current,failure:error.message,rendered:await page.locator('body').innerText()});console.error(error.stack);}}
 if(process.env.HEALTHCARE_FLOW==='1'&&(!routeFilter||routeFilter.includes('surgisuite'))){current='/surgisuite';try{await surgisuiteFlows({page,base,flows,createdRoutes});}catch(error){checks.push({route:current,failure:error.message});console.error(error.stack);if(process.env.HEALTHCARE_FAIL_FAST==='1')throw error;}}
 if(process.env.HEALTHCARE_FLOW==='1'&&(!routeFilter||routeFilter.includes('quality'))){current='/quality';try{await qualityFlows({page,base,flows,createdRoutes});}catch(error){checks.push({route:current,failure:error.message});console.error(error.stack);if(process.env.HEALTHCARE_FAIL_FAST==='1')throw error;}}
 for(const route of [...routes,...(process.env.HEALTHCARE_EXAMPLES==='1'?examples:[]),...createdRoutes].filter(route=>!routeFilter||new RegExp(routeFilter).test(route))){
  current=route;
  try{
   if(/^\/(lis1|lis2|ris1|pharmacy|rcm|quality|surgisuite|teleconsult-provider|teleconsult-patient)(?:\/|$)/.test(route)&&routes.includes(route))await diagnosticMenu(route);else await page.goto(base+route,{timeout:120000});await page.locator('[data-page-id]').waitFor({state:'attached',timeout:60000});
   await page.waitForTimeout(750);await page.waitForLoadState('networkidle',{timeout:30000});await page.waitForFunction(()=>!Array.from(document.querySelectorAll('[role=status], [aria-busy=true]')).some(node=>node.textContent.includes('Loading')||node.getAttribute('aria-busy')==='true'),{},{timeout:30000});await page.waitForTimeout(300);await page.evaluate(()=>document.fonts.ready);
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
   const axe=await page.evaluate(async()=>{const result=await window.axe.run(document);const page=await window.axe.run(document.querySelector('.healthcare-page'));return {pageViolations:page.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))})),violations:result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))})),incomplete:result.incomplete.length};});
   checks.push({route,...axe});if(route.startsWith("/rcm"))rcmPresentation.push({name:"page "+route,failures:axe.violations.map(v=>v.id)});if(process.env.HEALTHCARE_SCREENSHOTS_DIR&&(['/surgisuite','/surgisuite/cases','/surgisuite/analytics','/suite','/quality','/quality/authorities','/quality/reports/designer','/patient-record/PT-0001','/clinical-consultation/PT-0001','/lis1','/lis2','/ris1','/pharmacy','/pharmacy/workbench','/pharmacy/counter','/rcm','/rcm/w/invoices','/rcm/approvals','/teleconsult-provider','/teleconsult-patient/home','/teleconsult-patient/visit/a8/summary'].includes(route)||/^\/surgisuite\/cases\/\d+$/.test(route))){mkdirSync(process.env.HEALTHCARE_SCREENSHOTS_DIR,{recursive:true});await page.screenshot({path:process.env.HEALTHCARE_SCREENSHOTS_DIR+'/'+route.slice(1).replaceAll('/','-')+'.png',fullPage:true});}console.log(JSON.stringify({route,violations:axe.violations.map(v=>v.id)}));
  }catch(error){checks.push({route,failure:error.message});console.log(JSON.stringify({route,failure:error.message}));}
 }
 if(!routeFilter||routeFilter.includes('rcm'))rcmPresentation.push(...await checkRcmPresentation({page,base}));
 }catch(error){checks.push({route:current,failure:error.message,rendered:await page.evaluate(()=>({path:location.pathname,pageId:document.querySelector('[data-page-id]')?.getAttribute('data-page-id'),headings:Array.from(document.querySelectorAll('.healthcare-page h1,.healthcare-page h2')).map(n=>n.textContent),inputs:Array.from(document.querySelectorAll('.healthcare-page input')).map(n=>({type:n.type,placeholder:n.placeholder}))})).catch(()=>null)});process.exitCode=1;console.error(error.message);}
 finally{
 await Promise.all(pending);
 if(fixtureCapture){mkdirSync(new URL('../src/test/fixtures/',import.meta.url),{recursive:true});writeFileSync(fixtureCapture,JSON.stringify(captures,null,2)+'\n');}
 const result={flows,rcmPresentation,scope:'Local browser against the unchanged synthetic demo HTTP API',checks,errors,consoleErrors,responses};
 writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n');
 if(rcmPresentation.some(c=>c.failures.length)||checks.some(c=>c.failure||c.violations.length)||errors.length||consoleErrors.length||responses.length)process.exitCode=1;
 await browser.close();
}
