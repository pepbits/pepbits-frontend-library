import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReferenceReportsStore, REFERENCE_REPORTS_ENDPOINTS } from './reference-reports-store.mjs';

const admin = { id: 'USR-00301', tenantId: 'NEX-AE-001', name: 'Prakash Mathew', email: 'prakash@nexora.example', role: 'enterprise-admin' };
const finance = { id: 'USR-00311', tenantId: 'NEX-AE-001', name: 'Aisha Rahman', email: 'aisha.rahman@nexora.example', role: 'finance-manager' };
const ops = { id: 'USR-00327', tenantId: 'NEX-AE-001', name: 'Omar Khan', email: 'omar.khan@nexora.example', role: 'operations-analyst' };
const scope = { applicationId: 'reports', branchId: 'dubai' };

function fixture(extra = {}) {
  let now = new Date('2026-09-28T06:00:00.000Z');
  const store = createReferenceReportsStore({ clock: () => now, jobStepMs: 0, ...extra });
  const call = (user, method, path, body, more = {}) => store.handle(user, more.scope ?? scope, { method, path, body, query: more.query, headers: more.headers });
  return { store, call, advance: (ms) => { now = new Date(now.getTime() + ms); } };
}

test('rejects missing identity or scope before touching data', () => {
  const { call, store } = fixture();
  assert.equal(store.handle(null, scope, { method: 'GET', path: '/api/session' }).status, 401);
  assert.equal(store.handle({ id: 'x' }, scope, { method: 'GET', path: '/api/session' }).status, 401);
  assert.equal(store.handle(admin, { applicationId: 'reports' }, { method: 'GET', path: '/api/session' }).status, 400);
  assert.equal(call(admin, 'GET', '/api/nope').status, 404);
  assert.equal(call(admin, 'PATCH', '/api/session').status, 405);
  assert.equal(call(admin, 'POST', '/api/auth/login', { email: 'a', password: 'b' }).body.code, 'HOST_AUTH');
});

test('every inventoried endpoint is routed (never 404/405 for its method)', () => {
  const { call } = fixture();
  for (const e of REFERENCE_REPORTS_ENDPOINTS) {
    const path = e.path.replace(':id', 'missing').replace(':token', 'x.y');
    const r = call(admin, e.method, path, {});
    assert.ok(![405].includes(r.status), `${e.method} ${e.path} -> ${r.status}`);
    if (r.status === 404) assert.notEqual(r.body.error, 'Not found.', `${e.method} ${e.path} is not routed`);
  }
});

test('host roles map to report roles; accepts module-prefixed paths', () => {
  const { call } = fixture();
  const s = call(finance, 'GET', '/reference-modules/reports/api/session');
  assert.equal(s.status, 200);
  assert.deepEqual(s.body.user.roleNames, ['Finance manager']);
  assert.ok(s.body.navigation.includes('/builder'));
  assert.ok(!s.body.navigation.includes('/admin/access'));
  assert.equal(call(finance, 'GET', '/api/page/admin/access').body.code, 'PAGE_DENIED');
  assert.equal(call(admin, 'GET', '/api/page/admin/access').status, 200);
});

test('partitions isolate tenant, application and branch; personal favorites stay per user', () => {
  const { call } = fixture();
  assert.equal(call(finance, 'POST', '/api/favorites', { reportId: 'payer-mix' }).body.favorite, true);
  const lib = (u, sc) => call(u, 'GET', '/api/page/reports', undefined, { scope: sc }).body.reports.find((r) => r.id === 'payer-mix');
  assert.equal(lib(finance, scope).favorite, true);
  assert.equal(lib(admin, scope).favorite, false);
  assert.equal(lib(finance, { applicationId: 'reports', branchId: 'sharjah' }).favorite, false);
  assert.equal(lib({ ...finance, tenantId: 'OTHER' }, scope).favorite, false);
});

test('report run: paging, totals, ASYNC_REQUIRED guard and masking with canUnmask', () => {
  const { call } = fixture();
  const r = call(finance, 'POST', '/api/reports/trial-balance/run', { filters: {}, page: 1, pageSize: 5 });
  assert.equal(r.status, 200);
  assert.equal(r.body.rows.length, 5);
  assert.equal(r.body.totals.balance, 0);
  const big = call(finance, 'POST', '/api/reports/revenue-transactions/run', { filters: { period: { preset: 'last_year' } } });
  assert.equal(big.status, 422);
  assert.equal(big.body.code, 'ASYNC_REQUIRED');
  assert.equal(call(finance, 'POST', '/api/reports/trial-balance/run', { pageSize: 2 }).status, 400);
  // Executive may view the admissions register but not unmask; admin unmasks.
  const exec = { id: 'EXEC', tenantId: 'NEX-AE-001', role: 'x' };
  const store2 = fixture({ roleMap: (u) => (u.id === 'EXEC' ? ['executive'] : ['admin']) });
  const masked = store2.call(exec, 'POST', '/api/reports/admissions-register/run', { pageSize: 5 });
  assert.deepEqual(masked.body.meta.maskedColumns, ['patient_mrn', 'patient_name']);
  assert.ok(masked.body.rows.every((row) => row.patient_name === '••••••'));
  const clear = store2.call(admin, 'POST', '/api/reports/admissions-register/run', { pageSize: 5 });
  assert.deepEqual(clear.body.meta.maskedColumns, []);
  // Operations role never gets the register.
  assert.equal(call(ops, 'POST', '/api/reports/admissions-register/run', {}).body.code, 'REPORT_DENIED');
});

test('exports return files, respect format actions and audit', () => {
  const { call } = fixture();
  const csv = call(finance, 'POST', '/api/reports/payer-mix/export', { format: 'csv' });
  assert.equal(csv.status, 200);
  assert.match(csv.headers['Content-Disposition'], /payer-mix-.*\.csv/);
  assert.ok(Buffer.isBuffer(csv.body) && csv.body.toString('utf8').includes('Payer'));
  const xlsx = call(finance, 'POST', '/api/reports/payer-mix/export', { format: 'xlsx' });
  assert.equal(xlsx.body.subarray(0, 2).toString(), 'PK');
  // Operations manager has no Finance access at all.
  assert.equal(call(ops, 'POST', '/api/reports/payer-mix/export', { format: 'csv' }).status, 403);
  const audit = call(admin, 'GET', '/api/page/admin/audit', undefined, { query: { action: 'report' } }).body.rows;
  assert.ok(audit.some((a) => a.action === 'report.export_csv'));
});

test('saved views: personal default, role views need admin.access, delete rules', () => {
  const { call } = fixture();
  const v = call(finance, 'POST', '/api/reports/payer-mix/views', { name: 'Mine', columns: ['payer', 'net_amount', 'bogus'], scope: 'user', isDefault: true });
  assert.equal(v.status, 201);
  assert.deepEqual(v.body.columns, ['payer', 'net_amount']);
  assert.equal(call(finance, 'POST', '/api/reports/payer-mix/views', { name: 'Role', columns: [], scope: 'role', roleId: 'accountant' }).status, 403);
  const page = call(finance, 'GET', '/api/page/reports/payer-mix').body;
  assert.equal(page.initialView.id, v.body.id);
  assert.equal(call(admin, 'DELETE', `/api/views/${v.body.id}`).status, 403);
  assert.equal(call(finance, 'DELETE', `/api/views/${v.body.id}`).status, 200);
});

test('background job transitions, stored result pages, download and cancel', () => {
  const stepped = createReferenceReportsStore({ clock: () => now, jobStepMs: 100 });
  let now = new Date('2026-09-28T06:00:00.000Z');
  const call = (m, p, b, q) => stepped.handle(finance, scope, { method: m, path: p, body: b, query: q });
  const job = call('POST', '/api/jobs', { reportId: 'revenue-transactions', filters: { period: { preset: 'last_quarter' } }, columns: [], format: 'csv', deliver: 'download' }).body;
  assert.equal(job.status, 'queued');
  assert.equal(job.filters.period.preset, 'custom');
  assert.equal(call('GET', `/api/jobs/${job.id}`).body.status, 'running');
  now = new Date(now.getTime() + 150);
  const mid = call('GET', `/api/jobs/${job.id}`).body;
  assert.equal(mid.chunksDone, 1);
  assert.equal(call('GET', `/api/jobs/${job.id}/results`).status, 409);
  now = new Date(now.getTime() + 1000);
  const done = call('GET', `/api/jobs/${job.id}`).body;
  assert.equal(done.status, 'completed');
  const page = call('GET', `/api/jobs/${job.id}/results`, undefined, { page: '2', pageSize: '50' }).body;
  assert.equal(page.rows.length, 50);
  assert.equal(page.total, done.rowCount);
  assert.equal(call('GET', `/api/jobs/${job.id}/download`).headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.equal(stepped.handle(ops, scope, { method: 'GET', path: `/api/jobs/${job.id}` }).status, 404);
  const second = call('POST', '/api/jobs', { reportId: 'payer-mix', filters: {}, format: 'csv', deliver: 'download' }).body;
  assert.equal(call('DELETE', `/api/jobs/${second.id}`).body.cancelRequested, true);
  now = new Date(now.getTime() + 500);
  assert.equal(call('GET', `/api/jobs/${second.id}`).body.status, 'cancelled');
  // Retention expiry
  now = new Date(now.getTime() + 73 * 3600_000);
  assert.equal(call('GET', `/api/jobs/${job.id}`).body.status, 'expired');
});

test('emailed jobs record outbox only; sensitive results go as a signed link that needs the right user', () => {
  const { call, store, advance } = fixture({ roleMap: (u) => (u.id === 'CLIN' ? ['clinical_manager'] : u.id === admin.id ? ['admin'] : ['analyst']) });
  const clin = { id: 'CLIN', tenantId: 'NEX-AE-001', email: 'clinical@lumen.health', name: 'Meera' };
  const job = call(clin, 'POST', '/api/jobs', { reportId: 'admissions-register', format: 'csv', deliver: 'email', recipients: [] }).body;
  const done = call(clin, 'GET', `/api/jobs/${job.id}`).body;
  assert.equal(done.status, 'completed');
  assert.match(done.deliveryNote, /^Email not sent: Demo store/);
  const mail = call(admin, 'GET', '/api/page/admin/outbox').body.mails.find((m) => m.jobId === job.id);
  assert.equal(mail.status, 'not_sent');
  const token = /\/api\/downloads\/(\S+)/.exec(mail.text)[1];
  assert.equal(call(clin, 'GET', `/api/downloads/${token}`).status, 200);
  assert.equal(call(finance, 'GET', `/api/downloads/${token}`).status, 403);
  assert.equal(call(clin, 'GET', `/api/downloads/${token}x`).status, 410);
  assert.equal(store.handle(clin, { applicationId: 'reports', branchId: 'other' }, { method: 'GET', path: `/api/downloads/${token}` }).status, 410);
  assert.equal(call(clin, 'POST', '/api/jobs', { reportId: 'admissions-register', format: 'csv', deliver: 'email', recipients: ['someone@evil.example'] }).status, 400);
  advance(73*3600_000);
  assert.equal(call(clin, 'GET', `/api/downloads/${token}`).status,410);
});

test('per-user active job limit returns TOO_MANY_JOBS', () => {
  const stepped = createReferenceReportsStore({ clock: () => new Date('2026-09-28T06:00:00Z'), jobStepMs: 1000 });
  const post = () => stepped.handle(finance, scope, { method: 'POST', path: '/api/jobs', body: { reportId: 'payer-mix', format: 'csv', deliver: 'download' } });
  post(); post(); post();
  const r = post();
  assert.equal(r.status, 429);
  assert.equal(r.body.code, 'TOO_MANY_JOBS');
});

test('schedules CRUD, run now, due processing and skip when access is lost', () => {
  const { call, advance } = fixture();
  const s = call(finance, 'POST', '/api/schedules', { name: 'Payer', reportId: 'payer-mix', format: 'xlsx', recipients: ['finance@lumen.health'], frequency: 'weekly', dayOfWeek: 3, hour: 8, timezone: 'Asia/Dubai' });
  assert.equal(s.status, 201);
  assert.ok(s.body.nextRunAt > '2026-09-28');
  assert.equal(call(finance, 'POST', '/api/schedules', { name: 'Bad', reportId: 'payer-mix', format: 'xlsx', recipients: ['a@lumen.health'], frequency: 'daily', hour: 8, timezone: 'Mars/Base' }).status, 400);
  assert.equal(call(finance, 'PATCH', `/api/schedules/${s.body.id}`, { active: false }).body.active, false);
  assert.equal(call(finance, 'POST', `/api/schedules/${s.body.id}/run`).status, 200);
  assert.equal(call(ops, 'POST', `/api/schedules/${s.body.id}/run`).status, 404);
  assert.equal(call(finance, 'POST', '/api/cron').status, 401);
  advance(2 * 86400_000);
  const tick = call(admin, 'POST', '/api/cron').body;
  assert.ok(tick.due >= 1);
  // Remove the finance role's schedule action on daily-revenue: the seeded schedule is skipped next time.
  const grants = call(admin, 'GET', '/api/page/admin/access').body.grants.filter((g) => g.roleId === 'finance_manager').map((g) => ({ reportId: g.reportId, actions: g.reportId === 'daily-revenue' ? ['view'] : g.actions }));
  assert.equal(call(admin, 'PUT', '/api/admin/grants', { roleId: 'finance_manager', grants }).status, 200);
  const seeded = call(admin, 'GET', '/api/schedules').body.find((x) => x.id === 'sch_daily_rev');
  assert.equal(call(admin, 'POST', `/api/schedules/${seeded.id}/run`).status, 409);
  assert.equal(call(finance, 'DELETE', `/api/schedules/${s.body.id}`).status, 200);
});

test('email-in simulation creates a job; unknown senders and failed auth are rejected', () => {
  const { call } = fixture();
  const ok = call(finance, 'POST', '/api/email-in/simulate', { subject: 'REPORT trial-balance PERIOD last_month FORMAT csv', authPass: true }).body;
  assert.equal(ok.status, 'accepted');
  assert.ok(ok.jobId);
  assert.equal(call(finance, 'POST', '/api/email-in/simulate', { subject: 'HELP', authPass: false }).body.status, 'rejected');
  assert.equal(call(admin, 'POST', '/api/email-in/simulate', { from: 'nobody@else.example', subject: 'HELP' }).body.reason, 'Sender is not an active registered user. No reply sent.');
  // Non-admins cannot spoof another sender.
  assert.equal(call(finance, 'POST', '/api/email-in/simulate', { from: 'admin@lumen.health', subject: 'HELP' }).body.from, 'aisha.rahman@nexora.example');
  assert.equal(call(finance, 'POST', '/api/inbound-email', { from: 'x', subject: 'HELP' }, { headers: {} }).status, 401);
});

test('API key secret is shown once and authorises BI pulls in the same partition only', () => {
  const { call, store } = fixture();
  const created = call(finance, 'POST', '/api/account/keys', { name: 'Power BI' });
  assert.equal(created.status, 201);
  assert.match(created.body.secret, /^lmn_/);
  const listed = call(finance, 'GET', '/api/account/keys').body;
  assert.equal(listed.length, 1);
  assert.equal(listed[0].hash, undefined);
  assert.equal(JSON.stringify(listed).includes(created.body.secret), false);
  const auth = { authorization: `Bearer ${created.body.secret}` };
  assert.equal(call(ops, 'GET', '/api/v1/reports', undefined, { headers: { authorization: 'Bearer host-session', 'x-reports-api-key': created.body.secret } }).status, 200);
  assert.ok(call(ops, 'GET', '/api/v1/reports', undefined, { headers: auth }).body.some((r) => r.id === 'trial-balance'));
  const csv = call(ops, 'GET', '/api/v1/reports/trial-balance', undefined, { headers: auth, query: { period: 'last_month', format: 'csv' } });
  assert.equal(csv.headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.equal(store.handle(finance, { applicationId: 'reports', branchId: 'x' }, { method: 'GET', path: '/api/v1/reports', headers: auth }).status, 401);
  assert.equal(call(ops, 'POST', '/api/account/keys', { name: 'Nope' }).status, 403);
  assert.equal(call(finance, 'DELETE', `/api/account/keys/${created.body.key.id}`).status, 200);
  assert.equal(call(ops, 'GET', '/api/v1/reports', undefined, { headers: auth }).status, 401);
});

test('authenticateApiKey trusts only the stored key: no client scope, current role, revoked/deactivated rejected', () => {
  const { call, store } = fixture();
  const created = call(finance, 'POST', '/api/account/keys', { name: 'BI tool' });
  const secret = created.body.secret;

  // A router with no bearer session yet can resolve trusted identity/scope from the secret alone.
  const auth = store.authenticateApiKey(secret);
  assert.deepEqual(auth, { user: { id: finance.id, tenantId: finance.tenantId, name: finance.name, email: finance.email }, scope });
  // The router forwards the same request (with its API-key header) into `handle`; the keyed route still
  // does its own key-sole-auth lookup, so the resolved identity/scope is not itself trusted as a bearer.
  const keyHeaders = { headers: { authorization: `Bearer ${secret}` } };
  const pulled = store.handle(auth.user, auth.scope, { method: 'GET', path: '/api/v1/reports', ...keyHeaders });
  assert.equal(pulled.status, 200);
  assert.ok(pulled.body.some((r) => r.id === 'trial-balance'));

  // Garbage, empty and well-formed-but-unknown secrets are all rejected without leaking which case applied.
  assert.equal(store.authenticateApiKey('not-a-key'), null);
  assert.equal(store.authenticateApiKey(''), null);
  assert.equal(store.authenticateApiKey(undefined), null);
  assert.equal(store.authenticateApiKey(`lmn_${'0'.repeat(48)}`), null);

  // A role change after key creation is reflected live (current directory grants), not cached at issue time.
  call(admin, 'PATCH', `/api/admin/users/${finance.id}`, { roleIds: ['analyst'] });
  const demoted = store.authenticateApiKey(secret);
  const demotedPull = store.handle(demoted.user, demoted.scope, { method: 'GET', path: '/api/v1/reports', ...keyHeaders });
  assert.equal(demotedPull.status, 200);
  assert.ok(!demotedPull.body.some((r) => r.id === 'trial-balance'), 'analyst role loses finance report access immediately');
  call(admin, 'PATCH', `/api/admin/users/${finance.id}`, { roleIds: ['finance_manager'] });

  // A deactivated owner's key is disallowed even though the key itself still exists.
  call(admin, 'PATCH', `/api/admin/users/${finance.id}`, { active: false });
  assert.equal(store.authenticateApiKey(secret), null);
  call(admin, 'PATCH', `/api/admin/users/${finance.id}`, { active: true });
  assert.ok(store.authenticateApiKey(secret));

  // A revoked (deleted) key is rejected even though the owner remains active.
  call(finance, 'DELETE', `/api/account/keys/${created.body.key.id}`);
  assert.equal(store.authenticateApiKey(secret), null);
});

test('unknown host role is denied at provision unless a roleMap hook authorizes it', () => {
  const { store } = fixture();
  const stranger = { id: 'USR-STRANGE', tenantId: 'NEX-AE-001', name: 'No Role', email: 'stranger@nexora.example', role: 'warehouse-clerk' };
  const denied = store.handle(stranger, scope, { method: 'GET', path: '/api/session' });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code, 'UNKNOWN_ROLE');

  // No role information at all keeps the least-privilege Analyst default (distinct from an actual unknown role).
  const noRole = { id: 'USR-NOROLE', tenantId: 'NEX-AE-001', name: 'Unspecified', email: 'unspecified@nexora.example' };
  const s = store.handle(noRole, scope, { method: 'GET', path: '/api/session' });
  assert.equal(s.status, 200);
  assert.deepEqual(s.body.user.roleNames, ['Analyst']);

  // A configured roleMap hook owns authorization for any role it recognizes, known or not.
  const mapped = createReferenceReportsStore({ clock: () => new Date('2026-09-28T06:00:00.000Z'), roleMap: () => ['admin'] });
  const allowed = mapped.handle(stranger, scope, { method: 'GET', path: '/api/session' });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.user.isAdmin, true);
});

test('an explicit empty or invalid roleMap does not grant the default analyst role', () => {
  for (const roleMap of [() => [], () => ['unknown-role']]) {
    const {call} = fixture({roleMap});
    assert.equal(call(finance, 'GET', '/api/session').status, 403);
  }
});

test('builder preview, create/update/delete custom report with sharing grants', () => {
  const { call } = fixture();
  const input = { title: 'Discount by payer', category: 'Finance', datasetId: 'revenue', groupBy: ['payer'], columns: [{ key: 'payer', label: 'Payer', type: 'string', field: 'payer' }, { key: 'discount', label: 'Discount', type: 'currency', field: 'discount', aggregate: 'sum' }, { key: 'pct', label: 'Pct', type: 'percent', expression: 'discount / 100' }], chart: { type: 'bar', x: 'payer', y: ['discount'] }, visibility: 'roles', sharedRoleIds: ['accountant'] };
  assert.equal(call(finance, 'POST', '/api/builder/preview', input).status, 200);
  const bad = call(finance, 'POST', '/api/builder/preview', { ...input, columns: [...input.columns, { key: 'x', label: 'X', type: 'percent', expression: 'nope * 2' }] });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /Unknown column/);
  const created = call(finance, 'POST', '/api/definitions', input);
  assert.equal(created.status, 201);
  const acc = { id: 'ACC', tenantId: 'NEX-AE-001' };
  const accStore = fixture({ roleMap: () => ['accountant'] });
  assert.equal(accStore.call(acc, 'POST', '/api/definitions', input).status, 403); // cannot share
  assert.equal(call(finance, 'PUT', `/api/definitions/${created.body.id}`, { ...input, title: 'Discount by payer v2' }).body.version, 2);
  assert.equal(call(ops, 'DELETE', `/api/definitions/${created.body.id}`).status, 403);
  assert.equal(call(finance, 'DELETE', `/api/definitions/${created.body.id}`).status, 200);
  assert.equal(call(finance, 'GET', `/api/page/reports/${created.body.id}`).status, 404);
});

test('dashboards: create, widget access validation, sharing rules, delete', () => {
  const { call } = fixture();
  const d = call(finance, 'POST', '/api/dashboards', { name: 'Mine' }).body;
  const save = (u, widgets, visibility = 'private') => call(u, 'PUT', `/api/dashboards/${d.id}`, { name: 'Mine', description: '', visibility, sharedRoleIds: [], dateRange: { preset: 'last_month' }, widgets });
  assert.equal(save(finance, [{ id: 'w1', reportId: 'payer-mix', title: 'Payer', kind: 'donut', size: 'md' }]).status, 200);
  assert.equal(save(finance, [{ id: 'w1', reportId: 'admissions-register', title: 'x', kind: 'table', size: 'md' }]).status, 400);
  assert.equal(save(ops, []).status, 403);
  assert.equal(call(ops, 'GET', `/api/page/dashboards/${d.id}`).status, 404);
  assert.equal(call(finance, 'DELETE', `/api/dashboards/${d.id}`).status, 200);
});

test('admin users, roles and settings validation', () => {
  const { call } = fixture();
  const u = call(admin, 'POST', '/api/admin/users', { name: 'New Person', email: 'new@lumen.health', roleIds: ['analyst'], branchIds: ['Kochi'], password: 'long-enough-1' });
  assert.equal(u.status, 201);
  assert.equal(u.body.passwordHash, undefined);
  assert.equal(call(admin, 'POST', '/api/admin/users', { name: 'Dup', email: 'NEW@lumen.health', roleIds: ['analyst'], branchIds: ['*'], password: 'long-enough-1' }).status, 409);
  const me = call(admin, 'GET', '/api/session').body.user.id;
  assert.equal(call(admin, 'PATCH', `/api/admin/users/${me}`, { active: false }).status, 400);
  const role = call(admin, 'PUT', '/api/admin/roles', { name: 'Revenue lead', permissions: ['reports.build'] });
  assert.equal(role.body.id, 'revenue_lead');
  assert.equal(call(admin, 'PUT', '/api/admin/roles', { id: 'admin', name: 'Admin', permissions: [] }).status, 400);
  assert.equal(call(admin, 'DELETE', '/api/admin/roles', undefined, { query: { id: 'analyst' } }).status, 409);
  assert.equal(call(admin, 'DELETE', '/api/admin/roles', undefined, { query: { id: 'revenue_lead' } }).status, 200);
  const settings = call(admin, 'GET', '/api/page/admin/settings').body.settings;
  assert.equal(call(admin, 'PUT', '/api/admin/settings', { ...settings, maxOnlineRangeDays: 3 }).status, 400);
  assert.equal(call(admin, 'PUT', '/api/admin/settings', { ...settings, maxOnlineRangeDays: 30 }).status, 200);
  assert.equal(call(finance, 'POST', '/api/reports/monthly-revenue-trend/run', {}).body.code, 'ASYNC_REQUIRED');
  assert.equal(call(finance, 'PUT', '/api/admin/settings', settings).status, 403);
  // Deactivating a host user blocks them at the boundary.
  call(finance, 'GET', '/api/session');
  assert.equal(call(admin, 'PATCH', `/api/admin/users/${finance.id}`, { active: false }).status, 200);
  assert.equal(call(finance, 'GET', '/api/session').body.code, 'INACTIVE');
});
