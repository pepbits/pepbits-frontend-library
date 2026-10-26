import {useEffect, useRef, useState} from 'react';
import {Button, IconButton} from '@pepbits/ui';
import {Check, X, Pencil, Save, Trash2} from '@pepbits/icons';
import {Modal, RecoveryNotice, failureFromError, TableRow, TableCell} from '@pepbits/components';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import type {PageDefinition, DataColumn} from '@pepbits/page-engines/types';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {ErpWorklist} from '../worklist';
import {useKeystone} from '../context';
import {nounOf} from '../registry';
import type {PageDef, Row, ListResponse} from '../types';
import type {ErpTarget} from '../../../navigation';
import {MasterParent} from './parent';
import {MasterField} from './field';
import {useMasterDraft} from './use-draft';
import {RateDate,RateValidity,rateColumns} from './rates';
import {useFormatters} from '@pepbits/patterns/screen-host';

/** Small masters retain their worklist while one draft is edited and acknowledged. */
export function MasterWorklist({def,page}:{def:PageDef;page:PageDefinition}) {
 const {variant}=useKeystone(),{preferences}=usePreferences(),{t}=useLocalization(),host=useScreenHost();
 const [revision,setRevision]=useState(0),rows=useRef<Row[]>([]),editor=useMasterDraft(def,()=>setRevision(value=>value+1));
 const [asOf,setAsOf]=useState(''),rate=def.template==='rate',format=useFormatters();
 const inline=variant==='erp1'&&preferences.resultView==='table';
 const open=(target:ErpTarget)=>{const row=rows.current.find(row=>row.id===target.recordId);if(target.mode==='new'||row)editor.open(target.mode==='new'?undefined:row,Object.fromEntries(new URLSearchParams(target.query)));};
 useEffect(()=>{if(!editor.draft)return;const timer=setTimeout(()=>document.querySelector<HTMLElement>('[data-master-inline] input:not([disabled]), [data-master-form] input:not([disabled])')?.focus(),0);return()=>clearTimeout(timer);},[editor.initial,editor.added]);
 const feedback=editor.failure?<RecoveryNotice failure={failureFromError(editor.failure)} onRetry={editor.conflicted?undefined:()=>void editor.retry()}/>:null;
 const conflict=editor.conflicted;
 const keys=(event:React.KeyboardEvent)=>{
  if(!preferences.keyboardShortcuts)return;
  if(event.key==='Enter'&&(event.target as HTMLElement).tagName==='INPUT'){event.preventDefault();void editor.save();}
  if(event.key==='Escape'&&inline){event.preventDefault();editor.close();}
 };
 const cellEditor=(columns:DataColumn[])=>editor.draft?<TableRow key="master-draft" data-master-inline onKeyDown={keys}>
  {columns.map(column=>{const field=def.fields.find(field=>field.key===column.key);if(!field)return <TableCell key={column.key}/>;return <TableCell key={field.key}>{field.readOnly||field.type==='code'?<span>{editor.creating?t('Auto'):String(editor.draft![field.key]??'')}</span>:<MasterField field={field} value={editor.draft![field.key]} onChange={value=>editor.set(field.key,value)} disabled={editor.busy||!editor.allowed||conflict} error={editor.errors[field.key]} compact/>}</TableCell>;})}
  <TableCell><div className="erp-master-row-actions"><Button size="xs" variant="primary" leftIcon={<Check size={14}/>} disabled={editor.busy||!editor.allowed||conflict} onClick={()=>void editor.save()}>{t('Save')}</Button><IconButton className="size-7" label="Cancel" disabled={editor.busy} onClick={editor.close}><X size={15}/></IconButton></div></TableCell>
 </TableRow>:null;
 const actions=<>{!editor.creating&&editor.canDelete&&<Button size="sm" variant="ghost" className="me-auto" leftIcon={<Trash2 size={15}/>} disabled={editor.busy} onClick={()=>editor.setConfirm(true)}>{t('Delete')}</Button>}{editor.creating&&editor.added>0&&<span role="status" className="me-auto">{editor.added} {t('added so far')}</span>}<Button size="sm" disabled={editor.busy} onClick={editor.close}>{t('Cancel')}</Button>{editor.creating&&<Button size="sm" disabled={editor.busy||!editor.allowed||conflict} onClick={()=>void editor.save(true)}>{t('Save and add another')}</Button>}<Button size="sm" variant="primary" leftIcon={<Save size={15}/>} disabled={editor.busy||!editor.allowed||conflict} onClick={()=>void editor.save()}>{t(editor.creating?'Add':'Save')}</Button></>;
 return <div className="erp-master-worklist" data-master-variant={variant} data-master-dependent={!!def.parent} data-density={preferences.density}>
  {inline&&<>{feedback}{conflict&&<Button onClick={()=>void editor.reload()} disabled={editor.busy}>{t('Reload')}</Button>}</>}
  <ErpWorklist sourceParams={rate?{asOf:asOf||undefined}:undefined} extraColumns={rate?rateColumns:undefined} toolbarExtra={rate?<RateDate value={asOf} onChange={setAsOf}/>:undefined} renderLeading={def.parent&&variant==='erp1'?controls=><MasterParent def={def} {...controls}/>:undefined} def={def} page={page} refreshKey={revision} onLoaded={(result:ListResponse)=>{rows.current=result.rows;}} onOpen={open} newLabel={variant==='erp1'?(rate?'Add rate':'Add row'):`New ${nounOf(def)}`} tableComposition={{renderCell:rate?(row,column)=>column.key==='validity'?<RateValidity row={row} asOf={asOf}/>:column.key==='effectiveTo'&&!row.effectiveTo?t('Open-ended'):column.key==='effectiveTo'?format.date(String(row.effectiveTo)):undefined:undefined,selectable:!inline,beforeRows:inline&&editor.draft&&editor.creating?cellEditor:undefined,renderRow:(row,columns)=>inline&&editor.draft&&!editor.creating&&row.id===editor.initial?.id?cellEditor(columns):undefined,renderActions:row=><IconButton label={`Edit ${row.id}`} className="size-7" disabled={!host.can('edit')||editor.busy} onClick={()=>editor.open(rows.current.find(item=>item.id===row.id))}><Pencil size={15}/></IconButton>}}/>
  {!inline&&editor.draft&&<Modal open onClose={editor.close} title={editor.creating?`New ${nounOf(def)}`:`Edit ${nounOf(def)}: ${editor.initial?.name??editor.initial?.code??''}`} size="md" className="erp-master-dialog" footer={editor.confirm?<><span className="me-auto">{t('Delete this record?')}</span><Button size="sm" disabled={editor.busy} onClick={()=>editor.setConfirm(false)}>{t('Keep it')}</Button><Button size="sm" variant="danger" disabled={editor.busy||!editor.canDelete} onClick={()=>void editor.remove()}>{t('Delete')}</Button></>:actions}>
   <div data-master-form className="erp-master-form" data-density={preferences.density} onKeyDown={keys}>{feedback}{conflict&&<Button onClick={()=>void editor.reload()} disabled={editor.busy}>{t('Reload')}</Button>}<div className="erp-master-fields">{def.fields.filter(field=>!(editor.creating&&field.type==='code')).map(field=><div key={field.key} data-wide={field.type==='textarea'||field.span===2}><MasterField field={field} value={editor.draft![field.key]} onChange={value=>editor.set(field.key,value)} disabled={editor.busy||!editor.allowed||conflict} error={editor.errors[field.key]}/></div>)}</div>{preferences.keyboardShortcuts&&<p>{t('Press Enter to save. Esc closes without saving.')}</p>}</div>
  </Modal>}
 </div>;
}
