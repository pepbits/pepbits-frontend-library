import { Body, Controller, Get, Injectable, Param, Post, Query } from '@nestjs/common';
import { Db } from '../db/database.service';
import { CurrentUser, Roles, SessionUser } from '../common/auth';
import { bad, must, paging } from '../common/util';

export const ITEM_FLOW = ['ORDERED', 'BILLED', 'COLLECTED', 'RECEIVED', 'OUTSOURCE_PENDING', 'OUTSOURCED', 'IN_PROCESS', 'RESULTED', 'VALIDATED', 'SIGNED', 'AMENDING', 'CANCELLED'];
export const PRIORITIES = ['ROUTINE', 'URGENT', 'STAT'];

export interface OrderInput {
  patientId: number;
  encounterId?: number;
  encounter?: { type?: string; locationId?: number; doctorId?: number; externalEncounterNo?: string; bed?: string };
  priority?: string;
  doctorId?: number;
  clinicalInfo?: string;
  diagnosis?: string;
  tests: { testId: number; bodySiteId?: number; externalLineNo?: string }[];
  autoBill?: boolean;
  payerType?: string;
}
export interface OrderContext {
  source?: string; facilityId?: number | null; externalOrderNo?: string | null; messageId?: number | null; skipBodySiteCheck?: boolean;
}

/** Recomputes the order header status from its items. */
export function refreshOrderStatus(db: Db, orderId: number) {
  const items = db.all<{ status: string }>('SELECT status FROM order_items WHERE order_id = ?', orderId);
  const live = items.filter((i) => i.status !== 'CANCELLED');
  let status = 'ACTIVE';
  if (!live.length) status = 'CANCELLED';
  else if (live.every((i) => i.status === 'SIGNED')) status = 'COMPLETED';
  else if (live.some((i) => i.status === 'SIGNED')) status = 'PARTIAL';
  db.run('UPDATE orders SET status = ? WHERE id = ?', status, orderId);
}

@Injectable()
export class OrdersService {
  constructor(private readonly db: Db) {}

  create(input: OrderInput, userId: number | null, ctx: OrderContext = {}) {
    if (!input.tests?.length) bad('Select at least one test');
    const priority = input.priority || 'ROUTINE';
    if (!PRIORITIES.includes(priority)) bad(`Priority must be ${PRIORITIES.join(', ')}`);
    must(this.db.get('SELECT id FROM patients WHERE id = ?', input.patientId), 'Patient');

    return this.db.tx(() => {
      let encounterId = input.encounterId ?? null;
      if (!encounterId) {
        const e = input.encounter || {};
        if (e.externalEncounterNo && ctx.facilityId) {
          encounterId = this.db.get('SELECT id FROM encounters WHERE facility_id = ? AND external_encounter_no = ? AND patient_id = ?',
            ctx.facilityId, e.externalEncounterNo, input.patientId)?.id ?? null;
        }
        if (!encounterId) {
          encounterId = this.db.insert('encounters', {
            encounter_no: this.db.nextNo('ENC', 7), patient_id: input.patientId, type: e.type || (ctx.facilityId ? 'EXTERNAL' : 'OP'),
            facility_id: ctx.facilityId ?? null, location_id: e.locationId, doctor_id: e.doctorId ?? input.doctorId, external_encounter_no: e.externalEncounterNo, bed: e.bed,
          });
        }
      }
      const orderId = this.db.insert('orders', {
        order_no: this.db.nextNo('ORD', 7), patient_id: input.patientId, encounter_id: encounterId, facility_id: ctx.facilityId ?? null,
        source: ctx.source || 'INTERNAL', external_order_no: ctx.externalOrderNo ?? null, priority, doctor_id: input.doctorId,
        clinical_info: input.clinicalInfo, diagnosis: input.diagnosis, message_id: ctx.messageId ?? null, created_by: userId,
      });
      this.addItems(orderId, input.tests, priority, ctx.skipBodySiteCheck);
      if (input.autoBill !== false) this.bill(orderId, userId, input.payerType);
      this.db.audit(userId, 'CREATE', 'orders', orderId, { tests: input.tests.length, source: ctx.source || 'INTERNAL' });
      return orderId;
    });
  }

  addItems(orderId: number, tests: OrderInput['tests'], priority: string, skipBodySiteCheck = false) {
    const seen = new Set<number>();
    for (const t of tests) {
      if (seen.has(t.testId)) continue;
      seen.add(t.testId);
      const test = must(this.db.get('SELECT * FROM m_tests WHERE id = ? AND active = 1', t.testId), `Test ${t.testId}`);
      if (test.body_site_required && !t.bodySiteId && !skipBodySiteCheck) bad(`${test.name} requires a body site`);
      this.db.insert('order_items', {
        order_id: orderId, test_id: test.id, priority, price: test.price || 0, body_site_id: t.bodySiteId ?? null,
        is_outsourced: test.is_outsourced ? 1 : 0, outsource_lab_id: test.outsource_lab_id, external_line_no: t.externalLineNo ?? null,
      });
    }
  }

  /** Creates (or extends) the bill for all un-billed items of the order. */
  bill(orderId: number, userId: number | null, payerType?: string) {
    const order = must(this.db.get('SELECT * FROM orders WHERE id = ?', orderId), 'Order');
    const pending = this.db.all('SELECT * FROM order_items WHERE order_id = ? AND status = ?', orderId, 'ORDERED');
    if (!pending.length) return this.db.get('SELECT * FROM bills WHERE order_id = ?', orderId);
    let bill = this.db.get('SELECT * FROM bills WHERE order_id = ?', orderId);
    if (!bill) {
      const payer = payerType || (order.facility_id ? 'FACILITY' : 'SELF');
      const id = this.db.insert('bills', { bill_no: this.db.nextNo('BIL', 7), order_id: orderId, patient_id: order.patient_id, payer_type: payer, facility_id: order.facility_id, created_by: userId });
      bill = this.db.get('SELECT * FROM bills WHERE id = ?', id);
    }
    for (const it of pending) {
      this.db.insert('bill_items', { bill_id: bill.id, order_item_id: it.id, test_id: it.test_id, amount: it.price });
      this.db.run("UPDATE order_items SET status = 'BILLED' WHERE id = ?", it.id);
    }
    this.recompute(bill.id);
    return this.db.get('SELECT * FROM bills WHERE id = ?', bill.id);
  }

  recompute(billId: number) {
    const bill = this.db.get('SELECT * FROM bills WHERE id = ?', billId);
    const gross = this.db.get("SELECT IFNULL(SUM(amount),0) s FROM bill_items WHERE bill_id = ? AND status = 'ACTIVE'", billId).s;
    const pct = bill.facility_id ? this.db.get('SELECT discount_percent d FROM m_facilities WHERE id = ?', bill.facility_id)?.d || 0 : 0;
    const discount = Math.round(gross * pct) / 100;
    const net = Math.round((gross - discount) * 100) / 100;
    const paid = this.db.get('SELECT IFNULL(SUM(amount),0) s FROM payments WHERE bill_id = ?', billId).s;
    const status = bill.payer_type !== 'SELF' && paid === 0 ? 'CREDIT' : paid <= 0 ? 'UNPAID' : paid + 0.001 < net ? 'PARTIAL' : 'PAID';
    this.db.update('bills', billId, { gross, discount, net, paid, status });
  }

  get(id: number) {
    const o = must(this.db.get(`SELECT o.*, p.mrn, p.first_name, p.last_name, p.dob, p.gender, p.phone, e.encounter_no, e.type encounter_type,
      e.external_encounter_no, l.name location, d.name doctor, f.name facility, u.full_name created_by_name
      FROM orders o JOIN patients p ON p.id = o.patient_id LEFT JOIN encounters e ON e.id = o.encounter_id LEFT JOIN m_locations l ON l.id = e.location_id
      LEFT JOIN m_doctors d ON d.id = o.doctor_id LEFT JOIN m_facilities f ON f.id = o.facility_id LEFT JOIN users u ON u.id = o.created_by WHERE o.id = ?`, id), 'Order');
    o.items = this.db.all(`SELECT i.*, t.code test_code, t.name test_name, dep.name department, s.sample_no, s.status sample_status, bs.name body_site,
      ol.name outsource_lab, sg.full_name signed_by_name
      FROM order_items i JOIN m_tests t ON t.id = i.test_id LEFT JOIN m_departments dep ON dep.id = t.department_id LEFT JOIN samples s ON s.id = i.sample_id
      LEFT JOIN m_body_sites bs ON bs.id = i.body_site_id LEFT JOIN m_outsource_labs ol ON ol.id = i.outsource_lab_id LEFT JOIN users sg ON sg.id = i.signed_by
      WHERE i.order_id = ? ORDER BY i.id`, id);
    o.bill = this.db.get('SELECT * FROM bills WHERE order_id = ?', id) || null;
    o.payments = o.bill ? this.db.all('SELECT py.*, u.full_name user FROM payments py LEFT JOIN users u ON u.id = py.created_by WHERE bill_id = ? ORDER BY py.id', o.bill.id) : [];
    o.publications = this.db.all(`SELECT id, order_item_id, event, format, mode, status, attempts, created_at, delivered_at, acked_at, last_error FROM result_publications WHERE order_id = ? ORDER BY id DESC`, id);
    return o;
  }

  list(q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds: string[] = [];
    const params: any[] = [];
    if (q.q) {
      conds.push(`(o.order_no LIKE ? OR o.external_order_no LIKE ? OR p.mrn LIKE ? OR p.first_name || ' ' || IFNULL(p.last_name,'') LIKE ?)`);
      params.push(...Array(4).fill(`%${q.q}%`));
    }
    for (const [k, col] of [['status', 'o.status'], ['source', 'o.source'], ['priority', 'o.priority'], ['facilityId', 'o.facility_id'], ['patientId', 'o.patient_id']]) {
      if (q[k]) { conds.push(`${col} = ?`); params.push(q[k]); }
    }
    if (q.from) { conds.push('date(o.created_at) >= date(?)'); params.push(q.from); }
    if (q.to) { conds.push('date(o.created_at) <= date(?)'); params.push(q.to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const total = this.db.get(`SELECT COUNT(*) c FROM orders o JOIN patients p ON p.id = o.patient_id ${where}`, ...params).c;
    const data = this.db.all(`SELECT o.id, o.order_no, o.external_order_no, o.source, o.priority, o.status, o.created_at, p.id patient_id, p.mrn,
      p.first_name, p.last_name, p.gender, p.dob, f.code facility, b.bill_no, b.status bill_status, b.net,
      (SELECT GROUP_CONCAT(t.code, ', ') FROM order_items i JOIN m_tests t ON t.id = i.test_id WHERE i.order_id = o.id AND i.status <> 'CANCELLED') tests,
      (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id AND i.status = 'SIGNED') signed,
      (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id AND i.status <> 'CANCELLED') total_items
      FROM orders o JOIN patients p ON p.id = o.patient_id LEFT JOIN m_facilities f ON f.id = o.facility_id LEFT JOIN bills b ON b.order_id = o.id
      ${where} ORDER BY o.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    return { data, total, page, pageSize };
  }

  cancelItem(itemId: number, reason: string, userId: number | null) {
    if (!reason?.trim()) bad('A cancellation reason is required');
    const it = must(this.db.get('SELECT * FROM order_items WHERE id = ?', itemId), 'Order item');
    if (['RESULTED', 'VALIDATED', 'SIGNED', 'AMENDING', 'CANCELLED'].includes(it.status)) bad(`Cannot cancel a test in status ${it.status}`);
    this.db.tx(() => {
      this.db.run("UPDATE order_items SET status = 'CANCELLED', cancelled_reason = ? WHERE id = ?", reason, itemId);
      this.db.run("UPDATE bill_items SET status = 'CANCELLED' WHERE order_item_id = ?", itemId);
      this.db.run("UPDATE instrument_orders SET status = 'CANCELLED' WHERE order_item_id = ?", itemId);
      const bill = this.db.get('SELECT id FROM bills WHERE order_id = ?', it.order_id);
      if (bill) this.recompute(bill.id);
      refreshOrderStatus(this.db, it.order_id);
      this.db.audit(userId, 'CANCEL', 'order_items', itemId, reason);
    });
  }
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly svc: OrdersService, private readonly db: Db) {}

  @Get()
  list(@Query() q: any) {
    return this.svc.list(q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(Number(id));
  }

  @Post()
  @Roles('FRONT_DESK', 'PHLEBOTOMIST', 'TECHNOLOGIST', 'PATHOLOGIST')
  create(@Body() b: OrderInput, @CurrentUser() u: SessionUser) {
    return this.svc.get(this.svc.create(b, u.id));
  }

  @Post(':id/items')
  addItems(@Param('id') id: string, @Body() b: { tests: OrderInput['tests']; autoBill?: boolean }, @CurrentUser() u: SessionUser) {
    const o = must(this.db.get('SELECT * FROM orders WHERE id = ?', Number(id)), 'Order');
    this.db.tx(() => {
      this.svc.addItems(o.id, b.tests || [], o.priority);
      if (b.autoBill !== false) this.svc.bill(o.id, u.id);
      refreshOrderStatus(this.db, o.id);
    });
    return this.svc.get(o.id);
  }

  @Post(':id/bill')
  bill(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    this.db.tx(() => this.svc.bill(Number(id), u.id));
    return this.svc.get(Number(id));
  }

  @Post('items/:itemId/cancel')
  cancel(@Param('itemId') itemId: string, @Body() b: { reason: string }, @CurrentUser() u: SessionUser) {
    this.svc.cancelItem(Number(itemId), b.reason, u.id);
    return { ok: true };
  }
}

@Controller('billing')
export class BillingController {
  constructor(private readonly db: Db, private readonly orders: OrdersService) {}

  @Get()
  list(@Query() q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds: string[] = [];
    const params: any[] = [];
    if (q.status) { conds.push('b.status = ?'); params.push(q.status); }
    if (q.payerType) { conds.push('b.payer_type = ?'); params.push(q.payerType); }
    if (q.q) { conds.push(`(b.bill_no LIKE ? OR o.order_no LIKE ? OR p.mrn LIKE ? OR p.first_name || ' ' || IFNULL(p.last_name,'') LIKE ?)`); params.push(...Array(4).fill(`%${q.q}%`)); }
    if (q.from) { conds.push('date(b.created_at) >= date(?)'); params.push(q.from); }
    if (q.to) { conds.push('date(b.created_at) <= date(?)'); params.push(q.to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const base = `FROM bills b JOIN orders o ON o.id = b.order_id JOIN patients p ON p.id = b.patient_id LEFT JOIN m_facilities f ON f.id = b.facility_id ${where}`;
    const total = this.db.get(`SELECT COUNT(*) c ${base}`, ...params).c;
    const sums = this.db.get(`SELECT IFNULL(SUM(b.net),0) net, IFNULL(SUM(b.paid),0) paid ${base}`, ...params);
    const data = this.db.all(`SELECT b.*, o.order_no, p.mrn, p.first_name, p.last_name, f.name facility ${base} ORDER BY b.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    return { data, total, page, pageSize, sums };
  }

  @Get(':id')
  get(@Param('id') id: string) {
    const b = must(this.db.get(`SELECT b.*, o.order_no, p.mrn, p.first_name, p.last_name, f.name facility FROM bills b JOIN orders o ON o.id = b.order_id
      JOIN patients p ON p.id = b.patient_id LEFT JOIN m_facilities f ON f.id = b.facility_id WHERE b.id = ?`, Number(id)), 'Bill');
    b.items = this.db.all('SELECT bi.*, t.code, t.name FROM bill_items bi JOIN m_tests t ON t.id = bi.test_id WHERE bill_id = ?', b.id);
    b.payments = this.db.all('SELECT py.*, u.full_name user FROM payments py LEFT JOIN users u ON u.id = py.created_by WHERE bill_id = ?', b.id);
    return b;
  }

  @Post(':id/payments')
  @Roles('FRONT_DESK', 'PHLEBOTOMIST')
  pay(@Param('id') id: string, @Body() b: { amount: number; mode: string; reference?: string }, @CurrentUser() u: SessionUser) {
    const bill = must(this.db.get('SELECT * FROM bills WHERE id = ?', Number(id)), 'Bill');
    const amount = Number(b.amount);
    if (!(amount > 0)) bad('Amount must be greater than zero');
    if (!['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'INSURANCE', 'REFUND'].includes(b.mode)) bad('Invalid payment mode');
    const signed = b.mode === 'REFUND' ? -amount : amount;
    if (signed > 0 && bill.paid + signed > bill.net + 0.001) bad(`Amount exceeds the balance of ${(bill.net - bill.paid).toFixed(2)}`);
    this.db.tx(() => {
      this.db.insert('payments', { bill_id: bill.id, amount: signed, mode: b.mode, reference: b.reference, created_by: u.id });
      this.orders.recompute(bill.id);
      this.db.audit(u.id, 'PAYMENT', 'bills', bill.id, { amount: signed, mode: b.mode });
    });
    return this.get(id);
  }
}
