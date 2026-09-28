import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createHash } from 'node:crypto';
import { DEFAULT_PREFERENCES } from '@pepbits/erp-config';
import type { ReferenceHost } from '@pepbits/reference-host';
import { matchReferencePath, pagePath, type Field } from '@pepbits/reference-keystone-core';
import { PAGES } from './lib/registry';
import { TEMPLATES } from './components/templates';
import { referenceErp1Routes, ReferenceErp1Module } from './index';

/** ERP1's source has no record routes; ERP2 adds new / view / edit. */
const RECORDS = false;
const route = (p: string) => matchReferencePath(p, { records: RECORDS, pages: PAGES });
function hostFor(tenantId: string, request: ReferenceHost['request']): ReferenceHost {
  return { scope: { tenantId, applicationId: 'app', branchId: 'b1', userId: 'u1', roles: ['admin'] }, preferences: DEFAULT_PREFERENCES, request, navigate: () => {} };
}
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
const listOf = (name: string) => ({ rows: [{ id: `${name}-1`, code: `${name}-1`, name }], total: 1, page: 1, size: 20, facets: {}, totals: {} });
const EMPTY_LOOKUPS = { fields: {}, lines: {} };

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia;
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
});

/* Digests computed from the read-only Keystone ERP1 source registry (see README). */
const PAGE_IDENTITY = '0d7303ac971a64b565d382774be634e7cfaf9e507cc6f19c5d6c464560c4d358';
const FIELD_IDENTITY = '6cd6914a378606c95c2483a3ebe4ffc1314f33419e76643379b985e511502e79';
const ident = (fs: Field[] = []) => fs.map((f) => `${f.key}:${f.label}:${f.type}:${f.required ? 1 : 0}:${f.group ?? ''}:${f.span ?? ''}:${f.list === false ? 0 : 1}:${f.primary ? 1 : 0}:${f.ref ?? ''}`).join(',');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function lookupsFor(slug: string) { const def = PAGES.find((page) => page.slug === slug)!; return { fields: Object.fromEntries(def.fields.filter((field) => field.lookupKind).map((field) => [field.key, []])), lines: {} }; }

describe('reference-erp1 catalog', () => {
  it('retains all 57 source pages (titles, sections, groups, templates, entities) and 20 template keys', () => {
    expect(PAGES).toHaveLength(57);
    expect(sha(PAGES.map((p) => [p.section, p.slug, p.group, p.title, p.template, p.entity].join('|')).join('\n'))).toBe(PAGE_IDENTITY);
    expect(new Set(PAGES.map(pagePath)).size).toBe(57);
    expect(Object.keys(TEMPLATES)).toHaveLength(20);
    for (const p of PAGES) expect(TEMPLATES[p.template]).toBeTypeOf('function');
    expect(new Set(PAGES.map((p) => p.template)).size).toBe(20);
  });
  it('keeps field labels, types, layout and workflow config identical to the source', () => {
    const rows = PAGES.map((p) => [p.section, p.slug, p.title, p.template, p.entity, ident(p.fields), ident(p.lines?.fields), ident(p.params), (p.sections ?? []).map((s) => `${s.title}=${ident(s.fields)}`).join(';'), (p.steps ?? []).join('>'), (p.statusFlow ?? []).join('>')].join('|'));
    expect(sha(rows.join('\n'))).toBe(FIELD_IDENTITY);
  });
  it('ships no fixture data: no seeds, counts, trees, resources, balances, pools or non-status value lists', () => {
    const all = (fs: Field[] = []) => fs;
    for (const p of PAGES) {
      for (const k of ['seed', 'count', 'tree', 'resources', 'balances', 'codePrefix', 'approvers']) expect(p).not.toHaveProperty(k);
      const fields = [...all(p.fields), ...all(p.lines?.fields), ...all(p.params), ...(p.sections ?? []).flatMap((s) => s.fields)];
      for (const f of fields) {
        expect(f.pool).toBeUndefined();
        if (f.type !== 'status') expect(f.options).toBeUndefined();
        for (const k of ['past', 'future', 'min', 'max']) expect(f).not.toHaveProperty(k);
      }
    }
    const text = JSON.stringify(PAGES);
    for (const s of ['Northwind', 'HDFC', 'Mumbai', 'Dr. ', 'Hydraulic Pump', 'Boardroom', 'Wholesale', 'Net 30']) expect(text).not.toContain(s);
    expect(PAGES.flatMap((p) => p.fields).filter((f) => f.lookupKind).length).toBeGreaterThan(80);
  });
  it('publishes root, login and every page in the route manifest', () => {
    expect(referenceErp1Routes).toHaveLength(59);
    expect(referenceErp1Routes.slice(0, 2).map((r) => r.path)).toEqual(['/', '/login']);
  });
});

describe('reference-erp1 route matching', () => {
  it('matches the root dashboard, login and every registry page', () => {
    const root = route('/');
    expect(root.kind === 'page' && root.def.slug).toBe('dashboard');
    expect(route('/login?next=%2Fmasters%2Fcountries')).toMatchObject({ kind: 'login', query: 'next=%2Fmasters%2Fcountries' });
    for (const p of PAGES) expect(route(pagePath(p) + '/')).toMatchObject({ kind: 'page', section: p.section, slug: p.slug });
  });
  it('keeps query strings and rejects unknown paths', () => {
    expect(route('/masters/countries?q=ind&period=2026-09')).toMatchObject({ kind: 'page', query: 'q=ind&period=2026-09' });
    expect(route('/masters/nope').kind).toBe('notfound');
    expect(route('/masters').kind).toBe('notfound');
    expect(route('/masters/countries/a/b/c').kind).toBe('notfound');
  });
  it('handles record routes according to the source route tree', () => {
    if (RECORDS) {
      expect(route('/masters/countries/new?copy=C1')).toMatchObject({ kind: 'record', mode: 'new', query: 'copy=C1' });
      expect(route('/masters/countries/C1')).toMatchObject({ kind: 'record', mode: 'view', id: 'C1' });
      expect(route('/masters/countries/C1/edit')).toMatchObject({ kind: 'record', mode: 'edit', id: 'C1' });
      expect(route('/masters/countries/C1/other').kind).toBe('notfound');
    } else {
      expect(route('/masters/countries/new').kind).toBe('notfound');
      expect(route('/masters/countries/C1/edit').kind).toBe('notfound');
    }
  });
});

describe('reference-erp1 module', () => {
  it('requests page lookups before rendering the page', async () => {
    const calls: string[] = [];
    const request = vi.fn(async (path: string) => { calls.push(path); return (path.startsWith('/api/lookups') ? lookupsFor('customers') : path.startsWith('/api/entities/') ? listOf('Row one') : {}) as never; });
    render(<ReferenceErp1Module path="/masters/customers" host={hostFor('A', request)} />);
    await waitFor(() => expect(screen.getAllByText('Row one').length).toBeGreaterThan(0));
    expect(calls[0]).toBe('/api/lookups?entity=customers&page=masters%2Fcustomers');
  });
  it('switching host scope drops drafts and ignores the old tenant\'s pending response', async () => {
    const pendingA = deferred<unknown>();
    const a = vi.fn(() => pendingA.promise as never);
    const b = vi.fn(async (path: string) => (path.startsWith('/api/entities/') ? listOf('Tenant B row') : path.startsWith('/api/lookups') ? lookupsFor('countries') : {}) as never);
    const { rerender } = render(<ReferenceErp1Module path="/login" host={hostFor('A', a)} />);
    const email = screen.getByLabelText(/work email/i) as HTMLInputElement;
    fireEvent.change(email, { target: { value: 'draft@tenant-a.example' } });
    expect(email.value).toBe('draft@tenant-a.example');
    rerender(<ReferenceErp1Module path="/login" host={hostFor('B', b)} />);
    expect((screen.getByLabelText(/work email/i) as HTMLInputElement).value).toBe('');

    rerender(<ReferenceErp1Module path="/masters/countries" host={hostFor('A', a)} />);
    await waitFor(() => expect(a).toHaveBeenCalled());
    rerender(<ReferenceErp1Module path="/masters/countries" host={hostFor('B', b)} />);
    await act(async () => { pendingA.resolve(listOf('Tenant A row')); await pendingA.promise; });
    await waitFor(() => expect(screen.getAllByText('Tenant B row').length).toBeGreaterThan(0));
    expect(screen.queryByText('Tenant A row')).toBeNull();
  });
});
