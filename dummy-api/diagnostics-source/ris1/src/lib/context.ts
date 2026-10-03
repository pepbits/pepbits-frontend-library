import { all, get, Row } from './db';

export const ORDER_SELECT = `
  SELECT o.*,
    p.mrn, p.first_name, p.last_name, p.dob, p.sex, p.phone AS patient_phone, p.address AS patient_address, p.allergies,
    pr.code AS procedure_code, pr.name AS procedure_name, pr.body_part, pr.cpt, pr.price, pr.contrast AS procedure_contrast, pr.prep,
    rf.name AS referrer_name, rf.code AS referrer_code, rf.facility AS referrer_facility, rf.phone AS referrer_phone,
    t.name AS technologist_name, rd.name AS radiologist_name,
    r.status AS report_status, r.critical AS report_critical, r.version AS report_version,
    i.status AS billing_status, i.net AS billing_net, i.paid AS billing_paid,
    (SELECT id FROM studies s WHERE s.order_id = o.id ORDER BY id LIMIT 1) AS study_id,
    (SELECT study_uid FROM studies s WHERE s.order_id = o.id ORDER BY id LIMIT 1) AS study_uid,
    (SELECT SUM(num_instances) FROM studies s WHERE s.order_id = o.id) AS image_count
  FROM orders o
  JOIN patients p ON p.id = o.patient_id
  JOIN procedures pr ON pr.id = o.procedure_id
  LEFT JOIN referrers rf ON rf.id = o.referrer_id
  LEFT JOIN users t ON t.id = o.technologist_id
  LEFT JOIN users rd ON rd.id = o.radiologist_id
  LEFT JOIN reports r ON r.order_id = o.id
  LEFT JOIN invoices i ON i.order_id = o.id AND i.status != 'CANCELLED'
`;

export function loadOrder(id: number): Row | undefined {
  return get(`${ORDER_SELECT} WHERE o.id = ?`, id);
}

export function loadOrderByAccession(acc: string): Row | undefined {
  return get(`${ORDER_SELECT} WHERE o.accession = ?`, acc);
}

export function loadReport(orderId: number) {
  const report = get(
    `SELECT r.*, a.name AS author_name, pb.name AS prelim_name, sb.name AS signed_name, sb.title AS signed_title, sb.signature AS signed_signature
     FROM reports r LEFT JOIN users a ON a.id = r.author_id LEFT JOIN users pb ON pb.id = r.prelim_by LEFT JOIN users sb ON sb.id = r.signed_by
     WHERE r.order_id = ?`, orderId);
  if (!report) return null;
  const addenda = all('SELECT ad.*, u.name AS author_name FROM addenda ad LEFT JOIN users u ON u.id = ad.author_id WHERE report_id = ? ORDER BY signed_at', report.id);
  const versions = all('SELECT v.*, u.name AS changed_by_name FROM report_versions v LEFT JOIN users u ON u.id = v.changed_by WHERE report_id = ? ORDER BY version DESC, id DESC', report.id);
  return { ...report, addenda, versions } as Row;
}

// ---------- Turnaround time ----------
export function tatTarget(priority: string, modality: string): number {
  const rule =
    get<{ target_minutes: number }>('SELECT target_minutes FROM tat_rules WHERE priority = ? AND modality_code = ?', priority, modality) ||
    get<{ target_minutes: number }>("SELECT target_minutes FROM tat_rules WHERE priority = ? AND modality_code = '*'", priority);
  return rule?.target_minutes ?? (priority === 'STAT' ? 60 : priority === 'URGENT' ? 240 : 1440);
}

/** Reporting TAT clock: starts at exam completion, stops at final signature. */
export function tatInfo(o: Row) {
  const target = tatTarget(o.priority, o.modality_code);
  const start = o.exam_completed_at ? new Date(o.exam_completed_at).getTime() : null;
  const end = o.final_at ? new Date(o.final_at).getTime() : Date.now();
  if (!start) return { target, elapsed: null as number | null, dueAt: null as string | null, state: 'NOT_STARTED' as const, done: false };
  const elapsed = Math.round((end - start) / 60000);
  const dueAt = new Date(start + target * 60000).toISOString();
  const state = elapsed > target ? 'BREACHED' : elapsed > target * 0.75 ? 'AT_RISK' : 'ON_TRACK';
  return { target, elapsed, dueAt, state, done: !!o.final_at };
}

export function withTat<T extends Row>(rows: T[]) {
  return rows.map((r) => ({ ...r, tat: tatInfo(r) }));
}
