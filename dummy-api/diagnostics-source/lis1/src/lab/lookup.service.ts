import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  BodySite,
  AuditLog, Container, Department, Doctor, LabOrder, LabTest, OrderTest, OT, Patient, Sample,
  SampleType, Setting, SubDepartment, User,
} from '../entities';

export function ageOf(dob: string | null, at: Date = new Date()) {
  if (!dob) return null;
  const b = new Date(dob);
  if (isNaN(b.getTime())) return null;
  const days = Math.floor((at.getTime() - b.getTime()) / 86400000);
  let years = at.getFullYear() - b.getFullYear();
  let months = at.getMonth() - b.getMonth();
  if (at.getDate() < b.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  const totalMonths = years * 12 + months;
  const label = years >= 2 ? `${years} Y` : totalMonths >= 1 ? `${totalMonths} M` : `${days} D`;
  return { days, months: totalMonths, years, label };
}

export const patientName = (p?: Patient) => (p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : '');

const byId = <T extends { id: number }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
const uniq = (ids: (number | null | undefined)[]) => [...new Set(ids.filter((x) => x != null))] as number[];

@Injectable()
export class LookupService {
  constructor(public ds: DataSource) {}

  repo<T>(e: new () => T) {
    return this.ds.getRepository<T>(e as any);
  }

  async setting(key: string, fallback = ''): Promise<string> {
    const s = await this.repo(Setting).findOne({ where: { key } });
    return s?.value ?? fallback;
  }

  async settings(prefix: string): Promise<Record<string, string>> {
    const rows = await this.repo(Setting).find();
    return Object.fromEntries(rows.filter((r) => r.key.startsWith(prefix)).map((r) => [r.key.slice(prefix.length), r.value]));
  }

  async audit(entity: string, entityId: number | null, action: string, detail: any, userId?: number) {
    await this.repo(AuditLog).save({
      entity, entityId, action, userId, detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    });
  }

  async userNames(ids: (number | null)[]) {
    const users = ids.length ? await this.repo(User).findBy({ id: In(uniq(ids)) }) : [];
    return byId(users);
  }

  /** Attaches test, order, patient, sample, department and user info to order-test rows. */
  async enrich(ots: OrderTest[]) {
    if (!ots.length) return [];
    const [tests, orders] = await Promise.all([
      this.repo(LabTest).findBy({ id: In(uniq(ots.map((o) => o.testId))) }),
      this.repo(LabOrder).findBy({ id: In(uniq(ots.map((o) => o.orderId))) }),
    ]);
    const tMap = byId(tests);
    const oMap = byId(orders);
    const [patients, samples, depts, subs, sts, conts, doctors, users, sites] = await Promise.all([
      this.repo(Patient).findBy({ id: In(uniq(orders.map((o) => o.patientId))) }),
      this.repo(Sample).findBy({ id: In(uniq(ots.map((o) => o.sampleId))) }),
      this.repo(Department).findBy({ id: In(uniq(tests.map((t) => t.departmentId))) }),
      this.repo(SubDepartment).findBy({ id: In(uniq(tests.map((t) => t.subDepartmentId))) }),
      this.repo(SampleType).findBy({ id: In(uniq(tests.map((t) => t.sampleTypeId))) }),
      this.repo(Container).findBy({ id: In(uniq(tests.map((t) => t.containerId))) }),
      this.repo(Doctor).findBy({ id: In(uniq(orders.map((o) => o.doctorId))) }),
      this.userNames(ots.flatMap((o) => [o.validatedBy, o.signedBy])),
      this.repo(BodySite).findBy({ id: In(uniq(ots.map((o) => o.bodySiteId))) }),
    ]);
    const pMap = byId(patients), sMap = byId(samples), dMap = byId(depts), sdMap = byId(subs);
    const stMap = byId(sts), cMap = byId(conts), docMap = byId(doctors), siteMap = byId(sites);
    const now = Date.now();
    return ots.map((ot) => {
      const test = tMap.get(ot.testId);
      const order = oMap.get(ot.orderId);
      const patient = order ? pMap.get(order.patientId) : undefined;
      const done = [OT.SIGNED, OT.CANCELLED].includes(ot.status as any);
      return {
        ...ot,
        test,
        order,
        patient: patient ? { ...patient, fullName: patientName(patient), age: ageOf(patient.dob, order?.createdAt)?.label } : null,
        doctor: order?.doctorId ? docMap.get(order.doctorId) : null,
        sample: ot.sampleId ? sMap.get(ot.sampleId) : null,
        department: test?.departmentId ? dMap.get(test.departmentId) : null,
        subDepartment: test?.subDepartmentId ? sdMap.get(test.subDepartmentId) : null,
        sampleType: test?.sampleTypeId ? stMap.get(test.sampleTypeId) : null,
        container: test?.containerId ? cMap.get(test.containerId) : null,
        bodySite: ot.bodySiteId ? siteMap.get(ot.bodySiteId) : null,
        validatedByName: ot.validatedBy ? users.get(ot.validatedBy)?.fullName : null,
        signedByName: ot.signedBy ? users.get(ot.signedBy)?.fullName : null,
        overdue: !done && ot.dueAt ? new Date(ot.dueAt).getTime() < now : false,
      };
    });
  }

  /** Derives the order header status from its tests. */
  async refreshOrderStatus(orderId: number) {
    const ots = await this.repo(OrderTest).findBy({ orderId });
    const live = ots.filter((o) => o.status !== OT.CANCELLED);
    let status = 'NEW';
    if (!live.length) status = 'CANCELLED';
    else if (live.every((o) => o.status === OT.SIGNED)) status = 'COMPLETED';
    else if (live.some((o) => o.status === OT.SIGNED)) status = 'PARTIAL';
    else if (live.some((o) => ![OT.ORDERED, OT.BILLED].includes(o.status as any))) status = 'IN_PROGRESS';
    await this.repo(LabOrder).update(orderId, { status });
    return status;
  }

  /** Derives a sample's status from the tests it carries. */
  async refreshSampleStatus(sampleId: number) {
    const sample = await this.repo(Sample).findOneBy({ id: sampleId });
    if (!sample || sample.status === 'REJECTED' || sample.status === 'COLLECTED') return;
    const ots = (await this.repo(OrderTest).findBy({ sampleId })).filter((o) => o.status !== OT.CANCELLED);
    let status = 'ACCESSIONED';
    if (ots.length && ots.every((o) => o.status === OT.SIGNED)) status = 'COMPLETED';
    else if (ots.length && ots.every((o) => o.status === OT.OUTSOURCED)) status = 'SENT_OUT';
    else if (ots.some((o) => o.status !== OT.ACCESSIONED)) status = 'IN_PROCESS';
    if (status !== sample.status) await this.repo(Sample).update(sampleId, { status });
  }
}
