import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Card,LoadingState,ProgressBar,RecoveryNotice,failureFromError} from '@pepbits/components';
import {Button,StatusBadge} from '@pepbits/ui';
import {Check,CircleAlert,LoaderCircle,Play,RotateCcw} from '@pepbits/icons';
import {TemplateFields} from '@pepbits/page-engines/templates';
import {RecordPage} from '@pepbits/page-engines/record-page';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useFormatters,useScreenHost} from '@pepbits/patterns/screen-host';
import {useUnsavedWarning} from '@pepbits/patterns/drafts';
import {useEntitySupport,useProcessRunner} from './api';
import {playProcessEvents,type RunLogLine,type StepState} from './process';
import {useKeystone} from './context';
import {Fields,templateField} from './fields';
import {localDay,shiftDay} from './dates';
import type {PageDef,Row} from './types';
import type {ErpTarget} from '../../navigation';
import './transaction-process.css';

export function processDefaults(def:PageDef,day=localDay()) {return Object.fromEntries((def.params??[]).map(field=>[field.key,field.options?.[0]??(field.type==='boolean'?true:field.type==='date'?shiftDay(day,5):'')]));}
function ProcessPanel({title,children}:{title:string;children:ReactNode}) {const {t}=useLocalization();return <Card className="erp-process-panel"><h3>{t(title)}</h3><div>{children}</div></Card>;}
function Steps({steps,states}:{steps:string[];states:StepState[]}) {
  const {t}=useLocalization(),format=useFormatters();return <ol className="erp-process-steps">{steps.map((step,index)=><li key={step} data-state={states[index]}><span aria-hidden>{states[index]==='done'?<Check size={13}/>:states[index]==='warn'?<CircleAlert size={13}/>:states[index]==='running'?<LoaderCircle size={17}/>:format.number(index+1)}</span><strong>{t(step)}</strong><small>{t(states[index]==='warn'?'Needs review':states[index]==='done'?'Done':states[index]==='running'?'Running':'Not started')}</small></li>)}</ol>;
}
function RunLog({lines}:{lines:RunLogLine[]}) {
  const {t}=useLocalization(),format=useFormatters(),{preferences}=usePreferences(),ref=useRef<HTMLOListElement>(null);
  useEffect(()=>{ref.current?.scrollTo({top:ref.current.scrollHeight,behavior:preferences.reducedMotion?'auto':'smooth'});},[lines,preferences.reducedMotion]);
  return <ol ref={ref} className="erp-process-log" aria-label={t('Run log')}>{!lines.length&&<li>{t('Nothing has run in this session yet.')}</li>}{lines.map((line,index)=><li key={index} data-warning={line.warn||undefined}><time>{format.time(line.t,{seconds:true})}</time> {line.text}</li>)}</ol>;
}
export function TransactionProcess({def,target,initial,onClose,onOpen,onSaved}:{def:PageDef;target:ErpTarget;initial:Row;onClose:()=>void;onOpen:(target:ErpTarget)=>void;onSaved:(row:Row)=>void}) {
  const {variant}=useKeystone(),{t}=useLocalization(),{preferences}=usePreferences(),format=useFormatters(),host=useScreenHost(),runProcess=useProcessRunner(def.entity),creating=target.mode==='new',steps=def.steps??[];
  const support=useEntitySupport(def.entity,creating?undefined:initial.id,initial.version);
  const [params,setParams]=useState<Record<string,string|number|boolean>>(()=>processDefaults(def)),[states,setStates]=useState<StepState[]>(steps.map(()=>'idle')),[log,setLog]=useState<RunLogLine[]>([]),[running,setRunning]=useState(false),[failure,setFailure]=useState<unknown>(),[last,setLast]=useState<Row>();
  const timers=useRef<ReturnType<typeof setTimeout>[]>([]),live=useRef(true),busy=useRef(false),access=useRef(host);access.current=host;
  useEffect(()=>{live.current=true;return()=>{live.current=false;timers.current.forEach(clearTimeout);};},[]);
  useUnsavedWarning(running);
  const run=async()=>{
    if(busy.current||!access.current.can('create'))return;busy.current=true;setRunning(true);setFailure(undefined);setStates(steps.map(()=>'idle'));setLog([]);
    try{const result=await runProcess(params);if(!live.current)return;
      const took=playProcessEvents(result.events,steps.length,{setStates,setLog,timers:timers.current},preferences.reducedMotion?0:undefined);
      timers.current.push(setTimeout(()=>{if(!live.current)return;setStates(values=>values.map(value=>value==='running'?'done':value));setLast(result.row);setRunning(false);busy.current=false;host.notify(t('Changes saved'),{tone:'success'});onSaved(result.row);},took+(preferences.reducedMotion?0:200)));
    }catch(error){if(live.current){setFailure(error);setRunning(false);busy.current=false;}}
  };
  const shownStates=creating?states:steps.map((_,index)=>{const events=support.data?.processEvents?.filter(event=>event.step===index)??[];return events.some(event=>event.tone==='warn'||event.tone==='danger')?'warn':events.some(event=>event.progress===undefined||event.progress>=100)?'done':'idle';}),done=shownStates.filter(state=>state==='done'||state==='warn').length;
  const progress=<><ProgressBar value={done/Math.max(1,steps.length)*100} label="Steps" tone={shownStates.includes('warn')?'warning':'primary'}/><Steps steps={steps} states={shownStates}/></>;
  const fields=<TemplateFields section={{id:'run-parameters',title:'Run parameters',fields:(def.params??[]).map(templateField)}} values={params} errors={{}} disabled={running||!host.can('create')} onChange={(key,value)=>{if(!running&&host.can('create'))setParams(values=>({...values,[key]:value}));}}/>;
  const logs=creating?<RunLog lines={log}/>:support.error?<RecoveryNotice failure={failureFromError(new Error(support.error))} onRetry={support.retry}/>:!support.data?<LoadingState/>:<RunLog lines={(support.data.processEvents??[]).map(event=>({t:event.time,text:event.text,warn:event.tone==='warn'||event.tone==='danger'}))}/>;
  const feedback=failure?<RecoveryNotice failure={failureFromError(failure)} onRetry={()=>void run()}/>:null;
  return <div className="erp-process-record" data-process-record data-variant={variant} data-density={preferences.density} data-running={running}>
    <h2 className="sr-only">{t(creating?'New record':'Record details')}</h2>{feedback}
    {variant==='erp1'&&creating?<Card className="erp-process-parameters"><header><h3>{t('Run parameters')}</h3><p>{last?`${last.code} · ${format.date(last.runAt)}`:t('Check the parameters, then start the run.')}</p></header><div>{fields}<section><h3>{t('Steps')} <small>{format.number(done)}/{format.number(steps.length)}</small></h3>{progress}</section><section><h3>{t('Run log')}</h3>{logs}</section></div><footer><Button size="sm" leftIcon={<RotateCcw size={15}/>} disabled={running||!log.length} onClick={()=>{setStates(steps.map(()=>'idle'));setLog([]);}}>{t('Reset')}</Button><Button size="sm" variant="primary" leftIcon={<Play size={15}/>} disabled={running||!host.can('create')} onClick={()=>void run()}>{t(running?'Running':'Start run')}</Button></footer></Card>:<RecordPage appearance="plain" sections={[{id:'run',title:creating?'Parameters':'Run details',heading:creating?'Parameters':'Run details'}]} active="run" onActive={()=>{}} isDone={()=>false} showCompletion={false} identity={<strong>{creating?t(`New ${def.title.toLowerCase()}`):initial.code}</strong>} actions={[{id:'back',label:'Back',onClick:onClose,disabled:running},{id:'start',label:creating?running?'Running':'Start run':'Start new run',primary:true,onClick:()=>creating?void run():onOpen({pageId:target.pageId,mode:'new'}),disabled:running||!host.can('create')}]} summary={!creating?<Card className="erp-process-identity"><span><Check size={22}/></span><div><strong>{initial.period}</strong> <StatusBadge value={initial.status}/><p>{initial.code} · {initial.runBy} · {format.date(initial.runAt)}</p></div><dl>{def.fields.filter(field=>field.type==='number'||field.type==='currency').map(field=><div key={field.key}><dt>{t(field.label)}</dt><dd>{field.type==='currency'?format.money(Number(initial[field.key]??0)):format.number(Number(initial[field.key]??0))}</dd></div>)}</dl></Card>:undefined} renderSection={()=>creating?<><div className="erp-process-columns"><ProcessPanel title="Parameters">{fields}</ProcessPanel><ProcessPanel title="Progress">{progress}</ProcessPanel></div><ProcessPanel title="Run log">{logs}</ProcessPanel></>:<><div className="erp-process-columns"><ProcessPanel title="Steps">{progress}</ProcessPanel><ProcessPanel title="Run log">{logs}</ProcessPanel></div><ProcessPanel title="Run details"><Fields fields={def.fields.filter(field=>field.type!=='code')} value={initial} readOnly onChange={()=>{}}/></ProcessPanel></>}/>}
  </div>;
}
