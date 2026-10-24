import {readFileSync} from 'node:fs';
import {vi} from 'vitest';
import type {SessionValue} from '@pepbits/platform/auth';
import type {Request} from '../adapters/http';

/* An in-memory stand-in for the unchanged demo API routes this app uses. Every value is fictional. */
const catalog = (language: string) => JSON.parse(readFileSync(`${process.cwd()}/../../dummy-api/config/localization/shared/${language}.json`, 'utf8')).messages as Record<string, string>;
export const englishMessages = catalog('en');
const catalogs: Record<string, Record<string, string>> = {en: englishMessages};
const messagesFor = (language: string) => catalogs[language] ??= catalog(language);

type Row = Record<string, string | number | boolean>;
export const customerRows: Row[] = [
  {id: 'CUS-1', name: 'Fictional Atlas Trading', type: 'Corporate', segment: 'Enterprise', city: 'Dubai', contact: 'Fictional Contact One', creditLimit: 50000, outstanding: 1200, lastInvoice: '2026-09-01', owner: 'Fictional Owner', risk: 'Low', status: 'Active'},
  {id: 'CUS-2', name: 'Fictional Bluecrest Retail', type: 'Retail', segment: 'SMB', city: 'Sharjah', contact: 'Fictional Contact Two', creditLimit: 25000, outstanding: 800, lastInvoice: '2026-09-04', owner: 'Fictional Owner', risk: 'Medium', status: 'Pending'},
  {id: 'CUS-3', name: 'Fictional Crescent Foods', type: 'Distributor', segment: 'Strategic', city: 'Abu Dhabi', contact: 'Fictional Contact Three', creditLimit: 90000, outstanding: 0, lastInvoice: '2026-08-21', owner: 'Fictional Owner', risk: 'High', status: 'Inactive'},
];
export const employeeRows: Row[] = [
  {id: 'EMP-1', name: 'Fictional Employee One', department: 'Finance', position: 'Manager', branch: 'Fictional HQ', joinDate: '2024-01-15', manager: 'Fictional Lead', leaveBalance: 12, performance: 88, status: 'Active'},
  {id: 'EMP-2', name: 'Fictional Employee Two', department: 'Sales', position: 'Specialist', branch: 'Fictional HQ', joinDate: '2025-03-02', manager: 'Fictional Lead', leaveBalance: 6, performance: 91, status: 'Active'},
];
const rows: Record<string, Row[]> = {'customer-master': customerRows, 'employee-worklist': employeeRows};

export interface MockOptions {preferences?: Record<string, unknown>; rules?: Record<string, unknown>; failSaves?: number}
export function mockApi(options: MockOptions = {}) {
  let snapshot = {preferences: options.preferences ?? {}, overrides: options.preferences ?? {}, policy: {revision: 1, rules: options.rules ?? {}}, userRevision: 1, canManage: false};
  const records = new Map<string, {record: {values: unknown; version: number; savedAt: string} | null; draftVersion: number}>();
  let failSaves = options.failSaves ?? 0;
  const request = vi.fn<Request>(async (path, init) => {
    const url = new URL(path, 'http://localhost'), method = init?.method ?? 'GET', body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.pathname === '/localization') {const language = url.searchParams.get('language') ?? 'en'; return Response.json({messages: messagesFor(language), fallbackMessages: englishMessages});}
    if (url.pathname === '/preferences') {
      if (method === 'PUT') snapshot = {...snapshot, overrides: body.preferences, preferences: body.preferences, userRevision: snapshot.userRevision + 1};
      return Response.json(snapshot);
    }
    if (url.pathname === '/worklists/search') {
      const filters: Record<string, string> = {...body.safeFilters, ...body.sensitiveFilters};
      const matched = (rows[body.pageId] ?? []).filter(row => Object.entries(filters).every(([key, value]) => !value || (key === 'query' ? Object.values(row).some(field => String(field).toLowerCase().includes(value.toLowerCase())) : String(row[key] ?? '').toLowerCase().includes(value.toLowerCase()))));
      return Response.json({pageId: body.pageId, total: matched.length, rows: matched, page: 1, pageSize: 50});
    }
    if (url.pathname === '/layouts') return Response.json(method === 'GET' ? {layouts: {}} : {ok: true});
    if (url.pathname === '/personal-views') return Response.json({views: []});
    if (url.pathname === '/views') return Response.json({id: 'fictional-view'});
    if (url.pathname === '/exports' || url.pathname === '/reference') return Response.json({});
    if (url.pathname.startsWith('/ai/')) return Response.json({error: 'No AI provider is configured in this mock.'}, {status: 404});
    const record = url.pathname.match(/^\/records\/([^/]+)(\/draft|\/discard|\/create)?$/);
    if (record) {
      const key = decodeURIComponent(record[1]!), entry = records.get(key) ?? {record: null, draftVersion: 0};
      if (method === 'GET') return Response.json({record: entry.record, draft: null, draftVersion: entry.draftVersion});
      if (record[2] === '/draft') {const next = {...entry, draftVersion: entry.draftVersion + 1}; records.set(key, next); return Response.json({values: body.values, version: next.draftVersion, baseVersion: body.baseVersion, savedAt: new Date().toISOString()});}
      if (record[2] === '/discard') {records.set(key, {...entry, draftVersion: entry.draftVersion + 1}); return new Response(null, {status: 204});}
      if (failSaves > 0) {failSaves--; return Response.json({error: 'Fictional service outage'}, {status: 503});}
      const saved = {record: {values: body.values, version: (entry.record?.version ?? 0) + 1, savedAt: new Date().toISOString()}, draftVersion: entry.draftVersion + 1};
      records.set(record[2] === '/create' ? body.destinationKey : key, saved);
      return Response.json({record: saved.record, draft: null, draftVersion: saved.draftVersion, ...(record[2] === '/create' ? {recordKey: body.destinationKey} : {})});
    }
    if (url.pathname === '/records') return Response.json({records: []});
    throw new Error('Unhandled mock request ' + method + ' ' + path);
  });
  return {request, records, writes: () => request.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET').map(([path, init]) => ({path, method: init!.method, body: init!.body ? JSON.parse(String(init!.body)) : null})),
    setPolicy(rules: Record<string, unknown>) {snapshot = {...snapshot, policy: {revision: snapshot.policy.revision + 1, rules}};}};
}

export const fixtureSession: SessionValue = {status: 'authenticated', login: async () => null, logout: async () => {},
  user: {id: 'fixture-user', name: 'Fictional Administrator', email: 'fixture@example.invalid', initials: 'FA', title: 'Administrator', role: 'enterprise-admin', branch: 'fictional-branch', tenantId: 'fictional-tenant'}};
export const readOnlySession: SessionValue = {...fixtureSession, user: {...fixtureSession.user!, id: 'fixture-analyst', role: 'operations-analyst', title: 'Analyst'}};
