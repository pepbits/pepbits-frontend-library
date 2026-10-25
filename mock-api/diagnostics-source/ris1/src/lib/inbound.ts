import { get, insert, now, update, Row, tx } from './db';
import { parseHl7, hl7Get, hl7Segments, buildAck, parseHl7Date, parseHl7Ts, Hl7Message } from './hl7';
import { newControlId, newMrn } from './ids';
import { createOrder, transition } from './workflow';
import { audit } from './audit';
import { emit } from './outbound';

const SYSTEM_USER = { id: 0, name: 'Interface engine', role: 'ADMIN', username: 'interface' };

class ValidationError extends Error {}

function logIn(protocol: string, type: string, controlId: string | null, payload: string, status: string, response: string, extra: Row = {}) {
  return insert('messages', {
    direction: 'IN', protocol, message_type: type, control_id: controlId, status, payload, response,
    created_at: now(), updated_at: now(), attempts: 1, ...extra,
  });
}

function upsertPatient(p: { mrn?: string; externalId?: string; first: string; last: string; dob?: string | null; sex?: string | null; phone?: string; address?: string }) {
  let row = (p.mrn && get('SELECT * FROM patients WHERE mrn = ?', p.mrn)) || (p.externalId && get('SELECT * FROM patients WHERE external_id = ?', p.externalId));
  if (row) {
    update('patients', row.id, { first_name: p.first || row.first_name, last_name: p.last || row.last_name, dob: p.dob || row.dob, sex: p.sex || row.sex, phone: p.phone || row.phone, address: p.address || row.address });
    return row.id as number;
  }
  if (!p.first || !p.last) throw new ValidationError('Patient name is required to register a new patient');
  return insert('patients', {
    mrn: p.mrn || newMrn(), external_id: p.externalId || null, first_name: p.first, last_name: p.last, dob: p.dob, sex: p.sex, phone: p.phone, address: p.address,
  });
}

function patientFromPid(m: Hl7Message) {
  const id = hl7Get(m, 'PID-3.1');
  if (!id) throw new ValidationError('PID-3 patient identifier is required');
  const last = hl7Get(m, 'PID-5.1');
  const first = hl7Get(m, 'PID-5.2');
  if (!last) throw new ValidationError('PID-5 patient name is required');
  const sex = hl7Get(m, 'PID-8');
  return upsertPatient({
    mrn: id, externalId: id, last, first, dob: parseHl7Date(hl7Get(m, 'PID-7')), sex: ['M', 'F', 'O', 'U'].includes(sex) ? sex : 'U',
    phone: hl7Get(m, 'PID-13.1'), address: [hl7Get(m, 'PID-11.1'), hl7Get(m, 'PID-11.3')].filter(Boolean).join(', '),
  });
}

function referrerFrom(m: Hl7Message) {
  const code = hl7Get(m, 'OBR-16.1') || hl7Get(m, 'ORC-12.1');
  const last = hl7Get(m, 'OBR-16.2') || hl7Get(m, 'ORC-12.2');
  const first = hl7Get(m, 'OBR-16.3') || hl7Get(m, 'ORC-12.3');
  if (!code && !last) return null;
  const existing = code ? get('SELECT id FROM referrers WHERE code = ?', code) : get('SELECT id FROM referrers WHERE name = ?', `Dr. ${first} ${last}`.trim());
  if (existing) return existing.id as number;
  return insert('referrers', { code: code || null, name: `Dr. ${[first, last].filter(Boolean).join(' ')}`, facility: hl7Get(m, 'MSH-4') });
}

const PRI: Row = { S: 'STAT', A: 'URGENT', R: 'ROUTINE', P: 'ROUTINE', T: 'URGENT' };

function findOrder(m: Hl7Message) {
  const acc = hl7Get(m, 'OBR-18') || hl7Get(m, 'OBR-3.1') || hl7Get(m, 'ORC-3.1');
  const placer = hl7Get(m, 'ORC-2.1') || hl7Get(m, 'OBR-2.1');
  return (acc && get('SELECT * FROM orders WHERE accession = ?', acc)) || (placer && get('SELECT * FROM orders WHERE placer_order_no = ?', placer)) || null;
}

function handleOrm(m: Hl7Message): { note: string; orderId?: number } {
  const control = hl7Get(m, 'ORC-1') || 'NW';
  if (control === 'NW') {
    const code = hl7Get(m, 'OBR-4.1');
    if (!code) throw new ValidationError('OBR-4 universal service ID (procedure code) is required');
    const proc = get('SELECT * FROM procedures WHERE (code = ? OR cpt = ?) AND active = 1', code, code);
    if (!proc) throw new ValidationError(`Procedure code "${code}" is not in the test master`);
    const placer = hl7Get(m, 'ORC-2.1') || hl7Get(m, 'OBR-2.1');
    if (placer) {
      const dup = get('SELECT accession FROM orders WHERE placer_order_no = ? AND status != \'CANCELLED\'', placer);
      if (dup) throw new ValidationError(`Placer order ${placer} already exists as accession ${dup.accession}`);
    }
    const reqAcc = hl7Get(m, 'OBR-18');
    return tx(() => {
      const patientId = patientFromPid(m);
      const orderId = createOrder({
        patient_id: patientId,
        procedure_id: proc.id,
        priority: PRI[hl7Get(m, 'OBR-5') || hl7Get(m, 'ORC-7.6') || hl7Get(m, 'OBR-27.6')] || 'ROUTINE',
        clinical_history: hl7Get(m, 'OBR-13') || hl7Get(m, 'OBR-31.2'),
        referrer_id: referrerFrom(m),
        placer_order_no: placer || null,
        accession: reqAcc && !get('SELECT id FROM orders WHERE accession = ?', reqAcc) ? reqAcc : null,
        patient_class: hl7Get(m, 'PV1-2') === 'I' ? 'IP' : hl7Get(m, 'PV1-2') === 'E' ? 'ER' : 'OP',
        source: 'HL7',
        source_system: hl7Get(m, 'MSH-3'),
        payer: hl7Get(m, 'IN1-4') ? 'INSURANCE' : 'SELF',
      }, SYSTEM_USER, { silent: true });
      const o = get('SELECT accession FROM orders WHERE id = ?', orderId)!;
      return { note: `Order created with accession ${o.accession}`, orderId };
    });
  }
  const order = findOrder(m);
  if (!order) throw new ValidationError('No matching order for ORC-2 placer number or OBR-18 accession');
  if (control === 'CA' || control === 'OC') {
    transition(order.id, 'cancel', { reason: hl7Get(m, 'ORC-16.2') || `Cancelled by ${hl7Get(m, 'MSH-3') || 'placer'}` }, SYSTEM_USER as any, { silent: true });
    return { note: `Order ${order.accession} cancelled`, orderId: order.id };
  }
  if (control === 'XO' || control === 'SC') {
    const scheduled = parseHl7Ts(hl7Get(m, 'OBR-27.4') || hl7Get(m, 'ORC-7.4'));
    if (scheduled && ['ORDERED', 'SCHEDULED'].includes(order.status)) transition(order.id, 'schedule', { scheduled_at: scheduled }, SYSTEM_USER as any, { silent: true });
    const pri = PRI[hl7Get(m, 'OBR-5')];
    transition(order.id, 'update', { priority: pri, clinical_history: hl7Get(m, 'OBR-13') || undefined }, SYSTEM_USER as any, { silent: true });
    return { note: `Order ${order.accession} updated`, orderId: order.id };
  }
  throw new ValidationError(`Order control "${control}" is not supported`);
}

function handleOru(m: Hl7Message): { note: string; orderId?: number } {
  const order = findOrder(m);
  if (!order) throw new ValidationError('No matching order for this result (OBR-3 / OBR-18)');
  if (order.status === 'CANCELLED') throw new ValidationError('Result received for a cancelled order');
  const status = hl7Get(m, 'OBR-25') || 'F';
  const sections: Row = { findings: [], impression: [], technique: [], comparison: [] };
  for (const seg of hl7Segments(m, 'OBX')) {
    const id = (seg[3] || '').split(m.sep.comp);
    const key = `${id[0]} ${id[1] || ''}`.toUpperCase();
    const value = (seg[5] || '').split(`${m.sep.esc}.br${m.sep.esc}`).join('\n');
    if (seg[2] === 'RP') continue;
    const bucket = /IMP/.test(key) ? 'impression' : /TECH/.test(key) ? 'technique' : /COMP/.test(key) ? 'comparison' : 'findings';
    sections[bucket].push(value);
  }
  if (!sections.findings.length && !sections.impression.length) throw new ValidationError('ORU contains no OBX report text');
  const t = parseHl7Ts(hl7Get(m, 'OBR-22')) || now();
  const reader = [hl7Get(m, 'OBR-32.3'), hl7Get(m, 'OBR-32.2')].filter(Boolean).join(' ') || hl7Get(m, 'MSH-3');
  const body = {
    findings: sections.findings.join('\n'), impression: sections.impression.join('\n') || '(see findings)',
    technique: sections.technique.join('\n') || null, comparison: sections.comparison.join('\n') || null,
  };
  tx(() => {
    const existing = get('SELECT * FROM reports WHERE order_id = ?', order.id);
    const rStatus = status === 'P' ? 'PRELIMINARY' : status === 'C' ? 'CORRECTED' : 'FINAL';
    let reportId: number;
    if (existing) {
      update('reports', existing.id, { ...body, status: rStatus, version: status === 'C' ? existing.version + 1 : existing.version, signed_at: rStatus !== 'PRELIMINARY' ? t : existing.signed_at, source: 'HL7', updated_at: now() });
      reportId = existing.id;
    } else {
      reportId = insert('reports', { order_id: order.id, ...body, status: rStatus, prelim_at: t, signed_at: rStatus !== 'PRELIMINARY' ? t : null, source: 'HL7', report_type: 'FREE', updated_at: now() });
    }
    insert('report_versions', { report_id: reportId, version: 1, status: rStatus, ...body, reason: `Received from ${reader} via HL7`, changed_at: now() });
    update('orders', order.id, {
      status: rStatus === 'PRELIMINARY' ? 'PRELIMINARY' : 'FINAL',
      exam_completed_at: order.exam_completed_at || t, prelim_at: order.prelim_at || t, final_at: rStatus !== 'PRELIMINARY' ? t : null,
    });
  });
  return { note: `Result (${status}) stored for ${order.accession}`, orderId: order.id };
}

function handleAdt(m: Hl7Message) {
  const id = patientFromPid(m);
  return { note: `Patient ${hl7Get(m, 'PID-3.1')} updated (id ${id})` };
}

/** Processes one inbound HL7 v2 message and returns the ACK to send back. */
export function processHl7(raw: string, channel = 'HTTP'): { ack: string; ok: boolean; note: string; messageId: number } {
  let msg: Hl7Message | null = null;
  const ackId = newControlId();
  try {
    msg = parseHl7(raw);
    const type = `${hl7Get(msg, 'MSH-9.1')}^${hl7Get(msg, 'MSH-9.2')}`;
    const ctrl = hl7Get(msg, 'MSH-10');
    if (!ctrl) throw new ValidationError('MSH-10 message control ID is required');
    const dupe = get("SELECT id FROM messages WHERE direction = 'IN' AND control_id = ? AND status = 'PROCESSED'", ctrl);
    if (dupe) throw new ValidationError(`Duplicate message control ID ${ctrl}`);
    let result: { note: string; orderId?: number };
    if (type.startsWith('ORM') || type.startsWith('OMI') || type.startsWith('OMG')) result = handleOrm(msg);
    else if (type.startsWith('ORU')) result = handleOru(msg);
    else if (type.startsWith('ADT')) result = handleAdt(msg);
    else throw new ValidationError(`Message type ${type} is not supported`);
    const ack = buildAck(msg, 'AA', ackId, result.note);
    const order = result.orderId ? get('SELECT accession FROM orders WHERE id = ?', result.orderId) : null;
    const messageId = logIn('HL7', `${type} via ${channel}`, ctrl, raw, 'PROCESSED', ack, { order_id: result.orderId ?? null, accession: order?.accession ?? null });
    audit(SYSTEM_USER, 'HL7_INBOUND', 'message', messageId, result.note);
    if (result.orderId && type.startsWith('ORM') && hl7Get(msg, 'ORC-1') === 'NW') emit('ORDER_NEW', result.orderId);
    return { ack, ok: true, note: result.note, messageId };
  } catch (e: any) {
    const reason = e instanceof ValidationError ? e.message : `Processing error: ${e?.message || e}`;
    const ack = buildAck(msg, e instanceof ValidationError ? 'AE' : 'AR', ackId, reason);
    const type = msg ? `${hl7Get(msg, 'MSH-9.1')}^${hl7Get(msg, 'MSH-9.2')} via ${channel}` : `Unparseable via ${channel}`;
    const messageId = logIn('HL7', type, msg ? hl7Get(msg, 'MSH-10') : null, raw, 'REJECTED', ack, { error: reason });
    return { ack, ok: false, note: reason, messageId };
  }
}

/** FHIR R4 ServiceRequest (with contained or identified Patient) → RIS order. */
export function processServiceRequest(sr: Row): { ok: boolean; status: number; body: Row } {
  const raw = JSON.stringify(sr, null, 2);
  try {
    if (sr?.resourceType !== 'ServiceRequest') throw new ValidationError('Body must be a FHIR ServiceRequest');
    const code = sr.code?.coding?.[0]?.code;
    if (!code) throw new ValidationError('ServiceRequest.code.coding[0].code is required');
    const proc = get('SELECT * FROM procedures WHERE (code = ? OR cpt = ?) AND active = 1', code, code);
    if (!proc) throw new ValidationError(`Procedure code "${code}" is not in the test master`);
    const contained = (sr.contained || []).find((r: Row) => r.resourceType === 'Patient');
    const ident = contained?.identifier?.[0]?.value || sr.subject?.identifier?.value;
    if (!ident) throw new ValidationError('Patient identifier is required (contained Patient or subject.identifier)');
    const name = contained?.name?.[0] || {};
    const placer = sr.identifier?.[0]?.value || null;
    const orderId = tx(() => {
      const patientId = upsertPatient({
        mrn: ident, externalId: ident, first: (name.given || [])[0] || '', last: name.family || '',
        dob: contained?.birthDate || null, sex: ({ male: 'M', female: 'F', other: 'O' } as Row)[contained?.gender] || 'U',
      });
      return createOrder({
        patient_id: patientId, procedure_id: proc.id,
        priority: ({ stat: 'STAT', asap: 'URGENT', urgent: 'URGENT', routine: 'ROUTINE' } as Row)[sr.priority] || 'ROUTINE',
        clinical_history: sr.reasonCode?.[0]?.text || sr.note?.[0]?.text, placer_order_no: placer, source: 'FHIR', source_system: sr.requester?.display || 'FHIR client',
      }, SYSTEM_USER, { silent: true });
    });
    const o = get('SELECT accession FROM orders WHERE id = ?', orderId)!;
    const body = { ...sr, id: o.accession, identifier: [...(sr.identifier || []), { system: 'urn:ris:accession', value: o.accession }], status: 'active' };
    logIn('FHIR', 'ServiceRequest', placer, raw, 'PROCESSED', JSON.stringify({ accession: o.accession }), { order_id: orderId, accession: o.accession });
    emit('ORDER_NEW', orderId);
    return { ok: true, status: 201, body };
  } catch (e: any) {
    const reason = e instanceof ValidationError ? e.message : `Processing error: ${e?.message || e}`;
    const outcome = { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: e instanceof ValidationError ? 'invalid' : 'exception', diagnostics: reason }] };
    logIn('FHIR', 'ServiceRequest', sr?.identifier?.[0]?.value || null, raw, 'REJECTED', JSON.stringify(outcome), { error: reason });
    return { ok: false, status: e instanceof ValidationError ? 422 : 500, body: outcome };
  }
}
