import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { In, Like, Not } from 'typeorm';
import {
  ExternalLab, IntegrationLog, LabOrder, LabTest, MiddlewareMessage, OrderTest, OT, OutsourceItem,
  OutsourceShipment, Patient, Sample,
} from '../entities';
import { SequenceService } from '../common/sequence.service';
import { AuthUser } from '../common/auth';
import { authHeaders, postExternal } from '../common/http';
import { LookupService } from './lookup.service';
import { AutomationService } from './automation.service';
import { ResultsService } from './results.service';

@Injectable()
export class SamplesService {
  constructor(private lookup: LookupService, private seq: SequenceService, private automation: AutomationService) {}

  /** Tests waiting to be drawn, grouped per patient then per tube (sample type + container). */
  async pendingCollection(q?: string) {
    const requireBilling = (await this.lookup.setting('billing.requiredBeforeCollection', 'false')) === 'true';
    const ots = await this.lookup.repo(OrderTest).find({
      where: { status: In([OT.ORDERED, OT.BILLED]) }, order: { id: 'ASC' }, take: 2000,
    });
    let rows = (await this.lookup.enrich(ots.filter((o) => !o.sampleId)));
    if (q) {
      const t = q.toLowerCase();
      rows = rows.filter((r) => [r.patient?.mrn, r.patient?.fullName, r.order?.orderNo].some((v) => v?.toLowerCase().includes(t)));
    }
    const patients = new Map<number, any>();
    for (const r of rows) {
      const pid = r.patient?.id;
      if (!patients.has(pid)) patients.set(pid, { patient: r.patient, stat: false, tubes: new Map<string, any>() });
      const g = patients.get(pid);
      if (r.order?.priority === 'STAT') g.stat = true;
      const key = `${r.test?.sampleTypeId || 0}-${r.test?.containerId || 0}`;
      if (!g.tubes.has(key)) g.tubes.set(key, { key, sampleType: r.sampleType, container: r.container, tests: [] });
      g.tubes.get(key).tests.push({ ...r, blocked: requireBilling && !r.isBilled });
    }
    return [...patients.values()]
      .map((g) => ({ ...g, tubes: [...g.tubes.values()] }))
      .sort((a, b) => Number(b.stat) - Number(a.stat));
  }

  /**
   * Draws samples. Selected order-tests (from one or many orders of the same patient) are grouped by
   * sample type + container, so one physical tube can carry many tests from many orders.
   * Pass attachToSampleId to add tests onto an existing tube (add-on testing).
   */
  async collect(body: { orderTestIds: number[]; collectionSite?: string; notes?: string; attachToSampleId?: number; collectedAt?: string }, user: AuthUser) {
    if (!body.orderTestIds?.length) throw new BadRequestException('Select tests to collect');
    const repo = this.lookup.repo(OrderTest);
    const ots = await repo.findBy({ id: In(body.orderTestIds) });
    const bad = ots.filter((o) => ![OT.ORDERED, OT.BILLED].includes(o.status as any) || o.sampleId);
    if (bad.length) throw new BadRequestException('Some selected tests are already collected or cancelled');
    const requireBilling = (await this.lookup.setting('billing.requiredBeforeCollection', 'false')) === 'true';
    if (requireBilling && ots.some((o) => !o.isBilled)) throw new BadRequestException('Bill these tests before collecting samples');
    const orders = await this.lookup.repo(LabOrder).findBy({ id: In([...new Set(ots.map((o) => o.orderId))]) });
    const patientIds = new Set(orders.map((o) => o.patientId));
    if (patientIds.size > 1) throw new BadRequestException('A sample can only hold tests for one patient');
    const patientId = [...patientIds][0];
    const tests = await this.lookup.repo(LabTest).findBy({ id: In(ots.map((o) => o.testId)) });
    const tMap = new Map(tests.map((t) => [t.id, t]));
    const collectedAt = body.collectedAt ? new Date(body.collectedAt) : new Date();

    const created: number[] = [];
    if (body.attachToSampleId) {
      const sample = await this.lookup.repo(Sample).findOneBy({ id: body.attachToSampleId });
      if (!sample) throw new NotFoundException('Sample not found');
      if (sample.patientId !== patientId) throw new BadRequestException('That sample belongs to another patient');
      if (['REJECTED', 'COMPLETED'].includes(sample.status)) throw new BadRequestException(`Cannot add tests to a ${sample.status.toLowerCase()} sample`);
      const newStatus = sample.status === 'COLLECTED' ? OT.COLLECTED : OT.ACCESSIONED;
      await repo.update({ id: In(ots.map((o) => o.id)) }, { sampleId: sample.id, status: newStatus });
      created.push(sample.id);
      await this.lookup.audit('sample', sample.id, 'ATTACH_TESTS', { orderTestIds: body.orderTestIds }, user.id);
      if (newStatus === OT.ACCESSIONED) await this.automation.dispatchSample(sample.id);
    } else {
      const groups = new Map<string, OrderTest[]>();
      for (const ot of ots) {
        const t = tMap.get(ot.testId);
        const key = `${t?.sampleTypeId || 0}-${t?.containerId || 0}`;
        groups.set(key, [...(groups.get(key) || []), ot]);
      }
      for (const [key, list] of groups) {
        const [st, ct] = key.split('-').map(Number);
        const sample = await this.lookup.repo(Sample).save({
          sampleNo: await this.seq.next('S', true, 4),
          patientId, sampleTypeId: st || null, containerId: ct || null, status: 'COLLECTED',
          collectedAt, collectedBy: user.id, collectionSite: body.collectionSite, notes: body.notes,
        });
        await repo.update({ id: In(list.map((o) => o.id)) }, { sampleId: sample.id, status: OT.COLLECTED });
        created.push(sample.id);
        await this.lookup.audit('sample', sample.id, 'COLLECT', { orderTestIds: list.map((o) => o.id) }, user.id);
      }
    }
    for (const o of orders) await this.lookup.refreshOrderStatus(o.id);
    return Promise.all(created.map((id) => this.get(id)));
  }

  async findByNo(sampleNo: string) {
    const s = await this.lookup.repo(Sample).findOneBy({ sampleNo: sampleNo.trim() });
    if (!s) throw new NotFoundException(`No sample with barcode ${sampleNo}`);
    return this.get(s.id);
  }

  /** Receives the tube in the lab and routes in-house tests to analyzers through middleware. */
  async accession(sampleId: number, user: AuthUser) {
    const sample = await this.lookup.repo(Sample).findOneBy({ id: sampleId });
    if (!sample) throw new NotFoundException('Sample not found');
    if (sample.status !== 'COLLECTED') throw new BadRequestException(`Sample ${sample.sampleNo} is already ${sample.status.toLowerCase()}`);
    await this.lookup.repo(Sample).update(sampleId, { status: 'ACCESSIONED', accessionedAt: new Date(), accessionedBy: user.id });
    await this.lookup.repo(OrderTest).update({ sampleId, status: OT.COLLECTED }, { status: OT.ACCESSIONED });
    await this.lookup.audit('sample', sampleId, 'ACCESSION', null, user.id);
    const dispatch = await this.automation.dispatchSample(sampleId);
    const ots = await this.lookup.repo(OrderTest).findBy({ sampleId });
    for (const oid of new Set(ots.map((o) => o.orderId))) await this.lookup.refreshOrderStatus(oid);
    await this.lookup.refreshSampleStatus(sampleId);
    return { sample: await this.get(sampleId), dispatch };
  }

  async reject(sampleId: number, reason: string, user: AuthUser) {
    if (!reason) throw new BadRequestException('Choose a rejection reason');
    const sample = await this.lookup.repo(Sample).findOneBy({ id: sampleId });
    if (!sample) throw new NotFoundException('Sample not found');
    if (['REJECTED', 'COMPLETED'].includes(sample.status)) throw new BadRequestException(`Sample is already ${sample.status.toLowerCase()}`);
    const ots = await this.lookup.repo(OrderTest).findBy({ sampleId });
    if (ots.some((o) => [OT.RESULTED, OT.VALIDATED, OT.SIGNED, OT.AMENDING].includes(o.status as any)))
      throw new BadRequestException('Results already exist on this sample; cancel or rerun individual tests instead');
    await this.lookup.repo(Sample).update(sampleId, { status: 'REJECTED', rejectionReason: reason, rejectedAt: new Date(), rejectedBy: user.id });
    for (const ot of ots.filter((o) => o.status !== OT.CANCELLED)) {
      // Release the tests so a fresh sample can be drawn (recollection).
      await this.lookup.repo(OrderTest).update(ot.id, { sampleId: null, analyzerId: null, status: ot.isBilled ? OT.BILLED : OT.ORDERED });
      await this.lookup.refreshOrderStatus(ot.orderId);
    }
    await this.lookup.audit('sample', sampleId, 'REJECT', reason, user.id);
    return this.get(sampleId);
  }

  async list(q: { status?: string; q?: string; patientId?: string }) {
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.patientId) where.patientId = Number(q.patientId);
    if (q.q) where.sampleNo = Like(`%${q.q}%`);
    const samples = await this.lookup.repo(Sample).find({ where, order: { id: 'DESC' }, take: 300 });
    if (!samples.length) return [];
    const ots = await this.lookup.repo(OrderTest).findBy({ sampleId: In(samples.map((s) => s.id)) });
    const enriched = await this.lookup.enrich(ots);
    const patients = await this.lookup.repo(Patient).findBy({ id: In(samples.map((s) => s.patientId)) });
    return samples.map((s) => {
      const mine = enriched.filter((o) => o.sampleId === s.id);
      const p = patients.find((x) => x.id === s.patientId);
      return {
        ...s, patientName: [p?.firstName, p?.lastName].filter(Boolean).join(' '), mrn: p?.mrn,
        tests: mine.map((o) => ({ id: o.id, code: o.test?.code, name: o.test?.name, status: o.status, orderNo: o.order?.orderNo })),
        sampleType: mine[0]?.sampleType, container: mine[0]?.container,
        priority: mine.some((o) => o.order?.priority === 'STAT') ? 'STAT' : 'ROUTINE',
      };
    });
  }

  async get(id: number) {
    const sample = await this.lookup.repo(Sample).findOneBy({ id });
    if (!sample) throw new NotFoundException('Sample not found');
    const ots = await this.lookup.enrich(await this.lookup.repo(OrderTest).findBy({ sampleId: id }));
    const patient = ots[0]?.patient || (await this.lookup.repo(Patient).findOneBy({ id: sample.patientId }));
    const messages = await this.lookup.repo(MiddlewareMessage).find({ where: { sampleId: id }, order: { id: 'DESC' }, take: 20 });
    const users = await this.lookup.userNames([sample.collectedBy, sample.accessionedBy, sample.rejectedBy]);
    return {
      ...sample, patient, tests: ots, messages,
      sampleType: ots[0]?.sampleType, container: ots[0]?.container,
      orders: [...new Map(ots.map((o) => [o.orderId, o.order])).values()],
      collectedByName: users.get(sample.collectedBy)?.fullName,
      accessionedByName: users.get(sample.accessionedBy)?.fullName,
      priority: ots.some((o) => o.order?.priority === 'STAT') ? 'STAT' : 'ROUTINE',
    };
  }
}

@Injectable()
export class OutsourceService {
  constructor(private lookup: LookupService, private seq: SequenceService, private results: ResultsService) {}

  /** Accessioned tests flagged for an external lab and not yet on a shipment. */
  async pending() {
    const ots = await this.lookup.repo(OrderTest).findBy({ isOutsourced: true, status: OT.ACCESSIONED });
    const onShipment = await this.lookup.repo(OutsourceItem).findBy({ orderTestId: In(ots.map((o) => o.id)) });
    const busy = new Set(onShipment.map((i) => i.orderTestId));
    const rows = await this.lookup.enrich(ots.filter((o) => !busy.has(o.id)));
    const labs = await this.lookup.repo(ExternalLab).find();
    return rows.map((r) => ({ ...r, externalLab: labs.find((l) => l.id === r.externalLabId) || null }));
  }

  async createShipment(body: { externalLabId: number; orderTestIds: number[]; courier?: string; trackingNo?: string; notes?: string }, user: AuthUser) {
    const lab = await this.lookup.repo(ExternalLab).findOneBy({ id: body.externalLabId });
    if (!lab) throw new BadRequestException('Choose an external lab');
    if (!body.orderTestIds?.length) throw new BadRequestException('Select tests to send');
    const ots = await this.lookup.repo(OrderTest).findBy({ id: In(body.orderTestIds) });
    if (ots.some((o) => o.status !== OT.ACCESSIONED || !o.isOutsourced)) throw new BadRequestException('Only accessioned, outsourced tests can be shipped');
    const shipment = await this.lookup.repo(OutsourceShipment).save({
      shipmentNo: await this.seq.next('SHP'), externalLabId: lab.id, status: 'DRAFT',
      courier: body.courier, trackingNo: body.trackingNo, notes: body.notes,
    });
    for (const ot of ots) {
      await this.lookup.repo(OutsourceItem).save({ shipmentId: shipment.id, sampleId: ot.sampleId, orderTestId: ot.id, status: 'PENDING' });
      await this.lookup.repo(OrderTest).update(ot.id, { externalLabId: lab.id });
    }
    await this.lookup.audit('shipment', shipment.id, 'CREATE', { tests: ots.length }, user.id);
    return this.get(shipment.id);
  }

  /** Marks the shipment dispatched and transmits the manifest to the external lab's endpoint if configured. */
  async dispatch(id: number, user: AuthUser) {
    const shipment = await this.lookup.repo(OutsourceShipment).findOneBy({ id });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (shipment.status !== 'DRAFT') throw new BadRequestException('Shipment already dispatched');
    const lab = await this.lookup.repo(ExternalLab).findOneBy({ id: shipment.externalLabId });
    const items = await this.lookup.repo(OutsourceItem).findBy({ shipmentId: id });
    await this.lookup.repo(OutsourceItem).update({ shipmentId: id }, { status: 'SENT' });
    for (const it of items) await this.lookup.repo(OrderTest).update(it.orderTestId, { status: OT.OUTSOURCED });
    for (const sid of new Set(items.map((i) => i.sampleId))) await this.lookup.refreshSampleStatus(sid);
    for (const oid of new Set((await this.lookup.repo(OrderTest).findBy({ id: In(items.map((i) => i.orderTestId)) })).map((o) => o.orderId)))
      await this.lookup.refreshOrderStatus(oid);

    const manifest = await this.manifest(id);
    let transmissionStatus = 'NOT_CONFIGURED';
    let transmissionResponse = null;
    if (lab.manifestEndpointUrl) {
      const res = await postExternal(lab.manifestEndpointUrl, JSON.stringify(manifest), 'application/json', authHeaders('BEARER', lab.outboundAuthToken));
      transmissionStatus = res.ok ? 'SENT' : 'FAILED';
      transmissionResponse = `${res.status} ${res.body}`;
      await this.lookup.repo(IntegrationLog).save({
        externalLabId: lab.id, direction: 'OUTBOUND', eventType: 'MANIFEST_OUT', reference: shipment.shipmentNo,
        payload: JSON.stringify(manifest), response: transmissionResponse, status: res.ok ? 'SUCCESS' : 'FAILED',
      });
    }
    await this.lookup.repo(OutsourceShipment).update(id, { status: 'DISPATCHED', dispatchedAt: new Date(), dispatchedBy: user.id, transmissionStatus, transmissionResponse });
    await this.lookup.audit('shipment', id, 'DISPATCH', transmissionStatus, user.id);
    return this.get(id);
  }

  async manifest(id: number) {
    const s = await this.get(id);
    return {
      shipmentNo: s.shipmentNo, externalLab: s.externalLab?.code, courier: s.courier, trackingNo: s.trackingNo,
      items: s.items.map((i: any) => ({
        sampleNo: i.orderTest?.sample?.sampleNo, testCode: i.orderTest?.test?.code, testName: i.orderTest?.test?.name,
        loinc: i.orderTest?.test?.loincCode, sampleType: i.orderTest?.sampleType?.name,
        collectedAt: i.orderTest?.sample?.collectedAt, priority: i.orderTest?.order?.priority,
        patient: { mrn: i.orderTest?.patient?.mrn, name: i.orderTest?.patient?.fullName, dob: i.orderTest?.patient?.dob, gender: i.orderTest?.patient?.gender },
      })),
    };
  }

  async list(status?: string) {
    const rows = await this.lookup.repo(OutsourceShipment).find({ where: status ? { status } : {}, order: { id: 'DESC' }, take: 200 });
    const labs = await this.lookup.repo(ExternalLab).find();
    const items = rows.length ? await this.lookup.repo(OutsourceItem).findBy({ shipmentId: In(rows.map((r) => r.id)) }) : [];
    return rows.map((r) => ({
      ...r, externalLab: labs.find((l) => l.id === r.externalLabId),
      itemCount: items.filter((i) => i.shipmentId === r.id).length,
      receivedCount: items.filter((i) => i.shipmentId === r.id && i.status === 'RESULT_RECEIVED').length,
    }));
  }

  async get(id: number) {
    const s = await this.lookup.repo(OutsourceShipment).findOneBy({ id });
    if (!s) throw new NotFoundException('Shipment not found');
    const items = await this.lookup.repo(OutsourceItem).findBy({ shipmentId: id });
    const ots = await this.lookup.enrich(await this.lookup.repo(OrderTest).findBy({ id: In(items.map((i) => i.orderTestId)) }));
    const externalLab = await this.lookup.repo(ExternalLab).findOneBy({ id: s.externalLabId });
    return { ...s, externalLab, items: items.map((i) => ({ ...i, orderTest: ots.find((o) => o.id === i.orderTestId) })) };
  }

  /**
   * Inbound results from a reference lab (x-api-key = ExternalLab.inboundApiKey).
   * Body: { sampleNo, results: [{ parameterCode, value, comment? }] }
   */
  async receiveResults(apiKey: string, body: any) {
    const lab = apiKey ? await this.lookup.repo(ExternalLab).findOneBy({ inboundApiKey: apiKey, active: true }) : null;
    if (!lab) throw new UnauthorizedException('Invalid external lab API key');
    const log = await this.lookup.repo(IntegrationLog).save({ externalLabId: lab.id, direction: 'INBOUND', eventType: 'RESULT_IN', reference: body?.sampleNo, payload: JSON.stringify(body), status: 'PROCESSING' });
    try {
      const sample = await this.lookup.repo(Sample).findOneBy({ sampleNo: body?.sampleNo });
      if (!sample) throw new BadRequestException(`Unknown sample ${body?.sampleNo}`);
      const ots = await this.lookup.repo(OrderTest).findBy({ sampleId: sample.id, externalLabId: lab.id, status: Not(OT.CANCELLED) });
      const out = await this.results.ingestByParameterCode(ots, body.results || [], 'EXTERNAL_LAB', null, null);
      for (const otId of out.touched) {
        await this.lookup.repo(OutsourceItem).update({ orderTestId: otId }, { status: 'RESULT_RECEIVED' });
      }
      const shipIds = new Set((await this.lookup.repo(OutsourceItem).findBy({ orderTestId: In(out.touched.length ? out.touched : [0]) })).map((i) => i.shipmentId));
      for (const sid of shipIds) {
        const its = await this.lookup.repo(OutsourceItem).findBy({ shipmentId: sid });
        if (its.every((i) => i.status === 'RESULT_RECEIVED')) await this.lookup.repo(OutsourceShipment).update(sid, { status: 'COMPLETED' });
      }
      await this.lookup.repo(IntegrationLog).update(log.id, { status: out.unmapped.length ? 'PARTIAL' : 'SUCCESS', response: JSON.stringify(out) });
      return out;
    } catch (e: any) {
      await this.lookup.repo(IntegrationLog).update(log.id, { status: 'FAILED', error: e.message });
      throw e;
    }
  }
}

