// Durable synthetic RCM aggregate. Financial commands use integer minor units and
// balanced journals. Identity comes exclusively from the authenticated host user.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,rename,unlink,rm,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CsvStore} from './reference-healthcare-suite-source/common/csv-store.service.mjs';
import {mockInsFormats,mockInsOperations,minorDecimal,decimalMinor,freezeMockInsRequest,dispatchMockIns} from './healthcare-suite-rcm-exchange.mjs';

const fixtures=new CsvStore(new URL('./reference-healthcare-suite-data/',import.meta.url));
const currencies=new Set(['AED','USD','EUR','INR']);
const branches=new Set(['hq','dubai','sharjah']);
const queues=new Map();
const commercialFamilies=['payers','packages','packageVersions','drgConfigurations','pricingVersions','exchangeProfiles','exchangeProfileVersions'];
const configKinds=new Set(['configure-payer','configure-payer-sequence','configure-payer-policy','configure-exchange','configure-package','configure-drg','propose-pricing']);
const claimsKinds=new Set(['create-claim','adjudicate-claim','appeal-claim','replace-claim','queue-exchange','cancel-exchange','dispatch-exchange','group-drg']);
const financeKinds=new Set(['import-invoice','create-remittance','clawback','record-deposit','allocate-deposit','collect-payment','issue-credit','request-refund','cancel-refund','pay-refund','reconcile-refund','capture-deposit','retry-capture','enroll-package','reserve-package','release-package','consume-package','close-package','create-collection','close-collection','dispatch-collection','reconcile-collection','apply-exchange-remittance']);
const approveKinds=new Set(['approve-pricing','approve-refund']);
const digest=v=>createHash('sha256').update(typeof v==='string'?v:stable(v)).digest('hex');
function stable(v){if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v);}
class RcmError extends Error {constructor(status,message,code,fields){super(message);Object.assign(this,{status,code,fields});}}
const bad=(message,fields)=>{throw new RcmError(400,message,'VALIDATION',fields);};
const conflict=message=>{throw new RcmError(409,message,'CONFLICT');};
const minor=(v,name,positive=false)=>{if(!Number.isSafeInteger(v)||v<0||positive&&v===0)bad(`${name} must be a ${positive?'positive':'non-negative'} safe integer in minor units.`,{[name]:'Enter integer minor units'});return v;};
const sum=values=>{const result=values.reduce((n,v)=>n+BigInt(v),0n);if(result>BigInt(Number.MAX_SAFE_INTEGER)||result<BigInt(Number.MIN_SAFE_INTEGER))bad('Amount exceeds supported integer range.');return Number(result);};
const safeBigInt=value=>{if(value>BigInt(Number.MAX_SAFE_INTEGER)||value<0n)bad('Amount exceeds supported integer range.');return Number(value);};
const text=(v,name,max=160)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f]/.test(v))bad(`${name} must be non-empty text of up to ${max} characters.`);return v.trim();};
const id=(v,name='id')=>{text(v,name,64);if(!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v))bad(`${name} contains unsupported characters.`);return v;};
const date=(v,name)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)bad(`${name} must be a calendar date.`);return v;};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const find=(state,table,key)=>{const row=state[table].find(r=>r.id===id(key,table+'Id'));if(!row)throw new RcmError(404,`${table} record was not found.`,'NOT_FOUND');return row;};
const now=()=>new Date().toISOString();
function capabilities(user){
 const roles={
  'enterprise-admin':{read:true,configure:true,claims:true,finance:true,approve:true,export:true},
  admin:{read:true,configure:true,claims:false,finance:false,approve:true,export:false},
  'finance-manager':{read:true,configure:false,claims:true,finance:true,approve:true,export:true},
  finance:{read:true,configure:false,claims:true,finance:true,approve:false,export:false},
  'operations-analyst':{read:true,configure:false,claims:true,finance:false,approve:false,export:false},
  operations:{read:true,configure:false,claims:true,finance:false,approve:false,export:false},
  'read-only':{read:true,configure:false,claims:false,finance:false,approve:false,export:false},
 };
 const value={read:false,configure:false,claims:false,finance:false,approve:false,export:false,...roles[user.role]};
 for(const name of Object.keys(value))if(user.permissions?.includes(`rcm:${name}`))value[name]=true;
 return value;
}
function identity(user,scope,facilityId){
 if(!user?.id||!user.tenantId)throw new RcmError(401,'Sign in to use RCM.','UNAUTHENTICATED');
 id(user.id,'userId');id(user.tenantId,'tenantId');
 if(scope?.applicationId!=='nexora'||scope.moduleId&&scope.moduleId!=='reference-healthcare-suite')throw new RcmError(403,'RCM application is unavailable.','SCOPE_DENIED');
 if(!branches.has(scope.branchId)||scope.branchId!==user.branch&&!['enterprise-admin','admin'].includes(user.role))throw new RcmError(403,'RCM branch is unavailable.','SCOPE_DENIED');
 if(!capabilities(user).read)throw new RcmError(403,'RCM role is unavailable.','CAPABILITY_DENIED');
 const selected=facilityId??scope.facilityId??'F001';const facility=fixtures.find('facilities',selected);
 if(!facility||facility.status!=='Active'||user.facilityIds&&!user.facilityIds.includes(selected))throw new RcmError(403,'RCM facility is unavailable.','SCOPE_DENIED');
 if(scope.tenantId!==undefined&&scope.tenantId!==user.tenantId)throw new RcmError(403,'RCM tenant is unavailable.','SCOPE_DENIED');
 return {tenantId:user.tenantId,applicationId:scope.applicationId,branchId:scope.branchId,facilityId:selected};
}
function makeId(s,prefix){return `${prefix}-${String(s.nextId++).padStart(6,'0')}`;}
function makeConfigId(s,prefix){return `${prefix}-${digest(s.scope).slice(0,8)}-${String(s.nextId++).padStart(6,'0')}`;}
function journal(s,event,entries,reference){
 entries=entries.filter(e=>e.debitMinor||e.creditMinor);if(!entries.length)return;
 for(const e of entries){minor(e.debitMinor,'debitMinor');minor(e.creditMinor,'creditMinor');if(e.debitMinor&&e.creditMinor)bad('Journal line cannot be debit and credit.');}
 if(sum(entries.map(e=>e.debitMinor))!==sum(entries.map(e=>e.creditMinor)))bad('Journal must balance.');
 const row={id:makeId(s,'JRN'),event,reference,currency:s.currency,entries,createdAt:now(),exportedAt:null,previousHash:s.journal.at(-1)?.hash??null};s.journal.push({...row,hash:digest(row)});
}
const dr=(account,amount)=>({account,debitMinor:amount,creditMinor:0});
const cr=(account,amount)=>({account,debitMinor:0,creditMinor:amount});
function accountBalances(s){const result={};for(const j of s.journal)for(const e of j.entries)result[e.account]=sum([result[e.account]??0,e.debitMinor,-e.creditMinor]);return result;}
function invoiceRow(s,{id:invoiceId,patientId,totalMinor,paidMinor=0,createdAt=now(),source=null,lines=[],patientShareMinor=totalMinor,payerShareMinor=0}){
 const inv={id:invoiceId,patientId,totalMinor,paidMinor,patientPaidMinor:paidMinor,payerPaidMinor:0,patientCreditMinor:0,payerCreditMinor:0,patientOutstandingMinor:patientShareMinor-paidMinor,payerOutstandingMinor:payerShareMinor,adjustmentMinor:0,creditMinor:0,outstandingMinor:totalMinor-paidMinor,currency:s.currency,status:paidMinor===totalMinor?'Paid':paidMinor?'Partially paid':'Unpaid',createdAt,dueDate:createdAt.slice(0,10),patientShareMinor,payerShareMinor,source,lines};
 // Imported receipts and receivables are opening balances from the Suite owner,
 // never a second recognition of its original revenue or stock consumption.
 s.invoices.push(inv);journal(s,source?'invoice.opening-transfer':'invoice.recognize',[dr('Accounts receivable',inv.outstandingMinor),dr('Cash',paidMinor),cr(source?'Suite opening balance':'Service revenue',totalMinor)],invoiceId);return inv;
}
function seed(scope,currency){
 const s={schemaVersion:1,scope,currency,version:0,nextId:1,payers:fixtures.all('payers').map(p=>({id:p.id,name:p.name,status:p.status,level:'tenant'})),invoices:[],payerSequences:[],payerPolicies:[],tenantPayerPolicies:[],claims:[],exchangeProfiles:[],exchangeProfileVersions:[],exchanges:[],remittances:[],credits:[],deposits:[],refunds:[],packages:[],packageVersions:[],reservations:[],entitlements:[],pricingVersions:[],drgConfigurations:[],drgCases:[],journal:[],outbox:[],collections:[],glExports:[],idempotency:{}};
 invoiceRow(s,{id:'RCM-INV-001',patientId:'PT00001',totalMinor:100000,patientShareMinor:20000,payerShareMinor:80000});
 s.payerSequences.push({id:'SEQ-DEMO',invoiceId:'RCM-INV-001',payerIds:s.payers.map(p=>p.id),version:1,status:'Active'});
 s.packages.push({id:'PKG-DEMO',name:'Demo day care case rate',caseRateMinor:50000,entitlementUnits:3,excessUnitMinor:15000,currency,version:1,status:'Active',level:'tenant'});
 s.packageVersions.push({...s.packages[0],revisionId:'PKG-DEMO-V1'});
 s.drgConfigurations.push({id:'DRG-DEMO-V1',version:1,adapter:'demo-v1',baseRateMinor:80000,groups:[{prefix:'I',groupCode:'DEMO-CARDIAC',weightBasisPoints:15000},{prefix:'J',groupCode:'DEMO-RESP',weightBasisPoints:11000},{prefix:'*',groupCode:'DEMO-GENERAL',weightBasisPoints:10000}],currency,status:'Active',level:'tenant'});
 s.pricingVersions.push({id:'PRICE-DEMO-V1',priceId:'SVC-DEMO',unitPriceMinor:10000,taxBasisPoints:0,version:1,status:'Approved',makerId:'SEED-MAKER',checkerId:'SEED-CHECKER',effectiveFrom:'2026-01-01',baseVersion:0,currency,level:'tenant'});
 return s;
}
function refreshInvoice(inv){inv.paidMinor=sum([inv.patientPaidMinor,inv.payerPaidMinor]);inv.outstandingMinor=sum([inv.patientOutstandingMinor,inv.payerOutstandingMinor]);inv.status=inv.outstandingMinor===0?'Paid':inv.paidMinor?'Partially paid':'Unpaid';}
function reports(s){
 const balances=accountBalances(s),aging=[{bucket:'Current',amountMinor:0},{bucket:'1–30 days',amountMinor:0},{bucket:'31–60 days',amountMinor:0},{bucket:'61–90 days',amountMinor:0},{bucket:'90+ days',amountMinor:0}];
 for(const i of s.invoices){const age=Math.max(0,Math.floor((Date.now()-Date.parse(i.dueDate))/86400000));const bucket=age===0?0:age<=30?1:age<=60?2:age<=90?3:4;aging[bucket].amountMinor=sum([aging[bucket].amountMinor,i.outstandingMinor]);}
 return {outstandingMinor:sum(s.invoices.map(i=>i.outstandingMinor)),cashMinor:balances.Cash??0,creditsMinor:sum(s.credits.map(i=>i.availableMinor+i.reservedMinor)),depositsMinor:sum(s.deposits.map(i=>i.availableMinor+i.reservedMinor)),aging,trialBalance:Object.entries(balances).map(([account,balanceMinor])=>({account,balanceMinor,debitMinor:Math.max(balanceMinor,0),creditMinor:Math.max(-balanceMinor,0)})),payerExposure:s.payers.map(p=>({payerId:p.id,amountMinor:sum(s.claims.filter(c=>c.payerId===p.id&&!['Settled','Denied','Rejected'].includes(c.status)).map(c=>c.chargeMinor-c.paidMinor-c.adjustmentMinor))})),journalBalanced:s.journal.every(j=>sum(j.entries.map(e=>e.debitMinor))===sum(j.entries.map(e=>e.creditMinor)))};
}
function workspace(s,user,provider,moneyProvider){
 const {idempotency,nextId,...visible}=structuredClone(s);
 // Frozen request subscriber/auth bodies stay server-owned, while operators see
 // state, correlation identifiers and digests, rather than provider credentials.
 visible.exchanges=visible.exchanges.map(({wire,canonical,profileSnapshot,identity,...record})=>record);
 visible.exchangeProfiles=visible.exchangeProfiles.map(p=>({...p,providerConfigured:Boolean(provider?.baseUrl&&provider?.apiKey),maximumPayerLevel:provider?.maxPayerLevel??3,operations:mockInsOperations}));
 return {...visible,moneyProviderConfigured:Boolean(moneyProvider),effectivePayerPolicy:effectivePayerPolicy(s),capabilities:capabilities(user),reports:reports(s),boundary:'Durable synthetic demo; MockIns and demo-v1 DRG only.'};
}
function effectivePayerPolicy(s){const today=now().slice(0,10),branch=s.payerPolicies.filter(p=>p.effectiveFrom<=today).at(-1);return branch&&!branch.inherit?branch:s.tenantPayerPolicies.filter(p=>p.effectiveFrom<=today).at(-1)??null;}
const moneyScope=s=>({tenantId:`T-${digest(s.scope.tenantId).slice(0,32)}`,merchantId:`M-${digest(s.scope).slice(0,32)}`});
const pendingCollections=(s,invoiceId,exceptId)=>sum(s.collections.filter(c=>c.invoiceId===invoiceId&&c.id!==exceptId&&['Pending','Uncertain'].includes(c.status)).map(c=>c.requestedMinor??0));
const availableCash=(s,exceptRefund)=>sum([accountBalances(s).Cash??0,-sum(s.refunds.filter(r=>r.id!==exceptRefund&&['Pending','Uncertain'].includes(r.status)).map(r=>r.amountMinor))]);
function publish(s,families,level){level??='branch';if(!['tenant','branch'].includes(level))bad('Choose tenant or branch configuration publication.');s._publication={families,level};return level;}
function configurationSeed(s){return Object.fromEntries(commercialFamilies.map(f=>[f,structuredClone(s[f]).map(r=>({...r,level:r.level??'tenant'}))]));}
function projectConfigurations(state,durable){
 const local=durable.configurations.branches[state.scope.branchId]??{};
 for(const family of commercialFamilies){const inherited=durable.configurations.tenant[family]??[],branch=local[family]??[];
  if(['payers','packages','exchangeProfiles'].includes(family)){const rows=new Map(inherited.map(r=>[r.id,r]));for(const r of branch)rows.set(r.id,r);state[family]=structuredClone([...rows.values()]);}
  else {const key=['packageVersions','exchangeProfileVersions'].includes(family)?'revisionId':'id',rows=new Map([...inherited,...branch].map(r=>[r[key],r]));state[family]=structuredClone([...rows.values()]);}
 }
 state.tenantPayerPolicies=structuredClone(durable.tenantPayerPolicies);
 state.payerPolicies=structuredClone(durable.branchPayerPolicies[state.scope.branchId]??[]);
}
function effectivePrice(s,priceId,asOf){const rows=s.pricingVersions.filter(p=>p.priceId===priceId&&p.status==='Approved'&&p.effectiveFrom<=asOf),local=rows.filter(p=>p.level==='branch');return (local.length?local:rows).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)||a.version-b.version).at(-1);}
function publicationPrice(s,priceId,level){const rows=s.pricingVersions.filter(v=>v.priceId===priceId&&v.status==='Approved');return rows.filter(p=>p.level===level).at(-1)??(level==='branch'?rows.filter(p=>p.level==='tenant').at(-1):null);}
function coordinationSnapshot(s,claim){return s.claims.filter(p=>p.invoiceId===claim.invoiceId&&p.sequenceIndex<claim.sequenceIndex).map(p=>({id:p.id,version:p.version,status:p.status,paidMinor:p.paidMinor,adjustmentMinor:p.adjustmentMinor,deniedMinor:p.deniedMinor,remittances:s.remittances.filter(r=>r.claimId===p.id)}));}
function assertInvariant(s){
 const accounts=accountBalances(s);
 for(const inv of s.invoices){for(const f of ['totalMinor','paidMinor','adjustmentMinor','creditMinor','outstandingMinor','patientShareMinor','payerShareMinor','patientPaidMinor','payerPaidMinor','patientOutstandingMinor','payerOutstandingMinor','patientCreditMinor','payerCreditMinor'])minor(inv[f],f);if(sum([inv.paidMinor,inv.adjustmentMinor,inv.creditMinor,inv.outstandingMinor])!==inv.totalMinor)bad('Invoice conservation failed.');if(sum([inv.patientShareMinor,inv.payerShareMinor])!==inv.totalMinor)bad('Responsibility allocation must conserve the invoice.');if(sum([inv.patientPaidMinor,inv.patientCreditMinor,inv.patientOutstandingMinor])!==inv.patientShareMinor||sum([inv.payerPaidMinor,inv.payerCreditMinor,inv.payerOutstandingMinor,inv.adjustmentMinor])!==inv.payerShareMinor)bad('Party receivable conservation failed.');}
 for(const source of [...s.deposits,...s.credits]){minor(source.availableMinor,'availableMinor');minor(source.reservedMinor,'reservedMinor');if(sum([source.availableMinor,source.reservedMinor])>source.amountMinor)bad('Patient liability overspend.');}
 for(const e of s.entitlements){minor(e.usedUnits,'usedUnits');minor(e.reservedUnits,'reservedUnits');if(e.reservedUnits>Math.max(0,e.includedUnits-e.usedUnits))bad('Package reservation conservation failed.');if(e.reservedUnits!==sum(s.reservations.filter(r=>r.entitlementId===e.id&&r.status==='Reserved').map(r=>r.units)))bad('Package reservation ownership failed.');}
 if((accounts.Cash??0)<0)conflict('Insufficient cash for payout or clawback.');
 if((accounts['Accounts receivable']??0)!==sum(s.invoices.map(i=>i.outstandingMinor)))bad('Accounts receivable reconciliation failed.');
 if(-(accounts['Patient deposits']??0)!==sum(s.deposits.map(i=>i.availableMinor+i.reservedMinor)))bad('Deposit reconciliation failed.');
 if(-(accounts['Patient credits']??0)!==sum(s.credits.map(i=>i.availableMinor+i.reservedMinor)))bad('Credit reconciliation failed.');
 let previousJournal=null;for(const j of s.journal){const {hash,...row}=j;if(sum(j.entries.map(e=>e.debitMinor))!==sum(j.entries.map(e=>e.creditMinor)))bad('Unbalanced journal.');if(row.previousHash!==previousJournal||digest(row)!==hash)bad('Journal chain validation failed.');previousJournal=hash;}
 let previous=null;for(const a of s.outbox){const {hash,...event}=a;if(event.previousHash!==previous||digest(event)!==hash)bad('Audit chain validation failed.');previous=hash;}
}
async function serialized(file,fn){
 const before=queues.get(file)??Promise.resolve();let release;const wait=new Promise(r=>{release=r;});const tail=before.catch(()=>{}).then(()=>wait);queues.set(file,tail);await before.catch(()=>{});try{return await fn();}finally{release();if(queues.get(file)===tail)queues.delete(file);}
}
async function withDiskLock(file,fn){
 const lock=file+'.lock';const start=Date.now();
 while(true){try{await mkdir(lock);await writeDurable(join(lock,'owner.json'),JSON.stringify({pid:process.pid,createdAt:now()}));break;}catch(e){if(e.code!=='EEXIST')throw e;
   try{const owner=JSON.parse(await readFile(join(lock,'owner.json'),'utf8'));try{process.kill(owner.pid,0);}catch(err){if(err.code==='ESRCH'){await rm(lock,{recursive:true,force:true});continue;}}}catch{const info=await stat(lock).catch(()=>null);if(info&&Date.now()-info.mtimeMs>30000){await rm(lock,{recursive:true,force:true});continue;}}
   if(Date.now()-start>10000)throw new RcmError(503,'RCM storage is busy. Retry the operation.','STORAGE_BUSY');await new Promise(r=>setTimeout(r,20));
  }}
 try{return await fn();}finally{await rm(lock,{recursive:true,force:true});}
}
async function writeDurable(file,bytes){const fd=await open(file,'wx',0o600);try{await fd.writeFile(bytes);await fd.sync();}finally{await fd.close();}}
async function persist(file,state,beforePersist){
 const temporary=file+'.tmp-'+randomUUID();try{await writeDurable(temporary,JSON.stringify(state));if(beforePersist)await beforePersist(structuredClone(state));await rename(temporary,file);const dir=await open(resolve(file,'..'),'r');try{await dir.sync();}finally{await dir.close();}}finally{await unlink(temporary).catch(()=>{});}
}
function sourceMinor(value,name){if(typeof value!=='number'||!Number.isFinite(value)||value<0)bad(`Invalid source ${name}.`);const scaled=value*100;const rounded=Math.round(scaled);if(Math.abs(scaled-rounded)>0.000001||!Number.isSafeInteger(rounded))bad(`Source ${name} must have two decimal places.`);return rounded;}
function allowed(s,user,c){
 const cap=capabilities(user);let name;if(configKinds.has(c.kind))name='configure';else if(claimsKinds.has(c.kind))name='claims';else if(financeKinds.has(c.kind))name='finance';else if(approveKinds.has(c.kind))name='approve';else if(c.kind==='export-gl')name='export';else if(c.kind==='quote-price')name='read';else bad('Unsupported RCM command kind.');
 if(!cap[name])throw new RcmError(403,`RCM ${name} capability is required.`,'CAPABILITY_DENIED');
 if(c.kind==='approve-pricing'&&!cap.configure)throw new RcmError(403,'Pricing approval requires administrative configuration capability.','CAPABILITY_DENIED');
 if(c.kind==='approve-refund'&&!cap.finance)throw new RcmError(403,'Refund approval requires finance capability.','CAPABILITY_DENIED');
 if(c.currency!==s.currency)bad(`Use the workspace currency ${s.currency}.`);
}
function remit(s,c){
 const claim=find(s,'claims',c.claimId),inv=find(s,'invoices',claim.invoiceId);
 if(!['Draft','Submitted','Adjudicated','Denied','Appealed'].includes(claim.status))conflict('Claim is not available for remittance.');
 const paid=minor(c.paidMinor,'paidMinor'),adj=minor(c.adjustmentMinor,'adjustmentMinor'),total=sum([paid,adj]);if(total>claim.chargeMinor-claim.paidMinor-claim.adjustmentMinor||total>inv.payerOutstandingMinor)conflict('Remittance exceeds claim or payer receivable balance.');
 const reference=text(c.reference,'reference',128);if(s.remittances.some(r=>r.reference===reference&&r.payerId===claim.payerId))conflict('Payer remittance reference was already posted.');
 if(claim.status==='Adjudicated'&&(claim.adjudication.paidMinor!==paid||claim.adjudication.adjustmentMinor!==adj))conflict('Remittance must match the adjudication.');
 inv.payerPaidMinor=sum([inv.payerPaidMinor,paid]);inv.adjustmentMinor=sum([inv.adjustmentMinor,adj]);inv.payerOutstandingMinor-=total;refreshInvoice(inv);
 claim.paidMinor+=paid;claim.adjustmentMinor+=adj;claim.deniedMinor=claim.chargeMinor-claim.paidMinor-claim.adjustmentMinor;claim.status='Settled';
 const row={id:makeId(s,'REM'),evidenceId:s.nextId,claimId:claim.id,payerId:claim.payerId,invoiceId:inv.id,paidMinor:paid,adjustmentMinor:adj,clawedBackMinor:0,reference,status:'Posted',currency:s.currency,createdAt:now()};s.remittances.push(row);
 journal(s,'remittance.post',[dr('Cash',paid),dr('Contractual adjustments',adj),cr('Accounts receivable',total)],row.id);return row;
}
async function execute(s,user,c,options){
 const {provider,referenceReader,moneyProvider,prepare}=options;
 switch(c.kind){
 case 'import-invoice': {
  if(!referenceReader)conflict('A trusted Healthcare Suite invoice reader is required.');const invoiceId=id(c.invoiceId,'invoiceId');
  const source=await referenceReader({user,scope:s.scope,invoiceId});if(!source?.invoice)throw new RcmError(404,'Healthcare Suite invoice was not found.','NOT_FOUND');
  if(source.facilityId!==s.scope.facilityId)throw new RcmError(403,'Invoice belongs to another facility.','SCOPE_DENIED');if(source.currency!==s.currency)bad('Source invoice currency differs from the RCM workspace.');
  const row=source.invoice;if(row.id!==invoiceId||row.status==='Cancelled')bad('Source invoice cannot be imported.');
  const sourceDigest=digest(row),existing=s.invoices.find(i=>i.source?.invoiceId===invoiceId);if(existing){if(existing.source.digest!==sourceDigest)conflict('Source invoice changed after import. Apply an explicit RCM correction.');return existing;}if(s.invoices.some(i=>i.id===invoiceId))conflict('Source invoice identifier collides with an existing RCM invoice.');
  const total=sourceMinor(row.net,'net'),paid=sourceMinor(row.paid,'paid'),patient=sourceMinor(row.patientShare,'patientShare'),payer=sourceMinor(row.payerShare,'payerShare');if(sum([patient,payer])!==total||paid>patient||sourceMinor(row.balance,'balance')!==patient-paid)bad('Source invoice totals do not conserve value.');
  const lines=(row.lines??[]).map((l,n)=>({id:l.orderId??l.id??`${invoiceId}-${n+1}`,code:l.code,quantity:l.qty,totalMinor:sourceMinor(l.net,'line.net'),patientShareMinor:sourceMinor(l.patientShare??0,'line.patientShare'),payerShareMinor:sourceMinor(l.payerShare??0,'line.payerShare')}));
  // The Suite applies deductible/co-pay caps at header level. Preserve that exact
  // allocation as explicit remainders, rather than changing the source lines.
  const sourceInfo={invoiceId,digest:sourceDigest,encounterId:row.encounterId,importedAt:now(),patientAllocationRemainderMinor:patient-sum(lines.map(l=>l.patientShareMinor)),payerAllocationRemainderMinor:payer-sum(lines.map(l=>l.payerShareMinor))};
  if(lines.length&&sum(lines.map(l=>l.totalMinor))!==total)bad('Source invoice lines do not match its total.');
  return invoiceRow(s,{id:invoiceId,patientId:id(row.patientId,'patientId'),totalMinor:total,paidMinor:paid,createdAt:row.createdAt??now(),source:sourceInfo,lines,patientShareMinor:patient,payerShareMinor:payer});
 }
 case 'configure-payer': {const payerId=id(c.payerId,'payerId');if(s.payers.some(p=>p.id===payerId))conflict('Payer identifier is already registered.');const row={id:payerId,name:text(c.name,'name'),status:'Active',level:publish(s,['payers'],c.level)};s.payers.push(row);return row;}
 case 'configure-payer-policy': {
  if(!['branch','tenant-default'].includes(c.level))bad('Choose branch or tenant-default policy.');if(c.inherit!==undefined&&typeof c.inherit!=='boolean')bad('inherit must be a boolean.');if(c.inherit&&c.level!=='branch')bad('Only branch policies can inherit tenant defaults.');const ids=c.inherit?[]:c.payerIds;if(!c.inherit)validatePayers(s,ids);const max=c.inherit?64:minor(c.maximumPayers,'maximumPayers',true);if(max>64||max<ids.length)bad('Policy supports up to 64 payers and must fit its sequence.');
  if(c.level==='tenant-default'&&!['enterprise-admin','admin'].includes(user.role))throw new RcmError(403,'Tenant policy requires an administrator.','CAPABILITY_DENIED');
  const history=c.level==='tenant-default'?s.tenantPayerPolicies:s.payerPolicies,latest=history.at(-1);const p={id:makeId(s,'POLICY'),level:c.level,inherit:c.inherit??false,version:(latest?.version??0)+1,payerIds:[...ids],maximumPayers:max,status:'Active',effectiveFrom:date(c.effectiveFrom,'effectiveFrom'),createdBy:user.id};history.push(p);return p;
 }
 case 'configure-payer-sequence': {
  const inv=find(s,'invoices',c.invoiceId);validatePayers(s,c.payerIds);const policy=effectivePayerPolicy(s);if(c.payerIds.length>(policy?.maximumPayers??64)||policy&&c.payerIds.some(p=>!policy.payerIds.includes(p)))bad('Payer sequence exceeds the effective policy.');
  if(s.claims.some(p=>p.invoiceId===inv.id))conflict('Freeze the payer sequence before starting claims.');const old=s.payerSequences.find(p=>p.invoiceId===inv.id);const row={id:old?.id??makeId(s,'SEQ'),invoiceId:inv.id,payerIds:[...c.payerIds],version:(old?.version??0)+1,status:'Active',policyVersion:policy?.version??null};if(old)Object.assign(old,row);else s.payerSequences.push(row);return row;
 }
 case 'create-claim': {
  const inv=find(s,'invoices',c.invoiceId),seq=s.payerSequences.find(p=>p.invoiceId===inv.id);if(!seq)conflict('Configure a payer sequence first.');if(!inv.payerOutstandingMinor)conflict('Payer receivable is already settled.');
  const previous=s.claims.filter(p=>p.invoiceId===inv.id);if(previous.some(p=>!['Settled','Denied','Rejected'].includes(p.status)))conflict('Resolve the current payer before forwarding the balance.');
  const index=previous.length;if(index>=seq.payerIds.length||seq.payerIds[index]!==c.payerId)conflict('Claim must use the next payer in the configured sequence.');
  const row={id:makeId(s,'CLM'),evidenceId:s.nextId,invoiceId:inv.id,payerId:c.payerId,sequenceIndex:index,sequenceVersion:seq.version,chargeMinor:inv.payerOutstandingMinor,paidMinor:0,adjustmentMinor:0,deniedMinor:0,currency:s.currency,version:1,status:'Draft',appeals:[],createdAt:now()};s.claims.push(row);return row;
 }
 case 'adjudicate-claim': {
  const claim=find(s,'claims',c.claimId);if(!['Draft','Submitted','Appealed'].includes(claim.status))conflict('Claim is not awaiting adjudication.');
  const paid=minor(c.paidMinor,'paidMinor'),adj=minor(c.adjustmentMinor,'adjustmentMinor'),denied=minor(c.deniedMinor,'deniedMinor'),remaining=claim.chargeMinor-claim.paidMinor-claim.adjustmentMinor;if(sum([paid,adj,denied])!==remaining)bad('Paid, adjustment and denied amounts must equal the unsettled claim charge.');
  const reason=text(c.reason,'reason',500);Object.assign(claim,{adjudication:{paidMinor:paid,adjustmentMinor:adj,deniedMinor:denied},deniedMinor:denied,reason,status:denied===remaining?'Denied':'Adjudicated',version:claim.version+1});return claim;
 }
 case 'appeal-claim': {
  const claim=find(s,'claims',c.claimId);if(!['Denied','Rejected','Settled'].includes(claim.status)||!claim.deniedMinor)conflict('Only claims with a denied remaining balance can be appealed.');if(s.claims.some(p=>p.invoiceId===claim.invoiceId&&p.sequenceIndex>claim.sequenceIndex))conflict('The balance has already advanced to another payer.');
  claim.appeals.push({id:makeId(s,'APL'),reason:text(c.reason,'reason',500),actorId:user.id,createdAt:now()});claim.status='Appealed';claim.version++;return claim;
 }
 case 'replace-claim': {const claim=find(s,'claims',c.claimId);if(!['Submitted','Denied','Rejected','Settled'].includes(claim.status))conflict('Resolve any queued or uncertain submission before replacing the claim.');if(s.claims.some(p=>p.invoiceId===claim.invoiceId&&p.sequenceIndex>claim.sequenceIndex))conflict('A later payer already owns the coordinated balance.');const inv=find(s,'invoices',claim.invoiceId);if(!inv.payerOutstandingMinor)conflict('No payer receivable remains for replacement.');claim.revisions??=[];claim.revisions.push({version:claim.version,chargeMinor:claim.chargeMinor,paidMinor:claim.paidMinor,adjustmentMinor:claim.adjustmentMinor,deniedMinor:claim.deniedMinor,payerClaimId:claim.payerClaimId??null,reason:text(c.reason,'reason',500),actorId:user.id,createdAt:now()});claim.chargeMinor=sum([claim.paidMinor,claim.adjustmentMinor,inv.payerOutstandingMinor]);claim.deniedMinor=inv.payerOutstandingMinor;claim.status='Appealed';claim.appeals.push({id:makeId(s,'APL'),reason:c.reason,actorId:user.id,createdAt:now(),replacement:true});claim.version++;return claim;}
 case 'create-remittance':return remit(s,c);
 case 'clawback': {
  const r=find(s,'remittances',c.remittanceId),inv=find(s,'invoices',r.invoiceId),amount=minor(c.amountMinor,'amountMinor',true);if(amount>r.paidMinor-r.clawedBackMinor)conflict('Clawback exceeds the remaining remittance.');if(amount>availableCash(s))conflict('Insufficient unreserved cash for clawback.');
  r.clawedBackMinor+=amount;r.status=r.clawedBackMinor===r.paidMinor?'Clawed back':'Partly clawed back';inv.payerPaidMinor-=amount;inv.payerOutstandingMinor+=amount;refreshInvoice(inv);journal(s,'remittance.clawback',[dr('Accounts receivable',amount),cr('Cash',amount)],r.id);const cl=find(s,'claims',r.claimId);cl.paidMinor-=amount;cl.deniedMinor+=amount;r.clawbacks??=[];r.clawbacks.push({amountMinor:amount,reason:text(c.reason,'reason'),createdAt:now()});return r;
 }
 case 'collect-payment': {
  const inv=find(s,'invoices',c.invoiceId),amount=minor(c.amountMinor,'amountMinor',true);if(amount>inv.patientOutstandingMinor-pendingCollections(s,inv.id))conflict('Payment exceeds the unreserved patient receivable balance.');const reference=text(c.reference,'reference');if(s.invoices.some(i=>i.payments?.some(p=>p.reference===reference)))conflict('Payment reference was already collected.');inv.payments??=[];inv.payments.push({id:makeId(s,'PAY'),amountMinor:amount,reference,createdAt:now(),mode:'Manual cash'});inv.patientPaidMinor+=amount;inv.patientOutstandingMinor-=amount;refreshInvoice(inv);journal(s,'payment.collect',[dr('Cash',amount),cr('Accounts receivable',amount)],inv.id);return inv;
 }
 case 'record-deposit': {
  const patientId=id(c.patientId,'patientId');if(!fixtures.find('patients',patientId)&&!s.invoices.some(i=>i.patientId===patientId))bad('Patient was not found.');const amount=minor(c.amountMinor,'amountMinor',true),reference=text(c.reference,'reference');if(s.deposits.some(d=>d.reference===reference))conflict('Deposit reference was already recorded.');const d={id:makeId(s,'DEP'),patientId,amountMinor:amount,availableMinor:amount,reservedMinor:0,reference,currency:s.currency,status:'Available',createdAt:now()};s.deposits.push(d);journal(s,'deposit.receive',[dr('Cash',amount),cr('Patient deposits',amount)],d.id);return d;
 }
 case 'allocate-deposit': {
  const d=find(s,'deposits',c.depositId),inv=find(s,'invoices',c.invoiceId),amount=minor(c.amountMinor,'amountMinor',true);if(d.patientId!==inv.patientId)conflict('Deposit belongs to another patient.');if(amount>d.availableMinor||amount>inv.patientOutstandingMinor-pendingCollections(s,inv.id))conflict('Allocation exceeds available deposit or unreserved patient receivable balance.');d.availableMinor-=amount;d.status=d.availableMinor||d.reservedMinor?'Available':'Consumed';inv.patientPaidMinor+=amount;inv.patientOutstandingMinor-=amount;inv.payments??=[];inv.payments.push({id:makeId(s,'ALLOC'),amountMinor:amount,reference:d.id,providerPaymentRef:d.providerPaymentRef??null,mode:'Deposit allocation'});refreshInvoice(inv);journal(s,'deposit.allocate',[dr('Patient deposits',amount),cr('Accounts receivable',amount)],d.id);return d;
 }
 case 'issue-credit': {
  const inv=find(s,'invoices',c.invoiceId),amount=minor(c.amountMinor,'amountMinor',true);if(pendingCollections(s,inv.id))conflict('Reconcile pending provider collections before crediting this invoice.');if(amount>inv.patientOutstandingMinor+inv.payerOutstandingMinor+inv.patientPaidMinor)conflict('Credit exceeds outstanding value and refundable patient receipts. Payer-funded refunds require a separate payer workflow.');const reduction=Math.min(amount,inv.outstandingMinor),liability=amount-reduction,patientReduction=Math.min(reduction,inv.patientOutstandingMinor),payerReduction=reduction-patientReduction;
  // Refunding previously paid value moves the payment to a patient liability;
  // the invoice is credited for the full amount, preserving its identity equation.
  inv.patientPaidMinor-=liability;inv.patientCreditMinor+=patientReduction+liability;inv.payerCreditMinor+=payerReduction;inv.patientOutstandingMinor-=patientReduction;inv.payerOutstandingMinor-=payerReduction;inv.creditMinor+=amount;refreshInvoice(inv);
  const funded=(inv.payments??[]).filter(p=>p.providerPaymentRef&&p.amountMinor>=liability);const refs=new Set(funded.map(p=>p.providerPaymentRef));const row={id:makeId(s,'CRD'),invoiceId:inv.id,patientId:inv.patientId,amountMinor:amount,availableMinor:liability,reservedMinor:0,providerPaymentRef:refs.size===1?funded[0].providerPaymentRef:null,reason:text(c.reason,'reason'),currency:s.currency,status:liability?'Available':'Applied',createdAt:now()};s.credits.push(row);journal(s,'credit.issue',[dr('Refund expense',amount),cr('Accounts receivable',reduction),cr('Patient credits',liability)],row.id);return row;
 }
 case 'request-refund': {
  if(Boolean(c.depositId)===Boolean(c.creditId))bad('Choose exactly one deposit or credit as the refund source.');const sourceType=c.depositId?'deposits':'credits',source=find(s,sourceType,c.depositId??c.creditId),amount=minor(c.amountMinor,'amountMinor',true);if(amount>source.availableMinor)conflict('Refund exceeds available patient funds.');source.availableMinor-=amount;source.reservedMinor+=amount;
  const row={id:makeId(s,'RFD'),sourceType,sourceId:source.id,patientId:source.patientId,amountMinor:amount,reason:text(c.reason,'reason'),makerId:user.id,checkerId:null,currency:s.currency,status:'Requested',createdAt:now()};s.refunds.push(row);return row;
 }
 case 'approve-refund': {
  const r=find(s,'refunds',c.refundId);if(r.status!=='Requested')conflict('Refund is not awaiting approval.');if(r.makerId===user.id)throw new RcmError(403,'Another finance approver must check this refund.','MAKER_CHECKER');r.checkerId=user.id;r.status='Approved';return r;
 }
 case 'cancel-refund': {const r=find(s,'refunds',c.refundId);if(!['Requested','Approved'].includes(r.status)||r.providerRef)conflict('A submitted or completed refund cannot release its reserved funds. Reconcile the provider first.');const source=find(s,r.sourceType,r.sourceId);if(source.reservedMinor<r.amountMinor)conflict('Refund reservation is unavailable.');source.reservedMinor-=r.amountMinor;source.availableMinor+=r.amountMinor;r.status='Cancelled';r.cancelReason=text(c.reason,'reason');return r;}
 case 'pay-refund':case 'reconcile-refund': {
  if(!moneyProvider)conflict('Configure the synthetic money provider before refund payout.');const r=find(s,'refunds',c.refundId);if(c.kind==='pay-refund'&&!['Approved','Uncertain'].includes(r.status)||c.kind==='reconcile-refund'&&!['Pending','Uncertain'].includes(r.status))conflict('Refund is not available for this provider action.');const source=find(s,r.sourceType,r.sourceId);if(!source.providerPaymentRef)conflict('Refund source has no captured provider payment. Capture and allocate through the synthetic provider.');if(source.reservedMinor<r.amountMinor)conflict('Refund reservation is unavailable.');if(r.amountMinor>availableCash(s,r.id))conflict('Insufficient unreserved cash for refund payout.');
  if(c.kind==='reconcile-refund'&&!r.providerRef)conflict('Retry the frozen payout to recover its provider reference.');
  if(c.scenario!==undefined&&!['success','pending','decline','timeout_after_accept'].includes(c.scenario))bad('Unknown synthetic refund scenario.');r.providerScenario??=c.scenario??'success';if(c.scenario&&c.scenario!==r.providerScenario)conflict('Retry with the original payout scenario.');r.status='Uncertain';if(prepare)await prepare(s);
  try{const remote=c.kind==='reconcile-refund'?await moneyProvider.refundStatus({scope:moneyScope(s),refundId:r.providerRef}):await moneyProvider.refund({scope:moneyScope(s),key:r.id,paymentId:source.providerPaymentRef,amountMinor:r.amountMinor,scenario:r.providerScenario});
   if(remote.amountMinor!==r.amountMinor||remote.currency!==undefined&&remote.currency!==s.currency)throw Error('Refund provider currency or amount mismatch');r.providerRef=remote.providerRef;r.responseDigest=remote.digest;
   if(remote.status==='succeeded'){source.reservedMinor-=r.amountMinor;r.status='Paid';r.reference=remote.providerRef;r.paidAt=now();journal(s,'refund.pay',[dr(r.sourceType==='deposits'?'Patient deposits':'Patient credits',r.amountMinor),cr('Cash',r.amountMinor)],r.id);}
   else if(remote.status==='failed'){source.reservedMinor-=r.amountMinor;source.availableMinor+=r.amountMinor;r.status='Failed';}else r.status=remote.status==='pending'?'Pending':'Uncertain';
  }catch(error){r.status='Uncertain';r.lastError=String(error.message).slice(0,240);}return r;
 }
 case 'capture-deposit':case 'retry-capture': {
  if(!moneyProvider)conflict('Configure the synthetic money provider before capture.');let d,amount,providerOperationKey;
  if(c.kind==='retry-capture'){d=find(s,'deposits',c.depositId);if(d.status!=='Uncertain'||!d.providerOperationKey)conflict('No uncertain provider capture is available.');amount=d.amountMinor;providerOperationKey=d.providerOperationKey;}
  else {const patientId=id(c.patientId,'patientId');if(!fixtures.find('patients',patientId)&&!s.invoices.some(i=>i.patientId===patientId))bad('Patient was not found.');amount=minor(c.amountMinor,'amountMinor',true);const reference=text(c.reference,'reference');providerOperationKey=`CAP-${digest([s.scope,user.id,c.idempotencyKey]).slice(0,40)}`;d=s.deposits.find(d=>d.reference===reference);if(d&&d.providerOperationKey!==providerOperationKey)conflict('Deposit reference was already recorded.');if(!d){d={id:makeId(s,'DEP'),patientId,amountMinor:amount,availableMinor:0,reservedMinor:0,reference,providerOperationKey,providerPaymentRef:null,currency:s.currency,status:'Uncertain',createdAt:now()};s.deposits.push(d);}}
  if(d.status==='Available')return d;if(prepare)await prepare(s);
  try{const remote=await moneyProvider.capture({scope:moneyScope(s),key:providerOperationKey,amountMinor:amount,currency:s.currency});if(remote.status!=='captured'||remote.amountMinor!==amount||remote.currency!==s.currency)throw Error('Captured payment failed provider reconciliation');d.availableMinor=amount;d.providerPaymentRef=remote.paymentRef;d.responseDigest=remote.digest;d.status='Available';journal(s,'deposit.provider-capture',[dr('Cash',amount),cr('Patient deposits',amount)],d.id);}catch(error){d.status='Uncertain';d.lastError=String(error.message).slice(0,240);}return d;
 }
 case 'configure-package': {
  const packageId=id(c.packageId,'packageId'),old=s.packages.find(p=>p.id===packageId);const row={id:packageId,name:text(c.name,'name'),caseRateMinor:minor(c.caseRateMinor,'caseRateMinor'),entitlementUnits:minor(c.entitlementUnits,'entitlementUnits',true),excessUnitMinor:minor(c.excessUnitMinor,'excessUnitMinor'),currency:s.currency,version:(old?.version??0)+1,status:'Active',level:publish(s,['packages','packageVersions'],c.level)};s.packageVersions.push({...row,revisionId:makeConfigId(s,'PKGREV')});if(old)s.packages[s.packages.indexOf(old)]=row;else s.packages.push(row);return row;
 }
 case 'enroll-package': {
  const pkg=find(s,'packages',c.packageId),patientId=id(c.patientId,'patientId');if(!fixtures.find('patients',patientId)&&!s.invoices.some(i=>i.patientId===patientId))bad('Patient was not found.');const e={id:makeId(s,'ENT'),packageId:pkg.id,patientId,packageVersion:pkg.version,includedUnits:pkg.entitlementUnits,usedUnits:0,reservedUnits:0,excessMinor:0,caseRateMinor:pkg.caseRateMinor,excessUnitMinor:pkg.excessUnitMinor,currency:s.currency,status:'Open',createdAt:now()};s.entitlements.push(e);return e;
 }
 case 'reserve-package': {const e=find(s,'entitlements',c.entitlementId);if(e.status!=='Open')conflict('Package entitlement is closed.');const units=minor(c.units,'units',true);if(units>e.includedUnits-e.usedUnits-e.reservedUnits)conflict('Reservation exceeds the remaining included entitlement.');const r={id:makeId(s,'RSV'),entitlementId:e.id,units,status:'Reserved',createdAt:now()};e.reservedUnits+=units;s.reservations.push(r);return r;}
 case 'release-package': {const r=find(s,'reservations',c.reservationId);if(r.status!=='Reserved')conflict('Reservation is no longer available.');const e=find(s,'entitlements',r.entitlementId);e.reservedUnits-=r.units;r.status='Released';return r;}
 case 'consume-package': {
  const e=find(s,'entitlements',c.entitlementId);if(e.status!=='Open')conflict('Package entitlement is closed.');const units=minor(c.units,'units',true);if(c.reservationId){const r=find(s,'reservations',c.reservationId);if(r.entitlementId!==e.id||r.status!=='Reserved'||r.units!==units)conflict('Consume the complete reservation for this entitlement.');e.reservedUnits-=units;r.status='Consumed';}else if(e.reservedUnits&&units>Math.max(0,e.includedUnits-e.usedUnits-e.reservedUnits))conflict('Unreserved consumption would consume another reservation.');e.usedUnits=sum([e.usedUnits,units]);e.excessMinor=safeBigInt(BigInt(Math.max(0,e.usedUnits-e.includedUnits))*BigInt(e.excessUnitMinor));return e;
 }
 case 'close-package': {
  const e=find(s,'entitlements',c.entitlementId);if(e.status!=='Open')conflict('Package was already billed.');if(e.reservedUnits)conflict('Consume or release package reservations before billing.');const inv=invoiceRow(s,{id:makeId(s,'PKGINV'),patientId:e.patientId,totalMinor:sum([e.caseRateMinor,e.excessMinor])});e.status='Closed';e.invoiceId=inv.id;return {entitlement:e,invoice:inv};
 }
 case 'configure-drg': {if(c.adapter!=='demo-v1')bad('Only the explicit demo-v1 adapter can be configured.');if(!Array.isArray(c.groups)||!c.groups.length||new Set(c.groups.map(g=>g.prefix)).size!==c.groups.length||!c.groups.some(g=>g.prefix==='*'))bad('Provide distinct diagnosis prefixes and a * fallback group.');const groups=c.groups.map(g=>{if(g.prefix!=='*'&&!/^[A-Z][A-Z0-9.]{0,6}$/.test(g.prefix))bad('Use an ICD diagnosis prefix.');const weight=minor(g.weightBasisPoints,'weightBasisPoints',true);if(weight>100000)bad('Demo weight exceeds the supported range.');return {prefix:g.prefix,groupCode:id(g.groupCode,'groupCode'),weightBasisPoints:weight};});const row={id:makeConfigId(s,'DRGCFG'),version:s.drgConfigurations.length+1,adapter:'demo-v1',baseRateMinor:minor(c.baseRateMinor,'baseRateMinor',true),groups,currency:s.currency,status:'Active',level:publish(s,['drgConfigurations'],c.level)};s.drgConfigurations.push(row);return row;}
 case 'group-drg': {
  const inv=find(s,'invoices',c.invoiceId);if(c.adapter!=='demo-v1')bad('Use the explicit demo-v1 DRG adapter. No certified grouper is installed.');if(!Array.isArray(c.diagnosisCodes)||!c.diagnosisCodes.length||c.diagnosisCodes.some(v=>typeof v!=='string'||!/^[A-Z][0-9]{2}(\.[A-Z0-9]{1,4})?$/.test(v)))bad('Provide synthetic ICD-style diagnosis codes.');
  const cfg=s.drgConfigurations.filter(p=>p.level==='branch').at(-1)??s.drgConfigurations.at(-1),code=c.diagnosisCodes[0],group=cfg.groups.filter(g=>g.prefix!=='*'&&code.startsWith(g.prefix)).sort((a,b)=>b.prefix.length-a.prefix.length)[0]??cfg.groups.find(g=>g.prefix==='*');const row={id:makeId(s,'DRG'),invoiceId:inv.id,adapter:'demo-v1',adapterVersion:cfg.version,configurationId:cfg.id,groupCode:group.groupCode,weightBasisPoints:group.weightBasisPoints,baseRateMinor:cfg.baseRateMinor,allowedMinor:safeBigInt((BigInt(cfg.baseRateMinor)*BigInt(group.weightBasisPoints)+5000n)/10000n),diagnosisCodes:[...c.diagnosisCodes],currency:s.currency,status:'Demo quote',boundary:'Uncertified synthetic demonstration; quote only, no financial posting.'};s.drgCases.push(row);return row;
 }
 case 'propose-pricing': {
  const priceId=id(c.priceId,'priceId'),versions=s.pricingVersions.filter(v=>v.priceId===priceId),level=c.level??'branch',approved=publicationPrice(s,priceId,level);const tax=minor(c.taxBasisPoints,'taxBasisPoints');if(tax>10000)bad('Tax basis points must be between zero and 10000.');const row={id:makeConfigId(s,'PRC'),priceId,version:Math.max(0,...versions.map(v=>v.version))+1,unitPriceMinor:minor(c.unitPriceMinor,'unitPriceMinor'),taxBasisPoints:tax,effectiveFrom:date(c.effectiveFrom,'effectiveFrom'),makerId:user.id,checkerId:null,baseVersion:approved?.version??0,basePricingVersionId:approved?.id??null,status:'Proposed',currency:s.currency,level:publish(s,['pricingVersions'],level)};s.pricingVersions.push(row);return row;
 }
 case 'approve-pricing': {
  const p=find(s,'pricingVersions',c.pricingVersionId);if(p.status!=='Proposed')conflict('Price version is not awaiting approval.');if(p.makerId===user.id)throw new RcmError(403,'A different administrator must approve this price version.','MAKER_CHECKER');const active=publicationPrice(s,p.priceId,p.level);if((active?.id??null)!==p.basePricingVersionId)conflict('Pricing changed after this proposal. Create a new version.');publish(s,['pricingVersions'],p.level);p.checkerId=user.id;p.status='Approved';p.approvedAt=now();return p;
 }
 case 'quote-price': {
  const quantity=minor(c.quantity,'quantity',true),asOf=date(c.asOf??now().slice(0,10),'asOf');const p=effectivePrice(s,c.priceId,asOf);if(!p)conflict('No approved effective price exists.');const net=BigInt(p.unitPriceMinor)*BigInt(quantity),tax=(net*BigInt(p.taxBasisPoints)+5000n)/10000n;return {priceId:p.priceId,pricingVersionId:p.id,netMinor:safeBigInt(net),taxMinor:safeBigInt(tax),totalMinor:safeBigInt(net+tax),currency:s.currency};
 }
 case 'create-collection': {
  const inv=find(s,'invoices',c.invoiceId);if(!inv.outstandingMinor)conflict('Invoice has no receivable to collect.');const row={id:makeId(s,'COL'),invoiceId:inv.id,owner:text(c.owner,'owner'),dueDate:date(c.dueDate,'dueDate'),note:text(c.note,'note',500),status:'Open',createdBy:user.id,createdAt:now()};s.collections.push(row);return row;
 }
 case 'close-collection': {const row=find(s,'collections',c.collectionId);if(row.status!=='Open')conflict('Collection task is already closed.');row.status='Closed';row.closedAt=now();row.closingNote=text(c.note,'note',500);return row;}
 case 'dispatch-collection':case 'reconcile-collection': {
  if(!moneyProvider)conflict('Configure the synthetic collection provider first.');const row=find(s,'collections',c.collectionId),inv=find(s,'invoices',row.invoiceId);if(row.postedMinor||row.status==='Closed')conflict('Collection task is already settled or closed.');
  if(c.kind==='dispatch-collection'){if(c.scenario!==undefined&&!['success','decline','pending','timeout_after_accept','partial','expired'].includes(c.scenario))bad('Unknown synthetic collection scenario.');if(!['Open','Uncertain'].includes(row.status))conflict('Reconcile the pending collection before retrying.');row.requestedMinor??=minor(c.amountMinor,'amountMinor',true);if(c.amountMinor!==row.requestedMinor)conflict('Retry the frozen collection amount.');if(row.requestedMinor>inv.patientOutstandingMinor-pendingCollections(s,inv.id,row.id))conflict('Collection exceeds the unreserved patient receivable.');row.providerScenario??=c.scenario??'success';if(c.scenario&&row.providerScenario!==c.scenario)conflict('Retry the frozen collection scenario.');}else if(!row.providerRef||!['Pending','Uncertain'].includes(row.status))conflict('No provider collection is available for reconciliation.');
  row.status='Uncertain';if(prepare)await prepare(s);try{const remote=c.kind==='dispatch-collection'?await moneyProvider.collect({scope:moneyScope(s),key:row.id,amountMinor:row.requestedMinor,currency:s.currency,reference:row.id,scenario:row.providerScenario}):await moneyProvider.collectionStatus({scope:moneyScope(s),intentId:row.providerRef});if(remote.amountMinor!==row.requestedMinor||remote.currency!==s.currency)throw Error('Collection provider amount or currency mismatch');row.providerRef=remote.providerRef;row.responseDigest=remote.digest;
   if(remote.status==='captured'){const paid=minor(remote.capturedAmountMinor,'capturedAmountMinor',true);if(paid>row.requestedMinor||paid>inv.patientOutstandingMinor)throw Error('Collection provider exceeds patient receivable');inv.patientPaidMinor+=paid;inv.patientOutstandingMinor-=paid;refreshInvoice(inv);row.postedMinor=paid;row.status=paid===row.requestedMinor?'Collected':'Partially collected';journal(s,'collection.provider-receipt',[dr('Cash',paid),cr('Accounts receivable',paid)],row.id);}else if(['pending','unknown','declined','expired'].includes(remote.status))row.status=remote.status==='pending'?'Pending':remote.status==='unknown'?'Uncertain':remote.status==='declined'?'Declined':'Expired';else throw Error('Unknown collection provider status');
  }catch(error){row.status='Uncertain';row.lastError=String(error.message).slice(0,240);}return row;
 }
 case 'export-gl': {
  const exported=new Set(s.glExports.flatMap(b=>b.journalIds)),rows=s.journal.filter(j=>!exported.has(j.id));if(!rows.length)conflict('No unexported journal entries remain.');const batch={id:makeId(s,'GL'),currency:s.currency,journalIds:rows.map(j=>j.id),entries:structuredClone(rows),createdAt:now(),status:'Exported'};s.glExports.push(batch);return batch;
 }
 case 'configure-exchange': {
  if(!mockInsFormats.includes(c.wireFormat))bad('Choose REST_JSON, REST_XML, SOAP11 or SOAP12.');const payer=find(s,'payers',c.payerId),profileId=id(c.profileId,'profileId'),old=s.exchangeProfiles.find(p=>p.id===profileId);const row={id:profileId,payerId:payer.id,payerCode:id(c.payerCode??`MOCKPAYER${s.payers.indexOf(payer)+1}`,'payerCode'),memberId:id(c.memberId??'MBR-NORMAL-001','memberId'),wireFormat:c.wireFormat,version:(old?.version??0)+1,senderId:provider?.senderId??'RCM-DEMO',providerId:provider?.providerId??'PRV-DEMO',status:'Active',canonicalVersion:'pepbits-healthcare-insurance-canonical/1',level:publish(s,['exchangeProfiles','exchangeProfileVersions'],c.level)};s.exchangeProfileVersions.push({...row,revisionId:makeConfigId(s,'PROFILE')});if(old)s.exchangeProfiles[s.exchangeProfiles.indexOf(old)]=row;else s.exchangeProfiles.push(row);return row;
 }
 case 'queue-exchange': {
  const profile=find(s,'exchangeProfiles',c.profileId);if(!mockInsOperations.includes(c.operation))bad('Unknown insurance operation.');if(!['AED','USD','EUR','INR'].includes(s.currency))bad('MockIns supports AED, USD, EUR and INR. No FX conversion is applied.');
  const claim=c.claimId?find(s,'claims',c.claimId):null;if(['CLAIM_SUBMIT','CLAIM_STATUS'].includes(c.operation)&&!claim)bad('Choose a claim.');if(claim&&claim.payerId!==profile.payerId)conflict('Exchange profile payer differs from the claim.');if(c.operation==='CLAIM_SUBMIT'&&claim.sequenceIndex+1>(provider?.maxPayerLevel??3))bad('Claim exceeds the configured MockIns payer level limit.');if(c.operation==='CLAIM_SUBMIT'&&(!['Draft','Appealed'].includes(claim.status)||s.exchanges.some(e=>e.operation==='CLAIM_SUBMIT'&&e.claimId===claim.id&&e.canonical.claimVersion===claim.version&&!['Rejected','Cancelled'].includes(e.status))))conflict('Claim already has a pending or successful submission. Retry its frozen exchange.');
  const key=makeId(s,'EXC'),scopeDigest=digest(s.scope),sender=`S-${digest([profile.senderId,s.scope]).slice(0,32)}`,tenant=`T-${digest(s.scope.tenantId).slice(0,32)}`,common={sender:{id:sender,providerId:profile.providerId},payerCode:profile.payerCode};
  let canonical;const today=now().slice(0,10);
  if(c.operation==='CLAIM_SUBMIT'){
   const submissionId=`SUB-${scopeDigest.slice(0,12)}-${claim.id}-${claim.version}`;claim.submissionId=submissionId;
   const previous=s.claims.filter(p=>p.invoiceId===claim.invoiceId&&p.sequenceIndex<claim.sequenceIndex).sort((a,b)=>a.sequenceIndex-b.sequenceIndex),evidence=previous.map(p=>{const remittances=s.remittances.filter(r=>r.claimId===p.id);if(!remittances.length)conflict('Electronic coordination requires a posted prior remittance or denial advice. Intake rejection alone is not EOB evidence.');const paid=sum(remittances.map(r=>r.paidMinor)),recouped=sum(remittances.map(r=>r.clawedBackMinor));return {priorPayerLevel:p.sequenceIndex+1,priorCoverageId:p.sequenceIndex+1,priorClaimLineId:p.evidenceId,remittanceLineId:remittances.at(-1).evidenceId,currency:s.currency,billedAmount:minorDecimal(p.chargeMinor),allowedAmount:minorDecimal(paid),paidAmount:minorDecimal(paid),patientResponsibility:'0.00',contractualAmount:minorDecimal(p.adjustmentMinor),rejectedAmount:minorDecimal(p.chargeMinor-paid-p.adjustmentMinor),recoupedAmount:minorDecimal(recouped),correctedAmount:'0.00',netPaidAmount:minorDecimal(paid-recouped)};});
   const submittedCharge=claim.chargeMinor-claim.paidMinor-claim.adjustmentMinor;canonical={...common,submissionId,patientControlNumber:claim.id,claimVersion:claim.version,frequencyCode:claim.appeals.length&&claim.payerClaimId?'7':'1',subscriber:{memberId:profile.memberId},currencyCode:s.currency,totalChargeAmount:minorDecimal(submittedCharge),serviceDates:{from:today,to:today},serviceLines:[{lineControl:claim.id+'-1',lineNumber:1,procedureCode:'SVC-DEMO',serviceDate:today,units:'1',chargeAmount:minorDecimal(submittedCharge),...(evidence.length?{priorEob:evidence}:{})}],...(evidence.length?{payerLevel:claim.sequenceIndex+1}:{}),...(claim.appeals.length&&claim.payerClaimId?{priorPayerClaimId:claim.payerClaimId}:{})};claim.priorEvidence=previous.map(p=>({claimId:p.id,remittanceIds:s.remittances.filter(r=>r.claimId===p.id).map(r=>r.id)}));
  }
  else if(c.operation==='ELIGIBILITY')canonical={...common,inquiryId:key,subscriber:{memberId:profile.memberId},serviceDate:today,serviceTypeCode:'30'};
  else if(c.operation==='CLAIM_STATUS'){if(!claim.submissionId)conflict('Submit the claim before polling status.');canonical={...common,inquiryId:key,submissionId:claim.submissionId,claimVersion:claim.exchangeClaimVersion??claim.version,...(claim.payerClaimId?{payerClaimId:claim.payerClaimId}:{})};}
  else canonical={...common,queryId:key,...(c.remittanceId?{remittanceId:id(c.remittanceId,'remittanceId')}:{})};
  const row={id:key,profileId:profile.id,profileVersion:profile.version,operation:c.operation,claimId:claim?.id??null,status:'Queued',attempts:0,createdAt:now(),wire:freezeMockInsRequest(profile,c.operation,canonical),canonical,profileSnapshot:structuredClone(profile),identity:{tenant,sender},priorEvidenceDigest:claim?digest(coordinationSnapshot(s,claim)):null};s.exchanges.push(row);return publicExchange(row);
 }
 case 'cancel-exchange': {const e=find(s,'exchanges',c.exchangeId);if(e.status!=='Queued'||e.attempts)conflict('Only an unsent exchange can be cancelled. Reconcile uncertain provider outcomes.');e.status='Cancelled';e.cancelReason=text(c.reason,'reason');return publicExchange(e);}
 case 'dispatch-exchange': {
  const e=find(s,'exchanges',c.exchangeId);if(!['Queued','Uncertain'].includes(e.status))conflict('Exchange is already complete.');if(e.operation==='CLAIM_SUBMIT'&&e.priorEvidenceDigest!==digest(coordinationSnapshot(s,find(s,'claims',e.claimId))))conflict('Prior payer evidence changed after queuing. Reconcile coordination before submitting.');e.attempts++;
  try{const response=await dispatchMockIns(provider,e.profileSnapshot,e,e.identity);e.response=response.payload;e.responseDigest=response.responseDigest;e.status='Succeeded';e.lastError=null;e.completedAt=now();
   if(e.operation==='CLAIM_SUBMIT'){const claim=find(s,'claims',e.claimId);if(response.payload.ackStatus==='R'){e.status='Rejected';claim.status='Rejected';claim.deniedMinor=claim.chargeMinor-claim.paidMinor-claim.adjustmentMinor;claim.reason=(response.payload.rejections??[]).map(r=>r.code).join(',')||'Payer rejected submission';}else {claim.status='Submitted';claim.payerClaimId=response.payload.payerClaimId??null;claim.exchangeClaimVersion=e.canonical.claimVersion;} }
  }catch(error){e.status='Uncertain';e.lastError=String(error.message).slice(0,240);}
  return publicExchange(e);
 }
 case 'apply-exchange-remittance': {
  const e=find(s,'exchanges',c.exchangeId);if(e.operation!=='REMITTANCE'||e.status!=='Succeeded')conflict('A successful remittance exchange is required.');const advice=e.response.advices.find(a=>a.remittanceId===c.remittanceId);if(!advice)bad('Remittance advice was not returned.');if(advice.currencyCode!==s.currency)bad('Remittance currency mismatch.');
  const claim=find(s,'claims',c.claimId),remote=advice.claims.find(r=>r.submissionId===claim.submissionId);if(!remote||remote.claimVersion!==claim.exchangeClaimVersion||remote.patientControlNumber!==claim.id||remote.payerClaimId!==claim.payerClaimId||advice.payerCode!==e.profileSnapshot.payerCode||claim.payerId!==e.profileSnapshot.payerId)bad('Provider remittance claim correlation failed.');
  const submission=s.exchanges.find(x=>x.operation==='CLAIM_SUBMIT'&&x.status==='Succeeded'&&x.canonical.submissionId===remote.submissionId&&x.canonical.claimVersion===remote.claimVersion);if(!submission)bad('Frozen successful claim submission was not found.');if(submission.priorEvidenceDigest!==digest(coordinationSnapshot(s,claim)))conflict('Prior payer evidence changed after submission. Reconcile the coordination correction before posting.');const controls=new Set(remote.lines.map(l=>l.lineControl));if(controls.size!==remote.lines.length||remote.lines.length!==submission.canonical.serviceLines.length||remote.lines.some(l=>!submission.canonical.serviceLines.some(x=>x.lineControl===l.lineControl&&x.chargeAmount===l.chargeAmount)))bad('Provider remittance line correlation failed.');
  const charge=decimalMinor(remote.totalChargeAmount),paid=decimalMinor(remote.totalPaidAmount),adjustments=sum(remote.lines.flatMap(l=>(l.adjustments??[]).filter(a=>a.groupCode==='CO'&&a.reasonCode==='45').map(a=>decimalMinor(a.amount))));if(charge!==decimalMinor(submission.canonical.totalChargeAmount)||sum(remote.lines.map(l=>decimalMinor(l.chargeAmount)))!==charge||sum(remote.lines.map(l=>decimalMinor(l.paidAmount)))!==paid)bad('Provider remittance totals failed reconciliation.');
  for(const line of remote.lines){if(!['PAID','PART','DENY'].includes(line.statusCode)||(line.adjustments??[]).some(a=>a.groupCode!=='CO'||!['45','50'].includes(a.reasonCode)))bad('Provider remittance contains unsupported outcome or adjustment codes; review the raw exchange before posting.');const lineCharge=decimalMinor(line.chargeAmount),linePaid=decimalMinor(line.paidAmount),lineAdj=sum((line.adjustments??[]).map(a=>decimalMinor(a.amount)));if(sum([linePaid,lineAdj])!==lineCharge||line.allowedAmount!==undefined&&decimalMinor(line.allowedAmount)<linePaid)bad('Provider line remittance does not conserve value.');}
  if(decimalMinor(advice.totalPaidAmount)!==sum(advice.claims.map(r=>decimalMinor(r.totalPaidAmount))))bad('Provider advice total failed reconciliation.');const posted=remit(s,{...c,paidMinor:paid,adjustmentMinor:adjustments,reference:advice.remittanceId});posted.providerSource={exchangeId:e.id,remittanceId:advice.remittanceId,lineControls:[...controls],responseDigest:e.responseDigest};return posted;
 }
 default:bad('Unsupported RCM command.');
 }
}
function validatePayers(s,values){if(!Array.isArray(values)||!values.length||values.length>64||new Set(values).size!==values.length)bad('Configure one to 64 distinct payer identifiers.');for(const value of values){const p=find(s,'payers',value);if(p.status!=='Active')bad('Payer is inactive.');}}
function publicExchange({wire,canonical,profileSnapshot,identity,...e}){return structuredClone(e);}

export function createHealthcareSuiteRcmStore(options={}){
 const dataDir=resolve(options.dataDir??process.env.HC_RCM_DATA_DIR??fileURLToPath(new URL('./.data/healthcare-suite-rcm/',import.meta.url)));
 const currency=options.defaultCurrency??'AED';if(!currencies.has(currency))throw Error('Unsupported RCM default currency');
 if(options.provider?.maxPayerLevel!==undefined&&(!Number.isSafeInteger(options.provider.maxPayerLevel)||options.provider.maxPayerLevel<2||options.provider.maxPayerLevel>20))throw Error('MockIns maximum payer level must be between two and 20');
 async function transaction(user,scope,fn){
  const key=identity(user,scope);await mkdir(dataDir,{recursive:true,mode:0o700});const file=join(dataDir,digest([key.tenantId,key.applicationId])+'.json'),partitionKey=digest(key);
  return serialized(file,()=>withDiskLock(file,async()=>{
   let durable;try{durable=JSON.parse(await readFile(file,'utf8'));if(durable.schemaVersion!==1||durable.tenantId!==key.tenantId||durable.applicationId!==key.applicationId)throw Error('RCM durable tenant mismatch');for(const state of Object.values(durable.partitions))assertInvariant(state);}catch(e){if(e.code!=='ENOENT')throw e;durable={schemaVersion:1,tenantId:key.tenantId,applicationId:key.applicationId,tenantPayerPolicies:[{id:'POLICY-TENANT-DEMO',level:'tenant-default',inherit:false,version:1,payerIds:fixtures.all('payers').map(p=>p.id),maximumPayers:16,status:'Active',effectiveFrom:'2026-01-01'}],branchPayerPolicies:{},configurations:{tenant:configurationSeed(seed(key,currency)),branches:{}},partitions:{}};}
   const state=durable.partitions[partitionKey]??seed(key,currency);if(stable(state.scope)!==stable(key))throw Error('RCM durable partition mismatch');projectConfigurations(state,durable);let publication=null;
   const publishConfiguration=(next,pub)=>{publication=pub;const target=pub.level==='tenant'?durable.configurations.tenant:(durable.configurations.branches[key.branchId]??={});for(const family of pub.families)target[family]=structuredClone(next[family].filter(r=>r.level===pub.level));projectConfigurations(next,durable);};
   const save=async next=>{const previousPolicy=digest(durable.tenantPayerPolicies),previousBranchPolicy=digest(durable.branchPayerPolicies[key.branchId]??[]);durable.tenantPayerPolicies=structuredClone(next.tenantPayerPolicies);durable.branchPayerPolicies[key.branchId]=structuredClone(next.payerPolicies);durable.partitions[partitionKey]=next;const tenantChanged=previousPolicy!==digest(durable.tenantPayerPolicies),branchChanged=previousBranchPolicy!==digest(next.payerPolicies);for(const [p,other]of Object.entries(durable.partitions)){if(p===partitionKey)continue;const sameBranch=other.scope.branchId===key.branchId;if(tenantChanged||branchChanged&&sameBranch||publication&&(publication.level==='tenant'||sameBranch)){projectConfigurations(other,durable);other.version++;}}projectConfigurations(next,durable);await persist(file,durable,options.beforePersist?()=>options.beforePersist(structuredClone(next)):null);publication=null;};
   return fn(state,save,publishConfiguration);
  }));
 }
 return {
  async ownsInvoice(user,scope,invoiceId,facilityId){return transaction(user,{...scope,facilityId:facilityId??scope.facilityId},async s=>s.invoices.some(i=>i.source?.invoiceId===invoiceId));},
  async handle(user,scope,request){
   const path=String(request.path??'').replace(/^\/api(?=\/|$)/,'').replace(/\/+$/,'');if(path!=='/rcm'&&!path.startsWith('/rcm/'))return null;
   try{
    // Scope facility is selected by the authenticated host. A raw header is never
    // allowed to override the supplied trusted scope inside this store.
    identity(user,scope);const method=String(request.method??'GET').toUpperCase();
    if(path==='/rcm/workspace'&&method==='GET')return await transaction(user,scope,async(s,save)=>{await save(s);return {status:200,body:workspace(s,user,options.provider,options.moneyProvider)};});
    if(path!=='/rcm/commands')return {status:404,body:{statusCode:404,message:'RCM endpoint is unavailable.'}};if(method!=='POST')return {status:405,body:{statusCode:405,message:'Use POST for RCM commands.'}};
    const c=request.body;if(!object(c))bad('Provide a command object.');text(c.kind,'kind');minor(c.expectedVersion,'expectedVersion');
    const replayKey=c.idempotencyKey??request.headers?.['idempotency-key'];if(typeof replayKey!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(replayKey))bad('Provide a valid idempotency key.');if(c.idempotencyKey&&request.headers?.['idempotency-key']&&c.idempotencyKey!==request.headers['idempotency-key'])bad('Conflicting idempotency keys.');
    return await transaction(user,scope,async(s,save,publishConfiguration)=>{
     allowed(s,user,c);const operationId=`${user.id}:${replayKey}`,fingerprint=digest(c),replay=s.idempotency[operationId];if(replay){if(replay.fingerprint!==fingerprint)conflict('Idempotency key was used with a different command payload.');if(!replay.pending)return structuredClone(replay.result);}
     if(!replay?.pending&&c.expectedVersion!==s.version)throw new RcmError(409,'Workspace changed. Reload before applying this command.','STALE_VERSION',{currentVersion:s.version});
     const next=structuredClone(s);let prepared=false;const prepare=async state=>{if(prepared)return;state.version++;const event={id:makeId(state,'EVT'),version:state.version,kind:c.kind+'.prepared',actorId:user.id,role:user.role,scope:state.scope,currency:state.currency,commandDigest:fingerprint,resultId:null,status:'Pending provider',createdAt:now(),previousHash:state.outbox.at(-1)?.hash??null};state.outbox.push({...event,hash:digest(event)});state.idempotency[operationId]={fingerprint,pending:true};assertInvariant(state);await save(structuredClone(state));prepared=true;};const result=await execute(next,user,{...c,idempotencyKey:replayKey},{...options,prepare});const publication=next._publication;delete next._publication;if(publication)publishConfiguration(next,publication);next.version++;
     const event={id:makeId(next,'EVT'),version:next.version,kind:c.kind,actorId:user.id,role:user.role,scope:next.scope,currency:next.currency,commandDigest:fingerprint,resultId:result?.id??null,status:'Recorded',createdAt:now(),previousHash:next.outbox.at(-1)?.hash??null};next.outbox.push({...event,hash:digest(event)});
     assertInvariant(next);const response={status:201,body:{version:next.version,result:structuredClone(result),workspace:workspace(next,user,options.provider,options.moneyProvider)}};next.idempotency[operationId]={fingerprint,result:response};await save(next);return structuredClone(response);
    });
   }catch(error){if(error instanceof RcmError)return {status:error.status,body:{statusCode:error.status,message:error.message,code:error.code,...(error.fields?{fields:error.fields,...error.fields}:{})}};
    return {status:503,body:{statusCode:503,message:'RCM durable storage is unavailable. Retry the same operation identifier.',code:'STORAGE_UNAVAILABLE'}};
   }
  },
 };
}
