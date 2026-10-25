import { all, get, update } from '@/lib/db';
import { handle, ok, need } from '@/lib/http';
import { currentUser } from '@/lib/session';
import { ORDER_SELECT } from '@/lib/context';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export function GET(_: Request, { params }: { params: { id: string } }) {
  return handle(() => {
    const p = get('SELECT * FROM patients WHERE id = ?', Number(params.id));
    need(p, 'Patient not found', 404);
    const orders = all(`${ORDER_SELECT} WHERE o.patient_id = ? ORDER BY o.ordered_at DESC`, p.id);
    return ok({ ...p, orders });
  });
}

export function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const b = await req.json();
    const fields = ['first_name', 'last_name', 'dob', 'sex', 'phone', 'email', 'address', 'insurance', 'allergies'];
    const data: Record<string, unknown> = {};
    for (const f of fields) if (b[f] !== undefined) data[f] = b[f];
    update('patients', Number(params.id), data);
    audit(currentUser(), 'PATIENT_UPDATED', 'patient', params.id, data);
    return ok(get('SELECT * FROM patients WHERE id = ?', Number(params.id)));
  });
}
