import { all } from '@/lib/db';
import { handle, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return handle(() => {
    const q = new URL(req.url).searchParams.get('q')?.trim() || '';
    if (q.length < 2) return ok({ patients: [], orders: [] });
    const l = `%${q}%`;
    return ok({
      patients: all("SELECT id, mrn, first_name, last_name, dob, sex FROM patients WHERE mrn LIKE ? OR first_name || ' ' || last_name LIKE ? LIMIT 6", l, l),
      orders: all(
        `SELECT o.id, o.accession, o.status, o.priority, pr.name AS procedure_name, p.first_name, p.last_name
         FROM orders o JOIN patients p ON p.id = o.patient_id JOIN procedures pr ON pr.id = o.procedure_id
         WHERE o.accession LIKE ? OR o.placer_order_no LIKE ? ORDER BY o.id DESC LIMIT 6`, l, l),
    });
  });
}
