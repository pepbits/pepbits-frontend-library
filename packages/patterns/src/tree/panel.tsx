'use client';
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {Button,IconButton,Input} from '@pepbits/ui';
import {ChevronRight,ChevronsDownUp,ChevronsUpDown,FileText,Folder,FolderOpen,Search} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {hierarchyEntries,type HierarchyNode} from './model';
import {CollectionView,type CollectionColumn} from '@pepbits/components/collection-view';

export interface HierarchyPanelProps<T extends HierarchyNode> {
 label:string;nodes:readonly T[];selectedId?:string;onSelect:(node:T)=>void;
 code?:(node:T)=>string;actions?:(node:T)=>ReactNode;toolbar?:ReactNode;footer?:ReactNode;
 disabled?:boolean;onVisibleChange?:(ids:string[])=>void;
 columns?:CollectionColumn<T>[];
}
/** Compact hierarchy composition. Keeps the existing HierarchyView defaults intact. */
export function HierarchyPanel<T extends HierarchyNode>({label,nodes,selectedId,onSelect,code,actions,toolbar,footer,disabled,onVisibleChange,columns}:HierarchyPanelProps<T>) {
 const {t,direction}=useLocalization(),{preferences}=usePreferences();
 const [query,setQuery]=useState(''),[expanded,setExpanded]=useState<Set<string>>(()=>new Set(nodes.filter(node=>!node.parentId).map(node=>node.id)));
 const entries=useMemo(()=>{
  const byId=new Map(nodes.map(node=>[node.id,node]));
  return hierarchyEntries(nodes.map(node=>({...node,label:node.label+' '+(code?.(node)??'')})),expanded,query).map(entry=>({...entry,node:byId.get(entry.node.id)!}));
 },[nodes,expanded,query,code]);
 const ids=JSON.stringify(entries.map(entry=>entry.node.id));
 useEffect(()=>{onVisibleChange?.(JSON.parse(ids));},[ids,onVisibleChange]);
 const content=({node,depth,hasChildren,expanded:open}:typeof entries[number])=><div data-hierarchy-row data-selected={selectedId===node.id||undefined} className="group flex min-w-0 items-center gap-1.5 rounded-[var(--radius)] pe-2 hover:bg-[var(--surface-2)] data-[selected]:bg-[var(--primary-soft)]" style={{paddingInlineStart:(columns?0:6)+depth*(columns?22:16),paddingBlock:columns?0:preferences.density==='compact'?2:preferences.density==='spacious'?8:4}}>
  {hasChildren?<IconButton label={`${t(open?'Collapse':'Expand')} ${node.label}`} aria-expanded={open} style={{width:20,height:20,borderRadius:'var(--radius)'}} onClick={()=>setExpanded(previous=>{const next=new Set(previous);if(open)next.delete(node.id);else next.add(node.id);return next;})}><ChevronRight size={14} style={{transform:`rotate(${open?90:direction==='rtl'?180:0}deg)`}}/></IconButton>:<span aria-hidden style={{width:20,flexShrink:0}}/>}
  {hasChildren?(open?<FolderOpen data-hierarchy-icon size={15} className="shrink-0 text-[var(--accent)]"/>:<Folder data-hierarchy-icon size={15} className="shrink-0 text-[var(--accent)]"/>):<FileText data-hierarchy-icon size={14} className="shrink-0 text-[var(--text-muted)]"/>}
  <Button aria-pressed={selectedId===node.id} disabled={disabled} variant="ghost" onClick={()=>onSelect(node)} className="min-w-0 flex-1 justify-start truncate" style={{height:'auto',padding:0,border:0,borderRadius:'var(--radius)',fontSize:'inherit',lineHeight:1.6,color:'var(--text)',fontWeight:selectedId===node.id?500:400}}>{node.label}</Button>
  {!columns&&code&&<span data-hierarchy-code className="text-[var(--text-muted)]" style={{fontSize:'calc(11px * var(--fs-result))',fontVariantNumeric:'tabular-nums'}}>{code(node)}</span>}
  {!columns&&actions&&<span className="hidden group-hover:inline-flex group-focus-within:inline-flex [@media(hover:none)]:inline-flex">{actions(node)}</span>}
 </div>;
 return <section data-hierarchy data-hierarchy-panel data-hierarchy-grid={!!columns||undefined} aria-label={t(label)} className="flex min-w-0 flex-col" style={{fontSize:'calc(13px * var(--fs-result))'}}>
  <div data-hierarchy-toolbar className="flex items-center gap-1.5 border-b border-[var(--border)] p-2.5">
   <div className="relative min-w-0 flex-1"><Search size={14} aria-hidden className="pointer-events-none absolute start-2.5 top-1/2 z-10 -translate-y-1/2 text-[var(--text-muted)]"/><Input aria-label={t('Search the tree')} placeholder={t('Search the tree')} value={query} onChange={event=>setQuery(event.target.value)} style={{paddingInlineStart:32}}/></div>
   <IconButton label="Expand all" className="size-8" onClick={()=>setExpanded(new Set(nodes.map(node=>node.id)))}><ChevronsUpDown size={17}/></IconButton>
   <IconButton label="Collapse all" className="size-8" onClick={()=>setExpanded(new Set())}><ChevronsDownUp size={17}/></IconButton>{toolbar}
  </div>
  {columns?<CollectionView rows={entries} rowKey={entry=>entry.node.id} rowClassName={()=>'group'} columns={[{key:'hierarchy',header:'Name',render:content},...columns.map(column=>({...column,render:(entry:typeof entries[number])=>column.render?.(entry.node)??String((entry.node as Record<string,unknown>)[column.key]??'')}))]} rowActions={actions?entry=><div className="flex justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">{actions(entry.node)}</div>:undefined}/>:<ul className="min-h-0 flex-1 overflow-auto p-1.5" aria-label={t('Items')}>
   {entries.map(entry=><li key={entry.node.id}>{content(entry)}</li>)}
   {!entries.length&&<li role="status" className="px-3 py-6 text-center text-[var(--text-muted)]">{t('No results')}</li>}
  </ul>}
  {columns&&!entries.length&&<p role="status" className="px-3 py-6 text-center">{t('No results')}</p>}
  {footer&&<div data-hierarchy-footer className="border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[var(--text-muted)]" style={{fontSize:'calc(12px * var(--fs-result))'}}>{footer}</div>}
 </section>;
}
