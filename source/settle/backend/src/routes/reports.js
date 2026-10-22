import { Router } from 'express';
import { db } from '../db.js';
import { requireRight } from '../lib/auth.js';
import { asyncRoute, audit, bad, conflict, nowIso, r2, todayIso } from '../lib/util.js';
import { ledgerLabel } from './receipts.js';

const router = Router();

const MONEY = `
  SELECT r.receipt_no AS no, 'bill' AS kind, r.payment_type, r.recpt_type, r.amount + r.tds_amount AS amount, r.created_at,
    r.bill_no, r.mr_no, p.name AS patient_name, pm.name AS mode_name, pm.code AS mode_code, r.counter_id, c.name AS counter_name,
    c.is_system, r.username, r.reversal_of, r.status
  FROM receipts r JOIN patients p ON p.mr_no = r.mr_no JOIN payment_modes pm ON pm.id = r.mode_id LEFT JOIN counters c ON c.id = r.counter_id
  UNION ALL
  SELECT d.deposit_no, 'deposit', CASE WHEN d.deposit_type='R' THEN 'D' ELSE 'DF' END, d.deposit_type, d.amount, d.created_at,
    d.origin_ref, d.mr_no, p.name, pm.name, pm.code, d.counter_id, c.name, c.is_system, d.username, NULL, d.status
  FROM deposits d JOIN patients p ON p.mr_no = d.mr_no JOIN payment_modes pm ON pm.id = d.mode_id LEFT JOIN counters c ON c.id = d.counter_id
  WHERE d.status = 'A'`;

const typeOf = (r) => {
  if (r.kind === 'deposit') return r.payment_type === 'D' ? 'Deposits' : 'Deposit refunds';
  if (r.payment_type === 'S') return 'Sponsor receipts';
  if (r.payment_type === 'F') return 'Refunds';
  return r.recpt_type === 'S' ? 'Settlements' : 'Advances';
};

/* ---------------------------------------------------------------- dashboard */
router.get('/dashboard', asyncRoute((req, res) => {
  const today = todayIso();
  const items = db.prepare(`SELECT * FROM (${MONEY}) WHERE substr(created_at,1,10) = ?`).all(today);
  const byMode = {};
  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, amount: 0 }));
  let inflow = 0, outflow = 0, mine = 0;
  for (const i of items) {
    byMode[i.mode_name] = r2((byMode[i.mode_name] || 0) + i.amount);
    if (i.amount > 0) inflow += i.amount; else outflow += i.amount;
    hourly[new Date(i.created_at).getHours()].amount = r2(hourly[new Date(i.created_at).getHours()].amount + i.amount);
    if (i.counter_id === req.user.counter_id) mine += i.amount;
  }
  const stats = db.prepare(`SELECT
      SUM(CASE WHEN status='A' THEN 1 ELSE 0 END) AS open_bills,
      SUM(CASE WHEN status='F' AND patient_due > 0.004 THEN 1 ELSE 0 END) AS finalized_with_due,
      SUM(CASE WHEN status IN ('A','F') AND patient_due < -0.004 THEN 1 ELSE 0 END) AS overpaid,
      SUM(CASE WHEN status='F' AND is_tpa=1 AND claim_status='O' THEN 1 ELSE 0 END) AS claims_to_send,
      SUM(CASE WHEN status IN ('A','F') AND patient_due > 0.004 THEN patient_due ELSE 0 END) AS patient_outstanding,
      SUM(CASE WHEN status IN ('F','C') AND is_tpa = 1 AND sponsor_due > 0.004 THEN sponsor_due ELSE 0 END) AS sponsor_outstanding
    FROM bills`).get();
  const approvals = db.prepare("SELECT kind, COUNT(*) AS n FROM approvals WHERE status='pending' GROUP BY kind").all();
  const unrealized = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS amount FROM deposits WHERE realized=0 AND status='A'").get();
  const attention = db.prepare(`SELECT b.bill_no, b.status, b.patient_due, b.sponsor_due, b.is_tpa, b.claim_status, p.name AS patient_name,
      (SELECT COUNT(*) FROM charges c WHERE c.bill_no = b.bill_no AND c.pending_result = 1 AND c.status='A') AS pending_results,
      (SELECT COUNT(*) FROM approvals a WHERE a.bill_no = b.bill_no AND a.status='pending') AS pending_approvals
    FROM bills b JOIN patients p ON p.mr_no = b.mr_no
    WHERE b.status IN ('A','F') AND (b.patient_due < -0.004 OR (b.status='F' AND b.patient_due > 0.004)
      OR (b.status='F' AND b.is_tpa=1 AND b.claim_status='O'))
    ORDER BY ABS(b.patient_due) DESC LIMIT 8`).all();
  const recent = db.prepare('SELECT * FROM audit_log ORDER BY at DESC, id DESC LIMIT 12').all();
  const closed = req.user.counter_id ? db.prepare('SELECT * FROM counter_closures WHERE counter_id = ? AND business_date = ?').get(req.user.counter_id, today) : null;
  res.json({
    today, inflow: r2(inflow), outflow: r2(outflow), net: r2(inflow + outflow), mine: r2(mine), count: items.length,
    byMode: Object.entries(byMode).map(([mode, amount]) => ({ mode, amount })).sort((a, b) => b.amount - a.amount),
    hourly, stats, approvals, unrealized, attention, recent, counterClosed: !!closed,
  });
}));

/* ---------------------------------------------------------------- day book */
router.get('/daybook', asyncRoute((req, res) => {
  const date = req.query.date || todayIso();
  const counters = db.prepare('SELECT * FROM counters WHERE active = 1 ORDER BY is_system, name').all();
  const items = db.prepare(`SELECT * FROM (${MONEY}) WHERE substr(created_at,1,10) = ? ORDER BY created_at`).all(date)
    .map((i) => ({ ...i, type: typeOf(i), label: ledgerLabel({ ...i, kind: i.kind }) }));
  const closures = db.prepare('SELECT * FROM counter_closures WHERE business_date = ?').all(date);
  const summary = counters.map((c) => {
    const mine = items.filter((i) => i.counter_id === c.id);
    const modes = {};
    for (const i of mine) {
      modes[i.mode_name] ??= { mode: i.mode_name, code: i.mode_code, inflow: 0, outflow: 0 };
      if (i.amount >= 0) modes[i.mode_name].inflow = r2(modes[i.mode_name].inflow + i.amount);
      else modes[i.mode_name].outflow = r2(modes[i.mode_name].outflow + i.amount);
    }
    const types = {};
    for (const i of mine) types[i.type] = r2((types[i.type] || 0) + i.amount);
    const expectedCash = r2(mine.filter((i) => i.mode_code === 'CASH').reduce((s, i) => s + i.amount, 0));
    return {
      counter: c, count: mine.length, net: r2(mine.reduce((s, i) => s + i.amount, 0)), expectedCash,
      modes: Object.values(modes), types: Object.entries(types).map(([type, amount]) => ({ type, amount })),
      closure: closures.find((x) => x.counter_id === c.id) || null,
    };
  });
  res.json({ date, counters: summary, items });
}));

router.post('/daybook/close', asyncRoute((req, res) => {
  requireRight(req.user, 'close_counter');
  const { counterId, date = todayIso(), declaredCash, note } = req.body;
  const c = db.prepare('SELECT * FROM counters WHERE id = ?').get(counterId);
  if (!c) throw bad('Choose a counter.');
  if (c.is_system) throw bad('The system counter is not closed by hand.');
  if (declaredCash === undefined || declaredCash === '' || Number.isNaN(Number(declaredCash))) throw bad('Enter the cash you counted.');
  if (db.prepare('SELECT 1 FROM counter_closures WHERE counter_id = ? AND business_date = ?').get(counterId, date)) throw conflict('This counter is already closed for the day.');
  const expected = r2(db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM (${MONEY}) WHERE counter_id = ? AND mode_code = 'CASH' AND substr(created_at,1,10) = ?`).get(counterId, date).s);
  const variance = r2(Number(declaredCash) - expected);
  if (Math.abs(variance) > 0.004 && !note) throw bad(`Counted cash differs by ${variance.toFixed(2)}. Add a note explaining the difference.`);
  db.prepare(`INSERT INTO counter_closures (counter_id, business_date, expected_cash, declared_cash, variance, note, closed_by, closed_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(counterId, date, expected, r2(declaredCash), variance, note || null, req.user.username, nowIso());
  audit(req.user, { entity: 'counter', id: counterId, action: 'close', summary: `Closed ${c.name} for ${date} — variance ${variance.toFixed(2)}` });
  res.status(201).json({ ok: true, expected, variance });
}));

/* ---------------------------------------------------------------- reports */
const range = (q) => ({ from: q.from || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10), to: q.to || todayIso() });

router.get('/reports/collections', asyncRoute((req, res) => {
  requireRight(req.user, 'view_reports');
  const { from, to } = range(req.query);
  const items = db.prepare(`SELECT * FROM (${MONEY}) WHERE substr(created_at,1,10) BETWEEN ? AND ?`).all(from, to).map((i) => ({ ...i, type: typeOf(i) }));
  const group = (key) => {
    const m = {};
    for (const i of items) { const k = key(i); m[k] ??= { key: k, amount: 0, count: 0 }; m[k].amount = r2(m[k].amount + i.amount); m[k].count++; }
    return Object.values(m).sort((a, b) => b.amount - a.amount);
  };
  const days = {};
  for (const i of items) { const d = i.created_at.slice(0, 10); days[d] ??= { date: d, inflow: 0, outflow: 0 }; if (i.amount >= 0) days[d].inflow = r2(days[d].inflow + i.amount); else days[d].outflow = r2(days[d].outflow + i.amount); }
  res.json({
    from, to, total: r2(items.reduce((s, i) => s + i.amount, 0)), count: items.length,
    byMode: group((i) => i.mode_name), byCounter: group((i) => i.counter_name || '—'), byType: group((i) => i.type), byUser: group((i) => i.username),
    daily: Object.values(days).sort((a, b) => a.date.localeCompare(b.date)),
  });
}));

router.get('/reports/patient-dues', asyncRoute((req, res) => {
  requireRight(req.user, 'view_reports');
  const rows = db.prepare(`SELECT b.bill_no, b.mr_no, p.name AS patient_name, p.phone, b.status, b.bill_type, b.patient_amount, b.patient_due,
      b.finalized_at, b.created_at, b.patient_writeoff,
      CAST(julianday('now') - julianday(COALESCE(b.finalized_at, b.created_at)) AS INTEGER) AS age_days
    FROM bills b JOIN patients p ON p.mr_no = b.mr_no WHERE b.status IN ('A','F') AND b.patient_due > 0.004 ORDER BY b.patient_due DESC`).all();
  const buckets = [['0–7 days', 0, 7], ['8–30 days', 8, 30], ['31–60 days', 31, 60], ['Over 60 days', 61, 1e9]].map(([label, a, b]) => {
    const rs = rows.filter((r) => r.age_days >= a && r.age_days <= b);
    return { label, count: rs.length, amount: r2(rs.reduce((s, r) => s + r.patient_due, 0)) };
  });
  res.json({ rows, buckets, total: r2(rows.reduce((s, r) => s + r.patient_due, 0)) });
}));

router.get('/reports/sponsor-dues', asyncRoute((req, res) => {
  requireRight(req.user, 'view_reports');
  const rows = db.prepare(`SELECT b.bill_no, b.mr_no, pt.name AS patient_name, s.name AS sponsor_name, pl.name AS plan_name, b.status, b.claim_status,
      b.total_claim + b.sponsor_vat AS claim, b.sponsor_receipts, b.sponsor_due, b.finalized_at
    FROM bills b JOIN patients pt ON pt.mr_no = b.mr_no JOIN bill_claims bc ON bc.bill_no = b.bill_no AND bc.priority = 1
    JOIN plans pl ON pl.id = bc.plan_id JOIN sponsors s ON s.id = pl.sponsor_id
    WHERE b.is_tpa = 1 AND b.status IN ('F','C') AND b.sponsor_due > 0.004 ORDER BY b.sponsor_due DESC`).all();
  const bySponsor = {};
  for (const r of rows) { bySponsor[r.sponsor_name] ??= { sponsor: r.sponsor_name, count: 0, due: 0 }; bySponsor[r.sponsor_name].count++; bySponsor[r.sponsor_name].due = r2(bySponsor[r.sponsor_name].due + r.sponsor_due); }
  res.json({ rows, bySponsor: Object.values(bySponsor), total: r2(rows.reduce((s, r) => s + r.sponsor_due, 0)) });
}));

router.get('/reports/outstanding-deposits', asyncRoute((req, res) => {
  requireRight(req.user, 'view_reports');
  const rows = db.prepare(`SELECT p.mr_no, p.name, p.phone,
      SUM(d.amount) AS collected,
      SUM(d.amount - COALESCE((SELECT SUM(s.amount) FROM deposit_setoffs s WHERE s.deposit_no = d.deposit_no),0)) AS balance,
      MAX(d.created_at) AS last_deposit, COUNT(*) AS deposits
    FROM deposits d JOIN patients p ON p.mr_no = d.mr_no
    WHERE d.deposit_type = 'R' AND d.status = 'A' AND d.realized = 1 GROUP BY p.mr_no HAVING balance > 0.004 ORDER BY balance DESC`).all()
    .map((r) => ({ ...r, collected: r2(r.collected), balance: r2(r.balance) }));
  res.json({ rows, total: r2(rows.reduce((s, r) => s + r.balance, 0)) });
}));

router.get('/reports/payment-consolidated', asyncRoute((req, res) => {
  requireRight(req.user, 'view_reports');
  const { from, to } = range(req.query);
  const items = db.prepare(`SELECT * FROM (${MONEY}) WHERE substr(created_at,1,10) BETWEEN ? AND ?`).all(from, to).map((i) => ({ ...i, type: typeOf(i) }));
  const types = ['Advances', 'Settlements', 'Refunds', 'Sponsor receipts', 'Deposits', 'Deposit refunds'];
  const days = {};
  for (const i of items) {
    const d = i.created_at.slice(0, 10);
    days[d] ??= Object.fromEntries([['date', d], ...types.map((t) => [t, 0]), ['net', 0]]);
    days[d][i.type] = r2(days[d][i.type] + i.amount);
    days[d].net = r2(days[d].net + i.amount);
  }
  const rows = Object.values(days).sort((a, b) => b.date.localeCompare(a.date));
  const totals = Object.fromEntries([...types, 'net'].map((t) => [t, r2(rows.reduce((s, r) => s + r[t], 0))]));
  res.json({ from, to, types, rows, totals });
}));

router.get('/reports/reward-points', asyncRoute((req, res) => {
  requireRight(req.user, 'view_reports');
  const rate = Number(db.prepare("SELECT value FROM preferences WHERE key='points_redemption_rate'").get()?.value || 0.25);
  const rows = db.prepare(`SELECT p.mr_no, p.name, rp.earned, rp.redeemed, rp.earned - rp.redeemed AS balance
    FROM reward_points rp JOIN patients p ON p.mr_no = rp.mr_no WHERE rp.earned > 0 ORDER BY balance DESC`).all()
    .map((r) => ({ ...r, value: r2(r.balance * rate) }));
  res.json({ rows, rate, liability: r2(rows.reduce((s, r) => s + r.value, 0)) });
}));

/* ---------------------------------------------------------------- finance postings FIN-011..014 */
const ACC = {
  CASH: ['110101', 'Cash in hand'], CARD: ['110201', 'Card clearing'], DEBIT: ['110201', 'Card clearing'], UPI: ['110305', 'UPI clearing'],
  CHEQUE: ['110301', 'Bank — cheques'], DD: ['110301', 'Bank — cheques'], NEFT: ['110302', 'Bank — transfers'],
  RECV: ['121001', 'Patient receivables'], UADV: ['122117', 'Unfinalized advance'], ADV: ['223302', 'Advance from patients'],
  DEP: ['223401', 'Patient deposits'], SPR: ['121101', 'Sponsor receivables'],
};
const modeAcc = (code) => ACC[code] || ACC.CASH;

router.get('/reports/finance-postings', asyncRoute((req, res) => {
  requireRight(req.user, 'view_reports');
  const { from, to } = range(req.query);
  const lines = [];
  const push = (fin, category, date, ref, dr, cr, amount, narration) => {
    const a = r2(Math.abs(amount));
    if (a < 0.005) return;
    lines.push({ fin, category, date, ref, debit: dr, credit: cr, amount: a, narration });
  };
  const receipts = db.prepare(`SELECT r.*, pm.code AS mode_code FROM receipts r JOIN payment_modes pm ON pm.id = r.mode_id
    WHERE substr(r.created_at,1,10) BETWEEN ? AND ? ORDER BY r.created_at`).all(from, to);
  for (const r of receipts) {
    const m = modeAcc(r.mode_code);
    const d = r.created_at.slice(0, 10);
    const sign = r.amount >= 0;
    if (r.payment_type === 'R' && r.recpt_type === 'S') push('FIN-011', 'Self pay receipt', d, r.receipt_no, sign ? m : ACC.RECV, sign ? ACC.RECV : m, r.amount, `Settlement on ${r.bill_no}`);
    else if (r.payment_type === 'R') { const acc = r.recpt_type === 'U' ? ACC.UADV : ACC.ADV; push('FIN-012', 'Advance receipt', d, r.receipt_no, sign ? m : acc, sign ? acc : m, r.amount, `Advance on ${r.bill_no}`); }
    else if (r.payment_type === 'S') push('FIN-011', 'Sponsor receipt', d, r.receipt_no, sign ? m : ACC.SPR, sign ? ACC.SPR : m, r.amount + r.tds_amount, `Sponsor ${r.sponsor_index === 'S' ? 'secondary' : 'primary'} on ${r.bill_no}`);
    else if (r.payment_type === 'F') { const acc = r.recpt_type === 'U' ? ACC.UADV : r.recpt_type === 'A' ? ACC.ADV : ACC.RECV; push('FIN-014', 'Advance refund', d, r.receipt_no, sign ? m : acc, sign ? acc : m, r.amount, `${r.recpt_type === 'S' ? 'Settlement' : 'Advance'} refund on ${r.bill_no}`); }
  }
  const deposits = db.prepare(`SELECT d.*, pm.code AS mode_code FROM deposits d JOIN payment_modes pm ON pm.id = d.mode_id
    WHERE substr(d.created_at,1,10) BETWEEN ? AND ? AND d.realized = 1`).all(from, to);
  for (const d of deposits) {
    const m = modeAcc(d.mode_code);
    if (d.deposit_type === 'R') push('FIN-012', 'Deposit receipt', d.created_at.slice(0, 10), d.deposit_no, m, ACC.DEP, d.amount, `Deposit from ${d.mr_no}`);
    else push('FIN-014', 'Deposit refund', d.created_at.slice(0, 10), d.deposit_no, ACC.DEP, m, d.amount, `Deposit refund to ${d.mr_no}`);
  }
  const finalized = db.prepare(`SELECT b.bill_no, b.finalized_at,
      COALESCE((SELECT SUM(amount) FROM receipts r WHERE r.bill_no = b.bill_no AND r.payment_type IN ('R','F') AND r.recpt_type='U'),0) AS uadv,
      COALESCE((SELECT SUM(amount) FROM receipts r WHERE r.bill_no = b.bill_no AND r.payment_type IN ('R','F') AND r.recpt_type='A'),0) AS adv,
      b.deposit_set_off FROM bills b WHERE b.finalized_at IS NOT NULL AND substr(b.finalized_at,1,10) BETWEEN ? AND ?`).all(from, to);
  for (const b of finalized) {
    const d = b.finalized_at.slice(0, 10);
    push('FIN-013', 'Advance adjustment', d, b.bill_no, ACC.UADV, ACC.RECV, b.uadv, 'Unfinalized advance applied');
    push('FIN-013', 'Advance adjustment', d, b.bill_no, ACC.ADV, ACC.RECV, b.adv, 'Advance applied');
    push('FIN-013', 'Advance adjustment', d, b.bill_no, ACC.DEP, ACC.RECV, b.deposit_set_off, 'Deposit set-off applied');
  }
  const summary = ['FIN-011', 'FIN-012', 'FIN-013', 'FIN-014'].map((fin) => {
    const ls = lines.filter((l) => l.fin === fin);
    return { fin, count: ls.length, amount: r2(ls.reduce((s, l) => s + l.amount, 0)) };
  });
  const accounts = {};
  for (const l of lines) {
    accounts[l.debit[0]] ??= { code: l.debit[0], name: l.debit[1], debit: 0, credit: 0 };
    accounts[l.credit[0]] ??= { code: l.credit[0], name: l.credit[1], debit: 0, credit: 0 };
    accounts[l.debit[0]].debit = r2(accounts[l.debit[0]].debit + l.amount);
    accounts[l.credit[0]].credit = r2(accounts[l.credit[0]].credit + l.amount);
  }
  res.json({ from, to, lines: lines.sort((a, b) => b.date.localeCompare(a.date)), summary, accounts: Object.values(accounts).sort((a, b) => a.code.localeCompare(b.code)) });
}));

export default router;
