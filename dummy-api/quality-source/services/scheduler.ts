import crypto from "node:crypto";
import type { Request } from "express";
import { db, nowIso, parseJson } from "../db.js";
import { audit } from "../auth.js";
import { addMonths, monthKey } from "../domain.js";
import { renderReport, templateConfig } from "./reports.js";

/** Schedules run in facility-local time. All seeded facilities are in the UAE (UTC+4, no DST). */
export const SCHEDULE_TZ = "Asia/Dubai";
const TZ_OFFSET_HOURS = 4;

export interface ScheduleRow {
  id: number;
  name: string;
  template_id: number;
  authority_id: number | null;
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  facility_ids: string;
  recipients: string;
  format: string;
  require_approval: number;
  active: number;
  next_run_at: string | null;
}

export function computeNextRun(s: Pick<ScheduleRow, "frequency" | "day_of_week" | "day_of_month" | "time_of_day">, after = new Date()): string {
  const [hh, mm] = s.time_of_day.split(":").map(Number);
  const localNow = new Date(after.getTime() + TZ_OFFSET_HOURS * 3600000);
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() + i, hh, mm));
    const utc = new Date(d.getTime() - TZ_OFFSET_HOURS * 3600000);
    if (utc <= after) continue;
    const dom = d.getUTCDate();
    const dow = d.getUTCDay();
    const month = d.getUTCMonth();
    if (s.frequency === "daily") return utc.toISOString();
    if (s.frequency === "weekly" && dow === (s.day_of_week ?? 1)) return utc.toISOString();
    if (s.frequency === "monthly" && dom === (s.day_of_month ?? 1)) return utc.toISOString();
    if (s.frequency === "quarterly" && month % 3 === 0 && dom === (s.day_of_month ?? 1)) return utc.toISOString();
  }
  throw new Error("Could not compute the next run for this schedule.");
}

/** The reporting period a run covers: the last complete month or quarter, or month-to-date for daily/weekly. */
export function periodForRun(frequency: ScheduleRow["frequency"], runAt = new Date()) {
  const current = monthKey(new Date(runAt.getTime() + TZ_OFFSET_HOURS * 3600000));
  if (frequency === "monthly") {
    const p = addMonths(current, -1);
    return { from: p, to: p };
  }
  if (frequency === "quarterly") {
    const [y, m] = current.split("-").map(Number);
    const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
    const thisQuarterStart = `${y}-${String(qStartMonth).padStart(2, "0")}`;
    const from = addMonths(thisQuarterStart, -3);
    return { from, to: addMonths(from, 2) };
  }
  // Daily and weekly runs report the most recent complete month; results for the current month are still being collected.
  const p = addMonths(current, -1);
  return { from: p, to: p };
}

export function nextSubmissionReference(authorityCode: string | null): string {
  const year = new Date().getUTCFullYear();
  const count = (db.prepare("SELECT COUNT(*) AS n FROM submissions").get() as { n: number }).n + 1;
  return `SUB-${authorityCode ?? "INT"}-${year}-${String(count).padStart(5, "0")}`;
}

export function addSubmissionEvent(submissionId: number, status: string, note: string, userId: number | null) {
  db.prepare("INSERT INTO submission_events (submission_id, status, note, user_id, created_at) VALUES (?,?,?,?,?)").run(
    submissionId,
    status,
    note,
    userId,
    nowIso(),
  );
}

export function channelNote(authorityId: number | null, recipients: string[]): string {
  if (!authorityId) return `Distributed to ${recipients.length ? recipients.join(", ") : "configured recipients"} (simulated delivery).`;
  const a = db.prepare("SELECT name, channel, endpoint FROM authorities WHERE id = ?").get(authorityId) as { name: string; channel: string; endpoint: string | null } | undefined;
  if (!a) return "Transmitted (simulated).";
  const channelLabel: Record<string, string> = {
    portal_upload: "prepared for portal upload",
    sftp: "transmitted via SFTP",
    api: "transmitted via API",
    email: "sent by secure email",
  };
  return `${a.name}: ${channelLabel[a.channel] ?? "transmitted"}${a.endpoint ? ` (${a.endpoint})` : ""}. Delivery adapter is simulated in this environment.`;
}

/** Creates a report run and submission for a schedule. Used by the background loop and "Run now". */
export function executeSchedule(schedule: ScheduleRow, req: Request | null, trigger: "schedule" | "manual") {
  const tpl = templateConfig(schedule.template_id);
  if (!tpl) throw new Error("The report template for this schedule no longer exists.");
  const period = periodForRun(schedule.frequency);
  const facilityIds = parseJson<number[]>(schedule.facility_ids, []);
  const recipients = parseJson<string[]>(schedule.recipients, []);
  const rendered = renderReport({ config: tpl.config, periodFrom: period.from, periodTo: period.to, facilityIds });
  const now = nowIso();
  const userId = req?.user?.id ?? null;

  const result = db.transaction(() => {
    const run = db
      .prepare(
        `INSERT INTO report_runs (template_id, period_from, period_to, facility_ids, trigger, schedule_id, generated_by, generated_at, checksum, summary)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(schedule.template_id, period.from, period.to, JSON.stringify(facilityIds), trigger === "manual" ? "manual" : "schedule", schedule.id, userId, now, rendered.checksum, JSON.stringify(rendered.summary));

    const authority = schedule.authority_id
      ? (db.prepare("SELECT code FROM authorities WHERE id = ?").get(schedule.authority_id) as { code: string } | undefined)
      : undefined;
    const status = schedule.require_approval ? "pending_approval" : "transmitted";
    const reference = nextSubmissionReference(authority?.code ?? null);
    const sub = db
      .prepare(
        `INSERT INTO submissions (reference, template_id, authority_id, schedule_id, report_run_id, period_from, period_to, format, status, checksum, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(reference, schedule.template_id, schedule.authority_id, schedule.id, run.lastInsertRowid, period.from, period.to, schedule.format, status, rendered.checksum, userId, now, now);
    const subId = Number(sub.lastInsertRowid);
    addSubmissionEvent(subId, "prepared", `Report generated for ${period.from}${period.to !== period.from ? ` to ${period.to}` : ""} (${trigger === "manual" ? "run now" : "scheduled run"}).`, userId);
    if (status === "transmitted") addSubmissionEvent(subId, "transmitted", channelNote(schedule.authority_id, recipients), userId);
    else addSubmissionEvent(subId, "pending_approval", "Awaiting approval before transmission.", userId);

    const nextRun = computeNextRun(schedule);
    db.prepare("UPDATE schedules SET last_run_at = ?, last_status = ?, next_run_at = ?, updated_at = ? WHERE id = ?").run(now, status, nextRun, now, schedule.id);
    return { submissionId: subId, reference, status, reportRunId: Number(run.lastInsertRowid), period, nextRun };
  })();

  audit(req, trigger === "manual" ? "schedule.run_now" : "schedule.executed", "schedule", schedule.id, `${schedule.name} produced ${result.reference} (${result.status.replace("_", " ")})`, {
    submission: result.reference,
    period,
    checksum: rendered.checksum,
  });
  return result;
}

let timer: NodeJS.Timeout | null = null;

export function startScheduler(intervalMs = 30_000) {
  if (timer) return;
  const tick = () => {
    const due = db.prepare("SELECT * FROM schedules WHERE active = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?").all(nowIso()) as ScheduleRow[];
    for (const s of due) {
      try {
        executeSchedule(s, null, "schedule");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        db.prepare("UPDATE schedules SET last_status = 'failed', next_run_at = ?, updated_at = ? WHERE id = ?").run(computeNextRun(s), nowIso(), s.id);
        audit(null, "schedule.failed", "schedule", s.id, `${s.name} failed: ${message}`);
      }
    }
  };
  tick();
  timer = setInterval(tick, intervalMs);
}

export function scheduleChecksum(payload: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
