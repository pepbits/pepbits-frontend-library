import { handle, ok } from '@/lib/http';
import { currentUser } from '@/lib/session';
import { communicateCritical } from '@/lib/reports';

export const dynamic = 'force-dynamic';

export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    communicateCritical(Number(params.id), await req.json(), currentUser());
    return ok({ ok: true });
  });
}
