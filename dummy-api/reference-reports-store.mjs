/*
 * Reference Reports demo API (fictional, in-memory).
 *
 * Implements the Lumen Reports source API contract (src/app/api/**) plus page-loader endpoints that
 * replace the source's Next server components, for the @pepbits/reference-reports module.
 *
 * Trust model: `user` is the authenticated identity supplied by the dummy-api router; `scope` carries
 * the router-validated application and branch. Tenant and user identity come only from `user`. State is
 * partitioned per tenant/application/branch; personal records (favorites, personal views, API keys, jobs)
 * are additionally keyed by user inside that partition. Every read and write checks the source's role,
 * report-action, branch-scope and masking rules here, on the server side.
 *
 * Not claimed: no real email is sent (the outbox records every message as "not_sent"), no background
 * scheduler runs (schedules run on "Run now" or the administrator's "Process due schedules"), no database
 * or file is written, and job processing advances in request-driven steps rather than a worker process.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { BRANCHES, DATASETS, datasetStats, getDataset, ROWS_PER_DAY } from './reference-reports-data.mjs';
import {
  ACTIONS, PERMISSIONS, COMMON_TIMEZONES, HttpError, MIME, PRESETS, Validator, buildDefinition, clearResultCache, collectRows, computeNextRun,
  describeFilters, describeTiming, effectivePolicy, filterOptions, freezeFilters, guard, isIsoDate, isSensitive, monthChunks, parseDateRange,
  parseDefinitionInput, parseFilters, parseSort, project, resolveFilters, runReport, safeCell, selectColumns, shapeAll, slugify, sortRows,
  validTimeZone, writeExport,
} from './reference-reports-engine.mjs';
import FIXTURES from './reference-reports-fixtures.json' with { type: 'json' };

export const REPORTS_MODULE_PREFIX = '/reference-modules/reports';
const clone = (x) => structuredClone(x);
const LIMITS = { audit: 5000, outbox: 500, inbound: 500, jobs: 2000, occurrences: 3000 };
const SHARED_DEFAULT = ['view', 'print', 'export_csv', 'export_xlsx', 'email', 'schedule'];
const FORMAT_ACTION = { csv: 'export_csv', xlsx: 'export_xlsx', json: 'export_json' };
const DEMO_MAIL_NOTE = 'Demo store: email is never sent. The message is recorded in the outbox only.';

/** Host shell role -> Lumen role ids. A deployment passes its own `roleMap`. Unmapped users get the analyst role. */
export const DEFAULT_ROLE_MAP = {
  'enterprise-admin': ['admin'],
  'finance-manager': ['finance_manager'],
  'operations-analyst': ['operations_manager'],
};

/** Endpoint inventory. `source` is the Lumen route file the contract comes from; `loader` replaces a server page. */
export const REFERENCE_REPORTS_ENDPOINTS = [
  ['GET', '/api/session', 'src/app/(app)/layout.tsx', 'Shell context: user, roles, accessible reports, organisation'],
  ['GET', '/api/page/overview', 'src/app/(app)/page.tsx', 'Overview loader'],
  ['GET', '/api/page/login', 'src/app/login/page.tsx', 'Delegated sign-in boundary (organisation name only)'],
  ['GET', '/api/page/reports', 'src/app/(app)/reports/page.tsx', 'Report library loader'],
  ['GET', '/api/page/reports/:id', 'src/app/(app)/reports/[id]/page.tsx', 'Report viewer loader'],
  ['GET', '/api/page/builder', 'src/app/(app)/builder/page.tsx', 'Custom report list loader'],
  ['GET', '/api/page/builder/:id', 'src/app/(app)/builder/[id]/page.tsx', 'Builder loader (id "new" for a new report)'],
  ['GET', '/api/page/dashboards', 'src/app/(app)/dashboards/page.tsx', 'Dashboard list loader'],
  ['GET', '/api/page/dashboards/:id', 'src/app/(app)/dashboards/[id]/page.tsx', 'Dashboard loader'],
  ['GET', '/api/page/jobs', 'src/app/(app)/jobs/page.tsx', 'My reports loader'],
  ['GET', '/api/page/jobs/:id', 'src/app/(app)/jobs/[id]/page.tsx', 'Background result loader'],
  ['GET', '/api/page/schedules', 'src/app/(app)/schedules/page.tsx', 'Schedules loader'],
  ['GET', '/api/page/email-in', 'src/app/(app)/email-in/page.tsx', 'Email requests loader'],
  ['GET', '/api/page/api-keys', 'src/app/(app)/api-keys/page.tsx', 'API keys loader'],
  ['GET', '/api/page/admin/access', 'src/app/(app)/admin/access/page.tsx', 'Roles and access loader (admin.access)'],
  ['GET', '/api/page/admin/users', 'src/app/(app)/admin/users/page.tsx', 'Users loader (admin.users)'],
  ['GET', '/api/page/admin/settings', 'src/app/(app)/admin/settings/page.tsx', 'Settings loader (admin.settings)'],
  ['GET', '/api/page/admin/sources', 'src/app/(app)/admin/sources/page.tsx', 'Data sources loader (admin.sources)'],
  ['GET', '/api/page/admin/audit', 'src/app/(app)/admin/audit/page.tsx', 'Audit loader, ?q=&action= (audit.view)'],
  ['GET', '/api/page/admin/outbox', 'src/app/(app)/admin/outbox/page.tsx', 'Outbox loader (audit.view)'],
  ['GET', '/api/account/keys', 'src/app/api/account/keys/route.ts', 'List own API keys (no hashes)'],
  ['POST', '/api/account/keys', 'src/app/api/account/keys/route.ts', 'Create API key; secret returned once'],
  ['DELETE', '/api/account/keys/:id', 'src/app/api/account/keys/[id]/route.ts', 'Revoke API key'],
  ['PUT', '/api/admin/grants', 'src/app/api/admin/grants/route.ts', 'Replace report grants for a role'],
  ['PUT', '/api/admin/roles', 'src/app/api/admin/roles/route.ts', 'Create or update a role'],
  ['DELETE', '/api/admin/roles', 'src/app/api/admin/roles/route.ts', 'Delete a role, ?id='],
  ['PUT', '/api/admin/settings', 'src/app/api/admin/settings/route.ts', 'Replace settings'],
  ['GET', '/api/admin/users', 'src/app/api/admin/users/route.ts', 'List users'],
  ['POST', '/api/admin/users', 'src/app/api/admin/users/route.ts', 'Create user (directory record; no sign-in)'],
  ['PATCH', '/api/admin/users/:id', 'src/app/api/admin/users/[id]/route.ts', 'Update user roles, branches, activation'],
  ['POST', '/api/auth/login', 'src/app/api/auth/login/route.ts', 'Delegated to the host: 410 HOST_AUTH'],
  ['POST', '/api/auth/logout', 'src/app/api/auth/logout/route.ts', 'Delegated to the host: 410 HOST_AUTH'],
  ['POST', '/api/builder/preview', 'src/app/api/builder/preview/route.ts', 'Preview an unsaved definition (25 rows)'],
  ['POST', '/api/cron', 'src/app/api/cron/route.ts', 'Process due schedules (administrator)'],
  ['GET', '/api/dashboards', 'src/app/api/dashboards/route.ts', 'List visible dashboards'],
  ['POST', '/api/dashboards', 'src/app/api/dashboards/route.ts', 'Create dashboard'],
  ['PUT', '/api/dashboards/:id', 'src/app/api/dashboards/[id]/route.ts', 'Save dashboard and widgets'],
  ['DELETE', '/api/dashboards/:id', 'src/app/api/dashboards/[id]/route.ts', 'Delete dashboard'],
  ['POST', '/api/definitions', 'src/app/api/definitions/route.ts', 'Create custom report'],
  ['PUT', '/api/definitions/:id', 'src/app/api/definitions/[id]/route.ts', 'Update custom report'],
  ['DELETE', '/api/definitions/:id', 'src/app/api/definitions/[id]/route.ts', 'Delete custom report'],
  ['GET', '/api/downloads/:token', 'src/app/api/downloads/[token]/route.ts', 'Signed link download (owner, recipient or admin)'],
  ['POST', '/api/email-in/simulate', 'src/app/api/email-in/simulate/route.ts', 'Simulate an inbound email request'],
  ['POST', '/api/favorites', 'src/app/api/favorites/route.ts', 'Toggle favorite'],
  ['POST', '/api/inbound-email', 'src/app/api/inbound-email/route.ts', 'Inbound webhook; requires X-Inbound-Secret and a configured secret'],
  ['GET', '/api/jobs', 'src/app/api/jobs/route.ts', 'List jobs, ?all=1 (admin) &active=1'],
  ['POST', '/api/jobs', 'src/app/api/jobs/route.ts', 'Queue background report'],
  ['GET', '/api/jobs/:id', 'src/app/api/jobs/[id]/route.ts', 'Job status'],
  ['DELETE', '/api/jobs/:id', 'src/app/api/jobs/[id]/route.ts', 'Cancel job'],
  ['GET', '/api/jobs/:id/results', 'src/app/api/jobs/[id]/results/route.ts', 'Page through stored result'],
  ['GET', '/api/jobs/:id/download', 'src/app/api/jobs/[id]/download/route.ts', 'Download job file'],
  ['POST', '/api/reports/:id/run', 'src/app/api/reports/[id]/run/route.ts', 'Run report on screen'],
  ['POST', '/api/reports/:id/export', 'src/app/api/reports/[id]/export/route.ts', 'Export CSV/XLSX/JSON'],
  ['GET', '/api/reports/:id/views', 'src/app/api/reports/[id]/views/route.ts', 'List saved views'],
  ['POST', '/api/reports/:id/views', 'src/app/api/reports/[id]/views/route.ts', 'Save view'],
  ['PATCH', '/api/schedules/:id', 'src/app/api/schedules/[id]/route.ts', 'Pause, resume or edit schedule'],
  ['DELETE', '/api/schedules/:id', 'src/app/api/schedules/[id]/route.ts', 'Delete schedule'],
  ['POST', '/api/schedules/:id/run', 'src/app/api/schedules/[id]/run/route.ts', 'Run schedule now'],
  ['GET', '/api/schedules', 'src/app/api/schedules/route.ts', 'List schedules'],
  ['POST', '/api/schedules', 'src/app/api/schedules/route.ts', 'Create schedule'],
  ['GET', '/api/v1/reports', 'src/app/api/v1/reports/route.ts', 'BI catalogue; API key in X-Reports-Api-Key or Authorization: Bearer lmn_…'],
  ['GET', '/api/v1/reports/:id', 'src/app/api/v1/reports/[id]/route.ts', 'BI data pull (json or ?format=csv); API key'],
  ['DELETE', '/api/views/:id', 'src/app/api/views/[id]/route.ts', 'Delete saved view'],
].map(([method, path, source, purpose]) => ({ method, path, source, purpose }));

const NAV = [
  { href: '/', perm: undefined }, { href: '/reports' }, { href: '/dashboards' }, { href: '/builder', perm: 'reports.build' },
  { href: '/jobs' }, { href: '/schedules' }, { href: '/email-in' },
  { href: '/admin/access', perm: 'admin.access' }, { href: '/admin/users', perm: 'admin.users' }, { href: '/admin/sources', perm: 'admin.sources' },
  { href: '/admin/settings', perm: 'admin.settings' }, { href: '/admin/audit', perm: 'audit.view' }, { href: '/admin/outbox', perm: 'audit.view' },
  { href: '/api-keys', perm: 'api.keys' },
];

const ok = (body, status = 200) => ({ status, body });
const sha = (s) => createHash('sha256').update(s).digest('hex');
const isEmail = (s) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
function stripKey({ hash, ...k }) { return k; }

export function createReferenceReportsStore(options = {}) {
  const clock = options.clock ?? (() => new Date());
  const secret = options.secret ?? randomBytes(32);
  const jobStepMs = options.jobStepMs ?? 150;
  const partitions = new Map();
  const newId = (prefix) => `${prefix}_${randomBytes(6).toString('hex')}`;
  const nowIso = () => clock().toISOString();

  // -------------------------------------------------------------------------
  // Partition state

  function seed() {
    const now = clock();
    const createdAt = now.toISOString();
    const schedules = clone(FIXTURES.schedules).map((s) => ({ ...s, createdAt }));
    for (const s of schedules) s.nextRunAt = computeNextRun(s, now);
    return {
      roles: clone(FIXTURES.roles),
      users: clone(FIXTURES.users).map((u) => ({ ...u, createdAt, directoryOnly: true })),
      grants: clone(FIXTURES.grants),
      customReports: [], views: [], jobs: [], schedules, occurrences: [],
      dashboards: clone(FIXTURES.dashboards).map((d) => ({ ...d, updatedAt: createdAt })),
      settings: clone(FIXTURES.settings),
      audit: [], outbox: [], inbound: [], apiKeys: [], favorites: clone(FIXTURES.favorites),
      results: new Map(), work: new Map(), cache: new Map(),
    };
  }
  function partitionFor(user, scope) {
    const key = JSON.stringify([user.tenantId, scope.applicationId, scope.branchId]);
    let p = partitions.get(key);
    if (!p) { p = seed(); p.key = key; partitions.set(key, p); }
    return p;
  }
  function trim(P) {
    for (const [k, n] of Object.entries(LIMITS)) {
      if (P[k].length <= n) continue;
      const removed = P[k].splice(0, P[k].length - n);
      if (k === 'jobs') for (const j of removed) { P.results.delete(j.id); P.work.delete(j.id); }
    }
  }

  // -------------------------------------------------------------------------
  // Identity and access (ports of src/lib/auth.ts and src/lib/rbac.ts)

  /**
   * A configured `roleMap` owns its own authorization and may map any host role, including ones this store
   * does not otherwise recognise. Without one, a role the host actually sent but that is not in
   * `DEFAULT_ROLE_MAP` is denied explicitly rather than silently downgraded to Analyst; a host that sends no
   * role at all keeps the least-privilege Analyst default.
   */
  function mapRoles(P, user) {
    const known = new Set(P.roles.map((r) => r.id));
    if (options.roleMap) {
      const mapped = options.roleMap(user);
      const roles = (Array.isArray(mapped) ? mapped : []).filter((r) => known.has(r));
      if (!roles.length) throw new HttpError(403, 'No report role is authorized for this account.', 'NO_ROLE_MAPPING');
      return roles;
    }
    if (user.role != null && !Object.hasOwn(DEFAULT_ROLE_MAP, user.role)) {
      throw new HttpError(403, `Unknown host role "${user.role}". Configure a roleMap to authorize this role.`, 'UNKNOWN_ROLE');
    }
    const mapped = user.role != null ? DEFAULT_ROLE_MAP[user.role] : undefined;
    const roles = (mapped ?? []).filter((r) => known.has(r));
    return roles.length ? roles : ['analyst'];
  }
  function provision(P, user) {
    let u = P.users.find((x) => x.id === user.id);
    if (!u) {
      const email = typeof user.email === 'string' && isEmail(user.email) ? user.email.toLowerCase() : `${String(user.id).toLowerCase()}@host.invalid`;
      u = { id: user.id, name: String(user.name ?? user.id).slice(0, 80), email, roleIds: mapRoles(P, user), branchIds: ['*'], active: true, createdAt: nowIso(), lastLoginAt: nowIso(), hostAccount: true };
      P.users.push(u);
      audit(P, u, 'auth.host_session', u.email, `roles ${u.roleIds.join(', ')}`);
    }
    if (!u.active) throw new HttpError(403, 'Your access to reports has been deactivated by an administrator.', 'INACTIVE');
    return toPublic(P, u);
  }
  function toPublic(P, u) {
    const roles = P.roles.filter((r) => u.roleIds.includes(r.id));
    const permissions = [...new Set(roles.flatMap((r) => r.permissions))];
    const { passwordHash, ...rest } = u;
    return { ...rest, permissions, isAdmin: u.roleIds.includes('admin') };
  }
  const hasPerm = (u, p) => u.isAdmin || u.permissions.includes(p);
  const requirePerm = (u, p) => { if (!hasPerm(u, p)) throw new HttpError(403, 'Your role does not allow this action.'); };
  const requirePagePerm = (u, p) => { if (!hasPerm(u, p)) throw new HttpError(403, 'That page needs a permission your role does not have.', 'PAGE_DENIED'); };
  const allReports = (P) => [...FIXTURES.systemReports, ...P.customReports];
  const findReport = (P, id) => allReports(P).find((r) => r.id === id);
  function reportActions(P, u, r) {
    if (u.isAdmin) return [...ACTIONS];
    const set = new Set();
    if (r.kind === 'custom') {
      if (r.ownerId === u.id) SHARED_DEFAULT.forEach((a) => set.add(a));
      if (r.visibility === 'everyone') SHARED_DEFAULT.forEach((a) => set.add(a));
    }
    for (const g of P.grants) if (g.reportId === r.id && u.roleIds.includes(g.roleId)) g.actions.forEach((a) => set.add(a));
    return ACTIONS.filter((a) => set.has(a));
  }
  const can = (P, u, r, a) => reportActions(P, u, r).includes(a);
  function requireReport(P, u, id, action = 'view') {
    const r = findReport(P, id);
    if (!r) throw new HttpError(404, 'This report does not exist or was deleted.');
    if (!can(P, u, r, 'view')) throw new HttpError(403, 'You do not have access to this report.', 'REPORT_DENIED');
    if (action !== 'view' && !can(P, u, r, action)) throw new HttpError(403, `Your role cannot use "${action.replace('_', ' ')}" on this report.`);
    return r;
  }
  const accessibleReports = (P, u) => allReports(P).filter((r) => can(P, u, r, 'view'));
  const branchScope = (u) => (u.branchIds.includes('*') ? null : u.branchIds);
  const canUnmask = (u) => hasPerm(u, 'data.unmask');
  const canSeeDashboard = (u, d) => u.isAdmin || d.ownerId === u.id || d.visibility === 'everyone' || (d.visibility === 'roles' && d.sharedRoleIds.some((r) => u.roleIds.includes(r)));
  const canEditDashboard = (u, d) => u.isAdmin || (d.ownerId === u.id && hasPerm(u, 'dashboards.edit'));
  const ctxFor = (P, u) => ({ timezone: P.settings.timezone, branches: branchScope(u), unmask: canUnmask(u), cache: P.cache });
  const viewsFor = (P, u, reportId) => P.views.filter((v) => v.reportId === reportId && ((v.scope === 'user' && v.ownerId === u.id) || (v.scope === 'role' && !!v.roleId && u.roleIds.includes(v.roleId))));
  const defaultView = (P, u, reportId) => { const vs = viewsFor(P, u, reportId); return vs.find((v) => v.scope === 'user' && v.isDefault) ?? vs.find((v) => v.scope === 'role' && v.isDefault); };
  const roleNames = (P, u) => P.roles.filter((r) => u.roleIds.includes(r.id)).map((r) => r.name);

  function audit(P, u, action, target, detail) {
    P.audit.push({ id: newId('aud'), at: nowIso(), userId: u?.id, userEmail: u?.email, action, target, detail });
    trim(P);
  }
  function sendMail(P, m) {
    const msg = { id: newId('mail'), at: nowIso(), to: m.to, subject: m.subject, text: m.text, attachments: m.attachments ?? [], status: 'not_sent', error: DEMO_MAIL_NOTE, jobId: m.jobId };
    P.outbox.push(msg);
    trim(P);
    return msg;
  }

  // -------------------------------------------------------------------------
  // Signed download links (port of src/lib/links.ts). Tokens are bound to the partition.

  const b64 = (s) => Buffer.from(s).toString('base64url');
  function signLink(P, jobId, recipients, hours) {
    const body = b64(JSON.stringify({ jid: jobId, rcp: recipients.map((r) => r.toLowerCase()), p: sha(P.key).slice(0, 16), exp: Math.floor(clock().getTime() / 1000) + Math.max(1, hours) * 3600 }));
    return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
  }
  function readLink(P, token) {
    const [body, sig] = String(token).split('.');
    if (!body || !sig) return null;
    const expected = createHmac('sha256', secret).update(body).digest();
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
      const data = JSON.parse(Buffer.from(body, 'base64url').toString());
      if (data.p !== sha(P.key).slice(0, 16) || typeof data.exp !== 'number' || data.exp < clock().getTime() / 1000) return null;
      return data;
    } catch { return null; }
  }

  // -------------------------------------------------------------------------
  // Jobs (ports of src/lib/jobs/service.ts, worker.ts, resultStore.ts, scheduler.ts). Request-driven steps.

  function validateRecipients(P, user, recipients) {
    const s = P.settings;
    const clean = [...new Set(recipients.map((r) => r.trim().toLowerCase()).filter(Boolean))];
    if (clean.length > 20) throw new HttpError(400, 'Use at most 20 recipients.');
    const known = new Set(P.users.filter((u) => u.active).map((u) => u.email.toLowerCase()));
    for (const r of clean) {
      if (!isEmail(r)) throw new HttpError(400, `"${r}" is not a valid email address.`);
      const domain = r.split('@')[1];
      if (!known.has(r) && !s.allowedRecipientDomains.includes(domain) && !user.isAdmin) throw new HttpError(400, `${r} is outside the allowed domains (${s.allowedRecipientDomains.join(', ') || 'none'}). Ask an administrator to allow it.`);
    }
    return clean;
  }
  function enqueueJob(P, input) {
    const { user, def } = input;
    const s = P.settings;
    if (!can(P, user, def, FORMAT_ACTION[input.format])) throw new HttpError(403, `Your role cannot export this report as ${input.format.toUpperCase()}.`);
    if (input.deliver === 'email' && !can(P, user, def, input.origin === 'schedule' ? 'schedule' : 'email')) throw new HttpError(403, 'Your role cannot email this report.');
    const recipients = input.deliver === 'email' ? validateRecipients(P, user, input.recipients.length ? input.recipients : [user.email]) : [];
    if (input.origin !== 'schedule') {
      const active = P.jobs.filter((j) => j.userId === user.id && (j.status === 'queued' || j.status === 'running')).length;
      if (active >= s.maxActiveJobsPerUser) throw new HttpError(429, `You already have ${active} reports in progress. Wait for one to finish or cancel one in My reports.`, 'TOO_MANY_JOBS');
    }
    const job = {
      id: newId('job'), userId: user.id, reportId: def.id, reportTitle: def.title, filters: freezeFilters(def, input.filters, s.timezone),
      columns: input.columns, sort: input.sort, format: input.format, deliver: input.deliver, recipients, origin: input.origin, scheduleId: input.scheduleId,
      status: 'queued', progress: 0, chunksDone: 0, chunksTotal: 0, rowCount: 0, createdAt: nowIso(),
    };
    P.jobs.push(job);
    trim(P);
    audit(P, user, 'job.queued', def.id, `${input.format}, ${input.deliver}${recipients.length ? ` to ${recipients.join(', ')}` : ''}, origin ${input.origin}`);
    return job;
  }
  function setOccurrence(P, jobId, status, note) {
    const o = P.occurrences.find((x) => x.jobId === jobId);
    if (o) { o.status = status; o.note = note; }
    const j = P.jobs.find((x) => x.id === jobId);
    const s = j?.scheduleId ? P.schedules.find((x) => x.id === j.scheduleId) : undefined;
    if (s) s.lastStatus = note ? `${status}: ${note}` : status;
  }
  function failJob(P, job, owner, message) {
    Object.assign(job, { status: 'failed', error: message, finishedAt: nowIso() });
    P.work.delete(job.id);
    setOccurrence(P, job.id, 'failed', message);
    audit(P, owner, 'job.failed', job.reportId, message);
    if (owner && job.origin !== 'screen') sendMail(P, { to: [owner.email], subject: `Report failed: ${job.reportTitle}`, jobId: job.id, text: `The report "${job.reportTitle}" could not be produced.\nReason: ${message}\n` });
  }
  function startJob(P, job, now) {
    const ownerRec = P.users.find((u) => u.id === job.userId && u.active);
    const def = findReport(P, job.reportId);
    try {
      if (!ownerRec) throw new Error('The requesting user is no longer active.');
      const user = toPublic(P, ownerRec);
      if (!def || !can(P, user, def, 'view')) throw new Error('The requesting user no longer has access to this report.');
      const ctx = ctxFor(P, user);
      const rf = resolveFilters(def, job.filters, ctx);
      const chunks = monthChunks(rf.from, rf.to);
      const cols = selectColumns(def, job.columns);
      Object.assign(job, { status: 'running', startedAt: now.toISOString(), chunksTotal: chunks.length, chunksDone: 0, progress: 0 });
      P.work.set(job.id, { def, user, ctx, rf, chunks, cols, rawAll: [], rows: [], masked: [], columns: project(def, [], cols, ctx.unmask).columns, last: now.getTime() });
    } catch (e) {
      failJob(P, job, ownerRec ? toPublic(P, ownerRec) : null, e.message);
    }
  }
  function finishJob(P, job, w) {
    const { def, user, ctx, rf, cols } = w;
    const s = P.settings;
    if (def.groupBy.length > 0) {
      const p = project(def, sortRows(shapeAll(def, w.rawAll), job.sort ?? def.sort, def), cols, ctx.unmask);
      w.rows = p.rows; w.masked = p.masked; w.columns = p.columns;
    }
    const rowCount = w.rows.length;
    const file = writeExport(job.format, w.columns, w.rows, { title: def.title, generatedBy: user.email, generatedAt: nowIso(), period: `${rf.from} to ${rf.to}`, filters: describeFilters(job.filters), maskedColumns: w.masked, currency: s.currency });
    const expiresAt = new Date(clock().getTime() + s.resultRetentionHours * 3600_000).toISOString();
    P.results.set(job.id, { columns: w.columns, rows: w.rows, maskedColumns: w.masked, file, filename: `${job.reportId}-${job.id}.${job.format}` });
    let deliveryNote = 'Ready to download.';
    if (job.deliver === 'email' && job.recipients.length) {
      const hasSensitive = ctx.unmask && cols.some((c) => isSensitive(def, c));
      const tooBig = file.length > s.maxAttachmentMb * 1024 * 1024;
      const summary = `${def.title}\nPeriod: ${rf.from} to ${rf.to}\nRows: ${rowCount.toLocaleString()}\nRequested by: ${user.name} <${user.email}>`;
      let mail;
      if (hasSensitive || tooBig) {
        const link = `${REPORTS_MODULE_PREFIX}/api/downloads/${signLink(P, job.id, job.recipients, s.resultRetentionHours)}`;
        const why = hasSensitive ? 'it contains sensitive data' : `it is larger than ${s.maxAttachmentMb} MB`;
        mail = sendMail(P, { to: job.recipients, subject: `Report ready: ${def.title}`, jobId: job.id, text: `${summary}\n\nThe file is not attached because ${why}. Sign in to download it (link expires ${expiresAt}):\n${link}\n` });
      } else {
        mail = sendMail(P, { to: job.recipients, subject: `Report: ${def.title}`, jobId: job.id, text: `${summary}\n\nThe report is attached.\n`, attachments: [{ filename: `${def.id}-${rf.from}-to-${rf.to}.${job.format}`, bytes: file.length }] });
      }
      if (mail.status !== 'sent') deliveryNote = `Email not sent: ${mail.error ?? mail.status} The file is available in My reports.`;
    }
    Object.assign(job, { status: 'completed', progress: 100, rowCount, resultBytes: file.length, outputFile: `memory:${job.id}`, finishedAt: nowIso(), expiresAt, deliveryNote });
    P.work.delete(job.id);
    setOccurrence(P, job.id, 'completed', deliveryNote.startsWith('Email not sent') ? 'email not sent' : undefined);
    audit(P, user, 'job.completed', def.id, `${rowCount} rows, ${job.format}, origin ${job.origin}`);
  }
  function stepJob(P, job, w) {
    if (job.cancelRequested) {
      Object.assign(job, { status: 'cancelled', finishedAt: nowIso() });
      P.work.delete(job.id);
      return false;
    }
    const i = job.chunksDone;
    if (i < w.chunks.length) {
      const raw = collectRows(w.def, w.rf, w.chunks[i]);
      if (w.def.groupBy.length > 0) for (const r of raw) w.rawAll.push(r);
      else { const p = project(w.def, shapeAll(w.def, raw), w.cols, w.ctx.unmask); for (const r of p.rows) w.rows.push(r); w.masked = p.masked; }
      job.chunksDone = i + 1;
      job.progress = Math.round(((i + 1) / w.chunks.length) * 90);
    }
    if (job.chunksDone >= w.chunks.length) { finishJob(P, job, w); return false; }
    return true;
  }
  function expireResults(P) {
    const now = nowIso();
    const expired = P.jobs.filter((j) => j.status === 'completed' && j.expiresAt && j.expiresAt < now);
    for (const j of expired) { P.results.delete(j.id); j.status = 'expired'; j.outputFile = undefined; }
    return expired.length;
  }
  function pump(P) {
    const now = clock();
    expireResults(P);
    for (let guardLoop = 0; guardLoop < 100; guardLoop++) {
      const running = P.jobs.filter((j) => j.status === 'running');
      const busy = new Set(running.map((j) => j.userId));
      let started = false;
      if (running.length < P.settings.maxConcurrentJobs) {
        const next = P.jobs.filter((j) => j.status === 'queued' && !busy.has(j.userId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
        if (next) { startJob(P, next, now); started = true; }
      }
      let finished = false;
      for (const job of P.jobs.filter((j) => j.status === 'running')) {
        const w = P.work.get(job.id);
        if (!w) { failJob(P, job, null, 'The demo worker lost this job; run it again.'); finished = true; continue; }
        const steps = jobStepMs <= 0 ? Infinity : Math.floor((now.getTime() - w.last) / jobStepMs);
        for (let s = 0; s < steps; s++) {
          try { if (!stepJob(P, job, w)) { finished = true; break; } } catch (e) { failJob(P, job, w.user, e.message); finished = true; break; }
        }
        if (steps > 0 && steps !== Infinity) w.last += steps * jobStepMs;
      }
      if (!started && !finished) break;
    }
  }
  function cancelJob(P, user, jobId) {
    const job = P.jobs.find((j) => j.id === jobId);
    if (!job || (job.userId !== user.id && !user.isAdmin)) throw new HttpError(404, 'Job not found.');
    if (job.status !== 'queued' && job.status !== 'running') throw new HttpError(409, 'Only queued or running jobs can be cancelled.');
    if (job.status === 'queued') { job.status = 'cancelled'; job.finishedAt = nowIso(); } else job.cancelRequested = true;
    audit(P, user, 'job.cancel', job.reportId, job.id);
    return job;
  }
  function runOccurrence(P, s, scheduledAt) {
    const ownerRec = P.users.find((u) => u.id === s.ownerId && u.active);
    const def = findReport(P, s.reportId);
    const occ = { id: newId('occ'), scheduleId: s.id, scheduledAt, status: 'queued', createdAt: nowIso() };
    if (!ownerRec || !def || !can(P, toPublic(P, ownerRec), def, 'schedule')) {
      const note = !ownerRec ? 'owner inactive' : !def ? 'report deleted' : 'owner lost schedule permission';
      P.occurrences.push({ ...occ, status: 'skipped', note });
      s.lastStatus = `skipped: ${note}`;
      audit(P, null, 'schedule.skipped', s.id, note);
      return false;
    }
    try {
      const job = enqueueJob(P, { user: toPublic(P, ownerRec), def, filters: s.filters, columns: s.columns, format: s.format, deliver: 'email', recipients: s.recipients, origin: 'schedule', scheduleId: s.id });
      P.occurrences.push({ ...occ, jobId: job.id });
      s.lastStatus = 'queued';
      return true;
    } catch (e) {
      P.occurrences.push({ ...occ, status: 'failed', note: e.message });
      s.lastStatus = `failed: ${e.message}`;
      return false;
    } finally { trim(P); }
  }
  function runScheduler(P, limit = 25) {
    const now = clock();
    const iso = now.toISOString();
    const due = P.schedules.filter((s) => s.active && s.nextRunAt && s.nextRunAt <= iso).sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt)).slice(0, limit);
    let queued = 0;
    let skipped = 0;
    for (const s of due) {
      const scheduledAt = s.nextRunAt;
      if (!P.occurrences.some((o) => o.scheduleId === s.id && o.scheduledAt === scheduledAt)) { if (runOccurrence(P, s, scheduledAt)) queued++; else skipped++; }
      s.lastRunAt = scheduledAt;
      s.nextRunAt = computeNextRun(s, now);
      if (!s.nextRunAt) s.active = false;
    }
    const expired = expireResults(P);
    return { due: due.length, queued, skipped, expired };
  }

  // -------------------------------------------------------------------------
  // Email-in (port of src/lib/inbound.ts)

  const EMAIL_IN_HELP = `Commands (in the subject line):\n  HELP\n      Lists the reports you can request by email.\n  REPORT <report-id> [PERIOD <preset>] [FROM yyyy-mm-dd TO yyyy-mm-dd] [FORMAT csv|xlsx|json] [filter=value ...]\n\nExamples:\n  REPORT trial-balance PERIOD last_month FORMAT xlsx\n  REPORT revenue-transactions FROM 2019-01-01 TO 2024-12-31 FORMAT csv branch=Chennai\n  REPORT appointment-attendance PERIOD this_month department="General medicine,Cardiology"\n\nPresets: ${PRESETS.filter((p) => p !== 'custom').join(', ')}`;
  function handleInbound(P, p) {
    const s = P.settings;
    const address = (from) => { const m = from.match(/<([^>]+)>/); return (m ? m[1] : from).trim().toLowerCase(); };
    const tokens = (x) => (x.match(/[^\s"=]+="[^"]*"|"[^"]*"|\S+/g) ?? []).map((t) => t.replace(/"/g, ''));
    const from = address(p.from ?? '');
    const subject = (p.subject ?? '').trim().slice(0, 500);
    const log = (entry) => { const full = { id: newId('in'), at: nowIso(), from, subject, ...entry }; P.inbound.push(full); trim(P); return full; };
    if (!s.emailIn.enabled) return log({ status: 'rejected', reason: 'Email requests are turned off in settings.' });
    if (s.emailIn.requireAuthPass) {
      const a = p.auth ?? {};
      if (!(a.dmarc === 'pass' || (a.spf === 'pass' && a.dkim === 'pass'))) return log({ status: 'rejected', reason: 'Sender authentication failed (DMARC, or SPF and DKIM, must pass). No reply sent.' });
    }
    const userRec = P.users.find((u) => u.email.toLowerCase() === from && u.active);
    if (!userRec) return log({ status: 'rejected', reason: 'Sender is not an active registered user. No reply sent.' });
    const user = toPublic(P, userRec);
    const reply = (subj, text) => sendMail(P, { to: [user.email], subject: subj, text });
    const hourAgo = new Date(clock().getTime() - 3600_000).toISOString();
    const recent = P.inbound.filter((l) => l.userId === user.id && l.status === 'accepted' && l.at > hourAgo).length;
    if (recent >= s.emailIn.maxPerHour) {
      reply('Report request not processed', `You have reached the limit of ${s.emailIn.maxPerHour} email requests per hour. Try again later.`);
      return log({ status: 'rejected', reason: 'Hourly limit reached.', userId: user.id });
    }
    const command = subject || (p.text ?? '').split('\n')[0].trim();
    const t = tokens(command);
    const verb = (t[0] ?? '').toUpperCase();
    if (verb === 'HELP' || verb === 'LIST') {
      const list = accessibleReports(P, user).filter((r) => can(P, user, r, 'email')).map((r) => `  ${r.id.padEnd(28)} ${r.title}`).join('\n');
      reply('Reports you can request by email', `${list || '  (none: ask an administrator for email access)'}\n\n${EMAIL_IN_HELP}`);
      return log({ status: 'accepted', reason: 'Sent help and report list.', userId: user.id });
    }
    if (verb !== 'REPORT' || !t[1]) {
      reply('Report request not understood', `We could not read "${command}".\n\n${EMAIL_IN_HELP}`);
      return log({ status: 'rejected', reason: 'Command not recognised.', userId: user.id });
    }
    const def = findReport(P, t[1].toLowerCase());
    if (!def || !can(P, user, def, 'view') || !can(P, user, def, 'email')) {
      reply('Report request not processed', `Report "${t[1]}" does not exist or your role cannot receive it by email. Send HELP for the list.`);
      return log({ status: 'rejected', reason: `No email access to ${t[1]}.`, userId: user.id });
    }
    const filters = {};
    let format = 'xlsx';
    const dateFilter = def.filters.find((f) => f.type === 'daterange');
    const errors = [];
    for (let i = 2; i < t.length; i++) {
      const tok = t[i];
      const up = tok.toUpperCase();
      if (up === 'PERIOD' && t[i + 1]) {
        const preset = t[++i].toLowerCase();
        if (!PRESETS.includes(preset) || preset === 'custom') errors.push(`Unknown period "${preset}".`);
        else if (dateFilter) filters[dateFilter.key] = { preset };
      } else if (up === 'FROM' && t[i + 1]) {
        const from2 = t[++i];
        let to = from2;
        if (t[i + 1]?.toUpperCase() === 'TO' && t[i + 2]) { i += 2; to = t[i]; }
        if (!isIsoDate(from2) || !isIsoDate(to)) errors.push('Dates must look like 2025-01-31.');
        else if (dateFilter) filters[dateFilter.key] = { preset: 'custom', from: from2, to };
      } else if (up === 'FORMAT' && t[i + 1]) {
        const f = t[++i].toLowerCase();
        if (f === 'csv' || f === 'xlsx' || f === 'json') format = f;
        else errors.push(`Unknown format "${f}".`);
      } else if (tok.includes('=')) {
        const [k, ...rest] = tok.split('=');
        const fdef = def.filters.find((f) => f.key === k);
        if (!fdef) errors.push(`Unknown filter "${k}". This report accepts: ${def.filters.map((f) => f.key).join(', ')}.`);
        else filters[k] = fdef.type === 'multiselect' ? rest.join('=').split(',').map((x) => x.trim()) : rest.join('=');
      } else errors.push(`Did not understand "${tok}".`);
    }
    if (errors.length) {
      reply('Report request not processed', `${errors.join('\n')}\n\n${EMAIL_IN_HELP}`);
      return log({ status: 'rejected', reason: errors.join(' '), userId: user.id });
    }
    try {
      const job = enqueueJob(P, { user, def, filters, columns: def.defaultColumns, format, deliver: 'email', recipients: [user.email], origin: 'email_in' });
      reply(`Request received: ${def.title}`, `Your request is queued. The ${format.toUpperCase()} file will be emailed to you when it is ready.\nReference: ${job.id}`);
      audit(P, user, 'email_in.accepted', def.id, job.id);
      return log({ status: 'accepted', reason: 'Queued.', userId: user.id, jobId: job.id });
    } catch (e) {
      reply('Report request not processed', e.message);
      return log({ status: 'rejected', reason: e.message, userId: user.id });
    }
  }

  // -------------------------------------------------------------------------
  // API keys (port of src/lib/apikeys.ts)

  /** Accepts `X-Reports-Api-Key: lmn_…` (for routers whose Authorization header carries the host session) or `Authorization: Bearer lmn_…`. */
  function userFromApiKey(P, headers) {
    const direct = headers['x-reports-api-key'];
    const value = typeof direct === 'string' && direct ? `Bearer ${direct}` : typeof headers.authorization === 'string' ? headers.authorization : '';
    const token = value.startsWith('Bearer ') ? value.slice(7).trim() : null;
    if (!token?.startsWith('lmn_')) return null;
    const key = P.apiKeys.find((k) => k.hash === sha(token));
    if (!key) return null;
    const u = P.users.find((x) => x.id === key.userId && x.active);
    if (!u) return null;
    key.lastUsedAt = nowIso();
    return toPublic(P, u);
  }

  /**
   * Authenticates a raw BI API key secret across every tenant/application/branch partition and returns the
   * trusted `{ user, scope }` it was created under — never from client-supplied scope. For a root router
   * that has no bearer session yet: call this only for `/api/v1/...` paths, before normal session
   * resolution, and pass the result into `handle`. A revoked (deleted), disallowed (deactivated owner) or
   * unrecognised key returns null; the caller's role and permissions still come from the directory record
   * live at request time (via `provision`/`toPublic` inside `handle`), not a value cached here.
   */
  function authenticateApiKey(secret) {
    const token = typeof secret === 'string' ? secret.trim() : '';
    if (!token.startsWith('lmn_')) return null;
    const hash = sha(token);
    for (const P of partitions.values()) {
      const key = P.apiKeys.find((k) => k.hash === hash);
      if (!key) continue;
      const u = P.users.find((x) => x.id === key.userId);
      if (!u || !u.active) return null;
      key.lastUsedAt = nowIso();
      const [tenantId, applicationId, branchId] = JSON.parse(P.key);
      return { user: { id: u.id, tenantId, name: u.name, email: u.email }, scope: { applicationId, branchId } };
    }
    return null;
  }

  /** A configured inbound gateway is bound to a server-owned identity and partition. */
  function authenticateInboundSecret(given) {
    const configured = options.inboundSecret, identity = options.inboundIdentity;
    if (typeof configured !== 'string' || !configured || typeof given !== 'string' || !identity?.user?.id || !identity?.scope?.applicationId || !identity?.scope?.branchId) return null;
    const left = Buffer.from(given), right = Buffer.from(configured);
    return left.length === right.length && timingSafeEqual(left, right) ? clone(identity) : null;
  }

  // -------------------------------------------------------------------------
  // File responses

  function fileResponse(P, job) {
    const res = P.results.get(job.id);
    if (job.status !== 'completed' || !res) throw new HttpError(410, 'This file has expired or is not ready yet.');
    return { status: 200, headers: { 'Content-Type': MIME[job.format], 'Content-Disposition': `attachment; filename="${res.filename}"`, 'Cache-Control': 'no-store' }, body: res.file };
  }

  // -------------------------------------------------------------------------
  // Routes

  const routes = [];
  const route = (method, pattern, fn) => {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
    routes.push({ method, re, keys, fn });
  };
  const body = (req) => new Validator(req.body);
  const run = (req) => {
    const v = body(req);
    const out = {
      filters: v.custom('filters', parseFilters, { def: {} }),
      columns: v.strings('columns', { ...columnsLimit, optional: true }),
      sort: v.custom('sort', parseSort, { optional: true }),
      page: v.int('page', { min: 1, max: 100000, optional: true }),
      pageSize: v.int('pageSize', { min: 5, max: 500, optional: true }),
    };
    v.done();
    return out;
  };
  const columnsLimit = { max: 80, itemMax: 64 };

  // Session and page loaders ------------------------------------------------

  route('GET', '/api/session', (P, user) => ok({
    user: { id: user.id, name: user.name, email: user.email, roleNames: roleNames(P, user), branches: user.branchIds, permissions: user.permissions, isAdmin: user.isAdmin },
    reports: accessibleReports(P, user).map((r) => ({ id: r.id, title: r.title, category: r.category })),
    org: { name: P.settings.orgName, timezone: P.settings.timezone, locale: P.settings.locale, currency: P.settings.currency },
    navigation: NAV.filter((n) => !n.perm || hasPerm(user, n.perm)).map((n) => n.href),
    demo: { emailDelivery: 'outbox-only', scheduler: 'manual', storage: 'memory' },
  }));
  route('GET', '/api/page/login', (P) => ok({ orgName: P.settings.orgName, signIn: 'host' }));
  route('GET', '/api/page/overview', (P, user) => {
    const reports = accessibleReports(P, user);
    const byId = new Map(reports.map((r) => [r.id, r]));
    const favorites = P.favorites.filter((f) => f.userId === user.id).map((f) => byId.get(f.reportId)).filter(Boolean).map((r) => ({ id: r.id, title: r.title }));
    const recent = [];
    for (const a of [...P.audit].reverse()) {
      if (a.userId === user.id && a.action === 'report.run' && a.target && byId.has(a.target) && !recent.includes(a.target)) recent.push(a.target);
      if (recent.length >= 6) break;
    }
    const tz = validTimeZone(P.settings.timezone) ? P.settings.timezone : 'UTC';
    return ok({
      firstName: user.name.replace(/^Dr\. /, '').split(' ')[0],
      hour: Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: tz }).format(clock())) % 24,
      canBuild: hasPerm(user, 'reports.build'),
      recent: recent.map((id) => ({ id, title: byId.get(id).title, category: byId.get(id).category })),
      favorites,
      jobs: P.jobs.filter((j) => j.userId === user.id).slice(-5).reverse().map((j) => ({ id: j.id, reportTitle: j.reportTitle, createdAt: j.createdAt, status: j.status })),
      access: { roleNames: roleNames(P, user), reportCount: reports.length, branches: branchScope(user), unmask: canUnmask(user) },
      schedules: P.schedules.filter((x) => x.ownerId === user.id && x.active).sort((a, b) => (a.nextRunAt ?? '').localeCompare(b.nextRunAt ?? '')).slice(0, 4).map((x) => ({ id: x.id, name: x.name, timing: describeTiming(x), nextRunAt: x.nextRunAt, timezone: x.timezone })),
      timezone: P.settings.timezone,
    });
  });
  route('GET', '/api/page/reports', (P, user) => {
    const favs = new Set(P.favorites.filter((f) => f.userId === user.id).map((f) => f.reportId));
    const unmask = canUnmask(user);
    const reports = accessibleReports(P, user).map((r) => ({
      id: r.id, title: r.title, description: r.description, category: r.category, subcategory: r.subcategory, kind: r.kind, detail: r.groupBy.length === 0,
      tags: r.tags, favorite: favs.has(r.id), mine: r.ownerId === user.id, masked: !unmask && r.columns.some((c) => isSensitive(r, c)),
    }));
    const categories = [...FIXTURES.categories.map((c) => c.name), 'Custom'].filter((c) => reports.some((r) => r.category === c));
    return ok({ reports, categories });
  });
  route('GET', '/api/page/reports/:id', (P, user, req, { id }) => {
    const def = findReport(P, id);
    if (!def) throw new HttpError(404, 'This report does not exist or was deleted.', 'NOT_FOUND');
    if (!can(P, user, def, 'view')) throw new HttpError(403, 'You do not have access to that report. Ask an administrator if you need it.', 'REPORT_DENIED');
    const canRoleViews = hasPerm(user, 'admin.access');
    return ok({
      def, actions: reportActions(P, user, def), views: viewsFor(P, user, def.id), initialView: defaultView(P, user, def.id) ?? null,
      favorite: P.favorites.some((f) => f.userId === user.id && f.reportId === def.id), filterOptions: filterOptions(def, branchScope(user), clock()),
      sensitiveKeys: def.columns.filter((c) => isSensitive(def, c)).map((c) => c.key), unmask: canUnmask(user), policy: effectivePolicy(def, P.settings),
      rowsPerDay: ROWS_PER_DAY[def.datasetId] ?? 20, totalBranches: BRANCHES.length, scopedBranches: branchScope(user),
      settings: { timezone: P.settings.timezone, pageSize: P.settings.defaultPageSize },
      roles: (canRoleViews ? P.roles : P.roles.filter((r) => user.roleIds.includes(r.id))).map((r) => ({ id: r.id, name: r.name })),
      canRoleViews, userEmail: user.email, userId: user.id, today: resolveTodayRange(P),
    });
  });
  const resolveTodayRange = (P) => ({ timezone: P.settings.timezone, now: nowIso() });
  route('GET', '/api/page/builder', (P, user) => {
    requirePagePerm(user, 'reports.build');
    const owners = new Map(P.users.map((u) => [u.id, u.name]));
    const vis = { private: 'Only me', roles: 'Selected roles', everyone: 'Everyone' };
    return ok({
      isAdmin: user.isAdmin,
      reports: P.customReports.filter((r) => user.isAdmin || r.ownerId === user.id).map((r) => ({
        id: r.id, title: r.title, category: r.category, subcategory: r.subcategory, version: r.version, datasetName: getDataset(r.datasetId)?.name ?? r.datasetId,
        visibility: r.visibility, visibilityLabel: vis[r.visibility], sharedRoleNames: r.sharedRoleIds.map((rid) => P.roles.find((x) => x.id === rid)?.name ?? rid),
        ownerName: owners.get(r.ownerId ?? '') ?? null, updatedAt: r.updatedAt,
      })),
    });
  });
  route('GET', '/api/page/builder/:id', (P, user, req, { id }) => {
    requirePagePerm(user, 'reports.build');
    const existing = id === 'new' ? undefined : P.customReports.find((r) => r.id === id);
    if (id !== 'new' && !existing) throw new HttpError(404, 'Custom report not found.', 'NOT_FOUND');
    if (existing && existing.ownerId !== user.id && !user.isAdmin) throw new HttpError(403, 'Only the owner can change this report.', 'BUILDER_REDIRECT');
    return ok({ datasets: DATASETS, categories: [...FIXTURES.categories.map((c) => c.name), 'Custom'], roles: P.roles.map((r) => ({ id: r.id, name: r.name })), canShare: hasPerm(user, 'reports.share'), isAdmin: user.isAdmin, existing: existing ?? null });
  });
  route('GET', '/api/page/dashboards', (P, user) => {
    const owners = new Map(P.users.map((u) => [u.id, u.name]));
    return ok({ canCreate: hasPerm(user, 'dashboards.edit'), dashboards: P.dashboards.filter((x) => canSeeDashboard(user, x)).map((x) => ({ id: x.id, name: x.name, description: x.description, visibility: x.visibility, widgetCount: x.widgets.length, ownerName: owners.get(x.ownerId) ?? 'unknown' })) });
  });
  route('GET', '/api/page/dashboards/:id', (P, user, req, { id }) => {
    const dash = P.dashboards.find((x) => x.id === id);
    if (!dash || !canSeeDashboard(user, dash)) throw new HttpError(404, 'This page does not exist or you cannot open it.', 'NOT_FOUND');
    return ok({
      dashboard: dash,
      reports: accessibleReports(P, user).map((r) => ({ id: r.id, title: r.title, dateKey: r.filters.find((f) => f.type === 'daterange')?.key ?? 'period', hasChart: r.chart.type !== 'none', columns: r.columns.map((c) => ({ key: c.key, label: c.label, type: c.type })) })),
      canEdit: canEditDashboard(user, dash), canShare: hasPerm(user, 'reports.share'), roles: P.roles.map((r) => ({ id: r.id, name: r.name })),
    });
  });
  route('GET', '/api/page/jobs', (P, user) => ok({ jobs: P.jobs.filter((j) => j.userId === user.id).reverse(), isAdmin: user.isAdmin, userId: user.id, retentionHours: P.settings.resultRetentionHours, maxActiveJobsPerUser: P.settings.maxActiveJobsPerUser, timezone: P.settings.timezone }));
  route('GET', '/api/page/jobs/:id', (P, user, req, { id }) => {
    const job = P.jobs.find((j) => j.id === id && (j.userId === user.id || user.isAdmin));
    if (!job) throw new HttpError(404, 'Job not found.', 'NOT_FOUND');
    return ok({ job, filtersText: describeFilters(job.filters), timezone: P.settings.timezone });
  });
  route('GET', '/api/page/schedules', (P, user) => {
    const all = hasPerm(user, 'schedules.manage_all');
    const schedules = P.schedules.filter((s) => all || s.ownerId === user.id);
    return ok({
      schedules, occurrences: P.occurrences.filter((o) => schedules.some((s) => s.id === o.scheduleId)),
      reports: accessibleReports(P, user).map((def) => ({ def, actions: reportActions(P, user, def) })).filter((r) => r.actions.includes('schedule')),
      owners: Object.fromEntries(P.users.map((u) => [u.id, u.name])), isAdmin: user.isAdmin, userEmail: user.email, userId: user.id, timezone: P.settings.timezone,
      timezones: COMMON_TIMEZONES,
      cronHint: 'This demo has no background scheduler. Due schedules run when an administrator chooses Process due schedules now, or with Run now.',
    });
  });
  route('GET', '/api/page/email-in', (P, user) => {
    const emailable = accessibleReports(P, user).filter((r) => can(P, user, r, 'email'));
    return ok({
      help: EMAIL_IN_HELP, mailbox: P.settings.emailIn.mailbox, enabled: P.settings.emailIn.enabled,
      logs: P.inbound.filter((l) => user.isAdmin || l.userId === user.id).slice(-100).reverse(), isAdmin: user.isAdmin, userEmail: user.email,
      examples: ['HELP', ...emailable.slice(0, 2).map((r, i) => (i === 0 ? `REPORT ${r.id} PERIOD last_month FORMAT xlsx` : `REPORT ${r.id} FROM 2018-01-01 TO 2025-12-31 FORMAT csv`))],
    });
  });
  route('GET', '/api/page/api-keys', (P, user) => ok({
    keys: P.apiKeys.filter((k) => k.userId === user.id).map(stripKey), canCreate: hasPerm(user, 'api.keys'), baseUrl: REPORTS_MODULE_PREFIX,
    apiReports: accessibleReports(P, user).filter((r) => can(P, user, r, 'api')).map((r) => ({ id: r.id, title: r.title })),
  }));
  route('GET', '/api/page/admin/access', (P, user) => {
    requirePagePerm(user, 'admin.access');
    const userCounts = {};
    for (const u of P.users) for (const r of u.roleIds) userCounts[r] = (userCounts[r] ?? 0) + 1;
    return ok({ roles: P.roles, grants: P.grants, userCounts, reports: allReports(P).map((r) => ({ id: r.id, title: r.title, category: r.category, kind: r.kind, sensitive: r.columns.some((c) => isSensitive(r, c)) })), actions: ACTIONS, permissions: PERMISSIONS, actionLabels: FIXTURES.actionLabels, permissionLabels: FIXTURES.permissionLabels });
  });
  route('GET', '/api/page/admin/users', (P, user) => {
    requirePagePerm(user, 'admin.users');
    return ok({ users: P.users.map((u) => toPublic(P, u)), roles: P.roles.map((r) => ({ id: r.id, name: r.name })), branches: [...BRANCHES], selfId: user.id });
  });
  route('GET', '/api/page/admin/settings', (P, user) => {
    requirePagePerm(user, 'admin.settings');
    const overrides = allReports(P).filter((r) => r.policy && (r.policy.maxOnlineRangeDays || r.policy.maxOnlineRows)).map((r) => ({ id: r.id, title: r.title, maxOnlineRangeDays: r.policy?.maxOnlineRangeDays ?? P.settings.maxOnlineRangeDays, maxOnlineRows: r.policy?.maxOnlineRows ?? P.settings.maxOnlineRows }));
    return ok({ settings: P.settings, smtp: false, overrides, timezones: COMMON_TIMEZONES });
  });
  route('GET', '/api/page/admin/sources', (P, user) => {
    requirePagePerm(user, 'admin.sources');
    const stats = datasetStats();
    return ok({ sources: FIXTURES.sources.map((s) => ({ ...s, datasets: DATASETS.filter((d) => d.sourceId === s.id).map((d) => { const st = stats.find((x) => x.id === d.id); return { id: d.id, name: d.name, domain: d.domain, fields: d.fields.length, rows: st?.rows ?? null, generatedAt: st?.generatedAt ?? null }; }) })) });
  });
  route('GET', '/api/page/admin/audit', (P, user, req) => {
    requirePagePerm(user, 'audit.view');
    const q = String(req.query.get('q') ?? '').slice(0, 200);
    const action = String(req.query.get('action') ?? '').slice(0, 60);
    const needle = q.toLowerCase();
    return ok({ q, action, actions: [...new Set(P.audit.map((a) => a.action.split('.')[0]))].sort(), rows: [...P.audit].reverse().filter((a) => (!action || a.action.startsWith(`${action}.`)) && (!needle || `${a.userEmail} ${a.action} ${a.target} ${a.detail}`.toLowerCase().includes(needle))).slice(0, 500) });
  });
  route('GET', '/api/page/admin/outbox', (P, user) => {
    requirePagePerm(user, 'audit.view');
    return ok({ smtp: false, mails: [...P.outbox].reverse().slice(0, 200) });
  });

  // Source API ----------------------------------------------------------------

  route('POST', '/api/auth/login', () => { throw new HttpError(410, 'Sign-in is handled by the host application.', 'HOST_AUTH'); });
  route('POST', '/api/auth/logout', () => { throw new HttpError(410, 'Sign-out is handled by the host application.', 'HOST_AUTH'); });

  route('GET', '/api/account/keys', (P, user) => ok(P.apiKeys.filter((k) => k.userId === user.id).map(stripKey)));
  route('POST', '/api/account/keys', (P, user, req) => {
    requirePerm(user, 'api.keys');
    const v = body(req);
    const name = v.str('name', { trim: true, min: 2, max: 60 });
    v.done();
    const token = `lmn_${randomBytes(24).toString('hex')}`;
    const key = { id: newId('key'), userId: user.id, name, prefix: token.slice(0, 12), hash: sha(token), createdAt: nowIso() };
    P.apiKeys.push(key);
    audit(P, user, 'apikey.create', key.prefix, name);
    return ok({ key: stripKey(key), secret: token }, 201);
  });
  route('DELETE', '/api/account/keys/:id', (P, user, req, { id }) => {
    const key = P.apiKeys.find((k) => k.id === id && (k.userId === user.id || user.isAdmin));
    if (!key) throw new HttpError(404, 'Key not found.');
    P.apiKeys = P.apiKeys.filter((k) => k.id !== id);
    audit(P, user, 'apikey.revoke', key.prefix);
    return ok({ ok: true });
  });

  route('PUT', '/api/admin/grants', (P, user, req) => {
    requirePerm(user, 'admin.access');
    const v = body(req);
    const roleId = v.str('roleId', { max: 40 });
    const grants = v.custom('grants', (g) => {
      if (!Array.isArray(g) || g.length > 500) throw new Error('Invalid grants');
      return g.map((x) => {
        if (!x || typeof x.reportId !== 'string' || x.reportId.length > 80 || !Array.isArray(x.actions) || x.actions.length > 8 || x.actions.some((a) => !ACTIONS.includes(a))) throw new Error('Invalid grant');
        return { reportId: x.reportId, actions: x.actions };
      });
    });
    v.done();
    if (!P.roles.some((r) => r.id === roleId)) throw new HttpError(404, 'Role not found.');
    if (roleId === 'admin') throw new HttpError(400, 'Administrators always have every action.');
    const known = new Set(allReports(P).map((r) => r.id));
    const clean = grants.filter((g) => known.has(g.reportId) && g.actions.length).map((g) => ({ roleId, reportId: g.reportId, actions: g.actions.includes('view') ? [...new Set(g.actions)] : [] })).filter((g) => g.actions.length);
    const before = P.grants.filter((g) => g.roleId === roleId).length;
    P.grants = [...P.grants.filter((g) => g.roleId !== roleId), ...clean];
    clearResultCache(P.cache);
    audit(P, user, 'grants.update', roleId, `${before} → ${clean.length} reports`);
    return ok({ roleId, count: clean.length });
  });
  route('PUT', '/api/admin/roles', (P, user, req) => {
    requirePerm(user, 'admin.access');
    const v = body(req);
    const b = { id: v.str('id', { max: 40, optional: true }), name: v.str('name', { trim: true, min: 2, max: 60 }), description: v.str('description', { max: 200, def: '' }), permissions: v.strings('permissions', { max: 20, of: PERMISSIONS }) };
    v.done();
    const existing = b.id ? P.roles.find((r) => r.id === b.id) : undefined;
    if (existing?.system) throw new HttpError(400, 'The Administrator role always has every permission.');
    const role = existing ?? { id: slugify(b.name).replace(/-/g, '_'), name: b.name, description: '', permissions: [] };
    if (!existing && (!role.id || P.roles.some((r) => r.id === role.id))) throw new HttpError(409, 'A role with this name already exists.');
    Object.assign(role, { name: b.name, description: b.description, permissions: b.permissions });
    if (!existing) P.roles.push(role);
    audit(P, user, existing ? 'role.update' : 'role.create', role.id, b.permissions.join(', '));
    return ok(role);
  });
  route('DELETE', '/api/admin/roles', (P, user, req) => {
    requirePerm(user, 'admin.access');
    const id = String(req.query.get('id') ?? '');
    const role = P.roles.find((r) => r.id === id);
    if (!role) throw new HttpError(404, 'Role not found.');
    if (role.system) throw new HttpError(400, 'System roles cannot be deleted.');
    if (P.users.some((u) => u.roleIds.includes(id))) throw new HttpError(409, 'Remove this role from all users first.');
    P.roles = P.roles.filter((r) => r.id !== id);
    P.grants = P.grants.filter((g) => g.roleId !== id);
    P.views = P.views.filter((x) => x.roleId !== id);
    audit(P, user, 'role.delete', id);
    return ok({ ok: true });
  });
  route('PUT', '/api/admin/settings', (P, user, req) => {
    requirePerm(user, 'admin.settings');
    const v = body(req);
    const next = {
      orgName: v.str('orgName', { trim: true, min: 2, max: 80 }),
      timezone: v.custom('timezone', (tz) => { if (typeof tz !== 'string' || tz.length > 64 || !validTimeZone(tz)) throw new Error('Unknown time zone'); return tz; }),
      locale: v.str('locale', { max: 20 }),
      currency: v.str('currency', { min: 3, max: 3 }),
      maxOnlineRangeDays: v.int('maxOnlineRangeDays', { min: 7, max: 4000 }),
      maxOnlineRows: v.int('maxOnlineRows', { min: 100, max: 500000 }),
      defaultPageSize: v.int('defaultPageSize', { min: 10, max: 500 }),
      maxAttachmentMb: v.int('maxAttachmentMb', { min: 1, max: 50, number: true }),
      resultRetentionHours: v.int('resultRetentionHours', { min: 1, max: 720 }),
      maxActiveJobsPerUser: v.int('maxActiveJobsPerUser', { min: 1, max: 20 }),
      maxConcurrentJobs: v.int('maxConcurrentJobs', { min: 1, max: 16 }),
      allowedRecipientDomains: v.custom('allowedRecipientDomains', (d) => {
        if (!Array.isArray(d) || d.length > 20) throw new Error('Use at most 20 domains');
        return d.map((x) => { const s = String(x).trim().toLowerCase(); if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) throw new Error(`"${x}" is not a domain`); return s; });
      }),
      apiMaxRows: v.int('apiMaxRows', { min: 100, max: 100000 }),
      emailIn: v.custom('emailIn', (e) => {
        const ev = new Validator(e);
        const out = { enabled: ev.bool('enabled'), mailbox: ev.str('mailbox', { max: 200, pattern: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/, patternMessage: 'Invalid email' }), requireAuthPass: ev.bool('requireAuthPass'), maxPerHour: ev.int('maxPerHour', { min: 1, max: 200 }) };
        if (Object.keys(ev.errors).length) throw new Error(Object.entries(ev.errors).map(([k, m]) => `${k}: ${m[0]}`).join('; '));
        return out;
      }),
    };
    v.done();
    const changed = Object.keys(next).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(P.settings[k]));
    P.settings = next;
    clearResultCache(P.cache);
    audit(P, user, 'settings.update', undefined, changed.join(', ') || 'no changes');
    return ok(next);
  });
  route('GET', '/api/admin/users', (P, user) => { requirePerm(user, 'admin.users'); return ok(P.users.map((u) => toPublic(P, u))); });
  route('POST', '/api/admin/users', (P, user, req) => {
    requirePerm(user, 'admin.users');
    const v = body(req);
    const b = {
      name: v.str('name', { trim: true, min: 2, max: 80 }), roleIds: v.strings('roleIds', { min: 1, max: 10 }), branchIds: v.strings('branchIds', { min: 1, max: 20 }),
      email: v.str('email', { max: 200, pattern: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/, patternMessage: 'Invalid email' }), password: v.str('password', { min: 10, max: 200 }),
    };
    v.done();
    const email = b.email.toLowerCase();
    if (P.users.some((u) => u.email.toLowerCase() === email)) throw new HttpError(409, 'A user with this email already exists.');
    const roles = new Set(P.roles.map((r) => r.id));
    if (b.roleIds.some((r) => !roles.has(r))) throw new HttpError(400, 'Unknown role.');
    if (b.roleIds.includes('admin') && !user.isAdmin) throw new HttpError(403, 'Only administrators can grant the administrator role.');
    if (b.branchIds.some((x) => x !== '*' && !BRANCHES.includes(x))) throw new HttpError(400, 'Unknown branch.');
    // The password is validated for source parity but never stored: sign-in belongs to the host.
    const u = { id: newId('u'), name: b.name, email, roleIds: b.roleIds, branchIds: b.branchIds, active: true, createdAt: nowIso(), directoryOnly: true };
    P.users.push(u);
    audit(P, user, 'user.create', email, `roles ${u.roleIds.join(', ')}; branches ${u.branchIds.join(', ')}`);
    return ok(toPublic(P, u), 201);
  });
  route('PATCH', '/api/admin/users/:id', (P, user, req, { id }) => {
    requirePerm(user, 'admin.users');
    const v = body(req);
    const b = {
      name: v.str('name', { trim: true, min: 2, max: 80, optional: true }), roleIds: v.strings('roleIds', { min: 1, max: 10, optional: true }), branchIds: v.strings('branchIds', { min: 1, max: 20, optional: true }),
      active: v.bool('active', { optional: true }), password: v.str('password', { min: 10, max: 200, optional: true }),
    };
    v.done();
    const target = P.users.find((u) => u.id === id);
    if (!target) throw new HttpError(404, 'User not found.');
    if (target.id === user.id && (b.active === false || (b.roleIds && !b.roleIds.includes('admin') && user.isAdmin))) throw new HttpError(400, 'You cannot deactivate yourself or remove your own administrator role.');
    if (b.roleIds) {
      const roles = new Set(P.roles.map((r) => r.id));
      if (b.roleIds.some((r) => !roles.has(r))) throw new HttpError(400, 'Unknown role.');
      if (b.roleIds.includes('admin') && !user.isAdmin) throw new HttpError(403, 'Only administrators can grant the administrator role.');
    }
    if (b.branchIds?.some((x) => x !== '*' && !BRANCHES.includes(x))) throw new HttpError(400, 'Unknown branch.');
    for (const k of ['name', 'roleIds', 'branchIds', 'active']) if (b[k] !== undefined) target[k] = b[k];
    clearResultCache(P.cache);
    audit(P, user, 'user.update', target.email, Object.keys(req.body ?? {}).filter((k) => b[k] !== undefined).map((k) => (k === 'password' ? 'password reset (not stored: host sign-in)' : k)).join(', '));
    return ok(toPublic(P, target));
  });

  route('POST', '/api/builder/preview', (P, user, req) => {
    requirePerm(user, 'reports.build');
    const input = parseDefinitionInput(req.body);
    const def = buildDefinition({ ...input, visibility: 'private', policy: undefined }, user, undefined, builderDeps());
    const ctx = ctxFor(P, user);
    const g = guard(def, {}, ctx, P.settings);
    if (!g.online) throw new HttpError(422, `${g.reason} Pick a shorter default period for the preview.`, 'ASYNC_REQUIRED');
    return ok(runReport({ ...def, policy: { ...def.policy, cacheTtlSec: 0 } }, { filters: {}, pageSize: 25 }, { ...ctx, cache: new Map() }, P.settings));
  });
  const builderDeps = () => ({ categories: FIXTURES.categories, hasPerm, randomSuffix: () => randomBytes(2).toString('hex'), now: clock() });

  route('POST', '/api/cron', (P, user) => {
    if (!user.isAdmin) throw new HttpError(401, 'A valid cron secret or an administrator session is required.');
    return ok(runScheduler(P));
  });

  route('GET', '/api/dashboards', (P, user) => ok(P.dashboards.filter((d) => canSeeDashboard(user, d))));
  route('POST', '/api/dashboards', (P, user, req) => {
    requirePerm(user, 'dashboards.edit');
    const v = body(req);
    const b = { name: v.str('name', { trim: true, min: 2, max: 80 }), description: v.str('description', { max: 300, def: '' }) };
    v.done();
    const dash = { id: `${slugify(b.name)}-${newId('d').slice(2, 8)}`, name: b.name, description: b.description, ownerId: user.id, visibility: 'private', sharedRoleIds: [], widgets: [], dateRange: { preset: 'last_30_days' }, updatedAt: nowIso() };
    P.dashboards.push(dash);
    audit(P, user, 'dashboard.create', dash.id);
    return ok(dash, 201);
  });
  route('PUT', '/api/dashboards/:id', (P, user, req, { id }) => {
    const dash = P.dashboards.find((d) => d.id === id);
    if (!dash) throw new HttpError(404, 'Dashboard not found.');
    if (!canEditDashboard(user, dash)) throw new HttpError(403, 'Only the owner can edit this dashboard.');
    const v = body(req);
    const b = {
      name: v.str('name', { trim: true, min: 2, max: 80 }), description: v.str('description', { max: 300 }), visibility: v.oneOf('visibility', ['private', 'roles', 'everyone']),
      sharedRoleIds: v.strings('sharedRoleIds', { max: 20 }), dateRange: v.custom('dateRange', parseDateRange),
      widgets: v.custom('widgets', (ws) => {
        if (!Array.isArray(ws) || ws.length > 24) throw new Error('Use at most 24 widgets');
        return ws.map((w) => {
          const wv = new Validator(w);
          const out = { id: wv.str('id', { max: 40 }), reportId: wv.str('reportId', { max: 80 }), title: wv.str('title', { trim: true, min: 1, max: 80 }), kind: wv.oneOf('kind', ['bar', 'line', 'donut', 'table', 'kpi']), size: wv.oneOf('size', ['sm', 'md', 'lg']), kpiColumn: wv.str('kpiColumn', { max: 64, optional: true }) };
          if (Object.keys(wv.errors).length) throw new Error('Invalid widget');
          if (out.kpiColumn === undefined) delete out.kpiColumn;
          return out;
        });
      }),
    };
    v.done();
    if (b.visibility !== 'private' && !hasPerm(user, 'reports.share') && !user.isAdmin) throw new HttpError(403, 'Your role cannot share dashboards. Keep it private.');
    for (const w of b.widgets) {
      const r = findReport(P, w.reportId);
      if (!r || !can(P, user, r, 'view')) throw new HttpError(400, `You cannot add "${w.reportId}" because you do not have access to it.`);
    }
    Object.assign(dash, b, { sharedRoleIds: b.visibility === 'roles' ? b.sharedRoleIds : [], updatedAt: nowIso() });
    audit(P, user, 'dashboard.update', dash.id, `${b.widgets.length} widgets`);
    return ok(dash);
  });
  route('DELETE', '/api/dashboards/:id', (P, user, req, { id }) => {
    const dash = P.dashboards.find((d) => d.id === id);
    if (!dash) throw new HttpError(404, 'Dashboard not found.');
    if (!canEditDashboard(user, dash)) throw new HttpError(403, 'Only the owner can delete this dashboard.');
    P.dashboards = P.dashboards.filter((x) => x.id !== id);
    audit(P, user, 'dashboard.delete', id);
    return ok({ ok: true });
  });

  function ownedDefinition(P, user, id) {
    const def = P.customReports.find((r) => r.id === id);
    if (!def) throw new HttpError(404, 'Custom report not found.');
    if (def.ownerId !== user.id && !user.isAdmin) throw new HttpError(403, 'Only the owner can change this report.');
    return def;
  }
  route('POST', '/api/definitions', (P, user, req) => {
    requirePerm(user, 'reports.build');
    const def = buildDefinition(parseDefinitionInput(req.body), user, undefined, builderDeps());
    P.customReports.push(def);
    for (const roleId of def.sharedRoleIds) P.grants.push({ roleId, reportId: def.id, actions: [...SHARED_DEFAULT] });
    audit(P, user, 'definition.create', def.id, `${def.title} (${def.visibility})`);
    return ok(def, 201);
  });
  route('PUT', '/api/definitions/:id', (P, user, req, { id }) => {
    requirePerm(user, 'reports.build');
    const existing = ownedDefinition(P, user, id);
    const def = buildDefinition(parseDefinitionInput(req.body), user, existing, builderDeps());
    P.customReports = P.customReports.map((r) => (r.id === id ? def : r));
    P.grants = P.grants.filter((g) => g.reportId !== id || def.sharedRoleIds.includes(g.roleId));
    for (const roleId of def.sharedRoleIds) if (!P.grants.some((g) => g.reportId === id && g.roleId === roleId)) P.grants.push({ roleId, reportId: id, actions: [...SHARED_DEFAULT] });
    audit(P, user, 'definition.update', id, `v${def.version}`);
    return ok(def);
  });
  route('DELETE', '/api/definitions/:id', (P, user, req, { id }) => {
    ownedDefinition(P, user, id);
    P.customReports = P.customReports.filter((r) => r.id !== id);
    P.grants = P.grants.filter((g) => g.reportId !== id);
    P.views = P.views.filter((x) => x.reportId !== id);
    P.favorites = P.favorites.filter((f) => f.reportId !== id);
    P.schedules.forEach((s) => { if (s.reportId === id) s.active = false; });
    audit(P, user, 'definition.delete', id);
    return ok({ ok: true });
  });

  route('GET', '/api/downloads/:token', (P, user, req, { token }) => {
    const link = readLink(P, token);
    if (!link) throw new HttpError(410, 'This download link has expired or is invalid.');
    const job = P.jobs.find((j) => j.id === link.jid);
    if (!job) throw new HttpError(404, 'Report not found.');
    if (job.userId !== user.id && !link.rcp.includes(user.email.toLowerCase()) && !user.isAdmin) throw new HttpError(403, 'This link was sent to someone else.');
    audit(P, user, 'job.download_link', job.reportId, job.id);
    return fileResponse(P, job);
  });

  route('POST', '/api/email-in/simulate', (P, user, req) => {
    const v = body(req);
    const b = { from: v.str('from', { max: 320, optional: true }), subject: v.str('subject', { max: 1000 }), authPass: v.bool('authPass', { def: true }) };
    v.done();
    const from = user.isAdmin && b.from ? b.from : user.email;
    const verdict = b.authPass ? 'pass' : 'fail';
    return ok(handleInbound(P, { from, subject: b.subject, auth: { spf: verdict, dkim: verdict, dmarc: verdict } }));
  });

  route('POST', '/api/favorites', (P, user, req) => {
    const v = body(req);
    const reportId = v.str('reportId', { max: 80 });
    v.done();
    requireReport(P, user, reportId);
    const exists = P.favorites.some((f) => f.userId === user.id && f.reportId === reportId);
    P.favorites = exists ? P.favorites.filter((f) => !(f.userId === user.id && f.reportId === reportId)) : [...P.favorites, { userId: user.id, reportId }];
    return ok({ favorite: !exists });
  });

  route('GET', '/api/jobs', (P, user, req) => {
    const all = req.query.get('all') === '1' && user.isAdmin;
    const activeOnly = req.query.get('active') === '1';
    let jobs = P.jobs.filter((j) => all || j.userId === user.id);
    if (activeOnly) jobs = jobs.filter((j) => j.status === 'queued' || j.status === 'running');
    return ok([...jobs].reverse().slice(0, 200));
  });
  route('POST', '/api/jobs', (P, user, req) => {
    const v = body(req);
    const b = {
      reportId: v.str('reportId', { max: 80 }), filters: v.custom('filters', parseFilters, { def: {} }), columns: v.strings('columns', { ...columnsLimit, def: [] }),
      sort: v.custom('sort', parseSort, { optional: true }), format: v.oneOf('format', ['csv', 'xlsx', 'json']), deliver: v.oneOf('deliver', ['download', 'email']),
      recipients: v.strings('recipients', { max: 20, def: [] }),
    };
    v.done();
    const def = requireReport(P, user, b.reportId);
    return ok(enqueueJob(P, { user, def, ...b, origin: 'screen' }), 201);
  });
  const ownJob = (P, user, id) => { const job = P.jobs.find((j) => j.id === id && (j.userId === user.id || user.isAdmin)); if (!job) throw new HttpError(404, 'Job not found.'); return job; };
  route('GET', '/api/jobs/:id', (P, user, req, { id }) => ok(ownJob(P, user, id)));
  route('DELETE', '/api/jobs/:id', (P, user, req, { id }) => ok(cancelJob(P, user, id)));
  route('GET', '/api/jobs/:id/results', (P, user, req, { id }) => {
    const job = ownJob(P, user, id);
    if (job.status !== 'completed') throw new HttpError(409, 'Results are available once the job has completed.');
    const page = Math.max(1, Number(req.query.get('page') ?? 1) || 1);
    const pageSize = Math.min(500, Math.max(10, Number(req.query.get('pageSize') ?? 100) || 100));
    const res = P.results.get(id);
    if (!res) throw new HttpError(410, 'These results have expired.');
    const start = (page - 1) * pageSize;
    return ok({ columns: res.columns, rows: res.rows.slice(start, start + pageSize), total: res.rows.length, maskedColumns: res.maskedColumns, page, pageSize });
  });
  route('GET', '/api/jobs/:id/download', (P, user, req, { id }) => {
    const job = ownJob(P, user, id);
    audit(P, user, 'job.download', job.reportId, job.id);
    return fileResponse(P, job);
  });

  route('POST', '/api/reports/:id/run', (P, user, req, { id }) => {
    const def = requireReport(P, user, id, 'view');
    const b = run(req);
    const ctx = ctxFor(P, user);
    const g = guard(def, b.filters, ctx, P.settings);
    if (!g.online) throw new HttpError(422, g.reason ?? 'This request is too large for the screen.', 'ASYNC_REQUIRED', { rangeDays: g.rangeDays, estimatedRows: g.estimatedRows, policy: g.policy });
    const result = runReport(def, b, ctx, P.settings);
    if (!result.meta.cached && (b.page ?? 1) === 1) audit(P, user, 'report.run', def.id, `${result.meta.from} to ${result.meta.to}, ${result.total} rows`);
    return ok(result);
  });
  route('POST', '/api/reports/:id/export', (P, user, req, { id }) => {
    const v = body(req);
    const b = { filters: v.custom('filters', parseFilters, { def: {} }), columns: v.strings('columns', { ...columnsLimit, optional: true }), sort: v.custom('sort', parseSort, { optional: true }), format: v.oneOf('format', ['csv', 'xlsx', 'json']) };
    v.done();
    const def = requireReport(P, user, id, FORMAT_ACTION[b.format]);
    const ctx = ctxFor(P, user);
    const g = guard(def, b.filters, ctx, P.settings);
    if (!g.online) throw new HttpError(422, `${g.reason} Run it in the background instead.`, 'ASYNC_REQUIRED');
    const rf = resolveFilters(def, b.filters, ctx);
    const cols = selectColumns(def, b.columns);
    const full = sortRows(shapeAll(def, collectRows(def, rf)), b.sort ?? def.sort, def);
    const { rows, columns, masked } = project(def, full, cols, ctx.unmask);
    const file = writeExport(b.format, columns, rows, { title: def.title, generatedBy: user.email, generatedAt: nowIso(), period: `${rf.from} to ${rf.to}`, filters: describeFilters(b.filters), maskedColumns: masked, currency: P.settings.currency });
    audit(P, user, `report.export_${b.format}`, def.id, `${rows.length} rows, ${rf.from} to ${rf.to}`);
    return { status: 200, headers: { 'Content-Type': MIME[b.format], 'Content-Disposition': `attachment; filename="${def.id}-${rf.from}-to-${rf.to}.${b.format}"`, 'Cache-Control': 'no-store' }, body: file };
  });
  route('GET', '/api/reports/:id/views', (P, user, req, { id }) => { requireReport(P, user, id); return ok(viewsFor(P, user, id)); });
  route('POST', '/api/reports/:id/views', (P, user, req, { id }) => {
    const def = requireReport(P, user, id);
    const v = body(req);
    const b = {
      name: v.str('name', { trim: true, min: 1, max: 80 }), columns: v.strings('columns', columnsLimit), filters: v.custom('filters', parseFilters, { def: {} }),
      sort: v.custom('sort', parseSort, { optional: true }), scope: v.oneOf('scope', ['user', 'role']), roleId: v.str('roleId', { max: 40, optional: true }), isDefault: v.bool('isDefault', { def: false }),
    };
    v.done();
    if (b.scope === 'role') {
      if (!hasPerm(user, 'admin.access')) throw new HttpError(403, 'Only people who manage access can save views for a whole role.');
      if (!b.roleId || !P.roles.some((r) => r.id === b.roleId)) throw new HttpError(400, 'Choose a role.');
    }
    const view = { id: newId('view'), reportId: def.id, name: b.name, columns: b.columns.filter((k) => def.columns.some((c) => c.key === k)), filters: b.filters, sort: b.sort, scope: b.scope, ownerId: user.id, roleId: b.scope === 'role' ? b.roleId : undefined, isDefault: b.isDefault, createdAt: nowIso() };
    if (view.isDefault) {
      P.views.forEach((x) => {
        if (x.reportId !== def.id) return;
        if (view.scope === 'user' && x.scope === 'user' && x.ownerId === user.id) x.isDefault = false;
        if (view.scope === 'role' && x.scope === 'role' && x.roleId === view.roleId) x.isDefault = false;
      });
    }
    P.views.push(view);
    audit(P, user, 'view.create', def.id, `${view.name} (${view.scope}${view.roleId ? `: ${view.roleId}` : ''})`);
    return ok(view, 201);
  });
  route('DELETE', '/api/views/:id', (P, user, req, { id }) => {
    const view = P.views.find((x) => x.id === id);
    if (!view) throw new HttpError(404, 'View not found.');
    if (!(view.scope === 'user' ? view.ownerId === user.id : hasPerm(user, 'admin.access'))) throw new HttpError(403, 'You cannot delete this view.');
    P.views = P.views.filter((x) => x.id !== id);
    return ok({ ok: true });
  });

  const loadSchedule = (P, user, id) => { const s = P.schedules.find((x) => x.id === id); if (!s || (s.ownerId !== user.id && !hasPerm(user, 'schedules.manage_all'))) throw new HttpError(404, 'Schedule not found.'); return s; };
  route('GET', '/api/schedules', (P, user) => { const all = hasPerm(user, 'schedules.manage_all'); return ok(P.schedules.filter((s) => all || s.ownerId === user.id)); });
  route('POST', '/api/schedules', (P, user, req) => {
    const v = body(req);
    const b = {
      name: v.str('name', { trim: true, min: 1, max: 120 }), reportId: v.str('reportId', { max: 80 }), viewId: v.str('viewId', { max: 80, optional: true }),
      columns: v.strings('columns', { ...columnsLimit, def: [] }), filters: v.custom('filters', parseFilters, { def: {} }), format: v.oneOf('format', ['csv', 'xlsx', 'json']),
      recipients: v.strings('recipients', { min: 1, max: 20 }), frequency: v.oneOf('frequency', ['daily', 'weekly', 'monthly']),
      dayOfWeek: v.int('dayOfWeek', { min: 1, max: 7, def: 1 }), dayOfMonth: v.int('dayOfMonth', { min: 1, max: 31, def: 1 }),
      hour: v.int('hour', { min: 0, max: 23 }), minute: v.int('minute', { min: 0, max: 59, def: 0 }), timezone: v.str('timezone', { max: 64 }),
      endDate: v.custom('endDate', (d) => { if (d === '') return undefined; if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Dates must look like 2025-01-31'); return d; }, { optional: true }),
    };
    v.done();
    const def = requireReport(P, user, b.reportId, 'schedule');
    if (!can(P, user, def, FORMAT_ACTION[b.format])) throw new HttpError(403, `Your role cannot export this report as ${b.format.toUpperCase()}.`);
    if (!validTimeZone(b.timezone)) throw new HttpError(400, `Unknown time zone "${b.timezone}".`);
    const s = { id: newId('sch'), ...b, ownerId: user.id, recipients: validateRecipients(P, user, b.recipients), columns: b.columns.filter((k) => def.columns.some((c) => c.key === k)), active: true, createdAt: nowIso() };
    if (s.endDate === undefined) delete s.endDate;
    if (s.viewId === undefined) delete s.viewId;
    s.nextRunAt = computeNextRun(s, clock());
    if (!s.nextRunAt) throw new HttpError(400, 'The end date is before the first run.');
    P.schedules.push(s);
    audit(P, user, 'schedule.create', def.id, `${s.name}: ${s.frequency} to ${s.recipients.join(', ')}`);
    return ok(s, 201);
  });
  route('PATCH', '/api/schedules/:id', (P, user, req, { id }) => {
    const s = loadSchedule(P, user, id);
    const v = body(req);
    const b = {
      active: v.bool('active', { optional: true }), recipients: v.strings('recipients', { min: 1, max: 20, optional: true }), hour: v.int('hour', { min: 0, max: 23, optional: true }),
      minute: v.int('minute', { min: 0, max: 59, optional: true }), frequency: v.oneOf('frequency', ['daily', 'weekly', 'monthly'], { optional: true }),
      dayOfWeek: v.int('dayOfWeek', { min: 1, max: 7, optional: true }), dayOfMonth: v.int('dayOfMonth', { min: 1, max: 31, optional: true }),
    };
    v.done();
    const recipients = b.recipients ? validateRecipients(P, user, b.recipients) : undefined;
    for (const [k, x] of Object.entries(b)) if (x !== undefined) s[k] = x;
    if (recipients) s.recipients = recipients;
    s.nextRunAt = s.active ? computeNextRun(s, clock()) : s.nextRunAt;
    audit(P, user, b.active === false ? 'schedule.pause' : b.active ? 'schedule.resume' : 'schedule.update', s.reportId, s.name);
    return ok(s);
  });
  route('DELETE', '/api/schedules/:id', (P, user, req, { id }) => {
    const s = loadSchedule(P, user, id);
    P.schedules = P.schedules.filter((x) => x.id !== s.id);
    audit(P, user, 'schedule.delete', s.reportId, s.name);
    return ok({ ok: true });
  });
  route('POST', '/api/schedules/:id/run', (P, user, req, { id }) => {
    const s = loadSchedule(P, user, id);
    const queued = runOccurrence(P, s, nowIso());
    audit(P, user, 'schedule.run_now', s.reportId, s.name);
    if (!queued) throw new HttpError(409, `Not queued: ${s.lastStatus ?? 'check the schedule owner and access'}.`);
    return ok({ ok: true });
  });

  // Routes authenticated by something other than the host session.
  const keyRoutes = [];
  const keyRoute = (method, pattern, fn) => {
    const keys = [];
    keyRoutes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`), keys, fn });
  };
  keyRoute('GET', '/api/v1/reports', (P, req) => {
    const user = userFromApiKey(P, req.headers);
    if (!user) throw new HttpError(401, 'Send a valid API key: Authorization: Bearer lmn_…');
    return ok(accessibleReports(P, user).filter((r) => can(P, user, r, 'api')).map((r) => ({ id: r.id, title: r.title, category: r.category, description: r.description, columns: r.columns.map((c) => ({ key: c.key, label: c.label, type: c.type })), filters: r.filters.map((f) => ({ key: f.key, type: f.type })) })));
  });
  keyRoute('GET', '/api/v1/reports/:id', (P, req, { id }) => {
    const user = userFromApiKey(P, req.headers);
    if (!user) throw new HttpError(401, 'Send a valid API key: Authorization: Bearer lmn_…');
    const def = requireReport(P, user, id, 'api');
    const q = req.query;
    const s = P.settings;
    const filters = {};
    const dateFilter = def.filters.find((f) => f.type === 'daterange');
    if (dateFilter) {
      const from = q.get('from');
      const to = q.get('to');
      const preset = q.get('period');
      if (from || to) {
        if (!isIsoDate(from) || !isIsoDate(to)) throw new HttpError(400, 'from and to must both be dates like 2025-01-31.');
        filters[dateFilter.key] = { preset: 'custom', from, to };
      } else if (preset) {
        if (!PRESETS.includes(preset)) throw new HttpError(400, `Unknown period. Use one of: ${PRESETS.join(', ')}.`);
        filters[dateFilter.key] = { preset };
      }
    }
    for (const f of def.filters) {
      if (f.type === 'daterange') continue;
      const x = q.get(f.key);
      if (x) filters[f.key] = f.type === 'multiselect' ? x.split(',').map((y) => y.trim()) : x;
    }
    const ctx = ctxFor(P, user);
    const g = guard(def, filters, ctx, { ...s, maxOnlineRows: Math.max(s.maxOnlineRows, s.apiMaxRows) });
    if (!g.online) throw new HttpError(422, `${g.reason} Narrow the period or use a scheduled export.`, 'ASYNC_REQUIRED');
    const pageSize = Math.min(s.apiMaxRows, Math.max(1, Number(q.get('pageSize') ?? s.apiMaxRows) || s.apiMaxRows));
    const page = Math.max(1, Number(q.get('page') ?? 1) || 1);
    const columns = q.get('columns')?.split(',').filter(Boolean);
    const res = runReport(def, { filters, page, pageSize, maxPageSize: s.apiMaxRows, columns }, ctx, s);
    audit(P, user, 'api.pull', def.id, `${res.rows.length} rows`);
    if (q.get('format') === 'csv') {
      const lines = [res.columns.map((c) => safeCell(c.label)).join(','), ...res.rows.map((r) => res.columns.map((c) => safeCell(r[c.key])).join(','))];
      return { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${def.id}.csv"`, 'Cache-Control': 'no-store' }, body: Buffer.from('﻿' + lines.join('\n'), 'utf8') };
    }
    return ok({ report: def.id, page: res.page, pageSize: res.pageSize, total: res.total, from: res.meta.from, to: res.meta.to, maskedColumns: res.meta.maskedColumns, columns: res.columns, rows: res.rows });
  });
  keyRoute('POST', '/api/inbound-email', (P, req) => {
    const configured = options.inboundSecret;
    const given = String(req.headers['x-inbound-secret'] ?? '');
    if (!configured || Buffer.byteLength(given) !== Buffer.byteLength(configured) || !timingSafeEqual(Buffer.from(given), Buffer.from(configured))) throw new HttpError(401, 'Invalid inbound secret.');
    const v = body(req);
    const payload = { from: v.str('from', { max: 320 }), subject: v.str('subject', { max: 1000, def: '' }), text: v.str('text', { max: 20000, optional: true }), auth: v.custom('auth', (a) => ({ spf: a?.spf, dkim: a?.dkim, dmarc: a?.dmarc }), { optional: true }) };
    v.done();
    const log = handleInbound(P, payload);
    return ok({ status: log.status, reason: log.reason, jobId: log.jobId });
  });

  // -------------------------------------------------------------------------
  // Entry point

  function normalize(req) {
    let path = String(req.path ?? '').split('?')[0];
    if (path.startsWith(REPORTS_MODULE_PREFIX)) path = path.slice(REPORTS_MODULE_PREFIX.length) || '/';
    if (path.length > 1) path = path.replace(/\/+$/, '');
    const raw = req.query ?? String(req.path ?? '').split('?')[1] ?? '';
    const query = raw instanceof URLSearchParams ? raw : typeof raw === 'string' ? new URLSearchParams(raw) : new URLSearchParams(Object.entries(raw).filter(([, x]) => x !== undefined && x !== null).map(([k, x]) => [k, Array.isArray(x) ? x[0] : String(x)]));
    const headers = Object.fromEntries(Object.entries(req.headers ?? {}).map(([k, x]) => [k.toLowerCase(), Array.isArray(x) ? x[0] : x]));
    return { method: String(req.method ?? 'GET').toUpperCase(), path, query, body: req.body, headers };
  }
  function match(list, method, path) {
    let pathMatched = false;
    for (const r of list) {
      const m = r.re.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (r.method === method) return { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return pathMatched ? 'method' : null;
  }

  /**
   * handle(user, scope, request) -> { status, body } or { status, headers, body: Buffer } for files.
   * `user` must be the router-authenticated identity ({ id, tenantId, name?, email?, role? }).
   * `scope` must carry router-validated { applicationId, branchId }.
   */
  function handle(user, scope, request) {
    try {
      if (!user || typeof user.id !== 'string' || !user.id || typeof user.tenantId !== 'string' || !user.tenantId) throw new HttpError(401, 'Sign in to continue.');
      if (!scope || typeof scope.applicationId !== 'string' || !scope.applicationId || typeof scope.branchId !== 'string' || !scope.branchId) throw new HttpError(400, 'Application and branch scope are required.', 'SCOPE_REQUIRED');
      const req = normalize(request ?? {});
      const P = partitionFor(user, scope);
      pump(P);
      const keyed = match(keyRoutes, req.method, req.path);
      if (keyed && keyed !== 'method') return keyed.r.fn(P, req, keyed.params);
      const found = match(routes, req.method, req.path);
      if (!found) throw new HttpError(keyed === 'method' ? 405 : 404, keyed === 'method' ? 'Method not allowed.' : 'Not found.');
      if (found === 'method') throw new HttpError(405, 'Method not allowed.');
      const actor = provision(P, user);
      return found.r.fn(P, actor, req, found.params);
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, body: { error: e.message, ...(e.code ? { code: e.code } : {}), ...(e.details !== undefined ? { details: e.details } : {}) } };
      return { status: 500, body: { error: 'Something went wrong on the server. Check the server log for details.' } };
    }
  }

  return { handle, endpoints: REFERENCE_REPORTS_ENDPOINTS, partitionCount: () => partitions.size, authenticateApiKey, authenticateInboundSecret };
}
