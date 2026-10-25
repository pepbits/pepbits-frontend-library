import { parseHl7, buildAck } from '@/lib/hl7';
import { newControlId } from '@/lib/ids';

export const dynamic = 'force-dynamic';

/** Loopback receiver used by the demo outbound interfaces: ACKs HL7, echoes FHIR with an id. */
export async function POST(req: Request) {
  const body = await req.text();
  if (new URL(req.url).searchParams.get('fhir')) {
    const res = JSON.parse(body);
    return Response.json({ ...res, id: res.id || crypto.randomUUID(), meta: { lastUpdated: new Date().toISOString() } }, { status: 201 });
  }
  try {
    return new Response(buildAck(parseHl7(body), 'AA', newControlId(), 'Received by loopback receiver'));
  } catch (e: any) {
    return new Response(buildAck(null, 'AR', newControlId(), e.message), { status: 400 });
  }
}
