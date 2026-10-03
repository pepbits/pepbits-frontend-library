import { get } from '@/lib/db';
import { handle, ok, need } from '@/lib/http';
import { currentUser } from '@/lib/session';
import { reconcileStudy } from '@/lib/dicom/ingest';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** Links an unmatched study to an order by accession number. */
export function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const { accession } = await req.json();
    const o = get('SELECT id FROM orders WHERE accession = ?', String(accession || '').trim());
    need(o, `No order with accession ${accession}`, 404);
    reconcileStudy(Number(params.id), o.id);
    audit(currentUser(), 'STUDY_RECONCILED', 'order', o.id, { studyId: params.id });
    return ok({ ok: true, orderId: o.id });
  });
}
