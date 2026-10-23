import {createFormatters,formatCompactMoney,formatShortDate} from '@pepbits/i18n';
import type {UserPreferences} from '@pepbits/preferences';
import type {Field} from './types';
/** Keystone wire field types mapped to the public, preference-bound formatters. */
export function createReferenceFormat(preferences:UserPreferences){const f=createFormatters(preferences);
 const fmtCurrency=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?f.money(value):'—';
 const fmtDate=(value:unknown,withYear=true)=>!value?'—':withYear?f.date(String(value)):formatShortDate(preferences,String(value));
 const fmtTime=(value:unknown,seconds=false)=>value==null||value===''?'—':f.time(String(value),{seconds});
 const fmtValue=(field:Field,value:unknown):string=>value==null||value===''?'—':field.type==='currency'?fmtCurrency(Number(value)):field.type==='percent'?f.percent(Number(value)):field.type==='number'?f.number(Number(value)):field.type==='date'?fmtDate(value):field.type==='time'?fmtTime(value):field.type==='boolean'?value?'Yes':'No':String(value);
 return {fmtCurrency,fmtDate,fmtTime,fmtValue,fmtCompact:(value:unknown)=>formatCompactMoney(preferences,value)};
}
