import {useCallback,useMemo} from 'react';
import {HierarchyPanel} from '@pepbits/patterns/tree';
import {useScreenHost,useFormatters} from '@pepbits/patterns/screen-host';
import {Card,LoadingState,RecoveryNotice,failureFromError} from '@pepbits/components';
import {Button,IconButton} from '@pepbits/ui';
import {Eye,Plus} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {useKeystone} from './context';
import {useFetch,useScopeMemory,rememberIds,listUrl} from './client';
import {useValueFormat} from './fields';
import type {ListResponse,PageDef,Row} from './types';
import type {ErpTarget} from '../../navigation';
import {MasterTree} from './masters/tree';

type TreePageProps={def:PageDef;pageId:string;current?:ErpTarget;onOpen:(target:ErpTarget)=>void;onClose:()=>void};
export function TreePage(props:TreePageProps) {const {variant}=useKeystone();return variant==='erp1'?<MasterTree def={props.def}/>:<TreeGrid {...props}/>;}
function TreeGrid({def,pageId,onOpen}:TreePageProps) {
 const fetched=useFetch<ListResponse>(listUrl(def.entity,{size:2000})),host=useScreenHost(),memory=useScopeMemory(),format=useValueFormat(),numbers=useFormatters(),{t}=useLocalization();
 const rows=fetched.data?.rows??[],nodes=useMemo(()=>rows.map(row=>({...row,label:String(row.name??row.code??row.id)})),[fetched.data]);
 const visible=useCallback((ids:string[])=>rememberIds(memory,def.slug,ids),[memory,def.slug]);
 const open=(row:Row)=>onOpen({pageId,recordId:row.id,mode:'view'});
 const partial=!fetched.data||fetched.data.total>rows.length;
 const create=(parent?:Row)=>{if(partial||!host.can('create'))return;onOpen({pageId,mode:'new',query:new URLSearchParams({parentId:parent?.id??'',code:parent?`${parent.code}.${rows.filter(row=>row.parentId===parent.id).length+1}`:String((rows.filter(row=>!row.parentId).length+1)*1000),level:String(Number(parent?.level??-1)+1),...(parent?.nature?{nature:String(parent.nature)}:{})}).toString()});};
 if(!fetched.data)return fetched.error?<RecoveryNotice failure={failureFromError(new Error(fetched.error))} onRetry={fetched.reload}/>:<LoadingState/>;
 const columns=def.fields.filter(field=>!['name','code'].includes(field.key)&&field.list!==false).map(field=>({key:field.key,header:field.label,render:(row:Row)=>format(field,row[field.key])}));
 return <Card data-erp-tree className="erp-master-tree-grid"><HierarchyPanel label={def.title} nodes={nodes} onSelect={open} code={(row:Row)=>String(row.code??'')} onVisibleChange={visible} columns={[{key:'code',header:'Code'},...columns]} toolbar={<><span className="erp-tree-grid-count">{numbers.number(rows.length)} {t('items,')} {numbers.number(rows.filter(row=>!rows.some(child=>child.parentId===row.id)).length)} {t('at the lowest level')}</span>{host.can('create')&&<Button size="sm" variant="primary" disabled={partial} onClick={()=>create()} leftIcon={<Plus size={15}/>}>{t('New top-level item')}</Button>}</>} actions={node=><>{host.can('create')&&<IconButton className="size-7" label={`${t('Add child')} ${node.label}`} disabled={partial} onClick={()=>create(node)}><Plus size={15}/></IconButton>}<IconButton className="size-7" label={`${t('Open')} ${node.label}`} onClick={()=>open(node)}><Eye size={15}/></IconButton></>}/></Card>;
}
