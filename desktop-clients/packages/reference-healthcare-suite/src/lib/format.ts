import { useMemo } from 'react';
import { createFormatters, LANGUAGE_LOCALES } from '@pepbits/erp-config';
import { useReferenceHost } from '@pepbits/reference-host';
const toDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
/** Presentation uses the host's effective locale, currency, decimal, date and clock choices. */
export function useFormat() {
  const { preferences } = useReferenceHost();
  return useMemo(() => {
    const f = createFormatters(preferences);
    const fmtDate = (iso?: string) => iso ? f.date(toDate(iso)) : '';
    const fmtTime = (iso?: string) => iso ? f.time(/^\d\d:\d\d$/.test(iso) ? iso : toDate(iso)) : '';
    const fmtDateTime = (iso?: string) => iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : '';
    return { money: (n: number | null | undefined) => f.money(Number(n) || 0), fmtDate, fmtTime, fmtDateTime,
      fmtDay: (iso: string) => new Intl.DateTimeFormat(LANGUAGE_LOCALES[preferences.language], { weekday:'long', day:'numeric', month:'long' }).format(toDate(iso)),
      sinceLabel: (iso: string) => fmtDateTime(iso), number: f.number };
  }, [preferences]);
}
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const addDays = (iso: string, days: number) => { const d = toDate(iso); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const ageLabel = (age: number | null | undefined, gender?: string) => [age !== null && age !== undefined ? `${age}y` : '', gender ? gender[0] : ''].filter(Boolean).join(' / ');
export const initials = (name = '') => name.replace(/^Dr\.\s*/, '').split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase();
export const minutes = (hhmm: string) => { const [h,m] = hhmm.split(':').map(Number); return h*60+(m||0); };
