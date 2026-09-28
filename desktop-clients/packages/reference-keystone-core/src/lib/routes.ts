/*
 * Module router: the Next.js App Router file tree of the source, expressed as data.
 * Source routes: /login, / (redirects to /workspace/dashboard), /[section]/[slug]
 * and, in ERP2 only, /[section]/[slug]/new, /[section]/[slug]/[id], /[section]/[slug]/[id]/edit.
 * Query strings (?copy=, ?period=, ?q=, ?next= and prefilled new-record values) are kept on
 * the path and read through useSearchParams().
 */
import { findPageIn, pagePath } from './registry';
import type { PageDef } from './types';

export const DASHBOARD_PATH = '/workspace/dashboard';

export type RecordMode = 'view' | 'edit' | 'new';
export type ReferenceMatch =
  | { kind: 'login'; path: string; query: string }
  | { kind: 'page'; path: string; query: string; def: PageDef; section: string; slug: string; root: boolean }
  | { kind: 'record'; path: string; query: string; def: PageDef; section: string; slug: string; id?: string; mode: RecordMode }
  | { kind: 'notfound'; path: string; query: string };

export interface ReferenceRouteEntry { path: string; title: string }

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export function splitPath(path: string): { pathname: string; query: string } {
  const noHash = (path || '/').split('#')[0];
  const [p, ...q] = noHash.split('?');
  const pathname = ('/' + p.split('/').filter(Boolean).join('/')) || '/';
  return { pathname, query: q.join('?') };
}

export function matchReferencePath(path: string, options: { records: boolean; pages: readonly PageDef[] }): ReferenceMatch {
  const findPage = (section?: string, slug?: string) => findPageIn(options.pages, section, slug);
  const { pathname, query } = splitPath(path);
  const seg = pathname.split('/').filter(Boolean).map(decode);
  if (seg.length === 0) {
    const def = findPage('workspace', 'dashboard');
    return def ? { kind: 'page', path: pathname, query, def, section: def.section, slug: def.slug, root: true } : { kind: 'notfound', path: pathname, query };
  }
  if (seg.length === 1 && seg[0] === 'login') return { kind: 'login', path: pathname, query };
  const [section, slug, third, fourth] = seg;
  const def = seg.length >= 2 ? findPage(section, slug) : undefined;
  if (!def) return { kind: 'notfound', path: pathname, query };
  if (seg.length === 2) return { kind: 'page', path: pathname, query, def, section, slug, root: false };
  if (!options.records) return { kind: 'notfound', path: pathname, query };
  if (seg.length === 3 && third === 'new') return { kind: 'record', path: pathname, query, def, section, slug, mode: 'new' };
  if (seg.length === 3) return { kind: 'record', path: pathname, query, def, section, slug, id: third, mode: 'view' };
  if (seg.length === 4 && fourth === 'edit') return { kind: 'record', path: pathname, query, def, section, slug, id: third, mode: 'edit' };
  return { kind: 'notfound', path: pathname, query };
}

/** Navigable manifest: root dashboard, sign-in and every registry page (source order). */
export function buildRouteManifest(pages: readonly PageDef[]): ReferenceRouteEntry[] {
  const dashboard = findPageIn(pages, 'workspace', 'dashboard');
  return [
    { path: '/', title: dashboard?.title ?? 'Dashboard' },
    { path: '/login', title: 'Sign in' },
    ...pages.map((p) => ({ path: pagePath(p), title: p.title })),
  ];
}
