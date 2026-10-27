import {useEffect,useRef} from 'react';
import {Card,LoadingState,RecoveryNotice,failureFromError,Modal} from '@pepbits/components';
import {Button,StatusBadge} from '@pepbits/ui';
import {RecordActionBar,type RecordPageAction} from '@pepbits/page-engines/record-page';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import {useScreenHost,useFormatters} from '@pepbits/patterns/screen-host';
import {useFetch,useNeighbours} from '../client';
import {useKeystone} from '../context';
import {useValueFormat} from '../fields';
import {RecordSupport} from '../record-panels';
import {nounOf} from '../registry';
import {useMasterDraft} from './use-draft';
import {MasterField} from './field';
import {StructureLines,blankStructureLine,structureTotals} from './structure-lines';
import type {PageDef,Row} from '../types';
import type {ErpTarget} from '../../../navigation';

export function StructureRecord({def,target,onOpen,onClose,onSaved}:{def:PageDef;target:ErpTarget;onOpen:(target:ErpTarget)=>void;onClose:()=>void;onSaved:(row:Row)=>void}) {
 const {variant}=useKeystone(),host=useScreenHost(),{t}=useLocalization(),creating=target.mode==='new',copy=creating?new URLSearchParams(target.query).get('copy'):null;
 const fetched=useFetch<Row>(!creating||copy?`/api/entities/${def.entity}/${encodeURIComponent(copy??target.recordId!)}`:null);
 if(creating&&!host.can('create'))return <div data-record-page><p role="status">{t('You do not have permission to create this record.')}</p><Button onClick={onClose}>{t('Back')}</Button></div>;
 if((!creating||copy)&&!fetched.data)return fetched.error?<RecoveryNotice failure={failureFromError(new Error(fetched.error))} onRetry={fetched.reload}/>:<LoadingState/>;
 const initial=creating?undefined:fetched.data!,defaults=copy?{...fetched.data,id:'',code:undefined,version:undefined}: {lines:variant==='erp1'?[]:[blankStructureLine(def.lines!.fields)],...Object.fromEntries(new URLSearchParams(target.query))};
 return <StructureBody key={JSON.stringify([target.recordId,target.mode,copy])} {...{def,target,onOpen,onClose,initial,defaults}} onSaved={row=>{fetched.setData(row);onSaved(row);}}/>;
}
function StructureBody({def,target,onOpen,onClose,onSaved,initial,defaults}:{def:PageDef;target:ErpTarget;onOpen:(target:ErpTarget)=>void;onClose:()=>void;onSaved:(row:Row)=>void;initial?:Row;defaults:Partial<Row>}) {
 const {variant}=useKeystone(),{preferences}=usePreferences(),{t}=useLocalization(),host=useScreenHost(),format=useFormatters(),valueFormat=useValueFormat();
 const editor=useMasterDraft(def,row=>row?onSaved(row):onClose(),{retainAfterSave:true,allowReadOnly:true,validate:(row):Record<string,string>=>variant==='erp2'&&!row.lines?.length?{lines:'Add at least one line first'}:{},prepare:row=>({...row,total:structureTotals(row.lines??[]).total})});
 useEffect(()=>{editor.open(initial,defaults);},[]);
 const neighbours=useNeighbours(def.slug,initial?.id),edit=(variant==='erp1'||target.mode!=='view')&&editor.allowed;
 const save=useRef(()=>{});save.current=()=>{if(edit)void editor.save();};
 useEffect(()=>{if(!preferences.keyboardShortcuts)return;const listener=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey||event.altKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save.current();}};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[preferences.keyboardShortcuts]);
 if(!editor.draft)return <LoadingState/>;
 const row=editor.draft,lines=row.lines??[],totals=structureTotals(lines),creating=editor.creating,busy=editor.busy,disabled=busy||editor.conflicted||!editor.allowed;
 const dirty=JSON.stringify(row)!==JSON.stringify(editor.initial),totalLabel=def.fields.find(field=>field.key==='total')?.label??'Total';
 const actions:RecordPageAction[]=[{id:'back',label:'Back',onClick:onClose,disabled:busy,hidden:variant==='erp1'},{id:'cancel',label:'Cancel',onClick:()=>creating?onClose():onOpen({...target,mode:'view'}),disabled:busy,hidden:variant==='erp1'||!edit},{id:'save',label:creating?'Create':'Save',primary:true,onClick:()=>void editor.save(),hidden:!edit,disabled:disabled||variant==='erp1'&&!creating&&!dirty},{id:'edit',label:'Edit',onClick:()=>onOpen({...target,mode:'edit'}),hidden:edit||!host.can('edit'),disabled:busy},{id:'copy',label:'Copy to new',onClick:()=>onOpen({pageId:target.pageId,mode:'new',query:new URLSearchParams({copy:row.id}).toString()}),hidden:variant==='erp1'||creating||edit||!host.can('create'),disabled:busy},{id:'delete',label:'Delete',onClick:()=>editor.setConfirm(true),hidden:variant==='erp1'||creating||edit||!editor.canDelete,disabled:busy},...(['prev','next'] as const).map(key=>({id:key,label:key==='prev'?'Previous record':'Next record',onClick:()=>onOpen({...target,recordId:neighbours[key]!,mode:'view'}),hidden:variant==='erp1'||creating||edit,disabled:busy||!neighbours[key]}))];
 const fields=def.fields.filter(field=>field.type!=='code'&&field.key!=='total');
 const fieldContent=<div className="erp-structure-fields">{fields.map(field=><div key={field.key} data-wide={field.type==='textarea'}>{edit?<MasterField field={field} value={row[field.key]} onChange={value=>editor.set(field.key,value)} disabled={disabled} error={editor.errors[field.key]}/>:<><div className="erp-field-label">{t(field.label)}</div><div className="erp-field-value">{field.type==='status'?<StatusBadge value={row[field.key]}/>:valueFormat(field,row[field.key])}</div></>}</div>)}</div>;
 return <div data-erp-record data-record-page data-structure-record data-variant={variant} data-density={preferences.density} data-erp-record-version={row.version} className="erp-structure-record">
 <header className="erp-structure-identity"><div><h2>{String(row.name??t('New')+' '+nounOf(def))}{row.status&&<StatusBadge value={row.status}/>}</h2><p>{creating?t('Code assigned on save'):String(row.code??'')}{dirty&&<> · {t('Unsaved changes')}</>}</p></div>{variant==='erp1'&&<dl><dt>{t(totalLabel)}</dt><dd>{format.money(totals.total)}</dd></dl>}<RecordActionBar actions={actions}/></header>
 {!!editor.failure&&<RecoveryNotice failure={failureFromError(editor.failure)} onRetry={editor.conflicted?undefined:()=>void editor.retry()}/>} {editor.conflicted&&<Button disabled={busy} onClick={()=>void editor.reload()}>{t('Reload')}</Button>}
 <div className="erp-structure-body"><div className="erp-structure-main"><Card className="erp-structure-details">{variant==='erp2'&&<h3>{t('Details')}</h3>}{fieldContent}</Card>
 {variant==='erp1'&&def.lines!.fields.some(field=>field.key==='kind')&&<dl className="erp-structure-totals">{[['Earnings',totals.earnings],['Deductions',totals.deductions],['Net',totals.subtotal]].map(([label,value])=><div key={label} data-kind={label}><dt>{t(String(label))}</dt><dd>{format.money(Number(value))}</dd></div>)}</dl>}
 {editor.errors.lines&&<p role="alert">{t(editor.errors.lines)}</p>}<StructureLines fields={def.lines!.fields} lines={lines} title={def.lines!.label} readOnly={!edit} disabled={disabled} onChange={value=>editor.set('lines',value)}/></div>
 {variant==='erp2'&&<aside data-structure-aside data-record-aside><Card className="erp-structure-summary"><h3>{t('Summary')}</h3><dl><div><dt>{t('Lines')}</dt><dd>{format.number(lines.length)}</dd></div>{totals.tax!==0&&<div><dt>{t('Tax')}</dt><dd>{format.money(totals.tax)}</dd></div>}<div data-total><dt>{t(totalLabel)}</dt><dd>{format.money(totals.total)}</dd></div></dl></Card>{!creating&&<Card className="erp-structure-summary"><h3>{t('History')}</h3><RecordSupport entity={def.entity} id={row.id} kind="activity" revision={row.version}/></Card>}</aside>}
 </div><Modal open={editor.confirm} onClose={()=>{if(!busy)editor.setConfirm(false);}} title="Delete this record?" footer={<><Button disabled={busy} onClick={()=>editor.setConfirm(false)}>{t('Keep it')}</Button><Button variant="danger" disabled={busy||!editor.canDelete} onClick={()=>void editor.remove()}>{t('Delete')}</Button></>}><p>{t('Existing documents keep their copy of this record.')}</p>{!!editor.failure&&<RecoveryNotice failure={failureFromError(editor.failure)} onRetry={()=>void editor.retry()}/>}</Modal></div>;
}
