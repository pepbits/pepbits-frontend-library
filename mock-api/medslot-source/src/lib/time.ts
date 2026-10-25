/**
 * All appointment times are stored as facility-local wall-clock strings: "YYYY-MM-DDTHH:mm".
 * This keeps slot maths free of DST/offset bugs. The facility time zone is FACILITY_TZ.
 * Internally we use Date objects in UTC purely as a calendar calculator.
 */
import { config } from "../config.js";

export const DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

const toDate = (dt: string) => new Date(dt + ":00Z");
const fmt = (d: Date) => d.toISOString().slice(0, 16);

export function addMinutes(dt: string, minutes: number) {
  return fmt(new Date(toDate(dt).getTime() + minutes * 60_000));
}
export function addDays(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function diffMinutes(a: string, b: string) {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 60_000);
}
export function weekday(date: string) {
  return new Date(date + "T00:00:00Z").getUTCDay();
}
export function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export function minutesToTime(m: number) {
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
/** Current wall-clock time at the facility, "YYYY-MM-DDTHH:mm". */
export function nowLocal(): string {
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: config.facilityTz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date());
  return s.replace(" ", "T").slice(0, 16);
}
export function todayLocal() {
  return nowLocal().slice(0, 10);
}
export function prettyDateTime(dt: string) {
  const d = toDate(dt);
  return d.toLocaleString("en-GB", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}
