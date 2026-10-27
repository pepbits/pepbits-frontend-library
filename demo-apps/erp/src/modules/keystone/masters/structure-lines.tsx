import {Button,IconButton} from '@pepbits/ui';
import {Table,TableContainer,TableRow,TableCell} from '@pepbits/components';
import {Plus,Trash2} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {useValueFormat} from '../fields';
import {MasterField} from './field';
import type {Field} from '../types';
export type StructureLine=Record<string,unknown>;
const numeric=(field:Field)=>['number','currency','percent'].includes(field.type);
const round=(value:number)=>Math.round(value*100)/100;
export function computeStructureLine(line:StructureLine):StructureLine {return 'qty' in line||'rate' in line?{...line,amount:round(Number(line.qty||0)*Number(line.rate||0))}:line;}
export function blankStructureLine(fields:Field[]):StructureLine {return computeStructureLine(Object.fromEntries(fields.map(field=>[field.key,numeric(field)?field.key==='qty'?1:0:field.type==='select'?field.options?.[0]??'':''])));}
export function structureTotals(lines:StructureLine[]) {
 const earnings=lines.filter(line=>line.kind!=='Deduction').reduce((sum,line)=>sum+Number(line.amount||0),0),deductions=lines.filter(line=>line.kind==='Deduction').reduce((sum,line)=>sum+Number(line.amount||0),0);
 const tax=lines.reduce((sum,line)=>sum+(line.kind==='Deduction'?-1:1)*Number(line.amount||0)*Number(line.tax||0)/100,0);
 return {earnings:round(earnings),deductions:round(deductions),tax:round(tax),subtotal:round(earnings-deductions),total:round(earnings-deductions+tax)};
}
/** ERP structure semantics over managed public table/field controls. No document/voucher behavior changes. */
export function StructureLines({fields,lines,onChange,readOnly,title='Components',disabled=false}:{fields:Field[];lines:StructureLine[];onChange:(lines:StructureLine[])=>void;readOnly:boolean;title?:string;disabled?:boolean}) {
 const {t}=useLocalization(),format=useValueFormat(),numbers=useFormatters(),totals=structureTotals(lines);
 return <div className="erp-structure-lines" data-structure-lines><header><h3>{t(title)}</h3><span>{numbers.number(lines.length)} {t(lines.length===1?'line':'lines')}</span>{!readOnly&&<Button size="sm" leftIcon={<Plus size={14}/>} disabled={disabled} onClick={()=>onChange([...lines,blankStructureLine(fields)])}>{t('Add line')}</Button>}</header>
 <TableContainer><Table aria-label={t(title)}><thead><tr><th scope="col">#</th>{fields.map(field=><th key={field.key} scope="col" data-numeric={numeric(field)} data-pool={!!field.pool}>{t(field.label)}</th>)}{!readOnly&&<th scope="col"><span className="sr-only">{t('Actions')}</span></th>}</tr></thead><tbody>
 {lines.map((line,index)=><TableRow key={index}><TableCell>{numbers.number(index+1)}</TableCell>{fields.map(field=><TableCell key={field.key} data-numeric={numeric(field)}>{readOnly||field.readOnly?<span>{format(field,line[field.key])}</span>:<MasterField field={{...field,label:`${field.label} ${index+1}`}} value={line[field.key]} compact disabled={disabled} onChange={value=>onChange(lines.map((item,i)=>i===index?computeStructureLine({...item,[field.key]:value}):item))}/>}</TableCell>)}{!readOnly&&<TableCell><IconButton label={`Remove line ${index+1}`} disabled={disabled} className="size-7" onClick={()=>onChange(lines.filter((_,i)=>i!==index))}><Trash2 size={14}/></IconButton></TableCell>}</TableRow>)}
 {!lines.length&&<TableRow><TableCell colSpan={fields.length+(readOnly?1:2)} className="erp-structure-empty">{t('No lines yet.')}{!readOnly&&' '+t('Use “Add line” to start.')}</TableCell></TableRow>}
 </tbody>{lines.length>0&&<tfoot><tr><td/>{fields.map((field,index)=><td key={field.key} data-numeric={numeric(field)}>{index===0?t('Total'):field.key==='amount'?numbers.money(totals.subtotal):''}</td>)}{!readOnly&&<td/>}</tr></tfoot>}</Table></TableContainer></div>;
}
