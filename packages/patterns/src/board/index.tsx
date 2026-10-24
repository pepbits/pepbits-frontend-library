'use client';
import {useRef,type ReactNode} from 'react';
import {Card} from '@pepbits/components';
import {Button,Select} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useFormatters} from '../screen-host';
export interface BoardColumn {id:string;label:string}
export interface WorkflowBoardProps<T> {
  label:string;columns:readonly BoardColumn[];items:readonly T[];itemId:(item:T)=>string;itemLabel:(item:T)=>string;columnId:(item:T)=>string;
  renderItem?:(item:T)=>ReactNode;onOpen:(item:T)=>void;onMove:(item:T,column:string)=>void;disabled?:boolean;
}
/** Controlled board. Pointer drag and the keyboard-operable select issue the same command. */
export function WorkflowBoard<T>({label,columns,items,itemId,itemLabel,columnId,renderItem,onOpen,onMove,disabled=false}:WorkflowBoardProps<T>) {
  const {t}=useLocalization(),format=useFormatters(),{preferences}=usePreferences(),dragged=useRef<string|null>(null);
  const move=(item:T|undefined,target:string)=>{if(item&&!disabled&&columns.some(column=>column.id===target)&&columnId(item)!==target)onMove(item,target);};
  return <section aria-label={t(label)} data-workflow-board className="flex gap-3 overflow-x-auto pb-2" style={{fontSize:'calc(1rem * var(--fs-result))'}}>
    {columns.map(column=>{const rows=items.filter(item=>columnId(item)===column.id);return <section key={column.id} aria-label={t(column.label)} data-board-column={column.id} className="min-w-[250px] flex-1 space-y-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-2" onDragOver={event=>{if(!disabled&&dragged.current)event.preventDefault();}} onDrop={event=>{event.preventDefault();move(items.find(item=>itemId(item)===dragged.current),column.id);dragged.current=null;}}>
      <h2 className="font-semibold">{t(column.label)} · {format.number(rows.length)}</h2>
      {rows.map(item=><Card key={itemId(item)} data-board-item={itemId(item)} draggable={!disabled} onDragStart={event=>{if(disabled){event.preventDefault();return;}dragged.current=itemId(item);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',itemId(item));}} onDragEnd={()=>{dragged.current=null;}} style={{padding:preferences.density==='compact'?8:preferences.density==='spacious'?20:12}}>
        <Button variant="ghost" onClick={()=>onOpen(item)}>{itemLabel(item)}</Button>{renderItem?.(item)}
        <Select label={`${t('Move to')} ${itemLabel(item)}`} value={columnId(item)} disabled={disabled} options={columns.map(target=>({value:target.id,label:target.label}))} onChange={event=>move(item,event.target.value)}/>
      </Card>)}
    </section>;})}
  </section>;
}
