import { get, update, run } from '@/lib/db';
import { handle, ok, need } from '@/lib/http';
import { currentUser, can } from '@/lib/session';
import { audit } from '@/lib/audit';
import { MASTERS } from '../../config';

export const dynamic = 'force-dynamic';

export function PUT(req: Request, { params }: { params: { entity: string; id: string } }) {
  return handle(async () => {
    const m = MASTERS[params.entity];
    need(m, 'Unknown master', 404);
    const user = currentUser();
    need(can(user, 'admin'), 'Only administrators can change master data', 403);
    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const c of m.columns) if (body[c] !== undefined) data[c] = body[c];
    update(m.table, Number(params.id), data);
    audit(user, 'MASTER_UPDATED', m.table, params.id, data);
    return ok(get(`SELECT * FROM ${m.table} WHERE id = ?`, Number(params.id)));
  });
}

export function DELETE(_: Request, { params }: { params: { entity: string; id: string } }) {
  return handle(() => {
    const m = MASTERS[params.entity];
    need(m, 'Unknown master', 404);
    const user = currentUser();
    need(can(user, 'admin'), 'Only administrators can change master data', 403);
    // Soft-delete where the table supports it, so historical orders keep their references.
    if (m.columns.includes('active')) run(`UPDATE ${m.table} SET active = 0 WHERE id = ?`, Number(params.id));
    else run(`DELETE FROM ${m.table} WHERE id = ?`, Number(params.id));
    audit(user, 'MASTER_DEACTIVATED', m.table, params.id);
    return ok({ ok: true });
  });
}
