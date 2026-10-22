// All scheduling math uses "absolute minutes": minutes since 1970-01-01T00:00 in local facility time.
// Strings are 'YYYY-MM-DDTHH:MM'. Using UTC internally avoids daylight-saving surprises.

export const DAY = 1440;

export function toMin(s: string): number {
  const [d, t = '00:00'] = s.split('T');
  const [y, m, dd] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return Math.floor(Date.UTC(y, m - 1, dd, hh, mm) / 60000);
}

export function fromMin(n: number): string {
  const d = new Date(n * 60000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function dateOf(n: number): string {
  return fromMin(n).slice(0, 10);
}

export function dayStart(date: string): number {
  return toMin(`${date}T00:00`);
}

export function weekday(dayStartMin: number): number {
  return new Date(dayStartMin * 60000).getUTCDay();
}

/** ISO-ish week number parity used for alternate-week rotas. */
export function weekParity(dayStartMin: number): number {
  const days = Math.floor(dayStartMin / DAY);
  // 1970-01-01 was a Thursday; shift so weeks start on Monday
  return Math.floor((days + 3) / 7) % 2;
}

/** Current local time (server clock), rounded down to the minute. */
export function nowMin(): number {
  const d = new Date();
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()) / 60000);
}

export function nowStr(): string {
  return fromMin(nowMin());
}

export function todayStr(): string {
  return fromMin(nowMin()).slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return dateOf(dayStart(date) + n * DAY);
}

export function hhmm(minOfDay: number): string {
  const m = ((minOfDay % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface Interval { s: number; e: number }

export function overlaps(a: Interval, b: Interval): boolean {
  return a.s < b.e && b.s < a.e;
}

export function subtract(windows: Interval[], blocks: Interval[]): Interval[] {
  let out = windows.slice();
  for (const b of blocks) {
    const next: Interval[] = [];
    for (const w of out) {
      if (!overlaps(w, b)) { next.push(w); continue; }
      if (b.s > w.s) next.push({ s: w.s, e: b.s });
      if (b.e < w.e) next.push({ s: b.e, e: w.e });
    }
    out = next;
  }
  return out;
}

export function median(xs: number[]): number {
  return percentile(xs, 50);
}

export function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const a = xs.slice().sort((x, y) => x - y);
  const idx = (p / 100) * (a.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return a[lo] + (a[hi] - a[lo]) * (idx - lo);
}
