import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { In, Like } from 'typeorm';
import {
  Analyzer, AnalyzerParameterMapping, AnalyzerTestMapping, LabTest, Middleware, MiddlewareMessage, OrderTest, OT,
  Parameter, Patient, Result, Sample, SampleType, TestParameter,
} from '../entities';
import { authHeaders, postExternal } from '../common/http';
import { AuthUser } from '../common/auth';
import { LookupService } from './lookup.service';
import { ResultsService } from './results.service';
import { buildOrm, parseAstm, parseOru, ParsedResultMessage } from './hl7';

@Injectable()
export class AutomationService {
  constructor(private lookup: LookupService, private results: ResultsService) {}

  /**
   * Routes a sample's in-house tests to analyzers: test -> analyzer (by mapping priority) -> middleware.
   * One ORDER message is queued per analyzer. PUSH middlewares receive it by HTTP POST immediately;
   * PULL middlewares fetch it from /automation/middleware/orders.
   */
  async dispatchSample(sampleId: number, onlyOrderTestIds?: number[]) {
    const sample = await this.lookup.repo(Sample).findOneBy({ id: sampleId });
    if (!sample) throw new NotFoundException('Sample not found');
    let ots = await this.lookup.repo(OrderTest).findBy({ sampleId, status: OT.ACCESSIONED, isOutsourced: false });
    if (onlyOrderTestIds) ots = ots.filter((o) => onlyOrderTestIds.includes(o.id));
    if (!ots.length) return { routed: 0, manual: 0, messages: [] };

    const mappings = await this.lookup.repo(AnalyzerTestMapping).find({ where: { testId: In(ots.map((o) => o.testId)), active: true }, order: { priority: 'ASC' } });
    const analyzers = mappings.length ? await this.lookup.repo(Analyzer).findBy({ id: In(mappings.map((m) => m.analyzerId)), active: true }) : [];
    const mws = analyzers.length ? await this.lookup.repo(Middleware).findBy({ id: In(analyzers.map((a) => a.middlewareId).filter(Boolean)), active: true }) : [];
    const tests = await this.lookup.repo(LabTest).findBy({ id: In(ots.map((o) => o.testId)) });

    const groups = new Map<number, { analyzer: Analyzer; middleware: Middleware; items: { ot: OrderTest; test: LabTest; map: AnalyzerTestMapping }[] }>();
    let manual = 0;
    for (const ot of ots) {
      const map = mappings.find((m) => m.testId === ot.testId && analyzers.some((a) => a.id === m.analyzerId && mws.some((w) => w.id === a.middlewareId)));
      if (!map) { manual++; continue; }
      const analyzer = analyzers.find((a) => a.id === map.analyzerId);
      const middleware = mws.find((w) => w.id === analyzer.middlewareId);
      const g = groups.get(analyzer.id) || { analyzer, middleware, items: [] };
      g.items.push({ ot, test: tests.find((t) => t.id === ot.testId), map });
      groups.set(analyzer.id, g);
    }

    const patient = await this.lookup.repo(Patient).findOneBy({ id: sample.patientId });
    const sampleType = sample.sampleTypeId ? await this.lookup.repo(SampleType).findOneBy({ id: sample.sampleTypeId }) : null;
    const priority = (await this.lookup.enrich(ots)).some((o) => o.order?.priority === 'STAT') ? 'STAT' : 'ROUTINE';
    const messages: MiddlewareMessage[] = [];

    for (const g of groups.values()) {
      const tps = await this.lookup.repo(TestParameter).findBy({ testId: In(g.items.map((i) => i.test.id)), active: true });
      const pmaps = await this.lookup.repo(AnalyzerParameterMapping).findBy({ analyzerId: g.analyzer.id, parameterId: In([...tps.map((t) => t.parameterId), 0]), active: true });
      const msg = await this.lookup.repo(MiddlewareMessage).save({
        direction: 'OUTBOUND', middlewareId: g.middleware.id, analyzerId: g.analyzer.id, sampleId, sampleNo: sample.sampleNo,
        messageType: 'ORDER', format: g.middleware.messageFormat, payload: '', status: 'PENDING',
      });
      const payload = g.middleware.messageFormat === 'HL7'
        ? buildOrm({
          sendingApp: 'LIS', receivingApp: g.middleware.code, receivingFacility: g.analyzer.code, controlId: String(msg.id),
          patient, sampleNo: sample.sampleNo, priority, collectedAt: sample.collectedAt, sampleType: sampleType?.code,
          tests: g.items.map((i) => ({ code: i.map.analyzerTestCode, name: i.test.name })),
        })
        : JSON.stringify({
          messageType: 'ORDER', controlId: msg.id, analyzer: { code: g.analyzer.code, name: g.analyzer.name },
          sample: { sampleNo: sample.sampleNo, type: sampleType?.code, collectedAt: sample.collectedAt },
          priority, patient: { mrn: patient.mrn, firstName: patient.firstName, lastName: patient.lastName, dob: patient.dob, gender: patient.gender },
          tests: g.items.map((i) => ({ lisCode: i.test.code, analyzerTestCode: i.map.analyzerTestCode, name: i.test.name })),
          assays: pmaps.map((p) => p.analyzerCode),
        });
      await this.lookup.repo(MiddlewareMessage).update(msg.id, { payload });
      await this.lookup.repo(OrderTest).update({ id: In(g.items.map((i) => i.ot.id)) }, { analyzerId: g.analyzer.id, status: OT.IN_ANALYZER });
      const saved = g.middleware.orderMode === 'PUSH' && g.middleware.autoSendOnAccession && g.middleware.orderEndpointUrl
        ? await this.send(msg.id)
        : await this.lookup.repo(MiddlewareMessage).findOneBy({ id: msg.id });
      messages.push(saved);
    }
    await this.lookup.refreshSampleStatus(sampleId);
    return { routed: ots.length - manual, manual, messages };
  }

  async send(messageId: number) {
    const repo = this.lookup.repo(MiddlewareMessage);
    const msg = await repo.findOneBy({ id: messageId });
    if (!msg || msg.direction !== 'OUTBOUND') throw new NotFoundException('Outbound message not found');
    const mw = await this.lookup.repo(Middleware).findOneBy({ id: msg.middlewareId });
    if (!mw?.orderEndpointUrl) {
      await repo.update(msg.id, { status: 'PENDING', error: 'Middleware has no order endpoint URL (PULL mode or not configured)' });
      return repo.findOneBy({ id: msg.id });
    }
    const ct = msg.format === 'HL7' ? 'application/hl7-v2' : 'application/json';
    const res = await postExternal(mw.orderEndpointUrl, msg.payload, ct, authHeaders(mw.authType, mw.outboundAuthToken));
    await repo.update(msg.id, {
      attempts: msg.attempts + 1, status: res.ok ? 'SENT' : 'FAILED', response: `${res.status} ${res.body}`, error: res.ok ? null : res.body,
    });
    return repo.findOneBy({ id: msg.id });
  }

  async retry(messageId: number) {
    return this.send(messageId);
  }

  /** Re-runs a test on the analyzer (keeps previous results in history once new values arrive). */
  async rerun(orderTestId: number, user: AuthUser) {
    const ot = await this.lookup.repo(OrderTest).findOneBy({ id: orderTestId });
    if (!ot || ![OT.IN_ANALYZER, OT.RESULTED, OT.ACCESSIONED].includes(ot.status as any)) throw new BadRequestException('Only accessioned, in-analyzer or resulted tests can be re-run');
    await this.lookup.repo(OrderTest).update(ot.id, { status: OT.ACCESSIONED });
    await this.lookup.audit('order_test', ot.id, 'RERUN', null, user.id);
    const out = await this.dispatchSample(ot.sampleId, [ot.id]);
    if (!out.routed) await this.lookup.repo(OrderTest).update(ot.id, { status: ot.status });
    return out;
  }

  /** PULL mode: the middleware polls for queued orders with its API key. */
  async pullOrders(apiKey: string) {
    const mw = await this.middlewareByKey(apiKey);
    const msgs = await this.lookup.repo(MiddlewareMessage).find({ where: { middlewareId: mw.id, direction: 'OUTBOUND', status: In(['PENDING', 'FAILED']) }, order: { id: 'ASC' }, take: 100 });
    for (const m of msgs) await this.lookup.repo(MiddlewareMessage).update(m.id, { status: 'SENT', attempts: m.attempts + 1, response: 'Pulled by middleware' });
    return msgs.map((m) => ({ id: m.id, sampleNo: m.sampleNo, format: m.format, payload: m.format === 'JSON' ? JSON.parse(m.payload) : m.payload }));
  }

  private async middlewareByKey(apiKey: string) {
    const mw = apiKey ? await this.lookup.repo(Middleware).findOneBy({ inboundApiKey: apiKey, active: true }) : null;
    if (!mw) throw new UnauthorizedException('Invalid middleware API key (x-api-key)');
    return mw;
  }

  private parse(body: any): { format: string; parsed: ParsedResultMessage; raw: string } {
    if (typeof body === 'string') {
      const raw = body.trim();
      if (raw.startsWith('MSH')) return { format: 'HL7', parsed: parseOru(raw), raw };
      if (/^\d?H\|/.test(raw)) return { format: 'ASTM', parsed: parseAstm(raw), raw };
      try { body = JSON.parse(raw); } catch { throw new BadRequestException('Unrecognised message: send HL7 ORU, ASTM or JSON'); }
    }
    const raw = JSON.stringify(body);
    const one = (o: any) => ({ sampleNo: o.sampleNo, results: (o.results || []).map((r: any) => ({ code: r.code, value: r.value != null ? String(r.value) : '', unit: r.unit, flag: r.flag })) });
    const arr = Array.isArray(body) ? body : [body];
    const analyzerCode = arr[0]?.analyzerCode || null;
    const samples = arr.flatMap((o: any) => (o.samples ? o.samples.map(one) : [one(o)]));
    return { format: 'JSON', parsed: { analyzerCode, samples }, raw };
  }

  /**
   * Result ingestion from middleware / analyzer. Maps analyzer assay codes to LIS parameters
   * through AnalyzerParameterMapping (with unit conversion factor), writes results, and
   * auto-validates all-normal results when the analyzer is configured to.
   */
  async ingest(body: any, opts: { apiKey?: string; user?: AuthUser; analyzerCode?: string }) {
    const mw = opts.user ? null : await this.middlewareByKey(opts.apiKey);
    const { format, parsed, raw } = this.parse(body);
    const code = opts.analyzerCode || parsed.analyzerCode;
    const log = await this.lookup.repo(MiddlewareMessage).save({
      direction: 'INBOUND', middlewareId: mw?.id ?? null, messageType: 'RESULT', format, payload: raw, status: 'PENDING',
      sampleNo: parsed.samples.map((s) => s.sampleNo).join(',').slice(0, 250),
    });
    const summary = { messageId: log.id, analyzer: code, samples: [] as any[], errors: [] as string[] };
    try {
      const analyzer = code ? await this.lookup.repo(Analyzer).findOneBy({ code, active: true }) : null;
      if (!analyzer) throw new BadRequestException(`Unknown analyzer code "${code ?? ''}" (JSON analyzerCode, HL7 MSH-3 or ASTM H-5)`);
      if (mw && analyzer.middlewareId && analyzer.middlewareId !== mw.id) throw new BadRequestException(`Analyzer ${code} is not connected through middleware ${mw.code}`);
      await this.lookup.repo(MiddlewareMessage).update(log.id, { analyzerId: analyzer.id });
      const pmaps = await this.lookup.repo(AnalyzerParameterMapping).findBy({ analyzerId: analyzer.id, active: true });
      const params = pmaps.length ? await this.lookup.repo(Parameter).findBy({ id: In(pmaps.map((p) => p.parameterId)) }) : [];

      for (const s of parsed.samples) {
        const sample = await this.lookup.repo(Sample).findOneBy({ sampleNo: s.sampleNo });
        if (!sample) { summary.errors.push(`Unknown sample ${s.sampleNo}`); continue; }
        if (sample.status === 'REJECTED') { summary.errors.push(`Sample ${s.sampleNo} is rejected`); continue; }
        if (!log.sampleId) await this.lookup.repo(MiddlewareMessage).update(log.id, { sampleId: sample.id });
        const ots = (await this.lookup.repo(OrderTest).findBy({ sampleId: sample.id })).filter((o) => ![OT.CANCELLED, OT.SIGNED].includes(o.status as any));
        const entries = s.results.map((r) => {
          const map = pmaps.find((m) => m.analyzerCode === r.code);
          if (!map) return { parameterId: undefined, value: r.value, code: r.code };
          const p = params.find((x) => x.id === map.parameterId);
          let value = r.value;
          const n = parseFloat(value);
          if (!isNaN(n) && map.conversionFactor && map.conversionFactor !== 1 && /^-?[\d.]+$/.test(value.trim())) {
            value = (n * map.conversionFactor).toFixed(p?.decimals ?? 2);
          }
          return { parameterId: map.parameterId, value, code: r.code };
        });
        const out = await this.results.ingest(ots, entries, 'ANALYZER', analyzer.id, opts.user?.id ?? null);
        let autoValidated = 0;
        if (analyzer.autoValidateNormals) {
          for (const otId of out.touched) {
            const ot = await this.lookup.repo(OrderTest).findOneBy({ id: otId });
            const res = await this.lookup.repo(Result).findBy({ orderTestId: otId });
            if (ot.status === OT.RESULTED && res.every((r) => !r.isAbnormal)) {
              await this.results.validate([otId], null, 'Auto-validated: all results within reference range');
              autoValidated++;
            }
          }
        }
        summary.samples.push({ sampleNo: s.sampleNo, accepted: out.accepted, unmapped: out.unmapped, errors: out.errors, autoValidated });
        summary.errors.push(...out.errors);
      }
      const anyAccepted = summary.samples.some((s) => s.accepted > 0);
      const anyIssue = summary.errors.length || summary.samples.some((s) => s.unmapped.length);
      await this.lookup.repo(MiddlewareMessage).update(log.id, {
        status: !anyAccepted ? 'ERROR' : anyIssue ? 'PARTIAL' : 'PROCESSED',
        response: JSON.stringify(summary), error: anyIssue ? JSON.stringify({ errors: summary.errors, unmapped: summary.samples.flatMap((s) => s.unmapped) }) : null,
      });
      return summary;
    } catch (e: any) {
      await this.lookup.repo(MiddlewareMessage).update(log.id, { status: 'ERROR', error: e.message });
      throw e;
    }
  }

  async messages(q: { direction?: string; status?: string; middlewareId?: string; q?: string }) {
    const where: any = {};
    if (q.direction) where.direction = q.direction;
    if (q.status) where.status = q.status;
    if (q.middlewareId) where.middlewareId = Number(q.middlewareId);
    if (q.q) where.sampleNo = Like(`%${q.q}%`);
    const rows = await this.lookup.repo(MiddlewareMessage).find({ where, order: { id: 'DESC' }, take: 300 });
    const mws = await this.lookup.repo(Middleware).find();
    const ans = await this.lookup.repo(Analyzer).find();
    return rows.map((m) => ({ ...m, middlewareName: mws.find((x) => x.id === m.middlewareId)?.name, analyzerName: ans.find((x) => x.id === m.analyzerId)?.name }));
  }

  /** Configuration health view: for every active test, where does it go and how are its parameters mapped? */
  async routing() {
    const tests = await this.lookup.repo(LabTest).find({ where: { active: true }, order: { code: 'ASC' } });
    const tmaps = await this.lookup.repo(AnalyzerTestMapping).find({ where: { active: true } });
    const pmaps = await this.lookup.repo(AnalyzerParameterMapping).find({ where: { active: true } });
    const tps = await this.lookup.repo(TestParameter).find({ where: { active: true } });
    const analyzers = await this.lookup.repo(Analyzer).find();
    const mws = await this.lookup.repo(Middleware).find();
    return tests.map((t) => {
      const params = tps.filter((p) => p.testId === t.id);
      const routes = tmaps.filter((m) => m.testId === t.id).sort((a, b) => a.priority - b.priority).map((m) => {
        const a = analyzers.find((x) => x.id === m.analyzerId);
        const mw = mws.find((x) => x.id === a?.middlewareId);
        const mapped = params.filter((p) => pmaps.some((pm) => pm.analyzerId === m.analyzerId && pm.parameterId === p.parameterId)).length;
        return { analyzerTestCode: m.analyzerTestCode, priority: m.priority, analyzer: a?.name, analyzerActive: a?.active, middleware: mw?.name, middlewareActive: mw?.active, orderMode: mw?.orderMode, mappedParameters: mapped, totalParameters: params.length };
      });
      return { id: t.id, code: t.code, name: t.name, isOutsourced: t.isOutsourced, parameterCount: params.length, routes };
    });
  }
}
