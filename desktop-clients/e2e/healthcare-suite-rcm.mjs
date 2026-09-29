import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {REFERENCE_MODULES,referenceNavigationTarget} from '../packages/erp-config/src/reference-modules.ts';
import {parseRcmWorkspace,parseRcmCommandResponse} from '../packages/reference-healthcare-suite/src/lib/rcm-contract.ts';
import {loadPlaywright,BASE,API,requireShell} from './harness.mjs';

// Real authenticated synthetic acceptance. Successful business commands use the UI;
// direct HTTP reads verify persistence, and direct denied writes verify authorization.
// No business-response interception, caller-supplied role, or client-marked payment.
const moduleId='reference-healthcare-suite';
const requireProviders=process.env.E2E_RCM_REQUIRE_PROVIDERS==='1';
const output=process.env.E2E_ARTIFACTS??'/tmp/healthcare-suite-rcm-browser';
mkdirSync(output,{recursive:true,mode:0o700});
const runId=Date.now().toString(36),results=[],pageErrors=[],networkFailures=[],consoleErrors=[],mutations=[],contexts=[];
let activePage,step=0;
const persist=()=>writeFileSync(join(output,'results.json'),JSON.stringify({base:BASE,api:API,runId,scope:'Authenticated synthetic browser acceptance; external provider flows depend on trusted configuration.',results,pageErrors,networkFailures,consoleErrors,mutations},null,2)+'\n',{mode:0o600});
const record=(name,detail={})=>{results.push({name,status:'passed',...detail});persist();console.log('PASS '+name);};
const pending=(name,reason)=>{results.push({name,status:'not-run',reason});persist();console.log('NOT RUN '+name+': '+reason);};
const root=page=>page.locator('[data-reference-module="healthcare-suite"]');
const rcm=page=>root(page).locator('[data-rcm-section]');
const major=minor=>{assert.ok(Number.isSafeInteger(minor)&&minor>=0);return `${Math.floor(minor/100)}.${String(minor%100).padStart(2,'0')}`;};
const day=new Date().toISOString().slice(0,10);
const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);

await requireShell(BASE);
const args=process.env.E2E_DNS_OVERRIDE?[`--host-resolver-rules=${process.env.E2E_DNS_OVERRIDE}`]:[];
const browser=await loadPlaywright().chromium.launch({chromiumSandbox:false,args});

async function screenshot(page,name){
 activePage=page;const file=`${String(++step).padStart(2,'0')}-${name}.png`;
 await root(page).screenshot({path:join(output,file)});return file;
}
function href(path){const target=referenceNavigationTarget(moduleId,path);return `${BASE.replace(/\/$/,'')}/${moduleId}/${target.pageId}/${encodeURIComponent(target.recordId)}`;}
async function login(username,branch='dubai'){
 const context=await browser.newContext({viewport:{width:1600,height:1100}});contexts.push(context);
 const page=await context.newPage();page.setDefaultTimeout(30000);activePage=page;
 page.on('pageerror',error=>pageErrors.push({actor:username,message:error.message}));
 page.on('requestfailed',request=>networkFailures.push({actor:username,url:request.url(),failure:request.failure()?.errorText}));
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push({actor:username,message:message.text()});});
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('input').first().fill(username);await page.locator('input[type=password]').fill(username);
 await page.locator('button[type=submit]').click();await page.locator('header [data-tour=module]').waitFor();
 return {page,context,username,branch};
}
async function selectBranch(account){
 const header=account.page.locator('header');await header.waitFor();
 const picker=header.getByRole('button',{name:'Branch',exact:true});
 if(await picker.count()){
  if(!(await picker.innerText()).includes('Dubai')){await picker.click();await account.page.getByRole('listbox',{name:'Branch',exact:true}).getByRole('option',{name:/Dubai/}).click();}
  assert.match(await picker.innerText(),/Dubai/);
 }else assert.match(await header.getByLabel('Branch',{exact:true}).innerText(),/Dubai/);
}
async function ready(page){
 await rcm(page).waitFor();
 await page.waitForFunction(()=>{const node=document.querySelector('[data-rcm-section]');return node&&node.innerText.length>100&&!node.querySelector('[aria-busy="true"],.animate-spin');});
 assert.equal(await rcm(page).getByRole('alert').count(),0,await rcm(page).innerText());
}
async function go(account,path){
 activePage=account.page;await account.page.goto(href(path),{waitUntil:'domcontentloaded'});
 await account.page.locator('header [data-tour=module]').waitFor();
 // A full URL load may initialize the shell from the account's default branch.
 // Select the trusted shared branch through the header on every admin load.
 await selectBranch(account);await ready(account.page);
}
async function api(account,path,{method='GET',body}={}){
 const token=await account.page.evaluate(()=>localStorage.getItem('nexora-session-token'));
 assert.ok(token,'Authenticated browser session is required.');
 const response=await fetch(`${API.replace(/\/$/,'')}/reference-modules/healthcare-suite/api${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Product-Id':'nexora','X-Reference-Module':moduleId,'X-Reference-Branch':account.branch,'X-Reference-Facility':'F001'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:response.status,body:await response.json()};
}
async function workspace(account){const response=await api(account,'/rcm/workspace');assert.equal(response.status,200,response.body.message);return parseRcmWorkspace(response.body);}
async function action(account,actionId,fields=[]){
 const page=account.page;await rcm(page).getByLabel('Workflow action',{exact:false}).selectOption(actionId);
 const form=rcm(page).locator('form');await form.waitFor();
 for(const [label,value]of fields){const input=form.getByLabel(label,{exact:false});assert.equal(await input.count(),1,`Unambiguous field ${label}`);if(await input.evaluate(node=>node.tagName==='SELECT'))await input.selectOption(String(value));else await input.fill(String(value));}
 return form;
}
async function submit(account,actionId,fields=[],{kind=actionId,shot=actionId}={}){
 const form=await action(account,actionId,fields);assert.equal(await form.locator('button[type=submit]').isEnabled(),true,`${actionId} must be authorized and ready`);
 const responsePromise=account.page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/healthcare-suite/api/rcm/commands')&&response.request().method()==='POST'&&response.request().postDataJSON()?.kind===kind);
 await form.locator('button[type=submit]').click();const response=await responsePromise;
 const body=await response.json();assert.equal(response.status(),201,body.message??`${kind} HTTP failure`);
 const parsed=parseRcmCommandResponse(body);const sent=response.request().postDataJSON();
 const operationId=response.request().headers()['idempotency-key'];assert.ok(operationId,`${kind} operation identity`);assert.equal(sent.idempotencyKey,operationId);
 assert.ok(parsed.workspace.version>sent.expectedVersion,`${kind} advances the workspace version; provider reservation and settlement can advance it twice`);assert.equal(parsed.workspace.currency,sent.currency);
 assert.equal(parsed.workspace.scope?.branchId,account.branch);
 await form.getByText('Command completed. The latest workspace is shown.',{exact:true}).waitFor();await ready(account.page);
 mutations.push({kind,status:response.status(),actor:account.username,expectedVersion:sent.expectedVersion,resultVersion:parsed.workspace.version,hasOperationId:true});
 const image=await screenshot(account.page,shot);record('UI '+shot,{screenshot:image});return parsed;
}
async function verifyPersistence(account,predicate,label){const state=await workspace(account);assert.ok(predicate(state),label);return state;}

try{
 const catalog=REFERENCE_MODULES.find(module=>module.id===moduleId);assert.ok(catalog);
 const routes=catalog.pages.filter(page=>page.path.startsWith('/rcm/'));assert.equal(routes.length,9);
 const maker=await login('admin');
 for(const route of routes){await go(maker,route.path);assert.equal(await rcm(maker.page).getAttribute('data-rcm-section'),route.path.slice(5));assert.ok((await rcm(maker.page).innerText()).length>100);record('RCM route '+route.path,{pageId:route.id,screenshot:await screenshot(maker.page,'route-'+route.path.slice(5))});}
 const makerSession=await api(maker,'/session');assert.equal(makerSession.status,200);assert.equal(makerSession.body.user.role,'enterprise-admin');
 let state=await workspace(maker);assert.equal(state.scope?.branchId,'dubai');if(requireProviders)assert.equal(state.moneyProviderConfigured,true,'Configured provider acceptance requires the trusted money adapter.');
 const selectedInvoice=process.env.E2E_RCM_INVOICE_ID?state.invoices.find(invoice=>invoice.id===process.env.E2E_RCM_INVOICE_ID):state.invoices.find(invoice=>invoice.payerOutstandingMinor>0&&!state.claims.some(claim=>claim.invoiceId===invoice.id));
 assert.ok(selectedInvoice,'Use an isolated fresh RCM store or E2E_RCM_INVOICE_ID with an unclaimed payer receivable.');
 const invoiceId=selectedInvoice.id,patientId=selectedInvoice.patientId;

 await go(maker,'/rcm/claims');
 const newPayerId='BROWSER-PAYER-'+runId;
 await submit(maker,'configure-payer',[['Payer ID',newPayerId],['Payer name','Synthetic browser payer'],['Publication scope','tenant']]);
 state=await workspace(maker);const payerIds=[...state.payers.filter(payer=>payer.status==='Active'&&payer.id!==newPayerId).slice(0,4).map(payer=>payer.id),newPayerId];assert.ok(payerIds.length>=4);
 await submit(maker,'configure-payer-policy',[['Policy scope','branch'],['Ordered payer IDs',payerIds.join(',')],['Maximum payers',String(payerIds.length)],['Effective from',day]]);
 const sequence=await submit(maker,'configure-payer-sequence',[['Invoice',invoiceId],['Ordered payer IDs',payerIds.join(',')]]);
 assert.deepEqual(sequence.result.payerIds,payerIds);assert.ok(sequence.result.payerIds.length>=4);
 const createdClaim=await submit(maker,'create-claim',[['Invoice',invoiceId],['Payer ID',payerIds[0]]]);
 const claimId=createdClaim.result.id,charge=createdClaim.result.chargeMinor;assert.ok(charge>15000);
 await submit(maker,'adjudicate-claim',[['Claim',claimId],['Paid amount','100.00'],['Adjustment amount','50.00'],['Denied amount',major(charge-15000)],['Reason','Synthetic browser partial adjudication']]);
 await go(maker,'/rcm/remittances');
 const remitted=await submit(maker,'create-remittance',[['Claim',claimId],['Paid amount','100.00'],['Adjustment amount','50.00'],['Payment reference','BROWSER-REM-'+runId]]);
 assert.equal(remitted.result.paidMinor,10000);assert.equal(remitted.result.adjustmentMinor,5000);
 await verifyPersistence(maker,ws=>ws.claims.find(claim=>claim.id===claimId)?.status==='Settled'&&ws.invoices.find(invoice=>invoice.id===invoiceId)?.payerOutstandingMinor===selectedInvoice.payerOutstandingMinor-15000,'Claim settlement and payer receivable reconcile.');
 await submit(maker,'clawback',[['Remittance',remitted.result.id],['Amount','10.00'],['Reason','Synthetic browser clawback correction']]);
 await go(maker,'/rcm/claims');const replacement=await submit(maker,'replace-claim',[['Claim',claimId],['Reason','Synthetic browser replacement after clawback']]);assert.equal(replacement.result.status,'Appealed');assert.ok(replacement.result.revisions.length>0);assert.equal(replacement.result.revisions.at(-1).paidMinor,9000);assert.equal(replacement.workspace.invoices.find(invoice=>invoice.id===invoiceId).payerOutstandingMinor,selectedInvoice.payerOutstandingMinor-14000);

 await go(maker,'/rcm/packages');
 const packageId='BROWSER-PKG-'+runId;
 await submit(maker,'configure-package',[['Package ID',packageId],['Package name','Synthetic browser case rate'],['Case rate','500.00'],['Entitlement units','3'],['Excess unit charge','150.00'],['Publication scope','tenant']]);
 const enrolled=await submit(maker,'enroll-package',[['Package',packageId],['Patient ID',patientId]]);const entitlementId=enrolled.result.id;
 const reserved=await submit(maker,'reserve-package',[['Entitlement',entitlementId],['Units','1']]);
 await submit(maker,'consume-package',[['Entitlement',entitlementId],['Units','1'],['Reservation',reserved.result.id]],{shot:'consume-package-reservation'});
 const released=await submit(maker,'reserve-package',[['Entitlement',entitlementId],['Units','1']],{shot:'reserve-package-for-release'});
 await submit(maker,'release-package',[['Reservation',released.result.id]]);
 await submit(maker,'consume-package',[['Entitlement',entitlementId],['Units','3']],{shot:'consume-package-excess'});
 const revised=await submit(maker,'configure-package',[['Package ID',packageId],['Package name','Synthetic browser case rate revision'],['Case rate','800.00'],['Entitlement units','5'],['Excess unit charge','300.00'],['Publication scope','branch']],{shot:'configure-package-revision'});
 assert.equal(revised.result.version,2);const frozen=revised.workspace.entitlements.find(entitlement=>entitlement.id===entitlementId);assert.equal(frozen.caseRateMinor,50000);assert.equal(frozen.excessUnitMinor,15000);assert.equal(frozen.excessMinor,15000);assert.equal(frozen.reservedUnits,0);
 const closed=await submit(maker,'close-package',[['Entitlement',entitlementId]]);assert.equal(closed.result.invoice.totalMinor,65000);assert.equal(closed.result.entitlement.status,'Closed');

 await go(maker,'/rcm/drg');
 const beforeDrg=(await workspace(maker)).invoices.find(invoice=>invoice.id===invoiceId).outstandingMinor;
 await submit(maker,'configure-drg',[['DRG base rate','800.00'],['Diagnosis group rules','I,BROWSER-CARDIAC,15000\n*,BROWSER-GENERAL,10000']]);
 const grouped=await submit(maker,'group-drg',[['Invoice',invoiceId],['Diagnosis codes','I10']]);assert.equal(grouped.result.allowedMinor,120000);assert.equal(grouped.result.adapter,'demo-v1');assert.match(grouped.result.boundary,/Uncertified/);assert.equal(grouped.workspace.invoices.find(invoice=>invoice.id===invoiceId).outstandingMinor,beforeDrg);

 await go(maker,'/rcm/commercial');const priceId='BROWSER-SVC-'+runId;
 const proposed=await submit(maker,'propose-pricing',[['Price ID',priceId],['Unit price','100.00'],['Tax basis points','500'],['Effective from',day]]);
 const selfApproval=await action(maker,'approve-pricing',[['Pricing revision',proposed.result.id]]);assert.equal(await selfApproval.locator('button[type=submit]').isDisabled(),true);record('Maker cannot approve own pricing proposal',{screenshot:await screenshot(maker.page,'pricing-maker-blocked')});
 const reviewer=await login('rcm-reviewer');await go(reviewer,'/rcm/commercial');const reviewerSession=await api(reviewer,'/session');assert.equal(reviewerSession.body.user.role,'finance-manager');assert.notEqual(reviewerSession.body.user.id,makerSession.body.user.id);assert.equal(reviewerSession.body.canWrite,false);assert.equal(reviewerSession.body.canWriteRcm,true);
 const approved=await submit(reviewer,'approve-pricing',[['Pricing revision',proposed.result.id]]);assert.equal(approved.result.checkerId,reviewerSession.body.user.id);assert.equal(approved.result.makerId,makerSession.body.user.id);
 await go(maker,'/rcm/commercial');const quote=await submit(maker,'quote-price',[['Price ID',priceId],['Quantity','2'],['Pricing date',day]]);assert.equal(quote.result.netMinor,20000);assert.equal(quote.result.taxMinor,1000);assert.equal(quote.result.totalMinor,21000);

 await go(maker,'/rcm/patient-finance');
 const deposit=await submit(maker,'record-deposit',[['Patient ID',patientId],['Amount','100.00'],['Payment reference','BROWSER-DEP-'+runId]]);
 const requested=await submit(maker,'request-refund',[['Deposit',deposit.result.id],['Amount','25.00'],['Reason','Synthetic browser overpayment']]);assert.equal(requested.result.status,'Requested');
 const finance=await login('user1');await go(finance,'/rcm/patient-finance');const financeSession=await api(finance,'/session');assert.equal(financeSession.body.canWrite,false);assert.equal(financeSession.body.canWriteRcm,true);assert.notEqual(financeSession.body.user.id,makerSession.body.user.id);
 const refundApproved=await submit(finance,'approve-refund',[['Refund',requested.result.id]]);assert.equal(refundApproved.result.status,'Approved');assert.equal(refundApproved.result.checkerId,financeSession.body.user.id);
 await go(maker,'/rcm/patient-finance');const manualPayout=await action(maker,'pay-refund',[['Refund',requested.result.id]]);assert.equal(await manualPayout.locator('button[type=submit]').isDisabled(),true);record('Manual refund source cannot fabricate provider payout',{screenshot:await screenshot(maker.page,'refund-source-guard')});
 const cancelled=await submit(maker,'cancel-refund',[['Refund',requested.result.id],['Reason','Synthetic manual refund cancelled before payout']]);assert.equal(cancelled.result.status,'Cancelled');const releasedDeposit=cancelled.workspace.deposits.find(item=>item.id===deposit.result.id);assert.equal(releasedDeposit.availableMinor,10000);assert.equal(releasedDeposit.reservedMinor,0);

 state=await workspace(maker);
 if(state.moneyProviderConfigured){
  let captured=await submit(maker,'capture-deposit',[['Patient ID',patientId],['Amount','200.00'],['Payment reference','BROWSER-PROVIDER-DEP-'+runId]]);
  for(let attempt=0;captured.result.status==='Uncertain'&&attempt<3;attempt++)captured=await submit(maker,'retry-capture',[['Deposit',captured.result.id]],{shot:'retry-provider-deposit-'+attempt});
  assert.equal(captured.result.status,'Available');assert.ok(captured.result.providerPaymentRef,'Provider capture evidence');
  const providerRefund=await submit(maker,'request-refund',[['Deposit',captured.result.id],['Amount','25.00'],['Reason','Synthetic provider refund']]);
  await go(finance,'/rcm/patient-finance');await submit(finance,'approve-refund',[['Refund',providerRefund.result.id]],{shot:'approve-provider-refund'});
  await go(maker,'/rcm/patient-finance');let paid=await submit(maker,'pay-refund',[['Refund',providerRefund.result.id]]);
  for(let attempt=0;['Pending','Uncertain'].includes(paid.result.status)&&attempt<3;attempt++)paid=await submit(maker,paid.result.providerRef?'reconcile-refund':'pay-refund',[['Refund',providerRefund.result.id]],{shot:'reconcile-provider-refund-'+attempt});
  assert.equal(paid.result.status,'Paid');assert.ok(paid.result.providerRef,'Provider refund evidence');
 }else{
  const capture=await action(maker,'capture-deposit');assert.equal(await capture.locator('button[type=submit]').isDisabled(),true);record('Unconfigured money provider disables capture',{screenshot:await screenshot(maker.page,'provider-configuration-guard')});
  pending('Provider deposit capture and refund HTTP','Trusted money provider is not configured; external integration is not asserted.');
 }

 await go(maker,'/rcm/receivables');
 const collection=await submit(maker,'create-collection',[['Invoice',invoiceId],['Collection owner','Synthetic browser collector'],['Due date',tomorrow],['Collection note','Synthetic browser follow-up']]);
 if((await workspace(maker)).moneyProviderConfigured){
  let collected=await submit(maker,'dispatch-collection',[['Collection task',collection.result.id],['Amount','10.00']]);
  for(let attempt=0;['Pending','Uncertain'].includes(collected.result.status)&&attempt<3;attempt++)collected=await submit(maker,collected.result.providerRef?'reconcile-collection':'dispatch-collection',collected.result.providerRef?[['Collection task',collection.result.id]]:[['Collection task',collection.result.id],['Amount','10.00']],{shot:'reconcile-provider-collection-'+attempt});
  assert.equal(collected.result.status,'Collected');assert.equal(collected.result.postedMinor,1000);assert.ok(collected.result.providerRef,'Provider collection evidence');
 }else{
  const dispatch=await action(maker,'dispatch-collection',[['Collection task',collection.result.id],['Amount','10.00']]);assert.equal(await dispatch.locator('button[type=submit]').isDisabled(),true);
  pending('Provider collection HTTP','Trusted money provider is not configured; external integration is not asserted.');
  await submit(maker,'close-collection',[['Collection task',collection.result.id],['Outcome note','Synthetic manual follow-up reviewed']]);
 }

 await go(maker,'/rcm/exchange');const profileId='BROWSER-EXCHANGE-'+runId;
 const profile=await submit(maker,'configure-exchange',[['Profile ID',profileId],['Payer ID',payerIds[0]],['Wire format','REST_JSON']]);
 const configuredProfile=profile.workspace.exchangeProfiles.find(item=>item.id===profileId);
 if(requireProviders){assert.equal(configuredProfile.providerConfigured,true,'Configured provider acceptance requires the trusted MockIns adapter.');assert.ok(['AED','USD','EUR','INR'].includes(profile.workspace.currency));}
 if(configuredProfile.providerConfigured&&['AED','USD','EUR','INR'].includes(profile.workspace.currency)){
  const cancelledQueue=await submit(maker,'queue-exchange',[['Exchange profile',profileId],['Exchange operation','ELIGIBILITY']],{shot:'queue-exchange-for-cancellation'});const cancelledExchange=await submit(maker,'cancel-exchange',[['Queued exchange',cancelledQueue.result.id],['Reason','Synthetic unsent exchange cancellation']]);assert.equal(cancelledExchange.result.status,'Cancelled');assert.equal(cancelledExchange.result.attempts,0);
  const queued=await submit(maker,'queue-exchange',[['Exchange profile',profileId],['Exchange operation','ELIGIBILITY']]);
  const dispatched=await submit(maker,'dispatch-exchange',[['Queued exchange',queued.result.id]]);assert.equal(dispatched.result.status,'Succeeded');assert.ok(dispatched.result.responseDigest,'Provider response evidence');
 }else pending('MockIns exchange HTTP',configuredProfile.providerConfigured?'Workspace currency is unsupported by MockIns; no FX conversion is performed.':'Trusted MockIns provider is not configured.');

 await go(maker,'/rcm/accounting');assert.ok(await rcm(maker.page).getByText('Journal is balanced',{exact:true}).count());
 const exported=await submit(maker,'export-gl');assert.ok(exported.result.journalIds.length>0);assert.equal(exported.workspace.reports.journalBalanced,true);assert.ok(exported.workspace.glExports.some(batch=>batch.id===exported.result.id));
 await verifyPersistence(maker,ws=>ws.reports.journalBalanced&&ws.refunds.find(refund=>refund.id===requested.result.id)?.status==='Cancelled'&&ws.packages.find(pkg=>pkg.id===packageId)?.version===2,'All completed financial and versioned workflows persist.');

 await go(finance,'/rcm/commercial');const forbidden=await action(finance,'propose-pricing');assert.equal(await forbidden.locator('button[type=submit]').isDisabled(),true);record('Finance role lacks commercial configuration',{screenshot:await screenshot(finance.page,'finance-commercial-denied')});
 assert.equal((await api(finance,'/patients',{method:'POST',body:{firstName:'Denied',lastName:'Synthetic'}})).status,403);record('Finance RCM authority preserves clinical write denial');
 const deniedConfig=await api(finance,'/rcm/commands',{method:'POST',body:{kind:'configure-payer',payerId:'FORBIDDEN-'+runId,name:'Denied synthetic payer',expectedVersion:(await workspace(finance)).version,idempotencyKey:'denied-'+runId,currency:state.currency}});assert.equal(deniedConfig.status,403);record('Server independently denies finance configuration');
 assert.ok(mutations.length>20);assert.ok(mutations.every(mutation=>mutation.hasOperationId));if(requireProviders)assert.equal(results.some(result=>result.status==='not-run'),false,'Configured provider acceptance cannot omit a provider flow.');assert.deepEqual(pageErrors,[]);record('Consequential UI mutations retain operation identity and no page errors');
}catch(error){
 results.push({name:'Browser acceptance failure',status:'failed',message:error.message});
 if(activePage){await activePage.screenshot({path:join(output,'failure.png')}).catch(()=>{});writeFileSync(join(output,'failure-visible-text.txt'),await activePage.locator('body').innerText().catch(()=>''),{mode:0o600});}
 throw error;
}finally{persist();for(const context of contexts)await context.close().catch(()=>{});await browser.close();}
