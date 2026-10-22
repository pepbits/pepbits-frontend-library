// Local facility time helpers. Strings are 'YYYY-MM-DDTHH:MM'; math in absolute minutes (UTC-based to avoid DST drift).
export const DAY = 1440;
export function toMin(s: string): number {
  const [d, t = '00:00'] = s.split('T');
  const [y, m, dd] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return Math.floor(Date.UTC(y, m - 1, dd, hh, mm) / 60000);
}
export function fromMin(n: number): string {
  const d = new Date(n * 60000); const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
export const addDays = (date: string, n: number) => fromMin(toMin(date + 'T00:00') + n * DAY).slice(0, 10);
export const time = (s?: string | null) => (s ? s.slice(11, 16) : '');
export function nowLocal(): string {
  const d = new Date(); const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const todayLocal = () => nowLocal().slice(0, 10);
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const weekdayIdx = (date: string) => new Date(toMin(date + 'T00:00') * 60000).getUTCDay();
export const wd = (date: string) => WD[weekdayIdx(date)];
export const WEEKDAYS = WD;
export function niceDate(date: string, today?: string): string {
  const d = date.slice(0, 10);
  if (today) {
    if (d === today) return 'Today';
    if (d === addDays(today, 1)) return 'Tomorrow';
    if (d === addDays(today, -1)) return 'Yesterday';
  }
  const [, m, dd] = d.split('-').map(Number);
  return `${wd(d)} ${dd} ${MO[m - 1]}`;
}
export const niceDateTime = (s: string, today?: string) => `${niceDate(s, today)}, ${time(s)}`;
export function dur(min: number): string {
  if (min < 60) return `${min} min`;
  if (min < DAY) { const h = Math.floor(min / 60), m = min % 60; return m ? `${h} h ${m} min` : `${h} h`; }
  const d = Math.floor(min / DAY), h = Math.round((min % DAY) / 60); return h ? `${d} d ${h} h` : `${d} day${d > 1 ? 's' : ''}`;
}
export const hm = (minOfDay: number) => `${String(Math.floor(minOfDay / 60) % 24).padStart(2, '0')}:${String(minOfDay % 60).padStart(2, '0')}`;
export function ago(s: string, now = nowLocal()): string {
  const diff = toMin(now) - toMin(s);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff} min ago`;
  if (diff < DAY) return `${Math.floor(diff / 60)} h ago`;
  return `${Math.floor(diff / DAY)} d ago`;
}
export function age(dob?: string | null) {
  if (!dob) return '';
  const [y, m, d] = dob.split('-').map(Number); const n = new Date();
  let a = n.getFullYear() - y; if (n.getMonth() + 1 < m || (n.getMonth() + 1 === m && n.getDate() < d)) a--; return a;
}
