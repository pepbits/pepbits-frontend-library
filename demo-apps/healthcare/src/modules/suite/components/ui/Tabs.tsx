import type {ReactNode} from 'react';
import {Tabs as SharedTabs} from '@pepbits/components';
export interface TabItem {key:string;label:ReactNode;icon?:ReactNode}
export function Tabs({items,active,onSelect,right}:{items:TabItem[];active:string;onSelect:(key:string)=>void;right?:ReactNode}) {
 return <div className="flex items-center gap-2"><SharedTabs items={items.map(item=>({id:item.key,label:String(item.label),icon:item.icon}))} value={active} onChange={onSelect}/>{right}</div>;
}
