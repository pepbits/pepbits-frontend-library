import { processHl7 } from '@/lib/inbound';

export const dynamic = 'force-dynamic';

/**
 * Inbound HL7 v2 over HTTP. Accepts ORM^O01 (NW/XO/CA/SC), ORU^R01 and ADT^A04/A08/A31.
 * Returns the HL7 ACK as the response body (AA accepted, AE validation error, AR processing error).
 * The MLLP listener (npm run mllp) forwards TCP traffic here.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const channel = req.headers.get('x-channel') || 'HTTP';
  const res = processHl7(raw, channel);
  return new Response(res.ack, {
    status: res.ok ? 200 : 422,
    headers: { 'Content-Type': 'x-application/hl7-v2+er7', 'X-Ack-Note': encodeURIComponent(res.note), 'X-Message-Id': String(res.messageId) },
  });
}
