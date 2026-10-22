import { fileURLToPath } from 'node:url';
import { db, resetDatabase } from './db.js';
import { loadUser } from './lib/auth.js';
import { insertReceipts, recalcBill, setOffDeposits } from './lib/billing.js';
import { audit, clock, nextNumber, r2 } from './lib/util.js';
import { cancelBillNow, closeBill, finalizeBill } from './routes/bills.js';

/* ---------------------------------------------------------------- reference data */
const ROLE_RIGHTS = {
  billing: ['edit_bill', 'addtobill_charges', 'cancel_elements_in_bill', 'allow_ratechange', 'allow_discount', 'allow_refund', 'allow_deposit_setoff',
    'bill_reopen', 'cancel_bill', 'patient_writeoff', 'change_billtype', 'change_billprimary', 'connect_disconnect_tpa', 'edit_receipt',
    'collect_deposit', 'view_reports', 'view_audit'],
  cashier: ['edit_bill', 'addtobill_charges', 'allow_deposit_setoff', 'collect_deposit', 'close_counter', 'allow_discount'],
  finance: ['edit_bill', 'approve_discount', 'approve_writeoff', 'approve_cancellation', 'realize_cheques', 'view_reports', 'view_audit', 'close_counter',
    'allow_refund', 'edit_receipt', 'collect_deposit'],
};

const CATALOGUE = [
  // code, name, group, head, rate, vat, insurance payable
  ['REG01', 'OP registration', 'REG', 'OPREG', 300, 0, 1],
  ['REG02', 'IP admission', 'REG', 'IPREG', 1000, 0, 1],
  ['DOC01', 'General physician consultation', 'DOC', 'OPDOC', 800, 0, 1],
  ['DOC02', 'Specialist consultation', 'DOC', 'OPDOC', 1500, 0, 1],
  ['DOC03', 'IP doctor visit', 'DOC', 'IPDOC', 1200, 0, 1],
  ['DOC04', 'Emergency consultation', 'DOC', 'OPDOC', 2000, 0, 1],
  ['LAB01', 'Complete blood count', 'DIA', 'LTDIA', 450, 0, 1],
  ['LAB02', 'Liver function test', 'DIA', 'LTDIA', 900, 0, 1],
  ['LAB03', 'Kidney function test', 'DIA', 'LTDIA', 850, 0, 1],
  ['LAB04', 'HbA1c', 'DIA', 'LTDIA', 650, 0, 1],
  ['LAB05', 'Lipid profile', 'DIA', 'LTDIA', 750, 0, 1],
  ['LAB06', 'Thyroid profile (T3, T4, TSH)', 'DIA', 'LTDIA', 700, 0, 1],
  ['LAB07', 'Urine routine', 'DIA', 'LTDIA', 250, 0, 1],
  ['LAB08', 'Blood culture & sensitivity', 'DIA', 'LTDIA', 1200, 0, 1],
  ['RAD01', 'X-ray chest PA view', 'DIA', 'RTDIA', 600, 0, 1],
  ['RAD02', 'Ultrasound abdomen', 'DIA', 'RTDIA', 1800, 0, 1],
  ['RAD03', 'CT head plain', 'DIA', 'RTDIA', 4500, 0, 1],
  ['RAD04', 'MRI knee', 'DIA', 'RTDIA', 8500, 0, 1],
  ['CAR01', 'ECG', 'DIA', 'CRDIA', 400, 0, 1],
  ['CAR02', '2D echocardiogram', 'DIA', 'CRDIA', 2500, 0, 1],
  ['BED01', 'General ward bed (per day)', 'BED', 'BBED', 2500, 0, 1],
  ['BED02', 'Semi-private room (per day)', 'BED', 'BBED', 4500, 0, 1],
  ['BED03', 'Private room (per day)', 'BED', 'BBED', 7000, 0, 1],
  ['ICU01', 'ICU bed (per day)', 'ICU', 'BICU', 12000, 0, 1],
  ['NUR01', 'Nursing care (per day)', 'SNP', 'NURSE', 800, 0, 1],
  ['DIE01', 'Diet (per day)', 'DIE', 'DIET', 600, 0, 1],
  ['OPE01', 'Laparoscopic appendectomy', 'OPE', 'SUOPE', 45000, 0, 1],
  ['OPE02', 'Cataract surgery with IOL', 'OPE', 'SUOPE', 28000, 0, 1],
  ['OPE03', 'Knee arthroscopy', 'OPE', 'SUOPE', 65000, 0, 1],
  ['OPE04', 'Operation theatre charges', 'OPE', 'OTCHG', 15000, 0, 1],
  ['OPE05', 'Anaesthesia charges', 'OPE', 'ANAES', 9000, 0, 1],
  ['MED01', 'Paracetamol 650 mg (strip of 15)', 'MED', 'PHMED', 35, 12, 1],
  ['MED02', 'Ceftriaxone 1 g injection', 'MED', 'PHMED', 85, 12, 1],
  ['MED03', 'Pantoprazole 40 mg injection', 'MED', 'PHMED', 60, 12, 1],
  ['MED04', 'Normal saline 500 ml', 'MED', 'PHMED', 45, 12, 1],
  ['MED05', 'Insulin glargine pen', 'MED', 'PHMED', 450, 5, 1],
  ['MED06', 'Amoxicillin-clavulanate 625 (strip of 10)', 'MED', 'PHMED', 210, 12, 1],
  ['MED07', 'Vitamin D3 60K (strip of 4)', 'MED', 'PHMED', 120, 12, 0],
  ['ITE01', 'IV cannula 20G', 'ITE', 'CONS', 120, 12, 1],
  ['ITE02', 'Disposable syringe 5 ml', 'ITE', 'CONS', 15, 12, 1],
  ['ITE03', 'Sterile gloves (pair)', 'ITE', 'CONS', 25, 12, 1],
  ['ITE04', 'Dressing kit', 'ITE', 'CONS', 350, 12, 1],
  ['OTC01', 'Ambulance within city', 'OTC', 'AMBUL', 2500, 0, 0],
  ['OTC02', 'Medical records copy', 'OTC', 'MRD', 200, 18, 0],
];

const PATIENTS = [
  ['Lakshmi Narayanan', 'F', '1958-03-14', '98450 12345', 'Bengaluru'], ['Arvind Kulkarni', 'M', '1972-07-02', '99001 23456', 'Mysuru'],
  ['Fatima Sheikh', 'F', '1989-11-21', '90080 34567', 'Bengaluru'], ['Joseph Mathew', 'M', '1965-01-30', '94470 45678', 'Kochi'],
  ['Sneha Reddy', 'F', '1995-05-09', '98480 56789', 'Hyderabad'], ['Ramesh Gowda', 'M', '1950-09-17', '97400 67890', 'Mandya'],
  ['Divya Krishnan', 'F', '1983-12-05', '99450 78901', 'Chennai'], ['Mohammed Irfan', 'M', '1977-04-22', '98860 89012', 'Bengaluru'],
  ['Kavya Shetty', 'F', '2001-08-11', '96320 90123', 'Mangaluru'], ['Venkatesh Iyer', 'M', '1961-02-27', '98410 01234', 'Chennai'],
  ['Pooja Agarwal', 'F', '1990-06-18', '99860 11223', 'Bengaluru'], ['Suresh Babu', 'M', '1955-10-08', '94480 22334', 'Tumakuru'],
  ['Ananya Bose', 'F', '1998-01-25', '98300 33445', 'Kolkata'], ['Harish Hegde', 'M', '1969-03-03', '99020 44556', 'Udupi'],
  ['Meenakshi Sundaram', 'F', '1948-07-29', '94440 55667', 'Madurai'], ['Rohit Malhotra', 'M', '1986-09-13', '98100 66778', 'Bengaluru'],
  ['Shalini Pai', 'F', '1979-11-01', '97310 77889', 'Bengaluru'], ['Thomas Varghese', 'M', '1959-05-19', '94950 88990', 'Kottayam'],
  ['Nandini Rao', 'F', '1992-02-14', '99800 99001', 'Bengaluru'], ['Prakash Jain', 'M', '1974-12-24', '98440 10112', 'Hubballi'],
  ['Geetha Ramachandran', 'F', '1967-08-06', '94430 21223', 'Coimbatore'], ['Imran Khan', 'M', '1984-03-28', '90360 32334', 'Bengaluru'],
  ['Revathi Menon', 'F', '1975-06-10', '94460 43445', 'Thrissur'], ['Kiran Kumar', 'M', '1993-10-31', '97390 54556', 'Bengaluru'],
];

const DOCTORS = [['Dr. Arjun Rao', 'General medicine'], ['Dr. Sunita Bhat', 'Orthopaedics'], ['Dr. Rajiv Menon', 'General surgery'],
  ['Dr. Leela Thomas', 'Ophthalmology'], ['Dr. Vikram Shah', 'Cardiology'], ['Dr. Meera Iyer', 'Internal medicine']];

/* ---------------------------------------------------------------- time helpers */
const BASE = new Date();
const at = (daysAgo, hh = 10, mm = 0) => {
  const d = new Date(BASE);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, Math.floor(Math.random() * 50), 0);
  if (d > BASE) d.setTime(BASE.getTime() - 60_000 * (1 + Math.random() * 20));
  return d.toISOString();
};
const withClock = (iso, fn) => { clock.now = () => iso; try { return fn(); } finally { clock.now = null; } };

/* ---------------------------------------------------------------- builders */
let catByCode;
let modeByCode;

function makeVisit(mr, type, daysAgo, doctorIdx, plans = []) {
  const [doctor, dept] = DOCTORS[doctorIdx % DOCTORS.length];
  const vid = nextNumber(type === 'i' ? 'visit_ip' : 'visit_op');
  db.prepare(`INSERT INTO visits (visit_id, mr_no, visit_type, doctor, department, ward, admitted_at, discharged_at, primary_plan_id, secondary_plan_id, center_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,1)`).run(vid, mr, type, doctor, dept, type === 'i' ? ['Ward 3B', 'Ward 4A', 'ICU', 'Ward 2C'][doctorIdx % 4] : null,
    at(daysAgo, 9, 15), null, plans[0] || null, plans[1] || null);
  return vid;
}

function makeBill(user, { visitId, billType = 'C', restriction = 'N', insured = false, daysAgo, hh = 9 }) {
  return withClock(at(daysAgo, hh, 30), () => {
    const v = db.prepare('SELECT * FROM visits WHERE visit_id = ?').get(visitId);
    const series = restriction === 'P' ? 'bill_pharmacy' : billType === 'P' ? 'bill_now' : 'bill_later';
    const no = nextNumber(series);
    const hasPrimary = db.prepare('SELECT 1 FROM bills WHERE visit_id = ? AND is_primary = 1').get(visitId);
    const isPrimary = billType === 'C' && restriction === 'N' && !hasPrimary ? 1 : 0;
    const t = clock.now();
    db.prepare(`INSERT INTO bills (bill_no, visit_id, mr_no, bill_type, restriction_type, is_primary, is_tpa, created_at, created_by, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(no, visitId, v.mr_no, billType, restriction, isPrimary, insured ? 1 : 0, t, user.username, t);
    if (insured) {
      db.prepare('INSERT INTO bill_claims (bill_no, plan_id, priority) VALUES (?,?,1)').run(no, v.primary_plan_id);
      if (v.secondary_plan_id) db.prepare('INSERT INTO bill_claims (bill_no, plan_id, priority) VALUES (?,?,2)').run(no, v.secondary_plan_id);
    }
    audit(user, { entity: 'bill', id: no, billNo: no, mrNo: v.mr_no, action: 'create',
      summary: `Created ${billType === 'P' ? 'Bill Now' : 'Bill Later'} bill${isPrimary ? ' (primary)' : ''}${insured ? ', insured' : ''}` });
    return no;
  });
}

function addCharges(user, billNo, items, daysAgo, hh = 11) {
  const bill = db.prepare('SELECT * FROM bills WHERE bill_no = ?').get(billNo);
  items.forEach(([code, qty = 1, opts = {}], i) => {
    const c = catByCode[code];
    withClock(at(daysAgo - (opts.dayOffset || 0), hh, i * 3), () => {
      const rate = opts.rate ?? c.rate;
      const info = db.prepare(`INSERT INTO charges (bill_no, catalogue_id, code, description, charge_group, charge_head, orig_rate, rate, qty, amount,
          discount, discount_by, discount_status, vat_rate, insurance_payable, order_linked, pending_result, posted_at, posted_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(billNo, c.id, c.code, c.name, c.charge_group, c.charge_head, c.rate, rate, qty, r2(rate * qty),
        opts.discount || 0, opts.discount ? opts.discountBy || 'Dr. Arjun Rao (Consultant)' : null, opts.discountStatus || (opts.discount ? 'approved' : 'none'),
        c.vat_rate, c.insurance_payable, opts.orderLinked ? 1 : 0, opts.pending ? 1 : 0, clock.now(), user.username);
      audit(user, { entity: 'charge', id: info.lastInsertRowid, billNo, mrNo: bill.mr_no, action: 'create', summary: `Added ${c.name} × ${qty} @ ${rate.toFixed(2)}` });
    });
  });
  recalcBill(billNo);
}

function pay(user, billNo, rows, daysAgo, hh = 12, mm = 0) {
  const iso = at(daysAgo, hh, mm);
  return withClock(iso, () => {
    const bill = recalcBill(billNo);
    rows = rows.filter((r) => r2(r.amount) > 0.004);
    if (!rows.length) return [];
    const prepared = rows.map((r) => {
      const mode = modeByCode[r.mode || 'CASH'];
      const out = { ...r, modeId: mode.id };
      if (mode.requires_bank && !out.bank) out.bank = ['HDFC Bank', 'State Bank of India', 'Canara Bank', 'ICICI Bank'][Math.floor(Math.random() * 4)];
      if (mode.requires_reference && !out.reference) out.reference = String(Math.floor(100000 + Math.random() * 899999));
      return out;
    });
    const card = prepared.some((r) => modeByCode[r.mode || 'CASH'].requires_card);
    return insertReceipts(user, bill, prepared, {
      at: iso,
      counterId: user.counter_id || 1,
      cardMeta: card ? { last4: String(1000 + Math.floor(Math.random() * 9000)), auth: String(Math.floor(100000 + Math.random() * 900000)), rrn: String(Date.now()).slice(-12), terminal: 'POS-01' } : {},
    });
  });
}

function step(_user, daysAgo, hh, fn, mm = 45) { return withClock(at(daysAgo, hh, mm), () => fn()); }


function deposit(user, mr, amount, modeCode, daysAgo, hh, extra = {}) {
  return withClock(at(daysAgo, hh, 20), () => {
    const mode = modeByCode[modeCode];
    const no = nextNumber('deposit');
    const realized = extra.realized ?? (mode.realization_required ? 0 : 1);
    db.prepare(`INSERT INTO deposits (deposit_no, mr_no, deposit_type, amount, mode_id, bank, reference, card_last4, realized, realized_at, available_for,
        payer_name, payer_phone, package_name, counter_id, username, created_at, remarks)
      VALUES (?,?, 'R', ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(no, mr, amount, mode.id, mode.requires_bank ? 'Canara Bank' : null,
      mode.requires_reference ? String(Math.floor(100000 + Math.random() * 899999)) : null, mode.requires_card ? '4417' : null,
      realized, realized ? clock.now() : null, extra.availableFor || 'B', extra.payer || null, extra.phone || null, extra.packageName || null,
      user.counter_id || 1, user.username, clock.now(), extra.remarks || null);
    audit(user, { entity: 'deposit', id: no, mrNo: mr, action: 'create', summary: `Collected deposit ${amount.toFixed(2)} by ${mode.name}${realized ? '' : ' (awaiting realization)'}` });
    return no;
  });
}

function approval(user, kind, billNo, amount, reason, daysAgo, payload = {}) {
  withClock(at(daysAgo, 15, 5), () => {
    db.prepare(`INSERT INTO approvals (kind, bill_no, amount, reason, payload, requested_by, requested_at) VALUES (?,?,?,?,?,?,?)`)
      .run(kind, billNo, amount, reason, JSON.stringify(payload), user.username, clock.now());
    audit(user, { entity: 'bill', id: billNo, billNo, action: `${kind}_requested`, summary: `${kind === 'writeoff' ? 'Write-off' : kind[0].toUpperCase() + kind.slice(1)} sent for approval` });
  });
}

/* ---------------------------------------------------------------- main */
export function seed() {
  const run = db.transaction(() => {
    db.prepare("INSERT INTO centers (id, name, code) VALUES (1, 'Sunrise Multispeciality Hospital', 'SMH')").run();
    const counters = [
      [1, 'Main billing', 'billing', 0, 'POS-01'], [2, 'OPD counter', 'billing', 0, 'POS-02'], [3, 'Pharmacy counter', 'pharmacy', 0, 'POS-03'],
      [4, 'IP discharge desk', 'billing', 0, 'POS-04'], [9, 'System (automatic)', 'system', 1, null],
    ];
    for (const c of counters) db.prepare('INSERT INTO counters (id, name, counter_type, center_id, is_system, card_terminal) VALUES (?,?,?,1,?,?)').run(...c);

    const users = [
      [1, 'priya', 'Priya Nair', 'admin', [], 1, 'PN'], [2, 'rahul', 'Rahul Verma', 'billing', ROLE_RIGHTS.billing, 4, 'RV'],
      [3, 'anita', 'Anita Das', 'cashier', ROLE_RIGHTS.cashier, 2, 'AD'], [4, 'suresh', 'Suresh Pillai', 'finance', ROLE_RIGHTS.finance, null, 'SP'],
    ];
    for (const u of users) db.prepare('INSERT INTO users (id, username, name, role, rights, counter_id, initials) VALUES (?,?,?,?,?,?,?)').run(u[0], u[1], u[2], u[3], JSON.stringify(u[4]), u[5], u[6]);

    const modes = [
      ['Cash', 'CASH', 0, 0, 0, 0], ['Credit card', 'CARD', 0, 0, 1, 0], ['Debit card', 'DEBIT', 0, 0, 1, 0], ['UPI', 'UPI', 0, 1, 0, 0],
      ['Cheque', 'CHEQUE', 1, 1, 0, 1], ['Demand draft', 'DD', 1, 1, 0, 0], ['Bank transfer (NEFT/RTGS)', 'NEFT', 0, 1, 0, 0],
    ];
    modes.forEach((m, i) => db.prepare(`INSERT INTO payment_modes (name, code, requires_bank, requires_reference, requires_card, realization_required, sort)
      VALUES (?,?,?,?,?,?,?)`).run(...m, i));

    const series = [
      ['bill_now', 'Bill Now bills', 'BN', 1001], ['bill_later', 'Bill Later bills', 'BL', 2001], ['bill_pharmacy', 'Pharmacy bills', 'PH', 501],
      ['bill_test', 'Test-only bills', 'TS', 101], ['receipt', 'Receipts', 'RC', 10001], ['refund', 'Refunds', 'RF', 3001], ['sponsor', 'Sponsor receipts', 'RS', 1201],
      ['deposit', 'Deposits', 'DR', 701], ['deposit_refund', 'Deposit refunds', 'DF', 81], ['mr', 'Patient MR numbers', 'MR', 240101],
      ['visit_op', 'OP visits', 'OP', 50001], ['visit_ip', 'IP visits', 'IP', 8001],
    ];
    for (const s of series) db.prepare('INSERT INTO number_series (key, label, prefix, next_value, pad) VALUES (?,?,?,?,6)').run(...s);

    for (const d of [['Staff', 20, []], ['Senior citizen', 10, ['DOC', 'DIA']], ['Below poverty line', 30, []], ['Corporate wellness', 15, ['DIA']]]) {
      db.prepare('INSERT INTO discount_categories (name, percent, charge_groups) VALUES (?,?,?)').run(d[0], d[1], JSON.stringify(d[2]));
    }
    for (const rp of [['General tariff', 0], ['Corporate tariff', 10], ['Staff tariff', 25]]) db.prepare('INSERT INTO rate_plans (name, discount_pct) VALUES (?,?)').run(...rp);

    const prefs = [
      ['hospital_name', 'Sunrise Multispeciality Hospital', 'Hospital name', 'text', 'Printing', 'Shown on bills and receipts'],
      ['hospital_address', '14, Outer Ring Road, Marathahalli, Bengaluru 560037', 'Address', 'text', 'Printing', null],
      ['hospital_gstin', '29AABCS1234F1Z5', 'GSTIN', 'text', 'Printing', null],
      ['receipt_footer', 'Thank you. Please keep this receipt for your records.', 'Receipt footer', 'text', 'Printing', null],
      ['round_off_enabled', 'Y', 'Round off bills to the nearest rupee', 'boolean', 'Billing', 'Adds a round-off line to every bill'],
      ['allow_bill_now_insurance', 'N', 'Allow insurance on Bill Now bills', 'boolean', 'Billing', null],
      ['bill_cancellation_requires_approval', 'Y', 'Bill cancellation needs approval', 'boolean', 'Billing', 'Cancels go to the approvals inbox first'],
      ['discount_approval_threshold_pct', '10', 'Discounts above this % need approval', 'number', 'Billing', 'Applies to non-insured bills'],
      ['default_rate_plan_id', '', 'Default rate plan for non-insured bills', 'text', 'Billing', 'Leave empty for list rates'],
      ['card_integration', 'Y', 'Card terminal integration', 'boolean', 'Payments', 'Card payments go through the counter terminal'],
      ['deposit_cheque_realization_flow', 'Y', 'Cheque deposits need realization', 'boolean', 'Payments', 'Cheques count toward the balance only after realization'],
      ['reward_points_enabled', 'Y', 'Reward points', 'boolean', 'Reward points', null],
      ['points_redemption_rate', '0.25', 'Value of one point (₹)', 'number', 'Reward points', null],
      ['points_earn_per_100', '1', 'Points earned per ₹100 billed', 'number', 'Reward points', 'Credited when a bill closes'],
    ];
    for (const p of prefs) db.prepare('INSERT INTO preferences (key, value, label, kind, grp, help) VALUES (?,?,?,?,?,?)').run(...p);

    const sponsors = [['Star Health Insurance', 'Insurer'], ['Medi Assist TPA', 'TPA'], ['ICICI Lombard', 'Insurer'], ['HDFC ERGO', 'Insurer'], ['Infosys Ltd', 'Corporate']];
    sponsors.forEach((s, i) => db.prepare('INSERT INTO sponsors (id, name, kind) VALUES (?,?,?)').run(i + 1, ...s));
    const plans = [
      [1, 1, 'Comprehensive', 10, 300000, ['OTC']], [2, 2, 'Gold', 0, 150000, ['OTC', 'MED']], [3, 3, 'Complete Health Secure', 20, null, ['OTC']],
      [4, 4, 'Optima Restore (top-up)', 0, 50000, ['OTC']], [5, 5, 'Employee health scheme', 0, 100000, []],
    ];
    for (const p of plans) db.prepare('INSERT INTO plans (id, sponsor_id, name, copay_pct, claim_cap, non_payable_groups) VALUES (?,?,?,?,?,?)').run(p[0], p[1], p[2], p[3], p[4], JSON.stringify(p[5]));

    for (const c of CATALOGUE) db.prepare('INSERT INTO catalogue (code, name, charge_group, charge_head, rate, vat_rate, insurance_payable) VALUES (?,?,?,?,?,?,?)').run(...c);
    catByCode = Object.fromEntries(db.prepare('SELECT * FROM catalogue').all().map((c) => [c.code, c]));
    modeByCode = Object.fromEntries(db.prepare('SELECT * FROM payment_modes').all().map((m) => [m.code, m]));

    const mrs = PATIENTS.map((p, i) => {
      const mr = nextNumber('mr');
      db.prepare('INSERT INTO patients (mr_no, name, gender, dob, phone, city, created_at) VALUES (?,?,?,?,?,?,?)').run(mr, ...p, at(60 - i));
      db.prepare('INSERT INTO reward_points (mr_no, earned, redeemed) VALUES (?, ?, 0)').run(mr, [0, 120, 340, 0, 80, 560, 0, 45][i % 8]);
      return mr;
    });

    const admin = loadUser(1);
    const rahul = loadUser(2);
    const anita = loadUser(3);
    const suresh = loadUser(4);

    /* 1. IP insured, open — advances, pending lab result, Star Health */
    let v = makeVisit(mrs[0], 'i', 4, 5, [1]);
    let b = makeBill(rahul, { visitId: v, insured: true, daysAgo: 4 });
    addCharges(rahul, b, [['REG02'], ['BED02', 4], ['NUR01', 4], ['DIE01', 4], ['DOC03', 5], ['LAB01', 2], ['LAB03'], ['LAB08', 1, { pending: true, orderLinked: true }],
      ['RAD01'], ['MED02', 8], ['MED04', 6], ['ITE01', 2], ['OTC01']], 4);
    pay(rahul, b, [{ kind: 'advance', amount: 20000, mode: 'CASH' }], 4, 10);
    pay(anita, b, [{ kind: 'advance', amount: 15000, mode: 'UPI' }], 2, 17);

    /* 2. IP insured, finalized, claim sent — sponsor owes */
    v = makeVisit(mrs[1], 'i', 12, 2, [2]);
    b = makeBill(rahul, { visitId: v, insured: true, daysAgo: 12 });
    addCharges(rahul, b, [['REG02'], ['OPE01'], ['OPE04'], ['OPE05'], ['BED01', 3], ['NUR01', 3], ['DOC03', 4], ['LAB01'], ['RAD02'], ['MED02', 6], ['MED03', 6], ['ITE04', 2]], 12);
    pay(rahul, b, [{ kind: 'advance', amount: 5000, mode: 'CARD' }], 12, 11);
    step(rahul, 9, 13, () => finalizeBill(rahul, b));
    pay(rahul, b, [{ kind: 'settlement', amount: recalcBill(b).patient_due, mode: 'CASH' }], 9, 14);
    step(rahul, 9, 16, () => {
      db.prepare("UPDATE bills SET claim_status='S' WHERE bill_no=?").run(b);
      db.prepare("UPDATE bill_claims SET claim_status='S' WHERE bill_no=?").run(b);
      audit(rahul, { entity: 'bill', id: b, billNo: b, action: 'claim_sent', summary: 'Sent claim to sponsor' });
    });

    /* 3. IP insured, closed — sponsor paid in full */
    v = makeVisit(mrs[3], 'i', 18, 1, [3]);
    b = makeBill(rahul, { visitId: v, insured: true, daysAgo: 18 });
    addCharges(rahul, b, [['REG02'], ['OPE03'], ['OPE04'], ['OPE05'], ['RAD04'], ['BED03', 2], ['NUR01', 2], ['DOC03', 3], ['MED06', 2], ['ITE04']], 18);
    step(rahul, 16, 12, () => finalizeBill(rahul, b));
    pay(rahul, b, [{ kind: 'settlement', amount: recalcBill(b).patient_due, mode: 'CARD' }], 16, 12, 30);
    pay(suresh, b, [{ kind: 'sponsor_settlement', sponsorIndex: 'P', amount: recalcBill(b).sponsor_due, mode: 'NEFT' }], 5, 15);
    step(suresh, 5, 15, () => closeBill(suresh, b));

    /* 4. OP Bill Now closed today — cash */
    v = makeVisit(mrs[4], 'o', 0, 0);
    b = makeBill(anita, { visitId: v, billType: 'P', daysAgo: 0, hh: 9 });
    addCharges(anita, b, [['REG01'], ['DOC01'], ['LAB01'], ['LAB05']], 0, 9);
    pay(anita, b, [{ kind: 'settlement', amount: recalcBill(b).patient_due, mode: 'CASH' }], 0, 9, 40);
    step(anita, 0, 9, () => { finalizeBill(anita, b); closeBill(anita, b); });

    /* 5. OP Bill Now open — charges, nothing paid yet */
    v = makeVisit(mrs[5], 'o', 0, 4);
    b = makeBill(anita, { visitId: v, billType: 'P', daysAgo: 0, hh: 10 });
    addCharges(anita, b, [['REG01'], ['DOC02'], ['CAR01'], ['CAR02']], 0, 10);

    /* 6. IP non-insured, overpaid advance — finalize will move excess to deposit */
    v = makeVisit(mrs[7], 'i', 3, 0);
    b = makeBill(rahul, { visitId: v, daysAgo: 3 });
    addCharges(rahul, b, [['REG02'], ['BED01', 2], ['NUR01', 2], ['DOC03', 2], ['LAB01'], ['LAB02'], ['MED04', 4]], 3);
    pay(rahul, b, [{ kind: 'advance', amount: 25000, mode: 'CASH' }], 3, 10);

    /* 7. Finalized with patient due, write-off waiting for approval */
    v = makeVisit(mrs[11], 'i', 20, 5);
    b = makeBill(rahul, { visitId: v, daysAgo: 20 });
    addCharges(rahul, b, [['REG02'], ['ICU01', 2], ['BED01', 3], ['NUR01', 5], ['DOC03', 6], ['LAB01', 3], ['LAB03', 2], ['RAD03'], ['MED02', 10]], 20);
    pay(rahul, b, [{ kind: 'advance', amount: 40000, mode: 'CASH' }], 20, 12);
    step(rahul, 15, 11, () => finalizeBill(rahul, b));
    pay(rahul, b, [{ kind: 'settlement', amount: 8000, mode: 'CHEQUE' }], 14, 12);
    const due7 = recalcBill(b).patient_due;
    step(rahul, 2, 15, () => db.prepare("UPDATE bills SET patient_writeoff='M' WHERE bill_no=?").run(b));
    approval(rahul, 'writeoff', b, due7, 'Family unable to pay balance; social worker assessment attached.', 2);

    /* 8. Open, discount waiting for approval */
    v = makeVisit(mrs[14], 'i', 2, 3);
    b = makeBill(rahul, { visitId: v, daysAgo: 2 });
    addCharges(rahul, b, [['REG02'], ['OPE02'], ['OPE04'], ['BED02'], ['DOC03', 2], ['LAB01']], 2);
    const ope = db.prepare("SELECT * FROM charges WHERE bill_no=? AND code='OPE02'").get(b);
    db.prepare("UPDATE charges SET discount=?, discount_by='Dr. Meera Iyer (Medical Director)', discount_status='pending' WHERE charge_id=?").run(5600, ope.charge_id);
    recalcBill(b);
    approval(rahul, 'discount', b, 5600, 'Senior citizen, long-standing patient. 20% on surgery.', 1,
      { changes: [{ chargeId: ope.charge_id, description: ope.description, from: 0, to: 5600 }] });
    pay(rahul, b, [{ kind: 'advance', amount: 10000, mode: 'UPI' }], 2, 13);

    /* 9. Open, cancellation pending */
    v = makeVisit(mrs[15], 'o', 1, 1);
    b = makeBill(anita, { visitId: v, daysAgo: 1 });
    addCharges(anita, b, [['DOC02']], 1);
    step(anita, 1, 16, () => db.prepare("UPDATE bills SET cancellation_status='S', cancel_reason='Duplicate bill created at registration' WHERE bill_no=?").run(b));
    approval(anita, 'cancellation', b, 1500, 'Duplicate bill created at registration', 1);

    /* 10. Pharmacy Bill Now, closed, card */
    v = makeVisit(mrs[2], 'o', 1, 0);
    b = makeBill(anita, { visitId: v, billType: 'P', restriction: 'P', daysAgo: 1, hh: 14 });
    addCharges(anita, b, [['MED01', 2], ['MED06'], ['MED07']], 1, 14);
    pay(anita, b, [{ kind: 'settlement', amount: recalcBill(b).patient_due, mode: 'DEBIT' }], 1, 14, 20);
    step(anita, 1, 14, () => { finalizeBill(anita, b); closeBill(anita, b); });

    /* 11. Deposits: cash realized, cheque unrealized, package deposit; set-off on an open bill */
    deposit(anita, mrs[6], 30000, 'CASH', 10, 11, { payer: 'Krishnan R (husband)', phone: '99450 78900' });
    deposit(anita, mrs[6], 50000, 'CHEQUE', 1, 12, { payer: 'Krishnan R (husband)', remarks: 'For planned surgery' });
    deposit(anita, mrs[16], 15000, 'UPI', 6, 10, { packageName: 'Maternity package', availableFor: 'H' });
    deposit(anita, mrs[16], 15000, 'CASH', 2, 10, { packageName: 'Maternity package', availableFor: 'H' });
    deposit(anita, mrs[9], 8000, 'CASH', 8, 9, { availableFor: 'P', remarks: 'Pharmacy only' });
    deposit(anita, mrs[20], 20000, 'NEFT', 0, 11, { payer: 'Ramachandran S' });
    v = makeVisit(mrs[6], 'i', 5, 4);
    b = makeBill(rahul, { visitId: v, daysAgo: 5 });
    addCharges(rahul, b, [['REG02'], ['CAR02'], ['BED02', 3], ['NUR01', 3], ['DOC03', 4], ['LAB02'], ['LAB05']], 5);
    step(rahul, 4, 12, () => setOffDeposits(admin, recalcBill(b), { amount: 18000 }));

    /* 12. Closed in the past, then reopened for a missed charge */
    v = makeVisit(mrs[9], 'o', 7, 5);
    b = makeBill(anita, { visitId: v, billType: 'P', daysAgo: 7 });
    addCharges(anita, b, [['REG01'], ['DOC01'], ['LAB04']], 7);
    pay(anita, b, [{ kind: 'settlement', amount: recalcBill(b).patient_due, mode: 'UPI' }], 7, 11);
    step(anita, 7, 11, () => { finalizeBill(anita, b); closeBill(anita, b); });
    step(rahul, 0, 10, () => {
      db.prepare("UPDATE bills SET status='A', payment_status='U', finalized_at=NULL, finalized_by=NULL, closed_at=NULL, closed_by=NULL, reopen_reason='Charge missed: Thyroid profile not billed' WHERE bill_no=?").run(b);
      audit(rahul, { entity: 'bill', id: b, billNo: b, action: 'reopen', summary: 'Reopened — Charge missed' });
    });
    addCharges(rahul, b, [['LAB06']], 0, 10);

    /* 13. Cancelled bill */
    v = makeVisit(mrs[12], 'o', 6, 2);
    b = makeBill(anita, { visitId: v, daysAgo: 6 });
    step(suresh, 6, 15, () => cancelBillNow(suresh, b, 'Patient left before consultation'));

    /* 14. Two sponsors (Star + HDFC top-up), finalized */
    v = makeVisit(mrs[17], 'i', 9, 4, [1, 4]);
    b = makeBill(rahul, { visitId: v, insured: true, daysAgo: 9 });
    addCharges(rahul, b, [['REG02'], ['ICU01', 3], ['BED03', 2], ['CAR02'], ['DOC03', 6], ['LAB01', 4], ['LAB03', 2], ['MED02', 12], ['MED05', 2], ['OTC02']], 9);
    pay(rahul, b, [{ kind: 'advance', amount: 3000, mode: 'CASH' }], 9, 12);
    step(rahul, 3, 16, () => finalizeBill(rahul, b));
    pay(suresh, b, [{ kind: 'sponsor_advance', sponsorIndex: 'P', amount: 50000, mode: 'NEFT' }], 1, 11);

    /* 15. Corporate employee — open with points redeemed */
    v = makeVisit(mrs[5], 'o', 2, 1, [5]);
    b = makeBill(anita, { visitId: v, daysAgo: 2 });
    addCharges(anita, b, [['DOC02'], ['RAD04'], ['LAB01']], 2);
    withClock(at(2, 12), () => {
      db.prepare('UPDATE bills SET points_redeemed = 200, points_amount = 50 WHERE bill_no = ?').run(b);
      db.prepare('UPDATE reward_points SET redeemed = redeemed + 200 WHERE mr_no = ?').run(mrs[5]);
      recalcBill(b);
    });

    /* 16. A spread of closed OP bills over two weeks for reports and the day book */
    const opCombos = [[['REG01'], ['DOC01'], ['LAB01']], [['DOC02'], ['RAD01']], [['REG01'], ['DOC01'], ['LAB04'], ['LAB05']], [['DOC02'], ['RAD02']],
      [['DOC01'], ['CAR01'], ['LAB07']], [['REG01'], ['DOC04'], ['MED01'], ['ITE02', 2]], [['DOC02'], ['LAB06']]];
    const payModes = ['CASH', 'UPI', 'CARD', 'CASH', 'DEBIT', 'UPI', 'CASH'];
    for (let i = 0; i < 26; i++) {
      const days = i < 6 ? 0 : Math.floor((i - 4) / 2);
      const mr = mrs[(i * 5 + 3) % mrs.length];
      const user = i % 3 === 0 ? rahul : anita;
      const hh = 8 + (i % 9);
      v = makeVisit(mr, 'o', days, i);
      b = makeBill(user, { visitId: v, billType: 'P', daysAgo: days, hh });
      addCharges(user, b, opCombos[i % opCombos.length], days, hh);
      const due = recalcBill(b).patient_due;
      if (i % 5 === 2) pay(user, b, [{ kind: 'settlement', amount: r2(due - 500), mode: payModes[i % 7] }, { kind: 'settlement', amount: 500, mode: 'CASH' }], days, hh, 15);
      else pay(user, b, [{ kind: 'settlement', amount: due, mode: payModes[i % 7] }], days, hh, 15);
      step(user, days, hh, () => { finalizeBill(user, b); closeBill(user, b); });
    }

    /* 17. A cancelled receipt with its reversal, and an old finalized bill with dues for ageing */
    v = makeVisit(mrs[21], 'i', 45, 2);
    b = makeBill(rahul, { visitId: v, daysAgo: 45 });
    addCharges(rahul, b, [['REG02'], ['OPE01'], ['OPE04'], ['BED01', 3], ['DOC03', 3]], 45);
    pay(rahul, b, [{ kind: 'advance', amount: 30000, mode: 'CASH' }], 45, 11);
    step(rahul, 41, 12, () => finalizeBill(rahul, b));
    pay(rahul, b, [{ kind: 'settlement', amount: 10000, mode: 'UPI' }], 30, 12);

    v = makeVisit(mrs[23], 'o', 1, 0);
    b = makeBill(anita, { visitId: v, daysAgo: 1 });
    addCharges(anita, b, [['DOC01'], ['LAB01'], ['LAB02']], 1);
    const [wrong] = pay(anita, b, [{ kind: 'advance', amount: 2150, mode: 'CASH' }], 1, 12);
    withClock(at(1, 12, 25), () => {
      const no = nextNumber('receipt');
      db.prepare(`INSERT INTO receipts (receipt_no, bill_no, mr_no, payment_type, recpt_type, amount, mode_id, counter_id, username, created_at, remarks, reversal_of, source)
        VALUES (?,?,?, 'R', 'U', ?, ?, 2, 'anita', ?, 'Entered on wrong bill', ?, 'cancel')`).run(no, b, mrs[23], -2150, modeByCode.CASH.id, clock.now(), wrong.receipt_no);
      db.prepare("UPDATE receipts SET status='X', cancel_reason='Entered on wrong bill' WHERE receipt_no=?").run(wrong.receipt_no);
      audit(anita, { entity: 'receipt', id: wrong.receipt_no, billNo: b, action: 'cancel', summary: `Cancelled ${wrong.receipt_no}` });
      recalcBill(b);
    });

    /* 18. Yesterday's counter closures */
    const y = at(1, 21).slice(0, 10);
    for (const cid of [1, 2]) {
      const exp = r2(db.prepare(`SELECT COALESCE(SUM(x),0) AS s FROM (
          SELECT r.amount AS x FROM receipts r JOIN payment_modes m ON m.id = r.mode_id WHERE r.counter_id = ? AND m.code='CASH' AND substr(r.created_at,1,10)=?
          UNION ALL SELECT d.amount FROM deposits d JOIN payment_modes m ON m.id = d.mode_id WHERE d.counter_id = ? AND m.code='CASH' AND d.status='A' AND substr(d.created_at,1,10)=?)`)
        .get(cid, y, cid, y).s);
      const declared = cid === 2 ? r2(exp - 100) : exp;
      db.prepare(`INSERT INTO counter_closures (counter_id, business_date, expected_cash, declared_cash, variance, note, closed_by, closed_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(cid, y, exp, declared, r2(declared - exp), cid === 2 ? 'Short by ₹100 — change given twice, noted.' : null, cid === 2 ? 'anita' : 'priya', at(1, 21));
    }

    // Recently touched bills appear first in the list.
    db.prepare("UPDATE bills SET updated_at = COALESCE((SELECT MAX(at) FROM audit_log a WHERE a.bill_no = bills.bill_no), created_at)").run();
  });
  run();
  console.log(`Seeded ${db.prepare('SELECT COUNT(*) AS n FROM bills').get().n} bills, ${db.prepare('SELECT COUNT(*) AS n FROM receipts').get().n} receipts, ${db.prepare('SELECT COUNT(*) AS n FROM deposits').get().n} deposits.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  resetDatabase();
  seed();
  process.exit(0);
}
