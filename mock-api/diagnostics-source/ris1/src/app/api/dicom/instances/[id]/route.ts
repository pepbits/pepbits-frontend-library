import fs from 'fs';
import { get } from '@/lib/db';
import { handle, need } from '@/lib/http';
import { instanceFilePath } from '@/lib/dicom/ingest';

export const dynamic = 'force-dynamic';

/** WADO-style retrieval of a single Part 10 instance. */
export function GET(_: Request, { params }: { params: { id: string } }) {
  return handle(() => {
    const inst = get('SELECT path, sop_uid FROM instances WHERE id = ?', Number(params.id));
    need(inst, 'Instance not found', 404);
    const buf = fs.readFileSync(instanceFilePath(inst.path));
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/dicom',
        'Content-Disposition': `inline; filename="${inst.sop_uid}.dcm"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  });
}
