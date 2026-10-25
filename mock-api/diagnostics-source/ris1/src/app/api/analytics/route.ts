import { all, get } from '@/lib/db';
import { handle, ok } from '@/lib/http';
import { tatTarget, withTat, ORDER_SELECT } from '@/lib/context';

export const dynamic = 'force-dynamic';

const minutes = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.floor(s.length / 2)]);
};

export function GET(req: Request) {
  return handle(() => {
    const days = Number(new URL(req.url).searchParams.get('days') || 14);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const today = startOfDay.toISOString();

    const statusCounts = all("SELECT status, COUNT(*) n FROM orders WHERE status NOT IN ('FINAL','CANCELLED') OR final_at >= ? GROUP BY status", today);
    const kpi = get(
      `SELECT
        (SELECT COUNT(*) FROM orders WHERE ordered_at >= ?) AS ordered_today,
        (SELECT COUNT(*) FROM orders WHERE exam_completed_at >= ?) AS exams_today,
        (SELECT COUNT(*) FROM orders WHERE final_at >= ?) AS finals_today,
        (SELECT COUNT(*) FROM orders WHERE status IN ('COMPLETED','PRELIMINARY')) AS awaiting_read,
        (SELECT COUNT(*) FROM orders WHERE status IN ('ORDERED','SCHEDULED','ARRIVED','IN_PROGRESS','COMPLETED','PRELIMINARY') AND priority = 'STAT') AS stat_open,
        (SELECT COUNT(*) FROM orders WHERE status = 'ARRIVED') AS waiting_room,
        (SELECT COUNT(*) FROM critical_results WHERE status != 'ACKNOWLEDGED') AS critical_open,
        (SELECT COUNT(*) FROM messages WHERE status IN ('FAILED','REJECTED') AND created_at >= ?) AS interface_errors,
        (SELECT IFNULL(SUM(amount),0) FROM payments WHERE received_at >= ?) AS collected_today,
        (SELECT IFNULL(SUM(net - paid),0) FROM invoices WHERE status IN ('UNPAID','PARTIAL')) AS outstanding,
        (SELECT COUNT(*) FROM studies WHERE received_at >= ?) AS studies_today,
        (SELECT COUNT(*) FROM studies WHERE order_id IS NULL) AS unmatched_studies`,
      today, today, today, since, today, today);

    const finals = all(
      `SELECT o.id, o.modality_code, o.priority, o.ordered_at, o.arrived_at, o.exam_started_at, o.exam_completed_at, o.prelim_at, o.final_at, u.name AS radiologist
       FROM orders o LEFT JOIN users u ON u.id = o.radiologist_id WHERE o.status = 'FINAL' AND o.final_at >= ? AND o.exam_completed_at IS NOT NULL`, since);

    const group = (key: (r: any) => string) => {
      const m = new Map<string, { report: number[]; total: number[]; wait: number[]; within: number; n: number }>();
      for (const r of finals) {
        const k = key(r);
        if (!m.has(k)) m.set(k, { report: [], total: [], wait: [], within: 0, n: 0 });
        const g = m.get(k)!;
        const rep = minutes(r.exam_completed_at, r.final_at);
        g.report.push(rep);
        g.total.push(minutes(r.ordered_at, r.final_at));
        if (r.arrived_at && r.exam_started_at) g.wait.push(minutes(r.arrived_at, r.exam_started_at));
        if (rep <= tatTarget(r.priority, r.modality_code)) g.within++;
        g.n++;
      }
      return [...m.entries()].map(([k, g]) => ({
        key: k, count: g.n, avgReportTat: avg(g.report), medianReportTat: median(g.report), avgTotalTat: avg(g.total),
        avgWait: avg(g.wait), compliance: g.n ? Math.round((g.within / g.n) * 100) : null,
      })).sort((a, b) => b.count - a.count);
    };

    const volume: { day: string; ordered: number; finalized: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(startOfDay.getTime() - i * 86400000);
      const e = new Date(d.getTime() + 86400000);
      const r = get('SELECT (SELECT COUNT(*) FROM orders WHERE ordered_at >= ? AND ordered_at < ?) AS ordered, (SELECT COUNT(*) FROM orders WHERE final_at >= ? AND final_at < ?) AS finalized',
        d.toISOString(), e.toISOString(), d.toISOString(), e.toISOString())!;
      volume.push({ day: d.toISOString().slice(5, 10), ordered: r.ordered, finalized: r.finalized });
    }

    const modalityToday = all(
      `SELECT m.code, m.name, m.daily_capacity,
         (SELECT COUNT(*) FROM orders o WHERE o.modality_code = m.code AND COALESCE(o.scheduled_at, o.ordered_at) >= ? AND o.status != 'CANCELLED') AS booked,
         (SELECT COUNT(*) FROM orders o WHERE o.modality_code = m.code AND o.exam_completed_at >= ?) AS done,
         (SELECT COUNT(*) FROM orders o WHERE o.modality_code = m.code AND o.status IN ('COMPLETED','PRELIMINARY')) AS unread
       FROM modalities m WHERE m.active = 1 ORDER BY m.code`, today, today);

    const atRisk = withTat(all(`${ORDER_SELECT} WHERE o.status IN ('COMPLETED','PRELIMINARY')`))
      .filter((o) => o.tat.state !== 'ON_TRACK')
      .sort((a, b) => (b.tat.elapsed ?? 0) / b.tat.target - (a.tat.elapsed ?? 0) / a.tat.target)
      .slice(0, 10);

    const revenue = all(
      `SELECT pr.modality_code AS modality, SUM(i.net) AS billed, SUM(i.paid) AS collected, COUNT(*) AS n
       FROM invoices i JOIN orders o ON o.id = i.order_id JOIN procedures pr ON pr.id = o.procedure_id
       WHERE i.created_at >= ? AND i.status != 'CANCELLED' GROUP BY pr.modality_code ORDER BY billed DESC`, since);

    return ok({
      kpi, statusCounts, volume, modalityToday, atRisk, revenue,
      tatByModality: group((r) => r.modality_code),
      tatByPriority: group((r) => r.priority),
      tatByRadiologist: group((r) => r.radiologist || 'Unassigned'),
      overall: group(() => 'ALL')[0] || null,
    });
  });
}
