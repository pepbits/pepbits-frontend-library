'use client';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Card,CardGrid,DateInput,LocalizedText,useLocalization} from '@pepbits/ops-ui';
import {useReferenceHost} from '@pepbits/reference-host';
import {ApiError,errorMessage,useApiClient,useApiRuntime} from '../../lib/api';
import {useApi} from '../../lib/hooks';
import {usePageHeader,useSession} from '../../lib/session';
import {useFormat} from '../../lib/format';
import {useCsvExport} from '../../lib/export';
import {parseRcmWorkspace,parseRcmCommandResponse,RcmContractError,type RcmCollection,type RcmRecord,type RcmWorkspace} from '../../lib/rcm-contract';
import {Button,Field,Input,Select,Textarea} from '../ui/controls';
import {DataTable,Pagination,type Column} from '../ui/DataTable';
import {EmptyState,ErrorBanner,KV,Spinner,StatusBadge} from '../ui/display';
import {buildRcmPayload,rcmActionId,RCM_SECTIONS,type RcmAction,type RcmSection} from './definitions';

const COLLECTION_LABELS:Record<RcmCollection,string>={tenantPayerPolicies:'Tenant payer defaults',packageVersions:'Package revisions',reservations:'Entitlement reservations',drgConfigurations:'Demo DRG configurations',payers:'Available payers',payerPolicies:'Branch payer policies',glExports:'Ledger exports',invoices:'Invoices',claims:'Claims',payerSequences:'Payer sequences',exchangeProfiles:'Exchange profiles',exchanges:'Exchange requests',remittances:'Remittances',credits:'Credits',deposits:'Deposits',refunds:'Refunds',packages:'Package definitions',entitlements:'Patient entitlements',pricingVersions:'Pricing revisions',drgCases:'DRG results',journal:'Journal events',outbox:'Audit events',collections:'Collection tasks'};
const FIELD_LABELS:Record<string,string>={
 id:'ID',status:'Status',invoiceId:'Invoice',patientId:'Patient ID',payerId:'Payer ID',payerIds:'Ordered payer IDs',sequenceIndex:'Payer sequence position',
 totalMinor:'Total',paidMinor:'Paid amount',adjustmentMinor:'Adjustment amount',outstandingMinor:'Outstanding',chargeMinor:'Claim amount',deniedMinor:'Denied amount',
 amountMinor:'Amount',availableMinor:'Available amount',reservedMinor:'Reserved amount',clawedBackMinor:'Clawed back amount',claimId:'Claim',reference:'Payment reference',reason:'Reason',
 sourceType:'Source type',sourceId:'Source ID',packageId:'Package',name:'Name',caseRateMinor:'Case rate',excessUnitMinor:'Excess unit charge',entitlementUnits:'Entitlement units',includedUnits:'Included units',usedUnits:'Used units',excessMinor:'Excess charges',
 unitPriceMinor:'Unit price',taxBasisPoints:'Tax basis points',effectiveFrom:'Effective from',version:'Version',createdBy:'Created by',approvedBy:'Approved by',requestedBy:'Requested by',
 adapter:'Grouper adapter',groupCode:'DRG code',allowedMinor:'Allowed amount',diagnosisCodes:'Diagnosis codes',certified:'Certified',event:'Event',entries:'Journal entries',account:'Account',debitMinor:'Debit',creditMinor:'Credit',balanceMinor:'Balance',
 exportedAt:'Exported at',createdAt:'Created at',updatedAt:'Updated at',owner:'Collection owner',dueDate:'Due date',note:'Note',
 profileId:'Exchange profile',wireFormat:'Wire format',payerCode:'Provider payer code',memberId:'Member ID',senderId:'Sender ID',providerId:'Provider ID',providerConfigured:'Provider configured',operations:'Supported operations',operation:'Exchange operation',attempts:'Delivery attempts',lastError:'Delivery error',responseDigest:'Response digest',
 appeals:'Appeal history',appealCount:'Appeal count',history:'History',amount:'Amount',journalId:'Journal event',remittanceId:'Remittance',debitAccount:'Debit account',creditAccount:'Credit account',closedAt:'Closed at',priceId:'Price ID',
 source:'Invoice source',digest:'Source digest',encounterId:'Encounter',importedAt:'Imported at',patientAllocationRemainderMinor:'Patient allocation reconciliation',payerAllocationRemainderMinor:'Payer allocation reconciliation',patientShareMinor:'Patient share',payerShareMinor:'Payer share',lines:'Invoice lines',code:'Service code',quantity:'Quantity',netMinor:'Net',taxMinor:'Tax',pricingVersionId:'Pricing revision',level:'Policy scope',maximumPayers:'Maximum payers',makerId:'Maker',checkerId:'Checker',baseVersion:'Base version',previousHash:'Previous audit hash',hash:'Audit hash',closingNote:'Outcome note',journalIds:'Journal IDs',currency:'Currency',profileVersion:'Profile version',canonicalVersion:'Protocol version',completedAt:'Completed at',response:'Provider response',payments:'Payments',sequenceVersion:'Sequence version',policyVersion:'Policy version',actorId:'Actor ID',submissionId:'Submission ID',payerClaimId:'Provider claim ID',priorPayerClaimId:'Prior provider claim ID',exchangeClaimVersion:'Provider claim version',clawbacks:'Clawback history',
 reservedUnits:'Reserved units',reservationId:'Reservation',entitlementId:'Entitlement',units:'Units',revisionId:'Revision ID',groups:'Diagnosis group rules',prefix:'Diagnosis prefix',weightBasisPoints:'Weight basis points',baseRateMinor:'DRG base rate',configurationId:'DRG configuration',adapterVersion:'Adapter version',providerPaymentRef:'Captured provider payment',providerRef:'Provider reference',requestedMinor:'Requested amount',postedMinor:'Posted amount',patientPaidMinor:'Patient paid',payerPaidMinor:'Payer paid',patientOutstandingMinor:'Patient outstanding',payerOutstandingMinor:'Payer outstanding',patientCreditMinor:'Patient credits',payerCreditMinor:'Payer credits',packageVersion:'Package version',boundary:'Completion boundary',
 inherit:'Inherit tenant defaults',inherited:'Inherited',policySource:'Policy source',tenantVersion:'Tenant policy version',effectivePolicyVersion:'Effective policy version',maximumPayerLevel:'Provider payer-level limit',providerOperationKey:'Provider operation identity',
 revisions:'Claim revisions',replacement:'Replacement',cancelReason:'Cancellation reason',
};
const SUMMARY_LABELS:Record<string,string>={outstandingMinor:'Outstanding receivables',cashMinor:'Cash balance',creditsMinor:'Patient credit liabilities',depositsMinor:'Patient deposit liabilities'};
const recordLabel=(row:RcmRecord)=>String(row.name??row.invoiceNo??row.id)+(row.status?` · ${row.status}`:'');

function RecordFields({row,currency}:{row:Record<string,unknown>;currency:string}){
 const {money,number,fmtDate,fmtDateTime}=useFormat();const {preferences}=useReferenceHost();const {t}=useLocalization();
 function value(key:string,v:unknown):ReactNode {
  if(v===undefined||v===null)return '—';
  if(/Minor$/.test(key)&&typeof v==='number')return <span className="hc-num">{preferences.currencyCode===currency?money(v/100):`${currency} ${number(v/100)}`}</span>;
  if(typeof v==='boolean')return <LocalizedText message={v?'Yes':'No'}/>;
  if(typeof v==='number')return number(key==='sequenceIndex'?v+1:v);
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)&&/Date$|From$|At$/.test(key))return v.length===10?fmtDate(v):fmtDateTime(v);
  if(Array.isArray(v))return v.every(item=>typeof item==='string'||typeof item==='number')?v.map(item=>String(item)).join(' → '):<div className="space-y-2">{v.map((item,i)=>item&&typeof item==='object'?<RecordFields key={i} row={item as Record<string,unknown>} currency={currency}/>:String(item))}</div>;
  if(typeof v==='object')return <RecordFields row={v as Record<string,unknown>} currency={currency}/>;
  return String(v);
 }
 return <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(row).map(([key,v])=><div key={key} className="min-w-0"><dt className="text-hc-2xs text-hc-ink-mute">{t(FIELD_LABELS[key]??key)}</dt><dd className="break-words text-hc-sm">{key==='status'?<StatusBadge status={String(v)}/>:value(key,v)}</dd></div>)}</dl>;
}

function WorkspaceCollection({name,workspace}:{name:RcmCollection;workspace:RcmWorkspace}){
 const {preferences}=useReferenceHost();const {money,number}=useFormat();const {t}=useLocalization();
 const rows=workspace[name];const [page,setPage]=useState(1);const [selected,setSelected]=useState<string|null>(null);
 const identity=(row:RcmRecord)=>String(name==='packageVersions'?row.revisionId:row.id);
 const pageSize=preferences.pageSize;const safePage=Math.min(page,Math.max(1,Math.ceil(rows.length/pageSize)));
 const keys=Array.from(new Set(rows.flatMap(row=>Object.keys(row)))).filter(key=>!['id','status','entries','history','appeals'].includes(key));
 const summaryKeys=keys.filter(key=>['invoiceId','patientId','payerId','name','payerIds','profileId','operation','owner','groupCode','event','sourceType','priceId','status'].includes(key)).slice(0,3);
 const amountKeys=(name==='invoices'?['totalMinor','outstandingMinor','patientOutstandingMinor','payerOutstandingMinor'].filter(key=>keys.includes(key)):keys.filter(key=>/Minor$/.test(key))).slice(0,4);
 const columns:Column<RcmRecord>[]=[{key:'id',header:<LocalizedText message="ID"/>,render:row=><Button size="xs" variant="ghost" onClick={()=>setSelected(selected===identity(row)?null:identity(row))} aria-expanded={selected===identity(row)}>{identity(row)}</Button>},
  ...summaryKeys.map(key=>({key,header:<LocalizedText message={FIELD_LABELS[key]??key}/>,render:(row:RcmRecord)=>Array.isArray(row[key])?(row[key] as string[]).join(' → '):String(row[key]??'—')})),
  ...amountKeys.map(key=>({key,header:<LocalizedText message={FIELD_LABELS[key]??key}/>,align:'right' as const,render:(row:RcmRecord)=>typeof row[key]==='number'?(preferences.currencyCode===workspace.currency?money((row[key] as number)/100):`${workspace.currency} ${number((row[key] as number)/100)}`):'—'})),
  ...(keys.includes('status')||rows.some(row=>row.status)?[{key:'status',header:<LocalizedText message="Status"/>,render:(row:RcmRecord)=><StatusBadge status={row.status??''}/>}]:[]),
 ];
 const selectedRow=rows.find(row=>identity(row)===selected);
 return <Card className="min-w-0 overflow-hidden"><div className="flex items-center justify-between border-b border-hc-line p-3"><h2 className="text-hc-sm font-semibold">{t(COLLECTION_LABELS[name])}</h2><span className="hc-num text-hc-xs">{number(rows.length)}</span></div>
  <DataTable columns={columns} rows={rows.slice((safePage-1)*pageSize,safePage*pageSize)} rowKey={identity} empty={<EmptyState title="No records yet" body="Use the available actions to create or update this workflow."/>}/>
  {rows.length>0&&<Pagination page={safePage} pageSize={pageSize} total={rows.length} onPage={setPage}/>}
  {selectedRow&&<div className="space-y-3 border-t border-hc-line p-3"><div className="flex justify-between"><p className="text-hc-xs font-semibold"><LocalizedText message="Record details"/></p><Button size="xs" onClick={()=>setSelected(null)}><LocalizedText message="Close details"/></Button></div><RecordFields row={selectedRow} currency={workspace.currency}/></div>}
 </Card>;
}

function Reports({workspace}:{workspace:RcmWorkspace}){
 const {money,number}=useFormat();const {preferences}=useReferenceHost();const reports=workspace.reports;
 const amount=(minor:number)=>preferences.currencyCode===workspace.currency?money(minor/100):`${workspace.currency} ${number(minor/100)}`;
 return <div className="space-y-3"><CardGrid columns="auto">{Object.entries(SUMMARY_LABELS).map(([key,label])=><Card key={key} className="p-3"><KV label={label}><span className="hc-num font-semibold">{amount(reports[key] as number)}</span></KV></Card>)}</CardGrid>
  <Card className="p-3"><p className="text-hc-sm"><LocalizedText message={reports.journalBalanced?'Journal is balanced':'Journal is out of balance'}/></p></Card>
  <Card><h2 className="p-3 text-hc-sm font-semibold"><LocalizedText message="Receivables aging"/></h2><DataTable rows={reports.aging} rowKey={row=>row.bucket} columns={[{key:'bucket',header:<LocalizedText message="Aging bucket"/>},{key:'amountMinor',header:<LocalizedText message="Outstanding"/>,align:'right',render:row=>amount(row.amountMinor)}]} empty={<EmptyState title="No aging balances"/>}/></Card>
  <Card><h2 className="p-3 text-hc-sm font-semibold"><LocalizedText message="Trial balance"/></h2><DataTable rows={reports.trialBalance} rowKey={row=>row.account} columns={[{key:'account',header:<LocalizedText message="Account"/>},...(['debitMinor','creditMinor','balanceMinor'] as const).map(key=>({key,header:<LocalizedText message={FIELD_LABELS[key]}/>,align:'right' as const,render:(row:RcmWorkspace['reports']['trialBalance'][number])=>amount(row[key])}))]} empty={<EmptyState title="No ledger balances"/>}/></Card>
  <Card><h2 className="p-3 text-hc-sm font-semibold"><LocalizedText message="Payer exposure"/></h2><DataTable rows={reports.payerExposure} rowKey={row=>row.payerId} columns={[{key:'payerId',header:<LocalizedText message="Payer ID"/>},{key:'amountMinor',header:<LocalizedText message="Outstanding"/>,render:row=>amount(row.amountMinor)}]} empty={<EmptyState title="No payer exposure"/>}/></Card>
 </div>;
}

function CommandForm({action,workspace,onUpdated,onReload,refreshing,onBusy}:{action:RcmAction;workspace:RcmWorkspace;onUpdated:(workspace:RcmWorkspace)=>void;onReload:()=>void;refreshing:boolean;onBusy:(busy:boolean)=>void}){
 const api=useApiClient();const {t}=useLocalization();const csv=useCsvExport();
 const {scope}=useReferenceHost();
 const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(action.fields.map(field=>[field.key,field.defaultValue??''])));
 const [errors,setErrors]=useState<Record<string,string>>({});const [error,setError]=useState<string|null>(null);const [saving,setSaving]=useState(false);const [done,setDone]=useState(false);const [conflict,setConflict]=useState(false);
 const [result,setResult]=useState<Record<string,unknown>|null>(null);
 const pending=useRef<{fingerprint:string;operationId:string}|null>(null);const live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;onBusy(false);};},[onBusy]);
 useEffect(()=>{setConflict(false);},[workspace.version]);
 const allowed=workspace.capabilities[action.capability]&&(!action.additionalCapability||workspace.capabilities[action.additionalCapability]);
 const approvalRow=action.kind==='approve-pricing'?workspace.pricingVersions.find(row=>row.id===values.pricingVersionId):action.kind==='approve-refund'?workspace.refunds.find(row=>row.id===values.refundId):null;
 const selfApproval=!!approvalRow&&approvalRow.makerId===scope.userId;
 const exchangeProfile=action.kind==='queue-exchange'?workspace.exchangeProfiles.find(row=>row.id===values.profileId):action.kind==='dispatch-exchange'?workspace.exchangeProfiles.find(row=>row.id===workspace.exchanges.find(exchange=>exchange.id===values.exchangeId)?.profileId):null;
 const providerUnavailable=!!exchangeProfile&&exchangeProfile.providerConfigured!==true||action.requiresMoneyProvider===true&&workspace.moneyProviderConfigured!==true;
 const selectedClaim=action.kind==='queue-exchange'?workspace.claims.find(row=>row.id===values.claimId):null;
 const payerLevelUnsupported=!!selectedClaim&&!!exchangeProfile&&typeof selectedClaim.sequenceIndex==='number'&&typeof exchangeProfile.maximumPayerLevel==='number'&&selectedClaim.sequenceIndex>=exchangeProfile.maximumPayerLevel;
 const currencyUnsupported=action.kind==='queue-exchange'&&!['AED','USD','EUR','INR'].includes(workspace.currency);
 const refundRow=action.kind==='pay-refund'?workspace.refunds.find(row=>row.id===values.refundId):null;
 const refundSource=refundRow?.sourceType==='deposits'?workspace.deposits.find(row=>row.id===refundRow.sourceId):refundRow?.sourceType==='credits'?workspace.credits.find(row=>row.id===refundRow.sourceId):null;
 const refundUnfunded=!!refundRow&&!refundSource?.providerPaymentRef;
 const cancelledRefund=action.kind==='cancel-refund'?workspace.refunds.find(row=>row.id===values.refundId):null;
 const cancellationBlocked=!!cancelledRefund&&(!['Requested','Approved'].includes(cancelledRefund.status??'')||!!cancelledRefund.providerRef);
 const cancelledExchange=action.kind==='cancel-exchange'?workspace.exchanges.find(row=>row.id===values.exchangeId):null;
 const exchangeCancellationBlocked=!!cancelledExchange&&(cancelledExchange.status!=='Queued'||cancelledExchange.attempts!==0);
 const replacementClaim=action.kind==='replace-claim'?workspace.claims.find(row=>row.id===values.claimId):null;
 const replacementInvoice=replacementClaim?workspace.invoices.find(row=>row.id===replacementClaim.invoiceId):null;
 const claimReplacementBlocked=!!replacementClaim&&(!['Submitted','Denied','Rejected','Settled'].includes(replacementClaim.status??'')||!replacementInvoice||typeof replacementInvoice.payerOutstandingMinor!=='number'||replacementInvoice.payerOutstandingMinor===0||workspace.claims.some(row=>row.invoiceId===replacementClaim.invoiceId&&typeof row.sequenceIndex==='number'&&typeof replacementClaim.sequenceIndex==='number'&&row.sequenceIndex>replacementClaim.sequenceIndex));
 async function submit(){
  if(saving||!allowed||conflict||refreshing||selfApproval||providerUnavailable||payerLevelUnsupported||currencyUnsupported||refundUnfunded||cancellationBlocked||exchangeCancellationBlocked||claimReplacementBlocked)return;
  setError(null);setErrors({});setDone(false);
  let payload:Record<string,unknown>;try{payload=buildRcmPayload(action,values);}catch(e){setError(errorMessage(e));return;}
  const body={kind:action.kind,expectedVersion:workspace.version,currency:workspace.currency,...payload};
  const fingerprint=JSON.stringify(body);
  if(!pending.current||pending.current.fingerprint!==fingerprint)pending.current={fingerprint,operationId:crypto.randomUUID()};
  const operationId=pending.current.operationId;setSaving(true);onBusy(true);
  try{
   const response=await api<unknown>('/rcm/commands',{method:'POST',operationId,body:{...body,idempotencyKey:operationId}});
   const parsed=parseRcmCommandResponse(response),updated=parsed.workspace;
   if(!live.current)return;
   pending.current=null;onUpdated(updated);setDone(true);setResult(parsed.result);
   if(action.kind==='export-gl'){
    // The persisted export is authoritative. CSV output honors effective export policy.
    const exportedIds=new Set(Array.isArray(parsed.result.journalIds)?parsed.result.journalIds:[]);
    const entries=updated.journal.filter(event=>exportedIds.has(event.id)).flatMap(event=>event.entries.map(entry=>[event.id,event.event,entry.account,entry.debitMinor,entry.creditMinor]));
    if(!csv.disabled)csv.downloadCsv('rcm-general-ledger.csv',[t('Journal ID'),t('Event'),t('Account'),t('Debit minor units'),t('Credit minor units')],entries);
   }
  }catch(e){
   if(!live.current)return;
   if(e instanceof ApiError){setErrors(e.fields);if(e.status===409&&(Object.hasOwn(e.fields,'currentVersion')||/workspace (?:version|changed)/i.test(e.message))){setConflict(true);setError(t('The workspace changed. Reload and review the latest balances before retrying.'));}else setError(e.message);}
   else setError(e instanceof RcmContractError?t('The RCM service returned invalid data at {path}.',{path:e.path}):errorMessage(e));
  }finally{if(live.current){setSaving(false);onBusy(false);}}
 }
 return <Card className="space-y-3 p-3"><h2 className="text-hc-sm font-semibold">{t(action.label)}</h2>
  {action.help&&<p className="text-hc-xs text-hc-ink-mute">{t(action.help)}</p>}
  {!allowed&&<p role="status" className="text-hc-xs text-hc-ink-mute"><LocalizedText message="Your role cannot perform this action."/></p>}
  <form className="space-y-3" onSubmit={event=>{event.preventDefault();void submit();}}>
   <div className="grid gap-3 sm:grid-cols-2">{action.fields.map(field=>{
    const options=field.source?(workspace[field.source] as RcmRecord[]).map(row=>({value:row.id,label:recordLabel(row)})):field.options??[];
    const props={value:values[field.key]??'',disabled:!allowed||saving||refreshing,invalid:!!errors[field.key]};
    if(field.type==='date')return <DateInput key={field.key} label={field.label} required={!field.optional} error={errors[field.key]} hint={field.hint} value={props.value} disabled={props.disabled} onChange={event=>{setValues(v=>({...v,[field.key]:event.target.value}));setDone(false);}}/>;
    return <Field key={field.key} label={field.label} required={!field.optional} error={errors[field.key]} hint={field.type==='money'?t('Amount in {currency}; up to two decimal places.',{currency:workspace.currency}):field.hint} className={field.type==='textarea'||field.type==='group-rules'?'sm:col-span-2':undefined}>
     {field.type==='choice'?<Select {...props} options={options} placeholder="Select" onChange={value=>{setValues(v=>({...v,[field.key]:value}));setDone(false);}}/>
      :field.type==='textarea'||field.type==='group-rules'?<Textarea {...props} rows={field.type==='group-rules'?5:3} onChange={event=>{setValues(v=>({...v,[field.key]:event.target.value}));setDone(false);}}/>
      :<Input {...props} type="text" inputMode={field.type==='money'?'decimal':field.type==='integer'?'numeric':undefined} onChange={event=>{setValues(v=>({...v,[field.key]:event.target.value}));setDone(false);}}/>}
    </Field>;
   })}</div>
   {error&&<ErrorBanner message={error}/>}
   {selfApproval&&<p role="status" className="text-hc-xs text-hc-ink-mute"><LocalizedText message="A different authorized checker must approve your proposal."/></p>}
   {providerUnavailable&&<p role="status" className="text-hc-xs text-hc-ink-mute"><LocalizedText message={action.requiresMoneyProvider?'Configure the money provider on the server before this action.':'Configure the provider on the server before submitting or dispatching exchange requests.'}/></p>}
   {payerLevelUnsupported&&<p role="status" className="text-hc-xs text-hc-ink-mute"><LocalizedText message="This payer position exceeds the configured provider limit. Increase the verified provider limit on the server before submission."/></p>}
   {currencyUnsupported&&<p role="status" className="text-hc-xs text-hc-ink-mute"><LocalizedText message="MockIns exchange supports AED, USD, EUR and INR. Currency conversion is not performed."/></p>}
   {refundUnfunded&&<p role="status" className="text-hc-xs text-hc-ink-mute"><LocalizedText message="The refund source needs a captured provider payment before payout."/></p>}
   {cancellationBlocked&&<p role="status" className="text-hc-xs text-hc-ink-mute"><LocalizedText message="A submitted or completed refund cannot release reserved funds. Reconcile the provider first."/></p>}
   {exchangeCancellationBlocked&&<p role="status" className="text-hc-xs text-hc-ink-mute"><LocalizedText message="Only an unsent queued exchange can be cancelled. Reconcile uncertain provider outcomes."/></p>}
   {claimReplacementBlocked&&<p role="status" className="text-hc-xs text-hc-ink-mute"><LocalizedText message="Resolve the current submission and any later payer before replacing a claim with remaining payer liability."/></p>}
   {conflict&&<Button type="button" onClick={()=>{pending.current=null;onReload();}}><LocalizedText message="Reload latest workspace"/></Button>}
   {done&&<p role="status" className="text-hc-xs text-hc-ok-700"><LocalizedText message="Command completed. The latest workspace is shown."/></p>}
   {done&&result&&<div className="border-t border-hc-line pt-3"><p className="mb-2 text-hc-xs font-semibold"><LocalizedText message="Command result"/></p><RecordFields row={result} currency={workspace.currency}/></div>}
   {action.kind==='export-gl'&&csv.disabled&&<p className="text-hc-xs text-hc-ink-mute"><LocalizedText message="The ledger export is recorded. CSV download requires an allowed CSV export preference."/></p>}
   <Button type="submit" variant="primary" loading={saving} disabled={!allowed||saving||conflict||refreshing||selfApproval||providerUnavailable||payerLevelUnsupported||currencyUnsupported||refundUnfunded||cancellationBlocked||exchangeCancellationBlocked||claimReplacementBlocked}>{t(action.label)}</Button>
  </form>
 </Card>;
}

export function HealthcareSuiteRcmWorkspace({section}:{section:string}){
 const {session}=useSession();const definition=RCM_SECTIONS[section as RcmSection];const query=useApi<unknown>(definition&&session?'/rcm/workspace':null);const {t}=useLocalization();
 const {scopeKey,facilityId}=useApiRuntime();const [actionKind,setActionKind]=useState('');const [commandBusy,setCommandBusy]=useState(false);
 usePageHeader(definition?.title??'Revenue cycle management');
 const parsed=useMemo(()=>{if(!query.data)return {workspace:null,error:null};try{return {workspace:parseRcmWorkspace(query.data),error:null};}catch(e){return {workspace:null,error:e instanceof RcmContractError?t('The RCM service returned invalid data at {path}.',{path:e.path}):errorMessage(e)};}},[query.data,t]);
 const workspace=parsed.workspace;
 const selectedAction=definition?.actions.find(action=>rcmActionId(action)===actionKind)??definition?.actions[0];
 if(!definition)return <EmptyState title="Unknown RCM workspace"/>;
 if(parsed.error||query.error&&!workspace)return <ErrorBanner message={query.error?.message??parsed.error!} onRetry={query.reload}/>;
 if((query.loading||!session)&&!workspace)return <div className="p-4"><Spinner label={t('Loading RCM workspace')}/></div>;
 if(!workspace)return <EmptyState title="RCM workspace unavailable" action={<Button onClick={query.reload}><LocalizedText message="Try again"/></Button>}/>;
 if(!workspace.capabilities.read)return <ErrorBanner message="Your role cannot view revenue cycle management."/>;
 return <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3" data-rcm-section={section}>
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-hc-lg font-semibold">{t(definition.title)}</h1><p className="max-w-3xl text-hc-xs text-hc-ink-mute">{t(definition.description)}</p></div><Button disabled={commandBusy} onClick={query.reload}><LocalizedText message="Refresh workspace"/></Button></div>
  <p className="text-hc-xs text-hc-ink-mute"><LocalizedText message="Workspace version {version} · Currency {currency}" values={{version:workspace.version,currency:workspace.currency}}/></p>
  <p className="text-hc-xs text-hc-ink-mute"><LocalizedText message="Durable synthetic demo; MockIns and demo-v1 DRG only."/></p>
  {query.error&&<ErrorBanner message={query.error.message} onRetry={query.reload}/>}
  {query.loading&&<Spinner label={t('Refreshing RCM workspace')}/>}
  {section==='exchange'&&<Card className="p-3"><p className="text-hc-xs"><LocalizedText message="Provider endpoints and credentials are configured by the server. Delivery success is a transport acknowledgment; payer adjudication and payment are separate events."/></p></Card>}
  {section==='claims'&&workspace.effectivePayerPolicy&&typeof workspace.effectivePayerPolicy==='object'&&<Card className="space-y-3 p-3"><h2 className="text-hc-sm font-semibold"><LocalizedText message="Effective payer policy"/></h2><RecordFields row={workspace.effectivePayerPolicy as Record<string,unknown>} currency={workspace.currency}/></Card>}
  {(section==='accounting'||section==='receivables')&&<Reports workspace={workspace}/>}
  <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]"><div className="space-y-3 min-w-0">{definition.collections.map(name=><WorkspaceCollection key={name as string} name={name as RcmCollection} workspace={workspace}/>)}</div>
   <div className="space-y-3"><Field label="Workflow action"><Select disabled={commandBusy} value={rcmActionId(selectedAction)} options={definition.actions.map(action=>({value:rcmActionId(action),label:t(action.label)}))} onChange={setActionKind}/></Field>
    <CommandForm key={`${scopeKey}:${facilityId}:${section}:${rcmActionId(selectedAction)}`} action={selectedAction} workspace={workspace} onUpdated={query.setData} onReload={query.reload} refreshing={query.loading||!!query.error} onBusy={setCommandBusy}/>
   </div>
  </div>
 </div>;
}
