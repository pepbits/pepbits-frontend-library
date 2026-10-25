import { handle, ok, need } from '@/lib/http';
import { ingestDicom, IngestResult } from '@/lib/dicom/ingest';
import { audit } from '@/lib/audit';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Receives DICOM instances.
 *  - application/dicom body: a single Part 10 file (used by the C-STORE SCP bridge)
 *  - multipart/form-data: one or more files from the PACS upload screen
 */
export function POST(req: Request) {
  return handle(async () => {
    const type = req.headers.get('content-type') || '';
    const source = req.headers.get('x-calling-ae') || 'WEB_UPLOAD';
    const results: (IngestResult & { name?: string })[] = [];
    if (type.startsWith('multipart/form-data')) {
      const form = await req.formData();
      const files = form.getAll('files');
      need(files.length, 'Attach at least one DICOM file');
      for (const f of files) {
        if (typeof f === 'string') continue;
        const buf = Buffer.from(await f.arrayBuffer());
        results.push({ name: f.name, ...ingestDicom(buf, source) });
      }
      audit(currentUser(), 'DICOM_UPLOAD', 'study', '-', { files: results.length, ok: results.filter((r) => r.ok).length });
    } else {
      const buf = Buffer.from(await req.arrayBuffer());
      results.push(ingestDicom(buf, source));
    }
    const failed = results.filter((r) => !r.ok);
    return ok({ received: results.length, stored: results.length - failed.length, results }, failed.length === results.length ? 422 : 200);
  });
}
