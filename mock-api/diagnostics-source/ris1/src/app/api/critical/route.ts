import { all } from '@/lib/db';
import { handle, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return handle(() => {
    const status = new URL(req.url).searchParams.get('status');
    const rows = all(
      `SELECT c.*, o.accession, o.priority, o.modality_code, pr.name AS procedure_name, p.first_name, p.last_name, p.mrn,
              rf.name AS referrer_name, rf.phone AS referrer_phone, fb.name AS flagged_by_name, cb.name AS communicated_by_name
       FROM critical_results c JOIN orders o ON o.id = c.order_id JOIN patients p ON p.id = o.patient_id JOIN procedures pr ON pr.id = o.procedure_id
       LEFT JOIN referrers rf ON rf.id = o.referrer_id LEFT JOIN users fb ON fb.id = c.flagged_by LEFT JOIN users cb ON cb.id = c.communicated_by
       ${status ? 'WHERE c.status = ?' : ''} ORDER BY CASE c.status WHEN 'OPEN' THEN 0 WHEN 'COMMUNICATED' THEN 1 ELSE 2 END, c.flagged_at DESC`,
      ...(status ? [status] : []),
    );
    return ok(rows);
  });
}
