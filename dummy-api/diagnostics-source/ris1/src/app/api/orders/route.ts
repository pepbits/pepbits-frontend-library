import { all } from '@/lib/db';
import { handle, ok } from '@/lib/http';
import { currentUser } from '@/lib/session';
import { ORDER_SELECT, withTat, loadOrder } from '@/lib/context';
import { createOrder } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

/**
 * Worklists are views over the same order table:
 *   view=reception  → today's ORDERED/SCHEDULED/ARRIVED
 *   view=tech       → ARRIVED/IN_PROGRESS (+ completed today)
 *   view=reading    → COMPLETED/PRELIMINARY (+ finals in the last 24h)
 */
export function GET(req: Request) {
  return handle(() => {
    const sp = new URL(req.url).searchParams;
    const where: string[] = [];
    const args: unknown[] = [];
    const view = sp.get('view');
    const status = sp.get('status');
    const modality = sp.get('modality');
    const priority = sp.get('priority');
    const q = sp.get('q')?.trim();
    const from = sp.get('from');
    const to = sp.get('to');
    const mine = sp.get('mine');

    if (view === 'reception') where.push("o.status IN ('ORDERED','SCHEDULED','ARRIVED')");
    if (view === 'tech') where.push("(o.status IN ('ARRIVED','IN_PROGRESS') OR (o.status = 'COMPLETED' AND o.exam_completed_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')))");
    if (view === 'reading') where.push("(o.status IN ('COMPLETED','PRELIMINARY') OR (o.status IN ('FINAL') AND o.final_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')))");
    if (view === 'schedule') where.push("o.status NOT IN ('CANCELLED')");
    if (status) { where.push(`o.status IN (${status.split(',').map(() => '?').join(',')})`); args.push(...status.split(',')); }
    if (modality) { where.push('o.modality_code = ?'); args.push(modality); }
    if (priority) { where.push('o.priority = ?'); args.push(priority); }
    if (from) { where.push('COALESCE(o.scheduled_at, o.ordered_at) >= ?'); args.push(from); }
    if (to) { where.push('COALESCE(o.scheduled_at, o.ordered_at) < ?'); args.push(to); }
    if (mine) { where.push('(o.radiologist_id = ? OR o.radiologist_id IS NULL)'); args.push(currentUser().id); }
    if (q) {
      where.push("(o.accession LIKE ? OR p.mrn LIKE ? OR p.first_name || ' ' || p.last_name LIKE ? OR pr.name LIKE ? OR o.placer_order_no LIKE ?)");
      const like = `%${q}%`;
      args.push(like, like, like, like, like);
    }
    const order = view === 'reading' || view === 'tech'
      ? "CASE o.priority WHEN 'STAT' THEN 0 WHEN 'URGENT' THEN 1 ELSE 2 END, COALESCE(o.exam_completed_at, o.arrived_at, o.ordered_at)"
      : view === 'schedule' ? 'COALESCE(o.scheduled_at, o.ordered_at)'
      : 'o.ordered_at DESC';
    const rows = all(`${ORDER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT ${Number(sp.get('limit') || 300)}`, ...args);
    return ok(withTat(rows));
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    const ids: number[] = [];
    const procedureIds: number[] = Array.isArray(body.procedure_ids) ? body.procedure_ids : [body.procedure_id];
    for (const pid of procedureIds) ids.push(createOrder({ ...body, procedure_id: Number(pid), source: 'RIS' }, currentUser()));
    return ok(ids.map((id) => loadOrder(id)), 201);
  });
}
