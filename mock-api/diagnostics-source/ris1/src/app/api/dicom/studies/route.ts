import { all } from '@/lib/db';
import { handle, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return handle(() => {
    const sp = new URL(req.url).searchParams;
    const q = sp.get('q')?.trim();
    const unmatched = sp.get('unmatched');
    const where: string[] = [];
    const args: unknown[] = [];
    if (q) { where.push('(s.accession LIKE ? OR s.patient_name LIKE ? OR s.patient_id_dicom LIKE ? OR s.description LIKE ?)'); const l = `%${q}%`; args.push(l, l, l, l); }
    if (unmatched) where.push('s.order_id IS NULL');
    return ok(all(
      `SELECT s.*, o.status AS order_status, o.priority, r.status AS report_status
       FROM studies s LEFT JOIN orders o ON o.id = s.order_id LEFT JOIN reports r ON r.order_id = o.id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.received_at DESC LIMIT 300`, ...args));
  });
}
