import {useEffect,useRef,useState,type ReactNode} from 'react';
import {TemplateFields} from '@pepbits/page-engines/templates';
import {RecordPage} from '@pepbits/page-engines/record-page';
import {Card,Drawer,Modal,ProgressBar,RecoveryNotice,failureFromError} from '@pepbits/components';
import {Avatar,Button,StatusBadge,Textarea} from '@pepbits/ui';
import {Check,XCircle,Send,Undo2,X} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useFormatters,useScreenHost} from '@pepbits/patterns/screen-host';
import {useUnsavedWarning} from '@pepbits/patterns/drafts';
import {useKeystone} from './context';
import {useEntityApi,useNeighbours} from './client';
import {Fields,templateField} from './fields';
import {nounOf} from './catalog';
import type {PageDef,Row} from './types';
import type {ErpTarget} from '../../navigation';
import './transaction-request.css';

/** Date-only arithmetic avoids DST changing an inclusive leave duration. */
export function requestDays(from:unknown,to:unknown) {
  const parse=(value:unknown)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return NaN;const stamp=Date.parse(value+'T00:00:00Z');return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?stamp:NaN;};
  const start=parse(from),end=parse(to);
  return Number.isFinite(start)&&Number.isFinite(end)?Math.max(0,Math.round((end-start)/86400000)+1):0;
}
export function requestTrail(steps:string[],status:string) {
  return steps.map((_,index)=>status==='Paid'?'done':status==='Approved'?steps.length>3&&index===steps.length-1?'current':'done':status==='Rejected'?index===0?'done':index===1?'rejected':'waiting':status==='Withdrawn'?index===0?'withdrawn':'waiting':index===0?'done':index===1?'current':'waiting');
}
export function RequestBalances({def,row,compact=false}:{def:PageDef;row?:Row;compact?:boolean}) {
  const {t}=useLocalization(),format=useFormatters(),money=(def.balances?.[0]?.total??0)>100,number=(value:number)=>money?format.money(value):format.number(value);
  return <div className="erp-request-balances" data-compact={compact||undefined}>{def.balances?.map(balance=>{
    const percent=balance.total?balance.used/balance.total*100:0,selected=row?.leaveType===balance.label||row?.category===balance.label.replace(' budget','');
    return <div key={balance.label} data-selected={selected||undefined}>
      <div className="erp-request-balance-label"><span>{t(balance.label)}</span><span>{compact?`${number(balance.total-balance.used)} ${t('left')}`:`${number(balance.used)} ${t('used')}`}</span></div>
      {!compact&&<div className="erp-request-balance-value">{number(balance.total-balance.used)} <span>{t('left of')} {number(balance.total)}</span></div>}
      <ProgressBar value={percent} label={balance.label} tone={percent>80?'danger':percent>55?'warning':'primary'}/>
    </div>;
  })}</div>;
}
function RequestPanel({title,children}:{title:string;children:ReactNode}) {
  const {t}=useLocalization();return <Card className="erp-request-panel"><h3>{t(title)}</h3><div>{children}</div></Card>;
}
function Trail({def,row,editing}:{def:PageDef;row:Row;editing:boolean}) {
  const {t}=useLocalization(),format=useFormatters(),states=requestTrail(def.steps??[],String(row.status)),labels={done:'Done',current:'Waiting now',rejected:'Rejected',withdrawn:'Withdrawn',waiting:'Not started'};
  return <ol className={editing?'erp-request-route':'erp-request-trail'}>{def.steps?.map((step,index)=><li key={step} data-state={states[index]}>
    {editing?<span>{format.number(index+1)}</span>:null}<div><strong>{t(step)}</strong>{!editing&&<small>{t(labels[states[index] as keyof typeof labels])}</small>}<p>{index===0?(editing?t('You'):row.employee):def.approvers?.length?def.approvers[(index-1)%def.approvers.length]:'—'}</p></div>
  </li>)}</ol>;
}
export function TransactionRequest({def,target,initial,onClose,onOpen,onSaved,onReload}:{def:PageDef;target:ErpTarget;initial:Row;onClose:()=>void;onOpen:(target:ErpTarget)=>void;onSaved:(row:Row)=>void;onReload:()=>void}) {
  const {variant,actor}=useKeystone(),{t}=useLocalization(),{preferences}=usePreferences(),format=useFormatters(),host=useScreenHost(),api=useEntityApi();
  const creating=target.mode==='new',editing=creating||variant==='erp2'&&target.mode==='edit'&&initial.status==='Pending',allowed=host.can(creating?'create':'edit');
  const [draft,setDraft]=useState<Row>(()=>creating?{id:''}:initial),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[failure,setFailure]=useState<unknown>(),[errors,setErrors]=useState<Record<string,string>>({});
  const formFields=def.fields.filter(field=>!['code','status','days','employee'].includes(field.key)),days=requestDays(draft.from,draft.to),neighbours=useNeighbours(def.slug,initial.id);
  const clean=useRef(JSON.stringify(draft)),saving=useRef(false),live=useRef(true),access=useRef(host),retry=useRef<string|undefined>(undefined),pending=useRef<{signature:string;operationId:string}|undefined>(undefined);access.current=host;
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  useUnsavedWarning(editing&&JSON.stringify(draft)!==clean.current||!!note);
  const conflict=(failure as {status?:number})?.status===409;
  const save=async(status?:string)=>{
    if(saving.current||conflict||!access.current.can(creating?'create':'edit')||(!editing&&!status)||status&&(creating||draft.status!=='Pending'||!['Approved','Rejected','Withdrawn'].includes(status)))return;
    const validation:Record<string,string>={};
    if(!status){for(const field of formFields)if(field.required&&(draft[field.key]===''||draft[field.key]==null))validation[field.key]=t('is required');
      if(def.slug==='leave-requests'&&draft.from&&draft.to&&!days)validation.to=t('The end date is before the start date');}
    setErrors(validation);if(Object.keys(validation).length)return;
    const body=status?{...draft,status,lastComment:note}:{...draft,employee:draft.employee??actor?.name??t('You'),status:'Pending',...(def.slug==='leave-requests'?{days}:{})},signature=JSON.stringify(body);
    retry.current=status;if(pending.current?.signature!==signature)pending.current={signature,operationId:crypto.randomUUID()};
    saving.current=true;setBusy(true);setFailure(undefined);
    try{const payload={...body,operationId:pending.current.operationId,...(!creating?{expectedVersion:draft.version??0}:{})};
      const row=creating?await api.create(def.entity,payload):await api.update(def.entity,initial.id,payload);
      if(!live.current)return;pending.current=undefined;clean.current=JSON.stringify(row);setDraft(row);setNote('');host.notify(t('Changes saved'),{tone:'success'});onSaved(row);
    }catch(error){if(live.current){setFailure(error);const status=(error as {status?:number}).status;if(status&&status<500)pending.current=undefined;}}
    finally{saving.current=false;if(live.current)setBusy(false);}
  };
  const saveRef=useRef(save);saveRef.current=save;
  useEffect(()=>{if(!editing||!preferences.keyboardShortcuts)return;const key=(event:KeyboardEvent)=>{if(event.altKey&&event.key.toLowerCase()==='s'){event.preventDefault();void saveRef.current();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[editing,preferences.keyboardShortcuts]);
  const close=()=>{if(!saving.current)onClose();},disabled=busy||!allowed||conflict;
  const feedback=failure?<><RecoveryNotice failure={failureFromError(failure)} onRetry={conflict?undefined:()=>void save(retry.current)}/>{conflict&&<Button onClick={onReload}>{t('Reload')}</Button>}</>:null;
  const identity=<div className="erp-request-identity"><Avatar name={String(draft.employee??'')} size={variant==='erp1'?'md':'lg'} decorative/><div><strong>{draft.employee}</strong>{variant==='erp2'&&<StatusBadge value={draft.status}/>}<p>{draft.leaveType??draft.category}{variant==='erp1'?(draft.days?` ${t(draft.days===1?'for {count} day':'for {count} days',{count:format.number(draft.days)})}`:draft.amount?` ${t('for {amount}',{amount:format.money(draft.amount)})}`:''):draft.from?`, ${format.date(draft.from)} ${t('to')} ${format.date(draft.to)}`:draft.date?`, ${format.date(draft.date)}`:''}</p></div>{variant==='erp1'?<StatusBadge value={draft.status}/>:<div className="erp-request-duration"><span>{t(draft.days?'Duration':'Amount')}</span><b>{draft.days?t(draft.days===1?'{count} day':'{count} days',{count:format.number(draft.days)}):format.money(Number(draft.amount??0))}</b></div>}</div>;
  const details=editing?<><TemplateFields section={{id:'request-details',title:'Request details',fields:formFields.map(templateField)}} values={draft} errors={errors} disabled={disabled} fieldStates={Object.fromEntries(formFields.map(field=>[field.key,{placeholder:'Select…'}]))} onChange={(key,value)=>{if(!disabled)setDraft(row=>({...row,[key]:value}));}}/>{def.slug==='leave-requests'&&(variant==='erp2'||draft.from!==undefined)&&<p role="status" className="erp-request-days">{days?t(days===1?'{count} day requested':'{count} days requested',{count:format.number(days)}):t('Pick both dates to see the number of days')}{days>0&&variant==='erp2'?`, ${format.date(draft.from)} ${t('to')} ${format.date(draft.to)}`:''}</p>}</>:<Fields fields={variant==='erp1'?def.fields.filter(field=>!['code','status'].includes(field.type)):formFields} value={draft} onChange={()=>{}} readOnly columns={2}/>;
  const decision=<div className="erp-request-decision"><Textarea label="Note to the requester (optional)" value={note} rows={2} disabled={disabled} onChange={event=>setNote(event.target.value)}/><div><Button size="sm" variant="primary" leftIcon={<Check size={15}/>} disabled={disabled} onClick={()=>void save('Approved')}>{t('Approve')}</Button><Button size="sm" variant="danger" leftIcon={<XCircle size={15}/>} disabled={disabled} onClick={()=>void save('Rejected')}>{t('Reject')}</Button>{variant==='erp1'&&<Button size="sm" variant="ghost" leftIcon={<Undo2 size={15}/>} disabled={disabled} onClick={()=>void save('Withdrawn')}>{t('Withdraw')}</Button>}</div></div>;
  const submit=<><Button size="sm" leftIcon={<X size={15}/>} disabled={busy} onClick={close}>{t('Cancel')}</Button><Button size="sm" variant="primary" leftIcon={<Send size={15}/>} disabled={disabled} onClick={()=>void save()}>{t(creating?'Submit for approval':'Save and resubmit')}</Button></>;
  const body=<div className="erp-request-record" data-request-record data-variant={variant} data-editing={editing} data-density={preferences.density}>
    <h2 className="sr-only">{t(creating?'New record':'Record details')}</h2>{feedback}
    {variant==='erp1'?<>{!editing&&identity}{details}{!editing&&<><section><h3>{t('Approval trail')}</h3><Trail def={def} row={draft} editing={false}/></section>{draft.status==='Pending'&&<RequestPanel title="Your decision">{decision}</RequestPanel>}</>}</>:<RecordPage appearance="plain" sections={[{id:'details',title:editing?'Request details':'Details',heading:editing?'Request details':'Details',subtitle:editing?'Your manager is notified as soon as you submit.':undefined}]} active="details" onActive={()=>{}} isDone={()=>false} showCompletion={false} asideWidth={editing?340:360} identity={<strong>{creating?t(def.slug==='leave-requests'?'Apply for leave':`New ${nounOf(def)}`):draft.code}</strong>} actions={[
      {id:'back',label:'Back',onClick:close,disabled:busy},
      {id:'previous',label:'Previous record',onClick:()=>onOpen({...target,recordId:neighbours.prev!,mode:'view'}),hidden:editing,disabled:busy||!neighbours.prev},
      {id:'next',label:'Next record',onClick:()=>onOpen({...target,recordId:neighbours.next!,mode:'view'}),hidden:editing,disabled:busy||!neighbours.next},
      {id:'edit',label:'Edit',onClick:()=>onOpen({...target,mode:'edit'}),hidden:editing||draft.status!=='Pending',disabled},
      {id:'withdraw',label:'Withdraw',onClick:()=>void save('Withdrawn'),hidden:editing||draft.status!=='Pending',disabled},
      {id:'cancel',label:'Cancel',onClick:()=>creating?close():onOpen({...target,mode:'view'}),hidden:!editing,disabled:busy},
      {id:'submit',label:creating?'Submit for approval':'Save and resubmit',onClick:()=>void save(),hidden:!editing,disabled,primary:true}
    ]} summary={!editing?identity:undefined} aside={editing?<><RequestPanel title="Your balances"><RequestBalances def={def} row={draft} compact/></RequestPanel><RequestPanel title="Approval route"><Trail def={def} row={draft} editing/></RequestPanel></>:<><RequestPanel title="Approval trail"><Trail def={def} row={draft} editing={false}/></RequestPanel>{draft.status==='Pending'&&<RequestPanel title="Your decision">{decision}</RequestPanel>}</>} renderSection={()=>details}/>}
  </div>;
  if(variant==='erp2')return body;
  const title=creating?t(def.slug==='leave-requests'?'Apply for leave':`New ${nounOf(def)}`):String(draft.code),subtitle=creating?t('Goes to {value0}',{value0:(def.steps??[]).slice(1).map(step=>t(step)).join(', ')}):t(def.title);
  return preferences.previewMode==='center-card'||preferences.previewMode==='center-modal'?<Modal open title={title} subtitle={subtitle} size="md" onClose={close} footer={editing?submit:undefined}>{body}</Modal>:<Drawer open title={title} subtitle={subtitle} width="md" side={preferences.previewMode==='left-drawer'?'left':'right'} onClose={close} footer={editing?submit:undefined}>{body}</Drawer>;
}
