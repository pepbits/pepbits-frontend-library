import { addDays, audit, db, todayUtc } from './db';
import { getRes, insertRecord, loadRow, round2 } from './engine';
import { RESOURCES, tableName } from './registry';

/** Synthetic data only: no real patients, payers, credentials or tenant records. */

let seed = 20261001;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const day = (ago: number) => addDays(todayUtc(), -ago);
const stamp = (ago: number, hour = 9) => { const d = new Date(day(ago) + 'T00:00:00Z'); d.setUTCHours(hour, between(0, 59), between(0, 59)); return d.toISOString(); };

const USERS = [
  [1, 'Layla Mansour', 'Front office supervisor', 'LM', 'cyan', 'RUH-CENTRAL'],
  [2, 'Karim Haddad', 'Billing specialist', 'KH', 'saffron', 'RUH-CENTRAL'],
  [3, 'Sofia Petrova', 'Revenue cycle manager', 'SP', 'harbor', null],
  [4, 'Yusuf Al-Amin', 'Claims analyst', 'YA', 'cobalt', 'RUH-CENTRAL'],
  [5, 'Grace Mensah', 'Finance controller', 'GM', 'jade', null],
  [6, 'Arjun Nair', 'Clinical coder', 'AN', 'madder', 'JED-DAYSURG'],
] as const;

const FIRST = ['Noura', 'Faisal', 'Hana', 'Omar', 'Reem', 'Tariq', 'Mariam', 'Khalid', 'Aisha', 'Hassan', 'Lina', 'Sami', 'Dana', 'Ibrahim', 'Yara', 'Majed', 'Salma', 'Ahmed', 'Joud', 'Nasser', 'Priya', 'Daniel', 'Elena', 'Rahul', 'Fatima', 'Ziad', 'Maya', 'Bilal', 'Rania', 'Adel', 'Leen', 'Waleed', 'Sara', 'Kenji', 'Amal', 'Imran'];
const LAST = ['Al-Harbi', 'Qureshi', 'Al-Otaibi', 'Rahman', 'Haddad', 'Al-Zahrani', 'Mendes', 'Saleh', 'Kowalski', 'Al-Shehri', 'Farouk', 'Menon', 'Al-Ghamdi', 'Okoye', 'Nasser', 'Al-Dosari'];
const DOCTORS = ['Dr. Hala Siddiq', 'Dr. Marco Vitale', 'Dr. Rashid Al-Fahd', 'Dr. Anika Rao', 'Dr. Tomas Lindqvist', 'Dr. Mona Khalil'];

type Opts = { status?: string; by?: number; age?: number; statusBy?: number; statusAge?: number; reason?: string | null };

/** Inserts a record with realistic created/status history. */
function put(resKey: string, values: Record<string, any>, o: Opts = {}) {
  const res = getRes(resKey);
  const by = o.by ?? 2;
  const age = o.age ?? 3;
  const status = o.status ?? res.initial;
  const statusBy = o.statusBy ?? by;
  const created = stamp(age, between(7, 11));
  const statusAt = status === res.initial ? created : stamp(o.statusAge ?? Math.max(age - 1, 0), between(12, 17));
  const id = insertRecord(res, values, { status, actorId: by, at: created, statusBy, reason: o.reason ?? null });
  db.prepare(`UPDATE ${tableName(resKey)} SET status_at = ?, updated_at = ?, updated_by = ? WHERE id = ?`).run(statusAt, statusAt, statusBy, id);
  const row = loadRow(res, id);
  audit({ at: created, actorId: by, resource: resKey, recordId: id, recordRef: row.ref, action: 'CREATED', to: res.initial, summary: `Created ${res.singular} ${row.ref}${row.title ? ` (${row.title})` : ''}.` });
  if (status !== res.initial) {
    const label = res.statuses.find((s) => s.key === status)?.label.toLowerCase();
    audit({ at: statusAt, actorId: statusBy, resource: resKey, recordId: id, recordRef: row.ref, action: 'STATUS_CHANGED', from: res.initial, to: status, summary: `${row.ref} moved to ${label}.`, reason: o.reason ?? null });
  }
  return { id, ref: row.ref };
}

export function seedAll() {
  const today = todayUtc();
  for (const u of USERS) db.prepare('INSERT INTO app_user (id, name, title, email, initials, tone, home_branch) VALUES (?,?,?,?,?,?,?)').run(u[0], u[1], u[2], `${u[1].toLowerCase().replace(/[^a-z]+/g, '.')}@meridian.example`, u[3], u[4], u[5]);

  const branches = ['RUH-CENTRAL', 'RUH-CENTRAL', 'RUH-CENTRAL', 'JED-DAYSURG', 'JED-DAYSURG', 'DXB-DHCC'];
  const patients: { id: number; branch: string }[] = [];
  for (let i = 0; i < 40; i++) {
    const b = branches[i % branches.length];
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
    const info = db.prepare('INSERT INTO ref_patient (mrn, name, dob, sex, nationality, phone, branch) VALUES (?,?,?,?,?,?,?)')
      .run(`MRN-${(104200 + i * 37).toString()}`, name, `${1950 + ((i * 13) % 55)}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + ((i * 3) % 27)).padStart(2, '0')}`, i % 2 ? 'F' : 'M', b === 'DXB-DHCC' ? 'AE' : i % 3 ? 'SA' : 'IN', `+9665${String(30000000 + i * 104729).slice(0, 8)}`, b);
    patients.push({ id: Number(info.lastInsertRowid), branch: b });
  }
  const ins = (sql: string, rows: unknown[][]) => rows.forEach((r) => db.prepare(sql).run(...r));
  ins('INSERT INTO ref_payer (id, code, name, kind) VALUES (?,?,?,?)', [[1, 'GSI', 'Gulf Shield Insurance', 'INSURER'], [2, 'OMT', 'Oasis Mutual Takaful', 'INSURER'], [3, 'ECA', 'Emirates Care Assurance', 'INSURER'], [4, 'NHA', 'Najm Health Administrators', 'TPA'], [5, 'SELF', 'Self-pay', 'SELF']]);
  ins('INSERT INTO ref_plan (id, code, name, payer_id) VALUES (?,?,?,?)', [[1, 'PLN-0001', 'Gulf Shield Gold, Class A', 1], [2, 'PLN-0002', 'Oasis Standard, Class B', 2], [3, 'PLN-0003', 'Emirates Care Essential', 3]]);
  const ITEMS: [string, string, string, number, number][] = [
    ['CONS-SPEC', 'Specialist consultation', 'SERVICE', 450, 0.15], ['CONS-FU', 'Follow-up consultation', 'SERVICE', 300, 0.15], ['LAB-CBC', 'Complete blood count', 'LABORATORY', 85, 0.15],
    ['LAB-HBA1C', 'HbA1c test', 'LABORATORY', 120, 0.15], ['IMG-MRIKNEE', 'MRI knee without contrast', 'IMAGING', 1850, 0.15], ['IMG-CXR', 'Chest X-ray', 'IMAGING', 220, 0.15],
    ['PRC-CHOLE', 'Laparoscopic cholecystectomy', 'PROCEDURE', 14500, 0.15], ['ACC-WARD', 'Ward bed day', 'ACCOMMODATION', 1200, 0.15], ['MED-PARA', 'Paracetamol 500 mg tablet', 'MEDICINE', 2, 0],
    ['FEE-REPORT', 'Medical report fee', 'SERVICE', 150, 0.15], ['PKG-EXEC', 'Executive health check', 'PACKAGE', 2400, 0.15], ['PKG-PHYSIO', 'Physiotherapy, 10 sessions', 'PACKAGE', 3000, 0.15],
    ['ER-L3', 'Emergency visit, level 3', 'SERVICE', 650, 0.15], ['PRC-APPX', 'Laparoscopic appendicectomy', 'PROCEDURE', 11200, 0.15],
  ];
  ITEMS.forEach((it, i) => db.prepare('INSERT INTO ref_item (id, code, name, kind, price_minor, vat_rate) VALUES (?,?,?,?,?,?)').run(i + 1, it[0], it[1], it[2], it[3] * 100, it[4]));
  ins('INSERT INTO ref_account (id, number, name) VALUES (?,?,?)', [[1, '1210', 'Patient receivables'], [2, '1220', 'Payer receivables'], [3, '1150', 'Tender clearing'], [4, '2310', 'VAT payable'], [5, '2410', 'Unapplied receipts'], [6, '4100', 'Patient service revenue'], [7, '4900', 'Contractual allowances'], [8, '1230', 'Model receivable'], [9, '4200', 'Contract revenue'], [10, '1010', 'Cash on hand']]);
  ins('INSERT INTO ref_contract (id, code, name, payer_id, model) VALUES (?,?,?,?,?)', [[1, 'CTR-0001', 'Gulf Shield provider agreement 2026', 1, 'FFS_CATALOG'], [2, 'CTR-0002', 'Oasis Takaful capitation 2026', 2, 'CAPITATION'], [3, 'CTR-0003', 'Emirates Care bundle 2026', 3, 'BUNDLE']]);
  const price = (item: number) => ITEMS[item - 1][3];
  const vat = (item: number) => ITEMS[item - 1][4];

  /* ---------- Encounters → charges → invoices → money ---------- */
  type PaidClaim = { claimRef: string; payer: number; branch: string; claimed: number; paid: number; month: string; reasonCode?: string };
  const paidClaims: PaidClaim[] = [];
  const denied: { id: number; ref: string; patient: number; payer: number; balance: number; branch: string }[] = [];
  const recentAck: { ref: string; payer: number; amount: number; branch: string }[] = [];
  const issuedInvoices: { id: number; ref: string; patient: number; balance: number; billTo: string; branch: string; age: number }[] = [];
  const encounterRows: { id: number; patient: number; branch: string; care: string; age: number; payer: number | null; attending: string }[] = [];

  const CARE = ['OUTPATIENT', 'OUTPATIENT', 'OUTPATIENT', 'INPATIENT', 'DAYCASE', 'EMERGENCY'];
  for (let i = 0; i < 84; i++) {
    const age = i < 68 ? Math.round(178 - i * 2.48) : Math.max(0, Math.round((83 - i) * 0.62));
    const p = patients[(i * 11) % patients.length];
    const branch = p.branch;
    const care = branch === 'JED-DAYSURG' ? pick(['DAYCASE', 'OUTPATIENT']) : pick(CARE);
    const insured = rnd() < 0.62;
    const payer = insured ? (branch === 'DXB-DHCC' ? 3 : pick([1, 1, 2])) : null;
    const attending = pick(DOCTORS);
    const items: [number, number][] =
      care === 'INPATIENT' ? [[8, between(2, 6)], [pick([7, 14]), 1], [3, 1], [9, between(6, 20)]]
        : care === 'DAYCASE' ? [[pick([7, 14]), 1], [3, 1], [6, 1]]
          : care === 'EMERGENCY' ? [[13, 1], [6, 1], [9, 10]]
            : [[pick([1, 2]), 1], [pick([3, 4, 5, 6]), 1]];
    const billed = age > 6;
    const encStatus = billed ? 'BILLED' : age >= 3 ? (rnd() < 0.3 ? 'ON_HOLD' : 'READY_TO_BILL') : 'OPEN';
    const unbilled = billed ? 0 : items.reduce((s, [it, q]) => s + price(it) * q, 0);
    const enc = put('encounters', { patient: p.id, branch, careSetting: care, payer, attending, admittedOn: day(age), dischargedOn: day(Math.max(age - (care === 'INPATIENT' ? 3 : 0), 0)), amount: unbilled, dueDate: day(age - 5), holdReason: encStatus === 'ON_HOLD' ? 'Waiting for the operative note before coding' : undefined },
      { status: encStatus, by: 1, age, statusBy: 2, statusAge: Math.max(age - 1, 0), reason: encStatus === 'ON_HOLD' ? 'Waiting for the operative note before coding' : null });
    encounterRows.push({ id: enc.id, patient: p.id, branch, care, age, payer, attending });

    const chargeRows = items.map(([it, q], k) => {
      const cs = billed ? 'BILLED' : encStatus === 'OPEN' ? (k === 0 ? 'PRICED' : pick(['CAPTURED', 'PRICED', 'REVIEW'])) : 'PRICED';
      const unitPrice = cs === 'CAPTURED' ? undefined : price(it);
      return { it, q, cs, unitPrice, amount: unitPrice ? price(it) * q : 0 };
    });
    const insertCharges = (invoiceRef?: string) => chargeRows.forEach((c) => put('charges', { patient: p.id, encounter: enc.id, item: c.it, quantity: c.q, unitPrice: c.unitPrice, amount: c.amount, serviceDate: day(age), source: 'ORDER_COMPLETION', branch, invoiceRef },
      { status: c.cs, by: 1, age, statusBy: 2, reason: c.cs === 'REVIEW' ? 'Quantity looks high for the procedure' : null }));
    if (!billed) { insertCharges(); continue; }

    const uae = branch === 'DXB-DHCC';
    const lines = chargeRows.map((c) => { const net = price(c.it) * c.q; const tax = uae ? 0 : round2(net * vat(c.it)); return { description: ITEMS[c.it - 1][1], quantity: c.q, unitPrice: price(c.it), tax, amount: round2(net + tax) }; });
    const subtotal = round2(lines.reduce((s, l) => s + l.amount - l.tax, 0));
    const tax = round2(lines.reduce((s, l) => s + l.tax, 0));
    const total = round2(subtotal + tax);
    const issueAge = age - 1;
    const draft = age <= 14 && (payer ? rnd() < 0.25 : rnd() < 0.7);
    const billTo = payer ? 'PAYER' : 'PATIENT';

    // Decide outcome before inserting so balances and statuses are consistent.
    let paid = 0;
    let claimPlan: { status: string; paid: number; reason?: string } | null = null;
    if (!draft && billTo === 'PATIENT') paid = rnd() < (age > 20 ? 0.82 : 0.6) ? total : rnd() < 0.5 ? round2(total * 0.5) : 0;
    if (!draft && billTo === 'PAYER') {
      const r = rnd();
      claimPlan = age > 55 ? (r < 0.72 ? { status: 'PAID', paid: total } : r < 0.86 ? { status: 'DENIED', paid: 0, reason: pick(['NOT_COVERED', 'NO_AUTHORIZATION', 'CODING_ERROR', 'DUPLICATE']) } : { status: 'PARTIALLY_PAID', paid: round2(total * 0.8), reason: 'CONTRACTUAL' })
        : age > 25 ? (r < 0.45 ? { status: 'PAID', paid: total } : r < 0.6 ? { status: 'DENIED', paid: 0, reason: pick(['NOT_COVERED', 'NO_AUTHORIZATION', 'TIMELY_FILING']) } : { status: 'ACKNOWLEDGED', paid: 0 })
          : issueAge <= 12 ? { status: 'READY', paid: 0 } : { status: r < 0.5 ? 'SUBMITTED' : 'ACKNOWLEDGED', paid: 0 };
      paid = claimPlan.paid;
    }
    const balance = draft ? 0 : round2(total - paid);
    const invStatus = draft ? 'DRAFT' : balance <= 0 ? 'PAID' : balance < total ? 'PARTIALLY_PAID' : 'ISSUED';
    const inv = put('invoices', { patient: p.id, encounter: enc.id, billTo, payer, subtotal, tax, amount: total, balance, issuedOn: draft ? undefined : day(issueAge), dueDate: draft ? undefined : day(issueAge - 30), lines, branch },
      { status: invStatus, by: 2, age: issueAge, statusBy: draft ? 2 : 5, statusAge: Math.max(issueAge, 0) });
    insertCharges(inv.ref);
    if (!draft && balance > 0) issuedInvoices.push({ id: inv.id, ref: inv.ref, patient: p.id, balance, billTo, branch, age: issueAge });

    if (billTo === 'PATIENT' && paid > 0)
      put('receipts', { payerType: 'PATIENT', patient: p.id, amount: paid, balance: 0, method: pick(['CASH', 'CARD', 'CARD', 'BANK_TRANSFER']), receivedOn: day(issueAge), branch, allocations: [{ invoiceRef: inv.ref, amount: paid, on: day(issueAge) }] },
        { status: 'ALLOCATED', by: 1, age: issueAge, statusAge: issueAge });

    if (claimPlan) {
      const channel = payer === 2 ? 'PAYER_PORTAL' : 'EXCHANGE';
      const submitted = claimPlan.status !== 'READY';
      const cBalance = round2(total - claimPlan.paid);
      const claim = put('claims', { patient: p.id, invoice: inv.id, payer, amount: total, balance: cBalance, channel, submittedOn: submitted ? day(issueAge - 1) : undefined, dueDate: day(issueAge - 90), denialReason: claimPlan.status === 'DENIED' ? claimPlan.reason : undefined, branch },
        { status: claimPlan.status, by: 4, age: issueAge, statusBy: 4, statusAge: Math.max(issueAge - (claimPlan.status === 'PAID' ? 30 : 2), 0) });
      if (submitted && channel === 'EXCHANGE') {
        const failed = issueAge < 60 && claim.id % 3 === 0;
        put('exchange-messages', { operation: 'CLAIM', payer, claim: claim.id, format: payer === 3 ? 'X12_837P' : 'REST_JSON', endpointAlias: payer === 3 ? 'ECA_CLAIMS_837' : 'GSI_CLAIMS_V2', attempts: failed ? between(2, 5) : 1, lastError: failed ? pick(['HTTP 503 from payer gateway', 'Schema rejected: member ID format', 'TLS handshake timeout']) : undefined, branch },
          { status: failed ? pick(['FAILED', 'DEAD_LETTER']) : 'ACKNOWLEDGED', by: 4, age: Math.max(issueAge - 1, 0), statusAge: Math.max(issueAge - 1, 0) });
      }
      if (claimPlan.status === 'PAID' || claimPlan.status === 'PARTIALLY_PAID')
        paidClaims.push({ claimRef: claim.ref, payer: payer!, branch, claimed: total, paid: claimPlan.paid, month: day(issueAge - 30).slice(0, 7), reasonCode: claimPlan.reason });
      if (claimPlan.status === 'DENIED') denied.push({ id: claim.id, ref: claim.ref, patient: p.id, payer: payer!, balance: total, branch });
      if (claimPlan.status === 'ACKNOWLEDGED' && issueAge < 30) recentAck.push({ ref: claim.ref, payer: payer!, amount: total, branch });
    }
  }

  // Posted remittances per payer and month, each with a matching payer EFT receipt.
  const batches = new Map<string, PaidClaim[]>();
  for (const c of paidClaims) batches.set(`${c.payer}|${c.month}|${c.branch}`, [...(batches.get(`${c.payer}|${c.month}|${c.branch}`) ?? []), c]);
  for (const [key, list] of batches) {
    const [payer, month, branch] = key.split('|');
    const total = round2(list.reduce((s, c) => s + c.paid, 0));
    const ageDays = Math.max(1, Math.round((Date.now() - new Date(month + '-20T00:00:00Z').getTime()) / 86400000));
    const pref = `${['', 'GSI', 'OMT', 'ECA'][Number(payer)]}-${month.replace('-', '')}`;
    put('remittances', { payer: Number(payer), amount: total, balance: 0, paymentReference: `EFT-${pref}`, receivedOn: day(ageDays), branch, lines: list.map((c) => ({ claimRef: c.claimRef, claimed: c.claimed, paid: c.paid, denied: round2(c.claimed - c.paid), reasonCode: c.paid < c.claimed ? c.reasonCode ?? 'CONTRACTUAL' : '' })) },
      { status: 'POSTED', by: 4, age: ageDays, statusBy: 5, statusAge: Math.max(ageDays - 1, 0) });
    put('receipts', { payerType: 'PAYER', payer: Number(payer), amount: total, balance: 0, method: 'PAYER_EFT', reference: `EFT-${pref}`, receivedOn: day(ageDays), branch, allocations: list.map((c) => ({ invoiceRef: c.claimRef, amount: c.paid, on: day(ageDays) })) },
      { status: 'ALLOCATED', by: 5, age: ageDays });
  }
  // Two remittances waiting to be posted, covering recently acknowledged claims.
  const ackByPayer = new Map<number, typeof recentAck>();
  recentAck.forEach((c) => ackByPayer.set(c.payer, [...(ackByPayer.get(c.payer) ?? []), c]));
  [...ackByPayer.entries()].slice(0, 2).forEach(([payer, list], i) => {
    const lines = list.slice(0, 3).map((c, k) => ({ claimRef: c.ref, claimed: c.amount, paid: k === 2 ? 0 : round2(c.amount * (k === 1 ? 0.85 : 1)), denied: k === 2 ? c.amount : round2(c.amount * (k === 1 ? 0.15 : 0)), reasonCode: k === 2 ? 'NOT_COVERED' : k === 1 ? 'CONTRACTUAL' : '' }));
    put('remittances', { payer, amount: round2(lines.reduce((s, l) => s + l.paid, 0)), balance: round2(lines.reduce((s, l) => s + l.paid, 0)), paymentReference: `EFT-${payer}-${today.replace(/-/g, '')}${i}`, receivedOn: day(1), branch: list[0].branch, lines },
      { status: i === 0 ? 'POSTING_REVIEW' : 'RECEIVED', by: 4, age: 1, statusBy: 4 });
  });

  /* ---------- Front office ---------- */
  const insuredEnc = encounterRows.filter((e) => e.payer);
  insuredEnc.slice(-14).forEach((e, i) => put('coverages', { patient: e.patient, encounter: e.id, payer: e.payer, plan: e.payer, memberId: `${['', 'GSI', 'OMT', 'ECA'][e.payer!]}-${700100 + i * 17}`, level: 'PRIMARY', validFrom: day(200), dueDate: day(i === 0 ? 3 : -160 - i), copayPercent: e.payer === 2 ? 20 : 10, branch: e.branch },
    { status: i < 3 ? 'PENDING_VERIFICATION' : i === 3 ? 'REJECTED' : 'VERIFIED', by: 1, age: Math.min(e.age, 6), statusBy: i < 3 ? 1 : 2, reason: i === 3 ? 'Member ID does not match the card presented' : null }));
  put('coverages', { patient: patients[5].id, payer: 1, plan: 1, memberId: 'GSI-699120', level: 'SECONDARY', validFrom: day(400), dueDate: day(20), branch: patients[5].branch }, { status: 'VERIFIED', by: 1, age: 90 });

  const p = (i: number) => patients[i % patients.length];
  const enc = (i: number) => encounterRows[encounterRows.length - 1 - (i % 20)];
  [['DRAFT', 0], ['SUBMITTED', 2], ['SUBMITTED', 5], ['SUBMITTED', 1], ['APPROVED', 9], ['PARTIAL', 12], ['DENIED', 15]].forEach(([st, age], i) => {
    const e = enc(i + 1);
    const amt = [14500, 11200, 1850, 7200, 14500, 11200, 1850][i];
    put('authorizations', { patient: e.patient, encounter: e.id, payer: e.payer ?? 1, service: [7, 14, 5, 8, 7, 14, 5][i], amount: amt, approvedAmount: st === 'APPROVED' ? amt : st === 'PARTIAL' ? round2(amt * 0.7) : undefined, payerReference: ['APPROVED', 'PARTIAL'].includes(st as string) ? `AUTH-${88120 + i}` : undefined, dueDate: day((age as number) - 3), clinicalNote: 'Symptomatic for 6 weeks; conservative management failed.', branch: e.branch },
      { status: st as string, by: 1, age: age as number, statusBy: st === 'DRAFT' ? 1 : 4, reason: st === 'DENIED' ? 'Procedure not covered under plan class' : null });
  });
  [['QUEUED', 0], ['QUEUED', 0], ['ELIGIBLE', 1], ['ELIGIBLE', 2], ['NOT_ELIGIBLE', 1], ['ERROR', 0]].forEach(([st, age], i) => {
    const e = insuredEnc[insuredEnc.length - 1 - i];
    put('eligibility', { patient: e.patient, payer: e.payer, channel: i % 3 === 2 ? 'PAYER_PORTAL' : 'EXCHANGE', serviceDate: day(0), responseCode: st === 'ELIGIBLE' ? 'A01' : st === 'NOT_ELIGIBLE' ? 'N04' : st === 'ERROR' ? 'E503' : undefined, copayPercent: st === 'ELIGIBLE' ? 10 : undefined, message: st === 'ELIGIBLE' ? 'Active coverage.' : st === 'NOT_ELIGIBLE' ? 'Member not active on the service date.' : st === 'ERROR' ? 'Payer did not respond within 30 seconds.' : undefined, branch: e.branch },
      { status: st as string, by: 1, age: age as number });
  });
  const estimates: [string, number, number, number, number][] = [['DRAFT', 0, 16500, 3300, 0], ['ISSUED', 1, 14800, 2960, 1500], ['ISSUED', 2, 9800, 1960, 2000], ['OVERRIDE_REQUESTED', 1, 21000, 4200, 1000], ['CLEARED', 6, 12400, 2480, 2500], ['OVERRIDDEN', 9, 18000, 3600, 0]];
  estimates.forEach(([st, age, total, req, held], i) => { const e = enc(i + 3); put('estimates', { patient: e.patient, encounter: e.id, payer: e.payer, amount: total, patientShare: round2(total * 0.2), depositRequired: req, depositCollected: held, dueDate: day(age - 14), branch: e.branch }, { status: st, by: 1, age, statusBy: 1, reason: st.startsWith('OVERRIDE') || st === 'OVERRIDDEN' ? 'Emergency admission, family will pay at discharge' : null }); });
  [['HELD', 1, 2000], ['HELD', 0, 1500], ['HELD', 3, 2500], ['APPLIED', 12, 1800], ['REFUND_REQUESTED', 2, 900]].forEach(([st, age, amt], i) => {
    const e = enc(i + 2);
    put('deposits', { patient: e.patient, encounter: e.id, amount: amt, balance: st === 'APPLIED' ? 0 : amt, method: i % 2 ? 'CARD' : 'CASH', reference: `POS-${51200 + i}`, branch: e.branch }, { status: st as string, by: 1, age: age as number, reason: st === 'REFUND_REQUESTED' ? 'Admission cancelled by the patient' : null });
  });
  put('cash-sessions', { assignee: 1, branch: 'RUH-CENTRAL', openingFloat: 500, tenders: [{ method: 'CASH', count: 14, total: 6420 }, { method: 'CARD', count: 22, total: 11840.5 }], amount: 6420 }, { status: 'OPEN', by: 1, age: 0 });
  put('cash-sessions', { assignee: 2, branch: 'JED-DAYSURG', openingFloat: 300, tenders: [{ method: 'CASH', count: 6, total: 2150 }, { method: 'CARD', count: 9, total: 5320 }], amount: 2150 }, { status: 'OPEN', by: 2, age: 0 });
  put('cash-sessions', { assignee: 1, branch: 'RUH-CENTRAL', openingFloat: 500, tenders: [{ method: 'CASH', count: 18, total: 7310 }], amount: 7310, countedCash: 7797.5, variance: -12.5 }, { status: 'UNDER_REVIEW', by: 1, age: 1, statusBy: 1 });
  for (let k = 2; k < 6; k++) put('cash-sessions', { assignee: k % 2 ? 1 : 2, branch: k % 2 ? 'RUH-CENTRAL' : 'JED-DAYSURG', openingFloat: 500, tenders: [{ method: 'CASH', count: 10 + k, total: 4000 + k * 310 }], amount: 4000 + k * 310, countedCash: 4500 + k * 310, variance: 0 }, { status: 'CLOSED', by: k % 2 ? 1 : 2, age: k });

  /* ---------- Charges and documents ---------- */
  [['DRAFT', 0, 2], ['PENDING_APPROVAL', 1, 2], ['PENDING_APPROVAL', 0, 3], ['POSTED', 6, 2], ['REJECTED', 3, 1]].forEach(([st, age, by], i) => {
    const e = enc(i);
    put('manual-charges', { patient: e.patient, encounter: e.id, item: i % 2 ? 10 : 1, quantity: 1, unitPrice: i % 2 ? 150 : 450, amount: i % 2 ? 150 : 450, procedureGroup: i === 2 ? 'Wound care bundle' : undefined, justification: i % 2 ? 'Insurance medical report requested by the patient' : 'Unscheduled specialist review on the ward', branch: e.branch },
      { status: st as string, by: by as number, age: age as number, statusBy: st === 'POSTED' || st === 'REJECTED' ? 3 : (by as number), reason: st === 'REJECTED' ? 'Report fee already billed on this encounter' : null });
  });
  const open = issuedInvoices.filter((x) => x.balance > 300);
  const inv = (i: number) => open[(i * 5) % open.length];
  [['DRAFT', 0, 2], ['ISSUED', 8, 2]].forEach(([st, age, by], i) => { const x = inv(i); put('debit-notes', { invoice: x.id, patient: x.patient, amount: i ? 75 : 120, reasonCode: i ? 'LATE_CHARGE' : 'MISSED_CHARGE', note: i ? 'Late payment charge per signed agreement' : 'Dressing pack missed at discharge' }, { status: st as string, by: by as number, age: age as number, statusBy: st === 'ISSUED' ? 5 : (by as number) }); });
  [['PENDING_APPROVAL', 1, 2], ['PENDING_APPROVAL', 0, 3], ['ISSUED', 11, 2], ['REJECTED', 4, 2]].forEach(([st, age, by], i) => { const x = inv(i + 3); put('credit-notes', { invoice: x.id, patient: x.patient, amount: [150, 85, 220, 300][i], reasonCode: ['PRICE_ERROR', 'DUPLICATE_CHARGE', 'SERVICE_NOT_RENDERED', 'GOODWILL'][i] }, { status: st as string, by: by as number, age: age as number, statusBy: st === 'ISSUED' || st === 'REJECTED' ? 5 : (by as number), reason: st === 'REJECTED' ? 'Goodwill credits need the patient complaint reference' : null }); });
  [['REQUESTED', 1, 2, 'SMALL_BALANCE', 18.4], ['REQUESTED', 0, 4, 'CONTRACTUAL_ALLOWANCE', 640], ['APPROVED', 20, 4, 'CONTRACTUAL_ALLOWANCE', 410], ['REJECTED', 6, 2, 'BAD_DEBT', 2200]].forEach(([st, age, by, type, amt], i) => { const x = inv(i + 7); put('adjustments', { invoice: x.id, patient: x.patient, amount: amt, adjustmentType: type, note: 'Per contract schedule' }, { status: st as string, by: by as number, age: age as number, statusBy: st === 'REQUESTED' ? (by as number) : 5, reason: st === 'REJECTED' ? 'Collections not exhausted; refer to dunning first' : null }); });

  /* ---------- Money ---------- */
  [[0, 'CASH', 750], [0, 'CARD', 1320], [1, 'BANK_TRANSFER', 2400]].forEach(([age, m, amt], i) => put('receipts', { payerType: 'PATIENT', patient: p(i * 3).id, amount: amt, balance: amt, method: m, reference: m === 'BANK_TRANSFER' ? 'SWIFT-77120' : undefined, receivedOn: day(age as number), branch: p(i * 3).branch }, { status: 'UNALLOCATED', by: 1, age: age as number }));
  put('receipts', { payerType: 'PATIENT', patient: p(9).id, amount: 300, balance: 300, method: 'CASH', receivedOn: day(1), branch: p(9).branch }, { status: 'VOID_REQUESTED', by: 1, age: 1, statusBy: 1, reason: 'Keyed against the wrong patient' });
  [['REQUESTED', 1, 1], ['APPROVED', 3, 1], ['DISPATCHED', 4, 2], ['PAID_OUT', 12, 2], ['FAILED', 5, 2]].forEach(([st, age, by], i) => put('refunds', { patient: p(i + 4).id, source: `RCT-${new Date().getUTCFullYear()}-000${10 + i}`, amount: [450, 1200, 300, 980, 215][i], method: i === 2 ? 'CARD_REVERSAL' : 'BANK_TRANSFER', payeeName: `Patient ${i + 1}`, payeeAccount: `SA03 8000 0000 6080 1016 ${7519 + i}`, providerReference: ['DISPATCHED', 'PAID_OUT', 'FAILED'].includes(st as string) ? `SIM-${9100 + i}` : undefined, branch: p(i + 4).branch },
    { status: st as string, by: by as number, age: age as number, statusBy: st === 'REQUESTED' ? (by as number) : 5, reason: st === 'FAILED' ? 'Beneficiary bank rejected the IBAN' : null }));
  [[12, 3, 'ACTIVE', 30], [11, 7, 'ACTIVE', -5], [12, 10, 'CONSUMED', 40], [11, 1, 'ACTIVE', 120]].forEach(([item, used, st, valid], i) => {
    const total = item === 12 ? 10 : 1; const amt = price(item as number);
    put('packages', { patient: p(i + 12).id, packageItem: item, amount: amt, sessionsTotal: total, sessionsUsed: Math.min(used as number, total), balance: round2(amt * (1 - Math.min(used as number, total) / total)), dueDate: day(-(valid as number)), branch: p(i + 12).branch }, { status: st as string, by: 1, age: 40 });
  });

  /* ---------- Insurance follow-up ---------- */
  denied.slice(0, 5).forEach((c, i) => {
    const st = ['DRAFT', 'PENDING_APPROVAL', 'FILED', 'WON', 'LOST'][i];
    put('appeals', { claim: c.id, patient: c.patient, payer: c.payer, amount: c.balance, level: i === 4 ? 2 : 1, reasonCode: ['MEDICAL_NECESSITY', 'AUTHORIZATION_ON_FILE', 'CODING_DISPUTE', 'MEDICAL_NECESSITY', 'TIMELY_FILING'][i], dueDate: day(-[12, 8, 20, 0, 0][i] + (i === 0 ? 15 : 0)), recovered: st === 'WON' ? c.balance : st === 'LOST' ? 0 : undefined, argument: 'Clinical notes show the service met the plan’s medical necessity criteria.', branch: c.branch },
      { status: st, by: 4, age: [2, 1, 20, 40, 60][i], statusBy: st === 'DRAFT' || st === 'PENDING_APPROVAL' ? 4 : 3 });
  });
  const postedRem = db.prepare(`SELECT id, data FROM ${tableName('remittances')} WHERE status = 'POSTED' LIMIT 2`).all() as { id: number; data: string }[];
  postedRem.forEach((r, i) => {
    const line = JSON.parse(r.data).lines[0];
    const claim = db.prepare(`SELECT id FROM ${tableName('claims')} WHERE ref = ?`).get(line.claimRef) as { id: number };
    put('remittance-corrections', { remittance: r.id, claim: claim.id, originalPaid: line.paid, amount: round2(line.paid - (i ? 45 : 120)), reasonCode: 'KEYING_ERROR', note: 'Payer advice shows a different paid amount than posted.' }, { status: i ? 'APPROVED' : 'REQUESTED', by: 4, age: i ? 15 : 1, statusBy: i ? 5 : 4 });
  });
  const months = [1, 2, 3].map((m) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - m); return d.toISOString().slice(0, 7); });
  [[1, months[0], 'OPEN', 186400, 186400], [2, months[0], 'IN_REVIEW', 92300, 88150], [1, months[1], 'RECONCILED', 171250, 171250], [3, months[1], 'DISPUTED', 64800, 51200]].forEach(([payer, period, st, exp, rec], i) =>
    put('payer-reconciliations', { payer, period, amount: exp, receivedAmount: rec, variance: round2((rec as number) - (exp as number)), notes: i === 3 ? 'Payer applied an unexpected withholding.' : undefined }, { status: st as string, by: 4, age: [2, 4, 30, 25][i], statusBy: st === 'RECONCILED' ? 5 : 4, reason: st === 'DISPUTED' ? 'Withholding not in the contract' : null }));
  const payerInv = issuedInvoices.filter((x) => x.billTo === 'PAYER');
  [['REQUESTED', 1, 4, 'PATIENT', 'COPAY'], ['REQUESTED', 0, 2, 'PATIENT', 'NOT_COVERED'], ['APPROVED', 14, 4, 'SECONDARY_PAYER', 'SECONDARY_COVERAGE']].forEach(([st, age, by, to, rc], i) => {
    const x = payerInv[(i * 3) % payerInv.length];
    put('responsibility-transfers', { invoice: x.id, patient: x.patient, fromParty: 'PRIMARY_PAYER', toParty: to, amount: round2(Math.min(x.balance, [120, 450, 300][i])), reasonCode: rc }, { status: st as string, by: by as number, age: age as number, statusBy: st === 'APPROVED' ? 5 : (by as number) });
  });

  /* ---------- Receivables ---------- */
  const sched = (amount: number, n: number, first: string, paidCount: number) => { const each = Math.floor((amount / n) * 100) / 100; return Array.from({ length: n }, (_, k) => ({ n: k + 1, due: addDays(first, k * 30), amount: k === n - 1 ? round2(amount - each * (n - 1)) : each, state: k < paidCount ? 'Paid' : 'Due' })); };
  put('payment-plans', { patient: p(20).id, amount: 4800, balance: 4800, installments: 6, cadence: 'MONTHLY', firstDue: day(-10), branch: p(20).branch }, { status: 'PROPOSED', by: 2, age: 1 });
  const s1 = sched(7200, 6, day(75), 2);
  put('payment-plans', { patient: p(21).id, amount: 7200, balance: 4800, installments: 6, cadence: 'MONTHLY', firstDue: day(75), dueDate: s1[2].due, schedule: s1, branch: p(21).branch }, { status: 'ACTIVE', by: 2, age: 80, statusBy: 5 });
  const s2 = sched(3000, 3, day(40), 1);
  put('payment-plans', { patient: p(22).id, amount: 3000, balance: 2000, installments: 3, cadence: 'MONTHLY', firstDue: day(40), dueDate: s2[1].due, schedule: s2, branch: p(22).branch }, { status: 'ACTIVE', by: 2, age: 45, statusBy: 5 });
  put('payment-plans', { patient: p(23).id, amount: 1800, balance: 0, installments: 3, cadence: 'MONTHLY', firstDue: day(120), schedule: sched(1800, 3, day(120), 3), branch: p(23).branch }, { status: 'COMPLETED', by: 2, age: 125, statusBy: 2 });
  const selfOpen = issuedInvoices.filter((x) => x.billTo === 'PATIENT');
  selfOpen.slice(0, 7).forEach((x, i) => put('statements', { patient: x.patient, amount: x.balance, period: months[0], channel: ['EMAIL', 'SMS', 'PRINT', 'PATIENT_PORTAL'][i % 4], sentOn: i >= 3 ? day(4) : undefined, branch: x.branch },
    { status: i < 3 ? 'GENERATED' : i === 6 ? 'RETURNED' : 'SENT', by: 2, age: i < 3 ? 0 : 5, statusAge: 4, reason: i === 6 ? 'Address unknown' : null }));
  const old = selfOpen.filter((x) => x.age > 30);
  ['REMINDER_1', 'REMINDER_1', 'REMINDER_2', 'FINAL_NOTICE', 'PROMISE_TO_PAY', 'AGENCY_REQUESTED', 'WITH_AGENCY'].forEach((st, i) => {
    const x = old[i % Math.max(old.length, 1)] ?? selfOpen[i];
    if (!x) return;
    put('collections', { patient: x.patient, amount: x.balance, dueDate: day([-3, 2, -5, 1, -7, -2, -20][i]), promiseDate: st === 'PROMISE_TO_PAY' ? day(-7) : undefined, agency: st === 'WITH_AGENCY' ? 'Nakheel Recovery Services' : undefined, lastContact: 'Called the patient; voicemail left.', branch: x.branch },
      { status: st, by: 2, age: 10 + i * 6, statusBy: 2, reason: st === 'AGENCY_REQUESTED' ? 'No response after final notice' : null });
  });

  /* ---------- Coding and models ---------- */
  const coded = encounterRows.filter((e) => e.care === 'INPATIENT' || e.care === 'DAYCASE').slice(-9);
  const DX = ['K80.20', 'K35.80', 'I21.4', 'J18.9', 'S72.00', 'N39.0', 'K80.10', 'Z99.9', 'O80'];
  coded.forEach((e, i) => {
    const st = ['QUEUED', 'QUEUED', 'QUEUED', 'IN_PROGRESS', 'IN_PROGRESS', 'QUERY_RAISED', 'CODED', 'CODED', 'VALIDATED'][i];
    put('coding-cases', { encounter: e.id, patient: e.patient, assignee: i % 3 === 0 ? 6 : i % 3 === 1 ? 3 : undefined, principalDx: i >= 3 ? DX[i] : undefined, secondaryDx: i >= 6 ? ['E11.9', 'I10'] : [], procedures: i >= 6 ? ['30443-00'] : [], dueDate: day(Math.min(e.age, 6) - 3), branch: e.branch },
      { status: st, by: 6, age: Math.min(e.age, 6), statusBy: st === 'VALIDATED' ? 3 : 6 });
  });
  [['OPEN', 1, 1], ['OPEN', 4, -1], ['ANSWERED', 3, 1], ['ESCALATED', 6, -3]].forEach(([st, age, due], i) => { const e = coded[i]; put('cdi-queries', { encounter: e.id, patient: e.patient, physician: e.attending, question: ['Please confirm whether the pneumonia was aspiration or community acquired.', 'Is the anaemia acute blood-loss related to surgery?', 'Confirm laterality of the femur fracture.', 'Document the stage of chronic kidney disease.'][i], response: st === 'ANSWERED' ? 'Right side; operative note updated.' : undefined, dueDate: day(-(due as number)), branch: e.branch }, { status: st as string, by: 6, age: age as number, reason: st === 'ESCALATED' ? 'No response after two reminders' : null }); });
  [['PENDING', 'K80.20', 2, 1], ['GROUPED', 'I21.4', 6, 2], ['VALIDATED', 'K35.80', 3, 9], ['ERROR', 'Z99.9', 4, 1]].forEach(([st, dx, los, age], i) => {
    const e = coded[i + 3] ?? coded[i];
    const w = { 'I21.4': 2.84, 'K35.80': 0.92 }[dx as string];
    put('drg-groupings', { encounter: e.id, patient: e.patient, principalDx: dx, secondaryDx: ['I10'], procedures: [], lengthOfStay: los, drgCode: w ? (dx === 'I21.4' ? 'F10A' : 'G07B') : undefined, weight: w, amount: w ? round2(9800 * w) : 0, grouperVersion: st !== 'PENDING' ? 'AR-DRG 11.0, licensed simulator' : undefined, branch: e.branch },
      { status: st as string, by: 6, age: age as number, statusBy: st === 'VALIDATED' ? 3 : 6 });
  });
  const opd = encounterRows.filter((e) => e.care === 'OUTPATIENT' || e.care === 'EMERGENCY').slice(-5);
  [['DRAFT', 'MODERATE', 25, undefined], ['PROPOSED', 'HIGH', 45, 'L5'], ['PROPOSED', 'LOW', 32, 'L4'], ['CONFIRMED', 'MODERATE', 20, 'L4']].forEach(([st, mdm, mins, lvl], i) => {
    const e = opd[i];
    put('em-determinations', { encounter: e.id, patient: e.patient, careSetting: e.care === 'EMERGENCY' ? 'EMERGENCY' : 'OUTPATIENT', mdm, totalMinutes: mins, level: lvl, amount: lvl ? { L4: 450, L5: 620 }[lvl as string] : 0, branch: e.branch }, { status: st as string, by: 6, age: i, statusBy: st === 'CONFIRMED' ? 3 : 6 });
  });
  [['DRAFT', 2, 'P4P', 120000, 96000, 0], ['CALCULATED', 1, 'CAPITATION', 186400, 0, 186400], ['POSTED', 25, 'BUNDLE', 240000, 212000, 14000]].forEach(([st, cId, model, exp, act, amt], i) =>
    put('model-settlements', { contract: cId, model, period: months[i], expectedAmount: exp, actualAmount: act, amount: amt, notes: model === 'CAPITATION' ? '1,008 member months at SAR 185 PMPM' : undefined }, { status: st as string, by: 5, age: [3, 1, 30][i], statusBy: st === 'POSTED' ? 3 : 5 }));

  /* ---------- Accounting ---------- */
  for (let k = 0; k < 9; k++) {
    const amt = between(2000, 40000);
    put('journals', { sourceDocument: k % 3 ? `INV-${new Date().getUTCFullYear()}-000${20 + k}` : `RCT-${new Date().getUTCFullYear()}-000${30 + k}`, postingDate: day(k * 3), amount: amt, branch: k % 4 ? 'RUH-CENTRAL' : 'JED-DAYSURG',
      lines: k % 3 ? [{ account: '1220 Payer receivables', role: 'PAYER_AR', debit: amt, credit: 0 }, { account: '4100 Patient service revenue', role: 'SERVICE_REVENUE', debit: 0, credit: round2(amt / 1.15) }, { account: '2310 VAT payable', role: 'TAX_PAYABLE', debit: 0, credit: round2(amt - amt / 1.15) }]
        : [{ account: '1150 Tender clearing', role: 'TENDER_CLEARING', debit: amt, credit: 0 }, { account: '1210 Patient receivables', role: 'PATIENT_AR', debit: 0, credit: amt }] }, { status: 'POSTED', by: 5, age: k * 3 });
  }
  [['DXB-DHCC', 'No approved GL mapping for role PAYER_AR in legal entity MCN-UAE.', 8420], ['DXB-DHCC', 'No approved GL mapping for role TAX_PAYABLE (AED).', 1260], ['RUH-CENTRAL', 'Fiscal period for the posting date is soft-closed.', 3105]].forEach(([b, msg, amt], i) =>
    put('journals', { sourceDocument: `INV-${new Date().getUTCFullYear()}-00${150 + i}`, postingDate: day(i), amount: amt, exception: msg, branch: b, lines: [{ account: 'Unmapped', role: i === 1 ? 'TAX_PAYABLE' : 'PAYER_AR', debit: amt, credit: 0 }] }, { status: 'EXCEPTION', by: 5, age: i }));
  [[2, months[0], 'OPEN', 412800, 412800], [1, months[0], 'MATCHED', 96250, 96250], [5, months[0], 'VARIANCE', 18400, 18150], [2, months[1], 'RECONCILED', 388100, 388100]].forEach(([acc, period, st, sub, gl], i) =>
    put('gl-reconciliations', { account: acc, period, amount: sub, glBalance: gl, variance: round2((sub as number) - (gl as number)) }, { status: st as string, by: 5, age: [1, 2, 3, 25][i], statusBy: st === 'RECONCILED' ? 3 : 5 }));
  [['PREPARED', months[0], 'ERP_CSV', 214, 1284300], ['EXPORTED', months[1], 'ERP_CSV', 198, 1190040], ['FAILED', months[0], 'SAP_IDOC', 12, 88120]].forEach(([st, period, target, n, amt], i) =>
    put('exports', { period, target, entries: n, amount: amt, checksum: st === 'EXPORTED' ? 'sha256:4f1c0a9e7d2b5c8e1a3f6b9d0c2e4a7f' : undefined }, { status: st as string, by: 5, age: [1, 28, 2][i], statusBy: st === 'EXPORTED' ? 3 : 5, reason: st === 'FAILED' ? 'ERP endpoint rejected the IDoc segment E1FIKPF' : null }));

  /* ---------- Cross-cutting ---------- */
  const TASKS: [string, string, string, number, string, number, string][] = [
    ['Call Gulf Shield about 3 unacknowledged claims', 'CLAIM', 'OPEN', 4, 'HIGH', 1, 'Await adjudication'],
    ['Prepare evidence pack for medical necessity appeal', 'APPEAL', 'IN_PROGRESS', 4, 'HIGH', 2, 'Evidence pack'],
    ['Confirm operative note for on-hold encounter', 'CODING', 'BLOCKED', 6, 'MEDIUM', -1, 'Coding complete'],
    ['Follow up promise to pay', 'COLLECTION', 'OPEN', 2, 'MEDIUM', 0, 'Promise review'],
    ['Count drawer variance with cashier', 'CASH', 'IN_PROGRESS', 1, 'HIGH', 0, 'Variance review'],
    ['Resubmit corrected claim with new member ID', 'CLAIM', 'OPEN', 4, 'MEDIUM', 3, 'Submit to payer'],
    ['Validate DRG for cardiac admission', 'CODING', 'OPEN', 3, 'MEDIUM', 2, 'Validation'],
    ['Post remittance batch from Oasis', 'CLAIM', 'DONE', 5, 'LOW', -4, 'Post remittance'],
    ['Agency file for long-overdue balance', 'COLLECTION', 'OPEN', 2, 'LOW', -2, 'Agency referral'],
    ['Escalate dead-letter claim messages', 'CLAIM', 'IN_PROGRESS', 3, 'HIGH', -1, 'Exchange'],
  ];
  TASKS.forEach(([title, wf, st, who, pr, due, cp], i) => put('tasks', { title, workflow: wf, linkedRef: '', assignee: who, priority: pr, dueDate: day(-due), checkpoint: cp, branch: 'RUH-CENTRAL' }, { status: st, by: 3, age: 1 + (i % 4), statusBy: who, reason: st === 'BLOCKED' ? 'Waiting for surgeon to sign the note' : null }));
  const firstDenied = denied[0]?.ref ?? 'CLM';
  [['CLAIM_COORDINATION_BLOCKER', firstDenied, 'Primary payer denied for missing authorization, but an approved authorization exists for this encounter. Attach it and resubmit.', 92, 'NEW'],
    ['CLAIM_STATE_ATTENTION', 'Gulf Shield', 'Five claims to Gulf Shield have been acknowledged for over 30 days without remittance. Consider a claim status enquiry.', 81, 'NEW'],
    ['CODING_WORKLIST', 'Coding queue', 'Two queued cases have discharge summaries signed today; prioritise them to meet the code-by date.', 74, 'NEW'],
    ['CDI_CLARIFICATION', 'CDI queue', 'The escalated clarification has had no response for 6 days; the clinician is on leave this week.', 66, 'ACCEPTED'],
    ['CLAIM_STATE_ATTENTION', 'Emirates Care', 'Remittance pattern suggests a contractual rate change; compare with the contract before posting.', 58, 'DISMISSED']]
    .forEach(([src, about, text, conf, st], i) => put('assistance', { source: src, linkedRef: about, suggestion: text, confidence: conf, rationale: 'Derived from claim, authorization and audit events in the last 30 days.', branch: 'RUH-CENTRAL' }, { status: st as string, by: 3, age: i, statusBy: 3, reason: st === 'DISMISSED' ? 'Rate change already loaded in the new contract version' : null }));
}

export function seedIfEmpty() {
  const n = (db.prepare('SELECT COUNT(*) n FROM app_user').get() as { n: number }).n;
  if (n > 0) return false;
  db.transaction(seedAll)();
  console.log('Seeded synthetic workspace data.');
  return true;
}

export function resetAndSeed() {
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    for (const r of RESOURCES) db.exec(`DELETE FROM ${tableName(r.key)}; DELETE FROM sqlite_sequence WHERE name='${tableName(r.key)}';`);
    db.exec('DELETE FROM audit_event; DELETE FROM seq; DELETE FROM ref_contract; DELETE FROM ref_account; DELETE FROM ref_item; DELETE FROM ref_plan; DELETE FROM ref_payer; DELETE FROM ref_patient; DELETE FROM app_user;');
    seedAll();
  })();
  db.pragma('foreign_keys = ON');
}
