import { db } from '../db.js';
import { RIGHTS, can } from './auth.js';
import { audit, bad, conflict, forbidden, isZero, nextNumber, notFound, nowIso, parseJson, pref, r2 } from './util.js';

/* ======================================================================
   Lookups
   ====================================================================== */
export const getBillRow = (billNo) => db.prepare('SELECT * FROM bills WHERE bill_no = ?').get(billNo);

export function mustGetBill(billNo) {
  const b = getBillRow(billNo);
  if (!b) throw notFound(`Bill ${billNo} not found`);
  return b;
}

export function assertOpen(bill, what = 'change this bill') {
  if (bill.status !== 'A') {
    throw conflict(`Bill ${bill.bill_no} is ${STATUS_LABEL[bill.status].toLowerCase()}. Reopen it to ${what}.`, 'bill_locked');
  }
}

export const STATUS_LABEL = { A: 'Open', F: 'Finalized', C: 'Closed', X: 'Cancelled' };

const claimPlans = db.prepare(`SELECT bc.*, p.name AS plan_name, p.copay_pct, p.claim_cap, p.non_payable_groups,
    s.name AS sponsor_name, s.id AS sponsor_id
  FROM bill_claims bc JOIN plans p ON p.id = bc.plan_id JOIN sponsors s ON s.id = p.sponsor_id
  WHERE bc.bill_no = ? ORDER BY bc.priority`);

/* ======================================================================
   Totals — recalculated in JS on every change (single source of truth)
   ====================================================================== */
export function recalcBill(billNo) {
  const bill = mustGetBill(billNo);
  const plans = bill.is_tpa ? claimPlans.all(billNo) : [];
  const p1 = plans.find((p) => p.priority === 1);
  const p2 = plans.find((p) => p.priority === 2);
  const np1 = new Set(parseJson(p1?.non_payable_groups, []));
  const np2 = new Set(parseJson(p2?.non_payable_groups, []));
  let used1 = 0;
  let used2 = 0;

  const charges = db.prepare("SELECT * FROM charges WHERE bill_no = ? AND is_system = 0 ORDER BY charge_id").all(billNo);
  const upd = db.prepare(`UPDATE charges SET amount=@amount, vat=@vat, primary_claim=@primary_claim,
      secondary_claim=@secondary_claim, sponsor_vat=@sponsor_vat, discount=@discount WHERE charge_id=@charge_id`);

  let total = 0, disc = 0, vat = 0, c1 = 0, c2 = 0, svat = 0;
  for (const c of charges) {
    if (c.status === 'X') {
      upd.run({ charge_id: c.charge_id, amount: 0, vat: 0, primary_claim: 0, secondary_claim: 0, sponsor_vat: 0, discount: 0 });
      continue;
    }
    const amount = r2(c.rate * c.qty);
    const discount = Math.min(r2(c.discount), amount);
    const net = r2(amount - discount);
    const cvat = r2((net * c.vat_rate) / 100);
    let claim1 = 0, claim2 = 0;
    if (bill.is_tpa && c.insurance_payable) {
      if (c.claim_override) {
        claim1 = Math.min(c.primary_claim, net);
        claim2 = Math.min(c.secondary_claim, r2(net - claim1));
      } else {
        if (p1 && !np1.has(c.charge_group)) {
          claim1 = r2(net * (1 - p1.copay_pct / 100));
          if (p1.claim_cap != null) claim1 = Math.max(0, Math.min(claim1, r2(p1.claim_cap - used1)));
        }
        const remainder = r2(net - claim1);
        if (p2 && remainder > 0 && !np2.has(c.charge_group)) {
          claim2 = r2(remainder * (1 - p2.copay_pct / 100));
          if (p2.claim_cap != null) claim2 = Math.max(0, Math.min(claim2, r2(p2.claim_cap - used2)));
        }
      }
    }
    used1 = r2(used1 + claim1);
    used2 = r2(used2 + claim2);
    const sv = r2(((claim1 + claim2) * c.vat_rate) / 100);
    upd.run({ charge_id: c.charge_id, amount, vat: cvat, primary_claim: claim1, secondary_claim: claim2, sponsor_vat: sv, discount });
    total += amount; disc += discount; vat += cvat; c1 += claim1; c2 += claim2; svat += sv;
  }
  total = r2(total); disc = r2(disc); vat = r2(vat); c1 = r2(c1); c2 = r2(c2); svat = r2(svat);
  const claim = r2(c1 + c2);

  // Round-off is a system charge (head ROF) so it shows on prints like any line.
  const prePatient = r2(total - disc + vat - claim - svat);
  const rof = pref('round_off_enabled', true) ? r2(Math.round(prePatient) - prePatient) : 0;
  const rofRow = db.prepare("SELECT charge_id FROM charges WHERE bill_no = ? AND is_system = 1 AND charge_head = 'ROF'").get(billNo);
  if (!isZero(rof)) {
    if (rofRow) db.prepare("UPDATE charges SET rate=?, amount=?, status='A' WHERE charge_id=?").run(rof, rof, rofRow.charge_id);
    else db.prepare(`INSERT INTO charges (bill_no, description, charge_group, charge_head, orig_rate, rate, qty, amount,
        insurance_payable, is_system, posted_at, posted_by) VALUES (?, 'Round-off', 'ROF', 'ROF', 0, ?, 1, ?, 0, 1, ?, 'system')`)
      .run(billNo, rof, rof, nowIso());
  } else if (rofRow) {
    db.prepare('DELETE FROM charges WHERE charge_id = ?').run(rofRow.charge_id);
  }

  const patientAmount = r2(prePatient + rof);
  const rec = db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN payment_type IN ('R','F') THEN amount END),0) AS patient,
      COALESCE(SUM(CASE WHEN payment_type = 'S' THEN amount + tds_amount END),0) AS sponsor
    FROM receipts WHERE bill_no = ?`).get(billNo);
  const setoff = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM deposit_setoffs WHERE bill_no = ? AND set_off_type = 'R'").get(billNo).s;
  const paid = r2(rec.patient + setoff + bill.points_amount);
  const patientDue = r2(patientAmount - paid);
  const sponsorDue = bill.is_tpa ? r2(claim + svat - rec.sponsor) : 0;
  let paymentStatus = bill.status === 'C' ? 'P' : (patientDue <= 0.004 && sponsorDue <= 0.004 && patientAmount + claim > 0 ? 'P' : 'U');

  db.prepare(`UPDATE bills SET total_amount=@total, total_discount=@disc, total_vat=@vat, total_claim=@claim,
      primary_claim=@c1, secondary_claim=@c2, sponsor_vat=@svat, round_off=@rof, patient_amount=@pa,
      total_receipts=@tr, sponsor_receipts=@sr, deposit_set_off=@so, patient_due=@pd, sponsor_due=@sd,
      payment_status=@ps, updated_at=@now WHERE bill_no=@bill_no`).run({
    total: r2(total + rof), disc, vat, claim, c1, c2, svat, rof, pa: patientAmount, tr: r2(rec.patient), sr: r2(rec.sponsor),
    so: r2(setoff), pd: patientDue, sd: sponsorDue, ps: paymentStatus, now: nowIso(), bill_no: billNo,
  });
  return getBillRow(billNo);
}

/* ======================================================================
   Deposits
   ====================================================================== */
export function depositBalances(mrNo) {
  return db.prepare(`SELECT d.*, pm.name AS mode_name,
      d.amount - COALESCE((SELECT SUM(s.amount) FROM deposit_setoffs s WHERE s.deposit_no = d.deposit_no),0) AS balance,
      COALESCE((SELECT SUM(s.amount) FROM deposit_setoffs s WHERE s.deposit_no = d.deposit_no AND s.set_off_type='R'),0) AS set_off,
      COALESCE((SELECT SUM(s.amount) FROM deposit_setoffs s WHERE s.deposit_no = d.deposit_no AND s.set_off_type='F'),0) AS refunded
    FROM deposits d JOIN payment_modes pm ON pm.id = d.mode_id
    WHERE d.mr_no = ? ORDER BY d.created_at`).all(mrNo).map((d) => ({ ...d, balance: r2(d.balance) }));
}

export function availableDeposits(mrNo, restrictionType) {
  const scope = restrictionType === 'P' ? ['P', 'B'] : ['H', 'B'];
  return depositBalances(mrNo).filter((d) => d.deposit_type === 'R' && d.status === 'A' && d.realized && d.balance > 0.004 && scope.includes(d.available_for));
}

export function depositSummary(mrNo) {
  const all = depositBalances(mrNo).filter((d) => d.status === 'A');
  const collected = r2(all.filter((d) => d.deposit_type === 'R' && d.realized).reduce((s, d) => s + d.amount, 0));
  const pending = r2(all.filter((d) => d.deposit_type === 'R' && !d.realized).reduce((s, d) => s + d.amount, 0));
  const setOff = r2(all.reduce((s, d) => s + (d.deposit_type === 'R' ? d.set_off : 0), 0));
  const refunded = r2(all.reduce((s, d) => s + (d.deposit_type === 'R' ? d.refunded : 0), 0));
  const balance = r2(all.filter((d) => d.deposit_type === 'R' && d.realized).reduce((s, d) => s + d.balance, 0));
  const hospital = r2(availableDeposits(mrNo, 'N').reduce((s, d) => s + d.balance, 0));
  const pharmacy = r2(availableDeposits(mrNo, 'P').reduce((s, d) => s + d.balance, 0));
  return { collected, pending, setOff, refunded, balance, hospital, pharmacy };
}

/** Allocates `amount` of set-off across a patient's deposits (oldest first unless explicit). */
export function setOffDeposits(user, bill, { amount, allocations }) {
  if (!can(user, 'allow_deposit_setoff')) throw forbidden('You need the “Set off deposits” right for this.');
  if (bill.status === 'X' || bill.status === 'C') throw conflict('Deposits can only be set off on open or finalized bills.');
  const avail = availableDeposits(bill.mr_no, bill.restriction_type);
  const due = r2(bill.patient_due);
  let plan = [];
  if (Array.isArray(allocations) && allocations.length) {
    for (const a of allocations) {
      const d = avail.find((x) => x.deposit_no === a.depositNo);
      if (!d) throw bad(`Deposit ${a.depositNo} has no usable balance for this bill.`);
      const amt = r2(a.amount);
      if (amt <= 0) continue;
      if (amt > d.balance + 0.004) throw bad(`Deposit ${d.deposit_no} only has ${d.balance.toFixed(2)} left.`);
      plan.push({ deposit_no: d.deposit_no, amount: amt });
    }
  } else {
    let left = r2(amount);
    for (const d of avail) {
      if (left <= 0) break;
      const take = Math.min(left, d.balance);
      plan.push({ deposit_no: d.deposit_no, amount: r2(take) });
      left = r2(left - take);
    }
    if (left > 0.004) throw bad(`Only ${r2(avail.reduce((s, d) => s + d.balance, 0)).toFixed(2)} is available in deposits.`);
  }
  const total = r2(plan.reduce((s, p) => s + p.amount, 0));
  if (total <= 0) throw bad('Enter an amount to set off.');
  if (total > due + 0.004) throw bad(`Set-off (${total.toFixed(2)}) is more than the patient due (${due.toFixed(2)}).`);
  const ins = db.prepare(`INSERT INTO deposit_setoffs (deposit_no, set_off_type, bill_no, amount, created_at, username)
    VALUES (?, 'R', ?, ?, ?, ?)`);
  for (const p of plan) ins.run(p.deposit_no, bill.bill_no, p.amount, nowIso(), user.username);
  audit(user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'deposit_setoff',
    summary: `Set off ${total.toFixed(2)} from deposits`, detail: { plan } });
  return recalcBill(bill.bill_no);
}

/* ======================================================================
   Receipts
   ====================================================================== */
const KIND = {
  advance: { payment_type: 'R', recpt_type: 'U', series: 'receipt', label: 'Advance' },
  settlement: { payment_type: 'R', recpt_type: 'S', series: 'receipt', label: 'Settlement' },
  refund: { payment_type: 'F', series: 'refund', label: 'Refund' },
  sponsor_advance: { payment_type: 'S', recpt_type: 'A', series: 'sponsor', label: 'Sponsor advance' },
  sponsor_settlement: { payment_type: 'S', recpt_type: 'S', series: 'sponsor', label: 'Sponsor settlement' },
};

export function advanceBalance(billNo) {
  return r2(db.prepare(`SELECT COALESCE(SUM(amount),0) AS a FROM receipts
    WHERE bill_no = ? AND payment_type IN ('R','F') AND recpt_type IN ('U','A')`).get(billNo).a);
}

export function validatePaymentRows(user, bill, rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw bad('Add at least one payment row.');
  const modes = new Map(db.prepare('SELECT * FROM payment_modes').all().map((m) => [m.id, m]));
  for (const [i, r] of rows.entries()) {
    const k = KIND[r.kind];
    const n = i + 1;
    if (!k) throw bad(`Row ${n}: unknown payment type.`);
    const amt = r2(r.amount);
    if (!(amt > 0)) throw bad(`Row ${n}: enter an amount above zero.`);
    const mode = modes.get(Number(r.modeId));
    if (!mode || !mode.active) throw bad(`Row ${n}: choose a payment mode.`);
    if (mode.requires_bank && !r.bank) throw bad(`Row ${n}: ${mode.name} needs the bank name.`);
    if (mode.requires_reference && !r.reference) throw bad(`Row ${n}: ${mode.name} needs a reference number.`);
    if (r.kind === 'advance' && bill.bill_type !== 'C') throw bad('Advances are only taken on Bill Later (credit) bills.');
    if (r.kind === 'advance' && bill.status !== 'A') throw bad('Advances can only be taken while the bill is open.');
    if (r.kind.startsWith('sponsor') && !bill.is_tpa) throw bad('Sponsor receipts need an insured bill.');
    if (r.kind.startsWith('sponsor') && !['P', 'S'].includes(r.sponsorIndex || 'P')) throw bad('Choose primary or secondary sponsor.');
    if (r.kind === 'refund' && !can(user, 'allow_refund')) throw forbidden('You need the “Issue refunds” right to refund.');
  }
  if (bill.status === 'X') throw conflict('This bill is cancelled.');
  const refundTotal = r2(rows.filter((r) => r.kind === 'refund').reduce((s, r) => s + r2(r.amount), 0));
  if (refundTotal > 0 && refundTotal > r2(bill.total_receipts) + 0.004) {
    throw bad(`You can refund at most ${r2(bill.total_receipts).toFixed(2)} — that is what was received on this bill.`);
  }
  return modes;
}

/**
 * Inserts receipts for payment rows. Refunds are classified against the bill's advance balance:
 * fully covered → U, no advance → S, partly → split into a U and an S refund.
 */
export function insertReceipts(user, bill, rows, { counterId, cardMeta = {}, source = 'bill', at } = {}) {
  const counter = counterId ?? user.counter_id;
  if (!counter) throw conflict('Pick a counter in the header before taking payments.', 'no_counter');
  const created = [];
  const ins = db.prepare(`INSERT INTO receipts (receipt_no, bill_no, mr_no, payment_type, recpt_type, sponsor_index, amount, tds_amount,
      mode_id, bank, reference, card_last4, card_auth, card_rrn, terminal_id, counter_id, username, created_at, remarks, source)
    VALUES (@receipt_no, @bill_no, @mr_no, @payment_type, @recpt_type, @sponsor_index, @amount, @tds_amount, @mode_id, @bank, @reference,
      @card_last4, @card_auth, @card_rrn, @terminal_id, @counter_id, @username, @created_at, @remarks, @source)`);
  const base = (r) => ({
    bill_no: bill.bill_no, mr_no: bill.mr_no, sponsor_index: null, tds_amount: 0, mode_id: Number(r.modeId),
    bank: r.bank || null, reference: r.reference || null, card_last4: r.cardLast4 || cardMeta.last4 || null,
    card_auth: cardMeta.auth || null, card_rrn: cardMeta.rrn || null, terminal_id: cardMeta.terminal || null,
    counter_id: counter, username: user.username, created_at: at || nowIso(), remarks: r.remarks || null, source,
  });
  for (const r of rows) {
    const k = KIND[r.kind];
    const amount = r2(r.amount);
    if (r.kind === 'refund') {
      const adv = advanceBalance(bill.bill_no);
      const parts = adv <= 0.004 ? [['S', amount]] : amount <= adv + 0.004 ? [['U', amount]] : [['U', adv], ['S', r2(amount - adv)]];
      for (const [rt, a] of parts) {
        const row = { ...base(r), receipt_no: nextNumber('refund'), payment_type: 'F', recpt_type: rt, amount: -a };
        ins.run(row);
        created.push(row);
      }
    } else {
      const row = { ...base(r), receipt_no: nextNumber(k.series), payment_type: k.payment_type, recpt_type: k.recpt_type, amount,
        sponsor_index: k.payment_type === 'S' ? r.sponsorIndex || 'P' : null, tds_amount: k.payment_type === 'S' ? r2(r.tds || 0) : 0 };
      ins.run(row);
      created.push(row);
    }
  }
  for (const c of created) {
    audit(user, { entity: 'receipt', id: c.receipt_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: 'create',
      summary: `${receiptLabel(c)} ${Math.abs(c.amount).toFixed(2)}`, detail: c });
  }
  recalcBill(bill.bill_no);
  return created;
}

export function receiptLabel(r) {
  if (r.payment_type === 'F') return r.recpt_type === 'U' ? 'Advance refund' : 'Settlement refund';
  if (r.payment_type === 'S') return r.recpt_type === 'A' ? 'Sponsor advance' : 'Sponsor settlement';
  return r.recpt_type === 'S' ? 'Settlement' : 'Advance';
}

/* ======================================================================
   Lifecycle checks — returned to the UI so every disabled action explains itself
   ====================================================================== */
export function pendingApprovals(billNo) {
  return db.prepare("SELECT * FROM approvals WHERE bill_no = ? AND status = 'pending' ORDER BY requested_at").all(billNo);
}

export function lifecycle(user, bill) {
  const charges = db.prepare('SELECT * FROM charges WHERE bill_no = ? AND is_system = 0').all(bill.bill_no);
  const active = charges.filter((c) => c.status === 'A');
  const pend = pendingApprovals(bill.bill_no);
  const res = {};
  const set = (key, reasons, right) => {
    if (right && !can(user, right)) reasons = [...reasons, `You need the “${RIGHTS[right]}” right`];
    res[key] = { allowed: reasons.length === 0, reasons };
  };

  const fin = [];
  if (bill.status !== 'A') fin.push('Only open bills can be finalized');
  if (!active.length) fin.push('Add at least one charge');
  const pendingResults = active.filter((c) => c.pending_result).length;
  if (pendingResults) fin.push(`${pendingResults} test${pendingResults > 1 ? 's have' : ' has'} pending results`);
  if (pend.some((p) => p.kind === 'discount')) fin.push('A discount is waiting for approval');
  if (pend.some((p) => p.kind === 'cancellation')) fin.push('A cancellation request is pending');
  set('finalize', fin, 'edit_bill');

  const close = [];
  if (bill.status !== 'F') close.push('Finalize the bill first');
  if (bill.patient_due > 0.004 && bill.patient_writeoff !== 'A') close.push(`Patient still owes ${bill.patient_due.toFixed(2)}`);
  if (bill.patient_due < -0.004) close.push(`Patient has overpaid ${(-bill.patient_due).toFixed(2)}`);
  if (bill.is_tpa && bill.sponsor_due > 0.004 && bill.sponsor_writeoff !== 'A') close.push(`Sponsor still owes ${bill.sponsor_due.toFixed(2)}`);
  set('close', close, 'edit_bill');

  const reopen = [];
  if (!['F', 'C'].includes(bill.status)) reopen.push('Only finalized or closed bills can be reopened');
  if (bill.claim_status === 'S') reopen.push('The claim has been sent to the sponsor');
  set('reopen', reopen, 'bill_reopen');

  const cancel = [];
  if (bill.status !== 'A') cancel.push('Only open bills can be cancelled');
  const linked = active.filter((c) => c.order_linked).length;
  if (linked) cancel.push(`${linked} charge${linked > 1 ? 's are' : ' is'} linked to orders — cancel the orders first`);
  if (!isZero(bill.total_receipts)) cancel.push(`Net receipts are ${bill.total_receipts.toFixed(2)} — refund them first`);
  if (!isZero(bill.deposit_set_off)) cancel.push('Remove the deposit set-off first');
  if (bill.points_redeemed) cancel.push('Release redeemed points first');
  if (!isZero(bill.sponsor_receipts)) cancel.push('Sponsor receipts exist on this bill');
  if (bill.cancellation_status === 'S') cancel.push('Cancellation is already waiting for approval');
  set('cancel', cancel, 'cancel_bill');

  const wo = [];
  if (bill.status !== 'F') wo.push('Only finalized bills can be written off');
  if (bill.bill_type === 'P') wo.push('Bill Now bills cannot be written off');
  if (!(bill.patient_due > 0.004)) wo.push('Nothing is due from the patient');
  if (bill.patient_writeoff !== 'N') wo.push(bill.patient_writeoff === 'M' ? 'Write-off is waiting for approval' : 'Write-off already approved');
  set('writeoff', wo, 'patient_writeoff');

  const claim = [];
  if (!bill.is_tpa) claim.push('Bill is not insured');
  if (bill.status !== 'F') claim.push('Finalize the bill first');
  if (bill.claim_status !== 'O') claim.push('Claim already sent');
  if (!(bill.total_claim > 0)) claim.push('No sponsor amount on this bill');
  set('sendClaim', claim, 'edit_bill');

  const edit = [];
  if (bill.status !== 'A') edit.push(`Bill is ${STATUS_LABEL[bill.status].toLowerCase()}`);
  set('editCharges', edit, 'edit_bill');

  const pay = [];
  if (bill.status === 'X') pay.push('Bill is cancelled');
  if (bill.status === 'C') pay.push('Bill is closed');
  if (!user.counter_id) pay.push('Pick a counter in the header first');
  set('takePayment', pay);

  return res;
}

/* ======================================================================
   Finalize overpayment: trim set-offs/points first, then refund + new deposit
   ====================================================================== */
export function settleOverpayment(user, billNo) {
  let bill = recalcBill(billNo);
  let excess = r2(-bill.patient_due);
  if (excess <= 0.004) return { refunds: [], deposit: null, trimmed: 0 };
  let trimmed = 0;
  const setoffs = db.prepare("SELECT * FROM deposit_setoffs WHERE bill_no = ? AND set_off_type='R' ORDER BY id DESC").all(billNo);
  for (const s of setoffs) {
    if (excess <= 0.004) break;
    const take = Math.min(excess, s.amount);
    if (take >= s.amount - 0.004) db.prepare('DELETE FROM deposit_setoffs WHERE id = ?').run(s.id);
    else db.prepare('UPDATE deposit_setoffs SET amount = ? WHERE id = ?').run(r2(s.amount - take), s.id);
    excess = r2(excess - take);
    trimmed = r2(trimmed + take);
  }
  if (excess > 0.004 && bill.points_amount > 0) {
    const rate = pref('points_redemption_rate', 0.25);
    const take = Math.min(excess, bill.points_amount);
    const pts = Math.round(take / rate);
    db.prepare('UPDATE bills SET points_amount = points_amount - ?, points_redeemed = MAX(0, points_redeemed - ?) WHERE bill_no = ?').run(r2(take), pts, billNo);
    db.prepare('UPDATE reward_points SET redeemed = MAX(0, redeemed - ?) WHERE mr_no = ?').run(pts, bill.mr_no);
    excess = r2(excess - take);
    trimmed = r2(trimmed + take);
  }
  bill = recalcBill(billNo);
  if (excess <= 0.004) return { refunds: [], deposit: null, trimmed };
  const sys = db.prepare('SELECT id FROM counters WHERE is_system = 1 LIMIT 1').get();
  const cash = db.prepare("SELECT id FROM payment_modes WHERE code = 'CASH'").get();
  const refunds = insertReceipts(user, bill, [{ kind: 'refund', amount: excess, modeId: cash.id, remarks: 'Excess on finalization moved to deposit' }],
    { counterId: sys.id, source: 'system' });
  const depositNo = nextNumber('deposit');
  db.prepare(`INSERT INTO deposits (deposit_no, mr_no, deposit_type, amount, mode_id, realized, realized_at, available_for,
      counter_id, username, created_at, remarks, origin, origin_ref)
    VALUES (?, ?, 'R', ?, ?, 1, ?, 'B', ?, ?, ?, ?, 'overpayment', ?)`)
    .run(depositNo, bill.mr_no, excess, cash.id, nowIso(), sys.id, user.username, nowIso(), `Excess from bill ${billNo}`, billNo);
  audit(user, { entity: 'deposit', id: depositNo, billNo, mrNo: bill.mr_no, action: 'create',
    summary: `Excess ${excess.toFixed(2)} moved to deposit ${depositNo}`, detail: { refunds: refunds.map((r) => r.receipt_no) } });
  recalcBill(billNo);
  return { refunds, deposit: depositNo, trimmed };
}

/* ======================================================================
   Full bill payload for the workspace
   ====================================================================== */
export function billPayload(user, billNo) {
  const bill = mustGetBill(billNo);
  const patient = db.prepare('SELECT * FROM patients WHERE mr_no = ?').get(bill.mr_no);
  const visit = db.prepare('SELECT * FROM visits WHERE visit_id = ?').get(bill.visit_id);
  const ratePlan = bill.rate_plan_id ? db.prepare('SELECT * FROM rate_plans WHERE id = ?').get(bill.rate_plan_id) : null;
  const claims = claimPlans.all(billNo);
  const charges = db.prepare('SELECT * FROM charges WHERE bill_no = ? ORDER BY is_system, charge_id').all(billNo);
  const receipts = db.prepare(`SELECT r.*, pm.name AS mode_name, c.name AS counter_name FROM receipts r
      JOIN payment_modes pm ON pm.id = r.mode_id LEFT JOIN counters c ON c.id = r.counter_id
      WHERE r.bill_no = ? ORDER BY r.created_at, r.receipt_no`).all(billNo).map((r) => ({ ...r, label: receiptLabel(r) }));
  const setoffs = db.prepare(`SELECT s.*, d.created_at AS deposit_date, d.available_for FROM deposit_setoffs s
      JOIN deposits d ON d.deposit_no = s.deposit_no WHERE s.bill_no = ? ORDER BY s.id`).all(billNo);
  const approvals = db.prepare('SELECT * FROM approvals WHERE bill_no = ? ORDER BY requested_at DESC').all(billNo)
    .map((a) => ({ ...a, payload: parseJson(a.payload, {}) }));
  const siblings = db.prepare(`SELECT bill_no, bill_type, restriction_type, is_primary, status, patient_amount, patient_due
      FROM bills WHERE visit_id = ? ORDER BY created_at`).all(bill.visit_id);
  const deposits = depositSummary(bill.mr_no);
  const usable = r2(availableDeposits(bill.mr_no, bill.restriction_type).reduce((s, d) => s + d.balance, 0));
  const points = db.prepare('SELECT * FROM reward_points WHERE mr_no = ?').get(bill.mr_no) || { earned: 0, redeemed: 0 };
  const history = db.prepare('SELECT * FROM audit_log WHERE bill_no = ? ORDER BY at DESC, id DESC LIMIT 200').all(billNo)
    .map((h) => ({ ...h, detail: parseJson(h.detail, {}) }));
  return {
    bill: { ...bill, status_label: STATUS_LABEL[bill.status], advance_balance: advanceBalance(billNo) },
    patient, visit, ratePlan, claims, charges, receipts, setoffs, approvals, siblings, history,
    deposits: { ...deposits, usable },
    points: { balance: points.earned - points.redeemed, rate: pref('points_redemption_rate', 0.25) },
    actions: lifecycle(user, bill),
  };
}
