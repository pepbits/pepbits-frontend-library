import { db, getSetting } from "../db.js";
import { addMinutes, nowLocal } from "../lib/time.js";
import { notify } from "../lib/notify.js";

/**
 * Sends one reminder per configured lead time (e.g. 24h and 2h before).
 * Dedupe keys make this safe to run often and across restarts.
 */
export async function runReminders() {
  const hours = getSetting("reminder_hours", "24,2").split(",").map(Number).filter((h) => h > 0).sort((a, b) => a - b);
  if (!hours.length) return;
  const now = nowLocal();
  const maxH = hours[hours.length - 1];
  const due = db.prepare(`
    SELECT id, start_at, requested_at FROM appointments
    WHERE status IN ('scheduled','confirmed') AND start_at > ? AND start_at <= ?`).all(now, addMinutes(now, maxH * 60)) as { id: number; start_at: string; requested_at: string }[];
  for (const a of due) {
    // Pick the closest lead time that has been reached, so late bookings don't get a burst of reminders.
    const h = hours.find((x) => a.start_at <= addMinutes(now, x * 60));
    if (!h) continue;
    // Skip if the booking itself was made inside this window recently; the booking message covers it.
    if (a.requested_at > addMinutes(now, -30)) continue;
    await notify(a.id, "reminder", { dedupePrefix: `reminder:${a.id}:${h}`, extra: { reminder_hours: String(h) } });
  }
}

