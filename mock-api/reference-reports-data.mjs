/*
 * Reference Reports demo warehouse (fictional, deterministic).
 * Type-stripped copy of the read-only Lumen source src/lib/data/rng.ts and src/lib/data/datasets.ts.
 * No filesystem, network or npm dependency. Rows are generated in memory on first use each UTC day and
 * shared read-only across tenants because they contain no tenant data.
 */
/** Deterministic PRNG (mulberry32) so demo data is identical on every start. */
export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick (arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    weighted (arr, weights) {
      const total = weights.reduce((s, w) => s + w, 0);
      let r = next() * total;
      for (let i = 0; i < arr.length; i++) {
        r -= weights[i];
        if (r <= 0) return arr[i];
      }
      return arr[arr.length - 1];
    },
    /** Roughly normal noise around 1 with the given spread. */
    jitter(spread) {
      return 1 + (next() + next() + next() - 1.5) * (spread / 1.5);
    },
    poisson(lambda) {
      const L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= next();
      } while (p > L);
      return k - 1;
    },
  };
}



/*
 * Synthetic demo warehouse. Every dataset is generated deterministically from 2016-01-01 to today,
 * so date-range limits, background jobs and multi-year trends behave like they would on real data.
 * Replace this module with real connector adapters (see src/lib/sources.ts) for production use.
 */

export const DATA_START = '2016-01-01';
export const BRANCHES = ['Chennai', 'Bengaluru', 'Hyderabad', 'Kochi'];
const BRANCH_SIZE = { Chennai: 1.3, Bengaluru: 1.15, Hyderabad: 1.0, Kochi: 0.7 };

export const SERVICE_LINES = ['Outpatient', 'Inpatient', 'Emergency', 'Diagnostics', 'Pharmacy', 'Day care'];
const SERVICE_BASE = {
  Outpatient: 260000,
  Inpatient: 850000,
  Emergency: 120000,
  Diagnostics: 210000,
  Pharmacy: 300000,
  'Day care': 90000,
};
export const PAYERS = ['Self-pay', 'Private insurer', 'Government scheme', 'Corporate', 'TPA'];
const PAYER_WEIGHTS = [34, 28, 16, 12, 10];
export const DEPARTMENTS = ['General medicine', 'Cardiology', 'Orthopaedics', 'Paediatrics', 'Obstetrics', 'Dermatology'];
const DEPT_SIZE = [1.4, 1.0, 0.9, 0.8, 0.7, 0.5];
export const TEST_GROUPS = ['Haematology', 'Biochemistry', 'Microbiology', 'X-ray', 'CT', 'MRI', 'Ultrasound'];
export const INVENTORY_CATEGORIES = ['Medicines', 'Consumables', 'Implants', 'Reagents', 'Linen'];
export const COST_CENTERS = ['Administration', 'Nursing', 'Pharmacy', 'Laboratory', 'Radiology', 'Surgery'];
export const SCENARIOS = ['Budget', 'Forecast (base)', 'Forecast (optimistic)', 'Forecast (conservative)'];
export const AGING_BUCKETS = ['0-30 days', '31-60 days', '61-90 days', '90+ days'];
export const DENIAL_REASONS = ['Documentation', 'Coding', 'Eligibility', 'Pre-authorisation', 'Duplicate'];

const ACCOUNTS = [
  { code: '1000', name: 'Cash and bank', type: 'Asset' },
  { code: '1100', name: 'Accounts receivable', type: 'Asset' },
  { code: '1200', name: 'Inventory', type: 'Asset' },
  { code: '2000', name: 'Accounts payable', type: 'Liability' },
  { code: '2100', name: 'Accrued salaries', type: 'Liability' },
  { code: '4000', name: 'Patient revenue', type: 'Income' },
  { code: '4100', name: 'Pharmacy revenue', type: 'Income' },
  { code: '5000', name: 'Salaries', type: 'Expense' },
  { code: '5100', name: 'Medical supplies', type: 'Expense' },
  { code: '5200', name: 'Utilities', type: 'Expense' },
];
const ACCOUNT_TYPES = ['Asset', 'Liability', 'Income', 'Expense'];
const JOURNAL_TEMPLATES = [
  { dr: '1100', cr: '4000', base: 1_450_000, text: 'Patient revenue billed', cc: 'Administration' },
  { dr: '1000', cr: '4100', base: 280_000, text: 'Pharmacy counter sales', cc: 'Pharmacy' },
  { dr: '1000', cr: '1100', base: 1_250_000, text: 'Collections received', cc: 'Administration' },
  { dr: '1200', cr: '2000', base: 330_000, text: 'Supplies received on credit', cc: 'Pharmacy' },
  { dr: '5100', cr: '1200', base: 300_000, text: 'Supplies consumed', cc: 'Surgery' },
  { dr: '2000', cr: '1000', base: 310_000, text: 'Vendor payment', cc: 'Administration' },
  { dr: '5000', cr: '2100', base: 520_000, text: 'Payroll accrual', cc: 'Nursing' },
  { dr: '5200', cr: '1000', base: 60_000, text: 'Utility bills', cc: 'Administration' },
];
const DOCTORS = ['Dr. A. Raman', 'Dr. S. Iyer', 'Dr. P. Menon', 'Dr. K. Rao', 'Dr. M. Thomas', 'Dr. N. Pillai', 'Dr. R. Das', 'Dr. V. Nair'];
const FIRST = ['Arun', 'Meera', 'Karthik', 'Divya', 'Rahul', 'Anjali', 'Vikram', 'Lakshmi', 'Suresh', 'Priya', 'Joseph', 'Fatima', 'Ravi', 'Neha'];
const LAST = ['Kumar', 'Nair', 'Reddy', 'Iyer', 'Sharma', 'Menon', 'Rao', 'Pillai', 'Thomas', 'Khan', 'Das', 'Joshi'];

const f = (key, label, type, extra = {}) => ({ key, label, type, ...extra });
const sel = (options) => ({ filter: 'select', options: [...options] });
const common = [
  f('date', 'Date', 'date'),
  f('month', 'Month', 'string', { filter: 'select' }),
  f('year', 'Year', 'string', { filter: 'select' }),
  f('branch', 'Branch', 'string', sel(BRANCHES)),
];

export const DATASETS = [
  {
    id: 'revenue',
    name: 'Revenue transactions',
    description: 'Daily billed revenue by branch, service line and payer.',
    domain: 'Finance',
    sourceId: 'demo-warehouse',
    dateField: 'date',
    branchField: 'branch',
    fields: [
      ...common,
      f('service_line', 'Service line', 'string', sel(SERVICE_LINES)),
      f('payer', 'Payer', 'string', sel(PAYERS)),
      f('invoices', 'Invoices', 'integer'),
      f('gross_amount', 'Gross amount', 'currency'),
      f('discount', 'Discount', 'currency'),
      f('net_amount', 'Net revenue', 'currency'),
      f('collected', 'Collected', 'currency'),
    ],
  },
  {
    id: 'claims',
    name: 'Insurance claims',
    description: 'Claims submitted, approved and denied by payer, with outstanding amounts and aging.',
    domain: 'Finance',
    sourceId: 'demo-warehouse',
    dateField: 'date',
    branchField: 'branch',
    fields: [
      ...common,
      f('payer', 'Payer', 'string', sel(PAYERS.slice(1))),
      f('aging_bucket', 'Aging bucket', 'string', sel(AGING_BUCKETS)),
      f('denial_reason', 'Main denial reason', 'string', sel(DENIAL_REASONS)),
      f('submitted', 'Claims submitted', 'integer'),
      f('approved', 'Claims approved', 'integer'),
      f('denied', 'Claims denied', 'integer'),
      f('claim_amount', 'Claim amount', 'currency'),
      f('denied_amount', 'Denied amount', 'currency'),
      f('outstanding', 'Outstanding', 'currency'),
    ],
  },
  {
    id: 'gl',
    name: 'General ledger journal lines',
    description: 'Posted double-entry journal lines by account and cost center.',
    domain: 'Accounting',
    sourceId: 'demo-warehouse',
    dateField: 'date',
    branchField: 'branch',
    fields: [
      ...common,
      f('journal_no', 'Journal no.', 'string', { filter: 'text' }),
      f('account_code', 'Account code', 'string', { filter: 'text' }),
      f('account_name', 'Account', 'string', sel(ACCOUNTS.map((a) => a.name))),
      f('account_type', 'Account type', 'string', sel(ACCOUNT_TYPES)),
      f('cost_center', 'Cost center', 'string', sel(COST_CENTERS)),
      f('narration', 'Narration', 'string', { filter: 'text' }),
      f('debit', 'Debit', 'currency'),
      f('credit', 'Credit', 'currency'),
    ],
  },
  {
    id: 'appointments',
    name: 'Appointments',
    description: 'Booked, attended, cancelled and no-show appointments with waiting time.',
    domain: 'Patient access',
    sourceId: 'demo-warehouse',
    dateField: 'date',
    branchField: 'branch',
    fields: [
      ...common,
      f('department', 'Department', 'string', sel(DEPARTMENTS)),
      f('booked', 'Booked', 'integer'),
      f('attended', 'Attended', 'integer'),
      f('cancelled', 'Cancelled', 'integer'),
      f('no_show', 'No-shows', 'integer'),
      f('avg_wait_min', 'Average wait (min)', 'number'),
    ],
  },
  {
    id: 'clinical_activity',
    name: 'Clinical activity',
    description: 'Daily OP, ED and inpatient activity with bed occupancy by department.',
    domain: 'Clinical',
    sourceId: 'demo-warehouse',
    dateField: 'date',
    branchField: 'branch',
    fields: [
      ...common,
      f('department', 'Department', 'string', sel(DEPARTMENTS)),
      f('op_visits', 'OP visits', 'integer'),
      f('ed_visits', 'ED visits', 'integer'),
      f('admissions', 'Admissions', 'integer'),
      f('discharges', 'Discharges', 'integer'),
      f('occupied_beds', 'Occupied bed-days', 'integer'),
      f('available_beds', 'Available bed-days', 'integer'),
    ],
  },
  {
    id: 'admissions',
    name: 'Inpatient admissions',
    description: 'Patient-level admission register with length of stay, billing and outcomes. Contains PHI.',
    domain: 'Clinical',
    sourceId: 'demo-warehouse',
    dateField: 'date',
    branchField: 'branch',
    fields: [
      ...common,
      f('admission_id', 'Admission ID', 'string', { filter: 'text' }),
      f('patient_mrn', 'Patient MRN', 'string', { sensitive: true, filter: 'text' }),
      f('patient_name', 'Patient name', 'string', { sensitive: true }),
      f('age', 'Age', 'integer'),
      f('gender', 'Gender', 'string', sel(['Female', 'Male'])),
      f('department', 'Department', 'string', sel(DEPARTMENTS)),
      f('doctor', 'Consultant', 'string', sel(DOCTORS)),
      f('payer', 'Payer', 'string', sel(PAYERS)),
      f('los_days', 'Length of stay (days)', 'integer'),
      f('bill_amount', 'Bill amount', 'currency'),
      f('readmitted_30d', 'Readmitted within 30 days', 'integer'),
      f('discharge_status', 'Discharge status', 'string', sel(['Discharged', 'Transferred', 'Left against advice', 'Deceased'])),
      f('patients', 'Patients', 'integer'),
    ],
  },
  {
    id: 'lab_orders',
    name: 'Diagnostics orders',
    description: 'Laboratory and radiology orders, completion and turnaround time.',
    domain: 'Diagnostics',
    sourceId: 'demo-warehouse',
    dateField: 'date',
    branchField: 'branch',
    fields: [
      ...common,
      f('department', 'Department', 'string', sel(['Laboratory', 'Radiology'])),
      f('test_group', 'Test group', 'string', sel(TEST_GROUPS)),
      f('orders', 'Orders', 'integer'),
      f('completed', 'Completed', 'integer'),
      f('pending', 'Pending', 'integer'),
      f('tat_hours', 'Turnaround (hours)', 'number'),
      f('critical_results', 'Critical results', 'integer'),
    ],
  },
  {
    id: 'inventory',
    name: 'Inventory movement',
    description: 'Daily receipts, issues, closing stock and near-expiry value by store and category.',
    domain: 'Pharmacy and inventory',
    sourceId: 'demo-warehouse',
    dateField: 'date',
    branchField: 'branch',
    fields: [
      ...common,
      f('store', 'Store', 'string', sel(['Main pharmacy', 'Central store'])),
      f('item_category', 'Item category', 'string', sel(INVENTORY_CATEGORIES)),
      f('receipts_qty', 'Receipts (qty)', 'integer'),
      f('issues_qty', 'Issues (qty)', 'integer'),
      f('closing_qty', 'Closing stock (qty)', 'integer'),
      f('closing_value', 'Closing value', 'currency'),
      f('expiring_30d_value', 'Expiring in 30 days', 'currency'),
    ],
  },
  {
    id: 'budget',
    name: 'Budget and forecast',
    description: 'Monthly revenue targets by scenario against actual net revenue.',
    domain: 'Strategy',
    sourceId: 'demo-warehouse',
    dateField: 'date',
    branchField: 'branch',
    fields: [
      ...common,
      f('service_line', 'Service line', 'string', sel(SERVICE_LINES)),
      f('scenario', 'Scenario', 'string', sel(SCENARIOS)),
      f('target_revenue', 'Target revenue', 'currency'),
      f('actual_revenue', 'Actual revenue', 'currency'),
    ],
  },
];

export function getDataset(id) {
  return DATASETS.find((d) => d.id === id);
}

// ---------------------------------------------------------------------------
// Generation

function* days(until = new Date()) {
  const start = Date.UTC(2016, 0, 1);
  const end = Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate());
  for (let t = start; t <= end; t += 86400000) {
    const d = new Date(t);
    const date = d.toISOString().slice(0, 10);
    yield {
      date,
      month: date.slice(0, 7),
      year: date.slice(0, 4),
      dow: d.getUTCDay(),
      doy: Math.floor((t - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000),
      yearsFromStart: (t - start) / (365.25 * 86400000),
      ageDays: Math.floor((end - t) / 86400000),
    };
  }
}

const r2 = (n) => Math.round(n * 100) / 100;
const growth = (d) => Math.pow(1.075, d.yearsFromStart);
const season = (d) => 1 + 0.09 * Math.sin((2 * Math.PI * (d.doy - 30)) / 365);
const weekday = (d) => (d.dow === 0 ? 0.45 : d.dow === 6 ? 0.75 : 1);
/** 2020 dip to make trends realistic. */
const shock = (d) => (d.date >= '2020-04-01' && d.date < '2020-10-01' ? 0.62 : 1);

const GENERATORS = {
  revenue() {
    const rng = createRng(101);
    const rows = [];
    for (const d of days()) {
      const base = growth(d) * season(d) * weekday(d) * shock(d);
      for (const branch of BRANCHES) {
        for (const svc of SERVICE_LINES) {
          const gross = SERVICE_BASE[svc] * BRANCH_SIZE[branch] * base * rng.jitter(0.25);
          const discount = gross * (0.02 + rng.next() * 0.05);
          const net = gross - discount;
          rows.push({
            date: d.date,
            month: d.month,
            year: d.year,
            branch,
            service_line: svc,
            payer: rng.weighted(PAYERS, PAYER_WEIGHTS),
            invoices: Math.max(1, Math.round(gross / (svc === 'Inpatient' ? 42000 : 2600))),
            gross_amount: r2(gross),
            discount: r2(discount),
            net_amount: r2(net),
            collected: r2(net * (d.ageDays > 60 ? 0.93 + rng.next() * 0.06 : 0.55 + rng.next() * 0.3)),
          });
        }
      }
    }
    return rows;
  },

  claims() {
    const rng = createRng(202);
    const rows = [];
    const payers = PAYERS.slice(1);
    for (const d of days()) {
      const base = growth(d) * weekday(d) * shock(d);
      const bucket = d.ageDays <= 30 ? AGING_BUCKETS[0] : d.ageDays <= 60 ? AGING_BUCKETS[1] : d.ageDays <= 90 ? AGING_BUCKETS[2] : AGING_BUCKETS[3];
      for (const branch of BRANCHES) {
        for (const payer of payers) {
          const submitted = Math.max(0, Math.round(22 * BRANCH_SIZE[branch] * base * rng.jitter(0.35)));
          const denyRate = (payer === 'Government scheme' ? 0.13 : payer === 'TPA' ? 0.1 : 0.07) * rng.jitter(0.4);
          const denied = Math.round(submitted * Math.max(0, denyRate));
          const approved = submitted - denied;
          const avgClaim = 38000 * rng.jitter(0.2);
          const claimAmount = submitted * avgClaim;
          const openShare = d.ageDays <= 30 ? 0.7 : d.ageDays <= 60 ? 0.35 : d.ageDays <= 90 ? 0.18 : d.ageDays <= 365 ? 0.03 : 0;
          rows.push({
            date: d.date,
            month: d.month,
            year: d.year,
            branch,
            payer,
            aging_bucket: bucket,
            denial_reason: rng.weighted(DENIAL_REASONS, [35, 22, 18, 20, 5]),
            submitted,
            approved,
            denied,
            claim_amount: r2(claimAmount),
            denied_amount: r2(denied * avgClaim),
            outstanding: r2(approved * avgClaim * openShare * rng.jitter(0.2)),
          });
        }
      }
    }
    return rows;
  },

  gl() {
    const rng = createRng(303);
    const rows = [];
    const acct = new Map (ACCOUNTS.map((a) => [a.code, a]));
    let seq = 0;
    for (const d of days()) {
      const base = growth(d) * season(d) * shock(d);
      for (const branch of BRANCHES) {
        const picks = new Set ();
        while (picks.size < 3) picks.add(rng.int(0, JOURNAL_TEMPLATES.length - 1));
        for (const i of picks) {
          const t = JOURNAL_TEMPLATES[i];
          const amount = r2(t.base * BRANCH_SIZE[branch] * base * rng.jitter(0.3));
          seq++;
          const jn = `JV-${d.year}-${String(seq).padStart(7, '0')}`;
          const dr = acct.get(t.dr);
          const cr = acct.get(t.cr);
          const cc = t.cc === 'Surgery' ? rng.pick(COST_CENTERS) : t.cc;
          rows.push({ date: d.date, month: d.month, year: d.year, branch, journal_no: jn, account_code: dr.code, account_name: dr.name, account_type: dr.type, cost_center: cc, narration: t.text, debit: amount, credit: 0 });
          rows.push({ date: d.date, month: d.month, year: d.year, branch, journal_no: jn, account_code: cr.code, account_name: cr.name, account_type: cr.type, cost_center: cc, narration: t.text, debit: 0, credit: amount });
        }
      }
    }
    return rows;
  },

  appointments() {
    const rng = createRng(404);
    const rows = [];
    for (const d of days()) {
      const base = growth(d) * season(d) * weekday(d) * shock(d);
      for (const branch of BRANCHES) {
        DEPARTMENTS.forEach((dept, i) => {
          const booked = Math.max(0, Math.round(70 * DEPT_SIZE[i] * BRANCH_SIZE[branch] * base * rng.jitter(0.25)));
          const cancelled = Math.round(booked * 0.06 * rng.jitter(0.5));
          const noShow = Math.round((booked - cancelled) * (0.08 + (d.dow === 1 ? 0.04 : 0)) * rng.jitter(0.5));
          rows.push({
            date: d.date, month: d.month, year: d.year, branch, department: dept,
            booked, attended: Math.max(0, booked - cancelled - noShow), cancelled, no_show: noShow,
            avg_wait_min: r2(18 + 14 * rng.next() + (booked > 90 ? 12 : 0)),
          });
        });
      }
    }
    return rows;
  },

  clinical_activity() {
    const rng = createRng(505);
    const rows = [];
    for (const d of days()) {
      const base = growth(d) * season(d) * shock(d);
      for (const branch of BRANCHES) {
        DEPARTMENTS.forEach((dept, i) => {
          const beds = Math.round(28 * DEPT_SIZE[i] * BRANCH_SIZE[branch]);
          const occ = Math.min(beds, Math.round(beds * (0.72 + 0.18 * season(d) - 0.18) * rng.jitter(0.12) * (shock(d) < 1 ? 0.7 : 1)));
          const adm = Math.max(0, Math.round(beds / 4.2 * rng.jitter(0.35)));
          rows.push({
            date: d.date, month: d.month, year: d.year, branch, department: dept,
            op_visits: Math.max(0, Math.round(60 * DEPT_SIZE[i] * BRANCH_SIZE[branch] * base * weekday(d) * rng.jitter(0.25))),
            ed_visits: Math.max(0, Math.round(9 * DEPT_SIZE[i] * BRANCH_SIZE[branch] * base * rng.jitter(0.4))),
            admissions: adm,
            discharges: Math.max(0, Math.round(adm * rng.jitter(0.25))),
            occupied_beds: Math.max(0, occ),
            available_beds: beds,
          });
        });
      }
    }
    return rows;
  },

  admissions() {
    const rng = createRng(606);
    const rows = [];
    let seq = 100000;
    for (const d of days()) {
      const base = growth(d) * shock(d);
      for (const branch of BRANCHES) {
        const n = rng.poisson(3.2 * BRANCH_SIZE[branch] * base);
        for (let k = 0; k < n; k++) {
          seq++;
          const di = rng.int(0, DEPARTMENTS.length - 1);
          const los = Math.max(1, Math.round((DEPARTMENTS[di] === 'Cardiology' ? 5 : 3.4) * rng.jitter(0.7)));
          const r = rng.next();
          rows.push({
            date: d.date, month: d.month, year: d.year, branch,
            admission_id: `ADM${seq}`,
            patient_mrn: `MRN${String(rng.int(1000000, 9999999))}`,
            patient_name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
            age: DEPARTMENTS[di] === 'Paediatrics' ? rng.int(0, 16) : DEPARTMENTS[di] === 'Obstetrics' ? rng.int(19, 41) : rng.int(18, 88),
            gender: DEPARTMENTS[di] === 'Obstetrics' ? 'Female' : rng.pick(['Female', 'Male']),
            department: DEPARTMENTS[di],
            doctor: DOCTORS[(di + rng.int(0, 2)) % DOCTORS.length],
            payer: rng.weighted(PAYERS, PAYER_WEIGHTS),
            los_days: los,
            bill_amount: r2(los * 31000 * rng.jitter(0.4)),
            readmitted_30d: rng.next() < 0.07 ? 1 : 0,
            discharge_status: r < 0.9 ? 'Discharged' : r < 0.95 ? 'Transferred' : r < 0.985 ? 'Left against advice' : 'Deceased',
            patients: 1,
          });
        }
      }
    }
    return rows;
  },

  lab_orders() {
    const rng = createRng(707);
    const rows = [];
    const size = { Haematology: 140, Biochemistry: 170, Microbiology: 45, 'X-ray': 60, CT: 18, MRI: 9, Ultrasound: 30 };
    const tat = { Haematology: 2.5, Biochemistry: 4, Microbiology: 38, 'X-ray': 3, CT: 6, MRI: 20, Ultrasound: 5 };
    for (const d of days()) {
      const base = growth(d) * weekday(d) * shock(d);
      for (const branch of BRANCHES) {
        for (const tg of TEST_GROUPS) {
          if (d.dow === 0 && (tg === 'MRI' || tg === 'Microbiology')) continue;
          const orders = Math.max(0, Math.round(size[tg] * BRANCH_SIZE[branch] * base * rng.jitter(0.3)));
          const pending = d.ageDays < 3 ? Math.round(orders * 0.2 * rng.next()) : 0;
          rows.push({
            date: d.date, month: d.month, year: d.year, branch,
            department: ['X-ray', 'CT', 'MRI', 'Ultrasound'].includes(tg) ? 'Radiology' : 'Laboratory',
            test_group: tg, orders, completed: orders - pending, pending,
            tat_hours: r2(tat[tg] * rng.jitter(0.35)),
            critical_results: Math.round(orders * 0.015 * rng.jitter(0.8)),
          });
        }
      }
    }
    return rows;
  },

  inventory() {
    const rng = createRng(808);
    const rows = [];
    const unit = { Medicines: 180, Consumables: 65, Implants: 42000, Reagents: 900, Linen: 350 };
    const level = { Medicines: 42000, Consumables: 60000, Implants: 120, Reagents: 3000, Linen: 5000 };
    const stock = {};
    for (const d of days()) {
      for (const branch of BRANCHES) {
        for (const cat of INVENTORY_CATEGORIES) {
          const k = branch + cat;
          const target = level[cat] * BRANCH_SIZE[branch] * growth(d);
          if (stock[k] === undefined) stock[k] = target;
          const issues = Math.max(0, Math.round(target * 0.035 * weekday(d) * rng.jitter(0.3)));
          const receipts = stock[k] < target * 0.9 ? Math.round(target * 0.12 * rng.jitter(0.3)) : d.dow === 2 ? Math.round(target * 0.05) : 0;
          stock[k] = Math.max(0, stock[k] + receipts - issues);
          const value = stock[k] * unit[cat] * rng.jitter(0.05);
          rows.push({
            date: d.date, month: d.month, year: d.year, branch,
            store: cat === 'Medicines' ? 'Main pharmacy' : 'Central store',
            item_category: cat, receipts_qty: receipts, issues_qty: issues,
            closing_qty: Math.round(stock[k]),
            closing_value: r2(value),
            expiring_30d_value: r2(cat === 'Linen' ? 0 : value * 0.03 * rng.jitter(0.8)),
          });
        }
      }
    }
    return rows;
  },

  budget() {
    const rng = createRng(909);
    // Actuals from the revenue dataset, aggregated per month/branch/service line.
    const actual = new Map ();
    for (const r of getRows('revenue')) {
      const k = `${r.month}|${r.branch}|${r.service_line}`;
      actual.set(k, (actual.get(k) ?? 0) + (r.net_amount));
    }
    const rows = [];
    const now = new Date();
    const endYear = now.getUTCFullYear() + 1;
    for (let y = 2016; y <= endYear; y++) {
      for (let m = 1; m <= 12; m++) {
        const month = `${y}-${String(m).padStart(2, '0')}`;
        const date = `${month}-01`;
        const t = (y - 2016) + (m - 1) / 12;
        for (const branch of BRANCHES) {
          for (const svc of SERVICE_LINES) {
            const act = actual.get(`${month}|${branch}|${svc}`) ?? 0;
            const expected = SERVICE_BASE[svc] * 0.955 * BRANCH_SIZE[branch] * Math.pow(1.075, t) * 27.8;
            const target = {
              Budget: expected * 1.04,
              'Forecast (base)': expected * rng.jitter(0.03),
              'Forecast (optimistic)': expected * 1.09,
              'Forecast (conservative)': expected * 0.92,
            };
            for (const sc of SCENARIOS) {
              rows.push({ date, month, year: String(y), branch, service_line: svc, scenario: sc, target_revenue: r2(target[sc]), actual_revenue: r2(act) });
            }
          }
        }
      }
    }
    return rows;
  },
};

const cache = new Map();

/** Returns all rows of a dataset, generating (and caching) them on first use each day. */
export function getRows(datasetId) {
  const today = new Date().toISOString().slice(0, 10);
  const hit = cache.get(datasetId);
  if (hit && hit.day === today) return hit.rows;
  const gen = GENERATORS[datasetId];
  if (!gen) throw new Error(`Unknown dataset ${datasetId}`);
  const rows = gen();
  cache.set(datasetId, { rows, generatedAt: new Date().toISOString(), day: today });
  return rows;
}

export function datasetFreshness(datasetId) {
  return cache.get(datasetId)?.generatedAt ?? 'not loaded yet';
}

export function datasetStats() {
  return DATASETS.map((d) => {
    const c = cache.get(d.id);
    return { id: d.id, rows: c ? c.rows.length : null, generatedAt: c ? c.generatedAt : null };
  });
}

/** Rough rows-per-day used to estimate result size before running. */
export const ROWS_PER_DAY = {
  revenue: 24,
  claims: 16,
  gl: 24,
  appointments: 24,
  clinical_activity: 24,
  admissions: 15,
  lab_orders: 27,
  inventory: 20,
  budget: 3.2,
};
