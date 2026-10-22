import { Router } from 'express';
import { db, resetDatabase, tx } from '../db.js';
import { RIGHTS, loadUser, requireRight } from '../lib/auth.js';
import { asyncRoute, audit, bad, notFound, parseJson, r2 } from '../lib/util.js';

const router = Router();

export const AUTHORIZERS = ['Dr. Meera Iyer (Medical Director)', 'Dr. Arjun Rao (Consultant)', 'Kavita Menon (Billing Manager)', 'Hospital management'];
export const REOPEN_REASONS = ['Charge missed', 'Wrong rate', 'Sponsor change', 'Patient request', 'Discount correction', 'Other'];

/* ---------------------------------------------------------------- session & meta */
router.get('/meta', asyncRoute((req, res) => {
  const prefs = Object.fromEntries(db.prepare('SELECT key, value, kind FROM preferences').all()
    .map((p) => [p.key, p.kind === 'boolean' ? p.value === 'Y' : p.kind === 'number' ? Number(p.value) : p.value]));
  res.json({
    me: req.user,
    users: db.prepare('SELECT id, username, name, role, initials FROM users ORDER BY id').all(),
    counters: db.prepare('SELECT * FROM counters WHERE active = 1 ORDER BY is_system, name').all(),
    paymentModes: db.prepare('SELECT * FROM payment_modes WHERE active = 1 ORDER BY sort, id').all(),
    ratePlans: db.prepare('SELECT * FROM rate_plans WHERE active = 1 ORDER BY name').all(),
    discountCategories: db.prepare('SELECT * FROM discount_categories WHERE active = 1 ORDER BY name').all()
      .map((d) => ({ ...d, charge_groups: parseJson(d.charge_groups, []) })),
    plans: db.prepare('SELECT p.*, s.name AS sponsor_name FROM plans p JOIN sponsors s ON s.id = p.sponsor_id ORDER BY s.name').all(),
    rights: RIGHTS, prefs, authorizers: AUTHORIZERS, reopenReasons: REOPEN_REASONS,
    chargeGroups: db.prepare('SELECT DISTINCT charge_group FROM catalogue ORDER BY charge_group').all().map((r) => r.charge_group),
    badges: {
      approvals: db.prepare("SELECT COUNT(*) AS n FROM approvals WHERE status = 'pending'").get().n,
      unrealized: db.prepare("SELECT COUNT(*) AS n FROM deposits WHERE realized = 0 AND status = 'A'").get().n,
      overpaid: db.prepare("SELECT COUNT(*) AS n FROM bills WHERE status IN ('A','F') AND patient_due < -0.004").get().n,
    },
    hospital: { name: db.prepare("SELECT value FROM preferences WHERE key='hospital_name'").get()?.value || 'Hospital' },
  });
}));

router.post('/me/counter', asyncRoute((req, res) => {
  const { counterId } = req.body;
  if (counterId !== null) {
    const c = db.prepare('SELECT * FROM counters WHERE id = ? AND active = 1').get(counterId);
    if (!c) throw bad('Counter not found.');
    if (c.is_system) throw bad('The system counter is used for automatic postings only.');
  }
  db.prepare('UPDATE users SET counter_id = ? WHERE id = ?').run(counterId, req.user.id);
  res.json(loadUser(req.user.id));
}));

/* ---------------------------------------------------------------- search */
router.get('/search', asyncRoute((req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ bills: [], patients: [], receipts: [] });
  const like = `%${q}%`;
  res.json({
    bills: db.prepare(`SELECT b.bill_no, b.status, b.patient_due, b.bill_type, p.name AS patient_name FROM bills b JOIN patients p ON p.mr_no = b.mr_no
      WHERE b.bill_no LIKE ? OR p.name LIKE ? OR b.mr_no LIKE ? ORDER BY b.updated_at DESC LIMIT 6`).all(like, like, like),
    patients: db.prepare('SELECT mr_no, name, phone, city FROM patients WHERE name LIKE ? OR mr_no LIKE ? OR phone LIKE ? LIMIT 6').all(like, like, like),
    receipts: db.prepare(`SELECT receipt_no AS no, bill_no, amount, created_at FROM receipts WHERE receipt_no LIKE ? OR reference LIKE ?
      UNION ALL SELECT deposit_no, NULL, amount, created_at FROM deposits WHERE deposit_no LIKE ? OR reference LIKE ? LIMIT 6`).all(like, like, like, like),
  });
}));

/* ---------------------------------------------------------------- audit */
router.get('/audit', asyncRoute((req, res) => {
  requireRight(req.user, 'view_audit');
  const { q = '', entity = '', user = '', from = '', to = '', billNo = '', page = '1', size = '60' } = req.query;
  const where = [];
  const p = {};
  if (q) { where.push('(summary LIKE @q OR entity_id LIKE @q OR bill_no LIKE @q OR mr_no LIKE @q)'); p.q = `%${q}%`; }
  if (entity) { where.push('entity = @entity'); p.entity = entity; }
  if (user) { where.push('username = @user'); p.user = user; }
  if (billNo) { where.push('bill_no = @billNo'); p.billNo = billNo; }
  if (from) { where.push('substr(at,1,10) >= @from'); p.from = from; }
  if (to) { where.push('substr(at,1,10) <= @to'); p.to = to; }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Number(size) || 60, 300);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const rows = db.prepare(`SELECT * FROM audit_log ${w} ORDER BY at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`).all(p)
    .map((r) => ({ ...r, detail: parseJson(r.detail, {}) }));
  const total = db.prepare(`SELECT COUNT(*) AS n FROM audit_log ${w}`).get(p).n;
  const users = db.prepare('SELECT DISTINCT username FROM audit_log ORDER BY username').all().map((r) => r.username);
  const entities = db.prepare('SELECT entity, COUNT(*) AS n FROM audit_log GROUP BY entity ORDER BY n DESC').all();
  res.json({ rows, total, users, entities, page: Number(page), size: limit });
}));

/* ---------------------------------------------------------------- settings CRUD */
const TABLES = {
  'payment-modes': { table: 'payment_modes', pk: 'id', cols: ['name', 'code', 'requires_bank', 'requires_reference', 'requires_card', 'realization_required', 'active', 'sort'], required: ['name', 'code'] },
  counters: { table: 'counters', pk: 'id', cols: ['name', 'counter_type', 'center_id', 'is_system', 'card_terminal', 'active'], required: ['name'] },
  'number-series': { table: 'number_series', pk: 'key', cols: ['label', 'prefix', 'next_value', 'pad'], required: ['prefix'], noCreate: true },
  'discount-categories': { table: 'discount_categories', pk: 'id', cols: ['name', 'percent', 'charge_groups', 'active'], required: ['name'], json: ['charge_groups'] },
  'rate-plans': { table: 'rate_plans', pk: 'id', cols: ['name', 'discount_pct', 'active'], required: ['name'] },
  users: { table: 'users', pk: 'id', cols: ['name', 'role', 'rights', 'counter_id', 'initials', 'username'], required: ['name', 'username'], json: ['rights'] },
};

const decode = (cfg, row) => {
  const out = { ...row };
  for (const j of cfg.json || []) out[j] = parseJson(row[j], []);
  return out;
};

router.get('/settings/:resource', asyncRoute((req, res) => {
  if (req.params.resource === 'preferences') {
    return res.json(db.prepare('SELECT * FROM preferences ORDER BY grp, label').all());
  }
  const cfg = TABLES[req.params.resource];
  if (!cfg) throw notFound('Unknown settings section');
  const order = cfg.table === 'number_series' ? 'key' : cfg.table === 'payment_modes' ? 'sort, id' : 'id';
  res.json(db.prepare(`SELECT * FROM ${cfg.table} ORDER BY ${order}`).all().map((r) => decode(cfg, r)));
}));

function clean(cfg, body) {
  const out = {};
  for (const c of cfg.cols) {
    if (body[c] === undefined) continue;
    let v = body[c];
    if ((cfg.json || []).includes(c)) v = JSON.stringify(Array.isArray(v) ? v : []);
    if (typeof v === 'boolean') v = v ? 1 : 0;
    if (['percent', 'discount_pct'].includes(c)) { v = r2(v); if (v < 0 || v > 100) throw bad('Percent must be between 0 and 100.'); }
    if (c === 'next_value' && !(Number(v) >= 1)) throw bad('Next number must be 1 or more.');
    if (c === 'pad' && !(Number(v) >= 1 && Number(v) <= 12)) throw bad('Padding must be between 1 and 12.');
    if (c === 'role' && !['admin', 'billing', 'cashier', 'finance'].includes(v)) throw bad('Unknown role.');
    out[c] = v === '' ? null : v;
  }
  return out;
}

router.post('/settings/:resource', asyncRoute((req, res) => {
  requireRight(req.user, 'settings_admin');
  const cfg = TABLES[req.params.resource];
  if (!cfg || cfg.noCreate) throw bad('Items cannot be added to this section.');
  const row = clean(cfg, req.body);
  const missing = cfg.required.filter((f) => !row[f]);
  if (missing.length) throw bad(`Fill in ${missing.join(', ')}.`);
  const cols = Object.keys(row);
  const info = db.prepare(`INSERT INTO ${cfg.table} (${cols.join(',')}) VALUES (${cols.map((c) => `@${c}`).join(',')})`).run(row);
  audit(req.user, { entity: 'settings', id: `${cfg.table}:${info.lastInsertRowid}`, action: 'create', summary: `Added ${row.name || row.label} to ${req.params.resource}` });
  res.status(201).json(decode(cfg, db.prepare(`SELECT * FROM ${cfg.table} WHERE rowid = ?`).get(info.lastInsertRowid)));
}));

router.patch('/settings/preferences', asyncRoute((req, res) => {
  requireRight(req.user, 'settings_admin');
  const entries = Object.entries(req.body || {});
  tx(() => {
    for (const [key, value] of entries) {
      const p = db.prepare('SELECT * FROM preferences WHERE key = ?').get(key);
      if (!p) throw bad(`Unknown preference ${key}`);
      let v = value;
      if (p.kind === 'boolean') v = value === true || value === 'Y' ? 'Y' : 'N';
      if (p.kind === 'number' && Number.isNaN(Number(value))) throw bad(`${p.label} must be a number.`);
      db.prepare('UPDATE preferences SET value = ? WHERE key = ?').run(String(v), key);
      audit(req.user, { entity: 'settings', id: `preferences:${key}`, action: 'update', summary: `${p.label}: ${p.value} → ${v}` });
    }
  })();
  res.json(db.prepare('SELECT * FROM preferences ORDER BY grp, label').all());
}));

router.patch('/settings/:resource/:id', asyncRoute((req, res) => {
  requireRight(req.user, 'settings_admin');
  const cfg = TABLES[req.params.resource];
  if (!cfg) throw notFound('Unknown settings section');
  const before = db.prepare(`SELECT * FROM ${cfg.table} WHERE ${cfg.pk} = ?`).get(req.params.id);
  if (!before) throw notFound('Item not found');
  const row = clean(cfg, req.body);
  if (!Object.keys(row).length) return res.json(decode(cfg, before));
  if (cfg.table === 'number_series' && row.next_value !== undefined && Number(row.next_value) < before.next_value) {
    throw bad('Next number cannot go backwards — that would create duplicate numbers.');
  }
  db.prepare(`UPDATE ${cfg.table} SET ${Object.keys(row).map((c) => `${c}=@${c}`).join(',')} WHERE ${cfg.pk} = @__pk`).run({ ...row, __pk: req.params.id });
  audit(req.user, { entity: 'settings', id: `${cfg.table}:${req.params.id}`, action: 'update', summary: `Updated ${before.name || before.label || req.params.id} in ${req.params.resource}`, detail: { before, changes: row } });
  res.json(decode(cfg, db.prepare(`SELECT * FROM ${cfg.table} WHERE ${cfg.pk} = ?`).get(req.params.id)));
}));

router.post('/admin/reset-demo', asyncRoute(async (req, res) => {
  requireRight(req.user, 'settings_admin');
  const { seed } = await import('../seed.js');
  resetDatabase();
  seed();
  res.json({ ok: true });
}));

export default router;
