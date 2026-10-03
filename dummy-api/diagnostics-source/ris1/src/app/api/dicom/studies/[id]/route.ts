import { all, get } from '@/lib/db';
import { handle, ok, need } from '@/lib/http';
import { currentUser, can } from '@/lib/session';
import { deleteStudy } from '@/lib/dicom/ingest';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export function GET(_: Request, { params }: { params: { id: string } }) {
  return handle(() => {
    const study = get(
      `SELECT s.*, o.id AS order_id, o.accession AS order_accession, o.priority, o.status AS order_status, o.clinical_history,
              p.first_name, p.last_name, p.mrn, p.dob, p.sex, pr.name AS procedure_name
       FROM studies s LEFT JOIN orders o ON o.id = s.order_id LEFT JOIN patients p ON p.id = o.patient_id LEFT JOIN procedures pr ON pr.id = o.procedure_id
       WHERE s.id = ?`, Number(params.id));
    need(study, 'Study not found', 404);
    const series = all('SELECT * FROM series WHERE study_id = ? ORDER BY series_number, id', study.id).map((s) => ({
      ...s,
      instances: all('SELECT id, sop_uid, instance_number, rows, cols FROM instances WHERE series_id = ? ORDER BY instance_number, id', s.id),
    }));
    return ok({ ...study, series });
  });
}

export function DELETE(_: Request, { params }: { params: { id: string } }) {
  return handle(() => {
    const user = currentUser();
    need(can(user, 'admin'), 'Only administrators can delete studies', 403);
    deleteStudy(Number(params.id));
    audit(user, 'STUDY_DELETED', 'study', params.id);
    return ok({ ok: true });
  });
}
