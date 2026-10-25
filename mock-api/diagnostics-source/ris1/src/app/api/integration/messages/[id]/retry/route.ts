import { get } from '@/lib/db';
import { handle, ok, need } from '@/lib/http';
import { retryMessage } from '@/lib/outbound';
import { audit } from '@/lib/audit';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export function POST(_: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const m = get('SELECT direction, status FROM messages WHERE id = ?', Number(params.id));
    need(m && m.direction === 'OUT', 'Only outbound messages can be resent');
    await retryMessage(Number(params.id));
    audit(currentUser(), 'MESSAGE_RESENT', 'message', params.id);
    return ok(get('SELECT id, status, error, response, attempts FROM messages WHERE id = ?', Number(params.id)));
  });
}
