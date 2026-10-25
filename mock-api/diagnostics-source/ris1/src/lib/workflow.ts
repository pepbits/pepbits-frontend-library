import { get, insert, now, run, tx, update, Row } from './db';
import { newAccession, newInvoiceNo } from './ids';
import { audit } from './audit';
import { emit } from './outbound';
import { HttpError } from './http';
import type { User } from './session';

export const STATUSES = ['ORDERED', 'SCHEDULED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'PRELIMINARY', 'FINAL'] as const;
export const PRIORITIES = ['STAT', 'URGENT', 'ROUTINE'] as const;

export type NewOrder = {
  patient_id: number;
  procedure_id: number;
  priority?: string;
  patient_class?: string;
  clinical_history?: string;
  reason?: string;
  referrer_id?: number | null;
  scheduled_at?: string | null;
  placer_order_no?: string | null;
  accession?: string | null;
  source?: string;
  source_system?: string | null;
  payer?: string;
  discount?: number;
  ordered_at?: string;
};

export function createOrder(input: NewOrder, user: Partial<User> | null, opts: { silent?: boolean } = {}): number {
  const patient = get('SELECT id FROM patients WHERE id = ?', input.patient_id);
  if (!patient) throw new HttpError(400, 'Choose a registered patient before ordering');
  const proc = get('SELECT * FROM procedures WHERE id = ? AND active = 1', input.procedure_id);
  if (!proc) throw new HttpError(400, 'Choose an active procedure from the test master');
  const priority = (input.priority || 'ROUTINE').toUpperCase();
  if (!PRIORITIES.includes(priority as any)) throw new HttpError(400, `Priority must be one of ${PRIORITIES.join(', ')}`);
  if (input.accession && get('SELECT id FROM orders WHERE accession = ?', input.accession))
    throw new HttpError(409, `Accession ${input.accession} already exists`);

  const id = tx(() => {
    const orderedAt = input.ordered_at || now();
    const accession = input.accession || newAccession(new Date(orderedAt));
    const orderId = insert('orders', {
      accession,
      placer_order_no: input.placer_order_no || null,
      patient_id: input.patient_id,
      procedure_id: input.procedure_id,
      modality_code: proc.modality_code,
      priority,
      status: input.scheduled_at ? 'SCHEDULED' : 'ORDERED',
      patient_class: input.patient_class || 'OP',
      clinical_history: input.clinical_history,
      reason: input.reason,
      referrer_id: input.referrer_id || null,
      source: input.source || 'RIS',
      source_system: input.source_system || null,
      ordered_at: orderedAt,
      scheduled_at: input.scheduled_at || null,
      created_by: user?.id ?? null,
    });
    const discount = Math.max(0, Number(input.discount || 0));
    const tax = 0;
    insert('invoices', {
      invoice_no: newInvoiceNo(),
      order_id: orderId,
      payer: input.payer || 'SELF',
      amount: proc.price,
      discount,
      tax,
      net: Math.max(0, proc.price - discount + tax),
      paid: 0,
      status: proc.price - discount > 0 ? 'UNPAID' : 'PAID',
      created_at: orderedAt,
    });
    audit(user, 'ORDER_CREATED', 'order', orderId, { accession, procedure: proc.code, source: input.source || 'RIS' });
    return orderId;
  });
  if (!opts.silent) emit('ORDER_NEW', id);
  return id;
}

const ALLOWED: Record<string, string[]> = {
  schedule: ['ORDERED', 'SCHEDULED'],
  arrive: ['ORDERED', 'SCHEDULED'],
  start: ['ARRIVED', 'SCHEDULED', 'ORDERED'],
  complete: ['IN_PROGRESS'],
  cancel: ['ORDERED', 'SCHEDULED', 'ARRIVED', 'IN_PROGRESS'],
  assign: ['ORDERED', 'SCHEDULED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'PRELIMINARY'],
  update: ['ORDERED', 'SCHEDULED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'PRELIMINARY'],
  revert_arrival: ['ARRIVED'],
};

export function transition(orderId: number, action: string, data: Row, user: User, opts: { silent?: boolean } = {}) {
  const o = get('SELECT * FROM orders WHERE id = ?', orderId);
  if (!o) throw new HttpError(404, 'Order not found');
  const allowed = ALLOWED[action];
  if (!allowed) throw new HttpError(400, `Unknown action "${action}"`);
  if (!allowed.includes(o.status)) throw new HttpError(409, `Cannot ${action.replace('_', ' ')} an order that is ${o.status.toLowerCase().replace('_', ' ')}`);
  const t = now();
  let event: Parameters<typeof emit>[0] | null = null;

  switch (action) {
    case 'schedule':
      if (!data.scheduled_at) throw new HttpError(400, 'Pick a date and time');
      update('orders', orderId, { status: 'SCHEDULED', scheduled_at: data.scheduled_at, room: data.room });
      event = 'ORDER_UPDATE';
      break;
    case 'arrive':
      update('orders', orderId, { status: 'ARRIVED', arrived_at: t });
      event = 'ORDER_UPDATE';
      break;
    case 'revert_arrival':
      update('orders', orderId, { status: o.scheduled_at ? 'SCHEDULED' : 'ORDERED', arrived_at: null });
      break;
    case 'start':
      update('orders', orderId, {
        status: 'IN_PROGRESS', arrived_at: o.arrived_at || t, exam_started_at: t,
        technologist_id: data.technologist_id || user.id, room: data.room || o.room,
      });
      event = 'ORDER_UPDATE';
      break;
    case 'complete': {
      const images = get<{ n: number }>('SELECT COUNT(*) n FROM instances i JOIN studies s ON s.id = i.study_id WHERE s.order_id = ?', orderId)!.n;
      if (!images && !data.force) throw new HttpError(409, 'No images have been received for this accession yet. Acquire or upload images, or complete without images.');
      update('orders', orderId, {
        status: 'COMPLETED', exam_completed_at: t,
        contrast_used: data.contrast_used, dose_ctdivol: data.dose_ctdivol ? Number(data.dose_ctdivol) : null,
        dose_dlp: data.dose_dlp ? Number(data.dose_dlp) : null, tech_notes: data.tech_notes,
        technologist_id: o.technologist_id || user.id,
      });
      event = 'EXAM_COMPLETE';
      break;
    }
    case 'cancel':
      if (!data.reason) throw new HttpError(400, 'Give a cancellation reason');
      update('orders', orderId, { status: 'CANCELLED', cancelled_at: t, cancel_reason: data.reason });
      run("UPDATE invoices SET status = CASE WHEN paid > 0 THEN 'REFUNDED' ELSE 'CANCELLED' END WHERE order_id = ?", orderId);
      event = 'ORDER_CANCEL';
      break;
    case 'assign':
      update('orders', orderId, { radiologist_id: data.radiologist_id || null });
      break;
    case 'update':
      update('orders', orderId, {
        priority: data.priority && PRIORITIES.includes(data.priority) ? data.priority : undefined,
        clinical_history: data.clinical_history,
        reason: data.reason,
        referrer_id: data.referrer_id,
      });
      event = 'ORDER_UPDATE';
      break;
  }
  audit(user, `ORDER_${action.toUpperCase()}`, 'order', orderId, { from: o.status, ...data });
  if (event && !opts.silent) {
    emit(event, orderId);
    if (event === 'EXAM_COMPLETE') emit('STUDY_ROUTE', orderId);
  }
}

export function recordPayment(invoiceId: number, amount: number, mode: string, reference: string | null, user: User) {
  const inv = get('SELECT * FROM invoices WHERE id = ?', invoiceId);
  if (!inv) throw new HttpError(404, 'Invoice not found');
  if (inv.status === 'CANCELLED') throw new HttpError(409, 'This invoice was cancelled with its order');
  if (!(amount > 0)) throw new HttpError(400, 'Enter an amount greater than zero');
  const balance = inv.net - inv.paid;
  if (amount > balance + 0.001) throw new HttpError(400, `Amount exceeds the balance of ${balance.toFixed(2)}`);
  tx(() => {
    insert('payments', { invoice_id: invoiceId, amount, mode, reference, received_by: user.id, received_at: now() });
    const paid = inv.paid + amount;
    update('invoices', invoiceId, { paid, status: paid >= inv.net - 0.001 ? 'PAID' : 'PARTIAL' });
  });
  audit(user, 'PAYMENT', 'invoice', invoiceId, { amount, mode });
}
