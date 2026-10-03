import { all, get } from '@/lib/db';
import { handle, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return handle(() => {
    const sp = new URL(req.url).searchParams;
    const where: string[] = [];
    const args: unknown[] = [];
    for (const k of ['direction', 'status', 'protocol']) {
      const v = sp.get(k);
      if (v) { where.push(`m.${k} = ?`); args.push(v); }
    }
    const q = sp.get('q');
    if (q) { where.push('(m.accession LIKE ? OR m.control_id LIKE ? OR m.message_type LIKE ?)'); const l = `%${q}%`; args.push(l, l, l); }
    const rows = all(
      `SELECT m.id, m.direction, m.protocol, m.message_type, m.control_id, m.accession, m.order_id, m.status, m.error, m.attempts, m.created_at, m.updated_at, i.name AS interface_name
       FROM messages m LEFT JOIN interfaces i ON i.id = m.interface_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.id DESC LIMIT 300`, ...args);
    const stats = get(
      `SELECT SUM(direction='IN') AS inbound, SUM(direction='OUT') AS outbound, SUM(status='FAILED') AS failed,
              SUM(status='REJECTED') AS rejected, SUM(status='PENDING') AS pending FROM messages`);
    return ok({ rows, stats });
  });
}
