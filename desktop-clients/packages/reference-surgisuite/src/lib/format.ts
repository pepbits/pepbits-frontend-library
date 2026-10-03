"use client";
import {useMemo} from "react";
import {createFormatters,LANGUAGE_LOCALES} from "@pepbits/erp-config";
import {useReferenceHost} from "@pepbits/reference-host";
export const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  REQUESTED: { label: "Requested", tone: "neutral" },
  PENDING_APPROVAL: { label: "Awaiting approval", tone: "amber" },
  SCHEDULED: { label: "Scheduled", tone: "ceil" },
  CHECKED_IN: { label: "In pre-op", tone: "violet" },
  IN_OR: { label: "In room", tone: "violet" },
  IN_SURGERY: { label: "In surgery", tone: "go" },
  RECOVERY: { label: "Recovery", tone: "scrub" },
  COMPLETED: { label: "Completed", tone: "muted" },
  CANCELLED: { label: "Cancelled", tone: "stop" },
  POSTPONED: { label: "Postponed", tone: "amber" },
};

export type Tone = "neutral" | "amber" | "ceil" | "violet" | "go" | "scrub" | "muted" | "stop";

export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-steel-2 text-ink",
  amber: "bg-amber-soft text-amber",
  ceil: "bg-ceil-soft text-ceil-2",
  violet: "bg-violet-soft text-violet",
  go: "bg-go-soft text-go",
  scrub: "bg-[#dcebe8] text-scrub-2",
  muted: "bg-steel text-muted",
  stop: "bg-stop-soft text-stop",
};

export const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-faint",
  amber: "bg-amber",
  ceil: "bg-ceil",
  violet: "bg-violet",
  go: "bg-go",
  scrub: "bg-scrub-3",
  muted: "bg-[#aab5bb]",
  stop: "bg-stop",
};

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  SURGEON: "Surgeon",
  ASSISTANT_SURGEON: "Assistant surgeon",
  ANESTHESIOLOGIST: "Anesthesiologist",
  ANESTHESIA_TECH: "Anesthesia technician",
  SCRUB_NURSE: "Scrub nurse",
  CIRCULATING_NURSE: "Circulating nurse",
  RADIOGRAPHER: "Radiographer",
  PERFUSIONIST: "Perfusionist",
  OT_COORDINATOR: "Theatre coordinator",
  APPROVER: "Approver",
  BILLING: "Coder / billing",
};

export const APPROVAL_LABEL: Record<string, string> = {
  PRE_AUTH: "Insurance pre-authorization",
  ANESTHESIA_FITNESS: "Anesthesia fitness",
  HIGH_COST_IMPLANT: "High-cost implant",
  HOD_APPROVAL: "Head of department",
  ICU_BED: "ICU bed",
};

export const CONSENT_LABEL: Record<string, string> = {
  SURGERY: "Surgical procedure",
  ANESTHESIA: "Anesthesia",
  BLOOD: "Blood transfusion",
  IMPLANT: "Implant",
  PHOTOGRAPHY: "Clinical photography",
};

export const minutesBetween = (a?: string | null, b?: string | null) =>
  a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 60000) : null;

export const duration = (m?: number | null) => {
  if (m === null || m === undefined) return "—";
  const h = Math.floor(Math.abs(m) / 60);
  const mm = Math.abs(m) % 60;
  return `${m < 0 ? "−" : ""}${h ? `${h}h ` : ""}${mm}m`;
};

export const age = (dob?: string | null) => {
  if (!dob) return "—";
  const d = new Date(dob);
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
  return a;
};

export const localDateKey = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 16);
};

export const initials = (name: string) =>
  name
    .replace(/^Dr\.\s*/, "")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** Dates/times are instants; bare calendar days never acquire a UTC offset.
 * Monetary values retain the source backend's USD denomination. Preferences change
 * presentation, never convert or relabel money into an unrelated currency. */
export function useSourceFormat(){const {preferences}=useReferenceHost();return useMemo(()=>{
 const fmt=createFormatters({...preferences,currencyCode:"USD"});
 const value=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v:new Date(v);
 const valid=(v?:string|null)=>!!v&&!Number.isNaN(new Date(v).getTime());
 const date=(v?:string|null)=>valid(v)?fmt.date(value(v!)):"—";
 const time=(v?:string|null)=>valid(v)?fmt.time(value(v!) instanceof Date?value(v!) as Date:new Date(v!)):"—";
 const dateTime=(v?:string|null)=>valid(v)?`${date(v)}, ${time(v)}`:"—";
 const shortDate=(v?:string|null)=>valid(v)?`${new Intl.DateTimeFormat(LANGUAGE_LOCALES[preferences.language],{weekday:"short"}).format(new Date(v!))} ${date(v)}`:"—";
 const money=(v?:number|null)=>v==null?"—":fmt.money(v);
 return {date,time,dateTime,shortDate,money,number:fmt.number};
},[preferences]);}
