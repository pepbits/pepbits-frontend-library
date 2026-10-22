import { Router } from 'express';
import crypto from 'node:crypto';
import { db, tx } from '../db.js';
import { requireRight } from '../lib/auth.js';
import { depositBalances, depositSummary, receiptLabel } from '../lib/billing.js';
import { asyncRoute, audit, bad, conflict, nextNumber, notFound, nowIso, pref, r2, requireFields } from '../lib/util.js';

const router = Router();

const mustGetPatient = (mrNo) => {
  const p = db.prepare('SELECT * FROM patients WHERE mr_no = ?').get(mrNo);
  if (!p) throw notFound(`Patient ${mrNo} not found`);
  return p;
};

router.get('/patients', asyncRoute((req, res) => {
  const { q = '', filter = '' } = req.query;
  const rows = db.prepare(`SELECT p.*,
      (SELECT COUNT(*) FROM bills b WHERE b.mr_no = p.mr_no AND b.status IN ('A','F')) AS active_bills,
      (SELECT COALESCE(SUM(patient_due),0) FROM bills b WHERE b.mr_no = p.mr_no AND b.status IN ('A','F') AND b.patient_due > 0) AS dues,
      (SELECT COALESCE(SUM(d.amount - COALESCE((SELECT SUM(s.amount) FROM deposit_setoffs s WHERE s.deposit_no = d.deposit_no),0)),0)
         FROM deposits d WHERE d.mr_no = p.mr_no AND d.deposit_type='R' AND d.status='A' AND d.realized=1) AS deposit_balance,
      (SELECT MAX(admitted_at) FROM visits v WHERE v.mr_no = p.mr_no) AS last_visit
    FROM patients p WHERE (p.name LIKE @q OR p.mr_no LIKE @q OR p.phone LIKE @q)
    ORDER BY last_visit DESC LIMIT 200`).all({ q: `%${q}%` })
    .map((r) => ({ ...r, dues: r2(r.dues), deposit_balance: r2(r.deposit_balance) }))
    .filter((r) => (filter === 'dues' ? r.dues > 0 : filter === 'deposits' ? r.deposit_balance > 0 : true));
  res.json(rows);
}));

router.post('/patients', asyncRoute((req, res) => {
  requireRight(req.user, 'edit_bill');
  requireFields(req.body, ['name', 'phone']);
  const { name, gender = null, dob = null, phone, city = null } = req.body;
  const mr = tx(() => {
    const no = nextNumber('mr');
    db.prepare('INSERT INTO patients (mr_no, name, gender, dob, phone, city, created_at) VALUES (?,?,?,?,?,?,?)').run(no, name, gender, dob, phone, city, nowIso());
    db.prepare('INSERT INTO reward_points (mr_no, earned, redeemed) VALUES (?, 0, 0)').run(no);
    audit(req.user, { entity: 'patient', id: no, mrNo: no, action: 'create', summary: `Registered ${name}` });
    return no;
  })();
  res.status(201).json(mustGetPatient(mr));
}));

router.post('/patients/:mrNo/visits', asyncRoute((req, res) => {
  requireRight(req.user, 'edit_bill');
  const p = mustGetPatient(req.params.mrNo);
  const { visitType = 'o', doctor = null, department = null, ward = null, primaryPlanId = null, secondaryPlanId = null } = req.body;
  if (!['o', 'i'].includes(visitType)) throw bad('Visit type must be OP or IP.');
  if (secondaryPlanId && !primaryPlanId) throw bad('Add a primary plan before a secondary one.');
  const id = tx(() => {
    const vid = nextNumber(visitType === 'i' ? 'visit_ip' : 'visit_op');
    db.prepare(`INSERT INTO visits (visit_id, mr_no, visit_type, doctor, department, ward, admitted_at, primary_plan_id, secondary_plan_id, center_id)
      VALUES (?,?,?,?,?,?,?,?,?,1)`).run(vid, p.mr_no, visitType, doctor, department, ward, nowIso(), primaryPlanId || null, secondaryPlanId || null);
    audit(req.user, { entity: 'visit', id: vid, mrNo: p.mr_no, action: 'create', summary: `Opened ${visitType === 'i' ? 'IP' : 'OP'} visit` });
    return vid;
  })();
  res.status(201).json(db.prepare('SELECT * FROM visits WHERE visit_id = ?').get(id));
}));

router.get('/patients/:mrNo', asyncRoute((req, res) => {
  const p = mustGetPatient(req.params.mrNo);
  const visits = db.prepare(`SELECT v.*, p1.name AS primary_plan, s1.name AS primary_sponsor, p2.name AS secondary_plan, s2.name AS secondary_sponsor
    FROM visits v LEFT JOIN plans p1 ON p1.id = v.primary_plan_id LEFT JOIN sponsors s1 ON s1.id = p1.sponsor_id
    LEFT JOIN plans p2 ON p2.id = v.secondary_plan_id LEFT JOIN sponsors s2 ON s2.id = p2.sponsor_id
    WHERE v.mr_no = ? ORDER BY v.admitted_at DESC`).all(p.mr_no);
  const bills = db.prepare('SELECT * FROM bills WHERE mr_no = ? ORDER BY created_at DESC').all(p.mr_no);
  const deposits = depositBalances(p.mr_no).reverse();
  const usage = db.prepare(`SELECT s.*, b.status AS bill_status FROM deposit_setoffs s LEFT JOIN bills b ON b.bill_no = s.bill_no
    WHERE s.deposit_no IN (SELECT deposit_no FROM deposits WHERE mr_no = ?) ORDER BY s.created_at DESC`).all(p.mr_no);
  const receipts = db.prepare(`SELECT r.*, pm.name AS mode_name FROM receipts r JOIN payment_modes pm ON pm.id = r.mode_id
    WHERE r.mr_no = ? ORDER BY r.created_at DESC LIMIT 100`).all(p.mr_no).map((r) => ({ ...r, label: receiptLabel(r) }));
  const rp = db.prepare('SELECT * FROM reward_points WHERE mr_no = ?').get(p.mr_no) || { earned: 0, redeemed: 0 };
  const dues = r2(bills.filter((b) => ['A', 'F'].includes(b.status) && b.patient_due > 0).reduce((s, b) => s + b.patient_due, 0));
  const lifetime = r2(bills.filter((b) => b.status !== 'X').reduce((s, b) => s + b.patient_amount, 0));
  const packages = [...new Set(deposits.filter((d) => d.package_name).map((d) => d.package_name))].map((name) => {
    const ds = deposits.filter((d) => d.package_name === name && d.deposit_type === 'R');
    return { name, collected: r2(ds.reduce((s, d) => s + d.amount, 0)), balance: r2(ds.reduce((s, d) => s + d.balance, 0)) };
  });
  const history = db.prepare('SELECT * FROM audit_log WHERE mr_no = ? ORDER BY at DESC LIMIT 60').all(p.mr_no);
  res.json({
    patient: p, visits, bills, deposits, usage, receipts, packages, history,
    summary: { ...depositSummary(p.mr_no), dues, lifetime },
    points: { earned: rp.earned, redeemed: rp.redeemed, balance: rp.earned - rp.redeemed, rate: pref('points_redemption_rate', 0.25) },
  });
}));

/* ---------------------------------------------------------------- deposits */
export function createDeposit(user, mrNo, body, cardMeta = {}) {
  const { type = 'R', amount, modeId, bank = null, reference = null, availableFor = 'B', payerName = null, payerPhone = null,
    packageName = null, remarks = null, allocations = [], cardLast4 = null } = body;
  const amt = r2(amount);
  if (!(amt > 0)) throw bad('Enter an amount above zero.');
  if (!['H', 'P', 'B'].includes(availableFor)) throw bad('Choose where the deposit can be used.');
  const mode = db.prepare('SELECT * FROM payment_modes WHERE id = ? AND active = 1').get(modeId);
  if (!mode) throw bad('Choose a payment mode.');
  if (mode.requires_bank && !bank) throw bad(`${mode.name} needs the bank name.`);
  if (mode.requires_reference && !reference) throw bad(`${mode.name} needs a reference number.`);
  if (!user.counter_id) throw conflict('Pick a counter in the header first.', 'no_counter');
  const now = nowIso();
  if (type === 'R') {
    const realized = mode.realization_required && pref('deposit_cheque_realization_flow', true) ? 0 : 1;
    const no = nextNumber('deposit');
    // Payer and availability are always stored as entered.
    db.prepare(`INSERT INTO deposits (deposit_no, mr_no, deposit_type, amount, mode_id, bank, reference, card_last4, realized, realized_at,
        available_for, payer_name, payer_phone, package_name, counter_id, username, created_at, remarks)
      VALUES (?,?, 'R', ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(no, mrNo, amt, mode.id, bank, reference, cardLast4 || cardMeta.last4 || null, realized,
      realized ? now : null, availableFor, payerName, payerPhone, packageName, user.counter_id, user.username, now, remarks);
    audit(user, { entity: 'deposit', id: no, mrNo, action: 'create', summary: `Collected deposit ${amt.toFixed(2)} by ${mode.name}${realized ? '' : ' (awaiting realization)'}` });
    return no;
  }
  // Refund: draw from chosen deposits, else oldest first.
  const usable = depositBalances(mrNo).filter((d) => d.deposit_type === 'R' && d.status === 'A' && d.realized && d.balance > 0.004);
  let plan = [];
  if (allocations.length) {
    for (const a of allocations) {
      const d = usable.find((x) => x.deposit_no === a.depositNo);
      if (!d) throw bad(`Deposit ${a.depositNo} has no balance to refund.`);
      if (r2(a.amount) > d.balance + 0.004) throw bad(`Deposit ${d.deposit_no} only has ${d.balance.toFixed(2)} left.`);
      if (r2(a.amount) > 0) plan.push({ deposit_no: d.deposit_no, amount: r2(a.amount) });
    }
  } else {
    let left = amt;
    for (const d of usable) { if (left <= 0) break; const t = Math.min(left, d.balance); plan.push({ deposit_no: d.deposit_no, amount: r2(t) }); left = r2(left - t); }
    if (left > 0.004) throw bad(`Refund is more than the deposit balance (${r2(usable.reduce((s, d) => s + d.balance, 0)).toFixed(2)}).`);
  }
  if (Math.abs(r2(plan.reduce((s, p) => s + p.amount, 0)) - amt) > 0.004) throw bad('Allocations must add up to the refund amount.');
  const no = nextNumber('deposit_refund');
  db.prepare(`INSERT INTO deposits (deposit_no, mr_no, deposit_type, amount, mode_id, bank, reference, realized, realized_at, available_for,
      payer_name, payer_phone, counter_id, username, created_at, remarks) VALUES (?,?, 'F', ?,?,?,?,1,?, 'B', ?,?,?,?,?,?)`)
    .run(no, mrNo, -amt, mode.id, bank, reference, now, payerName, payerPhone, user.counter_id, user.username, now, remarks);
  const ins = db.prepare(`INSERT INTO deposit_setoffs (deposit_no, set_off_type, refund_no, amount, created_at, username) VALUES (?, 'F', ?, ?, ?, ?)`);
  for (const p of plan) ins.run(p.deposit_no, no, p.amount, now, user.username);
  audit(user, { entity: 'deposit', id: no, mrNo, action: 'refund', summary: `Refunded ${amt.toFixed(2)} from deposits`, detail: { plan } });
  return no;
}

router.post('/patients/:mrNo/deposits', asyncRoute((req, res) => {
  requireRight(req.user, 'collect_deposit');
  const p = mustGetPatient(req.params.mrNo);
  if (req.body.type === 'F') requireRight(req.user, 'allow_refund');
  const mode = db.prepare('SELECT * FROM payment_modes WHERE id = ?').get(req.body.modeId);
  if (req.body.type !== 'F' && mode?.requires_card && pref('card_integration', true) && !req.body.manualCard) {
    if (!(r2(req.body.amount) > 0)) throw bad('Enter an amount above zero.');
    if (!req.user.counter_id) throw conflict('Pick a counter in the header first.', 'no_counter');
    const id = crypto.randomUUID();
    const terminal = db.prepare('SELECT card_terminal FROM counters WHERE id = ?').get(req.user.counter_id)?.card_terminal || 'POS-01';
    db.prepare(`INSERT INTO card_txns (id, mr_no, purpose, amount, payload, terminal_id, created_at, username) VALUES (?, ?, 'deposit', ?, ?, ?, ?, ?)`)
      .run(id, p.mr_no, r2(req.body.amount), JSON.stringify(req.body), terminal, nowIso(), req.user.username);
    return res.status(202).json({ cardTxn: { id, amount: r2(req.body.amount), terminal } });
  }
  const no = tx(() => createDeposit(req.user, p.mr_no, req.body))();
  res.status(201).json({ depositNo: no });
}));

router.patch('/deposits/:no', asyncRoute((req, res) => {
  requireRight(req.user, 'edit_receipt');
  const d = db.prepare('SELECT * FROM deposits WHERE deposit_no = ?').get(req.params.no);
  if (!d) throw notFound('Deposit not found');
  if (d.status !== 'A') throw conflict('Cancelled deposits cannot be edited.');
  const allowed = { availableFor: 'available_for', payerName: 'payer_name', payerPhone: 'payer_phone', reference: 'reference', bank: 'bank', remarks: 'remarks', packageName: 'package_name' };
  const changes = {};
  for (const [k, col] of Object.entries(allowed)) if (req.body[k] !== undefined) changes[col] = req.body[k] || null;
  if (changes.available_for && !['H', 'P', 'B'].includes(changes.available_for)) throw bad('Invalid availability.');
  if (!Object.keys(changes).length) return res.json(d);
  tx(() => {
    db.prepare(`UPDATE deposits SET ${Object.keys(changes).map((c) => `${c}=@${c}`).join(',')} WHERE deposit_no=@no`).run({ ...changes, no: d.deposit_no });
    audit(req.user, { entity: 'deposit', id: d.deposit_no, mrNo: d.mr_no, action: 'update', summary: `Edited deposit ${d.deposit_no}`, detail: { before: d, changes } });
  })();
  res.json(db.prepare('SELECT * FROM deposits WHERE deposit_no = ?').get(d.deposit_no));
}));

router.post('/deposits/:no/cancel', asyncRoute((req, res) => {
  requireRight(req.user, 'edit_receipt');
  const d = db.prepare('SELECT * FROM deposits WHERE deposit_no = ?').get(req.params.no);
  if (!d) throw notFound('Deposit not found');
  if (d.status !== 'A') throw conflict('Deposit is already cancelled.');
  if (!req.body.reason) throw bad('Add a reason for cancelling.');
  const used = db.prepare('SELECT COUNT(*) AS n FROM deposit_setoffs WHERE deposit_no = ? OR refund_no = ?').get(d.deposit_no, d.deposit_no).n;
  if (used && d.deposit_type === 'R') throw conflict('This deposit has been set off or refunded. Remove those first.');
  tx(() => {
    if (d.deposit_type === 'F') db.prepare('DELETE FROM deposit_setoffs WHERE refund_no = ?').run(d.deposit_no);
    db.prepare("UPDATE deposits SET status='X', remarks=COALESCE(remarks,'') || ? WHERE deposit_no=?").run(` [Cancelled: ${req.body.reason}]`, d.deposit_no);
    audit(req.user, { entity: 'deposit', id: d.deposit_no, mrNo: d.mr_no, action: 'cancel', summary: `Cancelled ${d.deposit_no}`, detail: { reason: req.body.reason } });
  })();
  res.json({ ok: true });
}));

router.get('/deposits/unrealized', asyncRoute((_req, res) => {
  res.json(db.prepare(`SELECT d.*, p.name AS patient_name, pm.name AS mode_name FROM deposits d JOIN patients p ON p.mr_no = d.mr_no
    JOIN payment_modes pm ON pm.id = d.mode_id WHERE d.realized = 0 AND d.status = 'A' ORDER BY d.created_at`).all());
}));

router.post('/deposits/realize', asyncRoute((req, res) => {
  requireRight(req.user, 'realize_cheques');
  const nos = Array.isArray(req.body.depositNos) ? req.body.depositNos : [];
  if (!nos.length) throw bad('Select cheques to realize.');
  const bounced = !!req.body.bounced;
  tx(() => {
    for (const no of nos) {
      const d = db.prepare("SELECT * FROM deposits WHERE deposit_no = ? AND realized = 0 AND status = 'A'").get(no);
      if (!d) throw bad(`${no} is not waiting for realization.`);
      if (bounced) db.prepare("UPDATE deposits SET status='X', remarks=COALESCE(remarks,'') || ' [Cheque bounced]' WHERE deposit_no=?").run(no);
      else db.prepare('UPDATE deposits SET realized = 1, realized_at = ? WHERE deposit_no = ?').run(nowIso(), no);
      audit(req.user, { entity: 'deposit', id: no, mrNo: d.mr_no, action: bounced ? 'bounced' : 'realized', summary: bounced ? `Cheque ${d.reference} bounced` : `Cheque ${d.reference} realized` });
    }
  })();
  res.json({ ok: true, count: nos.length });
}));

/* ---------------------------------------------------------------- insurance plans for visit forms */
router.get('/plans', asyncRoute((_req, res) => {
  res.json(db.prepare('SELECT p.*, s.name AS sponsor_name FROM plans p JOIN sponsors s ON s.id = p.sponsor_id ORDER BY s.name, p.name').all());
}));

router.get('/patients/:mrNo/visits', asyncRoute((req, res) => {
  res.json(db.prepare(`SELECT v.*, p1.name AS primary_plan, s1.name AS primary_sponsor,
      (SELECT COUNT(*) FROM bills b WHERE b.visit_id = v.visit_id AND b.status != 'X') AS bill_count
    FROM visits v LEFT JOIN plans p1 ON p1.id = v.primary_plan_id LEFT JOIN sponsors s1 ON s1.id = p1.sponsor_id
    WHERE v.mr_no = ? ORDER BY v.admitted_at DESC`).all(req.params.mrNo));
}));

export default router;
