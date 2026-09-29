import type {RcmCapability, RcmWorkspace} from '../../lib/rcm-contract';

export type RcmSection = 'claims'|'exchange'|'remittances'|'patient-finance'|'packages'|'drg'|'accounting'|'commercial'|'receivables';
export type FieldKind = 'text'|'money'|'integer'|'date'|'textarea'|'list'|'choice'|'group-rules';
export interface CommandField {key:string;label:string;type:FieldKind;source?:keyof RcmWorkspace;options?:string[];optional?:boolean;defaultValue?:string;hint?:string}
export interface RcmAction {kind:string;actionId?:string;label:string;capability:RcmCapability;additionalCapability?:RcmCapability;requiresMoneyProvider?:boolean;fields:CommandField[];payload?:Record<string,unknown>;help?:string}
export const rcmActionId=(action:RcmAction)=>action.actionId??action.kind;
export interface RcmDefinition {title:string;description:string;collections:(keyof RcmWorkspace)[];actions:RcmAction[]}
const id=(key:string,label:string,source:keyof RcmWorkspace,optional=false):CommandField=>({key,label,type:'choice',source,optional});
const text=(key:string,label:string,optional=false):CommandField=>({key,label,type:'text',optional});
const money=(key:string,label:string,defaultValue?:string):CommandField=>({key,label,type:'money',defaultValue});
const reason:CommandField={key:'reason',label:'Reason',type:'textarea'};
const amount=money('amountMinor','Amount');
const invoice=id('invoiceId','Invoice','invoices');
const claim=id('claimId','Claim','claims');
const deposit=id('depositId','Deposit','deposits');
const entitlement=id('entitlementId','Entitlement','entitlements');
const date=(key:string,label:string):CommandField=>({key,label,type:'date'});
const integer=(key:string,label:string):CommandField=>({key,label,type:'integer'});
const publicationScope:CommandField={key:'level',label:'Publication scope',type:'choice',options:['branch','tenant'],defaultValue:'branch',optional:true};
export const RCM_SECTIONS:Record<RcmSection,RcmDefinition>={
 claims:{title:'Claims and payer coordination',description:'Configure any ordered payer sequence, adjudicate liability and track denial appeals.',collections:['invoices','claims','payerSequences','payerPolicies','tenantPayerPolicies','payers'],actions:[
  {kind:'configure-payer-sequence',label:'Configure payer sequence',capability:'configure',fields:[invoice,{key:'payerIds',label:'Ordered payer IDs',type:'list',hint:'Enter payer IDs in coordination order, separated by commas.'}]},
  {kind:'create-claim',label:'Create claim',capability:'claims',fields:[invoice,text('payerId','Payer ID')]},
  {kind:'adjudicate-claim',label:'Adjudicate claim',capability:'claims',fields:[claim,money('paidMinor','Paid amount','0'),money('adjustmentMinor','Adjustment amount','0'),money('deniedMinor','Denied amount','0'),reason]},
  {kind:'appeal-claim',label:'Appeal denial',capability:'claims',fields:[claim,reason]},
  {kind:'replace-claim',label:'Replace claim revision',capability:'claims',fields:[claim,reason],help:'Freeze the prior revision and prepare a new submission revision for the remaining payer liability.'},
  {kind:'configure-payer-policy',label:'Configure payer policy',capability:'configure',fields:[{key:'level',label:'Policy scope',type:'choice',options:['branch','tenant-default'],defaultValue:'branch'},{key:'payerIds',label:'Ordered payer IDs',type:'list'},integer('maximumPayers','Maximum payers'),date('effectiveFrom','Effective from')]},
  {kind:'configure-payer',label:'Configure payer',capability:'configure',fields:[text('payerId','Payer ID'),text('name','Payer name'),publicationScope]},
  {kind:'configure-payer-policy',actionId:'inherit-payer-policy',label:'Inherit tenant payer defaults',capability:'configure',fields:[date('effectiveFrom','Effective from')],payload:{level:'branch',inherit:true},help:'The branch uses the effective tenant payer defaults from this date.'},
 ]},
 exchange:{title:'Provider and payer exchange',description:'Configure JSON or XML REST and SOAP exchange profiles, queue requests and inspect delivery outcomes.',collections:['exchangeProfiles','exchanges'],actions:[
  {kind:'configure-exchange',label:'Configure exchange profile',capability:'configure',fields:[text('profileId','Profile ID'),text('payerId','Payer ID'),text('payerCode','Provider payer code',true),text('memberId','Member ID',true),{key:'wireFormat',label:'Wire format',type:'choice',options:['REST_JSON','REST_XML','SOAP11','SOAP12'],defaultValue:'REST_JSON'},publicationScope]},
  {kind:'queue-exchange',label:'Queue exchange',capability:'claims',fields:[id('profileId','Exchange profile','exchangeProfiles'),{key:'operation',label:'Exchange operation',type:'choice',options:['CLAIM_SUBMIT','ELIGIBILITY','CLAIM_STATUS','REMITTANCE'],defaultValue:'CLAIM_SUBMIT'},id('claimId','Claim','claims',true)]},
  {kind:'dispatch-exchange',label:'Dispatch exchange',capability:'claims',fields:[id('exchangeId','Queued exchange','exchanges')]},
  {kind:'cancel-exchange',label:'Cancel unsent exchange',capability:'claims',fields:[id('exchangeId','Queued exchange','exchanges'),reason]},
  {kind:'apply-exchange-remittance',label:'Apply provider remittance advice',capability:'finance',fields:[id('exchangeId','Remittance exchange','exchanges'),text('remittanceId','Provider remittance ID'),claim]},
 ]},
 remittances:{title:'Remittances and clawbacks',description:'Apply payer remittances and record bounded clawbacks with an audit reason.',collections:['claims','remittances'],actions:[
  {kind:'create-remittance',label:'Apply remittance',capability:'finance',fields:[claim,money('paidMinor','Paid amount'),money('adjustmentMinor','Adjustment amount','0'),text('reference','Payment reference')]},
  {kind:'clawback',label:'Record clawback',capability:'finance',fields:[id('remittanceId','Remittance','remittances'),amount,reason]},
 ]},
 'patient-finance':{title:'Patient deposits, credits and refunds',description:'Allocate patient deposits, issue credits and review refunds through approval and payout.',collections:['deposits','credits','refunds'],actions:[
  {kind:'record-deposit',label:'Record deposit',capability:'finance',fields:[text('patientId','Patient ID'),amount,text('reference','Payment reference')]},
  {kind:'allocate-deposit',label:'Allocate deposit',capability:'finance',fields:[deposit,invoice,amount]},
  {kind:'issue-credit',label:'Issue credit',capability:'finance',fields:[invoice,amount,reason]},
  {kind:'request-refund',label:'Request refund',capability:'finance',fields:[id('depositId','Deposit','deposits',true),id('creditId','Credit','credits',true),amount,reason],help:'Choose one deposit or credit as the refund source.'},
  {kind:'approve-refund',label:'Approve refund',capability:'approve',additionalCapability:'finance',fields:[id('refundId','Refund','refunds')]},
  {kind:'pay-refund',label:'Pay approved refund',capability:'finance',requiresMoneyProvider:true,fields:[id('refundId','Refund','refunds')]},
  {kind:'reconcile-refund',label:'Reconcile provider refund',capability:'finance',requiresMoneyProvider:true,fields:[id('refundId','Refund','refunds')]},
  {kind:'capture-deposit',label:'Capture provider deposit',capability:'finance',requiresMoneyProvider:true,fields:[text('patientId','Patient ID'),amount,text('reference','Payment reference')]},
  {kind:'retry-capture',label:'Retry uncertain deposit capture',capability:'finance',requiresMoneyProvider:true,fields:[deposit]},
  {kind:'cancel-refund',label:'Cancel refund reservation',capability:'finance',fields:[id('refundId','Refund','refunds'),reason]},
 ]},
 packages:{title:'Packages and case rates',description:'Define package entitlements, reserve or consume units and close a case with explicit excess charges.',collections:['packages','packageVersions','entitlements','reservations'],actions:[
  {kind:'configure-package',label:'Configure package',capability:'configure',fields:[text('packageId','Package ID'),text('name','Package name'),money('caseRateMinor','Case rate'),integer('entitlementUnits','Entitlement units'),money('excessUnitMinor','Excess unit charge'),publicationScope]},
  {kind:'enroll-package',label:'Enroll patient',capability:'finance',fields:[id('packageId','Package','packages'),text('patientId','Patient ID')]},
  {kind:'consume-package',label:'Consume entitlement',capability:'finance',fields:[entitlement,integer('units','Units'),id('reservationId','Reservation','reservations',true)]},
  {kind:'close-package',label:'Close package case',capability:'finance',fields:[entitlement]},
  {kind:'reserve-package',label:'Reserve entitlement',capability:'finance',fields:[entitlement,integer('units','Units')]},
  {kind:'release-package',label:'Release entitlement reservation',capability:'finance',fields:[id('reservationId','Reservation','reservations')]},
 ]},
 drg:{title:'DRG demonstration',description:'Run the demo grouper and inspect the versioned result. Demo grouping is not certified for reimbursement or jurisdictional claims.',collections:['drgCases','drgConfigurations'],actions:[
  {kind:'group-drg',label:'Run demo grouper',capability:'claims',fields:[invoice,{key:'diagnosisCodes',label:'Diagnosis codes',type:'list',hint:'Enter diagnosis codes separated by commas.'}],help:'This uses demo-v1. A certified jurisdiction-specific adapter must be integrated and validated before reimbursement use.'},
  {kind:'configure-drg',label:'Configure demo DRG rules',capability:'configure',fields:[money('baseRateMinor','DRG base rate'),{key:'groups',label:'Diagnosis group rules',type:'group-rules',hint:'One rule per line: diagnosis prefix, DRG code, weight basis points. Include a * fallback.'},publicationScope],help:'Rules configure the uncertified demo-v1 adapter. Changing weights does not establish reimbursement certification.'},
 ]},
 accounting:{title:'General ledger and reconciliation',description:'Review balanced journal entries, reconcile receivables and export the ledger.',collections:['journal','glExports','outbox'],actions:[
  {kind:'export-gl',label:'Export general ledger',capability:'export',fields:[]},
 ]},
 commercial:{title:'Commercial pricing and tax controls',description:'Propose an effective-dated pricing revision and have an independent checker approve it.',collections:['pricingVersions'],actions:[
  {kind:'propose-pricing',label:'Propose pricing revision',capability:'configure',fields:[text('priceId','Price ID'),money('unitPriceMinor','Unit price'),integer('taxBasisPoints','Tax basis points'),date('effectiveFrom','Effective from'),publicationScope]},
  {kind:'approve-pricing',label:'Approve pricing revision',capability:'approve',additionalCapability:'configure',fields:[id('pricingVersionId','Pricing revision','pricingVersions')]},
  {kind:'quote-price',label:'Calculate approved price and tax',capability:'read',fields:[text('priceId','Price ID'),integer('quantity','Quantity'),date('asOf','Pricing date')]},
 ]},
 receivables:{title:'Receivables and collection reporting',description:'Review outstanding balances and aging, assign collection work and record its outcome.',collections:['invoices','collections'],actions:[
  {kind:'create-collection',label:'Assign collection',capability:'finance',fields:[invoice,text('owner','Collection owner'),date('dueDate','Due date'),{key:'note',label:'Collection note',type:'textarea'}]},
  {kind:'close-collection',label:'Close collection',capability:'finance',fields:[id('collectionId','Collection task','collections'),{key:'note',label:'Outcome note',type:'textarea'}]},
  {kind:'collect-payment',label:'Collect receivable payment',capability:'finance',fields:[invoice,amount,text('reference','Payment reference')]},
  {kind:'import-invoice',label:'Import Healthcare Suite invoice',capability:'finance',fields:[text('invoiceId','Healthcare Suite invoice ID')],help:'Import a posted invoice from the current facility. Its source identity and financial totals are preserved.'},
  {kind:'dispatch-collection',label:'Request provider collection',capability:'finance',requiresMoneyProvider:true,fields:[id('collectionId','Collection task','collections'),amount]},
  {kind:'reconcile-collection',label:'Reconcile provider collection',capability:'finance',requiresMoneyProvider:true,fields:[id('collectionId','Collection task','collections')]},
 ]},
};

/** Parse decimal text without floating point rounding or silent fractional truncation. */
export function majorToMinor(value:string):number {
 const match=/^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
 if(!match)throw new Error('Enter a non-negative amount with at most two decimal places.');
 const amount=BigInt(match[1])*100n+BigInt((match[2]??'').padEnd(2,'0'));
 if(amount>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Amount exceeds the supported range.');
 return Number(amount);
}

export function buildRcmPayload(action:RcmAction,values:Record<string,string>):Record<string,unknown>{
 const payload:Record<string,unknown>={...action.payload};
 for(const field of action.fields){
  const value=(values[field.key]??'').trim();
  if(!value){if(field.optional)continue;throw new Error('Complete all required fields.');}
  if(field.type==='money')payload[field.key]=majorToMinor(value);
  else if(field.type==='integer'){
   if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('Enter a non-negative whole number.');
   payload[field.key]=Number(value);
  }else if(field.type==='group-rules'){
   const groups=value.split(/\r?\n/).filter(line=>line.trim()).map(line=>{
    const parts=line.split(',').map(part=>part.trim());
    if(parts.length!==3||!/^(?:\*|[A-Z][A-Z0-9.]{0,6})$/.test(parts[0])||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(parts[1])||!/^\d+$/.test(parts[2]))throw new Error('Enter each DRG rule as prefix, code, whole-number weight.');
    const weight=Number(parts[2]);if(!Number.isSafeInteger(weight)||weight<1||weight>100000)throw new Error('DRG weight must be between 1 and 100000 basis points.');
    return {prefix:parts[0],groupCode:parts[1],weightBasisPoints:weight};
   });
   if(!groups.some(group=>group.prefix==='*')||new Set(groups.map(group=>group.prefix)).size!==groups.length)throw new Error('Provide distinct DRG prefixes and a * fallback rule.');
   payload[field.key]=groups;
  }else if(field.type==='list'){
   const items=value.split(',').map(v=>v.trim());
   if(items.some(v=>!v)||new Set(items).size!==items.length)throw new Error('Enter distinct values separated by commas.');
   payload[field.key]=items;
  }else if(field.type==='date'){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error('Enter a valid date.');
   payload[field.key]=value;
  }else{
   if(field.options&&!field.options.includes(value))throw new Error('Select a supported option.');
   payload[field.key]=value;
  }
 }
 if(action.kind==='request-refund'&&Boolean(payload.depositId)===Boolean(payload.creditId))throw new Error('Choose exactly one deposit or credit for the refund.');
 if(action.kind==='group-drg'||action.kind==='configure-drg')payload.adapter='demo-v1';
 return payload;
}
