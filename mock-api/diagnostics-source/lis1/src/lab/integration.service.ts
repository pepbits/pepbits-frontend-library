import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { In, Like } from 'typeorm';
import {
  Doctor, ExternalSystem, IntegrationLog, LabOrder, LabTest, OrderTest, Patient, Profile, Report,
} from '../entities';
import { SequenceService } from '../common/sequence.service';
import { authHeaders, postExternal } from '../common/http';
import { LookupService } from './lookup.service';
import { OrdersService, PatientsService } from './orders.service';
import { ReportBuilder } from './report-builder';
import { buildOru } from './hl7';

@Injectable()
export class IntegrationService {
  constructor(
    private lookup: LookupService,
    private seq: SequenceService,
    private orders: OrdersService,
    private patients: PatientsService,
    private builder: ReportBuilder,
  ) {}

  async system(apiKey: string) {
    const sys = apiKey ? await this.lookup.repo(ExternalSystem).findOneBy({ apiKey, active: true }) : null;
    if (!sys) throw new UnauthorizedException('Invalid or inactive API key (send it in the x-api-key header)');
    return sys;
  }

  /**
   * Inbound electronic order from HIS/EMR. Idempotent on (system, externalOrderNo).
   * Body: { externalOrderNo, priority, clinicalNotes, diagnosis, patientLocation,
   *   patient: { externalPatientId, mrn?, firstName, lastName, dob, gender, ethnicity, phone, email },
   *   doctor?: { code?, name?, phone? }, tests?: [testCode], profiles?: [profileCode] }
   */
  async receiveOrder(apiKey: string, body: any) {
    const sys = await this.system(apiKey);
    const log = await this.lookup.repo(IntegrationLog).save({ externalSystemId: sys.id, direction: 'INBOUND', eventType: 'ORDER_IN', reference: body?.externalOrderNo, payload: JSON.stringify(body), status: 'PROCESSING' });
    try {
      if (!body?.externalOrderNo) throw new BadRequestException('externalOrderNo is required');
      if (!body?.patient?.firstName) throw new BadRequestException('patient.firstName is required');
      const dup = await this.lookup.repo(LabOrder).findOneBy({ externalSystemId: sys.id, externalOrderNo: body.externalOrderNo });
      if (dup) {
        const res = { duplicate: true, orderId: dup.id, orderNo: dup.orderNo };
        await this.lookup.repo(IntegrationLog).update(log.id, { status: 'DUPLICATE', response: JSON.stringify(res) });
        return res;
      }
      const testCodes: string[] = body.tests || [];
      const profileCodes: string[] = body.profiles || [];
      const tests = testCodes.length ? await this.lookup.repo(LabTest).findBy({ code: In(testCodes), active: true }) : [];
      const profiles = profileCodes.length ? await this.lookup.repo(Profile).findBy({ code: In(profileCodes), active: true }) : [];
      const unknown = [...testCodes.filter((c) => !tests.find((t) => t.code === c)), ...profileCodes.filter((c) => !profiles.find((p) => p.code === c))];
      if (unknown.length) throw new BadRequestException(`Unknown test/profile codes: ${unknown.join(', ')}`);

      const pt = body.patient;
      let patient = pt.externalPatientId ? await this.lookup.repo(Patient).findOneBy({ externalSystemId: sys.id, externalPatientId: pt.externalPatientId }) : null;
      if (!patient && pt.mrn) patient = await this.lookup.repo(Patient).findOneBy({ mrn: pt.mrn });
      const pdata = {
        firstName: pt.firstName, lastName: pt.lastName, dob: pt.dob, gender: pt.gender || 'U', ethnicity: pt.ethnicity,
        phone: pt.phone, email: pt.email, address: pt.address, nationalId: pt.nationalId, isPregnant: !!pt.isPregnant,
        externalSystemId: sys.id, externalPatientId: pt.externalPatientId,
      };
      const saved = patient ? await this.patients.save(pdata as any, patient.id) : await this.patients.save({ ...pdata, mrn: pt.mrn } as any);

      let doctorId: number = null;
      if (body.doctor?.code || body.doctor?.name) {
        let doc = body.doctor.code ? await this.lookup.repo(Doctor).findOneBy({ code: body.doctor.code }) : null;
        if (!doc && body.doctor.name) doc = await this.lookup.repo(Doctor).findOne({ where: { name: Like(body.doctor.name) } });
        if (!doc) doc = await this.lookup.repo(Doctor).save({ code: body.doctor.code || await this.seq.next('DR', false, 5), name: body.doctor.name || body.doctor.code, phone: body.doctor.phone, specialty: body.doctor.specialty });
        doctorId = doc.id;
      }
      const order = await this.orders.create({
        patientId: saved.id, doctorId, priority: body.priority, testIds: tests.map((t) => t.id), profileIds: profiles.map((p) => p.id),
        clinicalNotes: body.clinicalNotes, diagnosis: body.diagnosis, patientLocation: body.patientLocation,
        source: 'EXTERNAL', externalSystemId: sys.id, externalOrderNo: body.externalOrderNo,
      });
      const res = { orderId: order.id, orderNo: order.orderNo, mrn: saved.mrn, status: 'ACCEPTED' };
      await this.lookup.repo(IntegrationLog).update(log.id, { status: 'SUCCESS', response: JSON.stringify(res) });
      return res;
    } catch (e: any) {
      await this.lookup.repo(IntegrationLog).update(log.id, { status: 'FAILED', error: e.message });
      throw e;
    }
  }

  async orderStatus(apiKey: string, externalOrderNo: string) {
    const sys = await this.system(apiKey);
    const order = await this.lookup.repo(LabOrder).findOneBy({ externalSystemId: sys.id, externalOrderNo });
    if (!order) throw new NotFoundException('Order not found');
    const ots = await this.lookup.enrich(await this.lookup.repo(OrderTest).findBy({ orderId: order.id }));
    return { orderNo: order.orderNo, externalOrderNo, status: order.status, tests: ots.map((o) => ({ code: o.test?.code, name: o.test?.name, status: o.status, sampleNo: o.sample?.sampleNo, signedAt: o.signedAt })) };
  }

  async pullResults(apiKey: string, externalOrderNo: string, format?: string) {
    const sys = await this.system(apiKey);
    const order = await this.lookup.repo(LabOrder).findOneBy({ externalSystemId: sys.id, externalOrderNo });
    if (!order) throw new NotFoundException('Order not found');
    return this.payload(order.id, (format || sys.resultFormat).toUpperCase(), sys.code);
  }

  /** Builds the outbound result message in JSON, FHIR R4 (Bundle) or HL7 ORU^R01. */
  async payload(orderId: number, format: string, receiver: string) {
    const d = await this.builder.build(orderId);
    const tests = d.departments.flatMap((dep: any) => dep.tests);
    if (format === 'HL7') {
      return buildOru({
        controlId: `${d.report?.reportNo || d.order.orderNo}-${d.report?.version || 0}`, receivingApp: receiver,
        patient: d.patient, orderNo: d.order.orderNo, externalOrderNo: d.order.externalOrderNo,
        tests: tests.map((t: any) => ({ code: t.code, name: t.name, status: 'SIGNED', signedAt: t.signedAt, rows: t.rows })),
      });
    }
    if (format === 'FHIR') {
      const pid = `patient-${d.patient.id}`;
      const entries: any[] = [{ resource: { resourceType: 'Patient', id: pid, identifier: [{ system: 'urn:lis:mrn', value: d.patient.mrn }], name: [{ given: [d.patient.firstName], family: d.patient.lastName }], gender: ({ M: 'male', F: 'female', O: 'other' } as any)[d.patient.gender] || 'unknown', birthDate: d.patient.dob } }];
      for (const t of tests) {
        const obsIds: string[] = [];
        t.rows.forEach((r: any, i: number) => {
          const id = `obs-${t.orderTestId}-${i}`;
          obsIds.push(id);
          const num = parseFloat(r.value);
          entries.push({ resource: {
            resourceType: 'Observation', id, status: d.report?.status === 'AMENDED' ? 'amended' : 'final',
            code: { coding: [r.loinc ? { system: 'http://loinc.org', code: r.loinc, display: r.name } : { system: 'urn:lis:parameter', code: r.code, display: r.name }] },
            subject: { reference: `Patient/${pid}` },
            ...(isNaN(num) || !['NUMERIC', 'CALCULATED'].includes(r.resultType) ? { valueString: r.value } : { valueQuantity: { value: num, unit: r.unit } }),
            interpretation: r.flag ? [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: r.flag }] }] : undefined,
            referenceRange: r.referenceText ? [{ text: r.referenceText }] : undefined,
          } });
        });
        entries.push({ resource: {
          resourceType: 'DiagnosticReport', id: `dr-${t.orderTestId}`, status: t.amended ? 'amended' : 'final',
          identifier: [{ system: 'urn:lis:order', value: d.order.orderNo }],
          basedOn: d.order.externalOrderNo ? [{ identifier: { value: d.order.externalOrderNo } }] : undefined,
          code: { coding: [t.loinc ? { system: 'http://loinc.org', code: t.loinc, display: t.name } : { system: 'urn:lis:test', code: t.code, display: t.name }] },
          subject: { reference: `Patient/${pid}` }, issued: t.signedAt, result: obsIds.map((id) => ({ reference: `Observation/${id}` })),
        } });
      }
      return { resourceType: 'Bundle', type: 'collection', timestamp: new Date().toISOString(), entry: entries };
    }
    return {
      orderNo: d.order.orderNo, externalOrderNo: d.order.externalOrderNo, reportNo: d.report?.reportNo, version: d.report?.version,
      reportStatus: d.report?.status, patient: { mrn: d.patient.mrn, externalPatientId: d.patient.externalPatientId, name: d.patient.fullName, dob: d.patient.dob, gender: d.patient.gender },
      tests: tests.map((t: any) => ({ code: t.code, name: t.name, loinc: t.loinc, signedAt: t.signedAt, signedBy: t.signedByName, amended: t.amended, results: t.rows })),
      pending: d.pending, addenda: d.addenda.map((a: any) => ({ text: a.text, author: a.author, createdAt: a.createdAt })),
      amendments: d.amendments,
    };
  }

  /** Pushes results to the originating system's callback URL (real HTTP POST). */
  async publish(orderId: number, force = false) {
    const order = await this.lookup.repo(LabOrder).findOneBy({ id: orderId });
    if (!order || order.source !== 'EXTERNAL' || !order.externalSystemId) return { skipped: 'Order did not come from an external system' };
    const sys = await this.lookup.repo(ExternalSystem).findOneBy({ id: order.externalSystemId });
    if (!sys?.resultCallbackUrl) return { skipped: 'No result callback URL configured' };
    if (!sys.autoPublish && !force) return { skipped: 'Auto-publish is off for this system' };
    const format = (sys.resultFormat || 'JSON').toUpperCase();
    const body = await this.payload(orderId, format, sys.code);
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    const ct = format === 'HL7' ? 'application/hl7-v2' : format === 'FHIR' ? 'application/fhir+json' : 'application/json';
    const res = await postExternal(sys.resultCallbackUrl, text, ct, authHeaders('BEARER', sys.callbackAuthToken));
    await this.lookup.repo(IntegrationLog).save({
      externalSystemId: sys.id, direction: 'OUTBOUND', eventType: 'RESULT_OUT', reference: order.externalOrderNo || order.orderNo,
      payload: text, response: `${res.status} ${res.body}`, status: res.ok ? 'SUCCESS' : 'FAILED', error: res.ok ? null : res.body,
    });
    await this.lookup.repo(Report).update({ orderId }, { lastPublishedStatus: res.ok ? 'SENT' : 'FAILED' });
    return { ok: res.ok, status: res.status };
  }

  async logs(q: { status?: string; eventType?: string; q?: string }) {
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.eventType) where.eventType = q.eventType;
    if (q.q) where.reference = Like(`%${q.q}%`);
    return this.lookup.repo(IntegrationLog).find({ where, order: { id: 'DESC' }, take: 300 });
  }
}
