import {useCallback,useEffect,useMemo} from 'react';
import {HierarchyPanel} from '@pepbits/patterns/tree';
import {useScreenHost,useFormatters} from '@pepbits/patterns/screen-host';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import {Card,LoadingState,RecoveryNotice,failureFromError} from '@pepbits/components';
import {CollectionView} from '@pepbits/components/collection-view';
import {Badge,Button,IconButton,StatusBadge} from '@pepbits/ui';
import {ChevronRight,Plus,Save,Trash2} from '@pepbits/icons';
import {useFetch,useScopeMemory,rememberIds,listUrl} from '../client';
import {hierarchyPath} from '../record-panels';
import {useValueFormat} from '../fields';
import {useMasterDraft} from './use-draft';
import {MasterField} from './field';
import type {ListResponse,PageDef,Row} from '../types';

const code=(row:Row)=>String(row.code??'');
export function MasterTree({def}:{def:PageDef}) {
 const fetched=useFetch<ListResponse>(listUrl(def.entity,{size:2000})),memory=useScopeMemory(),host=useScreenHost(),{preferences}=usePreferences(),{t}=useLocalization(),format=useFormatters(),valueFormat=useValueFormat();
 const editor=useMasterDraft(def,saved=>{
  if(fetched.data){const rows=fetched.data.rows.filter(row=>row.id!==(saved?.id??editor.initial?.id));if(saved)rows.push(saved);fetched.setData({...fetched.data,rows,total:fetched.data.total+(saved?(editor.creating?1:0):-1)});}
  fetched.reload();
 },{retainAfterSave:true,allowReadOnly:true});
 const rows=fetched.data?.rows??[],nodes=useMemo(()=>rows.map(row=>({...row,label:String(row.name??row.code??row.id)})),[fetched.data]);
 useEffect(()=>{if(!editor.draft&&rows[0])editor.open(rows[0]);},[fetched.data,editor.draft]);
 const visible=useCallback((ids:string[])=>rememberIds(memory,def.slug,ids),[memory,def.slug]);
 const complete=!!fetched.data&&fetched.data.total===rows.length;
 const create=(parent?:Row)=>editor.open(undefined,{parentId:parent?.id??null,level:Number(parent?.level??-1)+1,code:parent?`${parent.code}.${rows.filter(row=>row.parentId===parent.id).length+1}`:String((rows.filter(row=>!row.parentId).length+1)*1000),type:def.fields.find(field=>field.key==='type')?.options?.at(-1),...(parent?.nature?{nature:parent.nature}:{})});
 if(!fetched.data)return fetched.error?<RecoveryNotice failure={failureFromError(new Error(fetched.error))} onRetry={fetched.reload}/>:<LoadingState/>;
 const selected=editor.initial,creating=editor.creating,kids=selected?.id?rows.filter(row=>row.parentId===selected.id):[];
 const ancestors=hierarchyPath(rows,creating?String(editor.draft?.parentId??''):selected?.id);
 const descendants=selected?.id?rows.filter(row=>row.id!==selected.id&&hierarchyPath(rows,row.id).some(parent=>parent.id===selected.id)).length:0;
 return <div data-erp-tree data-master-tree data-density={preferences.density} className="erp-master-tree">
  <Card className="erp-master-tree-pane"><HierarchyPanel label={def.title} nodes={nodes} selectedId={creating?undefined:selected?.id} onSelect={editor.open} code={code} disabled={editor.busy} onVisibleChange={visible}
   toolbar={host.can('create')&&<IconButton label="New top-level item" className="size-8" disabled={editor.busy||!complete} onClick={()=>create()}><Plus size={15}/></IconButton>}
   actions={host.can('create')?node=><IconButton label={`${t('Add child')} ${node.label}`} disabled={editor.busy||!complete} style={{width:18,height:18}} onClick={()=>create(node)}><Plus size={13}/></IconButton>:undefined}
   footer={<>{format.number(rows.length)} {t('items,')} {format.number(rows.filter(row=>!rows.some(child=>child.parentId===row.id)).length)} {t('leaf nodes')}</>}/></Card>
  <Card className="erp-master-tree-editor" data-record-page>
   {editor.draft?<><header data-tree-identity><nav aria-label={t('Position in hierarchy')}>{ancestors.map((row,index)=><span key={row.id}>{index>0&&<ChevronRight size={11} aria-hidden className="rtl:rotate-180"/>}<Button variant="ghost" disabled={editor.busy} onClick={()=>editor.open(row)}>{row.name}</Button></span>)}{creating&&<span>{t('New item')}</span>}</nav>
    <div className="erp-tree-heading"><h2>{creating?t('New item'):selected?.name}</h2>{!creating&&selected?.type&&<Badge tone="brand">{t(selected.type)}</Badge>}{!creating&&selected?.status&&<StatusBadge value={selected.status}/>}<span className="flex-1"/>
     {creating?<Button size="sm" disabled={editor.busy} onClick={()=>{const parent=rows.find(row=>row.id===editor.draft?.parentId)??rows[0];if(parent)editor.open(parent);else editor.close();}}>{t('Cancel')}</Button>:<>{host.can('create')&&<Button size="sm" disabled={editor.busy||!complete} leftIcon={<Plus size={15}/>} onClick={()=>create(selected)}>{t('Add child')}</Button>}{editor.canDelete&&<IconButton label="Delete" className="size-8" disabled={editor.busy||!!kids.length||!complete} onClick={()=>editor.setConfirm(true)}><Trash2 size={15}/></IconButton>}</>}
     {editor.allowed&&<Button size="sm" variant="primary" leftIcon={<Save size={15}/>} disabled={editor.busy||editor.conflicted} onClick={()=>void editor.save()}>{t(creating?'Create':'Save')}</Button>}
    </div></header>
    <div className="erp-master-form">
     {!complete&&<p role="alert">{t('Reload the complete hierarchy before adding or deleting items.')} <Button onClick={fetched.reload}>{t('Reload')}</Button></p>}
     {fetched.error&&<RecoveryNotice failure={failureFromError(new Error(fetched.error))} onRetry={fetched.reload}/>}
     {!!editor.failure&&<RecoveryNotice failure={failureFromError(editor.failure)} onRetry={editor.conflicted?undefined:()=>void editor.retry()}/>}
     {editor.conflicted&&<Button disabled={editor.busy} onClick={()=>void editor.reload()}>{t('Reload')}</Button>}
     {editor.confirm&&<div role="group" aria-label={t('Delete')}><Button disabled={editor.busy||!complete||!!kids.length||!editor.canDelete} onClick={()=>void editor.remove()}>{t('Confirm delete')}</Button><Button disabled={editor.busy} onClick={()=>editor.setConfirm(false)}>{t('Cancel')}</Button></div>}
     <div className="erp-master-fields erp-tree-fields">{def.fields.map(field=><div key={field.key} data-wide={field.type==='textarea'||field.span===2}><MasterField field={field} value={editor.draft![field.key]} onChange={value=>editor.set(field.key,value)} disabled={editor.busy||!editor.allowed||editor.conflicted} error={editor.errors[field.key]}/></div>)}</div>
     {!creating&&<section data-tree-children className="erp-tree-children"><div><h3>{t('Directly under')} {selected?.name}</h3><span>{format.number(kids.length)} {t('direct,')} {format.number(descendants)} {t('in total')}</span></div>{kids.length?<CollectionView view={preferences.resultView==='cards'?'cards':'table'} columns={def.fields.slice(0,5).map(field=>({key:field.key,header:field.label,render:(row:Row)=>valueFormat(field,row[field.key])}))} rows={kids} rowKey={row=>row.id} onRowClick={editor.busy?undefined:editor.open}/>:<p>{t('Nothing sits under this item yet.')} {host.can('create')&&<Button variant="ghost" size="sm" disabled={editor.busy||!complete} onClick={()=>create(selected)}>{t('Add the first one')}</Button>}</p>}</section>}
    </div></>:<div className="erp-master-form"><p>{t('Select an item in the tree')}</p>{host.can('create')&&<Button onClick={()=>create()} disabled={!complete}>{t('New top-level item')}</Button>}</div>}
  </Card>
 </div>;
}
