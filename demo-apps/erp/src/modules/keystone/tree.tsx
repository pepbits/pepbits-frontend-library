import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {HierarchyView} from '@pepbits/patterns/tree';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {Card,LoadingState,RecoveryNotice,failureFromError} from '@pepbits/components';
import {CollectionView} from '@pepbits/components/collection-view';
import {Button} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {useKeystone} from './context';
import {useFetch,useEntityApi,useScopeMemory,rememberIds,listUrl} from './client';
import {RecordEditor} from './record';
import {useValueFormat} from './fields';
import type {ListResponse,PageDef,Row} from './types';
import type {ErpTarget} from '../../navigation';

export function TreePage({def,pageId,current,onOpen,onClose}:{def:PageDef;pageId:string;current?:ErpTarget;onOpen:(target:ErpTarget)=>void;onClose:()=>void}) {
  const fetched=useFetch<ListResponse>(listUrl(def.entity,{size:2000})),api=useEntityApi(),host=useScreenHost(),memory=useScopeMemory(),format=useValueFormat(),{variant}=useKeystone(),{t}=useLocalization();
  const [failure,setFailure]=useState<unknown>(),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState<string>();
  const live=useRef(true);useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  const rows=fetched.data?.rows??[],nodes=useMemo(()=>rows.map(row=>({...row,label:String(row.name??row.code??row.id)})),[fetched.data]);
  const selected=current??(rows[0]?{pageId,recordId:rows[0].id,mode:'view' as const}:undefined),row=rows.find(row=>row.id===selected?.recordId);
  const visible=useCallback((ids:string[])=>rememberIds(memory,def.slug,ids),[memory,def.slug]);
  const open=(row:Row)=>{setConfirm(undefined);onOpen({pageId,recordId:row.id,mode:'view'});};
  const create=(parent?:Row)=>onOpen({pageId,mode:'new',query:new URLSearchParams({parentId:parent?.id??'',code:parent?`${parent.code}.${rows.filter(row=>row.parentId===parent.id).length+1}`:String((rows.filter(row=>!row.parentId).length+1)*1000),level:String(Number(parent?.level??-1)+1),...(parent?.nature?{nature:String(parent.nature)}:{})}).toString()});
  const remove=async()=>{
    if(!row||!host.can('delete')||busy||rows.some(child=>child.parentId===row.id))return;
    setBusy(true);setFailure(undefined);
    try{await api.remove(def.entity,row.id);if(!live.current)return;setConfirm(undefined);fetched.reload();onClose();}
    catch(error){if(live.current)setFailure(error);}finally{if(live.current)setBusy(false);}
  };
  if(!fetched.data)return fetched.error?<RecoveryNotice failure={failureFromError(new Error(fetched.error))} onRetry={fetched.reload}/>:<LoadingState/>;
  const columns=def.fields.filter(field=>!['name','code'].includes(field.key)&&field.list!==false).map(field=>({key:field.key,header:field.label,render:(row:Row)=>format(field,row[field.key])}));
  const kids=row?rows.filter(child=>child.parentId===row.id):[];
  return <div data-erp-tree className={variant==='erp1'?'grid gap-3 xl:grid-cols-[minmax(300px,1fr)_minmax(0,2fr)]':'space-y-3'}>
    <Card className="min-w-0 p-3 space-y-3"><div className="flex gap-2">{host.can('create')&&<Button onClick={()=>create()}>{t('New top-level item')}</Button>}</div>
      <HierarchyView label={def.title} nodes={nodes} selectedId={selected?.recordId} onSelect={open} onVisibleChange={visible} columns={variant==='erp2'?[{key:'code',header:'Code'},...columns]:undefined} actions={host.can('create')?node=><Button size="sm" onClick={()=>create(node)} aria-label={`${t('Add child')} ${node.label}`}>+</Button>:undefined}/>
    </Card>
    {variant==='erp1'&&selected&&<Card className="min-w-0 p-3 space-y-3">
      {selected.mode!=='new'&&row&&<div className="flex flex-wrap gap-2">
        {row.parentId&&<Button onClick={()=>{const parent=rows.find(item=>item.id===row.parentId);if(parent)open(parent);}}>{t('Parent')}</Button>}
        {host.can('create')&&<Button onClick={()=>create(row)}>{t('Add child')}</Button>}
        {host.can('delete')&&<Button disabled={busy||!!kids.length} onClick={()=>setConfirm(row.id)}>{t('Delete')}</Button>}
        {confirm===row.id&&<div role="group" aria-label={t('Delete')}><Button disabled={busy} onClick={()=>void remove()}>{t('Confirm delete')}</Button><Button disabled={busy} onClick={()=>setConfirm(undefined)}>{t('Cancel')}</Button></div>}
      </div>}
      {!!failure&&<RecoveryNotice failure={failureFromError(failure)} onRetry={()=>void remove()}/>}
      <RecordEditor def={def} target={selected} onOpen={onOpen} onClose={onClose} onSaved={saved=>{fetched.reload();open(saved);}}/>
      {!!kids.length&&<section><h2>{t('Directly under')} {String(row?.name??'')}</h2><CollectionView columns={[{key:'name',header:'Name'},...columns]} rows={kids} rowKey={item=>item.id} onRowClick={open}/></section>}
    </Card>}
  </div>;
}
