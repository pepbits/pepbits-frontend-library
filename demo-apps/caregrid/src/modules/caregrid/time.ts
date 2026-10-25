// Facility wall-clock helpers. Strings are 'YYYY-MM-DDTHH:MM'; arithmetic uses absolute
// minutes on a UTC basis so daylight-saving transitions never shift a booking.
export const DAY = 1440;
export function toMin(value: string): number {
  const [date, clock = '00:00'] = value.split('T');
  const [y, m, d] = date!.split('-').map(Number);
  const [hh, mm] = clock.split(':').map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!, hh!, mm!) / 60000);
}
export function fromMin(minutes: number): string {
  const date = new Date(minutes * 60000), pad = (x: number) => String(x).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}
export const addDays = (date: string, days: number) => fromMin(toMin(date + 'T00:00') + days * DAY).slice(0, 10);
export const weekdayIndex = (date: string) => new Date(toMin(date + 'T00:00') * 60000).getUTCDay();
/** Minutes since local midnight of `date` (may exceed a day for overnight holds). */
export const minuteOfDay = (value: string, date: string) => toMin(value) - toMin(date + 'T00:00');
export const hm = (minuteOfDay: number) => `${String(Math.floor(minuteOfDay / 60) % 24).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`;
export const fromHM = (value: string) => {const [h, m] = value.split(':').map(Number); return h! * 60 + m!;};
/** The browser's local wall clock in facility format. */
export function nowLocal(): string {
  const now = new Date(), pad = (x: number) => String(x).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
export function age(dob?: string | null, today = nowLocal().slice(0, 10)): number | '' {
  if (!dob) return '';
  const [y, m, d] = dob.split('-').map(Number), [ty, tm, td] = today.split('-').map(Number);
  let years = ty! - y!; if (tm! < m! || (tm === m && td! < d!)) years--; return years;
}
/** Pack holds into lanes so overlapping capacity use stays visible. */
export function lanes<T extends {id: number; hold_start: string; hold_end: string}>(holds: readonly T[]) {
  const sorted = holds.slice().sort((a, b) => a.hold_start.localeCompare(b.hold_start)), ends: string[] = [], map = new Map<number, number>();
  for (const hold of sorted) {
    let lane = ends.findIndex(end => end <= hold.hold_start);
    if (lane < 0) {lane = ends.length; ends.push(hold.hold_end);} else ends[lane] = hold.hold_end;
    map.set(hold.id, lane);
  }
  return {map, count: Math.max(1, ends.length)};
}
