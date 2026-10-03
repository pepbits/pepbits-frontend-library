"use client";
import {useMemo} from "react";
import {createFormatters,LANGUAGE_LOCALES} from "@pepbits/erp-config";
import {useReferenceHost} from "@pepbits/reference-host";
import type { Category, Status } from "./types";

/* Times are facility wall-clock strings "YYYY-MM-DDTHH:mm" — treat them as UTC for maths only. */
const D = (s: string) => new Date((s.length === 10 ? s + "T00:00" : s.slice(0, 16)) + ":00Z");
export function useMedslotFormat(){const {preferences}=useReferenceHost();return useMemo(()=>{
 const f=createFormatters(preferences),locale=LANGUAGE_LOCALES[preferences.language];const part=(s:string,o:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat(locale,{timeZone:"UTC",...o}).format(D(s));
 return {fmtTime:(s:string)=>f.time(s),fmtDate:(s:string)=>f.date(s),fmtDateTime:(s:string)=>f.dateTime(s),fmtDay:(s:string)=>part(s,{weekday:"short"})+", "+f.date(s),fmtLongDay:(s:string)=>part(s,{weekday:"long"})+", "+f.date(s),fmtWeekday:(s:string)=>part(s,{weekday:"short"}),fmtDayNum:(s:string)=>part(s,{day:"numeric"}),fmtMonth:(s:string)=>part(s,{month:"long",year:"numeric"})};
 },[preferences]);}
export function addDays(date: string, n: number) { const d = D(date); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function addMinutes(dt: string, n: number) { return new Date(D(dt).getTime() + n * 60_000).toISOString().slice(0, 16); }
export function diffMinutes(a: string, b: string) { return Math.round((D(b).getTime() - D(a).getTime()) / 60_000); }
export function minutesOfDay(dt: string) { return Number(dt.slice(11, 13)) * 60 + Number(dt.slice(14, 16)); }
export function startOfWeek(date: string) { const wd = D(date).getUTCDay(); return addDays(date, wd === 0 ? -6 : 1 - wd); }
export function startOfMonth(date: string) { return date.slice(0, 8) + "01"; }
export function weekday(date: string) { return D(date).getUTCDay(); }
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export function labelHour(h: number) { return h === 0 ? "12 am" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`; }
export function age(dob: string | null | undefined) {
  if (!dob) return null;
  const b = new Date(dob), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}
export const duration = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`);
export const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
export const titleCase = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Browser "now" in the facility time zone isn't known client-side; the server sends facility_now. */
export function localNow(tz?: string) {
  const s = new Intl.DateTimeFormat("sv-SE", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  return s.replace(" ", "T").slice(0, 16);
}

export const STATUS: Record<Status, { label: string; dot: string; chip: string; block: string }> = {
  requested:   { label: "Requested",   dot: "bg-amber",   chip: "bg-amber-soft text-amber",     block: "bg-amber-soft border-amber/50 text-ink" },
  scheduled:   { label: "Scheduled",   dot: "bg-slot",    chip: "bg-slot-soft text-slot",       block: "bg-slot-soft border-slot/40 text-ink" },
  confirmed:   { label: "Confirmed",   dot: "bg-scrub",   chip: "bg-scrub-soft text-scrub-dark", block: "bg-scrub-soft border-scrub/40 text-ink" },
  checked_in:  { label: "Checked in",  dot: "bg-violet",  chip: "bg-violet-soft text-violet",   block: "bg-violet-soft border-violet/40 text-ink" },
  in_progress: { label: "In progress", dot: "bg-cyan",    chip: "bg-cyan-soft text-cyan",       block: "bg-cyan-soft border-cyan/50 text-ink" },
  completed:   { label: "Completed",   dot: "bg-ink-2",   chip: "bg-line-2 text-ink-2",         block: "bg-line-2 border-line text-ink-2" },
  cancelled:   { label: "Cancelled",   dot: "bg-triage",  chip: "bg-triage-soft text-triage",   block: "bg-panel border-triage/40 text-mute line-through hatch" },
  no_show:     { label: "No-show",     dot: "bg-triage",  chip: "bg-triage-soft text-triage",   block: "bg-triage-soft border-triage/50 text-ink" },
  rescheduled: { label: "Rescheduled", dot: "bg-mute",    chip: "bg-line-2 text-mute",          block: "bg-panel border-line text-mute hatch" },
};

/** Verbs for status buttons; keep names consistent with toasts. */
export const STATUS_ACTION: Partial<Record<Status, string>> = {
  scheduled: "Approve", confirmed: "Confirm", checked_in: "Check in", in_progress: "Start visit",
  completed: "Complete", cancelled: "Cancel", no_show: "Mark no-show",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  consultation: "Consultation", lab: "Laboratory", radiology: "Radiology", dental: "Dental", surgery: "Surgery",
  pharmacy: "Pharmacy", therapy: "Therapy", procedure: "Procedure", vaccination: "Vaccination", telehealth: "Video visit", admission: "Day care / bed",
};

export const VISIT_TYPES = [
  ["new_visit", "New visit"], ["follow_up", "Follow-up"], ["review", "Review"], ["procedure", "Procedure"], ["emergency", "Emergency"],
] as const;
export const SOURCES = [
  ["front_desk", "Front desk"], ["phone", "Phone"], ["walk_in", "Walk-in"], ["online", "Online"], ["referral", "Referral"], ["whatsapp", "WhatsApp"],
] as const;
