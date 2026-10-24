/** Half-open minute intervals: adjacent events do not overlap. */
export function overlaps(start: number, duration: number, otherStart: number, otherDuration: number) {
  return duration > 0 && otherDuration > 0 && start < otherStart + otherDuration && otherStart < start + duration;
}
export function timeMinutes(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  const [hours, minutes] = value.split(':').map(Number);
  return hours! * 60 + minutes!;
}
export const minuteTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export interface TimelineInterval {id: string; start: number; duration: number}
/** Clip to the viewport and pack overlapping intervals into separate, equal-width lanes. */
export function timelineLayout<T extends TimelineInterval>(events: readonly T[], start: number, end: number) {
  const sorted = events.filter(e => Number.isFinite(e.start) && Number.isFinite(e.duration) && overlaps(e.start, e.duration, start, end - start))
    .map(event => ({event, start: Math.max(start, event.start), end: Math.min(end, event.start + event.duration), lane: 0, lanes: 1}))
    .sort((a, b) => a.start - b.start || b.end - a.end || a.event.id.localeCompare(b.event.id));
  let group: typeof sorted = [], ends: number[] = [], groupEnd = -Infinity;
  const finish = () => {for (const item of group) item.lanes = ends.length; group = []; ends = [];};
  for (const item of sorted) {
    if (item.start >= groupEnd) finish();
    let lane = ends.findIndex(end => end <= item.start);
    if (lane < 0) lane = ends.length;
    item.lane = lane; ends[lane] = item.end; group.push(item); groupEnd = Math.max(...ends);
  }
  finish();
  return sorted;
}
