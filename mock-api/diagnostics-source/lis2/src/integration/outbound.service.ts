import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Db, nowIso } from '../db/database.service';
import { buildASTM, buildHL7, escapeHL7, hl7Ts, mshSegment, parseHL7 } from './codecs';
import { httpPost, sendASTM, sendMLLP } from './transport';
import { sqlTime } from '../common/util';

const PRIORITY_HL7: Record<string, string> = { STAT: 'S', URGENT: 'A', ROUTINE: 'R' };

/**
 * Everything the LIS sends out:
 *  1. Analyzer / middleware work orders after accession (broadcast) – pushed over TCP or left for the middleware to poll.
 *  2. Referral orders to reference labs for outsourced tests.
 *  3. Result publication after signing, amendment and addendum – an outbox with PUSH (retry with backoff) and PULL (poll + ack).
 */
@Injectable()
export class OutboundService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Outbound');
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(private readonly db: Db) {}

  onModuleInit() {
    if (process.env.DIAGNOSTICS_EMBEDDED === "1") return;
    const every = Number(process.env.DISPATCH_INTERVAL_MS || 10000);
    this.timer = setInterval(() => this.tick().catch((e) => this.log.error(e.message)), every);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private lab() {
    return { app: this.db.setting('lab.hl7_app', 'LIS'), facility: this.db.setting('lab.hl7_facility', 'LAB'), name: this.db.setting('lab.name', 'Laboratory') };
  }

  logMessage(row: { interface_id?: number | null; facility_id?: number | null; direction: 'IN' | 'OUT'; protocol: string; message_type?: string; control_id?: string; transport?: string; remote?: string; raw: string; status: string; error?: string; ref_type?: string; ref_id?: number | null; response?: string }) {
    return this.db.insert('interface_messages', row);
  }

  /* ─────────── 1. Analyzer work orders ─────────── */

  /** Routes received in-house tests of a sample to analyzers per mapping, and queues order messages per interface. */
  dispatchSample(sampleId: number, force = false): number {
    const sample = this.db.get(`SELECT s.*, p.mrn, p.first_name, p.last_name, p.dob, p.gender FROM samples s JOIN patients p ON p.id = s.patient_id WHERE s.id = ?`, sampleId);
    if (!sample) return 0;
    const items = this.db.all(`SELECT i.* FROM order_items i WHERE i.sample_id = ? AND i.is_outsourced = 0 AND i.status IN ('RECEIVED','IN_PROCESS')`, sampleId);
    const perAnalyzer = new Map<number, { analyzer: any; codes: Set<string>; items: number[] }>();
    for (const it of items) {
      const route = this.db.get(`SELECT m.analyzer_id FROM m_analyzer_mappings m JOIN m_analyzers a ON a.id = m.analyzer_id
        WHERE m.test_id = ? AND m.active = 1 AND a.active = 1 ORDER BY m.priority, m.analyzer_id LIMIT 1`, it.test_id);
      if (!route) continue;
      const analyzer = this.db.get('SELECT * FROM m_analyzers WHERE id = ?', route.analyzer_id);
      const codes = this.db.all('SELECT DISTINCT order_code FROM m_analyzer_mappings WHERE analyzer_id = ? AND test_id = ? AND active = 1', analyzer.id, it.test_id).map((r) => r.order_code);
      const exists = this.db.get('SELECT id FROM instrument_orders WHERE analyzer_id = ? AND order_item_id = ?', analyzer.id, it.id);
      if (exists && !force) continue;
      if (!exists) this.db.insert('instrument_orders', { sample_id: sampleId, analyzer_id: analyzer.id, order_item_id: it.id, order_codes: codes.join(','), status: analyzer.query_mode === 'HOST_QUERY' ? 'AWAITING_QUERY' : 'QUEUED' });
      if (analyzer.query_mode === 'HOST_QUERY') continue;
      const entry = perAnalyzer.get(analyzer.id) || { analyzer, codes: new Set<string>(), items: [] };
      codes.forEach((c) => entry.codes.add(c));
      entry.items.push(it.id);
      perAnalyzer.set(analyzer.id, entry);
    }
    for (const { analyzer, codes, items: ids } of perAnalyzer.values()) {
      const iface = this.interfaceForAnalyzer(analyzer);
      if (!iface) continue;
      const raw = this.buildWorkOrder(iface, analyzer, sample, [...codes], 'NW');
      const msgId = this.logMessage({
        interface_id: iface.id, direction: 'OUT', protocol: iface.protocol, message_type: iface.protocol === 'ASTM' ? 'ASTM-O' : 'OML^O33', control_id: `WO${sampleId}-${analyzer.id}-${Date.now()}`,
        transport: iface.transport, raw, status: 'QUEUED', ref_type: 'SAMPLE', ref_id: sampleId,
      });
      this.db.run(`UPDATE instrument_orders SET message_id = ? WHERE analyzer_id = ? AND order_item_id IN (${ids.map(() => '?').join(',')})`, msgId, analyzer.id, ...ids);
    }
    return perAnalyzer.size;
  }

  interfaceForAnalyzer(analyzer: any) {
    if (analyzer.interface_id) return this.db.get('SELECT * FROM m_interfaces WHERE id = ? AND active = 1', analyzer.interface_id);
    if (analyzer.middleware_id) return this.db.get('SELECT i.* FROM m_middleware m JOIN m_interfaces i ON i.id = m.interface_id WHERE m.id = ? AND i.active = 1', analyzer.middleware_id);
    return null;
  }

  /** HL7 OML^O33 (specimen-centric) or ASTM H/P/O/L work order for one sample. Control 'NW' new, 'CA' cancel. */
  buildWorkOrder(iface: any, analyzer: any, sample: any, codes: string[], control: 'NW' | 'CA') {
    const lab = this.lab();
    if (iface.protocol === 'ASTM') {
      return buildASTM([
        ['H', '\\^&', '', '', `${lab.app}^${lab.facility}`, '', '', '', '', analyzer.instrument_id || analyzer.code, '', 'P', '1394-97', hl7Ts()],
        ['P', 1, sample.mrn, '', '', `${sample.last_name || ''}^${sample.first_name}`, '', (sample.dob || '').replace(/-/g, ''), sample.gender],
        ['O', 1, sample.sample_no, '', codes.map((c) => `^^^${c}`).join('\\'), PRIORITY_HL7[sample.priority] || 'R', hl7Ts(sample.collected_at), '', '', '', '', control === 'CA' ? 'C' : 'N', '', '', hl7Ts(sample.received_at), '', '', '', '', '', '', '', '', '', 'O'],
        ['L', 1, 'N'],
      ]);
    }
    const ctrl = `WO${sample.id}${Date.now()}`;
    return buildHL7([
      mshSegment({ sendingApp: lab.app, sendingFacility: lab.facility, receivingApp: iface.receiving_app || analyzer.instrument_id, receivingFacility: iface.receiving_facility, type: 'OML^O33^OML_O33', controlId: ctrl, version: iface.hl7_version }),
      ['PID', 1, '', `${sample.mrn}^^^${lab.facility}^MR`, '', `${escapeHL7(sample.last_name || '')}^${escapeHL7(sample.first_name)}`, '', (sample.dob || '').replace(/-/g, ''), sample.gender],
      ['SPM', 1, `${sample.sample_no}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', hl7Ts(sample.collected_at), hl7Ts(sample.received_at)],
      ...codes.flatMap((c, i) => [
        ['ORC', control, `${sample.sample_no}-${i + 1}`, '', sample.sample_no, '', '', '', '', hl7Ts()],
        ['OBR', i + 1, `${sample.sample_no}-${i + 1}`, sample.sample_no, `${c}^^${analyzer.code}`, PRIORITY_HL7[sample.priority] || 'R', '', hl7Ts(sample.collected_at)],
      ]),
    ]);
  }

  /** Cancel messages when a sample is rejected. */
  cancelSample(sampleId: number) {
    const rows = this.db.all(`SELECT io.analyzer_id, GROUP_CONCAT(io.order_codes) codes FROM instrument_orders io WHERE io.sample_id = ? AND io.status IN ('QUEUED','SENT') GROUP BY io.analyzer_id`, sampleId);
    const sample = this.db.get(`SELECT s.*, p.mrn, p.first_name, p.last_name, p.dob, p.gender FROM samples s JOIN patients p ON p.id = s.patient_id WHERE s.id = ?`, sampleId);
    for (const r of rows) {
      const analyzer = this.db.get('SELECT * FROM m_analyzers WHERE id = ?', r.analyzer_id);
      const iface = this.interfaceForAnalyzer(analyzer);
      if (!iface) continue;
      this.logMessage({ interface_id: iface.id, direction: 'OUT', protocol: iface.protocol, message_type: 'CANCEL', transport: iface.transport,
        raw: this.buildWorkOrder(iface, analyzer, sample, String(r.codes).split(','), 'CA'), status: 'QUEUED', ref_type: 'SAMPLE', ref_id: sampleId });
    }
    this.db.run("UPDATE instrument_orders SET status = 'CANCELLED' WHERE sample_id = ? AND status <> 'RESULTED'", sampleId);
  }

  /* ─────────── 2. Referral orders to reference labs ─────────── */
  queueReferral(shipmentId: number) {
    const sh = this.db.get('SELECT s.*, l.interface_id, l.name lab_name FROM outsource_shipments s JOIN m_outsource_labs l ON l.id = s.outsource_lab_id WHERE s.id = ?', shipmentId);
    const iface = sh?.interface_id ? this.db.get('SELECT * FROM m_interfaces WHERE id = ? AND active = 1', sh.interface_id) : null;
    if (!iface) return null;
    const lab = this.lab();
    const items = this.db.all(`SELECT i.*, t.code test_code, t.name test_name, lc.loinc_num, s.sample_no, s.collected_at, o.order_no, p.mrn, p.first_name, p.last_name, p.dob, p.gender
      FROM order_items i JOIN m_tests t ON t.id = i.test_id LEFT JOIN m_loinc lc ON lc.id = t.loinc_id JOIN samples s ON s.id = i.sample_id
      JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id WHERE i.shipment_id = ? ORDER BY p.id, s.id`, shipmentId);
    const ids: number[] = [];
    for (const it of items) {
      const raw = iface.protocol === 'FHIR_R4'
        ? JSON.stringify(this.fhirServiceRequest(it, lab))
        : buildHL7([
          mshSegment({ sendingApp: lab.app, sendingFacility: lab.facility, receivingApp: iface.receiving_app, receivingFacility: iface.receiving_facility, type: 'ORM^O01^ORM_O01', controlId: `REF${it.id}`, version: iface.hl7_version }),
          ['PID', 1, '', `${it.mrn}^^^${lab.facility}^MR`, '', `${escapeHL7(it.last_name || '')}^${escapeHL7(it.first_name)}`, '', (it.dob || '').replace(/-/g, ''), it.gender],
          ['ORC', 'NW', `${it.order_no}-${it.id}`, '', sh.manifest_no],
          ['OBR', 1, `${it.order_no}-${it.id}`, '', `${it.loinc_num || it.test_code}^${escapeHL7(it.test_name)}^${it.loinc_num ? 'LN' : 'L'}`, PRIORITY_HL7[it.priority] || 'R', '', hl7Ts(it.collected_at), '', '', '', '', '', '', '', '', '', it.sample_no],
          ['SPM', 1, it.sample_no],
        ]);
      ids.push(this.logMessage({ interface_id: iface.id, direction: 'OUT', protocol: iface.protocol, message_type: 'ORM^O01', control_id: `REF${it.id}`, transport: iface.transport, raw, status: 'QUEUED', ref_type: 'SHIPMENT', ref_id: shipmentId }));
    }
    return ids;
  }

  private fhirServiceRequest(it: any, lab: any) {
    return {
      resourceType: 'ServiceRequest', status: 'active', intent: 'order', priority: (it.priority || 'ROUTINE').toLowerCase(),
      identifier: [{ system: `urn:lis:${lab.facility}:order-item`, value: `${it.order_no}-${it.id}` }],
      code: { coding: [it.loinc_num ? { system: 'http://loinc.org', code: it.loinc_num, display: it.test_name } : { system: `urn:lis:${lab.facility}:test`, code: it.test_code, display: it.test_name }] },
      subject: { identifier: { system: `urn:lis:${lab.facility}:mrn`, value: it.mrn }, display: `${it.first_name} ${it.last_name || ''}`.trim() },
      specimen: [{ identifier: { value: it.sample_no } }],
    };
  }

  /* ─────────── 3. Result publication (outbox) ─────────── */

  /** Called on sign / amendment / addendum. Creates one outbox row per subscriber (client facility, HIS, HIE). */
  publishReport(itemId: number, event: 'FINAL' | 'CORRECTED' | 'ADDENDUM', version: number) {
    const it = this.db.get('SELECT i.*, o.facility_id, o.source FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.id = ?', itemId);
    if (!it) return;
    const targets: { facility_id: number | null; iface: any; format: string; mode: string }[] = [];
    if (it.facility_id) {
      const f = this.db.get('SELECT * FROM m_facilities WHERE id = ? AND active = 1', it.facility_id);
      if (f) {
        const iface = f.interface_id ? this.db.get('SELECT * FROM m_interfaces WHERE id = ?', f.interface_id) : null;
        const format = f.result_format || iface?.protocol || 'HL7V2';
        if (f.result_delivery === 'PUSH' || f.result_delivery === 'BOTH') targets.push({ facility_id: f.id, iface, format, mode: 'PUSH' });
        if (f.result_delivery === 'PULL' || f.result_delivery === 'BOTH') targets.push({ facility_id: f.id, iface, format, mode: 'PULL' });
      }
    }
    const broadcast = this.db.all(`SELECT * FROM m_interfaces WHERE active = 1 AND direction IN ('OUTBOUND','BIDIRECTIONAL') AND (category = 'HIE' OR (category = 'HIS' AND ? IS NULL))`, it.facility_id);
    for (const iface of broadcast) targets.push({ facility_id: null, iface, format: iface.protocol === 'ASTM' ? 'HL7V2' : iface.protocol, mode: iface.delivery_mode || 'PUSH' });

    for (const t of targets) {
      const payload = this.buildResultMessage(itemId, t.format, event, version, t.iface);
      this.db.insert('result_publications', {
        order_item_id: itemId, order_id: it.order_id, facility_id: t.facility_id, interface_id: t.iface?.id ?? null, event, report_version: version,
        format: t.format, mode: t.mode, payload, status: t.mode === 'PULL' ? 'AVAILABLE' : 'PENDING',
      });
    }
  }

  reportData(itemId: number) {
    const it = this.db.get(`SELECT i.*, t.code test_code, t.name test_name, lt.loinc_num test_loinc, d.name department, o.order_no, o.external_order_no, o.facility_id,
      o.priority order_priority, p.mrn, p.first_name, p.last_name, p.dob, p.gender, e.external_encounter_no, e.encounter_no, e.type encounter_type,
      s.sample_no, s.external_sample_no, s.collected_at, s.received_at, st.name sample_type, st.snomed_code sample_snomed, u.full_name signed_by_name,
      (SELECT identifier FROM patient_identifiers pi WHERE pi.patient_id = p.id AND pi.facility_id = o.facility_id) external_mrn
      FROM order_items i JOIN m_tests t ON t.id = i.test_id LEFT JOIN m_loinc lt ON lt.id = t.loinc_id LEFT JOIN m_departments d ON d.id = t.department_id
      JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id LEFT JOIN encounters e ON e.id = o.encounter_id
      LEFT JOIN samples s ON s.id = i.sample_id LEFT JOIN m_sample_types st ON st.id = s.sample_type_id LEFT JOIN users u ON u.id = i.signed_by WHERE i.id = ?`, itemId);
    const results = this.db.all(`SELECT r.*, p.code, p.name, p.result_type, lc.loinc_num, un.ucum_code FROM results r JOIN m_parameters p ON p.id = r.parameter_id
      JOIN m_test_parameters tp ON tp.parameter_id = p.id AND tp.test_id = ? LEFT JOIN m_loinc lc ON lc.id = p.loinc_id LEFT JOIN m_units un ON un.id = p.unit_id
      WHERE r.order_item_id = ? AND tp.printable = 1 ORDER BY tp.sort_order`, it.test_id, itemId);
    const versions = this.db.all('SELECT v.*, u.full_name signed_by_name FROM report_versions v LEFT JOIN users u ON u.id = v.signed_by WHERE order_item_id = ? ORDER BY version', itemId);
    return { it, results, versions };
  }

  buildResultMessage(itemId: number, format: string, event: string, version: number, iface: any): string {
    const { it, results, versions } = this.reportData(itemId);
    const lab = this.lab();
    const status = event === 'FINAL' ? 'F' : 'C';
    const addenda = versions.filter((v) => v.kind === 'ADDENDUM');
    const amendment = versions.filter((v) => v.kind === 'AMENDMENT').pop();
    if (format === 'FHIR_R4') return JSON.stringify(this.fhirReport(it, results, addenda, amendment, event, version, lab), null, 2);
    if (format === 'JSON') {
      return JSON.stringify({
        event, version, orderNo: it.order_no, externalOrderNo: it.external_order_no, lineNo: it.external_line_no, test: { code: it.test_code, name: it.test_name, loinc: it.test_loinc },
        patient: { mrn: it.mrn, externalId: it.external_mrn, name: `${it.first_name} ${it.last_name || ''}`.trim(), dob: it.dob, gender: it.gender },
        sample: { sampleNo: it.sample_no, externalSampleNo: it.external_sample_no, collectedAt: it.collected_at },
        signedBy: it.signed_by_name, signedAt: it.signed_at, interpretation: it.interpretation, amendmentReason: amendment?.reason,
        addenda: addenda.map((a) => ({ version: a.version, text: a.addendum_text, signedAt: a.signed_at })),
        results: results.map((r) => ({ code: r.code, loinc: r.loinc_num, name: r.name, value: r.value, unit: r.unit, referenceRange: r.ref_text, flag: r.flag, critical: !!r.is_critical })),
      }, null, 2);
    }
    const segs: any[][] = [
      mshSegment({ sendingApp: lab.app, sendingFacility: lab.facility, receivingApp: iface?.receiving_app || iface?.sending_app, receivingFacility: iface?.receiving_facility || iface?.sending_facility, type: 'ORU^R01^ORU_R01', controlId: `RES${itemId}V${version}`, version: iface?.hl7_version }),
      ['PID', 1, '', [it.external_mrn ? `${escapeHL7(it.external_mrn)}^^^EXT^MR` : null, `${it.mrn}^^^${lab.facility}^MR`].filter(Boolean).join('~'), '', `${escapeHL7(it.last_name || '')}^${escapeHL7(it.first_name)}`, '', (it.dob || '').replace(/-/g, ''), it.gender],
      ['PV1', 1, it.encounter_type === 'IP' ? 'I' : it.encounter_type === 'ER' ? 'E' : 'O', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', escapeHL7(it.external_encounter_no || it.encounter_no)],
      ['ORC', 'RE', escapeHL7(it.external_order_no || ''), `${it.order_no}-${it.id}`, '', 'CM'],
      ['OBR', 1, escapeHL7(it.external_order_no || ''), `${it.order_no}-${it.id}`, `${it.test_loinc || it.test_code}^${escapeHL7(it.test_name)}^${it.test_loinc ? 'LN' : 'L'}`, '', '', hl7Ts(it.collected_at), '', '', '', '', '', '', hl7Ts(it.received_at), '', '', '', '', '', '', hl7Ts(it.signed_at), '', escapeHL7(it.department || ''), status, '', '', '', '', '', '', `${escapeHL7(it.signed_by_name || '')}`],
    ];
    if (amendment) segs.push(['NTE', segs.length, 'L', escapeHL7(`Amended report (version ${amendment.version}): ${amendment.reason || ''}`)]);
    results.forEach((r, i) => {
      const type = r.result_type === 'NUMERIC' || r.result_type === 'CALCULATED' ? (/^[<>]/.test(r.value || '') ? 'SN' : 'NM') : r.result_type === 'OPTION' ? 'CWE' : r.result_type === 'MEMO' ? 'TX' : 'ST';
      const val = type === 'SN' ? `${r.value[0]}^${r.value.replace(/^[<>]=?/, '')}` : escapeHL7(r.value);
      segs.push(['OBX', i + 1, type, `${r.loinc_num || r.code}^${escapeHL7(r.name)}^${r.loinc_num ? 'LN' : 'L'}`, '', val, escapeHL7(r.ucum_code || r.unit || ''), escapeHL7(r.ref_text || ''),
        r.flag && r.flag !== 'N' ? r.flag : 'N', '', '', status, '', '', hl7Ts(r.updated_at || r.entered_at)]);
      if (r.comment) segs.push(['NTE', i + 1, 'L', escapeHL7(r.comment)]);
    });
    if (it.interpretation) segs.push(['NTE', 900, 'L', escapeHL7(`Interpretation: ${it.interpretation}`)]);
    addenda.forEach((a) => segs.push(['NTE', 900 + a.version, 'L', escapeHL7(`Addendum (v${a.version}, ${a.signed_at}): ${a.addendum_text}`)]));
    segs.push(['SPM', 1, `${it.sample_no || ''}${it.external_sample_no ? `&${escapeHL7(it.external_sample_no)}` : ''}`, '', `${it.sample_snomed || ''}^${escapeHL7(it.sample_type || '')}^SCT`, '', '', '', '', '', '', '', '', '', '', '', '', hl7Ts(it.collected_at), hl7Ts(it.received_at)]);
    return buildHL7(segs);
  }

  private fhirReport(it: any, results: any[], addenda: any[], amendment: any, event: string, version: number, lab: any) {
    const sys = (k: string) => `urn:lis:${lab.facility}:${k}`;
    const obsStatus = event === 'FINAL' ? 'final' : 'corrected';
    const patientRef = `urn:uuid:patient-${it.mrn}`;
    const specimenRef = `urn:uuid:specimen-${it.sample_no}`;
    const observations = results.map((r) => {
      const numeric = r.numeric_value !== null && (r.result_type === 'NUMERIC' || r.result_type === 'CALCULATED') && !/^[<>]/.test(r.value || '');
      const interp = r.flag && r.flag !== 'N' ? { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: r.flag }] } : undefined;
      return {
        fullUrl: `urn:uuid:obs-${r.id}`,
        resource: {
          resourceType: 'Observation', status: obsStatus, category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
          code: { coding: [r.loinc_num ? { system: 'http://loinc.org', code: r.loinc_num, display: r.name } : { system: sys('parameter'), code: r.code, display: r.name }], text: r.name },
          subject: { reference: patientRef }, specimen: { reference: specimenRef }, issued: toIso(it.signed_at),
          ...(numeric ? { valueQuantity: { value: r.numeric_value, unit: r.unit, system: 'http://unitsofmeasure.org', code: r.ucum_code || r.unit } } : { valueString: r.value }),
          ...(interp ? { interpretation: [interp] } : {}),
          referenceRange: r.ref_text ? [{ ...(r.ref_low != null ? { low: { value: r.ref_low, unit: r.unit } } : {}), ...(r.ref_high != null ? { high: { value: r.ref_high, unit: r.unit } } : {}), text: r.ref_text }] : undefined,
          note: r.comment ? [{ text: r.comment }] : undefined,
        },
      };
    });
    const notes = [
      ...(amendment ? [{ text: `Amended (v${amendment.version}): ${amendment.reason || ''}` }] : []),
      ...addenda.map((a) => ({ text: `Addendum v${a.version}: ${a.addendum_text}`, time: toIso(a.signed_at) })),
    ];
    return {
      resourceType: 'Bundle', type: 'collection', timestamp: new Date().toISOString(),
      entry: [
        { fullUrl: patientRef, resource: { resourceType: 'Patient', identifier: [{ system: sys('mrn'), value: it.mrn }, ...(it.external_mrn ? [{ system: 'urn:client:mrn', value: it.external_mrn }] : [])], name: [{ family: it.last_name, given: [it.first_name] }], birthDate: it.dob, gender: ({ M: 'male', F: 'female', O: 'other' } as any)[it.gender] || 'unknown' } },
        { fullUrl: specimenRef, resource: { resourceType: 'Specimen', identifier: [{ system: sys('sample'), value: it.sample_no }, ...(it.external_sample_no ? [{ system: 'urn:client:sample', value: it.external_sample_no }] : [])], type: { coding: [{ system: 'http://snomed.info/sct', code: it.sample_snomed, display: it.sample_type }] }, collection: { collectedDateTime: toIso(it.collected_at) }, receivedTime: toIso(it.received_at) } },
        {
          fullUrl: `urn:uuid:report-${it.id}-v${version}`,
          resource: {
            resourceType: 'DiagnosticReport', status: event === 'FINAL' ? 'final' : event === 'ADDENDUM' ? 'appended' : 'corrected',
            identifier: [{ system: sys('report'), value: `${it.order_no}-${it.id}` }],
            basedOn: it.external_order_no ? [{ identifier: { system: 'urn:client:order', value: it.external_order_no } }] : undefined,
            category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB' }] }],
            code: { coding: [it.test_loinc ? { system: 'http://loinc.org', code: it.test_loinc, display: it.test_name } : { system: sys('test'), code: it.test_code, display: it.test_name }] },
            subject: { reference: patientRef }, issued: toIso(it.signed_at), specimen: [{ reference: specimenRef }],
            resultsInterpreter: it.signed_by_name ? [{ display: it.signed_by_name }] : undefined, conclusion: it.interpretation || undefined,
            result: observations.map((o) => ({ reference: o.fullUrl })),
            extension: notes.length ? [{ url: 'urn:lis:report-notes', valueString: notes.map((n) => n.text).join('\n') }] : undefined,
          },
        },
        ...observations,
      ],
    };
  }

  /* ─────────── Dispatcher (PUSH delivery with retries) ─────────── */
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const now = nowIso();
      const pubs = this.db.all(`SELECT p.*, i.transport, i.host, i.port, i.endpoint_url, i.auth_type, i.auth_secret, i.retry_max, i.active iface_active
        FROM result_publications p LEFT JOIN m_interfaces i ON i.id = p.interface_id WHERE p.mode = 'PUSH' AND p.status IN ('PENDING','RETRY') AND p.next_attempt_at <= ? LIMIT 25`, now);
      for (const p of pubs) await this.deliverPublication(p);
      const msgs = this.db.all(`SELECT m.*, i.transport itransport, i.host, i.port, i.delivery_mode FROM interface_messages m JOIN m_interfaces i ON i.id = m.interface_id
        WHERE m.direction = 'OUT' AND m.status = 'QUEUED' AND i.delivery_mode = 'PUSH' AND i.active = 1 AND i.host IS NOT NULL AND i.port IS NOT NULL LIMIT 25`);
      for (const m of msgs) await this.deliverQueued(m);
    } finally {
      this.busy = false;
    }
  }

  async deliverPublication(p: any) {
    const contentType = p.format === 'FHIR_R4' ? 'application/fhir+json' : p.format === 'JSON' ? 'application/json' : 'x-application/hl7-v2+er7';
    const attempt = (p.attempts || 0) + 1;
    try {
      if (!p.interface_id || !p.iface_active) throw new Error('No active interface configured for push delivery');
      let response = '';
      if (p.transport === 'TCP_MLLP') {
        if (!p.host || !p.port) throw new Error('Interface host/port not configured');
        response = await sendMLLP(p.host, p.port, p.payload);
        const ack = parseHL7(response).get('MSA');
        if (ack && ack[1] !== 'AA' && ack[1] !== 'CA') throw new Error(`Negative ACK ${ack[1]}: ${ack[3] || ''}`);
      } else {
        if (!p.endpoint_url) throw new Error('Interface endpoint URL not configured');
        response = await httpPost(p.endpoint_url, p.payload, contentType, p.auth_type, p.auth_secret);
      }
      const msgId = this.logMessage({ interface_id: p.interface_id, facility_id: p.facility_id, direction: 'OUT', protocol: p.format, message_type: `RESULT_${p.event}`, transport: p.transport, raw: p.payload, response, status: 'DELIVERED', ref_type: 'ORDER_ITEM', ref_id: p.order_item_id });
      this.db.update('result_publications', p.id, { status: 'DELIVERED', attempts: attempt, delivered_at: nowIso(), last_error: null, message_id: msgId });
    } catch (e: any) {
      const max = p.retry_max || 8;
      const failed = attempt >= max;
      const next = sqlTime(new Date(Date.now() + Math.min(60, 2 ** attempt) * 60000));
      this.db.update('result_publications', p.id, { status: failed ? 'FAILED' : 'RETRY', attempts: attempt, last_error: String(e.message).slice(0, 500), next_attempt_at: next });
      if (failed) this.logMessage({ interface_id: p.interface_id, facility_id: p.facility_id, direction: 'OUT', protocol: p.format, message_type: `RESULT_${p.event}`, transport: p.transport, raw: p.payload, status: 'FAILED', error: e.message, ref_type: 'ORDER_ITEM', ref_id: p.order_item_id });
    }
  }

  private async deliverQueued(m: any) {
    try {
      let response = '';
      if (m.itransport === 'TCP_MLLP') response = await sendMLLP(m.host, m.port, m.raw);
      else if (m.itransport === 'TCP_ASTM') await sendASTM(m.host, m.port, m.raw);
      else return;
      this.db.update('interface_messages', m.id, { status: 'SENT', response, processed_at: nowIso() });
      this.db.run("UPDATE instrument_orders SET status = 'SENT', sent_at = ? WHERE message_id = ? AND status = 'QUEUED'", nowIso(), m.id);
    } catch (e: any) {
      this.db.update('interface_messages', m.id, { error: String(e.message).slice(0, 500) });
    }
  }

  retryPublication(id: number) {
    this.db.run("UPDATE result_publications SET status = 'PENDING', next_attempt_at = datetime('now'), attempts = 0 WHERE id = ? AND mode = 'PUSH'", id);
    return this.db.get('SELECT * FROM result_publications WHERE id = ?', id);
  }
}

function toIso(s: string | null | undefined) {
  if (!s) return undefined;
  return new Date(s.replace(' ', 'T') + 'Z').toISOString();
}
