import { Router } from 'express';
import crypto from 'node:crypto';
import { db, tx } from '../db.js';
import { can, requireRight } from '../lib/auth.js';
import {
  assertOpen, billPayload, insertReceipts, lifecycle, mustGetBill, recalcBill, setOffDeposits,
  settleOverpayment, validatePaymentRows,
} from '../lib/billing.js';
import { asyncRoute, audit, bad, conflict, nextNumber, notFound, nowIso, parseJson, pref, r2, requireFields } from '../lib/util.js';

const router = Router();

/* ---------------------------------------------------------------- list */
router.get('/bills', asyncRoute((req, res) => {
  const { q = '', status = '', type = '', insured = '', due = '', restriction = '', sort = 'updated', page = '1', size = '25' } = req.query;
  const where = [];
  const p = {};
  if (q) {
    where.push('(b.bill_no LIKE @q OR b.mr_no LIKE @q OR pt.name LIKE @q OR b.visit_id LIKE @q OR pt.phone LIKE @q)');
    p.q = `%${q}%`;
  }
  if (status) { where.push(`b.status IN (${status.split(',').map((s, i) => `@s${i}`).join(',')})`); status.split(',').forEach((s, i) => { p[`s${i}`] = s; }); }
  if (type) { where.push('b.bill_type = @type'); p.type = type; }
  if (restriction) { where.push('b.restriction_type = @restriction'); p.restriction = restriction; }
  if (insured === '1') where.push('b.is_tpa = 1');
  if (insured === '0') where.push('b.is_tpa = 0');
  if (due === 'patient') where.push('b.patient_due > 0.004');
  if (due === 'sponsor') where.push('b.sponsor_due > 0.004');
  if (due === 'overpaid') where.push('b.patient_due < -0.004');
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = { updated: 'b.updated_at DESC', due: 'b.patient_due DESC', amount: 'b.total_amount DESC', created: 'b.created_at DESC' }[sort] || 'b.updated_at DESC';
  const limit = Math.min(Number(size) || 25, 200);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const rows = db.prepare(`SELECT b.*, pt.name AS patient_name, pt.phone, v.visit_type, v.doctor, v.department,
      (SELECT COUNT(*) FROM approvals a WHERE a.bill_no = b.bill_no AND a.status='pending') AS pending_approvals,
      (SELECT s.name FROM bill_claims bc JOIN plans pl ON pl.id = bc.plan_id JOIN sponsors s ON s.id = pl.sponsor_id
         WHERE bc.bill_no = b.bill_no AND bc.priority = 1) AS sponsor_name
    FROM bills b JOIN patients pt ON pt.mr_no = b.mr_no JOIN visits v ON v.visit_id = b.visit_id
    ${w} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`).all(p);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM bills b JOIN patients pt ON pt.mr_no = b.mr_no ${w}`).get(p).n;
  const counts = db.prepare(`SELECT status, COUNT(*) AS n, SUM(patient_due) AS due FROM bills GROUP BY status`).all();
  const kpi = db.prepare(`SELECT
      SUM(CASE WHEN status='A' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status='F' AND patient_due > 0.004 THEN 1 ELSE 0 END) AS finalized_due,
      SUM(CASE WHEN status IN ('A','F') AND patient_due > 0.004 THEN patient_due ELSE 0 END) AS patient_outstanding,
      SUM(CASE WHEN status IN ('F','C') AND is_tpa=1 AND sponsor_due > 0.004 THEN sponsor_due ELSE 0 END) AS sponsor_outstanding,
      SUM(CASE WHEN patient_due < -0.004 AND status IN ('A','F') THEN 1 ELSE 0 END) AS overpaid
    FROM bills`).get();
  res.json({ rows, total, page: Number(page), size: limit, counts, kpi });
}));

/* ---------------------------------------------------------------- create */
router.post('/bills', asyncRoute((req, res) => {
  requireRight(req.user, 'edit_bill');
  const { visitId, billType = 'C', restrictionType = 'N', remarks } = req.body;
  requireFields(req.body, ['visitId']);
  if (!['P', 'C'].includes(billType)) throw bad('Bill type must be Bill Now or Bill Later.');
  const visit = db.prepare('SELECT * FROM visits WHERE visit_id = ?').get(visitId);
  if (!visit) throw notFound(`Visit ${visitId} not found`);
  const billNo = tx(() => {
    const hasPlan = !!visit.primary_plan_id;
    const isTpa = hasPlan && restrictionType === 'N' && (billType === 'C' || pref('allow_bill_now_insurance', false)) ? 1 : 0;
    const existingPrimary = db.prepare("SELECT 1 FROM bills WHERE visit_id = ? AND is_primary = 1 AND status != 'X'").get(visitId);
    const isPrimary = billType === 'C' && restrictionType === 'N' && !existingPrimary ? 1 : 0;
    const series = restrictionType === 'P' ? 'bill_pharmacy' : restrictionType === 'T' ? 'bill_test' : billType === 'P' ? 'bill_now' : 'bill_later';
    const no = nextNumber(series);
    const rp = !isTpa ? pref('default_rate_plan_id', null) : null;
    const now = nowIso();
    db.prepare(`INSERT INTO bills (bill_no, visit_id, mr_no, bill_type, restriction_type, is_primary, is_tpa, rate_plan_id, remarks,
        created_at, created_by, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(no, visitId, visit.mr_no, billType, restrictionType, isPrimary, isTpa, rp ? Number(rp) : null, remarks || null, now, req.user.username, now);
    if (isTpa) {
      db.prepare('INSERT INTO bill_claims (bill_no, plan_id, priority) VALUES (?,?,1)').run(no, visit.primary_plan_id);
      if (visit.secondary_plan_id) db.prepare('INSERT INTO bill_claims (bill_no, plan_id, priority) VALUES (?,?,2)').run(no, visit.secondary_plan_id);
    }
    audit(req.user, { entity: 'bill', id: no, billNo: no, mrNo: visit.mr_no, action: 'create',
      summary: `Created ${billType === 'P' ? 'Bill Now' : 'Bill Later'} bill${isPrimary ? ' (primary)' : ''}${isTpa ? ', insured' : ''}` });
    return no;
  })();
  res.status(201).json(billPayload(req.user, billNo));
}));

router.get('/bills/:billNo', asyncRoute((req, res) => res.json(billPayload(req.user, req.params.billNo))));

/* ---------------------------------------------------------------- charges */
function priceFor(bill, cat) {
  if (bill.is_tpa || !bill.rate_plan_id) return cat.rate;
  const rp = db.prepare('SELECT discount_pct FROM rate_plans WHERE id = ?').get(bill.rate_plan_id);
  return r2(cat.rate * (1 - (rp?.discount_pct || 0) / 100));
}

router.post('/bills/:billNo/charges', asyncRoute((req, res) => {
  requireRight(req.user, 'addtobill_charges');
  const bill = mustGetBill(req.params.billNo);
  assertOpen(bill, 'add charges');
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) throw bad('Pick at least one item to add.');
  tx(() => {
    const ins = db.prepare(`INSERT INTO charges (bill_no, catalogue_id, code, description, charge_group, charge_head, orig_rate, rate, qty, amount,
        vat_rate, insurance_payable, order_linked, pending_result, posted_at, posted_by)
      VALUES (@bill_no, @catalogue_id, @code, @description, @charge_group, @charge_head, @orig_rate, @rate, @qty, @amount,
        @vat_rate, @insurance_payable, @order_linked, @pending_result, @posted_at, @posted_by)`);
    for (const it of items) {
      const cat = db.prepare('SELECT * FROM catalogue WHERE id = ?').get(it.catalogueId);
      if (!cat) throw bad(`Catalogue item ${it.catalogueId} not found`);
      if (bill.restriction_type === 'P' && cat.charge_group !== 'MED') throw bad(`${cat.name} cannot go on a pharmacy bill.`);
      const qty = Number(it.qty) || 1;
      if (qty <= 0) throw bad('Quantity must be above zero.');
      const listRate = priceFor(bill, cat);
      let rate = listRate;
      if (it.rate !== undefined && it.rate !== null && r2(it.rate) !== listRate) {
        requireRight(req.user, 'allow_ratechange');
        rate = r2(it.rate);
      }
      const row = { bill_no: bill.bill_no, catalogue_id: cat.id, code: cat.code, description: cat.name, charge_group: cat.charge_group,
        charge_head: cat.charge_head, orig_rate: cat.rate, rate, qty, amount: r2(rate * qty), vat_rate: cat.vat_rate,
        insurance_payable: cat.insurance_payable, order_linked: it.orderLinked ? 1 : 0, pending_result: cat.charge_group === 'DIA' && it.pendingResult ? 1 : 0,
        posted_at: it.postedAt || nowIso(), posted_by: req.user.username };
      const info = ins.run(row);
      audit(req.user, { entity: 'charge', id: info.lastInsertRowid, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'create',
        summary: `Added ${cat.name} × ${qty} @ ${rate.toFixed(2)}` });
    }
    recalcBill(bill.bill_no);
  })();
  res.status(201).json(billPayload(req.user, bill.bill_no));
}));

function mustGetCharge(id) {
  const c = db.prepare('SELECT * FROM charges WHERE charge_id = ?').get(id);
  if (!c) throw notFound('Charge not found');
  if (c.is_system) throw conflict('Round-off is calculated automatically and cannot be edited.');
  return c;
}

/** Applies a discount to one charge; returns true if the change needs approval. */
function needsDiscountApproval(bill, charge, newDiscount) {
  if (bill.is_tpa) return false;
  const threshold = pref('discount_approval_threshold_pct', 10);
  const amount = r2(charge.rate * charge.qty);
  return amount > 0 && (newDiscount / amount) * 100 > threshold + 1e-9;
}

function requestDiscountApproval(user, bill, changes, reason) {
  const total = r2(changes.reduce((s, c) => s + (c.to - c.from), 0));
  db.prepare(`INSERT INTO approvals (kind, bill_no, amount, reason, payload, requested_by, requested_at)
    VALUES ('discount', ?, ?, ?, ?, ?, ?)`).run(bill.bill_no, total, reason || null, JSON.stringify({ changes }), user.username, nowIso());
  for (const c of changes) db.prepare("UPDATE charges SET discount_status='pending' WHERE charge_id=?").run(c.chargeId);
  audit(user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'discount_requested',
    summary: `Discount of ${total.toFixed(2)} sent for approval`, detail: { changes } });
}

router.patch('/charges/:id', asyncRoute((req, res) => {
  const c = mustGetCharge(req.params.id);
  const bill = mustGetBill(c.bill_no);
  assertOpen(bill, 'edit charges');
  requireRight(req.user, 'edit_bill');
  if (c.status === 'X') throw conflict('This charge is cancelled.');
  const b = req.body;
  tx(() => {
    const changes = {};
    if (b.rate !== undefined && r2(b.rate) !== c.rate) { requireRight(req.user, 'allow_ratechange'); if (r2(b.rate) < 0) throw bad('Rate cannot be negative.'); changes.rate = r2(b.rate); }
    if (b.qty !== undefined && Number(b.qty) !== c.qty) { if (!(Number(b.qty) > 0)) throw bad('Quantity must be above zero.'); changes.qty = Number(b.qty); }
    if (b.postedAt) changes.posted_at = b.postedAt;
    if (b.remarks !== undefined) changes.remarks = b.remarks;
    const rate = changes.rate ?? c.rate;
    const qty = changes.qty ?? c.qty;
    let approval = null;
    if (b.discount !== undefined && r2(b.discount) !== c.discount) {
      requireRight(req.user, 'allow_discount');
      const d = r2(b.discount);
      if (d < 0) throw bad('Discount cannot be negative.');
      if (d > r2(rate * qty)) throw bad('Discount cannot be more than the amount.');
      if (d > 0 && !b.discountBy) throw bad('Choose who authorized the discount.');
      changes.discount = d;
      changes.discount_by = d > 0 ? b.discountBy : null;
      changes.discount_status = d > 0 ? 'approved' : 'none';
      if (d > 0 && needsDiscountApproval(bill, { ...c, rate, qty }, d)) approval = [{ chargeId: c.charge_id, description: c.description, from: c.discount, to: d }];
    }
    if (b.claimOverride !== undefined) {
      if (!bill.is_tpa) throw bad('This bill has no sponsor.');
      if (b.claimOverride) {
        const net = r2(rate * qty - (changes.discount ?? c.discount));
        const p1 = r2(b.primaryClaim ?? c.primary_claim);
        const p2 = r2(b.secondaryClaim ?? c.secondary_claim);
        if (p1 < 0 || p2 < 0) throw bad('Claims cannot be negative.');
        if (p1 + p2 > net + 0.004) throw bad(`Claims (${(p1 + p2).toFixed(2)}) are more than the net amount (${net.toFixed(2)}).`);
        Object.assign(changes, { claim_override: 1, primary_claim: p1, secondary_claim: p2 });
      } else changes.claim_override = 0;
    }
    if (!Object.keys(changes).length) return;
    const sets = Object.keys(changes).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE charges SET ${sets} WHERE charge_id = @charge_id`).run({ ...changes, charge_id: c.charge_id });
    audit(req.user, { entity: 'charge', id: c.charge_id, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'update',
      summary: `Edited ${c.description}`, detail: { before: c, changes } });
    if (approval) requestDiscountApproval(req.user, bill, approval, b.discountReason);
    recalcBill(bill.bill_no);
  })();
  res.json(billPayload(req.user, bill.bill_no));
}));

router.post('/charges/:id/cancel', asyncRoute((req, res) => {
  const c = mustGetCharge(req.params.id);
  const bill = mustGetBill(c.bill_no);
  assertOpen(bill, 'cancel charges');
  requireRight(req.user, 'cancel_elements_in_bill');
  if (c.status === 'X') throw conflict('Charge is already cancelled.');
  if (c.order_linked && !req.body.cancelOrder) throw conflict('This charge comes from an order. Cancel the order along with it.', 'order_linked');
  tx(() => {
    db.prepare(`UPDATE charges SET status='X', order_linked=0, discount=0, primary_claim=0, secondary_claim=0, claim_override=0,
      discount_status='none', remarks=COALESCE(?, remarks) WHERE charge_id=?`).run(req.body.reason || null, c.charge_id);
    audit(req.user, { entity: 'charge', id: c.charge_id, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'cancel',
      summary: `Cancelled ${c.description}${c.order_linked ? ' and its order' : ''}`, detail: { reason: req.body.reason } });
    recalcBill(bill.bill_no);
  })();
  res.json(billPayload(req.user, bill.bill_no));
}));

router.post('/charges/:id/result-ready', asyncRoute((req, res) => {
  const c = mustGetCharge(req.params.id);
  db.prepare('UPDATE charges SET pending_result = 0 WHERE charge_id = ?').run(c.charge_id);
  audit(req.user, { entity: 'charge', id: c.charge_id, billNo: c.bill_no, action: 'result_ready', summary: `Result ready for ${c.description}` });
  res.json(billPayload(req.user, c.bill_no));
}));

/* ---------------------------------------------------------------- bill discount */
router.post('/bills/:billNo/discount', asyncRoute((req, res) => {
  requireRight(req.user, 'allow_discount');
  const bill = mustGetBill(req.params.billNo);
  assertOpen(bill, 'give discounts');
  const { chargeIds = [], percent, authorizer, mode = 'replace', categoryId, reason } = req.body;
  if (!authorizer) throw bad('Choose who authorized the discount.');
  let pct = Number(percent);
  let groups = null;
  if (categoryId) {
    const cat = db.prepare('SELECT * FROM discount_categories WHERE id = ? AND active = 1').get(categoryId);
    if (!cat) throw bad('Discount category not found.');
    pct = cat.percent;
    groups = new Set(parseJson(cat.charge_groups, []));
  }
  if (!(pct >= 0 && pct <= 100)) throw bad('Discount must be between 0 and 100 %.');
  tx(() => {
    let targets = db.prepare("SELECT * FROM charges WHERE bill_no = ? AND status='A' AND is_system=0").all(bill.bill_no);
    if (groups) targets = targets.filter((c) => groups.has(c.charge_group));
    else if (chargeIds.length) targets = targets.filter((c) => chargeIds.includes(c.charge_id));
    if (!targets.length) throw bad('No charges match this discount.');
    const approvalChanges = [];
    for (const c of targets) {
      const amount = r2(c.rate * c.qty);
      const add = r2((amount * pct) / 100);
      const d = Math.min(amount, mode === 'add' ? r2(c.discount + add) : add);
      if (d === c.discount) continue;
      db.prepare("UPDATE charges SET discount=?, discount_by=?, discount_status=? WHERE charge_id=?")
        .run(d, d > 0 ? authorizer : null, d > 0 ? 'approved' : 'none', c.charge_id);
      if (d > 0 && needsDiscountApproval(bill, c, d)) approvalChanges.push({ chargeId: c.charge_id, description: c.description, from: c.discount, to: d });
    }
    if (categoryId) db.prepare('UPDATE bills SET discount_category_id = ? WHERE bill_no = ?').run(categoryId, bill.bill_no);
    audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'discount',
      summary: `${mode === 'add' ? 'Added' : 'Applied'} ${pct}% discount on ${targets.length} item${targets.length > 1 ? 's' : ''}`, detail: { authorizer, categoryId } });
    if (approvalChanges.length) requestDiscountApproval(req.user, bill, approvalChanges, reason);
    recalcBill(bill.bill_no);
  })();
  res.json(billPayload(req.user, bill.bill_no));
}));

/* ---------------------------------------------------------------- lifecycle */
function assertAction(user, bill, key) {
  const a = lifecycle(user, bill)[key];
  if (!a.allowed) throw conflict(a.reasons[0], 'blocked', { reasons: a.reasons });
}

export function finalizeBill(user, billNo, finalizedAt) {
  const bill = recalcBill(billNo);
  assertAction(user, bill, 'finalize');
  let at = nowIso();
  if (finalizedAt) {
    if (new Date(finalizedAt) < new Date(Date.now() - 60_000)) requireRight(user, 'allow_backdate');
    at = new Date(finalizedAt).toISOString();
  }
  db.prepare("UPDATE bills SET status='F', finalized_at=?, finalized_by=? WHERE bill_no=?").run(at, user.username, billNo);
  audit(user, { entity: 'bill', id: billNo, billNo, mrNo: bill.mr_no, action: 'finalize', summary: 'Finalized bill' });
  const over = settleOverpayment(user, billNo);
  return { overpayment: over };
}

export function closeBill(user, billNo) {
  const bill = recalcBill(billNo);
  assertAction(user, bill, 'close');
  db.prepare("UPDATE bills SET status='C', payment_status='P', claim_status=CASE WHEN is_tpa=1 THEN 'R' ELSE claim_status END, closed_at=?, closed_by=? WHERE bill_no=?")
    .run(nowIso(), user.username, billNo);
  db.prepare("UPDATE bill_claims SET claim_status='R' WHERE bill_no=?").run(billNo);
  const earn = pref('reward_points_enabled', true) ? Math.floor((Math.max(0, bill.patient_amount) / 100) * pref('points_earn_per_100', 1)) : 0;
  if (earn > 0) {
    db.prepare('INSERT INTO reward_points (mr_no, earned, redeemed) VALUES (?, ?, 0) ON CONFLICT(mr_no) DO UPDATE SET earned = earned + excluded.earned').run(bill.mr_no, earn);
  }
  audit(user, { entity: 'bill', id: billNo, billNo, mrNo: bill.mr_no, action: 'close', summary: `Closed bill${earn ? ` — ${earn} reward points earned` : ''}` });
}

router.post('/bills/:billNo/finalize', asyncRoute((req, res) => {
  const out = tx(() => finalizeBill(req.user, req.params.billNo, req.body.finalizedAt))();
  res.json({ ...billPayload(req.user, req.params.billNo), result: out });
}));

router.post('/bills/:billNo/close', asyncRoute((req, res) => {
  tx(() => closeBill(req.user, req.params.billNo))();
  res.json(billPayload(req.user, req.params.billNo));
}));

router.post('/bills/:billNo/reopen', asyncRoute((req, res) => {
  const bill = recalcBill(req.params.billNo);
  assertAction(req.user, bill, 'reopen');
  const { reason, reasonCode } = req.body;
  if (!reason || !reasonCode) throw bad('Choose a reason and add a note to reopen.');
  tx(() => {
    db.prepare(`UPDATE bills SET status='A', payment_status='U', claim_status=CASE WHEN is_tpa=1 THEN 'O' ELSE claim_status END,
      patient_writeoff='N', sponsor_writeoff='N', finalized_at=NULL, finalized_by=NULL, closed_at=NULL, closed_by=NULL, reopen_reason=?
      WHERE bill_no=?`).run(`${reasonCode}: ${reason}`, bill.bill_no);
    db.prepare("UPDATE bill_claims SET claim_status='O' WHERE bill_no=?").run(bill.bill_no);
    audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'reopen',
      summary: `Reopened — ${reasonCode}`, detail: { reason } });
    recalcBill(bill.bill_no);
  })();
  res.json(billPayload(req.user, bill.bill_no));
}));

export function cancelBillNow(user, billNo, reason) {
  db.prepare("UPDATE bills SET status='X', cancellation_status='A', cancel_reason=COALESCE(?, cancel_reason) WHERE bill_no=?").run(reason || null, billNo);
  if (db.prepare('SELECT is_primary, visit_id FROM bills WHERE bill_no=?').get(billNo).is_primary) {
    db.prepare('UPDATE bills SET is_primary = 0 WHERE bill_no = ?').run(billNo);
  }
  audit(user, { entity: 'bill', id: billNo, billNo, action: 'cancel', summary: 'Cancelled bill', detail: { reason } });
}

router.post('/bills/:billNo/cancel', asyncRoute((req, res) => {
  const bill = recalcBill(req.params.billNo);
  assertAction(req.user, bill, 'cancel');
  if (!req.body.reason) throw bad('Add a reason for cancelling.');
  let requested = false;
  tx(() => {
    if (pref('bill_cancellation_requires_approval', true)) {
      db.prepare("UPDATE bills SET cancellation_status='S', cancel_reason=? WHERE bill_no=?").run(req.body.reason, bill.bill_no);
      db.prepare(`INSERT INTO approvals (kind, bill_no, amount, reason, requested_by, requested_at) VALUES ('cancellation', ?, ?, ?, ?, ?)`)
        .run(bill.bill_no, bill.total_amount, req.body.reason, req.user.username, nowIso());
      audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'cancel_requested',
        summary: 'Requested cancellation', detail: { reason: req.body.reason } });
      requested = true;
    } else cancelBillNow(req.user, bill.bill_no, req.body.reason);
  })();
  res.json({ ...billPayload(req.user, bill.bill_no), result: { requested } });
}));

router.post('/bills/:billNo/writeoff', asyncRoute((req, res) => {
  const bill = recalcBill(req.params.billNo);
  assertAction(req.user, bill, 'writeoff');
  if (!req.body.reason) throw bad('Add a reason for the write-off.');
  tx(() => {
    db.prepare("UPDATE bills SET patient_writeoff='M' WHERE bill_no=?").run(bill.bill_no);
    db.prepare(`INSERT INTO approvals (kind, bill_no, amount, reason, requested_by, requested_at) VALUES ('writeoff', ?, ?, ?, ?, ?)`)
      .run(bill.bill_no, bill.patient_due, req.body.reason, req.user.username, nowIso());
    audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'writeoff_requested',
      summary: `Marked ${bill.patient_due.toFixed(2)} for write-off`, detail: { reason: req.body.reason } });
  })();
  res.json(billPayload(req.user, bill.bill_no));
}));

router.post('/bills/:billNo/send-claim', asyncRoute((req, res) => {
  const bill = recalcBill(req.params.billNo);
  assertAction(req.user, bill, 'sendClaim');
  tx(() => {
    db.prepare("UPDATE bills SET claim_status='S' WHERE bill_no=?").run(bill.bill_no);
    db.prepare("UPDATE bill_claims SET claim_status='S' WHERE bill_no=?").run(bill.bill_no);
    audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'claim_sent',
      summary: `Sent claim of ${(bill.total_claim + bill.sponsor_vat).toFixed(2)} to sponsor` });
  })();
  res.json(billPayload(req.user, bill.bill_no));
}));

/* ---------------------------------------------------------------- payments */
function runAfterPayment(user, billNo, { finalize, close }) {
  const notes = [];
  let overpayment = null;
  if (finalize || close) {
    const bill = recalcBill(billNo);
    if (bill.status === 'A') {
      const a = lifecycle(user, bill).finalize;
      if (a.allowed) overpayment = finalizeBill(user, billNo).overpayment;
      else notes.push(`Saved, but not finalized: ${a.reasons[0]}`);
    }
  }
  if (close) {
    const bill = recalcBill(billNo);
    if (bill.status === 'F') {
      const a = lifecycle(user, bill).close;
      if (a.allowed) closeBill(user, billNo);
      else notes.push(`Not closed: ${a.reasons[0]}`);
    }
  }
  return { notes, overpayment };
}

function checkAmounts(bill, rows) {
  const settle = r2(rows.filter((r) => r.kind === 'settlement').reduce((s, r) => s + r2(r.amount), 0));
  if (settle > Math.max(0, bill.patient_due) + 0.004) {
    throw bad(`Settlement (${settle.toFixed(2)}) is more than the patient due (${Math.max(0, bill.patient_due).toFixed(2)}).${bill.bill_type === 'C' && bill.status === 'A' ? ' Take the extra as an advance.' : ''}`);
  }
  const sponsor = r2(rows.filter((r) => r.kind.startsWith('sponsor')).reduce((s, r) => s + r2(r.amount) + r2(r.tds || 0), 0));
  if (sponsor > Math.max(0, bill.sponsor_due) + 0.004) throw bad(`Sponsor receipts (${sponsor.toFixed(2)}) are more than the sponsor due (${bill.sponsor_due.toFixed(2)}).`);
}

router.post('/bills/:billNo/payments', asyncRoute((req, res) => {
  const bill = recalcBill(req.params.billNo);
  const { rows = [], finalize = false, close = false } = req.body;
  const modes = validatePaymentRows(req.user, bill, rows);
  checkAmounts(bill, rows);
  if (!req.user.counter_id) throw conflict('Pick a counter in the header before taking payments.', 'no_counter');
  const needsTerminal = pref('card_integration', true) && rows.some((r) => modes.get(Number(r.modeId))?.requires_card && r.kind !== 'refund' && !r.manualCard);
  if (needsTerminal) {
    const id = crypto.randomUUID();
    const amount = r2(rows.filter((r) => modes.get(Number(r.modeId))?.requires_card && r.kind !== 'refund').reduce((s, r) => s + r2(r.amount), 0));
    const terminal = db.prepare('SELECT card_terminal FROM counters WHERE id = ?').get(req.user.counter_id)?.card_terminal || 'POS-01';
    db.prepare(`INSERT INTO card_txns (id, bill_no, mr_no, purpose, amount, payload, terminal_id, created_at, username)
      VALUES (?, ?, ?, 'bill', ?, ?, ?, ?, ?)`).run(id, bill.bill_no, bill.mr_no, amount, JSON.stringify({ rows, finalize, close }), terminal, nowIso(), req.user.username);
    return res.status(202).json({ cardTxn: { id, amount, terminal } });
  }
  const out = tx(() => {
    const created = insertReceipts(req.user, bill, rows);
    return { created, ...runAfterPayment(req.user, bill.bill_no, { finalize, close }) };
  })();
  res.status(201).json({ ...billPayload(req.user, bill.bill_no), result: { receipts: out.created.map((r) => r.receipt_no), notes: out.notes, overpayment: out.overpayment } });
}));

/* ---------------------------------------------------------------- deposit set-off & points */
router.post('/bills/:billNo/deposit-setoff', asyncRoute((req, res) => {
  tx(() => setOffDeposits(req.user, recalcBill(req.params.billNo), req.body))();
  res.json(billPayload(req.user, req.params.billNo));
}));

router.delete('/bills/:billNo/deposit-setoff/:id', asyncRoute((req, res) => {
  requireRight(req.user, 'allow_deposit_setoff');
  const bill = mustGetBill(req.params.billNo);
  if (bill.status === 'C' || bill.status === 'X') throw conflict('Reopen the bill to change its set-off.');
  tx(() => {
    const s = db.prepare("SELECT * FROM deposit_setoffs WHERE id = ? AND bill_no = ? AND set_off_type='R'").get(req.params.id, bill.bill_no);
    if (!s) throw notFound('Set-off not found');
    db.prepare('DELETE FROM deposit_setoffs WHERE id = ?').run(s.id);
    audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'deposit_setoff_removed',
      summary: `Removed set-off of ${s.amount.toFixed(2)} from ${s.deposit_no}` });
    recalcBill(bill.bill_no);
  })();
  res.json(billPayload(req.user, bill.bill_no));
}));

router.post('/bills/:billNo/points', asyncRoute((req, res) => {
  const bill = recalcBill(req.params.billNo);
  if (!pref('reward_points_enabled', true)) throw conflict('Reward points are turned off.');
  if (bill.status === 'C' || bill.status === 'X') throw conflict('Points can only be redeemed on open or finalized bills.');
  const pts = Math.floor(Number(req.body.points));
  if (!(pts > 0)) throw bad('Enter the number of points to redeem.');
  const rate = pref('points_redemption_rate', 0.25);
  const rp = db.prepare('SELECT * FROM reward_points WHERE mr_no = ?').get(bill.mr_no) || { earned: 0, redeemed: 0 };
  const balance = rp.earned - rp.redeemed;
  if (pts > balance) throw bad(`Only ${balance} points are available.`);
  const amount = r2(pts * rate);
  if (amount > bill.patient_due + 0.004) throw bad(`${pts} points are worth ${amount.toFixed(2)}, more than the due (${bill.patient_due.toFixed(2)}).`);
  tx(() => {
    db.prepare('UPDATE bills SET points_redeemed = points_redeemed + ?, points_amount = points_amount + ? WHERE bill_no = ?').run(pts, amount, bill.bill_no);
    db.prepare('INSERT INTO reward_points (mr_no, earned, redeemed) VALUES (?, 0, ?) ON CONFLICT(mr_no) DO UPDATE SET redeemed = redeemed + excluded.redeemed').run(bill.mr_no, pts);
    audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'points', summary: `Redeemed ${pts} points (${amount.toFixed(2)})` });
    recalcBill(bill.bill_no);
  })();
  res.json(billPayload(req.user, bill.bill_no));
}));

router.delete('/bills/:billNo/points', asyncRoute((req, res) => {
  const bill = mustGetBill(req.params.billNo);
  if (bill.status === 'C' || bill.status === 'X') throw conflict('Reopen the bill to release points.');
  tx(() => {
    db.prepare('UPDATE reward_points SET redeemed = MAX(0, redeemed - ?) WHERE mr_no = ?').run(bill.points_redeemed, bill.mr_no);
    db.prepare('UPDATE bills SET points_redeemed = 0, points_amount = 0 WHERE bill_no = ?').run(bill.bill_no);
    audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'points_released', summary: `Released ${bill.points_redeemed} points` });
    recalcBill(bill.bill_no);
  })();
  res.json(billPayload(req.user, bill.bill_no));
}));

/* ---------------------------------------------------------------- settings */
router.patch('/bills/:billNo/settings', asyncRoute((req, res) => {
  const bill = mustGetBill(req.params.billNo);
  const { billType, makePrimary, ratePlanId, insurance, remarks } = req.body;
  tx(() => {
    if (billType && billType !== bill.bill_type) {
      requireRight(req.user, 'change_billtype');
      assertOpen(bill, 'change the bill type');
      if (billType === 'P' && db.prepare("SELECT 1 FROM receipts WHERE bill_no=? AND recpt_type IN ('U','A') AND payment_type='R'").get(bill.bill_no)) {
        throw conflict('This bill has advances. Bill Now bills cannot hold advances.');
      }
      db.prepare('UPDATE bills SET bill_type = ? WHERE bill_no = ?').run(billType, bill.bill_no);
      audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'bill_type',
        summary: `Changed to ${billType === 'C' ? 'Bill Later' : 'Bill Now'}` });
    }
    if (makePrimary) {
      requireRight(req.user, 'change_billprimary');
      if (bill.status === 'X') throw conflict('Cancelled bills cannot be primary.');
      if (bill.restriction_type !== 'N') throw conflict('Only hospital bills can be primary.');
      db.prepare('UPDATE bills SET is_primary = 0 WHERE visit_id = ?').run(bill.visit_id);
      db.prepare('UPDATE bills SET is_primary = 1 WHERE bill_no = ?').run(bill.bill_no);
      audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'primary', summary: 'Made this the primary bill' });
    }
    if (ratePlanId !== undefined && ratePlanId !== bill.rate_plan_id) {
      requireRight(req.user, 'allow_ratechange');
      assertOpen(bill, 'change the rate plan');
      if (bill.is_tpa) throw conflict('Insured bills use the sponsor tariff, not a rate plan.');
      db.prepare('UPDATE bills SET rate_plan_id = ? WHERE bill_no = ?').run(ratePlanId || null, bill.bill_no);
      const disc = ratePlanId ? db.prepare('SELECT discount_pct FROM rate_plans WHERE id = ?').get(ratePlanId)?.discount_pct || 0 : 0;
      db.prepare("UPDATE charges SET rate = ROUND(orig_rate * (1 - ? / 100.0), 2) WHERE bill_no = ? AND status='A' AND is_system=0 AND catalogue_id IS NOT NULL")
        .run(disc, bill.bill_no);
      audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'rate_plan', summary: `Rate plan changed, ${disc}% applied to list rates` });
    }
    if (insurance === 'connect' || insurance === 'disconnect') {
      requireRight(req.user, 'connect_disconnect_tpa');
      assertOpen(bill, 'change insurance');
      if (insurance === 'connect') {
        const visit = db.prepare('SELECT * FROM visits WHERE visit_id = ?').get(bill.visit_id);
        const planId = req.body.planId || visit.primary_plan_id;
        if (!planId) throw bad('Choose a plan to connect.');
        db.prepare('DELETE FROM bill_claims WHERE bill_no = ?').run(bill.bill_no);
        db.prepare('INSERT INTO bill_claims (bill_no, plan_id, priority) VALUES (?,?,1)').run(bill.bill_no, planId);
        const sec = req.body.secondaryPlanId ?? visit.secondary_plan_id;
        if (sec) db.prepare('INSERT INTO bill_claims (bill_no, plan_id, priority) VALUES (?,?,2)').run(bill.bill_no, sec);
        db.prepare('UPDATE bills SET is_tpa = 1, rate_plan_id = NULL WHERE bill_no = ?').run(bill.bill_no);
        db.prepare("UPDATE charges SET rate = orig_rate WHERE bill_no = ? AND status='A' AND is_system=0 AND catalogue_id IS NOT NULL").run(bill.bill_no);
        audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'insurance', summary: 'Connected insurance' });
      } else {
        if (bill.sponsor_receipts > 0) throw conflict('Sponsor has already paid on this bill.');
        if (bill.claim_status === 'S') throw conflict('The claim has been sent.');
        db.prepare('DELETE FROM bill_claims WHERE bill_no = ?').run(bill.bill_no);
        db.prepare('UPDATE bills SET is_tpa = 0 WHERE bill_no = ?').run(bill.bill_no);
        db.prepare("UPDATE charges SET primary_claim=0, secondary_claim=0, claim_override=0 WHERE bill_no = ?").run(bill.bill_no);
        audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'insurance', summary: 'Disconnected insurance' });
      }
    }
    if (remarks !== undefined) db.prepare('UPDATE bills SET remarks = ? WHERE bill_no = ?').run(remarks, bill.bill_no);
    recalcBill(bill.bill_no);
  })();
  res.json(billPayload(req.user, bill.bill_no));
}));

/* ---------------------------------------------------------------- catalogue */
router.get('/catalogue', asyncRoute((req, res) => {
  const { q = '', group = '' } = req.query;
  const rows = db.prepare(`SELECT * FROM catalogue WHERE orderable = 1 AND (name LIKE @q OR code LIKE @q)
    ${group ? 'AND charge_group = @group' : ''} ORDER BY name LIMIT 60`).all({ q: `%${q}%`, group });
  res.json(rows);
}));

export { runAfterPayment };
export default router;
