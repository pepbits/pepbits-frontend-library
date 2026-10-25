import { get } from '@/lib/db';
import { handle, ok, need } from '@/lib/http';
import { currentUser } from '@/lib/session';
import { queueStudyRoute } from '@/lib/outbound';
import { cEcho } from '@/lib/dicom/dimse';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** Sends a study to a DICOM destination (C-STORE). Body: { interfaceId } */
export function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const { interfaceId } = await req.json();
    const iface = get("SELECT * FROM interfaces WHERE id = ? AND type = 'DICOM'", Number(interfaceId));
    need(iface, 'Choose a DICOM destination', 400);
    const echo = await cEcho({ host: iface.host, port: iface.port, aeTitle: iface.ae_title });
    need(echo.ok, `${iface.name} is not reachable (${echo.message}). Check that the remote PACS is running.`, 502);
    const messageId = queueStudyRoute(Number(params.id), iface.id);
    audit(currentUser(), 'STUDY_ROUTED', 'study', params.id, { to: iface.name });
    return ok({ messageId });
  });
}
