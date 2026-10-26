import {Button} from '@pepbits/ui';
import {FileText,Folder} from '@pepbits/icons';
import {usePreferences} from '@pepbits/preferences/react';
import type {Row} from '../types';

/** Source record context is a compact child list, independent of worklist table mode. */
export function TreeChildren({rows,children,disabled,onOpen}:{rows:Row[];children:Row[];disabled:boolean;onOpen:(row:Row)=>void}) {
 const {preferences}=usePreferences();
 return <ul data-tree-child-list data-density={preferences.density} className="erp-tree-child-list">{children.map(row=><li key={row.id}><Button variant="ghost" disabled={disabled} onClick={()=>onOpen(row)}>{rows.some(child=>child.parentId===row.id)?<Folder size={15} aria-hidden/>:<FileText size={14} aria-hidden/>}<span>{row.name}</span><small>{row.code}</small></Button></li>)}</ul>;
}
