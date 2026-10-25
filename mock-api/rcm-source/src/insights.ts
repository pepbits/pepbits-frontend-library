import { addDays, db, todayUtc } from './db';
import { toMajor } from './engine';
import { RESOURCES, RESOURCE_MAP, scopeSql, tableName } from './registry';

const t = tableName;
const scope = (branch?: string, alias = '') => scopeSql(branch, alias);
const one = <T>(q: string, ...p: unknown[]) => db.prepare(q).get(...p) as T;
const all = <T>(q: string, ...p: unknown[]) => db.prepare(q).all(...p) as T[];

function count(res: string, statuses: string[], branch?: string, extra = '1=1') {
  return one<{ n: number; v: number; b: number }>(`SELECT COUNT(*) n, COALESCE(SUM(amount_minor),0) v, COALESCE(SUM(balance_minor),0) b FROM ${t(res)} WHERE status IN (${statuses.map((s) => `'${s}'`).join(',')}) AND ${scope(branch)} AND ${extra}`);
}

/* ------------------------------------------------------------------ */
/* Billing home                                                        */
/* ------------------------------------------------------------------ */

const QUEUES: { res: string; statuses: string[]; label: string; metric?: 'amount' | 'balance'; overdue?: boolean }[] = [
  { res: 'coverages', statuses: ['PENDING_VERIFICATION'], label: 'Coverage to verify' },
  { res: 'authorizations', statuses: ['SUBMITTED'], label: 'Authorizations with payers' },
  { res: 'estimates', statuses: ['ISSUED', 'OVERRIDE_REQUESTED'], label: 'Admissions awaiting clearance' },
  { res: 'encounters', statuses: ['READY_TO_BILL'], label: 'Encounters ready to bill', metric: 'amount' },
  { res: 'charges', statuses: ['REVIEW'], label: 'Charges needing review' },
  { res: 'invoices', statuses: ['DRAFT'], label: 'Invoices to issue', metric: 'amount' },
  { res: 'receipts', statuses: ['UNALLOCATED', 'PARTIALLY_ALLOCATED'], label: 'Unallocated receipts', metric: 'balance' },
  { res: 'claims', statuses: ['READY'], label: 'Claims ready to submit', metric: 'amount' },
  { res: 'claims', statuses: ['DENIED'], label: 'Denied claims to work', metric: 'balance' },
  { res: 'remittances', statuses: ['RECEIVED', 'POSTING_REVIEW'], label: 'Remittances to post', metric: 'amount' },
  { res: 'coding-cases', statuses: ['QUEUED', 'IN_PROGRESS'], label: 'Encounters to code' },
  { res: 'journals', statuses: ['EXCEPTION'], label: 'Posting exceptions', metric: 'amount' },
];

export function home(branch?: string) {
  const today = todayUtc();
  const cashToday = one<{ v: number; n: number }>(`SELECT COALESCE(SUM(amount_minor),0) v, COUNT(*) n FROM ${t('receipts')} WHERE status <> 'VOIDED' AND json_extract(data,'$.receivedOn') = ? AND ${scope(branch)}`, today);
  const from = addDays(today, -83);
  const trend = all<{ d: string; v: number }>(`SELECT json_extract(data,'$.receivedOn') d, SUM(amount_minor) v FROM ${t('receipts')} WHERE status <> 'VOIDED' AND json_extract(data,'$.receivedOn') >= ? AND ${scope(branch)} GROUP BY d`, from);
  const days = Array.from({ length: 12 }, (_, w) => {
    const start = addDays(from, w * 7), end = addDays(start, 6);
    return { date: start, value: toMajor(trend.filter((x) => x.d >= start && x.d <= end).reduce((s, x) => s + x.v, 0)) };
  });
  const queues = QUEUES.map((q) => {
    const c = count(q.res, q.statuses, branch);
    const r = RESOURCE_MAP.get(q.res)!;
    return { label: q.label, href: `/w/${q.res}?status=${q.statuses.join(',')}`, icon: r.icon, count: c.n, value: q.metric ? toMajor(q.metric === 'amount' ? c.v : c.b) : null, category: r.category };
  });
  const drawers = all<any>(`SELECT s.ref, s.id, s.amount_minor, s.currency, s.status, s.branch, u.name cashier, json_extract(s.data,'$.openingFloat') float FROM ${t('cash-sessions')} s LEFT JOIN app_user u ON u.id = s.assignee_id WHERE s.status IN ('OPEN','UNDER_REVIEW') AND ${scope(branch, 's.')} ORDER BY s.status`);
  const outstanding = count('invoices', ['ISSUED', 'PARTIALLY_PAID'], branch);
  const denied = count('claims', ['DENIED'], branch);
  const exchangeFailures = count('exchange-messages', ['FAILED', 'DEAD_LETTER'], branch).n;
  return {
    cashToday: { value: toMajor(cashToday.v), count: cashToday.n }, trend: days,
    outstanding: toMajor(outstanding.b), deniedValue: toMajor(denied.b), deniedCount: denied.n, exchangeFailures,
    approvals: approvals(undefined, branch).length,
    queues, drawers: drawers.map((d) => ({ id: d.id, ref: d.ref, cashier: d.cashier, status: d.status, branch: d.branch, expected: toMajor(d.amount_minor + Math.round((d.float ?? 0) * 100)), currency: d.currency })),
  };
}

/* ------------------------------------------------------------------ */
/* Aging                                                               */
/* ------------------------------------------------------------------ */

const BUCKETS = [{ label: '0–30', max: 30 }, { label: '31–60', max: 60 }, { label: '61–90', max: 90 }, { label: '91–120', max: 120 }, { label: 'Over 120', max: Infinity }];

export function aging(branch?: string) {
  const today = new Date(todayUtc() + 'T00:00:00Z').getTime();
  const rows = all<any>(`SELECT i.id, i.ref, i.balance_minor, i.currency, i.patient_id, i.due_date, json_extract(i.data,'$.issuedOn') issued, json_extract(i.data,'$.billTo') billTo,
      p.name payerName, pt.name patientName
    FROM ${t('invoices')} i LEFT JOIN ref_payer p ON p.id = json_extract(i.data,'$.payer') LEFT JOIN ref_patient pt ON pt.id = i.patient_id
    WHERE i.status IN ('ISSUED','PARTIALLY_PAID') AND i.balance_minor > 0 AND ${scope(branch, 'i.')}`);
  const parties = new Map<string, { party: string; kind: string; buckets: number[]; total: number; invoices: number }>();
  const totals = BUCKETS.map(() => 0);
  const oldest: any[] = [];
  for (const r of rows) {
    const age = Math.max(0, Math.round((today - new Date((r.issued ?? todayUtc()) + 'T00:00:00Z').getTime()) / 86400000));
    const bi = BUCKETS.findIndex((b) => age <= b.max);
    const key = r.billTo === 'PAYER' ? r.payerName ?? 'Unknown payer' : 'Patients';
    const p = parties.get(key) ?? { party: key, kind: r.billTo === 'PAYER' ? 'Payer' : 'Self-pay', buckets: BUCKETS.map(() => 0), total: 0, invoices: 0 };
    const v = toMajor(r.balance_minor);
    p.buckets[bi] += v; p.total += v; p.invoices += 1; totals[bi] += v;
    parties.set(key, p);
    oldest.push({ id: r.id, ref: r.ref, age, balance: v, currency: r.currency, party: key, patient: r.patientName, dueDate: r.due_date });
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const list = [...parties.values()].map((p) => ({ ...p, buckets: p.buckets.map(round), total: round(p.total) })).sort((a, b) => b.total - a.total);
  const total = round(totals.reduce((a, b) => a + b, 0));
  const charges180 = one<{ v: number }>(`SELECT COALESCE(SUM(amount_minor),0) v FROM ${t('invoices')} WHERE status <> 'DRAFT' AND json_extract(data,'$.issuedOn') >= ? AND ${scope(branch)}`, addDays(todayUtc(), -180)).v;
  return {
    buckets: BUCKETS.map((b) => b.label), totals: totals.map(round), total, parties: list,
    oldest: oldest.sort((a, b) => b.age - a.age).slice(0, 12),
    daysInAr: charges180 ? Math.round(total / (toMajor(charges180) / 180)) : 0,
    over90Share: total ? Math.round(((totals[3] + totals[4]) / total) * 1000) / 10 : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export function reports(branch?: string) {
  const months: string[] = [];
  const d = new Date(todayUtc() + 'T00:00:00Z');
  for (let i = 5; i >= 0; i--) months.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  const from = months[0] + '-01';
  const charges = all<{ m: string; v: number }>(`SELECT substr(json_extract(data,'$.issuedOn'),1,7) m, SUM(amount_minor) v FROM ${t('invoices')} WHERE status <> 'DRAFT' AND json_extract(data,'$.issuedOn') >= ? AND ${scope(branch)} GROUP BY m`, from);
  const cash = all<{ m: string; v: number }>(`SELECT substr(json_extract(data,'$.receivedOn'),1,7) m, SUM(amount_minor) v FROM ${t('receipts')} WHERE status <> 'VOIDED' AND json_extract(data,'$.receivedOn') >= ? AND ${scope(branch)} GROUP BY m`, from);
  const series = months.map((m) => ({ month: m, billed: toMajor(charges.find((x) => x.m === m)?.v ?? 0), collected: toMajor(cash.find((x) => x.m === m)?.v ?? 0) }));
  const billed = series.reduce((s, x) => s + x.billed, 0);
  const collected = series.reduce((s, x) => s + x.collected, 0);
  const adjudicated = one<{ n: number; d: number }>(`SELECT COUNT(*) n, SUM(status='DENIED') d FROM ${t('claims')} WHERE status IN ('PAID','PARTIALLY_PAID','DENIED','CLOSED') AND ${scope(branch)}`);
  const denials = all<{ r: string; n: number; v: number }>(`SELECT COALESCE(json_extract(data,'$.denialReason'),'UNSPECIFIED') r, COUNT(*) n, SUM(balance_minor) v FROM ${t('claims')} WHERE status = 'DENIED' AND ${scope(branch)} GROUP BY r ORDER BY v DESC`);
  const methods = all<{ m: string; v: number }>(`SELECT json_extract(data,'$.method') m, SUM(amount_minor) v FROM ${t('receipts')} WHERE status <> 'VOIDED' AND json_extract(data,'$.receivedOn') >= ? AND ${scope(branch)} GROUP BY m ORDER BY v DESC`, from);
  const payers = all<{ p: string; v: number }>(`SELECT COALESCE(p.name,'Self-pay') p, SUM(i.amount_minor) v FROM ${t('invoices')} i LEFT JOIN ref_payer p ON p.id = json_extract(i.data,'$.payer') WHERE i.status <> 'DRAFT' AND json_extract(i.data,'$.issuedOn') >= ? AND ${scope(branch, 'i.')} GROUP BY p ORDER BY v DESC`, from);
  const outstanding = count('invoices', ['ISSUED', 'PARTIALLY_PAID'], branch);
  return {
    series,
    kpis: {
      billed: Math.round(billed * 100) / 100, collected: Math.round(collected * 100) / 100,
      collectionRate: billed ? Math.round((collected / billed) * 1000) / 10 : 0,
      denialRate: adjudicated.n ? Math.round(((adjudicated.d ?? 0) / adjudicated.n) * 1000) / 10 : 0,
      daysInAr: billed ? Math.round(toMajor(outstanding.b) / (billed / 180)) : 0,
      outstanding: toMajor(outstanding.b),
    },
    denials: denials.map((x) => ({ reason: x.r, count: x.n, value: toMajor(x.v) })),
    methods: methods.map((x) => ({ method: x.m, value: toMajor(x.v) })),
    payers: payers.map((x) => ({ payer: x.p, value: toMajor(x.v) })),
  };
}

/* ------------------------------------------------------------------ */
/* Approvals and pending counts                                        */
/* ------------------------------------------------------------------ */

export function approvals(actorId?: number, branch?: string) {
  const out: any[] = [];
  for (const r of RESOURCES) {
    const acts = r.actions.filter((a) => a.independent && !a.optional);
    if (!acts.length) continue;
    const statuses = [...new Set(acts.flatMap((a) => a.from))];
    const rows = all<any>(`SELECT x.*, p.name patientName FROM ${t(r.key)} x LEFT JOIN ref_patient p ON p.id = x.patient_id WHERE x.status IN (${statuses.map((s) => `'${s}'`).join(',')}) AND ${scope(branch, 'x.')} ORDER BY x.status_at`);
    for (const x of rows) {
      const actions = acts.filter((a) => a.from.includes(x.status)).map((a) => ({ key: a.key, label: a.label, tone: a.tone, reason: a.reason ?? null, inputs: a.inputs ?? null }));
      out.push({
        resource: r.key, resourceLabel: r.label, category: r.category, icon: r.icon, id: x.id, ref: x.ref, title: x.title, status: x.status,
        statusLabel: r.statuses.find((s) => s.key === x.status)?.label ?? x.status, patient: x.patientName, amount: toMajor(x.amount_minor), currency: x.currency,
        requestedBy: x.status_by, requestedAt: x.status_at, createdBy: x.created_by, rowVersion: x.row_version, reason: x.reason, actions,
        canDecide: actorId ? actorId !== x.created_by && actorId !== x.status_by : null,
      });
    }
  }
  return out.sort((a, b) => String(a.requestedAt).localeCompare(String(b.requestedAt)));
}

export function pending(branch?: string) {
  const out: Record<string, number> = {};
  for (const a of approvals(undefined, branch)) out[a.resource] = (out[a.resource] ?? 0) + 1;
  return out;
}

export function auditTrail(q: { resource?: string; limit?: number }) {
  return all<any>(`SELECT id, at, actor_id actorId, resource, record_id recordId, record_ref recordRef, action, from_status "from", to_status "to", summary, reason FROM audit_event
    ${q.resource ? 'WHERE resource = ?' : ''} ORDER BY at DESC, id DESC LIMIT ${Math.min(Number(q.limit) || 50, 300)}`, ...(q.resource ? [q.resource] : []));
}
