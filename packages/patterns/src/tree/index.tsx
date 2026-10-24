'use client';
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {CollectionView,type CollectionColumn} from '@pepbits/components/collection-view';
import {Button,Input} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {hierarchyEntries,type HierarchyNode,type HierarchyEntry} from './model';
export {hierarchyEntries,type HierarchyNode,type HierarchyEntry} from './model';

export interface HierarchyViewProps<T extends HierarchyNode> {
  label:string;nodes:readonly T[];selectedId?:string;onSelect:(node:T)=>void;
  columns?:CollectionColumn<T>[];actions?:(node:T)=>ReactNode;
  onVisibleChange?:(ids:string[])=>void;
}
/** Searchable hierarchy canvas; hosts supply node content, commands and persistence. */
export function HierarchyView<T extends HierarchyNode>({label,nodes,selectedId,onSelect,columns,actions,onVisibleChange}:HierarchyViewProps<T>) {
  const {t}=useLocalization(),{preferences}=usePreferences();
  const [query,setQuery]=useState(''),[expanded,setExpanded]=useState<Set<string>>(new Set());
  const rows=useMemo(()=>hierarchyEntries(nodes,expanded,query),[nodes,expanded,query]);
  const ids=JSON.stringify(rows.map(row=>row.node.id));
  useEffect(()=>{onVisibleChange?.(JSON.parse(ids));},[ids,onVisibleChange]);
  const cell=({node,depth,hasChildren,expanded:open}:HierarchyEntry<T>)=><div className="flex items-center gap-1" style={{paddingInlineStart:depth*20}}>
    {hasChildren?<Button size="sm" variant="ghost" aria-label={`${t(open?'Collapse':'Expand')} ${node.label}`} aria-expanded={open} onClick={()=>setExpanded(previous=>{const next=new Set(previous);if(open)next.delete(node.id);else next.add(node.id);return next;})}>{open?'−':'+'}</Button>:<span aria-hidden className="w-7"/>}
    <Button variant="ghost" size="sm" aria-pressed={selectedId===node.id} onClick={()=>onSelect(node)}>{node.label}</Button>
  </div>;
  return <section aria-label={t(label)} data-hierarchy className="min-w-0 space-y-2" style={{fontSize:'calc(1rem * var(--fs-result))'}}>
    <div className="flex flex-wrap items-end gap-2"><Input label="Search the tree" value={query} onChange={event=>setQuery(event.target.value)}/>
      <Button onClick={()=>setExpanded(new Set(nodes.map(node=>node.id)))}>{t('Expand all')}</Button><Button onClick={()=>setExpanded(new Set())}>{t('Collapse all')}</Button></div>
    {columns?<CollectionView rows={rows} rowKey={row=>row.node.id} selectedKey={selectedId} columns={[{key:'hierarchy',header:'Name',render:cell},...columns.map(column=>({...column,render:(entry:HierarchyEntry<T>)=>column.render?.(entry.node)??String((entry.node as Record<string,unknown>)[column.key]??'')}))]} rowActions={actions?entry=>actions(entry.node):undefined}/>:<ul className="overflow-auto" aria-label={t('Items')}>{rows.map(entry=><li key={entry.node.id} className="flex items-center justify-between border-b border-[var(--border)]" style={{paddingBlock:preferences.density==='compact'?2:preferences.density==='spacious'?10:6}}>{cell(entry)}{actions?.(entry.node)}</li>)}</ul>}
    {!rows.length&&<p role="status">{t('No results')}</p>}
  </section>;
}
