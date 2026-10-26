import {Badge,Button,DateInput,IconButton} from '@pepbits/ui';
import {X} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {localDay} from '../dates';
import type {Row} from '../types';
import type {DataColumn} from '@pepbits/page-engines/types';

export const rateColumns:DataColumn[]=[{key:'validity',label:'Validity',classification:'unclassified',type:'text',sortable:false}];
export function validity(row:Partial<Row>,on=localDay()) {return row.effectiveFrom&&row.effectiveFrom>on?'Upcoming':row.effectiveTo&&row.effectiveTo<on?'Expired':'Active';}
export function RateDate({value,onChange}:{value:string;onChange:(value:string)=>void}) {
 const {t}=useLocalization();return <div data-rate-date className="erp-rate-date"><DateInput label="Valid on" value={value} onChange={event=>onChange(event.target.value)}/>{value?<IconButton label="Show all dates" className="size-7" onClick={()=>onChange('')}><X size={14}/></IconButton>:<Button size="sm" variant="ghost" onClick={()=>onChange(localDay())}>{t('Today')}</Button>}</div>;
}
export function RateValidity({row,asOf}:{row:Partial<Row>;asOf:string}) {
 const {t}=useLocalization(),format=useFormatters(),status=validity(row,asOf||undefined),today=validity(row),start=Date.now()-365*864e5;
 const position=(value:string|undefined,fallback:number)=>value?Math.max(0,Math.min(1,(new Date(value+'T00:00:00').getTime()-start)/(730*864e5))):fallback;
 const a=position(row.effectiveFrom,0),b=position(row.effectiveTo,1),description=`${format.date(row.effectiveFrom)} – ${row.effectiveTo?format.date(row.effectiveTo):t('Open-ended')}`;
 return <div data-rate-validity className="erp-rate-validity"><Badge tone={status==='Active'?'success':status==='Upcoming'?'info':'neutral'}>{t(status)}</Badge><span data-validity-bar className="erp-validity-bar" title={description} aria-label={description} role="img"><span style={{insetInlineStart:`${a*100}%`,width:`${Math.max(2,(b-a)*100)}%`,background:today==='Active'?'var(--success)':today==='Upcoming'?'var(--info)':'var(--border-strong)'}}/><i/></span></div>;
}
