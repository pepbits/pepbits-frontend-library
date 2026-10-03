/** Server timestamps are UTC 'YYYY-MM-DD HH:MM:SS'. */
export function toDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? null : d;
}
const pad = (n: number) => String(n).padStart(2, '0');
export function fmtDateTime(s?: string | null) {
  const d = toDate(s);
  if (!d) return '';
  return `${pad(d.getDate())} ${d.toLocaleString('en', { month: 'short' })} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtDate(s?: string | null) {
  if (!s) return '';
  const d = s.length === 10 ? new Date(s + 'T00:00:00') : toDate(s);
  if (!d) return s;
  return `${pad(d.getDate())} ${d.toLocaleString('en', { month: 'short' })} ${d.getFullYear()}`;
}
export function fmtTime(s?: string | null) {
  const d = toDate(s);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
}
export function ago(s?: string | null) {
  const d = toDate(s);
  if (!d) return '';
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ${m % 60} min ago`;
  return `${Math.floor(m / 1440)} d ago`;
}
export function minutesText(m?: number | null) {
  if (m === null || m === undefined) return '';
  const a = Math.abs(Math.round(m));
  const t = a < 60 ? `${a} min` : a < 1440 ? `${Math.floor(a / 60)} h ${a % 60} min` : `${Math.floor(a / 1440)} d ${Math.floor((a % 1440) / 60)} h`;
  return m < 0 ? `${t} over` : `${t} left`;
}
export function age(dob?: string | null) {
  if (!dob) return '';
  const d = new Date(dob);
  const y = (Date.now() - d.getTime()) / (365.25 * 864e5);
  if (y >= 2) return `${Math.floor(y)}y`;
  const m = y * 12;
  if (m >= 1) return `${Math.floor(m)}m`;
  return `${Math.floor(y * 365.25)}d`;
}
export const fullName = (p: any) => [p?.first_name, p?.last_name].filter(Boolean).join(' ');
export const patientLine = (p: any) => `${fullName(p)}${p?.gender || p?.dob ? ` (${[age(p.dob), p.gender].filter(Boolean).join(' ')})` : ''}`;
export const money = (n?: number | null) => (Number(n) || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const titleCase = (s?: string | null) => (s || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export function todayIso(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
