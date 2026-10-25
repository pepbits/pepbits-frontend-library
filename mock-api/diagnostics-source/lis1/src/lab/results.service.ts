import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import {
  Amendment, CriticalAlert, LabOrder, LabTest, Methodology, OrderTest, OT, Parameter, Patient, Result,
  ResultHistory, TestParameter, Unit,
} from '../entities';
import { AuthUser } from '../common/auth';
import { LookupService, patientName } from './lookup.service';
import { rangeText, ReferenceService } from './reference.service';
import { ReportsService } from './reports.service';

export interface ResultEntry { parameterId: number; value: string; comment?: string }

const ENTERABLE = [OT.ACCESSIONED, OT.IN_ANALYZER, OT.OUTSOURCED, OT.RESULTED, OT.VALIDATED, OT.AMENDING] as string[];

@Injectable()
export class ResultsService {
  constructor(private lookup: LookupService, private ref: ReferenceService, private reports: ReportsService) {}

  async worklist(q: { status?: string; departmentId?: string; q?: string; priority?: string; analyzerId?: string }) {
    const statuses = (q.status || 'ACCESSIONED,IN_ANALYZER,OUTSOURCED,RESULTED,AMENDING').split(',');
    const where: any = { status: In(statuses) };
    if (q.analyzerId) where.analyzerId = Number(q.analyzerId);
    const ots = await this.lookup.repo(OrderTest).find({ where, order: { dueAt: 'ASC' }, take: 1000 });
    let rows = await this.lookup.enrich(ots);
    if (q.departmentId) rows = rows.filter((r) => String(r.test?.departmentId) === q.departmentId);
    if (q.priority) rows = rows.filter((r) => r.order?.priority === q.priority);
    if (q.q) {
      const t = q.q.toLowerCase();
      rows = rows.filter((r) => [r.sample?.sampleNo, r.order?.orderNo, r.patient?.mrn, r.patient?.fullName, r.test?.name, r.test?.code]
        .some((v) => v?.toLowerCase().includes(t)));
    }
    const results = rows.length ? await this.lookup.repo(Result).findBy({ orderTestId: In(rows.map((r) => r.id)) }) : [];
    return rows.map((r) => {
      const mine = results.filter((x) => x.orderTestId === r.id && x.value);
      return {
        ...r,
        resultCount: mine.length,
        abnormalCount: mine.filter((x) => x.isAbnormal).length,
        criticalCount: mine.filter((x) => x.isCritical).length,
        preview: mine.slice(0, 4).map((x) => ({ parameterId: x.parameterId, value: x.value, flag: x.flag })),
      };
    }).sort((a, b) => Number(b.order?.priority === 'STAT') - Number(a.order?.priority === 'STAT'));
  }

  /** Everything the result-entry screen needs for one order-test. */
  async detail(orderTestId: number) {
    const ot = await this.lookup.repo(OrderTest).findOneBy({ id: orderTestId });
    if (!ot) throw new NotFoundException('Order test not found');
    const [enriched] = await this.lookup.enrich([ot]);
    const tps = await this.lookup.repo(TestParameter).find({ where: { testId: ot.testId, active: true }, order: { sequence: 'ASC' } });
    const params = tps.length ? await this.lookup.repo(Parameter).findBy({ id: In(tps.map((t) => t.parameterId)) }) : [];
    const units = await this.lookup.repo(Unit).find();
    const methods = await this.lookup.repo(Methodology).find();
    const results = await this.lookup.repo(Result).findBy({ orderTestId });
    const history = await this.lookup.repo(ResultHistory).find({ where: { orderTestId }, order: { id: 'DESC' } });
    const amendments = await this.lookup.repo(Amendment).find({ where: { orderTestId }, order: { id: 'DESC' } });
    const patient = await this.lookup.repo(Patient).findOneBy({ id: enriched.order.patientId });
    const users = await this.lookup.userNames([...results.map((r) => r.enteredBy), ...history.map((h) => h.changedBy)]);

    const rows = [];
    for (const tp of tps) {
      const p = params.find((x) => x.id === tp.parameterId);
      if (!p) continue;
      const range = await this.ref.findRange(p.id, patient, enriched.test?.sampleTypeId, enriched.order.createdAt);
      const r = results.find((x) => x.parameterId === p.id);
      rows.push({
        testParameter: tp,
        parameter: { ...p, unit: units.find((u) => u.id === p.unitId)?.symbol, method: methods.find((m) => m.id === p.methodologyId)?.name },
        range: range ? { ...range, text: rangeText(range) } : null,
        result: r ? { ...r, enteredByName: users.get(r.enteredBy)?.fullName } : null,
      });
    }
    return {
      ...enriched,
      parameters: rows,
      history: history.map((h) => ({ ...h, changedByName: users.get(h.changedBy)?.fullName, parameterName: params.find((p) => p.id === h.parameterId)?.name })),
      amendments,
      openAmendment: amendments.find((a) => a.status === 'OPEN') || null,
      editable: ENTERABLE.includes(ot.status),
    };
  }

  /**
   * Core result writer used by manual entry, analyzer ingestion and reference-lab ingestion.
   * Evaluates each value against the patient's reference range, raises critical alerts,
   * keeps an audit trail of changes and computes calculated parameters.
   */
  async saveResults(orderTestId: number, entries: ResultEntry[], source: string, userId: number | null, analyzerId: number | null = null) {
    const repo = this.lookup.repo(OrderTest);
    const ot = await repo.findOneBy({ id: orderTestId });
    if (!ot) throw new NotFoundException('Order test not found');
    if (ot.status === OT.SIGNED) throw new BadRequestException('This test is signed. Start an amendment to change results.');
    if (!ENTERABLE.includes(ot.status)) throw new BadRequestException(`Results cannot be entered while the test is ${ot.status.toLowerCase()} (sample must be accessioned)`);

    const order = await this.lookup.repo(LabOrder).findOneBy({ id: ot.orderId });
    const patient = await this.lookup.repo(Patient).findOneBy({ id: order.patientId });
    const test = await this.lookup.repo(LabTest).findOneBy({ id: ot.testId });
    const tps = await this.lookup.repo(TestParameter).findBy({ testId: ot.testId, active: true });
    const params = tps.length ? await this.lookup.repo(Parameter).findBy({ id: In(tps.map((t) => t.parameterId)) }) : [];
    const units = await this.lookup.repo(Unit).find();
    const amendment = await this.lookup.repo(Amendment).findOneBy({ orderTestId, status: 'OPEN' });
    const resultRepo = this.lookup.repo(Result);
    let changed = 0;

    const write = async (p: Parameter, value: string, comment: string | undefined, src: string) => {
      const range = await this.ref.findRange(p.id, patient, test.sampleTypeId, order.createdAt);
      const ev = this.ref.evaluate(p, value, range);
      const existing = await resultRepo.findOneBy({ orderTestId, parameterId: p.id });
      const unit = units.find((u) => u.id === p.unitId)?.symbol || null;
      const data = {
        value: ev.value || null, rawValue: value, unit, flag: ev.flag, isAbnormal: ev.isAbnormal, isCritical: ev.isCritical,
        referenceRangeId: ev.referenceRangeId, referenceText: ev.referenceText, source: src,
        analyzerId: src === 'ANALYZER' ? analyzerId : null, enteredBy: userId, enteredAt: new Date(),
        comment: comment !== undefined ? comment : existing?.comment,
      };
      let saved: Result;
      const valueChanged = !existing || (existing.value || '') !== (data.value || '');
      if (existing) {
        if (!valueChanged && (existing.comment || '') === (data.comment || '')) return;
        if (existing.value && valueChanged) {
          await this.lookup.repo(ResultHistory).save({
            resultId: existing.id, orderTestId, parameterId: p.id, oldValue: existing.value, newValue: data.value,
            oldFlag: existing.flag, newFlag: data.flag, source: src, changedBy: userId,
            reason: amendment ? `Amendment: ${amendment.reason}` : ot.status === OT.VALIDATED ? 'Changed after validation' : 'Correction',
          });
        }
        await resultRepo.update(existing.id, data);
        saved = { ...existing, ...data } as Result;
      } else {
        saved = await resultRepo.save({ orderTestId, parameterId: p.id, ...data });
      }
      changed++;
      if (ev.isCritical && valueChanged) {
        await this.lookup.repo(CriticalAlert).save({
          resultId: saved.id, orderTestId, patientId: patient.id, parameterName: p.name, value: ev.value, flag: ev.flag, status: 'OPEN',
        });
      }
    };

    for (const e of entries) {
      const p = params.find((x) => x.id === Number(e.parameterId));
      if (!p || p.resultType === 'CALCULATED') continue;
      if (e.value === undefined || e.value === null) continue;
      await write(p, String(e.value), e.comment, source);
    }

    // Calculated parameters (formula over parameter codes of this test).
    const calc = params.filter((p) => p.resultType === 'CALCULATED' && p.formula);
    if (calc.length) {
      const all = await resultRepo.findBy({ orderTestId });
      const byCode: Record<string, string> = {};
      for (const r of all) {
        const p = params.find((x) => x.id === r.parameterId);
        if (p && r.value) byCode[p.code] = r.value;
      }
      for (const p of calc) {
        const v = this.ref.calculate(p.formula, byCode);
        if (v !== null) {
          await write(p, v.toFixed(p.decimals ?? 2), undefined, 'CALCULATED');
          byCode[p.code] = v.toFixed(p.decimals ?? 2);
        }
      }
    }

    // Status progression.
    const all = await resultRepo.findBy({ orderTestId });
    const mandatory = tps.filter((t) => t.isMandatory && params.find((p) => p.id === t.parameterId)?.resultType !== 'CALCULATED');
    const complete = mandatory.every((t) => all.find((r) => r.parameterId === t.parameterId && r.value));
    const patch: Partial<OrderTest> = {};
    if (ot.status === OT.AMENDING) {
      // stays in amendment until validated & signed
    } else if (ot.status === OT.VALIDATED && changed) {
      Object.assign(patch, { status: OT.RESULTED, validatedBy: null, validatedAt: null });
    } else if (complete && [OT.ACCESSIONED, OT.IN_ANALYZER, OT.OUTSOURCED].includes(ot.status as any)) {
      Object.assign(patch, { status: OT.RESULTED, resultedAt: new Date() });
    }
    if (Object.keys(patch).length) await repo.update(ot.id, patch);
    await this.lookup.refreshOrderStatus(ot.orderId);
    if (ot.sampleId) await this.lookup.refreshSampleStatus(ot.sampleId);
    return { orderTestId, changed, complete };
  }

  /** Routes parameter-level results to the right order-test on a sample (used for reference labs). */
  async ingestByParameterCode(ots: OrderTest[], items: { parameterCode?: string; code?: string; value: string; comment?: string }[], source: string, analyzerId: number | null, userId: number | null) {
    const codes = items.map((i) => i.parameterCode || i.code).filter(Boolean);
    const params = codes.length ? await this.lookup.repo(Parameter).findBy({ code: In(codes) }) : [];
    const entries = items.map((i) => ({ parameterId: params.find((p) => p.code === (i.parameterCode || i.code))?.id, value: i.value, comment: i.comment, code: i.parameterCode || i.code }));
    return this.ingest(ots, entries, source, analyzerId, userId);
  }

  async ingest(ots: OrderTest[], entries: (ResultEntry & { code?: string })[], source: string, analyzerId: number | null, userId: number | null) {
    const tps = ots.length ? await this.lookup.repo(TestParameter).findBy({ testId: In(ots.map((o) => o.testId)), active: true }) : [];
    const perOt = new Map<number, ResultEntry[]>();
    const unmapped: string[] = [];
    for (const e of entries) {
      const target = e.parameterId ? ots.find((o) => tps.some((t) => t.testId === o.testId && t.parameterId === e.parameterId) && ENTERABLE.includes(o.status)) : null;
      if (!target) { unmapped.push(e.code || String(e.parameterId)); continue; }
      perOt.set(target.id, [...(perOt.get(target.id) || []), e]);
    }
    const touched: number[] = [];
    const errors: string[] = [];
    for (const [otId, list] of perOt) {
      try {
        await this.saveResults(otId, list, source, userId, analyzerId);
        touched.push(otId);
      } catch (e: any) {
        errors.push(`${otId}: ${e.message}`);
      }
    }
    return { touched, unmapped, errors, accepted: entries.length - unmapped.length };
  }

  private async assertComplete(ot: OrderTest) {
    const tps = await this.lookup.repo(TestParameter).findBy({ testId: ot.testId, active: true, isMandatory: true });
    const results = await this.lookup.repo(Result).findBy({ orderTestId: ot.id });
    const missing = tps.filter((t) => !results.find((r) => r.parameterId === t.parameterId && r.value));
    if (missing.length) throw new BadRequestException(`Order test ${ot.id} has ${missing.length} mandatory result(s) missing`);
  }

  async validate(ids: number[], user: AuthUser | null, note?: string) {
    const ots = await this.lookup.repo(OrderTest).findBy({ id: In(ids) });
    if (!ots.length) throw new BadRequestException('Select tests to validate');
    for (const ot of ots) {
      if (![OT.RESULTED, OT.AMENDING].includes(ot.status as any)) {
        const name = (await this.lookup.repo(LabTest).findOneBy({ id: ot.testId }))?.name ?? `Test ${ot.id}`;
        const why = [OT.ACCESSIONED, OT.IN_ANALYZER, OT.OUTSOURCED].includes(ot.status as any) ? 'has no results yet – enter or receive results first' : `is ${ot.status.toLowerCase().replace('_', ' ')} and cannot be validated`;
        throw new BadRequestException(`${name} ${why}`);
      }
      await this.assertComplete(ot);
    }
    for (const ot of ots) {
      await this.lookup.repo(OrderTest).update(ot.id, { status: OT.VALIDATED, validatedBy: user?.id ?? null, validatedAt: new Date(), technicalNote: note ?? ot.technicalNote });
      await this.lookup.audit('order_test', ot.id, 'VALIDATE', note || (user ? null : 'Auto-validated'), user?.id);
      await this.lookup.refreshOrderStatus(ot.orderId);
    }
    return { validated: ots.length };
  }

  /** Sends a validated/resulted test back to the bench (e.g. suspected interference). */
  async unvalidate(id: number, note: string, user: AuthUser) {
    const ot = await this.lookup.repo(OrderTest).findOneBy({ id });
    if (!ot || ot.status !== OT.VALIDATED) throw new BadRequestException('Only validated tests can be returned');
    await this.lookup.repo(OrderTest).update(id, { status: OT.RESULTED, validatedBy: null, validatedAt: null, technicalNote: note });
    await this.lookup.audit('order_test', id, 'RETURN', note, user.id);
    return { ok: true };
  }

  async sign(ids: number[], user: AuthUser) {
    const ots = await this.lookup.repo(OrderTest).findBy({ id: In(ids) });
    if (!ots.length) throw new BadRequestException('Select tests to sign');
    const bad = ots.filter((o) => o.status !== OT.VALIDATED);
    if (bad.length) throw new BadRequestException('Only validated tests can be signed');
    const byOrder = new Map<number, { amended: string[] }>();
    for (const ot of ots) {
      const amend = await this.lookup.repo(Amendment).findOneBy({ orderTestId: ot.id, status: 'OPEN' });
      await this.lookup.repo(OrderTest).update(ot.id, { status: OT.SIGNED, signedBy: user.id, signedAt: new Date(), amendCount: ot.amendCount + (amend ? 1 : 0) });
      if (amend) await this.lookup.repo(Amendment).update(amend.id, { status: 'COMPLETED', completedAt: new Date() });
      const g = byOrder.get(ot.orderId) || { amended: [] };
      if (amend) g.amended.push(amend.reason);
      byOrder.set(ot.orderId, g);
      await this.lookup.audit('order_test', ot.id, 'SIGN', null, user.id);
      if (ot.sampleId) await this.lookup.refreshSampleStatus(ot.sampleId);
    }
    for (const [orderId, g] of byOrder) {
      await this.lookup.refreshOrderStatus(orderId);
      await this.reports.release(orderId, g.amended.length ? 'AMENDMENT' : 'RELEASE', g.amended.join('; ') || null, user);
    }
    return { signed: ots.length };
  }

  async amend(id: number, reason: string, user: AuthUser) {
    if (!reason?.trim()) throw new BadRequestException('Give a reason for the amendment');
    const ot = await this.lookup.repo(OrderTest).findOneBy({ id });
    if (!ot) throw new NotFoundException('Order test not found');
    if (ot.status !== OT.SIGNED) throw new BadRequestException('Only signed tests can be amended');
    await this.lookup.repo(Amendment).save({ orderTestId: id, orderId: ot.orderId, reason, requestedBy: user.id, status: 'OPEN' });
    await this.lookup.repo(OrderTest).update(id, { status: OT.AMENDING, validatedBy: null, validatedAt: null });
    await this.lookup.audit('order_test', id, 'AMEND_START', reason, user.id);
    await this.lookup.refreshOrderStatus(ot.orderId);
    return this.detail(id);
  }

  async criticalAlerts(status?: string) {
    const alerts = await this.lookup.repo(CriticalAlert).find({ where: status ? { status } : {}, order: { id: 'DESC' }, take: 300 });
    const ots = await this.lookup.enrich(alerts.length ? await this.lookup.repo(OrderTest).findBy({ id: In(alerts.map((a) => a.orderTestId)) }) : []);
    const users = await this.lookup.userNames(alerts.map((a) => a.notifiedBy));
    return alerts.map((a) => {
      const ot = ots.find((o) => o.id === a.orderTestId);
      return {
        ...a, orderNo: ot?.order?.orderNo, orderId: ot?.orderId, patientName: patientName(ot?.patient as any), mrn: ot?.patient?.mrn,
        testName: ot?.test?.name, doctor: ot?.doctor?.name, doctorPhone: ot?.doctor?.phone, notifiedByName: users.get(a.notifiedBy)?.fullName,
      };
    });
  }

  async notifyCritical(id: number, body: { notifiedTo: string; readBackConfirmed?: boolean; notes?: string }, user: AuthUser) {
    if (!body.notifiedTo) throw new BadRequestException('Record who was informed');
    await this.lookup.repo(CriticalAlert).update(id, {
      status: 'NOTIFIED', notifiedTo: body.notifiedTo, readBackConfirmed: !!body.readBackConfirmed, notes: body.notes,
      notifiedBy: user.id, notifiedAt: new Date(),
    });
    await this.lookup.audit('critical_alert', id, 'NOTIFY', body, user.id);
    return { ok: true };
  }
}
