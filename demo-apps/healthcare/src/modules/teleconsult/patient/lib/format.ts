export { useTeleconsultFormat } from "../../shared/format";

export const initials = (name: string) =>
  name.replace(/^(Dr\.)\s*/, "").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** mm:ss clock for the call timer (a duration, not a calendar value). */
export const fmtDuration = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
