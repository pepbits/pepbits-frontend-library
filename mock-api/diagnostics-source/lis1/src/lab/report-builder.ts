import { NotFoundException, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import {
  Addendum, Amendment, Department, Doctor, LabOrder, Methodology, OrderTest, OT, Parameter, Patient, Report,
  ReportTemplate, Result, Sample, TestParameter, Unit, User,
} from '../entities';
import { ageOf, LookupService, patientName } from './lookup.service';

@Injectable()
export class ReportBuilder {
  constructor(private lookup: LookupService) {}

  /** Assembles the complete, print-ready report model for an order (signed tests only). */
  async build(orderId: number, templateId?: number) {
    const order = await this.lookup.repo(LabOrder).findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');
    const patient = await this.lookup.repo(Patient).findOneBy({ id: order.patientId });
    const doctor = order.doctorId ? await this.lookup.repo(Doctor).findOneBy({ id: order.doctorId }) : null;
    const report = await this.lookup.repo(Report).findOneBy({ orderId });
    const ots = (await this.lookup.enrich(await this.lookup.repo(OrderTest).find({ where: { orderId }, order: { id: 'ASC' } })))
      .filter((o) => o.status !== OT.CANCELLED);
    const signed = ots.filter((o) => o.status === OT.SIGNED);

    const templates = await this.lookup.repo(ReportTemplate).find({ where: { active: true } });
    const firstTpl = signed.find((o) => o.test?.reportTemplateId)?.test?.reportTemplateId;
    const template = (templateId && templates.find((t) => t.id === Number(templateId)))
      || (firstTpl && templates.find((t) => t.id === firstTpl))
      || templates.find((t) => t.isDefault) || templates[0] || null;

    const tps = signed.length ? await this.lookup.repo(TestParameter).find({ where: { testId: In(signed.map((o) => o.testId)), active: true }, order: { sequence: 'ASC' } }) : [];
    const params = tps.length ? await this.lookup.repo(Parameter).findBy({ id: In(tps.map((t) => t.parameterId)) }) : [];
    const results = signed.length ? await this.lookup.repo(Result).findBy({ orderTestId: In(signed.map((o) => o.id)) }) : [];
    const units = await this.lookup.repo(Unit).find();
    const methods = await this.lookup.repo(Methodology).find();
    const departments = await this.lookup.repo(Department).find();
    const signerIds = [...new Set(signed.map((o) => o.signedBy).filter(Boolean))];
    const signers = signerIds.length ? await this.lookup.repo(User).findBy({ id: In(signerIds) }) : [];
    const addenda = await this.lookup.repo(Addendum).find({ where: { orderId }, order: { id: 'ASC' } });
    const amendments = await this.lookup.repo(Amendment).find({ where: { orderId, status: 'COMPLETED' }, order: { id: 'ASC' } });
    const authorMap = await this.lookup.userNames([...addenda.map((a) => a.createdBy), ...amendments.map((a) => a.requestedBy)]);
    const samples = await this.lookup.repo(Sample).findBy({ id: In([...new Set(ots.map((o) => o.sampleId).filter(Boolean)), 0]) });

    const tests = signed.map((ot) => {
      const rows = tps.filter((t) => t.testId === ot.testId && t.isReportable).map((tp) => {
        const p = params.find((x) => x.id === tp.parameterId);
        const r = results.find((x) => x.orderTestId === ot.id && x.parameterId === tp.parameterId);
        return {
          code: p?.code, name: p?.name, loinc: p?.loincCode, section: tp.sectionHeading, resultType: p?.resultType,
          value: r?.value ?? '', unit: r?.unit ?? units.find((u) => u.id === p?.unitId)?.symbol ?? '',
          flag: r?.flag && r.flag !== 'N' ? r.flag : '', critical: r?.isCritical, referenceText: r?.referenceText ?? '',
          method: methods.find((m) => m.id === p?.methodologyId)?.name ?? '', comment: r?.comment ?? '',
          interpretation: p?.interpretation, source: r?.source,
        };
      });
      const signer = signers.find((u) => u.id === ot.signedBy);
      return {
        orderTestId: ot.id, code: ot.test?.code, name: ot.test?.name, loinc: ot.test?.loincCode,
        departmentId: ot.test?.departmentId, subDepartment: ot.subDepartment?.name,
        method: methods.find((m) => m.id === ot.test?.methodologyId)?.name, sampleNo: ot.sample?.sampleNo,
        sampleType: ot.sampleType?.name, bodySite: (ot as any).bodySite?.name, interpretation: ot.test?.interpretation,
        isOutsourced: ot.isOutsourced, amended: ot.amendCount > 0,
        validatedByName: ot.validatedByName, signedByName: signer?.fullName, signedAt: ot.signedAt, rows,
      };
    });

    const depOrder = [...new Set(tests.map((t) => t.departmentId))]
      .map((id) => departments.find((d) => d.id === id) || { id: 0, name: 'General', sequence: 999 } as any)
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

    return {
      lab: await this.lookup.settings('lab.'),
      template,
      report,
      order: { id: order.id, orderNo: order.orderNo, priority: order.priority, createdAt: order.createdAt, externalOrderNo: order.externalOrderNo, clinicalNotes: order.clinicalNotes, diagnosis: order.diagnosis, patientLocation: order.patientLocation },
      patient: { ...patient, fullName: patientName(patient), age: ageOf(patient.dob, order.createdAt)?.label },
      doctor,
      samples: samples.map((s) => ({ sampleNo: s.sampleNo, collectedAt: s.collectedAt, accessionedAt: s.accessionedAt })),
      departments: depOrder.map((d) => ({ id: d.id, name: d.name, tests: tests.filter((t) => (t.departmentId || 0) === d.id) })),
      pending: ots.filter((o) => o.status !== OT.SIGNED).map((o) => ({ name: o.test?.name, status: o.status })),
      signers: signers.map((s) => ({ fullName: s.fullName, qualification: s.qualification, signatureText: s.signatureText })),
      addenda: addenda.map((a) => ({ ...a, author: authorMap.get(a.createdBy)?.fullName })),
      amendments: amendments.map((a) => ({ reason: a.reason, completedAt: a.completedAt, author: authorMap.get(a.requestedBy)?.fullName, test: ots.find((o) => o.id === a.orderTestId)?.test?.name })),
      generatedAt: new Date(),
    };
  }
}
