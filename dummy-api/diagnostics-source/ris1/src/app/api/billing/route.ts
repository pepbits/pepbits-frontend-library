import { all, get } from '@/lib/db';
import { handle, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return handle(() => {
    const sp = new URL(req.url).searchParams;
    const status = sp.get('status');
    const q = sp.get('q')?.trim();
    const where: string[] = [];
    const args: unknown[] = [];
    if (status) { where.push('i.status = ?'); args.push(status); }
    if (q) { where.push("(i.invoice_no LIKE ? OR o.accession LIKE ? OR p.mrn LIKE ? OR p.first_name || ' ' || p.last_name LIKE ?)"); const l = `%${q}%`; args.push(l, l, l, l); }
    const rows = all(
      `SELECT i.*, o.accession, o.status AS order_status, o.priority, o.modality_code, pr.name AS procedure_name, pr.cpt,
              p.first_name, p.last_name, p.mrn, p.insurance
       FROM invoices i JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id JOIN procedures pr ON pr.id = o.procedure_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.created_at DESC LIMIT 300`, ...args);
    const summary = get(
      `SELECT SUM(CASE WHEN status != 'CANCELLED' THEN net ELSE 0 END) AS billed, SUM(paid) AS collected,
              SUM(CASE WHEN status IN ('UNPAID','PARTIAL') THEN net - paid ELSE 0 END) AS outstanding,
              SUM(CASE WHEN created_at >= strftime('%Y-%m-%dT00:00:00', 'now', 'localtime') THEN paid ELSE 0 END) AS today
       FROM invoices`);
    return ok({ rows, summary });
  });
}
