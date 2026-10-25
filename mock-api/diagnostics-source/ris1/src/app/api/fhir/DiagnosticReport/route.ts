import { all } from '@/lib/db';
import { loadOrderByAccession, loadReport } from '@/lib/context';
import { diagnosticReport } from '@/lib/outbound';

export const dynamic = 'force-dynamic';

/** Result outbound (pull): ?identifier=<accession> or ?patient=<mrn> */
export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const acc = sp.get('identifier');
  const mrn = sp.get('patient');
  const accessions = acc ? [acc] : mrn
    ? all<{ accession: string }>("SELECT o.accession FROM orders o JOIN patients p ON p.id = o.patient_id JOIN reports r ON r.order_id = o.id WHERE p.mrn = ? AND r.status != 'DRAFT' ORDER BY o.id DESC", mrn).map((r) => r.accession)
    : [];
  const entry = accessions.flatMap((a) => {
    const o = loadOrderByAccession(a);
    const r = o && loadReport(o.id);
    if (!o || !r || r.status === 'DRAFT') return [];
    const status = r.status === 'PRELIMINARY' ? 'preliminary' : r.status === 'CORRECTED' || r.addenda.length ? 'amended' : 'final';
    return [{ resource: diagnosticReport(o, r, status) }];
  });
  return Response.json({ resourceType: 'Bundle', type: 'searchset', total: entry.length, entry }, { headers: { 'Content-Type': 'application/fhir+json' } });
}
