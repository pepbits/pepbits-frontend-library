import { handle, ok, need } from '@/lib/http';
import { currentUser } from '@/lib/session';
import { loadReport } from '@/lib/context';
import { saveDraft, signPreliminary, signFinal, addAddendum, amendReport } from '@/lib/reports';

export const dynamic = 'force-dynamic';

export function GET(_: Request, { params }: { params: { orderId: string } }) {
  return handle(() => ok(loadReport(Number(params.orderId))));
}

/** Body: { action: 'draft' | 'preliminary' | 'final' | 'addendum' | 'amend', ...report fields, text?, reason? } */
export function POST(req: Request, { params }: { params: { orderId: string } }) {
  return handle(async () => {
    const id = Number(params.orderId);
    const { action, text, reason, ...body } = await req.json();
    const user = currentUser();
    switch (action) {
      case 'draft': saveDraft(id, body, user); break;
      case 'preliminary': signPreliminary(id, body, user); break;
      case 'final': signFinal(id, body, user); break;
      case 'addendum': addAddendum(id, text, user); break;
      case 'amend': amendReport(id, body, reason, user); break;
      default: need(false, `Unknown report action "${action}"`);
    }
    return ok(loadReport(id));
  });
}
