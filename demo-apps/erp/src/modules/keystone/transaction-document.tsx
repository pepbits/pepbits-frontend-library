import React,{useEffect,useId,useRef,useState} from 'react';
import {RecordPage,type RecordPageAction} from '@pepbits/page-engines/record-page';
import {TemplateFields,TabularFieldRows,type FieldRow} from '@pepbits/page-engines/templates';
import {Card,DescriptionList,RecoveryNotice,failureFromError} from '@pepbits/components';
import {Button,Input,StatusBadge,Textarea} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {englishNumberWords} from '@pepbits/i18n';
import {usePreferences} from '@pepbits/preferences/react';
import {useScreenHost,useFormatters} from '@pepbits/patterns/screen-host';
import {useUnsavedWarning} from '@pepbits/patterns/drafts';
import {useNavigation} from '@pepbits/platform/navigation';
import {useEntityApi,useFetch,useNeighbours,listUrl} from './client';
import {useKeystone} from './context';
import {RecordSupport} from './record-panels';
import {templateField,useValueFormat} from './fields';
import {localDay} from './dates';
import {blankDocumentLine,computeDocumentLines,documentFlow,documentSeed,documentTotals} from './transaction-document-model';
import type {Field,ListResponse,PageDef,Row} from './types';
import {pageId,type ErpTarget} from '../../navigation';
import {PAGES,nounOf} from './catalog';
import './transaction-document.css';

const transitionLabel:Record<string,string>={Submitted:'Submit',Approved:'Approve',Delivered:'Mark delivered',Received:'Mark received',Paid:'Record payment',Posted:'Post',Unpaid:'Issue invoice',Inspected:'Mark inspected'};
function DocumentReference({field,value,disabled,error,onChange}:{field:Field;value:unknown;disabled:boolean;error?:string;onChange:(value:string)=>void}) {
  const id=useId(),{t}=useLocalization(),options=useFetch<ListResponse>(field.ref?listUrl(field.ref,{size:5000}):null);
  return <div><Input label={field.label} required={field.required} error={error} aria-label={field.label} value={String(value??'')} disabled={disabled} list={id} onChange={event=>onChange(event.target.value)}/><datalist id={id}>{(field.pool??options.data?.rows.map(row=>String(row.name??row.code??row.id))??[]).map(value=><option key={value} value={value}/>)}</datalist>{options.error&&<Button size="sm" onClick={options.reload}>{t('Retry')}</Button>}</div>;
}
function DocumentPanel({title,children}:{title:string;children:React.ReactNode}) {
  const {t}=useLocalization();return <Card className="erp-document-panel"><h3>{t(title)}</h3><div>{children}</div></Card>;
}
export function TransactionDocument({def,target,initial,onClose,onOpen,onSaved,onReload}:{def:PageDef;target:ErpTarget;initial:Row;onClose:()=>void;onOpen:(target:ErpTarget)=>void;onSaved:(row:Row)=>void;onReload:()=>void}) {
  const {variant}=useKeystone(),{t}=useLocalization(),{preferences}=usePreferences(),host=useScreenHost(),format=useFormatters(),valueFormat=useValueFormat(),api=useEntityApi(),navigation=useNavigation();
  const creating=target.mode==='new',voucher=def.template==='voucher';
  const [draft,setDraft]=useState<Row>(()=>creating?documentSeed(def,variant,localDay(),new URLSearchParams(target.query).has('copy')?initial:undefined):initial);
  const [busy,setBusy]=useState(false),[failure,setFailure]=useState<unknown>(),[validation,setValidation]=useState(''),[errors,setErrors]=useState<Record<string,string>>({});
  const flow=documentFlow(def,draft),editing=!flow.done&&(variant==='erp1'||creating||target.mode==='edit')&&host.can(creating?'create':'edit'),lines=(draft.lines??[]) as Record<string,unknown>[],totals=documentTotals(def,lines);
  const lineIds=useRef<string[]>(lines.map(()=>crypto.randomUUID()));
  const live=useRef(true),saving=useRef(false),access=useRef(host),retry=useRef<Partial<Row>>({}),pending=useRef<{signature:string;operationId:string}|undefined>(undefined);access.current=host;
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  const clean=useRef(JSON.stringify(draft));useUnsavedWarning(editing&&JSON.stringify(draft)!==clean.current);
  const neighbours=useNeighbours(def.slug,draft.id),headerFields=def.fields.filter(field=>!['code','status','total','narration'].includes(field.key));
  const set=(key:string,value:unknown)=>{if(editing&&!busy)setDraft(row=>({...row,[key]:value}));};
  const save=async(patch:Partial<Row>={})=>{
    if(saving.current||flow.done||!access.current.can(creating?'create':'edit')||(failure as {status?:number})?.status===409||(!editing&&!patch.status))return;
    if(patch.status&&patch.status!==flow.next&&patch.status!=='Cancelled')return;
    const missing=def.fields.filter(field=>field.required&&!field.readOnly&&(draft[field.key]===''||draft[field.key]==null));
    setErrors(Object.fromEntries(missing.map(field=>[field.key,t('is required')])));
    if(missing.length){setValidation(t('{value0} is required',{value0:t(missing[0]!.label)}));return;}
    if(!lines.length){setValidation(t('Add at least one line before saving'));return;}
    if(patch.status&&voucher&&!totals.balanced&&(variant==='erp1'||patch.status!=='Cancelled')){setValidation(t('Debits and credits must match before posting'));return;}
    const body={...draft,...patch,total:totals.total},signature=JSON.stringify(body);retry.current=patch;
    if(pending.current?.signature!==signature)pending.current={signature,operationId:crypto.randomUUID()};
    saving.current=true;setBusy(true);setFailure(undefined);setValidation('');
    try {
      const payload={...body,operationId:pending.current.operationId,...(!creating&&typeof draft.version==='number'?{expectedVersion:draft.version}:{})};
      const saved=creating?await api.create(def.entity,payload):await api.update(def.entity,draft.id,payload);
      if(!live.current)return;pending.current=undefined;clean.current=JSON.stringify(saved);setDraft(saved);host.notify(t('Changes saved'),{tone:'success'});onSaved(saved);
    } catch(error) {if(live.current){setFailure(error);const status=(error as {status?:number}).status;if(status&&status<500)pending.current=undefined;}}
    finally {saving.current=false;if(live.current)setBusy(false);}
  };
  const saveRef=useRef(save);saveRef.current=save;
  useEffect(()=>{if(!editing||!preferences.keyboardShortcuts)return;const key=(event:KeyboardEvent)=>{if(event.altKey&&event.key.toLowerCase()==='s'){event.preventDefault();void saveRef.current();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[editing,preferences.keyboardShortcuts]);
  const actions:RecordPageAction[]=[
    {id:'back',label:'Back',onClick:onClose,disabled:busy},
    {id:'previous',label:'Previous record',onClick:()=>onOpen({...target,recordId:neighbours.prev!,mode:'view'}),disabled:busy||!neighbours.prev,hidden:variant==='erp1'||creating},
    {id:'next',label:'Next record',onClick:()=>onOpen({...target,recordId:neighbours.next!,mode:'view'}),disabled:busy||!neighbours.next,hidden:variant==='erp1'||creating},
    {id:'print',label:'Print preview',onClick:()=>navigation.open({pageId:pageId(variant,PAGES.find(page=>page.slug==='invoice-print')!),...(variant==='erp2'?{recordId:draft.id,mode:'view' as const}:{})}),hidden:creating||def.slug!=='sales-invoices',disabled:busy},
    {id:'copy',label:'Copy to new',onClick:()=>onOpen({pageId:target.pageId,mode:'new',query:'copy='+encodeURIComponent(draft.id)}),hidden:creating||!host.can('create'),disabled:busy},
    {id:'cancel',label:'Cancel',onClick:()=>void save({status:'Cancelled'}),hidden:creating||flow.done||variant==='erp2'&&editing||!host.can('edit'),disabled:busy},
    {id:'cancel-edit',label:'Cancel',onClick:()=>creating?onClose():onOpen({...target,mode:'view'}),hidden:variant!=='erp2'||!editing,disabled:busy},
    {id:'edit',label:'Edit',onClick:()=>onOpen({...target,mode:'edit'}),hidden:editing||flow.done||!host.can('edit'),disabled:busy},
    {id:'save',label:creating?'Save draft':'Save',onClick:()=>void save(),hidden:!editing,disabled:busy,primary:variant==='erp2'},
    {id:'advance',label:transitionLabel[flow.next??'']??'Next',onClick:()=>void save({status:flow.next}),hidden:!flow.next||!host.can(creating?'create':'edit')||(variant==='erp2'&&editing),disabled:busy||voucher&&!totals.balanced,primary:true}
  ];
  const cents=Math.round(Math.abs(totals.total)*100),words=`${englishNumberWords(Math.floor(cents/100))} ${preferences.currencyCode==='USD'?'Dollars':preferences.currencyCode}${cents%100?' and '+englishNumberWords(cents%100)+' Cents':''} only`;
  const summary=<><DocumentPanel title={voucher?'Balance check':'Summary'}><dl className="erp-document-totals">{(voucher?[['Total debit',totals.debit],['Total credit',totals.credit],['Difference',Math.abs(totals.difference)]]:[['Subtotal',totals.subtotal],...(totals.tax?[['Tax',totals.tax]]:[]),['Total',totals.total]]).map(([label,value],index,array)=><div key={label} data-total={index===array.length-1||undefined}><dt>{t(String(label))}</dt><dd>{format.money(Number(value))}</dd></div>)}</dl>{voucher?<p className="erp-document-balance" data-balanced={totals.balanced}>{t(totals.balanced?'Balanced. Ready to post.':totals.debit===0?'Enter debit and credit lines.':'Debits and credits must match before posting')}</p>:<p className="erp-document-words" lang="en">{words}</p>}</DocumentPanel>
    {def.fields.some(field=>field.key==='narration')&&<DocumentPanel title="Narration">{editing?<Textarea aria-label={t('Narration')} value={String(draft.narration??'')} disabled={busy} onChange={event=>set('narration',event.target.value)} rows={3}/>:<p>{String(draft.narration||t('No narration'))}</p>}</DocumentPanel>}
    <DocumentPanel title="History">{creating?<p>{t('History appears after saving this document.')}</p>:<RecordSupport entity={def.entity} id={draft.id} revision={draft.version} kind="activity"/>}</DocumentPanel>
    {!creating&&<details className="erp-document-files"><summary>{t('Documents')}</summary><RecordSupport entity={def.entity} id={draft.id} revision={draft.version} kind="documents"/></details>}</>;
  const status=<div className="erp-document-status" data-document-status>{variant==='erp2'&&<StatusBadge value={flow.status}/>}<ol aria-label={t('Status')}>{flow.flow.map((step,index)=><li key={step} aria-current={!flow.done&&index===flow.index?'step':undefined} data-complete={!flow.terminal&&(index<flow.index||flow.done)||undefined} data-failed={flow.terminal&&index===flow.index||undefined}><span aria-hidden="true">{!flow.terminal&&(index<flow.index||flow.done)?'✓':index+1}</span>{t(step)}</li>)}</ol>{variant==='erp2'&&<div><small>{t('Total')}</small><strong>{format.money(totals.total)}</strong></div>}</div>;
  const fields=editing?<TemplateFields section={{id:'document-header',title:'Header',fields:headerFields.map(templateField)}} values={draft} errors={errors} disabled={busy} onChange={set} renderField={field=>{const original=headerFields.find(item=>item.key===field.id)!;return original.ref||original.pool?<DocumentReference field={original} value={draft[original.key]} disabled={busy} error={errors[original.key]} onChange={value=>set(original.key,value)}/>:undefined;}}/>:<Card className="erp-document-header-values"><h3>{t('Header')}</h3><DescriptionList layout="stacked" className="erp-document-field-grid" termClassName="erp-field-label" valueClassName="erp-field-value" items={headerFields.map(field=>({id:field.key,label:field.label,value:valueFormat(field,draft[field.key])}))}/></Card>;
  const table=<TabularFieldRows title={def.lines!.label??(voucher?'Entries':'Items')} columns={def.lines!.fields.map(field=>({...templateField(field),readOnly:field.readOnly,suggestions:field.pool,numeric:['number','currency','percent'].includes(field.type),width:['number','currency','percent'].includes(field.type)?112:undefined,minWidth:field.pool?200:['number','currency','percent'].includes(field.type)?undefined:110}))} rows={lines.map((values,index)=>({id:lineIds.current[index]??(lineIds.current[index]=crypto.randomUUID()),values:values as FieldRow['values']}))} createRow={()=>({id:crypto.randomUUID(),values:blankDocumentLine(def.lines!.fields)})} readOnly={!editing} disabled={busy} onChange={rows=>{if(!editing||busy)return;const previous=rows.map(row=>{const index=lineIds.current.indexOf(row.id);return index<0?{}:lines[index]!;});lineIds.current=rows.map(row=>row.id);set('lines',computeDocumentLines(def,previous,rows.map(row=>row.values)));}} formatValue={(column,value)=>voucher&&column.numeric&&!Number(value)?'':valueFormat(def.lines!.fields.find(field=>field.key===column.id)!,value)} totals={Object.fromEntries(def.lines!.fields.map((field,index)=>[field.key,index===0?t('Total'):voucher&&field.key==='debit'?format.money(totals.debit):voucher&&field.key==='credit'?format.money(totals.credit):field.key==='amount'?format.money(totals.subtotal):field.key==='qty'?format.number(lines.reduce((sum,line)=>sum+Number(line.qty||0),0)):'']))}/>;
  return <div data-erp-record data-erp-record-version={draft.version} data-transaction-document={variant} data-density={preferences.density} data-document-kind={voucher?'voucher':'document'} className="erp-transaction-document"><h2 className="sr-only">{t(creating?'New record':'Record details')}</h2><RecordPage appearance="plain" asideWidth={variant==='erp1'?300:320} sections={[{id:'document',title:'Document',heading:'Document'}]} active="document" onActive={()=>{}} isDone={()=>false} showCompletion={false} identity={<div className="erp-document-header-start"><div className="erp-document-identity"><div><strong>{creating?t('New')+' '+t(nounOf(def)):draft.code}</strong>{variant==='erp1'&&<StatusBadge value={flow.status}/>}</div><small>{creating?t('Number is assigned when you save'):format.date(draft.date)}</small></div>{variant==='erp1'&&status}</div>} actions={actions} summary={variant==='erp2'?status:undefined} aside={summary} feedback={<>{validation&&<p role="alert">{validation}</p>}{failure&&<RecoveryNotice failure={failureFromError(failure)} onRetry={(failure as {status?:number}).status===409?undefined:()=>void save(retry.current)}/>} {(failure as {status?:number})?.status===409&&<Button onClick={onReload}>{t('Reload')}</Button>}</>} renderSection={()=> <div className="erp-document-main">{fields}{table}</div>}/></div>;
}
