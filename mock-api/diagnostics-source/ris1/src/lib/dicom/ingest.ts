import fs from 'fs';
import path from 'path';
import * as dicomParser from 'dicom-parser';
import { DICOM_DIR, get, insert, run, now, update } from '../db';
import { audit } from '../audit';

export type IngestResult = {
  ok: boolean;
  sopUid?: string;
  studyUid?: string;
  studyId?: number;
  accession?: string;
  matchedOrderId?: number | null;
  duplicate?: boolean;
  error?: string;
};

function str(ds: dicomParser.DataSet, tag: string) {
  return (ds.string(tag) || '').trim();
}

function safe(s: string) {
  return s.replace(/[^0-9A-Za-z._-]/g, '_');
}

export function parseDicomHeader(buf: Buffer) {
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const ds = dicomParser.parseDicom(bytes, { untilTag: 'x7fe00010' });
  const h = {
    sopUid: str(ds, 'x00080018'),
    sopClass: str(ds, 'x00080016'),
    studyUid: str(ds, 'x0020000d'),
    seriesUid: str(ds, 'x0020000e'),
    accession: str(ds, 'x00080050'),
    modality: str(ds, 'x00080060'),
    studyDate: str(ds, 'x00080020'),
    studyDescription: str(ds, 'x00081030'),
    seriesDescription: str(ds, 'x0008103e'),
    seriesNumber: Number(str(ds, 'x00200011') || 0),
    instanceNumber: Number(str(ds, 'x00200013') || 0),
    bodyPart: str(ds, 'x00180015'),
    patientName: str(ds, 'x00100010'),
    patientId: str(ds, 'x00100020'),
    patientDob: str(ds, 'x00100030'),
    patientSex: str(ds, 'x00100040'),
    rows: ds.uint16('x00280010') || 0,
    cols: ds.uint16('x00280011') || 0,
    transferSyntax: str(ds, 'x00020010'),
  };
  return h;
}

/** Stores one DICOM instance, indexes it, and reconciles it to a RIS order by accession number. */
export function ingestDicom(buf: Buffer, sourceAe = 'UPLOAD'): IngestResult {
  let h: ReturnType<typeof parseDicomHeader>;
  try {
    h = parseDicomHeader(buf);
  } catch (e: any) {
    return { ok: false, error: `Not a readable DICOM file: ${e?.message || e}` };
  }
  if (!h.sopUid || !h.studyUid || !h.seriesUid) return { ok: false, error: 'Missing Study, Series or SOP Instance UID' };

  const existing = get('SELECT id, study_id FROM instances WHERE sop_uid = ?', h.sopUid);
  if (existing) return { ok: true, duplicate: true, sopUid: h.sopUid, studyUid: h.studyUid, studyId: existing.study_id };

  const dir = path.join(DICOM_DIR, safe(h.studyUid), safe(h.seriesUid));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${safe(h.sopUid)}.dcm`);
  fs.writeFileSync(file, buf);

  let study = get('SELECT * FROM studies WHERE study_uid = ?', h.studyUid);
  const order = h.accession ? get('SELECT id, status FROM orders WHERE accession = ?', h.accession) : undefined;
  if (!study) {
    const date = h.studyDate ? `${h.studyDate.slice(0, 4)}-${h.studyDate.slice(4, 6)}-${h.studyDate.slice(6, 8)}` : null;
    const id = insert('studies', {
      study_uid: h.studyUid,
      accession: h.accession || null,
      order_id: order?.id ?? null,
      patient_id_dicom: h.patientId,
      patient_name: h.patientName,
      patient_dob: h.patientDob,
      patient_sex: h.patientSex,
      modality: h.modality,
      study_date: date,
      description: h.studyDescription,
      source_ae: sourceAe,
      received_at: now(),
    });
    study = get('SELECT * FROM studies WHERE id = ?', id);
    audit(null, 'STUDY_RECEIVED', 'study', id, { accession: h.accession, from: sourceAe, matched: !!order });
  }
  let series = get('SELECT * FROM series WHERE series_uid = ?', h.seriesUid);
  if (!series) {
    const id = insert('series', {
      series_uid: h.seriesUid,
      study_id: study!.id,
      modality: h.modality,
      series_number: h.seriesNumber,
      description: h.seriesDescription,
      body_part: h.bodyPart,
    });
    series = get('SELECT * FROM series WHERE id = ?', id);
  }
  insert('instances', {
    sop_uid: h.sopUid,
    sop_class: h.sopClass,
    series_id: series!.id,
    study_id: study!.id,
    instance_number: h.instanceNumber,
    rows: h.rows,
    cols: h.cols,
    transfer_syntax: h.transferSyntax,
    path: path.relative(DICOM_DIR, file),
    size: buf.length,
  });
  run('UPDATE series SET num_instances = num_instances + 1 WHERE id = ?', series!.id);
  run(
    `UPDATE studies SET num_instances = num_instances + 1, size_bytes = size_bytes + ?,
       num_series = (SELECT COUNT(*) FROM series WHERE study_id = studies.id),
       modality = CASE WHEN instr(IFNULL(modality,''), ?) > 0 THEN modality ELSE IFNULL(modality || '\\', '') || ? END
     WHERE id = ?`,
    buf.length, h.modality, h.modality, study!.id,
  );

  if (order && !study!.order_id) run('UPDATE studies SET order_id = ? WHERE id = ?', order.id, study!.id);
  if (order) onImagesArrived(order.id);

  return { ok: true, sopUid: h.sopUid, studyUid: h.studyUid, studyId: study!.id, accession: h.accession, matchedOrderId: order?.id ?? null };
}

/** Images arriving for an order that is not yet in progress starts the exam clock (MPPS-like). */
export function onImagesArrived(orderId: number) {
  const o = get('SELECT status, exam_started_at, arrived_at FROM orders WHERE id = ?', orderId);
  if (!o) return;
  if (['ORDERED', 'SCHEDULED', 'ARRIVED'].includes(o.status)) {
    update('orders', orderId, { status: 'IN_PROGRESS', arrived_at: o.arrived_at || now(), exam_started_at: o.exam_started_at || now() });
  }
}

export function reconcileStudy(studyId: number, orderId: number) {
  const order = get('SELECT id, accession FROM orders WHERE id = ?', orderId);
  if (!order) throw new Error('Order not found');
  run('UPDATE studies SET order_id = ?, accession = ? WHERE id = ?', order.id, order.accession, studyId);
  onImagesArrived(order.id);
}

export function instanceFilePath(rel: string) {
  const full = path.resolve(DICOM_DIR, rel);
  if (!full.startsWith(path.resolve(DICOM_DIR))) throw new Error('Invalid path');
  return full;
}

export function deleteStudy(studyId: number) {
  const s = get('SELECT study_uid FROM studies WHERE id = ?', studyId);
  if (!s) return;
  run('DELETE FROM instances WHERE study_id = ?', studyId);
  run('DELETE FROM series WHERE study_id = ?', studyId);
  run('DELETE FROM studies WHERE id = ?', studyId);
  fs.rmSync(path.join(DICOM_DIR, safe(s.study_uid)), { recursive: true, force: true });
}
