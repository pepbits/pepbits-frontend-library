import { get } from '@/lib/db';
import { handle, ok, need } from '@/lib/http';
import { cEcho } from '@/lib/dicom/dimse';
import { sendMllp } from '@/lib/outbound';
import { buildAck } from '@/lib/hl7';
import { newControlId } from '@/lib/ids';

export const dynamic = 'force-dynamic';

/** Connectivity test for an interface: C-ECHO for DICOM, a test ACK round-trip for HL7, HTTP reachability otherwise. */
export function POST(req: Request) {
  return handle(async () => {
    const { interfaceId } = await req.json();
    const i = get('SELECT * FROM interfaces WHERE id = ?', Number(interfaceId));
    need(i, 'Interface not found', 404);
    const t0 = Date.now();
    try {
      if (i.type === 'DICOM') {
        const r = await cEcho({ host: i.host, port: i.port, aeTitle: i.ae_title });
        return ok({ ok: r.ok, message: r.message, ms: Date.now() - t0 });
      }
      if (i.type === 'HL7_MLLP') {
        if (i.direction === 'IN') return ok({ ok: true, message: `Listener is provided by "npm run mllp" on port ${i.port}` });
        const ack = await sendMllp(i.host, i.port, buildAck(null, 'AA', newControlId(), 'Connectivity test'));
        return ok({ ok: true, message: `Remote replied: ${ack.split('\r')[1] || ack.slice(0, 80)}`, ms: Date.now() - t0 });
      }
      const res = await fetch(i.url, { method: 'OPTIONS', signal: AbortSignal.timeout(5000) }).catch(() => fetch(i.url, { signal: AbortSignal.timeout(5000) }));
      return ok({ ok: res.status < 500, message: `HTTP ${res.status}`, ms: Date.now() - t0 });
    } catch (e: any) {
      return ok({ ok: false, message: e.message, ms: Date.now() - t0 });
    }
  });
}
