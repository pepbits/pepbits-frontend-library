"use client";
import React, {useId} from 'react';
import {Button, Input, Select, DateInput, TimeInput, Checkbox, Textarea} from '@pepbits/ui';
import {Card, Table, TableContainer} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import type {TemplateField, TemplateValue} from '../types';
import type {FieldRow} from './field-rows';
import styles from './tabular-field-rows.module.css';

export interface TabularFieldColumn extends TemplateField {
  readOnly?: boolean;
  suggestions?: string[];
  minWidth?: number;
  width?: number;
  numeric?: boolean;
}
/** Controlled line table. The host owns calculations, validation, totals and stable row IDs. */
export function TabularFieldRows({title,columns,rows,onChange,createRow,readOnly=false,disabled=false,formatValue,totals,renderCell}: {
  title:string; columns:TabularFieldColumn[]; rows:FieldRow[];
  onChange:(rows:FieldRow[])=>void; createRow:()=>FieldRow;
  readOnly?:boolean; disabled?:boolean;
  formatValue:(column:TabularFieldColumn,value:TemplateValue|undefined)=>React.ReactNode;
  totals?:Record<string,React.ReactNode>;
  /** Optional specialized control; the host owns its disabled/read-only guards. Undefined keeps the standard cell. */
  renderCell?:(column:TabularFieldColumn,row:FieldRow,index:number)=>React.ReactNode|undefined;
}) {
  const {t}=useLocalization(), instance=useId();
  const change=(id:string,column:TabularFieldColumn,value:TemplateValue)=>{
    if(readOnly||disabled||column.readOnly)return;
    onChange(rows.map(row=>row.id===id?{...row,values:{...row.values,[column.id]:value}}:row));
  };
  return <Card className={styles.root} data-tabular-field-rows>
    <header className={styles.header}><h3>{t(title)}</h3><span>{t(rows.length===1?'{count} line':'{count} lines',{count:rows.length})}</span>
      {!readOnly&&<Button size="sm" disabled={disabled} onClick={()=>{if(!disabled)onChange([...rows,createRow()]);}}>{t('Add line')}</Button>}
    </header>
    <TableContainer className={styles.scroll} aria-label={t(title)}>
      <Table className={styles.table} aria-label={t(title)}>
        <thead><tr><th scope="col" className={styles.ordinal}>#</th>{columns.map(column=><th key={column.id} scope="col" data-numeric={column.numeric||column.type==='number'||undefined} style={{minWidth:column.minWidth,width:column.width}}>{t(column.label)}</th>)}{!readOnly&&<th scope="col" className={styles.ordinal}><span className="sr-only">{t('Actions')}</span></th>}</tr></thead>
        <tbody>{rows.map((row,index)=><tr key={row.id} data-line-id={row.id}><td className={styles.ordinal}>{index+1}</td>{columns.map(column=>{
          const value=row.values[column.id], name=`${t(column.label)} ${index+1}`, list=`${instance}-${column.id}`;
          const common={'aria-label':name,disabled,required:column.required,value:String(value??'')};
          const custom=renderCell?.(column,row,index);
          return <td key={column.id} data-numeric={column.numeric||column.type==='number'||undefined}>
            {custom!==undefined?custom:readOnly||column.readOnly?<span className={styles.value}>{formatValue(column,value)}</span>:column.type==='checkbox'?<Checkbox aria-label={name} disabled={disabled} checked={!!value} onChange={e=>change(row.id,column,e.target.checked)}/>:column.type==='textarea'?<Textarea {...common} onChange={e=>change(row.id,column,e.target.value)}/>:column.type==='select'?<Select {...common} options={column.options??[]} onChange={e=>change(row.id,column,e.target.value)}/>:column.type==='date'?<DateInput {...common} onChange={e=>change(row.id,column,e.target.value)}/>:column.type==='time'?<TimeInput {...common} onChange={e=>change(row.id,column,e.target.value)}/>:<Input {...common} type={column.type} step="any" min={column.min} list={column.suggestions?list:undefined} onChange={e=>change(row.id,column,column.type==='number'&&e.target.value!==''?Number(e.target.value):e.target.value)}/>}
          </td>;
        })}{!readOnly&&<td className={styles.ordinal}><Button variant="ghost" size="sm" disabled={disabled} aria-label={t('Remove line {value0}',{value0:index+1})} onClick={()=>{if(!disabled)onChange(rows.filter(item=>item.id!==row.id));}}>×</Button></td>}</tr>)}
        {!rows.length&&<tr><td colSpan={columns.length+(readOnly?1:2)} className={styles.empty}>{t('No lines yet.')} {!readOnly&&t('Use “Add line” to start.')}</td></tr>}</tbody>
        {!!rows.length&&totals&&<tfoot><tr><td/>{columns.map(column=><td key={column.id} data-numeric={column.numeric||column.type==='number'||undefined}>{totals[column.id]}</td>)}{!readOnly&&<td/>}</tr></tfoot>}
      </Table>
    </TableContainer>
    {columns.filter(column=>column.suggestions).map(column=><datalist key={column.id} id={`${instance}-${column.id}`}>{column.suggestions!.map(value=><option key={value} value={value}/>)}</datalist>)}
  </Card>;
}
