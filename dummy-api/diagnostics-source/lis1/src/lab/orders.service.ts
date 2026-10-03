import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { In, Like } from 'typeorm';
import {
  Doctor, Invoice, InvoiceItem, LabOrder, LabTest, OrderTest, OT, Patient, Payment, Profile, Report, Sample,
} from '../entities';
import { SequenceService } from '../common/sequence.service';
import { AuthUser } from '../common/auth';
import { ageOf, LookupService, patientName } from './lookup.service';

export interface CreateOrderDto {
  patientId: number;
  doctorId?: number;
  priority?: 'ROUTINE' | 'STAT';
  testIds?: number[];
  profileIds?: number[];
  clinicalNotes?: string;
  diagnosis?: string;
  patientLocation?: string;
  source?: 'INTERNAL' | 'EXTERNAL';
  externalSystemId?: number;
  externalOrderNo?: string;
  /** testId -> bodySiteId for tests that require an anatomical site */
  bodySites?: Record<string, number>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class PatientsService {
  constructor(private lookup: LookupService, private seq: SequenceService) {}

  async list(q?: string, take = 200) {
    const repo = this.lookup.repo(Patient);
    const where = q
      ? ['mrn', 'firstName', 'lastName', 'phone', 'nationalId', 'externalPatientId'].map((f) => ({ [f]: Like(`%${q}%`) }))
      : {};
    const rows = await repo.find({ where, order: { id: 'DESC' }, take });
    return rows.map((p) => ({ ...p, fullName: patientName(p), age: ageOf(p.dob)?.label }));
  }

  async get(id: number) {
    const p = await this.lookup.repo(Patient).findOneBy({ id });
    if (!p) throw new NotFoundException('Patient not found');
    const orders = await this.lookup.repo(LabOrder).find({ where: { patientId: id }, order: { id: 'DESC' } });
    return { ...p, fullName: patientName(p), age: ageOf(p.dob)?.label, orders };
  }

  async save(body: Partial<Patient>, id?: number) {
    const repo = this.lookup.repo(Patient);
    if (!body.firstName && !id) throw new BadRequestException('First name is required');
    const clean: any = { ...body };
    delete clean.id; delete clean.createdAt; delete clean.updatedAt; delete clean.orders;
    delete clean.fullName; delete clean.age;
    for (const k of Object.keys(clean)) if (clean[k] === '') clean[k] = null;
    if (id) {
      await repo.update(id, clean);
      return this.get(id);
    }
    if (!clean.mrn) clean.mrn = await this.seq.next('MRN', false, 7);
    if (await repo.findOneBy({ mrn: clean.mrn })) throw new BadRequestException(`MRN ${clean.mrn} already exists`);
    const saved = await repo.save(repo.create(clean as Patient));
    return this.get(saved.id);
  }
}

@Injectable()
export class OrdersService {
  constructor(private lookup: LookupService, private seq: SequenceService) {}

  /** Expands profiles into tests, prices them, stamps TAT due time and creates the order. */
  async create(dto: CreateOrderDto, user?: AuthUser) {
    const patient = await this.lookup.repo(Patient).findOneBy({ id: dto.patientId });
    if (!patient) throw new BadRequestException('Select a patient');
    if (!dto.testIds?.length && !dto.profileIds?.length) throw new BadRequestException('Add at least one test or profile');
    if (dto.doctorId && !(await this.lookup.repo(Doctor).findOneBy({ id: dto.doctorId })))
      throw new BadRequestException('Referring doctor not found');

    const priority = dto.priority === 'STAT' ? 'STAT' : 'ROUTINE';
    const lines: { testId: number; profileId?: number; price: number }[] = [];
    const seen = new Set<number>();

    const profiles = dto.profileIds?.length ? await this.lookup.repo(Profile).findBy({ id: In(dto.profileIds), active: true }) : [];
    for (const pr of profiles) {
      const ids = (pr.testIds || []).filter((t) => !seen.has(t));
      if (!ids.length) continue;
      const share = round2(pr.price / ids.length);
      ids.forEach((tid, i) => {
        seen.add(tid);
        const price = i === ids.length - 1 ? round2(pr.price - share * (ids.length - 1)) : share;
        lines.push({ testId: tid, profileId: pr.id, price });
      });
    }
    const loose = (dto.testIds || []).filter((t) => !seen.has(t));
    const allIds = [...new Set([...lines.map((l) => l.testId), ...loose])];
    const tests = await this.lookup.repo(LabTest).findBy({ id: In(allIds) });
    const tMap = new Map(tests.map((t) => [t.id, t]));
    const inactive = allIds.filter((id) => !tMap.get(id)?.active);
    if (inactive.length) throw new BadRequestException(`Tests not available: ${inactive.join(', ')}`);
    for (const tid of loose) { seen.add(tid); lines.push({ testId: tid, price: tMap.get(tid).price }); }
    const missingSite = tests.filter((t) => t.requiresBodySite && !dto.bodySites?.[t.id]);
    if (missingSite.length) throw new BadRequestException(`Select a body site for: ${missingSite.map((t) => t.name).join(', ')}`);

    return this.lookup.ds.transaction(async (m) => {
      const order = await m.save(m.create(LabOrder, {
        orderNo: await this.seq.next('ORD'),
        patientId: patient.id,
        doctorId: dto.doctorId || null,
        priority,
        source: dto.source || 'INTERNAL',
        externalSystemId: dto.externalSystemId || null,
        externalOrderNo: dto.externalOrderNo || null,
        clinicalNotes: dto.clinicalNotes || null,
        diagnosis: dto.diagnosis || null,
        patientLocation: dto.patientLocation || null,
        status: 'NEW',
        createdBy: user?.id,
      }));
      const now = Date.now();
      for (const l of lines) {
        const t = tMap.get(l.testId);
        const mins = priority === 'STAT' ? t.tatStatMinutes : t.tatRoutineMinutes;
        await m.save(m.create(OrderTest, {
          orderId: order.id, testId: t.id, profileId: l.profileId || null, price: l.price,
          status: OT.ORDERED, dueAt: new Date(now + (mins || 0) * 60000),
          isOutsourced: t.isOutsourced, externalLabId: t.isOutsourced ? t.externalLabId : null,
          bodySiteId: dto.bodySites?.[t.id] || t.bodySiteId || null,
        }));
      }
      await this.lookup.audit('order', order.id, 'CREATE', { tests: lines.length, priority }, user?.id);
      return order;
    });
  }

  async list(q: { status?: string; q?: string; source?: string; from?: string; to?: string; patientId?: string }) {
    const qb = this.lookup.repo(LabOrder).createQueryBuilder('o')
      .leftJoin(Patient, 'p', 'p.id = o.patientId')
      .select('o.*').addSelect("p.firstName || ' ' || COALESCE(p.lastName,'')", 'patientName').addSelect('p.mrn', 'mrn')
      .orderBy('o.id', 'DESC').limit(300);
    if (q.status) qb.andWhere('o.status = :s', { s: q.status });
    if (q.source) qb.andWhere('o.source = :src', { src: q.source });
    if (q.patientId) qb.andWhere('o.patientId = :pid', { pid: q.patientId });
    if (q.from) qb.andWhere('o.createdAt >= :from', { from: q.from });
    if (q.to) qb.andWhere('o.createdAt <= :to', { to: `${q.to} 23:59:59` });
    if (q.q) qb.andWhere('(o.orderNo LIKE :t OR p.mrn LIKE :t OR p.firstName LIKE :t OR p.lastName LIKE :t OR o.externalOrderNo LIKE :t)', { t: `%${q.q}%` });
    const orders = await qb.getRawMany();
    if (!orders.length) return [];
    const ids = orders.map((o) => o.id);
    const ots = await this.lookup.repo(OrderTest).findBy({ orderId: In(ids) });
    const invoices = await this.lookup.repo(Invoice).findBy({ orderId: In(ids) });
    return orders.map((o) => {
      const mine = ots.filter((t) => t.orderId === o.id);
      const counts: Record<string, number> = {};
      mine.forEach((t) => (counts[t.status] = (counts[t.status] || 0) + 1));
      const inv = invoices.filter((i) => i.orderId === o.id && i.status !== 'CANCELLED');
      return {
        ...o,
        testCount: mine.filter((t) => t.status !== OT.CANCELLED).length,
        statusCounts: counts,
        total: round2(mine.filter((t) => t.status !== OT.CANCELLED).reduce((s, t) => s + t.price, 0)),
        unbilled: mine.filter((t) => !t.isBilled && t.status !== OT.CANCELLED).length,
        balance: round2(inv.reduce((s, i) => s + i.netAmount - i.paidAmount, 0)),
      };
    });
  }

  async get(id: number) {
    const order = await this.lookup.repo(LabOrder).findOneBy({ id });
    if (!order) throw new NotFoundException('Order not found');
    const ots = await this.lookup.repo(OrderTest).find({ where: { orderId: id }, order: { id: 'ASC' } });
    const tests = await this.lookup.enrich(ots);
    const patient = await this.lookup.repo(Patient).findOneBy({ id: order.patientId });
    const doctor = order.doctorId ? await this.lookup.repo(Doctor).findOneBy({ id: order.doctorId }) : null;
    const invoices = await this.lookup.repo(Invoice).find({ where: { orderId: id }, order: { id: 'ASC' } });
    const report = await this.lookup.repo(Report).findOneBy({ orderId: id });
    const sampleIds = [...new Set(ots.map((o) => o.sampleId).filter(Boolean))];
    const samples = sampleIds.length ? await this.lookup.repo(Sample).findBy({ id: In(sampleIds) }) : [];
    return {
      ...order, patient: { ...patient, fullName: patientName(patient), age: ageOf(patient.dob, order.createdAt)?.label },
      doctor, tests, invoices, report, samples,
    };
  }

  async addTests(orderId: number, testIds: number[], user: AuthUser) {
    const order = await this.lookup.repo(LabOrder).findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');
    const existing = (await this.lookup.repo(OrderTest).findBy({ orderId })).filter((o) => o.status !== OT.CANCELLED).map((o) => o.testId);
    const tests = await this.lookup.repo(LabTest).findBy({ id: In(testIds.filter((t) => !existing.includes(t))), active: true });
    if (!tests.length) throw new BadRequestException('These tests are already on the order');
    const now = Date.now();
    for (const t of tests) {
      const mins = order.priority === 'STAT' ? t.tatStatMinutes : t.tatRoutineMinutes;
      await this.lookup.repo(OrderTest).save({
        orderId, testId: t.id, price: t.price, status: OT.ORDERED, dueAt: new Date(now + mins * 60000),
        isOutsourced: t.isOutsourced, externalLabId: t.isOutsourced ? t.externalLabId : null,
      });
    }
    await this.lookup.audit('order', orderId, 'ADD_TESTS', { testIds: tests.map((t) => t.id) }, user.id);
    await this.lookup.refreshOrderStatus(orderId);
    return this.get(orderId);
  }

  async cancelTest(orderTestId: number, reason: string, user: AuthUser) {
    const repo = this.lookup.repo(OrderTest);
    const ot = await repo.findOneBy({ id: orderTestId });
    if (!ot) throw new NotFoundException('Order test not found');
    if ([OT.RESULTED, OT.VALIDATED, OT.SIGNED, OT.AMENDING, OT.CANCELLED].includes(ot.status as any))
      throw new BadRequestException(`A ${ot.status.toLowerCase()} test cannot be cancelled`);
    if (!reason) throw new BadRequestException('Give a cancellation reason');
    await repo.update(ot.id, { status: OT.CANCELLED, cancelReason: reason });
    if (ot.isBilled) {
      const item = await this.lookup.repo(InvoiceItem).findOneBy({ orderTestId: ot.id });
      if (item) {
        const test = await this.lookup.repo(LabTest).findOneBy({ id: ot.testId });
        await this.lookup.repo(InvoiceItem).save({ invoiceId: item.invoiceId, orderTestId: ot.id, description: `Cancelled: ${test?.name}`, amount: -item.amount });
        await BillingService.recalculate(this.lookup, item.invoiceId);
      }
    }
    await this.lookup.audit('order_test', ot.id, 'CANCEL', reason, user.id);
    await this.lookup.refreshOrderStatus(ot.orderId);
    if (ot.sampleId) await this.lookup.refreshSampleStatus(ot.sampleId);
    return this.get(ot.orderId);
  }
}

@Injectable()
export class BillingService {
  constructor(private lookup: LookupService, private seq: SequenceService) {}

  static async recalculate(lookup: LookupService, invoiceId: number) {
    const inv = await lookup.repo(Invoice).findOneBy({ id: invoiceId });
    const items = await lookup.repo(InvoiceItem).findBy({ invoiceId });
    const payments = await lookup.repo(Payment).findBy({ invoiceId });
    const taxPct = parseFloat(await lookup.setting('billing.taxPercent', '0')) || 0;
    const gross = round2(items.reduce((s, i) => s + i.amount, 0));
    const discount = Math.min(inv.discountAmount, gross);
    const tax = round2(((gross - discount) * taxPct) / 100);
    const net = round2(gross - discount + tax);
    const paid = round2(payments.reduce((s, p) => s + (p.type === 'REFUND' ? -p.amount : p.amount), 0));
    const status = inv.status === 'CANCELLED' ? 'CANCELLED' : paid <= 0 ? (net <= 0 ? 'PAID' : 'UNPAID') : paid >= net ? 'PAID' : 'PARTIAL';
    await lookup.repo(Invoice).update(invoiceId, { grossAmount: gross, discountAmount: discount, taxAmount: tax, netAmount: net, paidAmount: paid, status });
  }

  async create(orderId: number, body: { discountAmount?: number; discountPercent?: number; payerType?: string; payerName?: string; notes?: string; payment?: { amount: number; mode: string; reference?: string } }, user: AuthUser) {
    const order = await this.lookup.repo(LabOrder).findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');
    const ots = (await this.lookup.repo(OrderTest).findBy({ orderId })).filter((o) => !o.isBilled && o.status !== OT.CANCELLED);
    if (!ots.length) throw new BadRequestException('Everything on this order is already billed');
    const tests = await this.lookup.repo(LabTest).findBy({ id: In(ots.map((o) => o.testId)) });
    const gross = round2(ots.reduce((s, o) => s + o.price, 0));
    const discount = body.discountPercent ? round2((gross * body.discountPercent) / 100) : round2(Number(body.discountAmount) || 0);
    if (discount < 0 || discount > gross) throw new BadRequestException('Discount must be between 0 and the gross amount');

    const invoice = await this.lookup.repo(Invoice).save({
      invoiceNo: await this.seq.next('INV'), orderId, patientId: order.patientId,
      payerType: body.payerType || 'SELF', payerName: body.payerName || null, discountAmount: discount,
      createdBy: user.id, notes: body.notes || null, status: 'UNPAID',
    });
    for (const ot of ots) {
      await this.lookup.repo(InvoiceItem).save({ invoiceId: invoice.id, orderTestId: ot.id, description: tests.find((t) => t.id === ot.testId)?.name, amount: ot.price });
      await this.lookup.repo(OrderTest).update(ot.id, { isBilled: true, status: ot.status === OT.ORDERED ? OT.BILLED : ot.status });
    }
    if (body.payment?.amount > 0) {
      await this.lookup.repo(Payment).save({ invoiceId: invoice.id, amount: body.payment.amount, mode: body.payment.mode || 'CASH', reference: body.payment.reference, receivedBy: user.id });
    }
    await BillingService.recalculate(this.lookup, invoice.id);
    await this.lookup.audit('invoice', invoice.id, 'CREATE', { orderId, gross, discount }, user.id);
    return this.get(invoice.id);
  }

  async addPayment(invoiceId: number, body: { amount: number; mode: string; reference?: string; type?: string }, user: AuthUser) {
    const inv = await this.lookup.repo(Invoice).findOneBy({ id: invoiceId });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status === 'CANCELLED') throw new BadRequestException('Invoice is cancelled');
    const amount = round2(Number(body.amount));
    if (!(amount > 0)) throw new BadRequestException('Enter an amount greater than zero');
    const type = body.type === 'REFUND' ? 'REFUND' : 'PAYMENT';
    if (type === 'REFUND' && amount > inv.paidAmount) throw new BadRequestException('Refund exceeds the amount paid');
    await this.lookup.repo(Payment).save({ invoiceId, amount, mode: body.mode || 'CASH', reference: body.reference, type, receivedBy: user.id });
    await BillingService.recalculate(this.lookup, invoiceId);
    return this.get(invoiceId);
  }

  async cancel(invoiceId: number, reason: string, user: AuthUser) {
    const inv = await this.lookup.repo(Invoice).findOneBy({ id: invoiceId });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.paidAmount > 0) throw new BadRequestException('Refund all payments before cancelling this invoice');
    const items = await this.lookup.repo(InvoiceItem).findBy({ invoiceId });
    for (const it of items.filter((i) => i.orderTestId && i.amount > 0)) {
      const ot = await this.lookup.repo(OrderTest).findOneBy({ id: it.orderTestId });
      if (ot) await this.lookup.repo(OrderTest).update(ot.id, { isBilled: false, status: ot.status === OT.BILLED ? OT.ORDERED : ot.status });
    }
    await this.lookup.repo(Invoice).update(invoiceId, { status: 'CANCELLED', notes: `${inv.notes || ''} Cancelled: ${reason}`.trim() });
    await this.lookup.audit('invoice', invoiceId, 'CANCEL', reason, user.id);
    return this.get(invoiceId);
  }

  async list(q: { status?: string; q?: string }) {
    const qb = this.lookup.repo(Invoice).createQueryBuilder('i')
      .leftJoin(Patient, 'p', 'p.id = i.patientId').leftJoin(LabOrder, 'o', 'o.id = i.orderId')
      .select('i.*').addSelect("p.firstName || ' ' || COALESCE(p.lastName,'')", 'patientName')
      .addSelect('p.mrn', 'mrn').addSelect('o.orderNo', 'orderNo')
      .orderBy('i.id', 'DESC').limit(300);
    if (q.status) qb.andWhere('i.status = :s', { s: q.status });
    if (q.q) qb.andWhere('(i.invoiceNo LIKE :t OR o.orderNo LIKE :t OR p.mrn LIKE :t OR p.firstName LIKE :t)', { t: `%${q.q}%` });
    return qb.getRawMany();
  }

  async get(id: number) {
    const inv = await this.lookup.repo(Invoice).findOneBy({ id });
    if (!inv) throw new NotFoundException('Invoice not found');
    const [items, payments, patient, order] = await Promise.all([
      this.lookup.repo(InvoiceItem).find({ where: { invoiceId: id }, order: { id: 'ASC' } }),
      this.lookup.repo(Payment).find({ where: { invoiceId: id }, order: { id: 'ASC' } }),
      this.lookup.repo(Patient).findOneBy({ id: inv.patientId }),
      this.lookup.repo(LabOrder).findOneBy({ id: inv.orderId }),
    ]);
    const lab = await this.lookup.settings('lab.');
    return { ...inv, items, payments, patient: { ...patient, fullName: patientName(patient) }, order, lab, currency: await this.lookup.setting('billing.currency', 'USD') };
  }
}
