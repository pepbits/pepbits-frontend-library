import { all, insert, get } from '@/lib/db';
import { handle, ok, need } from '@/lib/http';
import { currentUser, can } from '@/lib/session';
import { audit } from '@/lib/audit';
import { MASTERS } from '../config';

export const dynamic = 'force-dynamic';

export function GET(_: Request, { params }: { params: { entity: string } }) {
  return handle(() => {
    const m = MASTERS[params.entity];
    need(m, 'Unknown master', 404);
    return ok(all(`SELECT * FROM ${m.table} ORDER BY ${m.order}`));
  });
}

export function POST(req: Request, { params }: { params: { entity: string } }) {
  return handle(async () => {
    const m = MASTERS[params.entity];
    need(m, 'Unknown master', 404);
    const user = currentUser();
    need(can(user, 'admin'), 'Only administrators can change master data', 403);
    const body = await req.json();
    for (const r of m.required) need(body[r] !== undefined && body[r] !== '', `${r.replace('_', ' ')} is required`);
    const data: Record<string, unknown> = {};
    for (const c of m.columns) if (body[c] !== undefined) data[c] = body[c];
    try {
      const id = insert(m.table, data);
      audit(user, 'MASTER_CREATED', m.table, id, data);
      return ok(get(`SELECT * FROM ${m.table} WHERE id = ?`, id), 201);
    } catch (e: any) {
      need(!String(e.message).includes('UNIQUE'), 'A record with this code already exists', 409);
      throw e;
    }
  });
}
