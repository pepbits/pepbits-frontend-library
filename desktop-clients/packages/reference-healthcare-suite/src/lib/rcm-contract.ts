/** RCM amounts are integer minor units. Malformed responses are never coerced to zero. */
export type RcmCapability='read'|'claims'|'finance'|'configure'|'approve'|'export';
export type RcmRecord={id:string;status?:string;[key:string]:unknown};
export interface RcmJournalEntry {account:string;debitMinor:number;creditMinor:number}
export interface RcmJournal extends RcmRecord {event:string;entries:RcmJournalEntry[]}
export interface RcmReports {
 outstandingMinor:number;cashMinor:number;creditsMinor:number;depositsMinor:number;
 aging:{bucket:string;amountMinor:number}[];
 trialBalance:{account:string;debitMinor:number;creditMinor:number;balanceMinor:number}[];
 payerExposure:{payerId:string;amountMinor:number}[];
 journalBalanced:boolean;
 [key:string]:unknown;
}
export interface RcmWorkspace {
 version:number;currency:string;capabilities:Record<RcmCapability,boolean>;
 payers:RcmRecord[];payerPolicies:RcmRecord[];glExports:RcmRecord[];
 tenantPayerPolicies:RcmRecord[];packageVersions:RcmRecord[];reservations:RcmRecord[];drgConfigurations:RcmRecord[];
 moneyProviderConfigured?:boolean;
 effectivePayerPolicy?:RcmRecord|null;
 invoices:RcmRecord[];claims:RcmRecord[];payerSequences:RcmRecord[];
 exchangeProfiles:RcmRecord[];exchanges:RcmRecord[];remittances:RcmRecord[];
 credits:RcmRecord[];deposits:RcmRecord[];refunds:RcmRecord[];packages:RcmRecord[];
 entitlements:RcmRecord[];pricingVersions:RcmRecord[];drgCases:RcmRecord[];
 journal:RcmJournal[];outbox:RcmRecord[];collections:RcmRecord[];reports:RcmReports;
 [key:string]:unknown;
}
export class RcmContractError extends Error {readonly path:string;constructor(path:string){super(`The RCM service returned invalid data at ${path}.`);this.path=path;this.name='RcmContractError';}}
const object=(v:unknown,path:string):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new RcmContractError(path);return v as Record<string,unknown>;};
const string=(v:unknown,path:string)=>{if(typeof v!=='string'||!v.trim())throw new RcmContractError(path);return v;};
const integer=(v:unknown,path:string,signed=false)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||(!signed&&v<0))throw new RcmContractError(path);return v;};
const array=(v:unknown,path:string):unknown[]=>{if(!Array.isArray(v))throw new RcmContractError(path);return v;};
const bool=(v:unknown,path:string)=>{if(typeof v!=='boolean')throw new RcmContractError(path);return v;};
/** Includes nested monetary fields, including profile-provided future extensions. */
function validateMonetary(v:unknown,path:string):void {
 if(Array.isArray(v)){v.forEach((item,i)=>validateMonetary(item,`${path}.${i}`));return;}
 if(v&&typeof v==='object')for(const [key,value] of Object.entries(v)){
  if(/Minor$|BasisPoints$/.test(key))integer(value,`${path}.${key}`,['balanceMinor','patientAllocationRemainderMinor','payerAllocationRemainderMinor'].includes(key));
  else validateMonetary(value,`${path}.${key}`);
 }
}
const requiredMoney:Record<string,string[]>={
 invoices:['totalMinor','paidMinor','adjustmentMinor','creditMinor','outstandingMinor','patientShareMinor','payerShareMinor','patientPaidMinor','payerPaidMinor','patientOutstandingMinor','payerOutstandingMinor','patientCreditMinor','payerCreditMinor'],
 claims:['chargeMinor','paidMinor','adjustmentMinor','deniedMinor'],
 remittances:['paidMinor','adjustmentMinor','clawedBackMinor'],
 deposits:['amountMinor','availableMinor','reservedMinor'],credits:['amountMinor','availableMinor','reservedMinor'],
 refunds:['amountMinor'],packages:['caseRateMinor','excessUnitMinor'],entitlements:['excessMinor','caseRateMinor','excessUnitMinor'],
 pricingVersions:['unitPriceMinor','taxBasisPoints'],drgCases:['allowedMinor'],
 packageVersions:['caseRateMinor','excessUnitMinor'],drgConfigurations:['baseRateMinor'],
};
export const RCM_COLLECTIONS=['payers','payerPolicies','tenantPayerPolicies','glExports','invoices','claims','payerSequences','exchangeProfiles','exchanges','remittances','credits','deposits','refunds','packages','packageVersions','entitlements','reservations','pricingVersions','drgConfigurations','drgCases','journal','outbox','collections'] as const;
export type RcmCollection=typeof RCM_COLLECTIONS[number];

export function parseRcmWorkspace(value:unknown):RcmWorkspace {
 const raw=object(value,'workspace');
 integer(raw.version,'version');
 const currency=string(raw.currency,'currency');
 if(!['AED','USD','EUR','INR'].includes(currency))throw new RcmContractError('currency');
 const capabilities=object(raw.capabilities,'capabilities');
 if(raw.moneyProviderConfigured!==undefined)bool(raw.moneyProviderConfigured,'moneyProviderConfigured');
 if(raw.effectivePayerPolicy!==undefined&&raw.effectivePayerPolicy!==null)string(object(raw.effectivePayerPolicy,'effectivePayerPolicy').id,'effectivePayerPolicy.id');
 for(const key of ['read','claims','finance','configure','approve','export'])bool(capabilities[key],`capabilities.${key}`);
 for(const collection of RCM_COLLECTIONS){
  const ids=new Set<string>();
  array(raw[collection],collection).forEach((item,i)=>{
   const path=`${collection}.${i}`,record=object(item,path),id=string(record.id,`${path}.id`);
   const recordKey=collection==='packageVersions'?string(record.revisionId,`${path}.revisionId`):id;
   if(ids.has(recordKey))throw new RcmContractError(`${path}.id`);ids.add(recordKey);
   if(record.status!==undefined)string(record.status,`${path}.status`);
   for(const key of requiredMoney[collection]??[])integer(record[key],`${path}.${key}`);
   if(collection==='journal'){
    string(record.event,`${path}.event`);
    let debits=0n,credits=0n;
    const entries=array(record.entries,`${path}.entries`);
    if(entries.length<2)throw new RcmContractError(`${path}.entries`);
    entries.forEach((entry,j)=>{
     const line=object(entry,`${path}.entries.${j}`);
     string(line.account,`${path}.entries.${j}.account`);
     debits+=BigInt(integer(line.debitMinor,`${path}.entries.${j}.debitMinor`));
     credits+=BigInt(integer(line.creditMinor,`${path}.entries.${j}.creditMinor`));
    });
    if(debits!==credits)throw new RcmContractError(`${path}.entries.balance`);
   }
  });
 }
 const reports=object(raw.reports,'reports');
 for(const key of ['outstandingMinor','cashMinor','creditsMinor','depositsMinor'])integer(reports[key],`reports.${key}`);
 for(const [name,label,amounts] of [['aging','bucket',['amountMinor']],['trialBalance','account',['debitMinor','creditMinor','balanceMinor']],['payerExposure','payerId',['amountMinor']]] as const){
  array(reports[name],`reports.${name}`).forEach((item,i)=>{
   const row=object(item,`reports.${name}.${i}`);string(row[label],`reports.${name}.${i}.${label}`);
   for(const field of amounts)integer(row[field],`reports.${name}.${i}.${field}`,field==='balanceMinor');
  });
 }
 bool(reports.journalBalanced,'reports.journalBalanced');
 validateMonetary(raw,'workspace');
 return raw as unknown as RcmWorkspace;
}

export function parseRcmCommandResponse(value:unknown):{workspace:RcmWorkspace;result:Record<string,unknown>}{
 const raw=object(value,'command');const workspace=parseRcmWorkspace(raw.workspace);
 if(integer(raw.version,'command.version')!==workspace.version)throw new RcmContractError('command.version');
 const result=object(raw.result,'command.result');validateMonetary(result,'command.result');
 return {workspace,result};
}
