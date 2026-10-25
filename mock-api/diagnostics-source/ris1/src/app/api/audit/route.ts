import { all } from '@/lib/db';
import { handle, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return handle(() => {
    const sp = new URL(req.url).searchParams;
    const q = sp.get('q');
    const l = `%${q || ''}%`;
    return ok(all(
      `SELECT a.*, o.accession FROM audit a LEFT JOIN orders o ON a.entity = 'order' AND o.id = CAST(a.entity_id AS INTEGER)
       WHERE ? IS NULL OR a.action LIKE ? OR a.user_name LIKE ? OR a.details LIKE ? OR o.accession LIKE ?
       ORDER BY a.id DESC LIMIT 500`, q, l, l, l, l));
  });
}
