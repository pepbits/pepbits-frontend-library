import crypto from 'node:crypto';
import { addDays, audit, db, todayUtc } from './db';
import { Effect, EffectCtx, HttpError, Row, getRes, insertRecord, loadRow, round2, statusLabel, toMajor, valuesOf, writeValues } from './engine';
import { tableName } from './registry';

/* ------------------------------------------------------------------ */
/* Helpers shared by effects                                           */
/* ------------------------------------------------------------------ */

const money = (n: number, cur = 'SAR') => `${cur} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function invoiceStatusFor(amount: number, balance: number) {
  if (balance <= 0.004) return 'PAID';
  if (balance < amount - 0.004) return 'PARTIALLY_PAID';
  return 'ISSUED';
}

/** Moves an issued invoice's balance by delta (negative reduces what is owed). */
export function adjustInvoice(invoiceId: number, delta: number, actorId: number, why: string) {
  const res = getRes('invoices');
  const inv = loadRow(res, invoiceId);
  if (inv.status === 'DRAFT') throw new HttpError(409, 'INVOICE_NOT_ISSUED', `Invoice ${inv.ref} is still a draft. Issue it first.`);
  const v = valuesOf(inv);
  const next = round2(v.balance + delta);
  if (next < -0.004) throw new HttpError(422, 'OVER_APPLIED', `That is more than the ${money(v.balance, inv.currency)} still due on ${inv.ref}.`);
  v.balance = Math.max(next, 0);
  const to = invoiceStatusFor(v.amount, v.balance);
  writeValues(res, invoiceId, v, actorId, to !== inv.status ? to : undefined);
  audit({ actorId, resource: 'invoices', recordId: invoiceId, recordRef: inv.ref, action: 'BALANCE_CHANGED', from: inv.status, to, summary: `${why}: balance ${money(toMajor(inv.balance_minor), inv.currency)} → ${money(v.balance, inv.currency)}.` });
  return { ref: inv.ref, balance: v.balance };
}

function setStatus(resKey: string, id: number, to: string, actorId: number, patch: Record<string, any> = {}, why = '') {
  const res = getRes(resKey);
  const row = loadRow(res, id);
  const v = { ...valuesOf(row), ...patch };
  writeValues(res, id, v, actorId, to !== row.status ? to : undefined);
  if (to !== row.status) audit({ actorId, resource: resKey, recordId: id, recordRef: row.ref, action: 'STATUS_CHANGED', from: row.status, to, summary: `${row.ref} moved to ${statusLabel(res, to).toLowerCase()}${why ? ` (${why})` : ''}.` });
}

function createLinked(resKey: string, values: Record<string, any>, status: string, actorId: number, why: string) {
  const res = getRes(resKey);
  const id = insertRecord(res, values, { status, actorId });
  const row = loadRow(res, id);
  audit({ actorId, resource: resKey, recordId: id, recordRef: row.ref, action: 'CREATED', to: status, summary: `Created ${res.singular} ${row.ref}: ${why}.` });
  return row;
}

const findByRef = (resKey: string, ref: string) => db.prepare(`SELECT * FROM ${tableName(resKey)} WHERE ref = ?`).get(ref) as Row | undefined;
const sql = (resKey: string, where: string, ...p: unknown[]) => db.prepare(`SELECT * FROM ${tableName(resKey)} WHERE ${where}`).all(...p) as Row[];

/* ------------------------------------------------------------------ */
/* Simulated external engines (deterministic)                          */
/* ------------------------------------------------------------------ */

const DRG_TABLE: Record<string, { drg: string; weight: number; name: string }> = {
  K80: { drg: 'H08B', weight: 1.18, name: 'Laparoscopic cholecystectomy' },
  K35: { drg: 'G07B', weight: 0.92, name: 'Appendicectomy, minor complexity' },
  I21: { drg: 'F10A', weight: 2.84, name: 'Acute myocardial infarction with intervention' },
  J18: { drg: 'E62B', weight: 1.05, name: 'Respiratory infection' },
  O80: { drg: 'O60C', weight: 0.61, name: 'Vaginal delivery' },
  S72: { drg: 'I08B', weight: 3.12, name: 'Hip and femur procedures' },
  N39: { drg: 'L63B', weight: 0.74, name: 'Urinary tract infection' },
};
const DRG_BASE_RATE = 9800;
const EM_AMOUNT: Record<string, number> = { L2: 260, L3: 300, L4: 450, L5: 620 };

/* ------------------------------------------------------------------ */
/* Effects keyed by "resource:action"                                  */
/* ------------------------------------------------------------------ */

const E: Record<string, Effect> = {
  'authorizations:record-decision': ({ values }) => {
    if (values.approvedAmount > values.amount) throw new HttpError(422, 'VALIDATION', 'The approved amount cannot exceed the amount requested.', { approvedAmount: 'Too high.' });
    return { status: values.approvedAmount >= values.amount ? 'APPROVED' : 'PARTIAL' };
  },

  'eligibility:run': ({ row, values }) => {
    const payer = db.prepare('SELECT kind, name FROM ref_payer WHERE id = ?').get(values.payer) as { kind: string; name: string };
    if (payer?.kind === 'SELF') { Object.assign(values, { responseCode: 'NA', message: 'Self-pay has no eligibility to check.' }); return { status: 'NOT_ELIGIBLE' }; }
    const roll = (row.id * 7 + Number(values.patient ?? 0)) % 9;
    if (row.status !== 'ERROR' && roll === 0) { Object.assign(values, { responseCode: 'E503', message: `${payer.name} did not respond within 30 seconds. Try again.` }); return { status: 'ERROR' }; }
    if (roll === 1) { Object.assign(values, { responseCode: 'N04', message: 'Member not active on the service date.', copayPercent: null }); return { status: 'NOT_ELIGIBLE' }; }
    Object.assign(values, { responseCode: 'A01', message: 'Active coverage. Outpatient and inpatient benefits available.', copayPercent: roll % 2 ? 20 : 10 });
    return { status: 'ELIGIBLE' };
  },

  'estimates:clear': ({ values }) => {
    if ((values.depositCollected ?? 0) < values.depositRequired)
      throw new HttpError(422, 'DEPOSIT_SHORT', `The deposit held is short by ${money(round2(values.depositRequired - (values.depositCollected ?? 0)))}. Collect it or request an override.`);
  },

  'deposits:apply': ({ values, input, actorId, row }) => {
    if (values.balance <= 0) throw new HttpError(409, 'NOTHING_TO_APPLY', 'This deposit has nothing left to apply.');
    const inv = loadRow(getRes('invoices'), input.invoice);
    const apply = round2(Math.min(values.balance, toMajor(inv.balance_minor)));
    if (apply <= 0) throw new HttpError(422, 'INVOICE_PAID', `Invoice ${inv.ref} has nothing due.`);
    adjustInvoice(inv.id, -apply, actorId, `Deposit ${row.ref} applied`);
    values.balance = round2(values.balance - apply);
    values.appliedTo = [...(values.appliedTo ?? []), `${inv.ref} ${apply.toFixed(2)}`];
    return { status: values.balance <= 0 ? 'APPLIED' : 'HELD', summary: `Applied ${money(apply, row.currency)} of ${row.ref} to ${inv.ref}.` };
  },
  'deposits:request-transfer': ({ values, input }) => { values.pendingTarget = input.targetEncounter; },
  'deposits:approve-transfer': ({ values, row, actorId }) => {
    const created = createLinked('deposits', { ...values, encounter: values.pendingTarget, amount: values.balance, balance: values.balance, pendingTarget: undefined, reference: `Transfer from ${row.ref}` }, 'HELD', actorId, `transfer from ${row.ref}`);
    values.balance = 0;
    return { summary: `Moved the unapplied balance of ${row.ref} to new deposit ${created.ref}.` };
  },
  'deposits:approve-refund': ({ values, row, actorId, reason }) => {
    const pat = db.prepare('SELECT name FROM ref_patient WHERE id = ?').get(values.patient) as { name: string };
    const r = createLinked('refunds', { patient: values.patient, source: row.ref, amount: values.balance, method: values.method === 'CARD' ? 'CARD_REVERSAL' : 'BANK_TRANSFER', payeeName: pat?.name, branch: values.branch }, 'APPROVED', actorId, `refund of deposit ${row.ref}${reason ? `, ${reason}` : ''}`);
    values.balance = 0;
    return { summary: `Approved the refund of ${row.ref}; refund ${r.ref} is ready to dispatch.` };
  },

  'cash-sessions:close': ({ values }) => {
    const expected = round2((values.openingFloat ?? 0) + (values.amount ?? 0));
    values.variance = round2(values.countedCash - expected);
    return { status: Math.abs(values.variance) > 5 ? 'UNDER_REVIEW' : 'CLOSED', summary: `Counted ${values.countedCash.toFixed(2)} against ${expected.toFixed(2)} expected (variance ${values.variance.toFixed(2)}).` };
  },

  'encounters:create-invoice': ({ row, values, actorId }) => {
    const charges = sql('charges', `json_extract(data,'$.encounter') = ? AND status = 'PRICED'`, row.id);
    if (!charges.length) throw new HttpError(422, 'NO_PRICED_CHARGES', 'There are no priced charges on this encounter. Price or capture charges first.');
    const uae = row.branch === 'DXB-DHCC';
    const lines = charges.map((c) => {
      const v = valuesOf(c);
      const item = db.prepare('SELECT name, vat_rate FROM ref_item WHERE id = ?').get(v.item) as { name: string; vat_rate: number };
      const tax = uae ? 0 : round2(v.amount * item.vat_rate);
      return { description: item.name, quantity: v.quantity, unitPrice: v.unitPrice, tax, amount: round2(v.amount + tax), chargeRef: c.ref };
    });
    const subtotal = round2(lines.reduce((s, l) => s + (l.amount - l.tax), 0));
    const tax = round2(lines.reduce((s, l) => s + l.tax, 0));
    const inv = createLinked('invoices', {
      patient: values.patient, encounter: row.id, billTo: values.payer ? 'PAYER' : 'PATIENT', payer: values.payer, subtotal, tax, amount: round2(subtotal + tax), balance: 0, lines, branch: row.branch,
    }, 'DRAFT', actorId, `drafted from encounter ${row.ref}`);
    for (const c of charges) setStatus('charges', c.id, 'BILLED', actorId, { invoiceRef: inv.ref }, `billed on ${inv.ref}`);
    values.amount = 0;
    return { summary: `Drafted invoice ${inv.ref} from ${charges.length} priced charges on ${row.ref}.` };
  },

  'charges:price': ({ values }) => {
    const item = db.prepare('SELECT price_minor FROM ref_item WHERE id = ?').get(values.item) as { price_minor: number };
    values.unitPrice = toMajor(item.price_minor);
  },

  'manual-charges:approve': ({ values, row, actorId }) => {
    const c = createLinked('charges', { patient: values.patient, encounter: values.encounter, item: values.item, quantity: values.quantity, unitPrice: values.unitPrice, amount: values.amount, source: 'MANUAL', serviceDate: todayUtc(), branch: values.branch }, 'PRICED', actorId, `posted from manual charge ${row.ref}`);
    return { summary: `Approved ${row.ref}; charge ${c.ref} is priced on the encounter.` };
  },

  'invoices:issue': ({ values }) => {
    values.balance = values.amount;
    values.issuedOn = todayUtc();
    values.dueDate = values.dueDate || addDays(todayUtc(), 30);
  },

  'debit-notes:issue': ({ values, row, actorId }) => { adjustInvoice(values.invoice, values.amount, actorId, `Debit note ${row.ref}`); },
  'credit-notes:issue': ({ values, row, actorId }) => { adjustInvoice(values.invoice, -values.amount, actorId, `Credit note ${row.ref}`); },
  'adjustments:approve': ({ values, row, actorId }) => { adjustInvoice(values.invoice, -values.amount, actorId, `Adjustment ${row.ref}`); },

  'receipts:allocate': ({ values, input, row, actorId }) => {
    const amt = round2(input.allocateAmount);
    if (amt <= 0) throw new HttpError(422, 'VALIDATION', 'Enter an amount above zero.', { allocateAmount: 'Must be above zero.' });
    if (amt > values.balance + 0.004) throw new HttpError(422, 'VALIDATION', `Only ${money(values.balance, row.currency)} is unallocated on this receipt.`, { allocateAmount: 'More than is unallocated.' });
    const r = adjustInvoice(input.invoice, -amt, actorId, `Receipt ${row.ref} allocated`);
    values.balance = round2(values.balance - amt);
    values.allocations = [...(values.allocations ?? []), { invoiceRef: r.ref, amount: amt, on: todayUtc() }];
    return { status: values.balance <= 0.004 ? 'ALLOCATED' : 'PARTIALLY_ALLOCATED', summary: `Allocated ${money(amt, row.currency)} from ${row.ref} to ${r.ref}.` };
  },
  'receipts:approve-void': ({ values }) => {
    if (values.balance < values.amount) throw new HttpError(409, 'ALLOCATED', 'Receipts with allocations cannot be voided. Reverse the allocation with a credit or adjustment.');
    values.balance = 0;
  },

  'refunds:dispatch': ({ values, row }) => { values.providerReference = `SIM-${row.id.toString(36).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`; },

  'packages:use-session': ({ values }) => {
    values.sessionsUsed = (values.sessionsUsed ?? 0) + 1;
    values.balance = round2(values.amount * (1 - values.sessionsUsed / values.sessionsTotal));
    return { status: values.sessionsUsed >= values.sessionsTotal ? 'CONSUMED' : 'ACTIVE', summary: `Session ${values.sessionsUsed} of ${values.sessionsTotal} recorded.` };
  },
  'packages:cancel': ({ values, row, actorId }) => {
    const refund = round2(values.balance * 0.9);
    const pat = db.prepare('SELECT name FROM ref_patient WHERE id = ?').get(values.patient) as { name: string };
    if (refund > 0) createLinked('refunds', { patient: values.patient, source: row.ref, amount: refund, method: 'BANK_TRANSFER', payeeName: pat?.name, branch: values.branch }, 'REQUESTED', actorId, `unused share of package ${row.ref} less 10% fee`);
    values.balance = 0;
    return { summary: `Cancelled ${row.ref}; refund request of ${money(refund, row.currency)} created for approval.` };
  },

  'claims:submit': ({ values, row, actorId }) => {
    values.submittedOn = todayUtc();
    values.balance = values.amount;
    if (values.channel === 'EXCHANGE') {
      const m = createLinked('exchange-messages', { operation: 'CLAIM', payer: values.payer, claim: row.id, format: 'REST_JSON', endpointAlias: 'PAYER_CLAIMS_V2', attempts: 1, branch: row.branch }, 'SENT', actorId, `claim ${row.ref} sent to payer`);
      return { summary: `Submitted ${row.ref} through the exchange as message ${m.ref}.` };
    }
  },

  'exchange-messages:retry': ({ values, row, actorId }) => {
    values.attempts = (values.attempts ?? 0) + 1;
    values.lastError = null;
    if (values.claim) {
      const c = db.prepare(`SELECT id, status FROM ${tableName('claims')} WHERE id = ?`).get(values.claim) as { id: number; status: string } | undefined;
      if (c?.status === 'SUBMITTED') setStatus('claims', c.id, 'ACKNOWLEDGED', actorId, {}, `payer acknowledged ${row.ref}`);
    }
    return { status: 'ACKNOWLEDGED', summary: `Retried ${row.ref} (attempt ${values.attempts}); the payer acknowledged it.` };
  },

  'remittances:post': ({ values, row, actorId }) => {
    let paidTotal = 0;
    for (const line of values.lines ?? []) {
      const claim = findByRef('claims', line.claimRef);
      if (!claim) throw new HttpError(422, 'UNKNOWN_CLAIM', `Remittance line refers to ${line.claimRef}, which does not exist.`);
      const cv = valuesOf(claim);
      const paid = round2(Number(line.paid || 0));
      paidTotal += paid;
      const balance = round2(Math.max(cv.balance - paid, 0));
      const to = paid <= 0 ? 'DENIED' : balance <= 0.004 ? 'PAID' : 'PARTIALLY_PAID';
      setStatus('claims', claim.id, to, actorId, { balance, ...(to === 'DENIED' ? { denialReason: line.reasonCode || 'NOT_COVERED' } : {}) }, `remittance ${row.ref}`);
      if (paid > 0 && cv.invoice) adjustInvoice(cv.invoice, -paid, actorId, `Remittance ${row.ref} for ${claim.ref}`);
    }
    values.balance = 0;
    return { summary: `Posted ${row.ref}: ${(values.lines ?? []).length} claims updated, ${money(round2(paidTotal), row.currency)} applied.` };
  },

  'remittance-corrections:approve': ({ values, row, actorId }) => {
    const delta = round2(values.amount - values.originalPaid);
    const claim = loadRow(getRes('claims'), values.claim);
    const cv = valuesOf(claim);
    setStatus('claims', claim.id, claim.status, actorId, { balance: round2(Math.max(cv.balance - delta, 0)) });
    if (cv.invoice && delta !== 0) adjustInvoice(cv.invoice, -delta, actorId, `Remittance correction ${row.ref}`);
    return { summary: `Corrected paid amount on ${claim.ref} by ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}.` };
  },

  'appeals:record-outcome': ({ values }) => ({ status: values.recovered >= values.amount ? 'WON' : values.recovered > 0 ? 'PARTIAL' : 'LOST' }),

  'payer-reconciliations:reconcile': ({ values, reason }) => {
    if (Math.abs(values.variance ?? 0) > 0.004 && !reason) throw new HttpError(422, 'REASON_REQUIRED', 'Explain the variance before signing off.', { reason: 'Explain the variance.' });
  },

  'responsibility-transfers:approve': ({ values, row, actorId }) => {
    const src = adjustInvoice(values.invoice, -values.amount, actorId, `Responsibility transfer ${row.ref}`);
    const srcRow = loadRow(getRes('invoices'), values.invoice);
    const sv = valuesOf(srcRow);
    const billTo = values.toParty === 'PATIENT' ? 'PATIENT' : 'PAYER';
    const inv = createLinked('invoices', {
      patient: values.patient, encounter: sv.encounter, billTo, payer: billTo === 'PAYER' ? sv.payer : null, subtotal: values.amount, tax: 0, amount: values.amount, balance: values.amount,
      issuedOn: todayUtc(), dueDate: addDays(todayUtc(), 30), branch: srcRow.branch,
      lines: [{ description: `Balance transferred from ${src.ref} (${values.reasonCode?.toLowerCase().replace(/_/g, ' ')})`, quantity: 1, unitPrice: values.amount, tax: 0, amount: values.amount }],
    }, 'ISSUED', actorId, `transfer ${row.ref} from ${src.ref}`);
    return { summary: `Moved ${money(values.amount, row.currency)} from ${src.ref} to new invoice ${inv.ref}.` };
  },

  'payment-plans:approve': ({ values }) => {
    const n = values.installments;
    const step = values.cadence === 'WEEKLY' ? 7 : values.cadence === 'BIWEEKLY' ? 14 : 30;
    const each = Math.floor((values.amount / n) * 100) / 100;
    values.schedule = Array.from({ length: n }, (_, i) => ({ n: i + 1, due: addDays(values.firstDue, i * step), amount: i === n - 1 ? round2(values.amount - each * (n - 1)) : each, state: 'Due' }));
    values.balance = values.amount;
    values.dueDate = values.firstDue;
  },
  'payment-plans:record-payment': ({ values }) => {
    const next = (values.schedule ?? []).find((x: any) => x.state === 'Due');
    if (!next) throw new HttpError(409, 'NOTHING_DUE', 'Every instalment is already paid.');
    next.state = 'Paid';
    values.balance = round2(values.balance - next.amount);
    const after = values.schedule.find((x: any) => x.state === 'Due');
    values.dueDate = after?.due ?? null;
    return { status: after ? 'ACTIVE' : 'COMPLETED', summary: `Instalment ${next.n} of ${values.schedule.length} paid (${next.amount.toFixed(2)}).` };
  },

  'statements:send': ({ values }) => { values.sentOn = todayUtc(); },
  'collections:promise': ({ values }) => { values.dueDate = values.promiseDate; },

  'coding-cases:raise-query': ({ values, row, input, actorId }) => {
    const enc = values.encounter ? valuesOf(loadRow(getRes('encounters'), values.encounter)) : {};
    const q = createLinked('cdi-queries', { encounter: values.encounter, patient: values.patient, physician: enc.attending ?? 'Attending clinician', question: input.question, dueDate: addDays(todayUtc(), 2), branch: values.branch }, 'OPEN', actorId, `raised from coding case ${row.ref}`);
    return { summary: `Raised clarification ${q.ref} with ${enc.attending ?? 'the attending clinician'}.` };
  },
  'coding-cases:complete': ({ values }) => {
    if (!values.principalDx) throw new HttpError(422, 'VALIDATION', 'Add the principal diagnosis before completing.', { principalDx: 'Required to complete coding.' });
  },

  'drg-groupings:run-grouper': ({ values }) => {
    const hit = DRG_TABLE[String(values.principalDx ?? '').toUpperCase().slice(0, 3)];
    values.grouperVersion = 'AR-DRG 11.0, licensed simulator';
    if (!hit) {
      Object.assign(values, { drgCode: null, weight: null, amount: 0 });
      return { status: 'ERROR', summary: `The grouper found no DRG for principal diagnosis ${values.principalDx}.` };
    }
    const weight = round2(hit.weight * (values.lengthOfStay > 14 ? 1.15 : 1));
    Object.assign(values, { drgCode: hit.drg, weight, amount: round2(DRG_BASE_RATE * weight) });
    return { status: 'GROUPED', summary: `Grouped to ${hit.drg} (${hit.name}), weight ${weight}.` };
  },

  'em-determinations:determine': ({ values }) => {
    const mdm = { STRAIGHTFORWARD: 2, LOW: 3, MODERATE: 4, HIGH: 5 }[values.mdm as string] ?? 2;
    const t = values.totalMinutes ?? 0;
    const time = t >= 40 ? 5 : t >= 30 ? 4 : t >= 20 ? 3 : 2;
    values.level = `L${Math.max(mdm, time)}`;
    values.amount = EM_AMOUNT[values.level];
    return { summary: `Determined level ${values.level} from ${mdm >= time ? 'medical decision making' : 'total time'}.` };
  },
  'em-determinations:override': ({ values }) => { values.amount = EM_AMOUNT[values.level]; },

  'model-settlements:calculate': ({ values }) => {
    const e = values.expectedAmount, a = values.actualAmount;
    values.amount = round2(values.model === 'COST_PLUS' ? a * 1.12 : values.model === 'CAPITATION' ? e : values.model === 'P4P' ? e * Math.min(a / Math.max(e, 1), 1) : Math.max(e - a, 0) * 0.5);
    return { summary: `Settlement calculated at ${values.amount.toFixed(2)} under ${values.model.toLowerCase().replace(/_/g, ' ')} rules.` };
  },
  'model-settlements:post': ({ values, row, actorId }) => {
    const j = createLinked('journals', { sourceDocument: row.ref, postingDate: todayUtc(), amount: values.amount, lines: [{ account: '1230 Model receivable', role: 'MODEL_AR', debit: values.amount, credit: 0 }, { account: '4200 Contract revenue', role: 'CONTRACT_REVENUE', debit: 0, credit: values.amount }] }, 'POSTED', actorId, `settlement ${row.ref}`);
    return { summary: `Posted ${row.ref} to the ledger as journal ${j.ref}.` };
  },

  'journals:resolve': ({ values }) => { values.exception = null; },

  'gl-reconciliations:compare': ({ values }) => {
    values.variance = round2(values.amount - values.glBalance);
    return { status: Math.abs(values.variance) <= 0.004 ? 'MATCHED' : 'VARIANCE' };
  },
  'gl-reconciliations:sign-off': ({ values, reason }) => {
    if (Math.abs(values.variance ?? 0) > 0.004 && !values.explanation && !reason) throw new HttpError(422, 'REASON_REQUIRED', 'Explain the variance before signing off.', { reason: 'Explain the variance.' });
  },

  'exports:export': ({ values, row }) => {
    values.checksum = 'sha256:' + crypto.createHash('sha256').update(`${row.ref}|${values.period}|${values.entries}|${values.amount}`).digest('hex').slice(0, 32);
  },
};

export const EFFECTS = E;
export type { EffectCtx };
