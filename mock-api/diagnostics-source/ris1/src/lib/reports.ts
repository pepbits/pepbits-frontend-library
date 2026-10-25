import { get, insert, now, tx, update, Row } from './db';
import { audit } from './audit';
import { emit } from './outbound';
import { HttpError } from './http';
import { can, User } from './session';

export type ReportBody = {
  technique?: string;
  comparison?: string;
  findings?: string;
  impression?: string;
  report_type?: string;
  structured_json?: string | null;
  template_id?: number | null;
  critical?: boolean;
  critical_category?: string | null;
  critical_severity?: string | null;
  critical_finding?: string | null;
};

const BODY_FIELDS = ['technique', 'comparison', 'findings', 'impression', 'report_type', 'structured_json', 'template_id', 'critical', 'critical_category'] as const;

function pick(b: ReportBody) {
  const out: Row = {};
  for (const k of BODY_FIELDS) if ((b as Row)[k] !== undefined) out[k] = (b as Row)[k];
  return out;
}

function orderFor(orderId: number) {
  const o = get('SELECT * FROM orders WHERE id = ?', orderId);
  if (!o) throw new HttpError(404, 'Order not found');
  if (o.status === 'CANCELLED') throw new HttpError(409, 'This order was cancelled');
  return o;
}

function snapshot(reportId: number, reason: string | null, user: User) {
  const r = get('SELECT * FROM reports WHERE id = ?', reportId)!;
  insert('report_versions', {
    report_id: reportId, version: r.version, status: r.status, technique: r.technique, comparison: r.comparison,
    findings: r.findings, impression: r.impression, reason, changed_by: user.id, changed_at: now(),
  });
}

function upsert(orderId: number, body: ReportBody, user: User): Row {
  const existing = get('SELECT * FROM reports WHERE order_id = ?', orderId);
  if (existing) {
    update('reports', existing.id, { ...pick(body), updated_at: now() });
    return get('SELECT * FROM reports WHERE id = ?', existing.id)!;
  }
  const id = insert('reports', { order_id: orderId, ...pick(body), status: 'DRAFT', author_id: user.id, updated_at: now() });
  return get('SELECT * FROM reports WHERE id = ?', id)!;
}

export function saveDraft(orderId: number, body: ReportBody, user: User) {
  orderFor(orderId);
  const r = get('SELECT status FROM reports WHERE order_id = ?', orderId);
  if (r && (r.status === 'FINAL' || r.status === 'CORRECTED'))
    throw new HttpError(409, 'The report is signed. Add an addendum or amend it instead.');
  if (!can(user, 'prelim')) throw new HttpError(403, 'Only radiologists and residents can edit reports');
  const saved = upsert(orderId, body, user);
  return saved;
}

function requireContent(body: ReportBody, existing?: Row) {
  const findings = body.findings ?? existing?.findings;
  const impression = body.impression ?? existing?.impression;
  if (!findings?.trim()) throw new HttpError(400, 'Findings cannot be empty when signing');
  if (!impression?.trim()) throw new HttpError(400, 'Impression cannot be empty when signing');
}

export function signPreliminary(orderId: number, body: ReportBody, user: User) {
  const o = orderFor(orderId);
  if (!can(user, 'prelim')) throw new HttpError(403, 'Only radiologists and residents can sign preliminary reports');
  if (!['COMPLETED', 'PRELIMINARY'].includes(o.status)) throw new HttpError(409, 'The exam must be completed by the technologist before reporting');
  const existing = get('SELECT * FROM reports WHERE order_id = ?', orderId);
  if (existing && ['FINAL', 'CORRECTED'].includes(existing.status)) throw new HttpError(409, 'Report already final');
  requireContent(body, existing);
  const t = now();
  const r = tx(() => {
    const r = upsert(orderId, body, user);
    update('reports', r.id, { status: 'PRELIMINARY', prelim_by: user.id, prelim_at: t });
    update('orders', orderId, { status: 'PRELIMINARY', prelim_at: o.prelim_at || t, radiologist_id: o.radiologist_id || user.id });
    snapshot(r.id, 'Preliminary signed', user);
    return r;
  });
  handleCritical(orderId, r.id, body, user);
  audit(user, 'REPORT_PRELIMINARY', 'order', orderId, { version: r.version });
  emit('REPORT_PRELIM', orderId);
}

export function signFinal(orderId: number, body: ReportBody, user: User) {
  const o = orderFor(orderId);
  if (!can(user, 'sign')) throw new HttpError(403, 'Only attending radiologists can sign final reports');
  if (!['COMPLETED', 'PRELIMINARY'].includes(o.status)) throw new HttpError(409, 'The exam must be completed by the technologist before reporting');
  const existing = get('SELECT * FROM reports WHERE order_id = ?', orderId);
  if (existing && ['FINAL', 'CORRECTED'].includes(existing.status)) throw new HttpError(409, 'Report already final. Use addendum or amend.');
  requireContent(body, existing);
  const t = now();
  const r = tx(() => {
    const r = upsert(orderId, body, user);
    update('reports', r.id, { status: 'FINAL', signed_by: user.id, signed_at: t });
    update('orders', orderId, { status: 'FINAL', final_at: t, prelim_at: o.prelim_at || t, radiologist_id: user.id });
    snapshot(r.id, 'Final signed', user);
    return r;
  });
  handleCritical(orderId, r.id, body, user);
  audit(user, 'REPORT_FINAL', 'order', orderId, { version: r.version });
  emit('REPORT_FINAL', orderId);
}

export function addAddendum(orderId: number, text: string, user: User) {
  orderFor(orderId);
  if (!can(user, 'sign')) throw new HttpError(403, 'Only attending radiologists can add addenda');
  const r = get('SELECT * FROM reports WHERE order_id = ?', orderId);
  if (!r || !['FINAL', 'CORRECTED'].includes(r.status)) throw new HttpError(409, 'Addenda can only be added to signed reports');
  if (!text?.trim()) throw new HttpError(400, 'Write the addendum text');
  insert('addenda', { report_id: r.id, text: text.trim(), author_id: user.id, signed_at: now() });
  update('reports', r.id, { updated_at: now() });
  audit(user, 'REPORT_ADDENDUM', 'order', orderId, { text: text.slice(0, 200) });
  emit('REPORT_CORRECTED', orderId);
}

export function amendReport(orderId: number, body: ReportBody, reason: string, user: User) {
  orderFor(orderId);
  if (!can(user, 'sign')) throw new HttpError(403, 'Only attending radiologists can amend reports');
  const r = get('SELECT * FROM reports WHERE order_id = ?', orderId);
  if (!r || !['FINAL', 'CORRECTED'].includes(r.status)) throw new HttpError(409, 'Only signed reports can be amended');
  if (!reason?.trim()) throw new HttpError(400, 'Give a reason for the amendment');
  requireContent(body, r);
  tx(() => {
    update('reports', r.id, { ...pick(body), status: 'CORRECTED', version: r.version + 1, signed_by: user.id, signed_at: now(), updated_at: now() });
    snapshot(r.id, `Amended: ${reason}`, user);
  });
  handleCritical(orderId, r.id, body, user);
  audit(user, 'REPORT_AMENDED', 'order', orderId, { reason, version: r.version + 1 });
  emit('REPORT_CORRECTED', orderId);
}

function handleCritical(orderId: number, reportId: number, body: ReportBody, user: User) {
  if (!body.critical) return;
  const open = get("SELECT id FROM critical_results WHERE order_id = ? AND status != 'ACKNOWLEDGED'", orderId);
  if (open) return;
  insert('critical_results', {
    order_id: orderId, report_id: reportId, category: body.critical_category || 'Unspecified critical finding',
    severity: body.critical_severity || 'RED', finding: body.critical_finding || body.impression?.slice(0, 400),
    status: 'OPEN', flagged_by: user.id, flagged_at: now(),
  });
  audit(user, 'CRITICAL_FLAGGED', 'order', orderId, { category: body.critical_category });
}

export function communicateCritical(id: number, data: Row, user: User) {
  const c = get('SELECT * FROM critical_results WHERE id = ?', id);
  if (!c) throw new HttpError(404, 'Critical result not found');
  if (data.action === 'acknowledge') {
    if (c.status !== 'COMMUNICATED') throw new HttpError(409, 'Record the communication before acknowledging');
    update('critical_results', id, { status: 'ACKNOWLEDGED', acknowledged_at: now(), notes: data.notes ?? c.notes });
    audit(user, 'CRITICAL_ACKNOWLEDGED', 'order', c.order_id, {});
    return;
  }
  if (!data.communicated_to?.trim()) throw new HttpError(400, 'Name the person who received the result');
  if (!data.method) throw new HttpError(400, 'Choose how it was communicated');
  update('critical_results', id, {
    status: 'COMMUNICATED', communicated_to: data.communicated_to, method: data.method, readback: data.readback ? 1 : 0,
    communicated_by: user.id, communicated_at: now(), notes: data.notes,
  });
  audit(user, 'CRITICAL_COMMUNICATED', 'order', c.order_id, { to: data.communicated_to, method: data.method, readback: !!data.readback });
}
