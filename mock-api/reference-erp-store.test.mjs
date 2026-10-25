import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReferenceErpStore } from './reference-erp-store.mjs';

const scope = { applicationId: 'app-1', branchId: 'br-1' };
const admin = { id: 'u-admin', name: 'Admin', email: 'a@x.com', role: 'admin', branch: 'br-1', tenantId: 't-1' };
const finance = { id: 'u-fin', name: 'Fin', email: 'f@x.com', role: 'accountant', branch: 'br-1', tenantId: 't-1' };
const unknown = { id: 'u-x', name: 'X', email: 'x@x.com', role: 'teacher', branch: 'br-1', tenantId: 't-1' };

function store(variant = 'erp1') { return createReferenceErpStore({ variant }); }
const req = (extra) => ({ method: 'GET', path: '/', query: {}, body: undefined, ...extra });

for (const variant of ['erp1', 'erp2']) {
  test(`[${variant}] list envelope shape, facets, totals, pagination, q, sort`, () => {
    const s = store(variant);
    const listAll = s.handle(admin, scope, req({ path: '/api/entities/countries', query: { size: '5', page: '1' } }));
    assert.equal(listAll.status, 200);
    assert.ok(Array.isArray(listAll.body.rows));
    assert.equal(listAll.body.rows.length, 5);
    assert.equal(listAll.body.page, 1);
    assert.equal(listAll.body.size, 5);
    assert.ok(listAll.body.total >= 24);
    assert.ok(typeof listAll.body.facets === 'object');
    assert.ok(typeof listAll.body.totals === 'object');

    const invoices = s.handle(admin, scope, req({ path: '/entities/sales-invoices', query: { size: '500' } }));
    assert.equal(invoices.status, 200);
    assert.ok(invoices.body.totals.total >= 0);
    assert.ok(Object.keys(invoices.body.facets).length > 0);

    const q = s.handle(admin, scope, req({ path: '/entities/countries', query: { q: 'india' } }));
    assert.equal(q.body.rows.length, 1);
    assert.equal(q.body.rows[0].name, 'India');

    const sorted = s.handle(admin, scope, req({ path: '/entities/countries', query: { sort: 'name', dir: 'asc', size: '3' } }));
    const names = sorted.body.rows.map((r) => r.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  });

  test(`[${variant}] single row raw GET/PUT/DELETE round trip, 404 on bad id`, () => {
    const s = store(variant);
    const created = s.handle(admin, scope, req({ method: 'POST', path: '/entities/countries', body: { code: 'ZZ', name: 'Zedland', region: 'Asia' } }));
    assert.equal(created.status, 201);
    assert.equal(created.body.name, 'Zedland');
    const id = created.body.id;

    const got = s.handle(admin, scope, req({ path: `/entities/countries/${id}` }));
    assert.equal(got.status, 200);
    assert.equal(got.body.code, 'ZZ');

    const updated = s.handle(admin, scope, req({ method: 'PUT', path: `/entities/countries/${id}`, body: { name: 'Zedland Renamed' } }));
    assert.equal(updated.status, 200);
    assert.equal(updated.body.name, 'Zedland Renamed');
    assert.equal(updated.body.id, id);

    const deleted = s.handle(admin, scope, req({ method: 'DELETE', path: `/entities/countries/${id}` }));
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.deleted, id);

    const missing = s.handle(admin, scope, req({ path: `/entities/countries/${id}` }));
    assert.equal(missing.status, 404);

    const badEntity = s.handle(admin, scope, req({ path: '/entities/not-a-real-entity' }));
    assert.equal(badEntity.status, 404);
  });

  test(`[${variant}] tree entity: hierarchy present, rejects nonexistent parent and cycles`, () => {
    const s = store(variant);
    const list = s.handle(admin, scope, req({ path: '/entities/org-structure', query: { size: '500' } }));
    const root = list.body.rows.find((r) => r.level === 0);
    const child = list.body.rows.find((r) => r.parentId === root.id);
    assert.ok(root && child, 'expected a hierarchy with at least one level');

    const badParent = s.handle(admin, scope, req({ method: 'PUT', path: `/entities/org-structure/${root.id}`, body: { parentId: 'no-such-id' } }));
    assert.equal(badParent.status, 422);

    const cycle = s.handle(admin, scope, req({ method: 'PUT', path: `/entities/org-structure/${root.id}`, body: { parentId: child.id } }));
    assert.equal(cycle.status, 422);
    assert.equal(cycle.body.fieldErrors.parentId, 'erp.cycle');
  });

  test(`[${variant}] matrix entity: period selects a distinct dataset`, () => {
    const s = store(variant);
    const a = s.handle(admin, scope, req({ path: '/entities/timesheets', query: { period: '2026-01-01' } }));
    const b = s.handle(admin, scope, req({ path: '/entities/timesheets', query: { period: '2026-06-01' } }));
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.notDeepEqual(a.body.rows[0].columns, b.body.rows[0].columns);
  });

  test(`[${variant}] lines/document entity: server recomputes totals, rejects negative qty`, () => {
    const s = store(variant);
    const customers = s.handle(admin, scope, req({ path: '/entities/customers', query: { size: '1' } }));
    const customerName = customers.body.rows[0].name;
    const created = s.handle(admin, scope, req({
      method: 'POST', path: '/entities/sales-orders',
      body: { customer: customerName, date: '2026-01-01', lines: [{ item: 'Steel Hex Bolt M8', qty: 2, rate: 10, tax: '0' }], total: 999999 },
    }));
    assert.equal(created.status, 201);
    assert.equal(created.body.total, 20);
    assert.equal(created.body.lines[0].amount, 20);

    const negative = s.handle(admin, scope, req({
      method: 'POST', path: '/entities/sales-orders',
      body: { customer: customerName, date: '2026-01-01', lines: [{ item: 'Steel Hex Bolt M8', qty: -2, rate: 10, tax: '0' }] },
    }));
    assert.equal(negative.status, 422);
  });

  test(`[${variant}] voucher entity: unbalanced debit/credit lines rejected`, () => {
    const s = store(variant);
    const balanced = s.handle(finance, scope, req({
      method: 'POST', path: '/entities/journal-vouchers',
      body: { date: '2026-01-01', reference: 'Test', lines: [{ account: 'Cash in Hand', debit: 100, credit: 0 }, { account: 'Sales Revenue', debit: 0, credit: 100 }] },
    }));
    assert.equal(balanced.status, 201);
    assert.equal(balanced.body.total, 100);

    const unbalanced = s.handle(finance, scope, req({
      method: 'POST', path: '/entities/journal-vouchers',
      body: { date: '2026-01-01', reference: 'Test', lines: [{ account: 'Cash in Hand', debit: 100, credit: 0 }, { account: 'Sales Revenue', debit: 0, credit: 40 }] },
    }));
    assert.equal(unbalanced.status, 422);
  });

  test(`[${variant}] ref field rejects a nonexistent referenced row`, () => {
    const s = store(variant);
    const bad = s.handle(admin, scope, req({ method: 'POST', path: '/entities/sales-orders', body: { customer: 'Nobody Imaginary Co Ltd', date: '2026-01-01' } }));
    assert.equal(bad.status, 422);
    assert.equal(bad.body.fieldErrors.customer, 'erp.unknownReference');
  });

  test(`[${variant}] branch/tenant isolation`, () => {
    const s = store(variant);
    const created = s.handle(admin, scope, req({ method: 'POST', path: '/entities/countries', body: { code: 'Q1', name: 'Isolated Land', region: 'Asia' } }));
    assert.equal(created.status, 201);
    const otherBranchUser = { ...admin, branch: 'br-2' };
    const otherScope = { applicationId: 'app-1', branchId: 'br-2' };
    const list = s.handle(otherBranchUser, otherScope, req({ path: '/entities/countries', query: { q: 'isolated' } }));
    assert.equal(list.body.rows.length, 0);
    const otherTenant = { ...admin, tenantId: 't-2' };
    const list2 = s.handle(otherTenant, scope, req({ path: '/entities/countries', query: { q: 'isolated' } }));
    assert.equal(list2.body.rows.length, 0);
  });

  test(`[${variant}] wrong-branch and missing-identity denial`, () => {
    const s = store(variant);
    const mismatched = s.handle(admin, { applicationId: 'app-1', branchId: 'br-9' }, req({ path: '/entities/countries' }));
    assert.equal(mismatched.status, 403);
    const noTenant = s.handle({ ...admin, tenantId: '' }, scope, req({ path: '/entities/countries' }));
    assert.equal(noTenant.status, 400);
    const noApp = s.handle(admin, { applicationId: '', branchId: 'br-1' }, req({ path: '/entities/countries' }));
    assert.equal(noApp.status, 400);
  });

  test(`[${variant}] RBAC: admin/operations write broadly; finance limited to its allowlist; unknown role denied entirely`, () => {
    const s = store(variant);
    const opsUser = { ...admin, role: 'operations-analyst' };
    const opsWrite = s.handle(opsUser, scope, req({ method: 'POST', path: '/entities/departments', body: { name: 'Finance' } }));
    assert.equal(opsWrite.status, 201);

    const financeAllowed = s.handle(finance, scope, req({ method: 'POST', path: '/entities/tax-rates', body: { name: 'GST 5%', rate: 5, category: 'GST' } }));
    assert.equal(financeAllowed.status, 201);

    const financeDenied = s.handle(finance, scope, req({ method: 'POST', path: '/entities/departments', body: { name: 'Blocked Dept' } }));
    assert.equal(financeDenied.status, 403);
    const financeRead = s.handle(finance, scope, req({ path: '/entities/departments' }));
    assert.equal(financeRead.status, 200);

    const unknownRead = s.handle(unknown, scope, req({ path: '/entities/departments' }));
    assert.equal(unknownRead.status, 403);
    const unknownWrite = s.handle(unknown, scope, req({ method: 'POST', path: '/entities/departments', body: { name: 'X' } }));
    assert.equal(unknownWrite.status, 403);
  });

  test(`[${variant}] malformed input never throws`, () => {
    const s = store(variant);
    assert.doesNotThrow(() => s.handle(admin, scope, req({ path: '/entities/countries', method: 'POST', body: 'not-an-object' })));
    assert.equal(s.handle(admin, scope, req({ path: '/entities/countries', method: 'POST', body: 'not-an-object' })).status, 400);
    assert.equal(s.handle(admin, scope, req({ path: '/entities/countries', method: 'PATCH' })).status, 405);
    assert.equal(s.handle(admin, scope, req({ path: '/not-a-route' })).status, 404);
    const requiredMissing = s.handle(admin, scope, req({ method: 'POST', path: '/entities/customers', body: {} }));
    assert.equal(requiredMissing.status, 422);
  });

  test(`[${variant}] GET /dashboard returns a well-formed object`, () => {
    const s = store(variant);
    const dash = s.handle(admin, scope, req({ path: '/api/dashboard' }));
    assert.equal(dash.status, 200);
    assert.ok(Array.isArray(dash.body.kpis));
    assert.ok(Array.isArray(dash.body.months));
    assert.ok(Array.isArray(dash.body.recentOrders));
  });

  test(`[${variant}] idempotent operationId replay vs conflicting payload`, () => {
    const s = store(variant);
    const body = { code: 'OP', name: 'Opland', region: 'Asia', operationId: 'op-1' };
    const first = s.handle(admin, scope, req({ method: 'POST', path: '/entities/countries', body }));
    assert.equal(first.status, 201);
    const replay = s.handle(admin, scope, req({ method: 'POST', path: '/entities/countries', body }));
    assert.equal(replay.status, 201);
    assert.equal(replay.body.id, first.body.id);
    const conflict = s.handle(admin, scope, req({ method: 'POST', path: '/entities/countries', body: { ...body, name: 'Different' } }));
    assert.equal(conflict.status, 409);
  });

  test(`[${variant}] optimistic concurrency via expectedVersion`, () => {
    const s = store(variant);
    const created = s.handle(admin, scope, req({ method: 'POST', path: '/entities/countries', body: { code: 'VV', name: 'Verland', region: 'Asia' } }));
    const id = created.body.id;
    const ok = s.handle(admin, scope, req({ method: 'PUT', path: `/entities/countries/${id}`, body: { name: 'Verland Two', expectedVersion: 1 } }));
    assert.equal(ok.status, 200);
    const stale = s.handle(admin, scope, req({ method: 'PUT', path: `/entities/countries/${id}`, body: { name: 'Verland Three', expectedVersion: 1 } }));
    assert.equal(stale.status, 409);
  });

  test(`[${variant}] GET /lookups hydrates pool/options fields, resources, balances and approvers; rejects entity/page mismatch and unknown page`, () => {
    const s = store(variant);
    const countries = s.handle(admin, scope, req({ path: '/api/lookups', query: { entity: 'countries', page: 'masters/countries' } }));
    assert.equal(countries.status, 200);
    assert.ok(Array.isArray(countries.body.fields.region) && countries.body.fields.region.includes('Asia'));

    const holidays = s.handle(admin, scope, req({ path: '/api/lookups', query: { entity: 'holidays', page: 'masters/holidays' } }));
    assert.ok(Array.isArray(holidays.body.fields.name) && holidays.body.fields.name.length > 0);

    const orders = s.handle(admin, scope, req({ path: '/api/lookups', query: { entity: 'sales-orders', page: 'transactions/sales-orders' } }));
    assert.ok(Array.isArray(orders.body.lines.item) && orders.body.lines.item.length > 0);

    const appointments = s.handle(admin, scope, req({ path: '/api/lookups', query: { entity: 'appointments', page: 'transactions/appointments' } }));
    assert.ok(Array.isArray(appointments.body.resources) && appointments.body.resources.length > 0);

    const leave = s.handle(admin, scope, req({ path: '/api/lookups', query: { entity: 'leave-requests', page: 'transactions/leave-requests' } }));
    assert.ok(Array.isArray(leave.body.balances) && leave.body.balances[0].label === 'Annual leave');
    assert.ok(Array.isArray(leave.body.approvers) && leave.body.approvers.length > 0);

    const payroll = s.handle(admin, scope, req({ path: '/api/lookups', query: { entity: 'payroll-run', page: 'transactions/payroll-run' } }));
    assert.ok(Array.isArray(payroll.body.params.period) && payroll.body.params.period.length > 0);

    const settings = s.handle(admin, scope, req({ path: '/api/lookups', query: { entity: 'company-settings', page: 'setup/company-settings' } }));
    assert.ok(Array.isArray(settings.body.sections.legalName));

    const mismatch = s.handle(admin, scope, req({ path: '/api/lookups', query: { entity: 'suppliers', page: 'masters/countries' } }));
    assert.equal(mismatch.status, 422);

    const unknownPage = s.handle(admin, scope, req({ path: '/api/lookups', query: { entity: 'countries', page: 'masters/no-such-page' } }));
    assert.equal(unknownPage.status, 404);

    const missingParams = s.handle(admin, scope, req({ path: '/api/lookups', query: { entity: 'countries' } }));
    assert.equal(missingParams.status, 400);
  });

  test(`[${variant}] view-state GET/PUT round trip, scoped per user, rejects unknown keys and oversized values`, () => {
    const s = store(variant);
    const before = s.handle(admin, scope, req({ path: '/api/view-state', query: { key: 'keystone.cols.countries' } }));
    assert.equal(before.status, 200);
    assert.equal(before.body.value, null);

    const put = s.handle(admin, scope, req({ method: 'PUT', path: '/api/view-state', body: { key: 'keystone.cols.countries', value: ['code', 'name'] } }));
    assert.equal(put.status, 200);
    assert.deepEqual(put.body.value, ['code', 'name']);

    const after = s.handle(admin, scope, req({ path: '/api/view-state', query: { key: 'keystone.cols.countries' } }));
    assert.deepEqual(after.body.value, ['code', 'name']);

    const otherUser = { ...admin, id: 'u-other' };
    const isolated = s.handle(otherUser, scope, req({ path: '/api/view-state', query: { key: 'keystone.cols.countries' } }));
    assert.equal(isolated.body.value, null);

    const badKey = s.handle(admin, scope, req({ path: '/api/view-state', query: { key: 'keystone.cols.not-a-real-page' } }));
    assert.equal(badKey.status, 400);

    const arbitraryKey = s.handle(admin, scope, req({ method: 'PUT', path: '/api/view-state', body: { key: 'anything.goes', value: 1 } }));
    assert.equal(arbitraryKey.status, 400);

    const tooLarge = s.handle(admin, scope, req({ method: 'PUT', path: '/api/view-state', body: { key: 'keystone.cols.countries', value: 'x'.repeat(30000) } }));
    assert.equal(tooLarge.status, 413);

    const malformed = s.handle(admin, scope, req({ method: 'PUT', path: '/api/view-state', body: 'not-an-object' }));
    assert.equal(malformed.status, 400);
  });

  test(`[${variant}] view-state rejects malformed cols/views/mode shapes and never mutates the prior stored value`, () => {
    const s = store(variant);
    const putCols = s.handle(admin, scope, req({ method: 'PUT', path: '/api/view-state', body: { key: 'keystone.cols.countries', value: ['code'] } }));
    assert.equal(putCols.status, 200);
    const badColsType = s.handle(admin, scope, req({ method: 'PUT', path: '/api/view-state', body: { key: 'keystone.cols.countries', value: 'code' } }));
    assert.equal(badColsType.status, 422);
    const badColsField = s.handle(admin, scope, req({ method: 'PUT', path: '/api/view-state', body: { key: 'keystone.cols.countries', value: ['not-a-field'] } }));
    assert.equal(badColsField.status, 422);
    const afterColsFailures = s.handle(admin, scope, req({ path: '/api/view-state', query: { key: 'keystone.cols.countries' } }));
    assert.deepEqual(afterColsFailures.body.value, ['code']);
    const resetCols = s.handle(admin, scope, req({ method: 'PUT', path: '/api/view-state', body: { key: 'keystone.cols.countries', value: null } }));
    assert.equal(resetCols.status, 200);
    assert.equal(resetCols.body.value, null);

    const validView = { name: 'My view', q: 'india', quick: 'Asia', filters: { region: 'Asia' } };
    const putViews = s.handle(admin, scope, req({ method: 'PUT', path: '/api/view-state', body: { key: 'keystone.views.countries', value: [validView] } }));
    assert.equal(putViews.status, 200);
    const missingName = s.handle(admin, scope, req({ method: 'PUT', path: '/api/view-state', body: { key: 'keystone.views.countries', value: [{ q: '', quick: null, filters: {} }] } }));
    assert.equal(missingName.status, 422);
    const unknownFilterKey = s.handle(admin, scope, req({ method: 'PUT', path: '/api/view-state', body: { key: 'keystone.views.countries', value: [{ name: 'X', q: '', quick: null, filters: { status: 'Active', notAField: 1 } }] } }));
    assert.equal(unknownFilterKey.status, 422);
    const afterViewsFailures = s.handle(admin, scope, req({ path: '/api/view-state', query: { key: 'keystone.views.countries' } }));
    assert.deepEqual(afterViewsFailures.body.value, [validView]);

    const putMode = s.handle(admin, scope, req({ method: 'PUT', path: '/api/view-state', body: { key: 'keystone.mode.customers', value: 'split' } }));
    assert.equal(putMode.status, 200);
    const badMode = s.handle(admin, scope, req({ method: 'PUT', path: '/api/view-state', body: { key: 'keystone.mode.customers', value: 'gallery' } }));
    assert.equal(badMode.status, 422);
    const afterModeFailure = s.handle(admin, scope, req({ path: '/api/view-state', query: { key: 'keystone.mode.customers' } }));
    assert.equal(afterModeFailure.body.value, 'split');
  });

  test(`[${variant}] entity support returns activities and documents, requires an existing row`, () => {
    const s = store(variant);
    const list = s.handle(admin, scope, req({ path: '/entities/customers', query: { size: '1' } }));
    const id = list.body.rows[0].id;
    const support = s.handle(admin, scope, req({ path: `/api/entities/customers/${id}/support` }));
    assert.equal(support.status, 200);
    assert.ok(support.body.activities.length > 0);
    assert.ok(support.body.activities.every((a) => a.when && a.who && a.text));
    assert.ok(support.body.documents.length > 0);
    assert.ok(support.body.documents.every((d) => d.name && d.size));

    const missing = s.handle(admin, scope, req({ path: '/api/entities/customers/no-such-id/support' }));
    assert.equal(missing.status, 404);

    const unknownEntity = s.handle(admin, scope, req({ path: '/api/entities/not-a-real-entity/1/support' }));
    assert.equal(unknownEntity.status, 404);
  });

  test(`[${variant}] processes run persists a row and returns deterministic events; rejects unknown process, bad params and denied roles`, () => {
    const s = store(variant);
    const before = s.handle(admin, scope, req({ path: '/entities/payroll-run', query: { size: '500' } }));
    const run = s.handle(admin, scope, req({
      method: 'POST', path: '/api/processes/payroll-run/run',
      body: { period: 'September 2026', branch: 'Head office', payDate: '2026-10-01', arrears: true },
    }));
    assert.equal(run.status, 200);
    assert.equal(run.body.row.period, 'September 2026');
    assert.equal(run.body.row.status, 'Completed');
    assert.ok(Array.isArray(run.body.events) && run.body.events.length > 0);
    assert.ok(run.body.events.every((e) => e.time && e.text && e.tone));
    const after = s.handle(admin, scope, req({ path: '/entities/payroll-run', query: { size: '500' } }));
    assert.equal(after.body.total, before.body.total + 1);

    const badOption = s.handle(admin, scope, req({ method: 'POST', path: '/api/processes/payroll-run/run', body: { period: 'Not a real period' } }));
    assert.equal(badOption.status, 422);

    const notAProcess = s.handle(admin, scope, req({ method: 'POST', path: '/api/processes/countries/run', body: {} }));
    assert.equal(notAProcess.status, 404);

    const unknownRoute = s.handle(admin, scope, req({ method: 'POST', path: '/api/processes/no-such-entity/run', body: {} }));
    assert.equal(unknownRoute.status, 404);

    const unknownRoleDenied = s.handle(unknown, scope, req({ method: 'POST', path: '/api/processes/payroll-run/run', body: {} }));
    assert.equal(unknownRoleDenied.status, 403);
  });

  test(`[${variant}] a run's events are persisted and replay identically through support on repeated GETs, scoped per branch; non-process support never carries processEvents`, () => {
    const s = store(variant);
    const run = s.handle(admin, scope, req({ method: 'POST', path: '/api/processes/payroll-run/run', body: { period: 'September 2026' } }));
    const rowId = run.body.row.id;

    const first = s.handle(admin, scope, req({ path: `/api/entities/payroll-run/${rowId}/support` }));
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.processEvents, run.body.events);
    assert.ok(first.body.processEvents.every((e) => typeof e.time === 'string' && typeof e.text === 'string' && typeof e.tone === 'string'));
    assert.ok(first.body.processEvents.filter((e) => e.step !== undefined).every((e) => e.step >= 0 && e.progress >= 0 && e.progress <= 100));

    const second = s.handle(admin, scope, req({ path: `/api/entities/payroll-run/${rowId}/support` }));
    assert.deepEqual(second.body.processEvents, first.body.processEvents);

    const otherBranchUser = { ...admin, branch: 'br-2' };
    const otherScope = { applicationId: 'app-1', branchId: 'br-2' };
    const otherBranch = s.handle(otherBranchUser, otherScope, req({ path: `/api/entities/payroll-run/${rowId}/support` }));
    assert.equal(otherBranch.status, 404);

    const nonProcess = s.handle(admin, scope, req({ path: '/entities/customers', query: { size: '1' } }));
    const support = s.handle(admin, scope, req({ path: `/api/entities/customers/${nonProcess.body.rows[0].id}/support` }));
    assert.equal('processEvents' in support.body, false);
  });

  test(`[${variant}] preseeded historical process rows carry a deterministic fixture history matching their own status`, () => {
    const s = store(variant);
    const list = s.handle(admin, scope, req({ path: '/entities/payroll-run', query: { size: '500' } }));
    for (const row of list.body.rows) {
      const support = s.handle(admin, scope, req({ path: `/api/entities/payroll-run/${row.id}/support` }));
      assert.ok(Array.isArray(support.body.processEvents) && support.body.processEvents.length > 0);
      const last = support.body.processEvents[support.body.processEvents.length - 1];
      assert.equal(last.tone, row.status === 'Failed' ? 'danger' : 'ok');
      const again = s.handle(admin, scope, req({ path: `/api/entities/payroll-run/${row.id}/support` }));
      assert.deepEqual(again.body.processEvents, support.body.processEvents);
    }
  });

  test(`[${variant}] GET /company-profile returns the scope's identity, never invented fields`, () => {
    const s = store(variant);
    const profile = s.handle(admin, scope, req({ path: '/api/company-profile' }));
    assert.equal(profile.status, 200);
    for (const key of ['company', 'address', 'taxId', 'email', 'bank', 'account', 'ifsc', 'swift', 'paymentTerms', 'invoiceTerms']) {
      assert.equal(typeof profile.body[key], 'string');
      assert.ok(profile.body[key].length > 0);
    }
  });
}

test('erp1 and erp2 both construct and expose the same 57-page catalogue', () => {
  const a = createReferenceErpStore({ variant: 'erp1' });
  const b = createReferenceErpStore({ variant: 'erp2' });
  assert.equal(a.pages.length, 57);
  assert.equal(b.pages.length, 57);
});

test('createReferenceErpStore requires a valid variant', () => {
  assert.throws(() => createReferenceErpStore({ variant: 'nope' }));
});
