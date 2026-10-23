import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {routes,examples} from './route-cases.mjs';
const require=createRequire(import.meta.url),base=process.env.HEALTHCARE_BASE??'http://localhost:3310';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local synthetic demo checks only');
const resultPath=process.env.HEALTHCARE_RESULT??'/tmp/phase6b-browser.json';
const fixtureCapture=process.env.HEALTHCARE_CAPTURE;
const flows=[],createdRoutes=[];
const fixtureSource=readFileSync(new URL('../../../dummy-api/server.mjs',import.meta.url),'utf8');
const secret=fixtureSource.match(/username:\s*"admin",\s*password:\s*"([^\"]+)"/)[1];
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),checks=[],errors=[],consoleErrors=[],responses=[],captures=fixtureCapture&&existsSync(fixtureCapture)?JSON.parse(readFileSync(fixtureCapture,'utf8')):{},pending=[];
let current='login';
page.on('pageerror',error=>errors.push({route:current,message:error.message}));
page.on('console',message=>{if(message.type()==='error')consoleErrors.push({route:current,message:message.text()});});
page.on('response',response=>{
 const url=new URL(response.url());if(!url.pathname.startsWith('/api/')||url.pathname.startsWith('/api/auth/'))return;
 if(response.status()>=400)responses.push({route:current,path:url.pathname,status:response.status()});
 if(!fixtureCapture||url.pathname==='/api/localization'||url.pathname==='/api/preferences')return;
 const request=response.request();const method=request.method();const body=request.postData();
 // Capture only read operations over fictional fixtures. Authentication and preference payloads are excluded.
 let parsed; try {parsed=body?JSON.parse(body):null;} catch {return;}
 const action=parsed?.action;
 if(method!=='GET'&&!['metadata','new','search','load','overview','saved-searches','config','worklist','list'].includes(action))return;
 pending.push(response.json().then(data=>{captures[JSON.stringify([method,url.pathname.slice(4)+url.search,parsed])]={status:response.status(),body:data};}).catch(()=>{}));
});
try{
 await page.goto(base+'/patient-query',{timeout:120000});await page.locator('input[type=password]').waitFor({timeout:60000});
 await page.locator('input[autocomplete=username]').fill('admin');await page.locator('input[type=password]').fill(secret);
 await page.getByRole('button',{name:/sign in/i}).click();await page.locator('[data-page-id]').waitFor({state:'attached',timeout:60000});
 if(process.env.HEALTHCARE_FLOW==='1'){
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
  await page.getByRole('button',{name:/Create outpatient encounter/i}).click();const encounterResponse=await encounterSaved;if(!encounterResponse.ok())throw new Error('Encounter create failed '+encounterResponse.status());const encounter=await encounterResponse.json();createdRoutes.push('/suite/encounters/'+encounter.id);flows.push({id:'HCD-03-encounter',result:'Suite encounter created through the UI for a fictional patient'});
 }
 for(const route of [...routes,...(process.env.HEALTHCARE_EXAMPLES==='1'?examples:[]),...createdRoutes]){
  current=route;
  try{
   await page.goto(base+route,{timeout:120000});await page.locator('[data-page-id]').waitFor({state:'attached',timeout:60000});
   await page.waitForTimeout(750);await page.waitForLoadState('networkidle',{timeout:30000});await page.waitForFunction(()=>!Array.from(document.querySelectorAll('[role=status], [aria-busy=true]')).some(node=>node.textContent.includes('Loading')||node.getAttribute('aria-busy')==='true'),{},{timeout:30000});await page.waitForTimeout(300);await page.evaluate(()=>document.fonts.ready);
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
   const axe=await page.evaluate(async()=>{const result=await window.axe.run(document);const page=await window.axe.run(document.querySelector('.healthcare-page'));return {pageViolations:page.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))})),violations:result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))})),incomplete:result.incomplete.length};});
   checks.push({route,...axe});if(process.env.HEALTHCARE_SCREENSHOTS_DIR&&['/suite','/patient-record/PT-0001','/clinical-consultation/PT-0001'].includes(route)){mkdirSync(process.env.HEALTHCARE_SCREENSHOTS_DIR,{recursive:true});await page.screenshot({path:process.env.HEALTHCARE_SCREENSHOTS_DIR+'/'+route.slice(1).replaceAll('/','-')+'.png',fullPage:true});}console.log(JSON.stringify({route,violations:axe.violations.map(v=>v.id)}));
  }catch(error){checks.push({route,failure:error.message});console.log(JSON.stringify({route,failure:error.message}));}
 }
 await Promise.all(pending);
 if(fixtureCapture){mkdirSync(new URL('../src/test/fixtures/',import.meta.url),{recursive:true});writeFileSync(fixtureCapture,JSON.stringify(captures,null,2)+'\n');}
 const result={flows,scope:'Local browser against the unchanged synthetic demo HTTP API',checks,errors,consoleErrors,responses};
 writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n');
 if(checks.some(c=>c.failure||c.violations.length)||errors.length||consoleErrors.length||responses.length)process.exitCode=1;
}finally{await browser.close();}
