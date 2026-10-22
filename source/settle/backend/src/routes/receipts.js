import { Router } from 'express';
import { db, tx } from '../db.js';
import { requireRight } from '../lib/auth.js';
import { billPayload, insertReceipts, mustGetBill, recalcBill, receiptLabel } from '../lib/billing.js';
import { asyncRoute, audit, bad, conflict, nextNumber, notFound, nowIso, parseJson, r2 } from '../lib/util.js';
import { runAfterPayment } from './bills.js';
import { createDeposit } from './patients.js';

const router = Router();

/* Unified money ledger: bill receipts + deposits in one list */
const LEDGER = `
  SELECT r.receipt_no AS no, CASE WHEN b.restriction_type = 'P' THEN 'pharmacy' ELSE 'bill' END AS kind,
    r.payment_type, r.recpt_type, r.sponsor_index, r.amount, r.tds_amount, r.created_at, r.bill_no, r.mr_no, p.name AS patient_name,
    pm.name AS mode_name, pm.id AS mode_id, r.reference, r.bank, r.card_last4, c.name AS counter_name, c.id AS counter_id, r.username,
    r.status, r.reversal_of, 1 AS realized, r.source, NULL AS available_for, NULL AS payer_name, b.status AS bill_status
  FROM receipts r JOIN bills b ON b.bill_no = r.bill_no JOIN patients p ON p.mr_no = r.mr_no
  JOIN payment_modes pm ON pm.id = r.mode_id LEFT JOIN counters c ON c.id = r.counter_id
  UNION ALL
  SELECT d.deposit_no, 'deposit', CASE WHEN d.deposit_type='R' THEN 'D' ELSE 'DF' END, d.deposit_type, NULL, d.amount, 0, d.created_at,
    d.origin_ref, d.mr_no, p.name, pm.name, pm.id, d.reference, d.bank, d.card_last4, c.name, c.id, d.username,
    d.status, NULL, d.realized, d.origin, d.available_for, d.payer_name, NULL
  FROM deposits d JOIN patients p ON p.mr_no = d.mr_no JOIN payment_modes pm ON pm.id = d.mode_id LEFT JOIN counters c ON c.id = d.counter_id`;

export function ledgerLabel(r) {
  if (r.kind === 'deposit') return r.payment_type === 'D' ? 'Deposit' : 'Deposit refund';
  if (r.reversal_of) return 'Cancellation';
  return receiptLabel(r);
}

router.get('/receipts', asyncRoute((req, res) => {
  const { kind = '', q = '', from = '', to = '', mode = '', counter = '', type = '', status = '', unrealized = '', page = '1', size = '50' } = req.query;
  const where = [];
  const p = {};
  if (kind) { where.push('kind = @kind'); p.kind = kind; }
  if (q) { where.push('(no LIKE @q OR bill_no LIKE @q OR mr_no LIKE @q OR patient_name LIKE @q OR reference LIKE @q)'); p.q = `%${q}%`; }
  if (from) { where.push('substr(created_at,1,10) >= @from'); p.from = from; }
  if (to) { where.push('substr(created_at,1,10) <= @to'); p.to = to; }
  if (mode) { where.push('mode_id = @mode'); p.mode = Number(mode); }
  if (counter) { where.push('counter_id = @counter'); p.counter = Number(counter); }
  if (type === 'refund') where.push("payment_type IN ('F','DF')");
  if (type === 'advance') where.push("payment_type = 'R' AND recpt_type IN ('U','A')");
  if (type === 'settlement') where.push("payment_type = 'R' AND recpt_type = 'S'");
  if (type === 'sponsor') where.push("payment_type = 'S'");
  if (status === 'cancelled') where.push("(status = 'X' OR reversal_of IS NOT NULL)");
  if (status === 'active') where.push("status = 'A' AND reversal_of IS NULL");
  if (unrealized === '1') where.push("realized = 0 AND status = 'A'");
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Number(size) || 50, 500);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const rows = db.prepare(`SELECT * FROM (${LEDGER}) ${w} ORDER BY created_at DESC, no DESC LIMIT ${limit} OFFSET ${offset}`).all(p)
    .map((r) => ({ ...r, label: ledgerLabel(r) }));
  const agg = db.prepare(`SELECT COUNT(*) AS n,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount END),0) AS inflow,
      COALESCE(SUM(CASE WHEN amount < 0 THEN amount END),0) AS outflow
    FROM (${LEDGER}) ${w}`).get(p);
  const unrealizedCount = db.prepare("SELECT COUNT(*) AS n FROM deposits WHERE realized = 0 AND status = 'A'").get().n;
  res.json({ rows, total: agg.n, inflow: r2(agg.inflow), outflow: r2(agg.outflow), unrealizedCount, page: Number(page), size: limit });
}));

function findMoney(no) {
  const r = db.prepare(`SELECT * FROM (${LEDGER}) WHERE no = ?`).get(no);
  if (!r) throw notFound(`${no} not found`);
  return { ...r, label: ledgerLabel(r) };
}

router.get('/receipts/:no', asyncRoute((req, res) => {
  const r = findMoney(req.params.no);
  const raw = r.kind === 'deposit'
    ? db.prepare('SELECT * FROM deposits WHERE deposit_no = ?').get(r.no)
    : db.prepare('SELECT * FROM receipts WHERE receipt_no = ?').get(r.no);
  const reversal = r.kind !== 'deposit' ? db.prepare('SELECT receipt_no FROM receipts WHERE reversal_of = ?').get(r.no) : null;
  const usage = r.kind === 'deposit'
    ? db.prepare('SELECT * FROM deposit_setoffs WHERE deposit_no = ? OR refund_no = ? ORDER BY created_at').all(r.no, r.no) : [];
  const history = db.prepare("SELECT * FROM audit_log WHERE entity IN ('receipt','deposit') AND entity_id = ? ORDER BY at DESC").all(r.no)
    .map((h) => ({ ...h, detail: parseJson(h.detail, {}) }));
  res.json({ ...r, raw, reversal: reversal?.receipt_no || null, usage, history });
}));

router.patch('/receipts/:no', asyncRoute((req, res) => {
  requireRight(req.user, 'edit_receipt');
  const r = db.prepare('SELECT * FROM receipts WHERE receipt_no = ?').get(req.params.no);
  if (!r) throw notFound('Receipt not found');
  if (r.status !== 'A' || r.reversal_of) throw conflict('Cancelled receipts and cancellations cannot be edited.');
  const bill = mustGetBill(r.bill_no);
  if (bill.status === 'C') throw conflict('The bill is closed. Reopen it to edit its receipts.');
  const changes = {};
  for (const [k, col] of Object.entries({ bank: 'bank', reference: 'reference', remarks: 'remarks' })) {
    if (req.body[k] !== undefined) changes[col] = req.body[k] || null;
  }
  if (req.body.modeId !== undefined && Number(req.body.modeId) !== r.mode_id) {
    if (r.card_auth) throw conflict('Card receipts approved by the terminal cannot change mode.');
    const m = db.prepare('SELECT * FROM payment_modes WHERE id = ? AND active = 1').get(req.body.modeId);
    if (!m) throw bad('Choose a valid payment mode.');
    changes.mode_id = m.id;
  }
  if (req.body.amount !== undefined && r2(req.body.amount) !== Math.abs(r.amount)) {
    if (bill.status !== 'A') throw conflict('Amounts can only be edited while the bill is open.');
    if (r.card_auth) throw conflict('Card amounts cannot be edited. Cancel and take the payment again.');
    const a = r2(req.body.amount);
    if (!(a > 0)) throw bad('Amount must be above zero.');
    changes.amount = r.payment_type === 'F' ? -a : a;
  }
  // Receipt type (advance / settlement) is never changed by an edit, so finance accounts stay stable.
  if (!Object.keys(changes).length) return res.json(findMoney(r.receipt_no));
  tx(() => {
    db.prepare(`UPDATE receipts SET ${Object.keys(changes).map((c) => `${c}=@${c}`).join(',')} WHERE receipt_no=@no`).run({ ...changes, no: r.receipt_no });
    audit(req.user, { entity: 'receipt', id: r.receipt_no, billNo: r.bill_no, mrNo: r.mr_no, action: 'update', summary: `Edited ${r.receipt_no}`, detail: { before: r, changes } });
    recalcBill(r.bill_no);
  })();
  res.json(findMoney(r.receipt_no));
}));

router.post('/receipts/:no/cancel', asyncRoute((req, res) => {
  requireRight(req.user, 'edit_receipt');
  const r = db.prepare('SELECT * FROM receipts WHERE receipt_no = ?').get(req.params.no);
  if (!r) throw notFound('Receipt not found');
  if (r.status !== 'A' || r.reversal_of) throw conflict('This receipt is already cancelled.');
  if (!req.body.reason) throw bad('Add a reason for cancelling.');
  const bill = mustGetBill(r.bill_no);
  if (bill.status === 'C') throw conflict('The bill is closed. Reopen it before cancelling receipts.');
  if (bill.status === 'X') throw conflict('The bill is cancelled.');
  if (r.payment_type !== 'F') {
    const after = r2(bill.total_receipts - r.amount + bill.deposit_set_off + bill.points_amount);
    if (r.payment_type === 'R' && after < -0.004) throw conflict('Cancelling this would leave refunds larger than receipts. Cancel the refund first.');
  }
  if (!req.user.counter_id) throw conflict('Pick a counter in the header first.', 'no_counter');
  const out = tx(() => {
    const series = r.payment_type === 'F' ? 'refund' : r.payment_type === 'S' ? 'sponsor' : 'receipt';
    const no = nextNumber(series);
    db.prepare(`INSERT INTO receipts (receipt_no, bill_no, mr_no, payment_type, recpt_type, sponsor_index, amount, tds_amount, mode_id, bank, reference,
        card_last4, card_auth, card_rrn, terminal_id, counter_id, username, created_at, remarks, status, reversal_of, source)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'A', ?, 'cancel')`).run(no, r.bill_no, r.mr_no, r.payment_type, r.recpt_type, r.sponsor_index,
      -r.amount, -r.tds_amount, r.mode_id, r.bank, r.card_rrn || r.reference, r.card_last4, r.card_auth ? `VOID-${r.card_auth}` : null, r.card_rrn,
      r.terminal_id, req.user.counter_id, req.user.username, nowIso(), req.body.reason, r.receipt_no);
    db.prepare("UPDATE receipts SET status='X', cancel_reason=? WHERE receipt_no=?").run(req.body.reason, r.receipt_no);
    audit(req.user, { entity: 'receipt', id: r.receipt_no, billNo: r.bill_no, mrNo: r.mr_no, action: 'cancel',
      summary: `Cancelled ${r.receipt_no}${r.card_auth ? ' (voided on terminal)' : ''}`, detail: { reason: req.body.reason, reversal: no } });
    recalcBill(r.bill_no);
    return no;
  })();
  res.json({ ok: true, reversal: out });
}));

/* ---------------------------------------------------------------- card terminal */
router.get('/card-txns/:id', asyncRoute((req, res) => {
  const t = db.prepare('SELECT * FROM card_txns WHERE id = ?').get(req.params.id);
  if (!t) throw notFound('Card transaction not found');
  res.json({ ...t, payload: parseJson(t.payload, {}), result: parseJson(t.result, null) });
}));

router.post('/card-txns/:id/approve', asyncRoute((req, res) => {
  const t = db.prepare('SELECT * FROM card_txns WHERE id = ?').get(req.params.id);
  if (!t) throw notFound('Card transaction not found');
  if (t.status !== 'pending') throw conflict(`This card payment is already ${t.status}.`);
  const payload = parseJson(t.payload, {});
  const meta = {
    last4: String(1000 + Math.floor(Math.random() * 9000)),
    auth: String(Math.floor(100000 + Math.random() * 900000)),
    rrn: String(Date.now()).slice(-12),
    terminal: t.terminal_id,
  };
  const out = tx(() => {
    db.prepare("UPDATE card_txns SET status='approved', result=? WHERE id=?").run(JSON.stringify(meta), t.id);
    if (t.purpose === 'deposit') {
      return { depositNo: createDeposit(req.user, t.mr_no, payload, meta) };
    }
    const bill = recalcBill(t.bill_no);
    const modes = new Map(db.prepare('SELECT * FROM payment_modes').all().map((m) => [m.id, m]));
    const isCard = (r) => modes.get(Number(r.modeId))?.requires_card && r.kind !== 'refund';
    const created = [
      ...insertReceipts(req.user, bill, payload.rows.filter(isCard), { cardMeta: meta }),
      ...(payload.rows.some((r) => !isCard(r)) ? insertReceipts(req.user, recalcBill(t.bill_no), payload.rows.filter((r) => !isCard(r))) : []),
    ];
    const after = runAfterPayment(req.user, t.bill_no, payload);
    return { receipts: created.map((c) => c.receipt_no), ...after };
  })();
  res.json({ status: 'approved', meta, result: out, bill: t.bill_no ? billPayload(req.user, t.bill_no) : null });
}));

router.post('/card-txns/:id/decline', asyncRoute((req, res) => {
  const t = db.prepare('SELECT * FROM card_txns WHERE id = ?').get(req.params.id);
  if (!t) throw notFound('Card transaction not found');
  if (t.status !== 'pending') throw conflict(`This card payment is already ${t.status}.`);
  db.prepare("UPDATE card_txns SET status='declined', result=? WHERE id=?").run(JSON.stringify({ reason: req.body.reason || 'Declined by card issuer' }), t.id);
  audit(req.user, { entity: 'card_txn', id: t.id, billNo: t.bill_no, mrNo: t.mr_no, action: 'declined', summary: `Card payment of ${t.amount.toFixed(2)} declined` });
  res.json({ status: 'declined' });
}));

export default router;
