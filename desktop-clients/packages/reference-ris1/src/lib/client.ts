'use client';
import {useDiagnosticResource,useDiagnosticFormat} from '@pepbits/reference-diagnostics';
export function useApi<T=any>(path:string|null,opts:{poll?:number}={}){return useDiagnosticResource<T>(path,undefined,opts.poll);}
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'USD';

export const fmt = {
  date: (v?: string | null) => (v ? new Date(v.length === 10 ? v + 'T00:00:00' : v).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'),
  time: (v?: string | null) => (v ? new Date(v).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—'),
  dateTime: (v?: string | null) => (v ? `${fmt.date(v)}, ${fmt.time(v)}` : '—'),
  money: (n?: number | null) => new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY, maximumFractionDigits: 2 }).format(Number(n || 0)),
  minutes: (m?: number | null) => {
    if (m == null) return '—';
    const neg = m < 0;
    const a = Math.abs(Math.round(m));
    const s = a < 60 ? `${a}m` : a < 1440 ? `${Math.floor(a / 60)}h ${a % 60}m` : `${Math.floor(a / 1440)}d ${Math.floor((a % 1440) / 60)}h`;
    return neg ? `-${s}` : s;
  },
  ago: (v?: string | null) => {
    if (!v) return '—';
    const m = (Date.now() - new Date(v).getTime()) / 60000;
    if (m < 1) return 'just now';
    return `${fmt.minutes(m)} ago`;
  },
  age: (dob?: string | null) => {
    if (!dob) return '';
    const d = new Date(dob);
    const n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--;
    return `${a}y`;
  },
  name: (o: { first_name?: string; last_name?: string }) => `${o.last_name?.toUpperCase() || ''}, ${o.first_name || ''}`,
  status: (s?: string | null) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : ''),
};

export function toLocalInput(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function useFmt(){const f=useDiagnosticFormat();return {...fmt,date:f.fmtDate,time:f.fmtTime,dateTime:f.fmtDateTime,money:f.money};}
