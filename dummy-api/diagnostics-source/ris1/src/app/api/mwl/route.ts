import { all } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Modality worklist (JSON). Modalities query by AE title or modality code and receive
 * the attributes a DICOM MWL C-FIND would return.
 */
export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const ae = sp.get('ae');
  const modality = sp.get('modality');
  const rows = all(
    `SELECT o.accession, o.priority, o.scheduled_at, o.ordered_at, o.modality_code, o.clinical_history, m.ae_title, m.room,
            pr.code, pr.name, p.mrn, p.first_name, p.last_name, p.dob, p.sex, rf.name AS referrer, o.placer_order_no,
            (SELECT study_uid FROM studies s WHERE s.order_id = o.id LIMIT 1) AS study_uid
     FROM orders o JOIN patients p ON p.id = o.patient_id JOIN procedures pr ON pr.id = o.procedure_id
     JOIN modalities m ON m.code = o.modality_code LEFT JOIN referrers rf ON rf.id = o.referrer_id
     WHERE o.status IN ('SCHEDULED','ARRIVED','IN_PROGRESS') AND (? IS NULL OR m.ae_title = ?) AND (? IS NULL OR o.modality_code = ?)
     ORDER BY CASE o.priority WHEN 'STAT' THEN 0 WHEN 'URGENT' THEN 1 ELSE 2 END, COALESCE(o.scheduled_at, o.ordered_at)`,
    ae, ae, modality, modality);
  return Response.json(rows.map((r) => ({
    AccessionNumber: r.accession,
    PatientID: r.mrn,
    PatientName: `${r.last_name.toUpperCase()}^${r.first_name.toUpperCase()}`,
    PatientBirthDate: (r.dob || '').replace(/-/g, ''),
    PatientSex: r.sex,
    ReferringPhysicianName: r.referrer,
    RequestedProcedureID: r.code,
    RequestedProcedureDescription: r.name,
    RequestedProcedurePriority: r.priority,
    StudyInstanceUID: r.study_uid,
    PlacerOrderNumberImagingServiceRequest: r.placer_order_no,
    ScheduledProcedureStepSequence: [{
      Modality: r.modality_code, ScheduledStationAETitle: r.ae_title, ScheduledProcedureStepLocation: r.room,
      ScheduledProcedureStepStartDateTime: r.scheduled_at || r.ordered_at, ScheduledProcedureStepDescription: r.name,
    }],
    ReasonForTheRequestedProcedure: r.clinical_history,
  })));
}
