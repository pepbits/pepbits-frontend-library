/* Pure helpers kept from the Scholaris source. Display formatting lives in ./format.tsx because it must read
   the host's effective preferences; nothing here touches the clock-dependent locale or storage. */

type ClassValue = string | number | false | null | undefined | ClassValue[] | Record<string, boolean | null | undefined>;

/** Joins class names (clsx semantics). The source's tailwind-merge pass is not needed: shared controls own their base classes. */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (value: ClassValue) => {
    if (!value && value !== 0) return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (typeof value === "object") { for (const [k, on] of Object.entries(value)) if (on) out.push(k); return; }
    out.push(String(value));
  };
  inputs.forEach(walk);
  return out.join(" ");
}

export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export const isoDay = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** A calendar date ("YYYY-MM-DD") is read as a local day; `new Date("YYYY-MM-DD")` would be UTC midnight and shift west of Greenwich. */
export function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

export function gradeFor(pct: number) {
  if (pct >= 90) return { grade: "A+", point: 4.0 };
  if (pct >= 80) return { grade: "A", point: 3.7 };
  if (pct >= 70) return { grade: "B+", point: 3.3 };
  if (pct >= 60) return { grade: "B", point: 3.0 };
  if (pct >= 50) return { grade: "C", point: 2.3 };
  if (pct >= 40) return { grade: "D", point: 1.7 };
  return { grade: "F", point: 0 };
}

export function relativeFromNow(iso: string, now = Date.now()) {
  const diff = toDate(iso).getTime() - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const unit = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
}

export type CsvCell = string | number | null | undefined;

/* A leading = + - @ makes a spreadsheet evaluate the cell; text cells are prefixed with an apostrophe (numbers are
   left alone), the same guard as the shared worklist export. */
const formulaSafe = (value: CsvCell) => {
  if (typeof value === "number") return String(value);
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) && !Number.isFinite(Number(text)) ? `'${text}` : text;
};

export function toCsv(rows: CsvCell[][]) {
  return rows.map((r) => r.map((c) => `"${formulaSafe(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

/** Browser download of already-authorized rows. Callers go through useSchoolExport() so the export preference/lock is applied. */
export function downloadCsv(filename: string, rows: CsvCell[][]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Avatar hues are derived from the name so a person keeps the same colour everywhere. */
const HUES = [212, 160, 28, 340, 262, 190, 8, 128, 290, 45];
export const avatarHue = (name: string) => HUES[hashStr(name) % HUES.length];
