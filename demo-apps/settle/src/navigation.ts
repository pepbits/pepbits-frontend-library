import {BadgeCheck, ChartColumnBig, History, LayoutDashboard, ReceiptText, Settings2, Users, Vault, Wallet, type IconComponent} from '@pepbits/icons';
import {defineProduct, type ShellNavigation} from '@pepbits/shell';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import {API_PRODUCT} from './adapters/http';

export type SettleTarget = NavigationTarget & {query?: string};
/** One page definition per Settle screen. `path` is the source route; `:id` marks a record segment. */
export interface SettlePageDefinition {id: string; path: string; title: string; subtitle: string; menu?: {section: string; icon: IconComponent; label: string}}

export const SECTIONS = [{id: 'work', label: 'Work'}, {id: 'money', label: 'Money'}, {id: 'control', label: 'Control'}, {id: 'admin', label: 'Admin'}] as const;
export const SETTLE_PAGES: SettlePageDefinition[] = [
  {id: 'settle-desk', path: '/', title: 'Desk', subtitle: 'What needs attention, today’s till, recent activity', menu: {section: 'work', icon: LayoutDashboard, label: 'Desk'}},
  {id: 'settle-bills', path: '/bills', title: 'Bills', subtitle: 'All bills; summary figures double as filters', menu: {section: 'work', icon: ReceiptText, label: 'Bills'}},
  {id: 'settle-patients', path: '/patients', title: 'Patient accounts', subtitle: 'Deposits, dues across bills, points, visits, receipts', menu: {section: 'work', icon: Users, label: 'Patient accounts'}},
  {id: 'settle-receipts', path: '/receipts', title: 'Receipts', subtitle: 'One ledger for receipts, refunds, sponsor payments and deposits', menu: {section: 'money', icon: Wallet, label: 'Receipts'}},
  {id: 'settle-day-close', path: '/day-close', title: 'Day close', subtitle: 'Day book by counter, cash count and closure', menu: {section: 'money', icon: Vault, label: 'Day close'}},
  {id: 'settle-approvals', path: '/approvals', title: 'Approvals', subtitle: 'Discounts, write-offs and cancellations in one queue', menu: {section: 'control', icon: BadgeCheck, label: 'Approvals'}},
  {id: 'settle-reports', path: '/reports', title: 'Reports', subtitle: 'Collections, dues, deposits, points and finance postings', menu: {section: 'control', icon: ChartColumnBig, label: 'Reports'}},
  {id: 'settle-audit', path: '/audit', title: 'Audit trail', subtitle: 'Every change with before/after values', menu: {section: 'control', icon: History, label: 'Audit trail'}},
  {id: 'settle-settings', path: '/settings', title: 'Settings', subtitle: 'Payment modes, counters, number series, discounts, rate plans, users and rights', menu: {section: 'admin', icon: Settings2, label: 'Settings'}},
  {id: 'settle-bill', path: '/bills/:id', title: 'Bill', subtitle: 'Charges, sponsor split, payments, approvals, history and lifecycle'},
  {id: 'settle-patient', path: '/patients/:id', title: 'Patient account', subtitle: 'Deposits, dues, points, visits and receipts'},
  {id: 'settle-print-bill', path: '/print/bill/:id', title: 'Print bill', subtitle: 'Bill and itemized statement'},
  {id: 'settle-print-receipt', path: '/print/receipt/:id', title: 'Print receipt', subtitle: 'Receipt and vouchers'},
];

export const pages: PageDefinition[] = [
  ...SETTLE_PAGES.map(p => ({id: p.id, title: p.title, subtitle: p.subtitle, kind: 'settle', module: 'settle', ai: {enabled: false, useCases: []}})),
  {id: 'preferences', title: 'Preferences', subtitle: '', kind: 'preferences', module: 'shared'},
];

const navigation: ShellNavigation = {
  defaultModule: 'settle',
  pages: Object.fromEntries(pages.map(p => [p.id, p])),
  modules: {settle: {id: 'settle', label: 'Settle', shortLabel: 'Settle', description: 'Patient billing desk (fictional data)', icon: ReceiptText, accent: 'var(--primary)',
    navigation: SECTIONS.map(section => ({id: 'settle-' + section.id, label: section.label, items: SETTLE_PAGES.filter(p => p.menu?.section === section.id).map(p => ({id: p.id, pageId: p.id, label: p.menu!.label, icon: p.menu!.icon}))}))}},
};
/** Product availability only. The Settle API enforces every desk right for the selected desk user. */
const WRITE_ROLES = ['admin', 'enterprise-admin', 'operations', 'operations-analyst', 'finance', 'finance-manager', 'user'];
export const product = defineProduct({id: 'settle', name: 'Settle', tagline: 'Fictional patient billing desk', navigation, defaultModule: 'settle', enabledModules: ['settle'],
  access: {actions: {create: WRITE_ROLES, edit: WRITE_ROLES, export: WRITE_ROLES, archive: []}}});
export const settleProductForRole = (_role: string) => product;
void API_PRODUCT;

const SEGMENT = /^[A-Za-z0-9._~-]+$/;
/** Maps a browser path to a page target. Unknown or malformed paths are not-found. */
export function targetFromPath(pathname: string, query = ''): SettleTarget {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/preferences') return {pageId: 'preferences'};
  if (path === '/login') return {pageId: 'settle-desk'};
  for (const page of SETTLE_PAGES) {
    const pattern = page.path.split('/'), parts = path.split('/');
    if (pattern.length !== parts.length) continue;
    let recordId: string | undefined, ok = true;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === ':id') {
        let decoded: string;
        try {decoded = decodeURIComponent(parts[i]!);} catch {ok = false; break;}
        if (!SEGMENT.test(decoded)) {ok = false; break;}
        recordId = decoded;
      } else if (pattern[i] !== parts[i]) {ok = false; break;}
    }
    if (ok) return {pageId: page.id, ...(recordId ? {recordId} : {}), ...(query ? {query} : {})};
  }
  return {pageId: 'not-found'};
}

/** Settle-relative path (source route + query) for a target. */
export function settlePathFor(target: SettleTarget): string {
  if (target.pageId === 'preferences') return '/preferences';
  const page = SETTLE_PAGES.find(p => p.id === target.pageId);
  if (!page) return '/not-found';
  const path = page.path.replace(':id', encodeURIComponent(target.recordId ?? ''));
  return path + (target.query ? '?' + target.query : '');
}
export const hrefFor = (target: SettleTarget) => settlePathFor(target);
export function targetForSettlePath(path: string): SettleTarget {const [p, q] = path.split('?'); return targetFromPath(p || '/', q ?? '');}
