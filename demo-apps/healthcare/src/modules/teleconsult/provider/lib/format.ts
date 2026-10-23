import type { AppointmentStatus, Patient } from "../../shared/types";

export { useTeleconsultFormat } from "../../shared/format";
export { localId } from "../../shared/hooks";

export const fullName = (p: Pick<Patient, "firstName" | "lastName">) => `${p.firstName} ${p.lastName}`;
export const initials = (name: string) =>
  name
    .replace(/^(Dr\.)\s*/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

export function age(dob: string) {
  const d = new Date(dob);
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
  return a;
}

export const sexShort = (s: Patient["sex"]) => (s === "female" ? "F" : s === "male" ? "M" : "X");

/** mm:ss clock for call and recording timers (a duration, not a calendar value). */
export const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const STATUS: Record<AppointmentStatus, { label: string; cls: string; dot: string }> = {
  booked: { label: "Booked", cls: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  waiting: { label: "In waiting room", cls: "bg-caution-50 text-caution-600", dot: "bg-caution-500" },
  triage: { label: "In triage", cls: "bg-[#EEF0FB] text-[#3B4BA9]", dot: "bg-[#5865C6]" },
  ready: { label: "Ready for doctor", cls: "bg-pulse-50 text-pulse-700", dot: "bg-pulse-500" },
  "in-call": { label: "In consultation", cls: "bg-vital-50 text-vital-600", dot: "bg-vital-500" },
  completed: { label: "Completed", cls: "bg-slate-100 text-slate-500", dot: "bg-slate-300" },
  cancelled: { label: "Cancelled", cls: "bg-alarm-50 text-alarm-600", dot: "bg-alarm-500" },
  "no-show": { label: "No-show", cls: "bg-alarm-50 text-alarm-600", dot: "bg-alarm-500" },
};
