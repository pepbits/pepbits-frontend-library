import { all } from '@/lib/db';
import { handle, need } from '@/lib/http';
import { ingestDicom } from '@/lib/dicom/ingest';

export const dynamic = 'force-dynamic';

const v = (vr: string, value: unknown) => (value == null || value === '' ? { vr } : { vr, Value: [vr === 'PN' ? { Alphabetic: value } : value] });

/** QIDO-RS: search for studies (subset of attributes, DICOM JSON model). */
export function GET(req: Request) {
  return handle(() => {
    const sp = new URL(req.url).searchParams;
    const where: string[] = [];
    const args: unknown[] = [];
    const map: Record<string, string> = { AccessionNumber: 'accession', PatientID: 'patient_id_dicom', StudyInstanceUID: 'study_uid', ModalitiesInStudy: 'modality' };
    for (const [k, col] of Object.entries(map)) {
      const val = sp.get(k);
      if (val) { where.push(`${col} LIKE ?`); args.push(val.replace(/\*/g, '%')); }
    }
    const pn = sp.get('PatientName');
    if (pn) { where.push('patient_name LIKE ?'); args.push(pn.replace(/\*/g, '%')); }
    const rows = all(`SELECT * FROM studies ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY received_at DESC LIMIT ${Number(sp.get('limit') || 100)}`, ...args);
    const body = rows.map((s) => ({
      '00080020': v('DA', (s.study_date || '').replace(/-/g, '')),
      '00080050': v('SH', s.accession),
      '00080061': v('CS', s.modality),
      '00081030': v('LO', s.description),
      '00100010': v('PN', s.patient_name),
      '00100020': v('LO', s.patient_id_dicom),
      '0020000D': v('UI', s.study_uid),
      '00201206': v('IS', s.num_series),
      '00201208': v('IS', s.num_instances),
    }));
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/dicom+json' } });
  });
}

/** STOW-RS: store instances sent as multipart/related; type="application/dicom". */
export function POST(req: Request) {
  return handle(async () => {
    const ct = req.headers.get('content-type') || '';
    const buf = Buffer.from(await req.arrayBuffer());
    const parts: Buffer[] = [];
    const m = ct.match(/boundary="?([^";]+)"?/i);
    if (ct.startsWith('application/dicom')) parts.push(buf);
    else {
      need(m, 'Expected multipart/related with a boundary, or application/dicom');
      const boundary = Buffer.from(`--${m![1]}`);
      let pos = buf.indexOf(boundary);
      while (pos !== -1) {
        const next = buf.indexOf(boundary, pos + boundary.length);
        if (next === -1) break;
        const chunk = buf.subarray(pos + boundary.length, next);
        const headerEnd = chunk.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          let body = chunk.subarray(headerEnd + 4);
          if (body.subarray(-2).toString() === '\r\n') body = body.subarray(0, -2);
          parts.push(body);
        }
        pos = next;
      }
    }
    const results = parts.map((p) => ingestDicom(p, req.headers.get('x-calling-ae') || 'STOW_RS'));
    const failed = results.filter((r) => !r.ok);
    const body = {
      '00081199': { vr: 'SQ', Value: results.filter((r) => r.ok).map((r) => ({ '00081155': { vr: 'UI', Value: [r.sopUid] } })) },
      ...(failed.length ? { '00081198': { vr: 'SQ', Value: failed.map((r) => ({ '00081197': { vr: 'US', Value: [0xc000] }, '00090010': { vr: 'LO', Value: [r.error] } })) } } : {}),
    };
    return new Response(JSON.stringify(body), { status: failed.length ? (failed.length === results.length ? 409 : 202) : 200, headers: { 'Content-Type': 'application/dicom+json' } });
  });
}
