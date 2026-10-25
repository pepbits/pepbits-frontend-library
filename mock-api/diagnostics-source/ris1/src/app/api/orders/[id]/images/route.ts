import { get } from '@/lib/db';
import { handle, ok, need } from '@/lib/http';
import { currentUser } from '@/lib/session';
import { loadOrder } from '@/lib/context';
import { generateStudy } from '@/lib/dicom/generator';
import { ingestDicom } from '@/lib/dicom/ingest';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** Simulates the modality acquiring and sending images (C-STORE) for this accession. */
export function POST(_: Request, { params }: { params: { id: string } }) {
  return handle(() => {
    const o = loadOrder(Number(params.id));
    need(o, 'Order not found', 404);
    need(!['CANCELLED'].includes(o.status), 'Order is cancelled');
    const ae = get('SELECT ae_title FROM modalities WHERE code = ?', o.modality_code)?.ae_title || 'MODALITY';
    const { files, studyUid } = generateStudy({
      modality: o.modality_code, bodyPart: o.body_part, description: o.procedure_name, accession: o.accession,
      patientId: o.mrn, patientName: `${o.last_name.toUpperCase()}^${o.first_name.toUpperCase()}`, patientDob: o.dob, patientSex: o.sex,
      referrer: o.referrer_name, stationAe: ae, studyUid: o.study_uid || undefined,
    });
    let stored = 0;
    for (const f of files) if (ingestDicom(f.buffer, ae).ok) stored++;
    audit(currentUser(), 'IMAGES_ACQUIRED', 'order', o.id, { studyUid, images: stored, ae });
    return ok({ studyUid, images: stored, order: loadOrder(o.id) });
  });
}
