import { processServiceRequest } from '@/lib/inbound';
import { all } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { body = null; }
  const r = processServiceRequest(body);
  return Response.json(r.body, { status: r.status, headers: { 'Content-Type': 'application/fhir+json' } });
}

/** Search: ?identifier=<accession or placer> or ?patient=<mrn> */
export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const id = sp.get('identifier');
  const pt = sp.get('patient');
  const rows = all(
    `SELECT o.accession, o.placer_order_no, o.status, o.priority, o.ordered_at, pr.code, pr.name, p.mrn, p.first_name, p.last_name
     FROM orders o JOIN procedures pr ON pr.id = o.procedure_id JOIN patients p ON p.id = o.patient_id
     WHERE (? IS NULL OR o.accession = ? OR o.placer_order_no = ?) AND (? IS NULL OR p.mrn = ?) ORDER BY o.id DESC LIMIT 50`,
    id, id, id, pt, pt);
  return Response.json({
    resourceType: 'Bundle', type: 'searchset', total: rows.length,
    entry: rows.map((o) => ({ resource: {
      resourceType: 'ServiceRequest', id: o.accession, status: o.status === 'CANCELLED' ? 'revoked' : o.status === 'FINAL' ? 'completed' : 'active', intent: 'order',
      priority: o.priority.toLowerCase(), identifier: [{ system: 'urn:ris:accession', value: o.accession }],
      code: { coding: [{ system: 'urn:ris:procedure', code: o.code, display: o.name }] },
      subject: { reference: `Patient/${o.mrn}`, display: `${o.first_name} ${o.last_name}` }, authoredOn: o.ordered_at,
    } })),
  }, { headers: { 'Content-Type': 'application/fhir+json' } });
}
