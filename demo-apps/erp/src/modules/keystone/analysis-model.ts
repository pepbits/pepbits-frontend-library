import type {Row} from './types';
import {localDay, shiftDay} from './dates';
export const PERIODS = [{value:'month',label:'This month'},{value:'q',label:'Last 90 days'},{value:'year',label:'Last 12 months'},{value:'all',label:'All time'},{value:'custom',label:'Custom'}];
export function periodRange(preset: string, today = localDay()): [string,string] {
  return [preset === 'month' ? today.slice(0,8) + '01' : preset === 'q' ? shiftDay(today,-90) : preset === 'year' ? shiftDay(today,-365) : '2000-01-01',today];
}
export function ledgerStatement(rows: Row[], from: string, to: string) {
  const sorted = [...rows].sort((a,b) => String(a.date).localeCompare(String(b.date))), delta = (row: Row) => Number(row.debit || 0) - Number(row.credit || 0);
  const opening = sorted.filter(row => row.date < from).reduce((sum,row) => sum + delta(row),0);
  let balance = opening, debit = 0, credit = 0;
  const lines = sorted.filter(row => row.date >= from && row.date <= to).map(row => {balance += delta(row); debit += Number(row.debit || 0); credit += Number(row.credit || 0); return {...row,balance} as Row & {balance:number};});
  return {opening,lines,debit,credit,closing:balance};
}
export function matrixPeriod(kind: string, today = localDay()) {
  if (kind === 'attendance') return today.slice(0,7);
  if (kind === 'marks') return 'Term 1';
  return shiftDay(today, -((new Date(today + 'T12:00:00').getDay() + 6) % 7));
}
export function moveMatrixPeriod(kind: string, period: string, direction: number) {
  if (kind === 'attendance') {const date = new Date(period + '-01T12:00:00');date.setMonth(date.getMonth() + direction);return localDay(date).slice(0,7);}
  return shiftDay(period,direction * 7);
}
export function matrixSummary(kind: string, cells: (string|number|null)[]) {
  const total = cells.reduce<number>((sum,value) => sum + (Number(value) || 0),0);
  if (kind === 'attendance') {const present = cells.filter(value => value === 'P').length + cells.filter(value => value === 'H').length * .5, working = cells.filter(value => value && value !== 'WO').length;return {total:present,percent:working ? Math.round(present / working * 100) : 0,absent:cells.filter(value => value === 'A').length,leave:cells.filter(value => value === 'L').length};}
  if (kind === 'hours') return {total,overtime:Math.max(0,total - 40)};
  const percent = cells.length ? Math.round(total / cells.length) : 0;
  return {total,percent,grade:percent >= 90 ? 'A+' : percent >= 80 ? 'A' : percent >= 70 ? 'B' : percent >= 60 ? 'C' : percent >= 45 ? 'D' : 'E'};
}
