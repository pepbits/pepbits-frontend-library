import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";

export const uid = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

/** Human-readable running numbers, e.g. RX-104233, stored in settings. */
export function nextNo(series: string, prefix: string, start = 100000) {
  const key = `seq:${series}`;
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  const next = row ? Number(row.value) + 1 : start + 1;
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(next));
  return `${prefix}-${next}`;
}
