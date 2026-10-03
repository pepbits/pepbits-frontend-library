import { twMerge } from "tailwind-merge";
import type { Coverage, Patient } from "./types";

/** Join class names; later Tailwind utilities override earlier conflicting ones (h-10 then h-8 gives h-8). */
export const cx = (...parts: Array<string | false | null | undefined>) => twMerge(parts.filter(Boolean).join(" "));

export const uid = (prefix = "id") =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export const fullName = (p: Pick<Patient, "firstName" | "middleName" | "lastName">) =>
  [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");

export const initials = (p: Pick<Patient, "firstName" | "lastName">) =>
  `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase();

export function ageOf(dob: string, at = new Date()): string {
  if (!dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  let years = at.getFullYear() - d.getFullYear();
  const m = at.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < d.getDate())) years--;
  if (years >= 2) return `${years}y`;
  const months = (at.getFullYear() - d.getFullYear()) * 12 + m - (at.getDate() < d.getDate() ? 1 : 0);
  return `${Math.max(months, 0)}m`;
}

export const toDateInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const toDateTimeInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${toDateInput(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "";

export const fmtDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

export const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";

export const daysBetween = (a: Date, b: Date) =>
  Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const isSameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

export const relativeDay = (iso: string, now = new Date()) => {
  const diff = daysBetween(new Date(iso), now);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff === -1) return "tomorrow";
  if (diff > 0) return `${diff} days ago`;
  return `in ${-diff} days`;
};

export const coverageActive = (c: Coverage, at = new Date()) => {
  const d = toDateInput(at);
  return c.validFrom <= d && d <= c.validTo;
};

export const normalize = (s: string) => s.toLowerCase().replace(/[\s\-()+]/g, "");
