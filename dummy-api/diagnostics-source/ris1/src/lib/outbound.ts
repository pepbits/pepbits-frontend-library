import net from 'net';
import { all, get, insert, now, update, Row } from './db';
import { buildOrm, buildOru, parseHl7, hl7Get, OrderPayload, MLLP_START, MLLP_END } from './hl7';
import { newControlId } from './ids';
import { loadOrder, loadReport } from './context';
import { cStore } from './dicom/dimse';

export type RisEvent =
  | 'ORDER_NEW' | 'ORDER_UPDATE' | 'ORDER_CANCEL' | 'EXAM_COMPLETE'
  | 'REPORT_PRELIM' | 'REPORT_FINAL' | 'REPORT_CORRECTED' | 'STUDY_ROUTE';

export const ALL_EVENTS: RisEvent[] = ['ORDER_NEW', 'ORDER_UPDATE', 'ORDER_CANCEL', 'EXAM_COMPLETE', 'REPORT_PRELIM', 'REPORT_FINAL', 'REPORT_CORRECTED', 'STUDY_ROUTE'];

function orderPayload(o: Row, control: OrderPayload['control']): OrderPayload {
  return {
    accession: o.accession,
    placerOrderNo: o.placer_order_no,
    control,
    orderStatus: control === 'CA' ? 'CA' : o.status === 'SCHEDULED' ? 'SC' : 'IP',
    priority: o.priority,
    orderedAt: o.ordered_at,
    scheduledAt: o.scheduled_at,
    procedureCode: o.procedure_code,
    procedureName: o.procedure_name,
    modality: o.modality_code,
    clinicalHistory: o.clinical_history,
    referrer: { code: o.referrer_code, name: o.referrer_name },
    patient: { mrn: o.mrn, firstName: o.first_name, lastName: o.last_name, dob: o.dob, sex: o.sex, phone: o.patient_phone, address: o.patient_address },
    studyUid: o.study_uid,
  };
}

function reportText(orderId: number) {
  const r = loadReport(orderId);
  if (!r) return null;
  const sections = [
    { id: 'TECH', label: 'Technique', text: r.technique || '' },
    { id: 'COMP', label: 'Comparison', text: r.comparison || '' },
    { id: 'FIND', label: 'Findings', text: r.findings || '' },
    { id: 'IMP', label: 'Impression', text: r.impression || '' },
    ...r.addenda.map((a: Row, i: number) => ({ id: `ADD${i + 1}`, label: `Addendum ${i + 1}`, text: `${a.text}\n-- ${a.author_name}, ${a.signed_at}` })),
  ].filter((s) => s.text.trim());
  return { r, sections };
}

export function buildHl7For(event: RisEvent, o: Row, iface: Row): string | null {
  const h = { controlId: newControlId(), receivingApp: iface.name?.replace(/\s+/g, '_').toUpperCase(), receivingFacility: iface.facility || '' };
  switch (event) {
    case 'ORDER_NEW': return buildOrm(orderPayload(o, 'NW'), h);
    case 'ORDER_UPDATE':
    case 'EXAM_COMPLETE': return buildOrm(orderPayload(o, 'XO'), h);
    case 'ORDER_CANCEL': return buildOrm(orderPayload(o, 'CA'), h);
    case 'REPORT_PRELIM':
    case 'REPORT_FINAL':
    case 'REPORT_CORRECTED': {
      const rt = reportText(o.id);
      if (!rt) return null;
      const status = event === 'REPORT_PRELIM' ? 'P' : event === 'REPORT_FINAL' ? 'F' : 'C';
      return buildOru({ ...orderPayload(o, 'NW'), resultStatus: status, observedAt: rt.r.signed_at || rt.r.prelim_at || now(), radiologist: rt.r.signed_name || rt.r.prelim_name, sections: rt.sections }, h);
    }
    default: return null;
  }
}

export function buildFhirFor(event: RisEvent, o: Row): Row | null {
  const patient = { reference: `Patient/${o.mrn}`, display: `${o.first_name} ${o.last_name}`, identifier: { system: 'urn:ris:mrn', value: o.mrn } };
  if (event.startsWith('ORDER') || event === 'EXAM_COMPLETE') {
    return {
      resourceType: 'ServiceRequest',
      identifier: [{ system: 'urn:ris:accession', value: o.accession }, ...(o.placer_order_no ? [{ system: 'urn:placer', value: o.placer_order_no }] : [])],
      status: event === 'ORDER_CANCEL' ? 'revoked' : o.status === 'FINAL' ? 'completed' : 'active',
      intent: 'order',
      priority: ({ STAT: 'stat', URGENT: 'urgent', ROUTINE: 'routine' } as Row)[o.priority] || 'routine',
      code: { coding: [{ system: 'urn:ris:procedure', code: o.procedure_code, display: o.procedure_name }] },
      subject: patient,
      authoredOn: o.ordered_at,
      requester: o.referrer_name ? { display: o.referrer_name } : undefined,
      reasonCode: o.clinical_history ? [{ text: o.clinical_history }] : undefined,
    };
  }
  const rt = reportText(o.id);
  if (!rt) return null;
  return diagnosticReport(o, rt.r, event === 'REPORT_PRELIM' ? 'preliminary' : event === 'REPORT_FINAL' ? 'final' : 'amended');
}

export function diagnosticReport(o: Row, r: Row, status: string) {
  const text = [
    r.technique && `TECHNIQUE: ${r.technique}`,
    r.comparison && `COMPARISON: ${r.comparison}`,
    `FINDINGS: ${r.findings || ''}`,
    `IMPRESSION: ${r.impression || ''}`,
    ...(r.addenda || []).map((a: Row) => `ADDENDUM (${a.signed_at}): ${a.text}`),
  ].filter(Boolean).join('\n\n');
  return {
    resourceType: 'DiagnosticReport',
    id: `${o.accession}`,
    identifier: [{ system: 'urn:ris:accession', value: o.accession }],
    status,
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'RAD', display: 'Radiology' }] }],
    code: { coding: [{ system: 'urn:ris:procedure', code: o.procedure_code, display: o.procedure_name }] },
    subject: { reference: `Patient/${o.mrn}`, display: `${o.first_name} ${o.last_name}` },
    effectiveDateTime: o.exam_completed_at || o.ordered_at,
    issued: r.signed_at || r.prelim_at || r.updated_at,
    resultsInterpreter: r.signed_name ? [{ display: r.signed_name }] : undefined,
    conclusion: r.impression,
    presentedForm: [{ contentType: 'text/plain', data: Buffer.from(text).toString('base64'), title: 'Radiology report' }],
    imagingStudy: o.study_uid ? [{ identifier: { system: 'urn:dicom:uid', value: `urn:oid:${o.study_uid}` } }] : undefined,
  };
}

export function sendMllp(host: string, port: number, message: string, timeoutMs = 6000): Promise<string> {
  if (process.env.DIAGNOSTICS_EMBEDDED === '1') throw new Error('External transport is disabled in the reference host; configure a reviewed provider adapter.');
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port });
    let buf = '';
    const timer = setTimeout(() => { sock.destroy(); reject(new Error(`No ACK within ${timeoutMs / 1000}s`)); }, timeoutMs);
    sock.on('connect', () => sock.write(MLLP_START + message + MLLP_END));
    sock.on('data', (d) => {
      buf += d.toString('latin1');
      const end = buf.indexOf('\x1c');
      if (end >= 0) {
        clearTimeout(timer);
        sock.end();
        resolve(buf.slice(buf.indexOf(MLLP_START) + 1, end));
      }
    });
    sock.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

async function deliver(messageId: number) {
  if (process.env.DIAGNOSTICS_EMBEDDED === '1') throw new Error('External transport is disabled in the reference host; configure a reviewed provider adapter.');
  const m = get('SELECT * FROM messages WHERE id = ?', messageId);
  if (!m) return;
  const iface = get('SELECT * FROM interfaces WHERE id = ?', m.interface_id);
  if (!iface) return;
  const attempts = (m.attempts || 0) + 1;
  try {
    let response = '';
    if (iface.type === 'HL7_MLLP') {
      response = await sendMllp(iface.host, Number(iface.port), m.payload);
      const ack = parseHl7(response);
      const code = hl7Get(ack, 'MSA-1');
      if (code !== 'AA' && code !== 'CA') throw Object.assign(new Error(`Remote returned ${code}: ${hl7Get(ack, 'MSA-3')}`), { response });
    } else if (iface.type === 'HL7_HTTP' || iface.type === 'FHIR') {
      const res = await fetch(iface.url, {
        method: 'POST',
        headers: { 'Content-Type': iface.type === 'FHIR' ? 'application/fhir+json' : 'x-application/hl7-v2+er7' },
        body: m.payload,
        signal: AbortSignal.timeout(8000),
      });
      response = (await res.text()).slice(0, 4000);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { response });
    } else if (iface.type === 'DICOM') {
      const { studyId } = JSON.parse(m.payload);
      const paths = all<{ path: string }>('SELECT path FROM instances WHERE study_id = ? ORDER BY series_id, instance_number', studyId).map((x) => x.path);
      const r = await cStore({ host: iface.host, port: Number(iface.port), aeTitle: iface.ae_title || 'ANY-SCP' }, paths);
      response = `${r.sent}/${paths.length} instances stored. ${r.message}`;
      if (r.sent !== paths.length) throw Object.assign(new Error(response), { response });
    }
    update('messages', messageId, { status: 'SENT', response, error: null, attempts, updated_at: now() });
  } catch (e: any) {
    update('messages', messageId, { status: 'FAILED', response: e?.response || null, error: e?.message || String(e), attempts, updated_at: now() });
  }
}

export function queueStudyRoute(studyId: number, interfaceId: number) {
  const study = get('SELECT * FROM studies WHERE id = ?', studyId);
  const id = insert('messages', {
    direction: 'OUT', protocol: 'DICOM', message_type: 'C-STORE', interface_id: interfaceId, order_id: study?.order_id,
    accession: study?.accession, status: 'PENDING', payload: JSON.stringify({ studyId, studyUid: study?.study_uid }), created_at: now(), updated_at: now(),
  });
  void deliver(id);
  return id;
}

/** Fans an RIS event out to every active outbound interface subscribed to it. */
export function emit(event: RisEvent, orderId: number) {
  const ifaces = all("SELECT * FROM interfaces WHERE active = 1 AND direction = 'OUT'").filter((i) =>
    String(i.events || '').split(',').map((s: string) => s.trim()).includes(event),
  );
  if (!ifaces.length) return;
  const o = loadOrder(orderId);
  if (!o) return;
  for (const iface of ifaces) {
    if (iface.type === 'DICOM') {
      if (o.study_id) queueStudyRoute(o.study_id, iface.id);
      continue;
    }
    const isFhir = iface.type === 'FHIR';
    const payload = isFhir ? buildFhirFor(event, o) : buildHl7For(event, o, iface);
    if (!payload) continue;
    const text = isFhir ? JSON.stringify(payload, null, 2) : (payload as string);
    const controlId = isFhir ? null : hl7Get(parseHl7(text), 'MSH-10');
    const type = isFhir ? `${(payload as Row).resourceType}` : hl7Get(parseHl7(text), 'MSH-9.1') + '^' + hl7Get(parseHl7(text), 'MSH-9.2');
    const id = insert('messages', {
      direction: 'OUT', protocol: isFhir ? 'FHIR' : 'HL7', message_type: `${type} (${event})`, control_id: controlId,
      interface_id: iface.id, order_id: orderId, accession: o.accession, status: 'PENDING', payload: text, created_at: now(), updated_at: now(),
    });
    void deliver(id);
  }
}

export function retryMessage(id: number) {
  update('messages', id, { status: 'PENDING', updated_at: now() });
  return deliver(id);
}
