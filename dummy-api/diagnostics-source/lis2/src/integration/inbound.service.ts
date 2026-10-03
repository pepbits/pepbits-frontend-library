import { Injectable, Logger } from '@nestjs/common';
import { Db, nowIso } from '../db/database.service';
import { Hl7Message, astmComp, buildASTM, buildAck, buildHL7, comp, fromHl7Ts, hl7Ts, mshSegment, parseASTM, parseHL7, reps } from './codecs';
import { OutboundService } from './outbound.service';
import { PatientsService, PatientInput } from '../patients/patients';
import { OrdersService, refreshOrderStatus } from '../orders/orders';
import { SamplesService } from '../samples/samples';
import { ResultsService, ResultEntry } from '../results/results.service';

export type InboundProtocol = 'HL7V2' | 'ASTM' | 'FHIR_R4' | 'JSON';
export interface InboundMeta { transport: string; remote?: string; apiKey?: string | null }
export interface InboundReply { body: string; contentType: string; httpStatus: number; messageId: number; ok: boolean }

interface Source { iface: any | null; facility: any | null }
interface OrderLine { codes: string[]; lineNo?: string | null; specimenId?: string | null; collectedAt?: string | null; bodySiteCode?: string | null }
interface NormalizedOrder {
  action: 'NEW' | 'CANCEL'; externalOrderNo: string; priority: string; clinicalInfo?: string | null; diagnosis?: string | null;
  patient: PatientInput & { externalId?: string | null };
  encounter: { externalEncounterNo?: string | null; type?: string | null; bed?: string | null };
  lines: OrderLine[];
}
interface Obs { codes: string[]; value: string | null; comment?: string | null; status?: string | null; units?: string | null }
interface NormalizedResult { sampleRefs: string[]; itemId?: number | null; instrument?: string | null; obs: Obs[] }

class InboundError extends Error {
  constructor(message: string, public readonly code: 'AE' | 'AR' = 'AE', public readonly httpStatus = 422) { super(message); }
}

const priorityOf = (v?: string | null) => {
  const s = String(v || '').toUpperCase();
  if (['S', 'STAT'].includes(s)) return 'STAT';
  if (['A', 'U', 'ASAP', 'URGENT'].includes(s)) return 'URGENT';
  return 'ROUTINE';
};
const genderOf = (v?: string | null) => {
  const s = String(v || '').toUpperCase();
  if (s.startsWith('M')) return 'M';
  if (s.startsWith('F')) return 'F';
  if (s.startsWith('O')) return 'O';
  return 'U';
};
const encTypeOf = (v?: string | null) => {
  const s = String(v || '').toUpperCase();
  if (['I', 'IMP', 'IP', 'INPATIENT'].includes(s)) return 'IP';
  if (['E', 'EMER', 'ER', 'EMERGENCY'].includes(s)) return 'ER';
  if (['O', 'AMB', 'OP', 'OUTPATIENT'].includes(s)) return 'OP';
  return 'EXTERNAL';
};
const firstSub = (v: string) => (v || '').split('&')[0].trim();

/**
 * Inbound integration engine. Every message is logged first (interface_messages), then processed:
 *  - orders from client hospitals / HIS (HL7 ORM/OML, FHIR ServiceRequest, JSON) → patient match-or-create, encounter, order, bill, sample match
 *  - results from analyzers, middleware and reference labs (HL7 ORU, ASTM R, FHIR Observation/DiagnosticReport, JSON)
 *  - host queries from analyzers (ASTM Q, HL7 QBP^Q11)
 *  - acknowledgements for messages we sent
 */
@Injectable()
export class InboundService {
  private readonly log = new Logger('Inbound');

  constructor(
    private readonly db: Db,
    private readonly outbound: OutboundService,
    private readonly patients: PatientsService,
    private readonly orders: OrdersService,
    private readonly samples: SamplesService,
    private readonly results: ResultsService,
  ) {}

  private lab() {
    return { app: this.db.setting('lab.hl7_app', 'LIS'), facility: this.db.setting('lab.hl7_facility', 'LAB') };
  }

  /* ─────────────── source identification ─────────────── */

  sourceFromKey(apiKey?: string | null): Source | null {
    if (!apiKey) return null;
    const facility = this.db.get('SELECT * FROM m_facilities WHERE api_key = ? AND active = 1', apiKey);
    if (facility) return { facility, iface: facility.interface_id ? this.db.get('SELECT * FROM m_interfaces WHERE id = ?', facility.interface_id) : null };
    const iface = this.db.get('SELECT * FROM m_interfaces WHERE auth_secret = ? AND active = 1', apiKey);
    if (iface) return { iface, facility: this.db.get('SELECT * FROM m_facilities WHERE interface_id = ? AND active = 1', iface.id) || null };
    return null;
  }

  private sourceFromHints(sendingApp?: string, sendingFacility?: string): Source | null {
    const iface = (sendingApp && this.db.get('SELECT * FROM m_interfaces WHERE active = 1 AND sending_app = ? ORDER BY CASE WHEN sending_facility = ? THEN 0 ELSE 1 END LIMIT 1', sendingApp, sendingFacility || ''))
      || (sendingFacility && this.db.get('SELECT * FROM m_interfaces WHERE active = 1 AND sending_facility = ? LIMIT 1', sendingFacility));
    if (iface) return { iface, facility: this.db.get('SELECT * FROM m_facilities WHERE interface_id = ? AND active = 1', iface.id) || null };
    const analyzer = sendingApp && this.db.get('SELECT * FROM m_analyzers WHERE active = 1 AND (instrument_id = ? OR code = ?)', sendingApp, sendingApp);
    if (analyzer) {
      const ai = this.outbound.interfaceForAnalyzer(analyzer);
      if (ai) return { iface: ai, facility: null };
    }
    return null;
  }

  /* ─────────────── entry point ─────────────── */

  handle(protocol: InboundProtocol, raw: string, meta: InboundMeta): InboundReply {
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    let source = this.sourceFromKey(meta.apiKey);
    if (meta.apiKey && !source) return this.reject(protocol, text, meta, 'Unknown API key', 401);
    if (!source && meta.transport === 'HTTPS') return this.reject(protocol, text, meta, 'x-api-key header is required', 401);
    const msgId = this.outbound.logMessage({
      interface_id: source?.iface?.id ?? null, facility_id: source?.facility?.id ?? null, direction: 'IN', protocol,
      transport: meta.transport, remote: meta.remote, raw: text, status: 'RECEIVED',
    });
    return this.process(msgId, source);
  }

  /** Re-runs a logged inbound message (used by the message monitor after fixing mappings). */
  reprocess(messageId: number): InboundReply {
    const m = this.db.get("SELECT * FROM interface_messages WHERE id = ? AND direction = 'IN'", messageId);
    if (!m) throw new InboundError('Inbound message not found', 'AR', 404);
    const iface = m.interface_id ? this.db.get('SELECT * FROM m_interfaces WHERE id = ?', m.interface_id) : null;
    const facility = m.facility_id ? this.db.get('SELECT * FROM m_facilities WHERE id = ?', m.facility_id) : null;
    return this.process(messageId, iface || facility ? { iface, facility } : null);
  }

  private reject(protocol: InboundProtocol, text: string, meta: InboundMeta, error: string, httpStatus: number): InboundReply {
    const id = this.outbound.logMessage({ direction: 'IN', protocol, transport: meta.transport, remote: meta.remote, raw: text.slice(0, 20000), status: 'REJECTED', error });
    return { ...this.errorBody(protocol, null, error, 'AR'), httpStatus, messageId: id, ok: false };
  }

  private process(msgId: number, source: Source | null): InboundReply {
    const m = this.db.get('SELECT * FROM interface_messages WHERE id = ?', msgId);
    const protocol = m.protocol as InboundProtocol;
    let hl7: Hl7Message | null = null;
    try {
      let out: { body: string; contentType: string; type: string; refType?: string; refId?: number | null; controlId?: string; summary: string };
      if (protocol === 'HL7V2') {
        hl7 = parseHL7(m.raw);
        const msh = hl7.get('MSH')!;
        source = source || this.sourceFromHints(comp(msh[3], 1), comp(msh[4], 1));
        out = this.processHL7(hl7, source);
      } else if (protocol === 'ASTM') {
        const recs = parseASTM(m.raw);
        const h = recs.find((r) => r[0] === 'H');
        source = source || this.sourceFromHints(astmComp(h?.[4], 1), astmComp(h?.[4], 2));
        out = this.processASTM(recs, source);
      } else if (protocol === 'FHIR_R4') {
        out = this.processFHIR(JSON.parse(m.raw), source);
      } else {
        out = this.processJSON(JSON.parse(m.raw), source);
      }
      this.db.update('interface_messages', msgId, {
        interface_id: source?.iface?.id ?? m.interface_id, facility_id: source?.facility?.id ?? m.facility_id, message_type: out.type, control_id: out.controlId,
        status: 'PROCESSED', error: null, response: out.body, ref_type: out.refType, ref_id: out.refId ?? null, processed_at: nowIso(),
      });
      return { body: out.body, contentType: out.contentType, httpStatus: 200, messageId: msgId, ok: true };
    } catch (e: any) {
      const err = e instanceof InboundError ? e : new InboundError(e?.message || String(e), 'AE', 400);
      if (!(e instanceof InboundError)) this.log.warn(`Message ${msgId} failed: ${err.message}`);
      const reply = this.errorBody(protocol, hl7, err.message, err.code);
      this.db.update('interface_messages', msgId, {
        interface_id: source?.iface?.id ?? m.interface_id, facility_id: source?.facility?.id ?? m.facility_id,
        message_type: hl7 ? `${hl7.type}^${hl7.event}` : m.message_type, control_id: hl7?.controlId, status: 'ERROR', error: err.message.slice(0, 1000), response: reply.body, processed_at: nowIso(),
      });
      return { ...reply, httpStatus: err.httpStatus, messageId: msgId, ok: false };
    }
  }

  private errorBody(protocol: InboundProtocol, hl7: Hl7Message | null, error: string, code: 'AE' | 'AR') {
    const lab = this.lab();
    if (protocol === 'HL7V2') return { body: buildAck(hl7, code, error, lab.app, lab.facility), contentType: 'x-application/hl7-v2+er7' };
    if (protocol === 'FHIR_R4') return { body: JSON.stringify({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: code === 'AR' ? 'security' : 'processing', diagnostics: error }] }), contentType: 'application/fhir+json' };
    if (protocol === 'ASTM') return { body: `NAK: ${error}`, contentType: 'text/plain' };
    return { body: JSON.stringify({ status: 'error', error }), contentType: 'application/json' };
  }

  private requireSource(source: Source | null, allowed: string[], what: string) {
    if (!source?.iface && !source?.facility) throw new InboundError('Sender could not be identified – configure the interface sending application/facility or use an API key', 'AR', 401);
    const cat = source.iface?.category || (source.facility ? 'EXTERNAL_FACILITY' : '');
    if (!allowed.includes(cat)) throw new InboundError(`${what} are not accepted from ${cat} interface ${source.iface?.code || ''}`, 'AR', 403);
    if (source.iface && source.iface.direction === 'OUTBOUND') throw new InboundError(`Interface ${source.iface.code} is configured outbound-only`, 'AR', 403);
    return cat;
  }

  /* ─────────────── HL7 v2 ─────────────── */

  private processHL7(msg: Hl7Message, source: Source | null) {
    const type = msg.type;
    const event = msg.event;
    const lab = this.lab();
    const ackOk = (text: string, refType?: string, refId?: number | null) => ({
      body: buildAck(msg, 'AA', text, lab.app, lab.facility), contentType: 'x-application/hl7-v2+er7', type: `${type}^${event}`, controlId: msg.controlId, refType, refId, summary: text,
    });

    if (type === 'ACK') {
      const msa = msg.get('MSA');
      const ref = msa?.[2];
      if (ref) this.db.run("UPDATE interface_messages SET status = CASE WHEN ? IN ('AA','CA') THEN 'ACKED' ELSE 'NACKED' END, response = ? WHERE direction = 'OUT' AND control_id = ?", msa?.[1], msg.segments.map((s) => s.join('|')).join('\r'), ref);
      return { body: '', contentType: 'text/plain', type: 'ACK', controlId: msg.controlId, summary: 'ack' };
    }

    if (type === 'ORM' || type === 'OML') {
      this.requireSource(source, ['EXTERNAL_FACILITY', 'HIS', 'HIE'], 'Orders');
      const orders = this.hl7Orders(msg);
      const outcomes = orders.map((o) => this.processOrder(o, source!, msg.controlId));
      const text = outcomes.map((o) => o.summary).join('; ');
      return ackOk(text, 'ORDER', outcomes[0]?.orderId);
    }

    if (type === 'ORU' || type === 'OUL') {
      const cat = this.requireSource(source, ['ANALYZER', 'MIDDLEWARE', 'REFERENCE_LAB'], 'Results');
      const results = this.hl7Results(msg);
      const res = this.applyAll(results, source!, cat);
      return ackOk(res.summary, 'SAMPLE', res.sampleId);
    }

    if (type === 'QBP' || type === 'QRY') {
      this.requireSource(source, ['ANALYZER', 'MIDDLEWARE'], 'Host queries');
      const qpd = msg.get('QPD');
      const specimen = firstSub(comp(qpd?.[3], 1)) || firstSub(comp(msg.get('QRD')?.[8], 1));
      return this.hl7QueryReply(msg, specimen, source!);
    }

    throw new InboundError(`Message type ${type}^${event} is not supported`, 'AR');
  }

  private hl7Patient(msg: Hl7Message) {
    const pid = msg.get('PID');
    if (!pid) throw new InboundError('PID segment is required');
    const ids = reps(pid[3]).map((r) => ({ id: firstSub(r.split('^')[0]), type: (r.split('^')[4] || '').toUpperCase() }));
    const mr = ids.find((i) => i.type === 'MR' || i.type === 'PI') || ids[0];
    const nat = ids.find((i) => ['NI', 'SS', 'NN', 'NNIND'].includes(i.type))?.id || pid[19] || null;
    const first = comp(pid[5], 2);
    const last = comp(pid[5], 1);
    if (!first && !last) throw new InboundError('Patient name (PID-5) is required');
    return {
      externalId: mr?.id || null, national_id: nat || undefined, first_name: first || last, last_name: first ? last : undefined,
      dob: fromHl7Ts(comp(pid[7], 1), true) || undefined, gender: genderOf(pid[8]), address: [comp(pid[11], 1), comp(pid[11], 3)].filter(Boolean).join(', ') || undefined,
      phone: comp(pid[13], 1) || undefined,
    };
  }

  private hl7Orders(msg: Hl7Message): NormalizedOrder[] {
    const patient = this.hl7Patient(msg);
    const pv1 = msg.get('PV1');
    const encounter = { externalEncounterNo: comp(pv1?.[19], 1) || null, type: encTypeOf(pv1?.[2]), bed: [comp(pv1?.[3], 1), comp(pv1?.[3], 3)].filter(Boolean).join('/') || null };
    const groups = new Map<string, NormalizedOrder>();
    let orc: string[] | null = null;
    let current: { order: NormalizedOrder; line: OrderLine } | null = null;
    const specimens: { spm: string[]; line: OrderLine | null }[] = [];
    for (const seg of msg.segments) {
      if (seg[0] === 'ORC') { orc = seg; continue; }
      if (seg[0] === 'OBR') {
        const control = (orc?.[1] || 'NW').toUpperCase();
        const lineNo = comp(seg[2], 1) || comp(orc?.[2], 1);
        const extOrder = comp(orc?.[4], 1) || comp(orc?.[2], 1) || lineNo;
        if (!extOrder) throw new InboundError('Placer order number (ORC-2/OBR-2) is required');
        const key = `${control === 'CA' || control === 'OC' || control === 'DC' ? 'CANCEL' : 'NEW'}|${extOrder}`;
        let order = groups.get(key);
        if (!order) {
          order = {
            action: key.startsWith('CANCEL') ? 'CANCEL' : 'NEW', externalOrderNo: extOrder,
            priority: priorityOf(seg[5] || comp(seg[27], 6) || comp(orc?.[7], 6) || comp(msg.get('TQ1')?.[9], 1)),
            clinicalInfo: seg[13] || null, diagnosis: comp(msg.get('DG1')?.[3], 2) || null, patient, encounter, lines: [],
          };
          groups.set(key, order);
        }
        const svc = seg[4] || '';
        const line: OrderLine = {
          codes: [comp(svc, 1), comp(svc, 4)].filter(Boolean), lineNo,
          specimenId: firstSub(comp(seg[18], 1)) || null, collectedAt: fromHl7Ts(comp(seg[7], 1)), bodySiteCode: comp(seg[15], 4) || null,
        };
        if (!line.codes.length) throw new InboundError(`OBR-4 test code missing on line ${lineNo}`);
        if (order.priority === 'ROUTINE' && seg[5]) order.priority = priorityOf(seg[5]);
        order.lines.push(line);
        current = { order, line };
        continue;
      }
      if (seg[0] === 'SPM') specimens.push({ spm: seg, line: current?.line ?? null });
    }
    // SPM either follows its OBR (ORM/OML^O21) or precedes the OBRs (OML^O33 specimen-centric)
    for (const { spm, line } of specimens) {
      const id = firstSub(comp(spm[2], 1));
      const at = fromHl7Ts(comp(spm[17], 1));
      const targets = line ? [line] : [...groups.values()].flatMap((g) => g.lines);
      for (const l of targets) { if (!l.specimenId) l.specimenId = id; if (!l.collectedAt) l.collectedAt = at; }
    }
    if (!groups.size) throw new InboundError('No OBR segments found');
    return [...groups.values()];
  }

  private hl7Results(msg: Hl7Message): NormalizedResult[] {
    const out: NormalizedResult[] = [];
    let cur: NormalizedResult | null = null;
    let lastObs: Obs | null = null;
    const msh3 = comp(msg.get('MSH')?.[3], 1);
    for (const seg of msg.segments) {
      if (seg[0] === 'OBR') {
        const placer = comp(seg[2], 1);
        const filler = comp(seg[3], 1);
        const itemMatch = /^[A-Z]+\d+-(\d+)$/.exec(placer);
        const item = itemMatch ? this.db.get('SELECT i.id FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.id = ? AND ? LIKE o.order_no || \'-%\'', Number(itemMatch[1]), placer) : null;
        cur = { sampleRefs: [filler, placer.replace(/-\d+$/, ''), placer, firstSub(comp(seg[18], 1))].filter(Boolean), itemId: item?.id ?? null, instrument: msh3, obs: [] };
        out.push(cur);
        lastObs = null;
      } else if (seg[0] === 'SPM') {
        const id = firstSub(comp(seg[2], 1));
        if (cur && id) cur.sampleRefs.unshift(id);
        else if (!cur && id) { cur = { sampleRefs: [id], instrument: msh3, obs: [] }; out.push(cur); }
      } else if (seg[0] === 'OBX') {
        if (!cur) { cur = { sampleRefs: [], instrument: msh3, obs: [] }; out.push(cur); }
        const vt = seg[2];
        let value: string | null = seg[5] ?? null;
        if (vt === 'SN') value = `${comp(seg[5], 1) === '=' ? '' : comp(seg[5], 1)}${comp(seg[5], 2)}`;
        else if (vt === 'CWE' || vt === 'CE') value = comp(seg[5], 2) || comp(seg[5], 1);
        else if (value !== null) value = comp(value, 1);
        const eq = comp(seg[18], 1);
        if (eq) cur.instrument = eq;
        lastObs = { codes: [comp(seg[3], 1), comp(seg[3], 4)].filter(Boolean), value, status: seg[11] || 'F', units: comp(seg[6], 1) };
        cur.obs.push(lastObs);
      } else if (seg[0] === 'NTE' && lastObs) {
        lastObs.comment = [lastObs.comment, comp(seg[3], 1)].filter(Boolean).join(' ');
      }
    }
    if (!out.some((r) => r.obs.length)) throw new InboundError('No OBX results in message');
    return out;
  }

  private hl7QueryReply(msg: Hl7Message, specimen: string, source: Source) {
    const lab = this.lab();
    const found = this.workOrderFor(specimen, source, 'HL7V2');
    const qpd = msg.get('QPD');
    const segs: any[][] = [
      mshSegment({ sendingApp: lab.app, sendingFacility: lab.facility, receivingApp: comp(msg.get('MSH')?.[3], 1), receivingFacility: comp(msg.get('MSH')?.[4], 1), type: 'RSP^K11^RSP_K11', controlId: `RSP${Date.now()}` }),
      ['MSA', 'AA', msg.controlId],
      ['QAK', qpd?.[2] || '', found ? 'OK' : 'NF'],
      qpd ? qpd.slice() : ['QPD', 'WOS', '', specimen],
    ];
    if (found) {
      const body = found.raw.split('\r').filter((l) => l && !l.startsWith('MSH')).map((l) => l.split('|'));
      segs.push(...body);
    }
    return { body: buildHL7(segs), contentType: 'x-application/hl7-v2+er7', type: `${msg.type}^${msg.event}`, controlId: msg.controlId, refType: 'SAMPLE', refId: found?.sampleId ?? null, summary: found ? 'order returned' : 'no pending order' };
  }

  /** Builds the work order an analyzer asked for (host query mode). */
  workOrderFor(specimen: string, source: Source, protocol: string) {
    if (!specimen) return null;
    const sample = this.db.get(`SELECT s.*, p.mrn, p.first_name, p.last_name, p.dob, p.gender FROM samples s JOIN patients p ON p.id = s.patient_id
      WHERE (s.sample_no = ? OR s.external_sample_no = ?) AND s.status = 'RECEIVED' ORDER BY s.id DESC LIMIT 1`, specimen, specimen);
    if (!sample) return null;
    const analyzers = this.analyzersFor(source, null);
    for (const a of analyzers) {
      const codes = this.db.all(`SELECT DISTINCT m.order_code FROM m_analyzer_mappings m JOIN order_items i ON i.test_id = m.test_id
        WHERE i.sample_id = ? AND m.analyzer_id = ? AND m.active = 1 AND i.status IN ('RECEIVED','IN_PROCESS') AND i.is_outsourced = 0`, sample.id, a.id).map((r) => r.order_code);
      if (!codes.length) continue;
      for (const it of this.db.all("SELECT i.id FROM order_items i JOIN m_analyzer_mappings m ON m.test_id = i.test_id AND m.analyzer_id = ? WHERE i.sample_id = ? AND i.status IN ('RECEIVED','IN_PROCESS') GROUP BY i.id", a.id, sample.id)) {
        this.db.run(`INSERT INTO instrument_orders(sample_id, analyzer_id, order_item_id, order_codes, status, sent_at) VALUES (?,?,?,?, 'SENT', ?)
          ON CONFLICT(analyzer_id, order_item_id) DO UPDATE SET status = CASE WHEN status = 'RESULTED' THEN status ELSE 'SENT' END, sent_at = excluded.sent_at`, sample.id, a.id, it.id, codes.join(','), nowIso());
      }
      const raw = this.outbound.buildWorkOrder({ ...source.iface, protocol }, a, sample, codes, 'NW');
      this.outbound.logMessage({ interface_id: source.iface?.id, direction: 'OUT', protocol, message_type: 'QUERY_RESPONSE', transport: source.iface?.transport, raw, status: 'SENT', ref_type: 'SAMPLE', ref_id: sample.id });
      return { raw, sampleId: sample.id as number };
    }
    return null;
  }

  /* ─────────────── ASTM E1394 ─────────────── */

  private processASTM(recs: string[][], source: Source | null) {
    if (!recs.length) throw new InboundError('Empty ASTM message');
    const h = recs.find((r) => r[0] === 'H');
    const instrument = astmComp(h?.[4], 1);
    const queries = recs.filter((r) => r[0] === 'Q');
    if (queries.length) {
      this.requireSource(source, ['ANALYZER', 'MIDDLEWARE'], 'Host queries');
      const replies: string[] = [];
      let sampleId: number | null = null;
      for (const q of queries) {
        const specimen = astmComp(q[2], 2) || astmComp(q[2], 1);
        const found = this.workOrderFor(specimen, source!, 'ASTM');
        if (found) { replies.push(found.raw); sampleId = found.sampleId; }
      }
      const lab = this.lab();
      const body = replies.length ? replies.join('') : buildASTM([['H', '\\^&', '', '', `${lab.app}^${lab.facility}`, '', '', '', '', instrument, '', 'P', '1394-97', hl7Ts()], ['L', 1, 'I']]);
      return { body, contentType: 'text/plain', type: 'ASTM-Q', refType: 'SAMPLE', refId: sampleId, summary: replies.length ? 'orders returned' : 'no information' };
    }
    const cat = this.requireSource(source, ['ANALYZER', 'MIDDLEWARE', 'REFERENCE_LAB'], 'Results');
    const out: NormalizedResult[] = [];
    let cur: NormalizedResult | null = null;
    let lastObs: Obs | null = null;
    for (const r of recs) {
      if (r[0] === 'O') {
        cur = { sampleRefs: [astmComp(r[2], 1), astmComp(r[3], 1)].filter(Boolean), instrument, obs: [] };
        out.push(cur);
      } else if (r[0] === 'R' && cur) {
        const id = r[2] || '';
        const parts = id.split('^');
        const code = parts[3] || parts.find(Boolean) || '';
        lastObs = { codes: [code].filter(Boolean), value: astmComp(r[3], 1) || r[3] || null, units: r[4], status: r[8] || 'F' };
        cur.obs.push(lastObs);
      } else if (r[0] === 'C' && lastObs) {
        lastObs.comment = [lastObs.comment, astmComp(r[3], 1) || r[3]].filter(Boolean).join(' ');
      }
    }
    if (!out.some((o) => o.obs.length)) throw new InboundError('No result records (R) in ASTM message');
    const res = this.applyAll(out, source!, cat);
    return { body: `ACK ${res.summary}`, contentType: 'text/plain', type: 'ASTM-R', refType: 'SAMPLE', refId: res.sampleId, summary: res.summary };
  }

  /* ─────────────── FHIR R4 ─────────────── */

  private processFHIR(json: any, source: Source | null) {
    const resources: any[] = json?.resourceType === 'Bundle' ? (json.entry || []).map((e: any) => ({ ...e.resource, __fullUrl: e.fullUrl })) : [json];
    const byRef = (ref?: string) => {
      if (!ref) return undefined;
      return resources.find((r) => r.__fullUrl === ref || `${r.resourceType}/${r.id}` === ref || (r.id && ref.endsWith(`/${r.id}`)));
    };
    const serviceRequests = resources.filter((r) => r.resourceType === 'ServiceRequest');
    const observations = resources.filter((r) => r.resourceType === 'Observation');
    const outcome = (text: string, refType?: string, refId?: number | null) => ({
      body: JSON.stringify({ resourceType: 'OperationOutcome', issue: [{ severity: 'information', code: 'informational', diagnostics: text }] }),
      contentType: 'application/fhir+json', type: serviceRequests.length ? 'FHIR-ServiceRequest' : 'FHIR-Observation', refType, refId, summary: text,
    });

    if (serviceRequests.length) {
      this.requireSource(source, ['EXTERNAL_FACILITY', 'HIS', 'HIE'], 'Orders');
      const first = serviceRequests[0];
      const pat = byRef(first.subject?.reference) || resources.find((r) => r.resourceType === 'Patient');
      if (!pat) throw new InboundError('Patient resource is required in the bundle');
      const ids: any[] = pat.identifier || [];
      const mr = ids.find((i) => (i.type?.coding || []).some((c: any) => ['MR', 'PI'].includes(c.code))) || ids.find((i) => !/national|ssn|nid/i.test(i.system || '')) || ids[0];
      const nat = ids.find((i) => /national|ssn|nid/i.test(i.system || '') || (i.type?.coding || []).some((c: any) => ['NI', 'SS', 'NNIND'].includes(c.code)));
      const name = pat.name?.[0] || {};
      const enc = byRef(first.encounter?.reference) || resources.find((r) => r.resourceType === 'Encounter');
      const patient = {
        externalId: mr?.value || null, national_id: nat?.value, first_name: name.given?.[0] || name.text || name.family, last_name: name.given?.[0] ? name.family : undefined,
        dob: pat.birthDate, gender: genderOf(pat.gender), phone: (pat.telecom || []).find((t: any) => t.system === 'phone')?.value,
      };
      if (!patient.first_name) throw new InboundError('Patient name is required');
      const groups = new Map<string, NormalizedOrder>();
      for (const sr of serviceRequests) {
        const cancel = ['revoked', 'entered-in-error'].includes(sr.status);
        const lineNo = sr.identifier?.[0]?.value || sr.id || null;
        const extOrder = sr.requisition?.value || lineNo;
        if (!extOrder) throw new InboundError('ServiceRequest.identifier or requisition is required');
        const key = `${cancel ? 'CANCEL' : 'NEW'}|${extOrder}`;
        let order = groups.get(key);
        if (!order) {
          order = {
            action: cancel ? 'CANCEL' : 'NEW', externalOrderNo: extOrder, priority: priorityOf(sr.priority), clinicalInfo: (sr.note || []).map((n: any) => n.text).join(' ') || null,
            diagnosis: sr.reasonCode?.[0]?.text || sr.reasonCode?.[0]?.coding?.[0]?.display || null, patient,
            encounter: { externalEncounterNo: enc?.identifier?.[0]?.value || null, type: encTypeOf(enc?.class?.code), bed: null }, lines: [],
          };
          groups.set(key, order);
        }
        const spRef = sr.specimen?.[0];
        const sp = byRef(spRef?.reference);
        order.lines.push({
          codes: (sr.code?.coding || []).map((c: any) => c.code).filter(Boolean), lineNo,
          specimenId: sp?.identifier?.[0]?.value || spRef?.identifier?.value || null, collectedAt: sp?.collection?.collectedDateTime ? sqlFromIso(sp.collection.collectedDateTime) : null,
          bodySiteCode: sr.bodySite?.[0]?.coding?.[0]?.code || sp?.collection?.bodySite?.coding?.[0]?.code || null,
        });
      }
      const outcomes = [...groups.values()].map((o) => this.processOrder(o, source!, json.id || ''));
      return outcome(outcomes.map((o) => o.summary).join('; '), 'ORDER', outcomes[0]?.orderId);
    }

    if (observations.length) {
      const cat = this.requireSource(source, ['ANALYZER', 'MIDDLEWARE', 'REFERENCE_LAB'], 'Results');
      const report = resources.find((r) => r.resourceType === 'DiagnosticReport');
      const basedOn = report?.basedOn?.[0]?.identifier?.value || '';
      const itemMatch = /^[A-Z]+\d+-(\d+)$/.exec(basedOn);
      const groups = new Map<string, NormalizedResult>();
      for (const o of observations) {
        if (['cancelled', 'entered-in-error'].includes(o.status)) continue;
        const sp = byRef(o.specimen?.reference) || (report ? byRef(report.specimen?.[0]?.reference) : undefined);
        const ref = sp?.identifier?.[0]?.value || o.specimen?.identifier?.value || report?.specimen?.[0]?.identifier?.value || '';
        const key = ref || basedOn;
        let g = groups.get(key);
        if (!g) { g = { sampleRefs: [ref].filter(Boolean), itemId: itemMatch ? Number(itemMatch[1]) : null, instrument: o.device?.display || null, obs: [] }; groups.set(key, g); }
        const value = o.valueQuantity ? String(o.valueQuantity.comparator ? o.valueQuantity.comparator + o.valueQuantity.value : o.valueQuantity.value)
          : o.valueString ?? o.valueCodeableConcept?.text ?? o.valueCodeableConcept?.coding?.[0]?.display ?? (o.valueBoolean !== undefined ? String(o.valueBoolean) : null);
        g.obs.push({ codes: (o.code?.coding || []).map((c: any) => c.code).filter(Boolean), value, comment: (o.note || []).map((n: any) => n.text).join(' ') || null, status: o.status });
      }
      const res = this.applyAll([...groups.values()], source!, cat);
      return outcome(res.summary, 'SAMPLE', res.sampleId);
    }
    throw new InboundError('Bundle contains no ServiceRequest or Observation resources');
  }

  /* ─────────────── Custom JSON ─────────────── */

  private processJSON(json: any, source: Source | null) {
    const reply = (obj: any, type: string, refType?: string, refId?: number | null) => ({
      body: JSON.stringify({ status: 'accepted', ...obj }), contentType: 'application/json', type, refType, refId, summary: obj.message || type,
    });
    const kind = String(json?.type || (json?.tests ? 'ORDER' : json?.results ? 'RESULT' : '')).toUpperCase();
    if (kind === 'ORDER') {
      this.requireSource(source, ['EXTERNAL_FACILITY', 'HIS', 'HIE'], 'Orders');
      const p = json.patient || {};
      if (!json.orderNo) throw new InboundError('orderNo is required');
      if (!Array.isArray(json.tests) || !json.tests.length) throw new InboundError('tests[] is required');
      const o: NormalizedOrder = {
        action: String(json.action || 'NEW').toUpperCase() === 'CANCEL' ? 'CANCEL' : 'NEW', externalOrderNo: String(json.orderNo), priority: priorityOf(json.priority),
        clinicalInfo: json.clinicalInfo || null, diagnosis: json.diagnosis || null,
        patient: { externalId: p.id || p.mrn || null, national_id: p.nationalId, first_name: p.firstName, last_name: p.lastName, dob: p.dob, gender: genderOf(p.gender), phone: p.phone, email: p.email, address: p.address },
        encounter: { externalEncounterNo: json.encounter?.id || json.encounterNo || null, type: encTypeOf(json.encounter?.type), bed: json.encounter?.bed || null },
        lines: json.tests.map((t: any) => (typeof t === 'string' ? { codes: [t] } : { codes: [t.code, t.loinc].filter(Boolean), lineNo: t.lineNo || null, specimenId: t.specimenId || json.specimenId || null, collectedAt: t.collectedAt || json.collectedAt || null, bodySiteCode: t.bodySite || null })),
      };
      if (!o.patient.first_name) throw new InboundError('patient.firstName is required');
      const r = this.processOrder(o, source!, '');
      return reply({ message: r.summary, orderNo: r.orderNo, mrn: r.mrn, patientMatch: r.matched, items: r.items }, 'JSON-ORDER', 'ORDER', r.orderId);
    }
    if (kind === 'RESULT') {
      const cat = this.requireSource(source, ['ANALYZER', 'MIDDLEWARE', 'REFERENCE_LAB'], 'Results');
      if (!Array.isArray(json.results) || !json.results.length) throw new InboundError('results[] is required');
      const res = this.applyAll([{ sampleRefs: [json.sampleNo, json.specimenId].filter(Boolean), itemId: null, instrument: json.instrument || null,
        obs: json.results.map((r: any) => ({ codes: [r.code, r.loinc].filter(Boolean), value: r.value === undefined || r.value === null ? null : String(r.value), comment: r.comment || null, status: r.status || 'F' })) }], source!, cat);
      return reply({ message: res.summary, saved: res.saved, unmatched: res.unmatched }, 'JSON-RESULT', 'SAMPLE', res.sampleId);
    }
    throw new InboundError('type must be ORDER or RESULT');
  }

  /* ─────────────── order core ─────────────── */

  private resolveTest(code: string, facilityId: number | null) {
    if (facilityId) {
      const m = this.db.get('SELECT t.* FROM m_test_code_mappings m JOIN m_tests t ON t.id = m.test_id WHERE m.facility_id = ? AND m.external_code = ? AND t.active = 1', facilityId, code);
      if (m) return m;
    }
    return this.db.get('SELECT * FROM m_tests WHERE code = ? AND active = 1', code)
      || this.db.get('SELECT t.* FROM m_tests t JOIN m_loinc l ON l.id = t.loinc_id WHERE l.loinc_num = ? AND t.active = 1', code);
  }

  processOrder(o: NormalizedOrder, source: Source, controlId: string) {
    const facilityId: number | null = source.facility?.id ?? null;
    const sourceTag = source.facility ? 'EXTERNAL' : source.iface?.category || 'INTERFACE';
    const resolved = o.lines.map((l) => {
      const test = l.codes.map((c) => this.resolveTest(c, facilityId)).find(Boolean);
      return { line: l, test };
    });
    const unknown = resolved.filter((r) => !r.test).map((r) => r.line.codes[0]);
    if (unknown.length) throw new InboundError(`Unknown test code(s): ${unknown.join(', ')} – add them under External test codes`);

    return this.db.tx(() => {
      const existing = this.db.get("SELECT * FROM orders WHERE facility_id IS ? AND external_order_no = ? ORDER BY id DESC LIMIT 1", facilityId, o.externalOrderNo);
      if (o.action === 'CANCEL') {
        if (!existing) throw new InboundError(`Order ${o.externalOrderNo} not found for cancellation`);
        const cancelled: string[] = [];
        const refused: string[] = [];
        for (const r of resolved) {
          const it = this.db.get("SELECT i.*, t.code FROM order_items i JOIN m_tests t ON t.id = i.test_id WHERE i.order_id = ? AND (i.external_line_no = ? OR i.test_id = ?) AND i.status <> 'CANCELLED' LIMIT 1",
            existing.id, r.line.lineNo || '', r.test.id);
          if (!it) continue;
          try { this.orders.cancelItem(it.id, `Cancelled by ${source.facility?.code || source.iface?.code} (${controlId})`, null); cancelled.push(it.code); }
          catch (e: any) { refused.push(`${it.code}: ${e.message}`); }
        }
        if (refused.length && !cancelled.length) throw new InboundError(`Cancellation refused – ${refused.join('; ')}`);
        return { orderId: existing.id, orderNo: existing.order_no, mrn: '', matched: 'EXISTING', items: [], summary: `Order ${existing.order_no}: cancelled ${cancelled.join(', ') || 'nothing'}${refused.length ? `; refused ${refused.join('; ')}` : ''}` };
      }

      const pm = this.patients.matchOrCreate(facilityId, o.patient.externalId || null, o.patient);
      let orderId: number;
      let newLines = resolved;
      if (existing) {
        if (existing.patient_id !== pm.id) throw new InboundError(`Order ${o.externalOrderNo} already exists for a different patient`);
        const have = this.db.all("SELECT test_id, external_line_no FROM order_items WHERE order_id = ? AND status <> 'CANCELLED'", existing.id);
        newLines = resolved.filter((r) => !have.some((h) => h.test_id === r.test.id || (r.line.lineNo && h.external_line_no === r.line.lineNo)));
        orderId = existing.id;
        if (newLines.length) {
          this.orders.addItems(orderId, newLines.map((r) => ({ testId: r.test.id, externalLineNo: r.line.lineNo || undefined, bodySiteId: this.bodySite(r.line.bodySiteCode) })), existing.priority, true);
          this.orders.bill(orderId, null);
          refreshOrderStatus(this.db, orderId);
        }
      } else {
        orderId = this.orders.create({
          patientId: pm.id, priority: o.priority, clinicalInfo: o.clinicalInfo || undefined, diagnosis: o.diagnosis || undefined,
          encounter: { type: o.encounter.type || undefined, externalEncounterNo: o.encounter.externalEncounterNo || undefined, bed: o.encounter.bed || undefined },
          tests: resolved.map((r) => ({ testId: r.test.id, externalLineNo: r.line.lineNo || undefined, bodySiteId: this.bodySite(r.line.bodySiteCode) })),
        }, null, { source: sourceTag, facilityId, externalOrderNo: o.externalOrderNo, skipBodySiteCheck: true });
      }
      const order = this.db.get('SELECT o.*, p.mrn FROM orders o JOIN patients p ON p.id = o.patient_id WHERE o.id = ?', orderId);

      // Specimen matching: client barcode → existing sample, else register the specimen as collected (in transit).
      const attached: string[] = [];
      for (const r of newLines) {
        if (!r.line.specimenId) continue;
        const item = this.db.get("SELECT * FROM order_items WHERE order_id = ? AND test_id = ? AND status = 'BILLED'", orderId, r.test.id);
        if (!item) continue;
        let sample = this.db.get(`SELECT * FROM samples WHERE (sample_no = ? OR (external_sample_no = ? AND facility_id IS ?)) AND patient_id = ? AND sample_type_id = ?
          AND status IN ('COLLECTED','RECEIVED') ORDER BY id DESC LIMIT 1`, r.line.specimenId, r.line.specimenId, facilityId, pm.id, r.test.sample_type_id);
        if (!sample) {
          const st = this.db.get('SELECT container_id FROM m_sample_types WHERE id = ?', r.test.sample_type_id);
          const sid = this.db.insert('samples', {
            sample_no: this.db.nextNo('S', 7), patient_id: pm.id, sample_type_id: r.test.sample_type_id, container_id: r.test.container_id || st?.container_id,
            body_site_id: item.body_site_id, external_sample_no: r.line.specimenId, facility_id: facilityId, status: 'COLLECTED', priority: order.priority,
            collected_at: r.line.collectedAt || nowIso(),
          });
          this.samples.event(sid, 'REGISTERED_FROM_INTERFACE', { externalSampleNo: r.line.specimenId, source: source.facility?.code || source.iface?.code }, null);
          sample = this.db.get('SELECT * FROM samples WHERE id = ?', sid);
        }
        this.samples.collect({ itemIds: [item.id], attachToSampleId: sample.id }, null);
        attached.push(`${r.test.code}→${sample.sample_no}${sample.external_sample_no ? `(${sample.external_sample_no})` : ''}`);
      }
      this.db.audit(null, existing ? 'ORDER_UPDATE_INBOUND' : 'ORDER_INBOUND', 'orders', orderId, { external: o.externalOrderNo, patientMatch: pm.matched });
      const items = this.db.all(`SELECT i.id, t.code test, i.status, i.external_line_no lineNo, s.sample_no sampleNo, s.external_sample_no externalSampleNo
        FROM order_items i JOIN m_tests t ON t.id = i.test_id LEFT JOIN samples s ON s.id = i.sample_id WHERE i.order_id = ?`, orderId);
      const summary = existing && !newLines.length
        ? `Duplicate order ${o.externalOrderNo} – already registered as ${order.order_no}`
        : `Order ${order.order_no} for MRN ${order.mrn} (patient ${pm.matched.toLowerCase().replace('_', ' ')})${attached.length ? `; specimens ${attached.join(', ')}` : ''}`;
      return { orderId, orderNo: order.order_no, mrn: order.mrn, matched: pm.matched, items, summary };
    });
  }

  private bodySite(code?: string | null) {
    if (!code) return undefined;
    return this.db.get('SELECT id FROM m_body_sites WHERE code = ? OR snomed_code = ?', code, code)?.id;
  }

  /* ─────────────── result core ─────────────── */

  private analyzersFor(source: Source, instrument: string | null): any[] {
    if (!source.iface) return [];
    const all = this.db.all(`SELECT a.* FROM m_analyzers a LEFT JOIN m_middleware m ON m.id = a.middleware_id
      WHERE a.active = 1 AND (a.interface_id = ? OR m.interface_id = ?)`, source.iface.id, source.iface.id);
    if (instrument) {
      const hit = all.filter((a) => a.instrument_id === instrument || a.code === instrument);
      if (hit.length) return hit;
    }
    return all;
  }

  private applyAll(list: NormalizedResult[], source: Source, category: string) {
    const saved: { sampleNo: string; test: string; parameters: number }[] = [];
    const unmatched: string[] = [];
    const warnings: string[] = [];
    let sampleId: number | null = null;
    for (const r of list) {
      if (!r.obs.length) continue;
      const out = this.applyResults(r, source, category);
      saved.push(...out.saved);
      unmatched.push(...out.unmatched);
      warnings.push(...out.warnings);
      sampleId = sampleId ?? out.sampleId;
    }
    if (!saved.length) throw new InboundError([...warnings, unmatched.length ? `Unmapped result codes: ${[...new Set(unmatched)].join(', ')}` : ''].filter(Boolean).join('; ') || 'No results could be applied');
    const summary = `Saved ${saved.map((s) => `${s.test}(${s.parameters})`).join(', ')} on ${[...new Set(saved.map((s) => s.sampleNo))].join(', ')}`
      + (unmatched.length ? `; unmapped: ${[...new Set(unmatched)].join(', ')}` : '') + (warnings.length ? `; ${warnings.join('; ')}` : '');
    return { saved, unmatched, sampleId, summary };
  }

  private applyResults(r: NormalizedResult, source: Source, category: string) {
    const warnings: string[] = [];
    let items: any[] = [];
    let sample: any = null;
    if (r.itemId) {
      items = this.db.all('SELECT i.*, s.sample_no FROM order_items i LEFT JOIN samples s ON s.id = i.sample_id WHERE i.id = ?', r.itemId);
      sample = items[0] ? { id: items[0].sample_id, sample_no: items[0].sample_no } : null;
    }
    if (!items.length) {
      for (const ref of r.sampleRefs) {
        sample = this.db.get("SELECT * FROM samples WHERE (sample_no = ? OR external_sample_no = ?) AND status <> 'REJECTED' ORDER BY id DESC LIMIT 1", ref, ref);
        if (sample) break;
      }
      if (!sample) return { saved: [], unmatched: [], warnings: [`Sample ${r.sampleRefs[0] || '(none)'} not found`], sampleId: null };
      if (sample.status !== 'RECEIVED') return { saved: [], unmatched: [], warnings: [`Sample ${sample.sample_no} has not been received in the lab`], sampleId: sample.id };
      items = this.db.all("SELECT i.*, ? sample_no FROM order_items i WHERE i.sample_id = ? AND i.status <> 'CANCELLED'", sample.sample_no, sample.id);
    }
    const itemIds = items.map((i) => i.id);
    const inList = itemIds.map(() => '?').join(',');
    const analyzers = category === 'REFERENCE_LAB' ? [] : this.analyzersFor(source, r.instrument || null);
    const anIds = analyzers.map((a) => a.id);
    const perItem = new Map<number, { entries: ResultEntry[]; analyzerId: number | null }>();
    const unmatched: string[] = [];

    for (const o of r.obs) {
      if (['X', 'D', 'W'].includes(String(o.status || '').toUpperCase())) continue;
      // Every pending item on the sample that carries the mapped test receives the value (covers duplicate orders on one tube).
      let hits: { item_id: number; parameter_id: number; conversion_factor: number; analyzer_id: number | null }[] = [];
      if (anIds.length) {
        hits = this.db.all(`SELECT i.id item_id, m.parameter_id, m.conversion_factor, m.analyzer_id FROM m_analyzer_mappings m JOIN order_items i ON i.test_id = m.test_id
          WHERE i.id IN (${inList}) AND m.analyzer_id IN (${anIds.map(() => '?').join(',')}) AND m.active = 1 AND m.result_code IN (${o.codes.map(() => '?').join(',')})
          ORDER BY m.priority`, ...itemIds, ...anIds, ...o.codes);
      }
      if (!hits.length) {
        hits = this.db.all(`SELECT i.id item_id, tp.parameter_id, 1 conversion_factor, NULL analyzer_id FROM order_items i JOIN m_test_parameters tp ON tp.test_id = i.test_id
          JOIN m_parameters p ON p.id = tp.parameter_id LEFT JOIN m_loinc l ON l.id = p.loinc_id
          WHERE i.id IN (${inList}) AND (p.code IN (${o.codes.map(() => '?').join(',')}) OR l.loinc_num IN (${o.codes.map(() => '?').join(',')}))`, ...itemIds, ...o.codes, ...o.codes);
      }
      if (!hits.length) { unmatched.push(o.codes[0] || '?'); continue; }
      const seen = new Set<number>();
      for (const hit of hits) {
        if (seen.has(hit.item_id)) continue;
        seen.add(hit.item_id);
        let value = o.value;
        const factor = Number(hit.conversion_factor) || 1;
        if (value !== null && factor !== 1) {
          const m = /^([<>]=?)?\s*(-?\d+(?:\.\d+)?)$/.exec(value.trim());
          if (m) value = `${m[1] || ''}${+(Number(m[2]) * factor).toPrecision(10)}`;
        }
        const bucket = perItem.get(hit.item_id) || { entries: [], analyzerId: hit.analyzer_id };
        // Last value for a parameter wins if a message repeats it.
        bucket.entries = bucket.entries.filter((e) => e.parameterId !== hit.parameter_id);
        bucket.entries.push({ parameterId: hit.parameter_id, value, rawValue: o.value, comment: o.comment || undefined });
        perItem.set(hit.item_id, bucket);
      }
    }

    const saved: { sampleNo: string; test: string; parameters: number }[] = [];
    const srcType = category === 'REFERENCE_LAB' ? 'OUTSOURCE' : 'INSTRUMENT';
    for (const [itemId, b] of perItem) {
      const it = items.find((i) => i.id === itemId);
      const test = this.db.get('SELECT code FROM m_tests WHERE id = ?', it.test_id).code;
      if (it.status === 'SIGNED') { warnings.push(`${test} is signed – open an amendment to accept new results`); continue; }
      try {
        this.results.save(itemId, b.entries, srcType, null, { analyzerId: b.analyzerId, reason: `${srcType} result via ${source.iface?.code || 'interface'}` });
        if (b.analyzerId) this.db.run("UPDATE instrument_orders SET status = 'RESULTED', resulted_at = ? WHERE order_item_id = ? AND analyzer_id = ?", nowIso(), itemId, b.analyzerId);
        saved.push({ sampleNo: it.sample_no || '', test, parameters: b.entries.length });
      } catch (e: any) {
        warnings.push(`${test}: ${e.message}`);
      }
    }
    if (sample?.id && saved.length) this.samples.event(sample.id, 'RESULTS_RECEIVED', { from: source.iface?.code, tests: saved.map((s) => s.test) }, null);
    return { saved, unmatched, warnings, sampleId: sample?.id ?? null };
  }
}

function sqlFromIso(s: string) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().replace('T', ' ').slice(0, 19);
}
