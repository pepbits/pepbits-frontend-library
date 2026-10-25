import { db, todayUtc } from './db';
import { RESOURCES, RESOURCE_MAP, humanize, tableName } from './registry';
import { HttpError } from './validation';

type Row = { id: number; code: string; name: string; status: string; effective_from: string | null; data: string };

const rows = (key: string, where = '1=1', params: unknown[] = []) =>
  (db.prepare(`SELECT id, code, name, status, effective_from, data FROM ${tableName(key)} WHERE ${where}`).all(...params) as Row[])
    .map((r) => ({ ...r, d: JSON.parse(r.data) as Record<string, any> }));

const approved = (key: string) => rows(key, `status='APPROVED' AND (effective_from IS NULL OR effective_from <= ?)`, [todayUtc()]);
const active = (key: string) => rows(key, `status='ACTIVE'`);

interface Check { label: string; ok: boolean; detail: string; href: string }

export function overview() {
  const today = todayUtc();
  const grants = approved('billing-grants').filter((g) => g.d.enabled);
  const numbering = approved('numbering');
  const numTypes = new Set(numbering.map((n) => n.d.documentType));
  const items = active('items').filter((i) => i.d.billable);
  const books = approved('price-books');
  const selfPay = books.filter((b) => b.d.bookType === 'SELF_PAY');
  const taxes = approved('tax-rules');
  const releases = approved('commercial-releases');
  const insurers = active('commercial-parties').filter((p) => (p.d.roles ?? []).includes('INSURER'));
  const plans = approved('insurance-plans');
  const contracts = approved('contracts');
  const arrangements = approved('branch-arrangements');
  const policies = approved('billing-policies');
  const tenantPolicy = policies.filter((p) => p.d.scope === 'TENANT' && p.d.enabled).sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)))[0];
  const routes = approved('reimbursement-routes');
  const accounts = active('gl-accounts');
  const mappings = approved('gl-mappings');
  const periods = rows('fiscal-periods', `status='APPROVED'`).filter((p) => p.d.periodState === 'OPEN' && p.d.periodStart <= today && p.d.periodEnd >= today);
  const exchange = approved('exchange-profiles');
  const providers = approved('provider-profiles');

  const needsPins = tenantPolicy && !String(tenantPolicy.d.pricingModel ?? '').startsWith('FFS');
  const pinned = tenantPolicy && (tenantPolicy.d.stayConfiguration || tenantPolicy.d.advancedConfiguration || tenantPolicy.d.drgConfiguration || tenantPolicy.d.categoryConfiguration);

  const stages: { key: string; title: string; summary: string; optional?: boolean; checks: Check[] }[] = [
    {
      key: 'access', title: 'Access', summary: 'Grants and numbering',
      checks: [
        { label: 'Enabled billing grants', ok: grants.length > 0, detail: `${grants.length} effective`, href: '/config/billing-grants' },
        { label: 'Invoice and receipt numbering', ok: numTypes.has('INVOICE') && numTypes.has('RECEIPT'), detail: [...numTypes].map((x) => humanize(x)).join(', ') || 'None approved', href: '/config/numbering' },
      ],
    },
    {
      key: 'catalogue', title: 'Catalogue', summary: 'Items, prices and tax',
      checks: [
        { label: 'Billable items', ok: items.length > 0, detail: `${items.length} active`, href: '/config/items' },
        { label: 'Self-pay price book', ok: selfPay.length > 0, detail: selfPay[0]?.name ?? 'None effective', href: '/config/price-books' },
        { label: 'Tax treatment', ok: taxes.length > 0, detail: `${taxes.length} effective rules`, href: '/config/tax-rules' },
      ],
    },
    {
      key: 'release', title: 'Publication', summary: 'Commercial release',
      checks: [{ label: 'Approved commercial release', ok: releases.length > 0, detail: releases[0]?.name ?? 'Nothing published', href: '/config/commercial-releases' }],
    },
    {
      key: 'payers', title: 'Payers', summary: 'Plans, contracts, acceptance',
      checks: [
        { label: 'Insurers', ok: insurers.length > 0, detail: `${insurers.length} active`, href: '/config/commercial-parties' },
        { label: 'Approved plans', ok: plans.length > 0, detail: `${plans.length} effective`, href: '/config/insurance-plans' },
        { label: 'Approved contracts', ok: contracts.length > 0, detail: `${contracts.length} effective`, href: '/config/contracts' },
        { label: 'Branch arrangements', ok: arrangements.length > 0, detail: `${arrangements.length} accepted combinations`, href: '/config/branch-arrangements' },
      ],
    },
    {
      key: 'models', title: 'Models', summary: 'Routes and pins',
      checks: [
        { label: 'Model pins for the default model', ok: !needsPins || Boolean(pinned), detail: !tenantPolicy ? 'Waiting for a tenant policy' : needsPins ? (pinned ? 'Pinned' : 'Missing pin') : 'Fee-for-service needs no pin', href: '/config/billing-policies' },
        { label: 'Reimbursement routes', ok: true, detail: routes.length ? `${routes.length} effective` : 'Optional — default model applies', href: '/config/reimbursement-routes' },
      ],
    },
    {
      key: 'policy', title: 'Billing policy', summary: 'Approved tenant default',
      checks: [{ label: 'Enabled tenant default', ok: Boolean(tenantPolicy), detail: tenantPolicy ? `${tenantPolicy.code} since ${tenantPolicy.effective_from}` : 'Billing is closed', href: '/config/billing-policies' }],
    },
    {
      key: 'ledger', title: 'Accounting', summary: 'Accounts, mappings, period',
      checks: [
        { label: 'Chart of accounts', ok: accounts.length > 0, detail: `${accounts.length} active accounts`, href: '/config/gl-accounts' },
        { label: 'Approved mapping version', ok: mappings.length > 0, detail: `${mappings.length} effective`, href: '/config/gl-mappings' },
        { label: 'Open fiscal period today', ok: periods.length > 0, detail: periods[0]?.name ?? 'No open period', href: '/config/fiscal-periods' },
      ],
    },
    {
      key: 'exchange', title: 'Exchange', summary: 'Optional integrations', optional: true,
      checks: [
        { label: 'Exchange profiles', ok: exchange.length > 0, detail: exchange.length ? `${exchange.length} approved` : 'Manual claims only', href: '/config/exchange-profiles' },
        { label: 'Payment providers', ok: providers.length > 0, detail: providers.length ? `${providers.length} approved` : 'Manual receipts only', href: '/config/provider-profiles' },
      ],
    },
  ];

  const staged = stages.map((s) => {
    const done = s.checks.filter((c) => c.ok).length;
    return { ...s, done, total: s.checks.length, state: done === s.checks.length ? 'complete' : done === 0 ? 'missing' : 'partial' };
  });

  let pending = 0, drafts = 0, effective = 0, records = 0;
  const byCategory: Record<string, { pending: number; drafts: number; total: number }> = {};
  for (const r of RESOURCES) {
    const c = db.prepare(`SELECT
      SUM(status='PENDING_APPROVAL') p, SUM(status IN ('DRAFT','REJECTED')) d, SUM(status IN ('APPROVED','ACTIVE')) e, COUNT(*) n
      FROM ${tableName(r.key)}`).get() as { p: number | null; d: number | null; e: number | null; n: number };
    pending += c.p ?? 0; drafts += c.d ?? 0; effective += c.e ?? 0; records += c.n;
    const b = (byCategory[r.category] ??= { pending: 0, drafts: 0, total: 0 });
    b.pending += c.p ?? 0; b.drafts += c.d ?? 0; b.total += c.n;
  }

  const upcoming: { resource: string; code: string; name: string; effectiveFrom: string; id: number }[] = [];
  for (const r of RESOURCES) {
    if (!r.effectiveDated) continue;
    for (const x of rows(r.key, `status='APPROVED' AND effective_from > ?`, [today])) upcoming.push({ resource: r.key, code: x.code, name: x.name, effectiveFrom: x.effective_from!, id: x.id });
  }
  upcoming.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  return {
    stages: staged,
    billingOpen: Boolean(tenantPolicy),
    totals: { pending, drafts, effective, records },
    byCategory,
    upcoming: upcoming.slice(0, 6),
    recent: recentAudit(8),
  };
}

export function pendingSummary() {
  const out: Record<string, number> = {};
  for (const r of RESOURCES) {
    const n = (db.prepare(`SELECT COUNT(*) n FROM ${tableName(r.key)} WHERE status='PENDING_APPROVAL'`).get() as { n: number }).n;
    if (n) out[r.key] = n;
  }
  return out;
}

export function approvals() {
  const out: any[] = [];
  for (const r of RESOURCES) {
    if (r.governance !== 'versioned') continue;
    const list = db.prepare(`SELECT id, code, name, revision, row_version, effective_from, submitted_by, submitted_at, created_by, change_reason FROM ${tableName(r.key)} WHERE status='PENDING_APPROVAL'`).all() as any[];
    for (const x of list)
      out.push({ resource: r.key, resourceLabel: r.label, category: r.category, id: x.id, code: x.code, name: x.name, revision: x.revision, rowVersion: x.row_version, effectiveFrom: x.effective_from, submittedBy: x.submitted_by, submittedAt: x.submitted_at, createdBy: x.created_by, changeReason: x.change_reason });
  }
  return out.sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
}

export function recentAudit(limit = 50, filter: { resource?: string; recordCode?: string; actorId?: number; action?: string } = {}) {
  const where: string[] = [];
  const p: Record<string, unknown> = { limit: Math.min(Math.max(limit, 1), 500) };
  if (filter.resource) { where.push('resource=@resource'); p.resource = filter.resource; }
  if (filter.recordCode) { where.push('record_code=@code'); p.code = filter.recordCode; }
  if (filter.actorId) { where.push('actor_id=@actor'); p.actor = filter.actorId; }
  if (filter.action) { where.push('action=@action'); p.action = filter.action; }
  return db
    .prepare(`SELECT id, at, actor_id actorId, resource, record_id recordId, record_code recordCode, action, summary, reason FROM audit_event ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY at DESC, id DESC LIMIT @limit`)
    .all(p);
}

/* ------------------------------------------------------------------ */
/* Reimbursement route tester                                          */
/* ------------------------------------------------------------------ */

const SCOPE_SCORE: Record<string, number> = { ITEM: 8, CATEGORY: 4, ALL: 0 };

export function testRoute(input: { itemId?: number; contractId?: number; careSetting?: string; serviceDate?: string }) {
  const itemId = Number(input.itemId);
  if (!itemId) throw new HttpError(422, 'VALIDATION', 'Choose an item to test.', { itemId: 'Required.' });
  const item = rows('items', 'id = ?', [itemId])[0];
  if (!item) throw new HttpError(404, 'NOT_FOUND', 'That item was not found.');
  const date = input.serviceDate || todayUtc();
  const categoryId = item.d.category ?? null;

  const candidates = rows('reimbursement-routes', `status='APPROVED' AND (effective_from IS NULL OR effective_from <= ?)`, [date]).map((r) => {
    const d = r.d;
    const reasons: string[] = [];
    let matched = true;
    if (d.scope === 'ITEM' && !(d.items ?? []).includes(itemId)) { matched = false; reasons.push('item not listed'); }
    if (d.scope === 'CATEGORY' && d.category !== categoryId) { matched = false; reasons.push('different category'); }
    if (d.contract && d.contract !== Number(input.contractId)) { matched = false; reasons.push('contract does not match'); }
    if ((d.careSettings ?? []).length && !(d.careSettings ?? []).includes(input.careSetting)) { matched = false; reasons.push('care setting excluded'); }
    const specificity = (SCOPE_SCORE[d.scope] ?? 0) + (d.contract ? 2 : 0) + ((d.careSettings ?? []).length ? 1 : 0);
    return { id: r.id, code: r.code, name: r.name, model: d.model, priority: Number(d.priority ?? 0), scope: d.scope, specificity, matched, reasons };
  });

  candidates.sort((a, b) => Number(b.matched) - Number(a.matched) || b.priority - a.priority || b.specificity - a.specificity);
  const matches = candidates.filter((c) => c.matched);
  const conflict = matches.length > 1 && matches[0].priority === matches[1].priority && matches[0].specificity === matches[1].specificity;

  const policy = approved('billing-policies').filter((p) => p.d.scope === 'TENANT' && p.d.enabled).sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)))[0];
  let outcome: { kind: 'route' | 'default' | 'conflict' | 'closed'; model?: string; message: string };
  if (conflict) outcome = { kind: 'conflict', message: `Two routes tie at priority ${matches[0].priority} and specificity ${matches[0].specificity}. Selection refuses rather than picking one.` };
  else if (matches[0]) outcome = { kind: 'route', model: matches[0].model, message: `${matches[0].code} wins on priority ${matches[0].priority}, specificity ${matches[0].specificity}.` };
  else if (policy) outcome = { kind: 'default', model: policy.d.pricingModel, message: `No route matched. The tenant default model from ${policy.code} applies.` };
  else outcome = { kind: 'closed', message: 'No route matched and there is no approved tenant policy, so billing stays closed.' };

  return { item: { id: item.id, code: item.code, name: item.name }, serviceDate: date, outcome, candidates };
}

export function resourceExists(key: string) {
  return RESOURCE_MAP.has(key);
}
