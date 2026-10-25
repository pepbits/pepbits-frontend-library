import { get } from '@/lib/db';
import { handle, ok, need } from '@/lib/http';

export const dynamic = 'force-dynamic';

export function GET(_: Request, { params }: { params: { id: string } }) {
  return handle(() => {
    const m = get('SELECT m.*, i.name AS interface_name FROM messages m LEFT JOIN interfaces i ON i.id = m.interface_id WHERE m.id = ?', Number(params.id));
    need(m, 'Message not found', 404);
    return ok(m);
  });
}
