import {FileBarChart} from '@pepbits/icons';
import {defineProduct, type ShellNavigation} from '@pepbits/shell';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import {API_PRODUCT} from './adapters/http';
import {REPORTS_MODULE_ID} from './adapters/reports';
import {REPORTS_NAVIGATION} from './modules/reports/navigation';
import {matchReportsRoute, REPORTS_ROUTE_DEFINITIONS, type ReportsRouteId} from './modules/reports/routes';

/** A reports target keeps the module-relative path, so every source deep link (ids and queries) round-trips. */
export type ReportsTarget = NavigationTarget & {query?: string; reportsPath?: string};
type PageId = `reports-${ReportsRouteId}` | 'reports-download' | 'preferences';

export const pageIdFor = (id: ReportsRouteId) => `reports-${id}` as PageId;
const ADMIN_ROLES = ['enterprise-admin'];
const MODULE_ROLES = ['enterprise-admin', 'finance-manager', 'operations-analyst'];

/** One application page per source page route, plus the signed-download host adaptation and preferences. */
export const pages: PageDefinition[] = [
  ...REPORTS_ROUTE_DEFINITIONS.map(route => ({id: pageIdFor(route.id), title: route.title, subtitle: '', kind: 'reports', module: REPORTS_MODULE_ID, ai: {enabled: false, useCases: []}})),
  {id: 'reports-download', title: 'Report result', subtitle: '', kind: 'reports', module: REPORTS_MODULE_ID, ai: {enabled: false, useCases: []}},
  {id: 'preferences', title: 'Preferences', subtitle: '', kind: 'preferences', module: 'shared'},
];

/** The source sidebar (sections, order and labels) as shell navigation. The server still checks every permission. */
const navigation: ShellNavigation = {
  defaultModule: REPORTS_MODULE_ID,
  pages: Object.fromEntries(pages.map(page => [page.id, page])),
  modules: {[REPORTS_MODULE_ID]: {id: REPORTS_MODULE_ID, label: 'Lumen Reports', shortLabel: 'Reports', description: 'Fictional reporting workflows', icon: FileBarChart, accent: 'var(--primary)',
    navigation: REPORTS_NAVIGATION.map(section => ({id: 'reports-' + section.section.toLowerCase(), label: section.section,
      items: section.items.map(item => {const id = pageIdFor(matchReportsRoute(item.href)!.route.id);return {id, pageId: id, label: item.label};})}))}},
};

// Shell visibility mirrors the demo API navigation configuration: administration pages for administrators,
// everything else for the three fictional reporting roles. The reports API enforces each permission again.
export const product = defineProduct({id: API_PRODUCT, name: 'Lumen Reports', tagline: 'Fictional reporting demonstration', navigation, defaultModule: REPORTS_MODULE_ID, enabledModules: [REPORTS_MODULE_ID],
  access: {pages: Object.fromEntries(pages.filter(page => page.id !== 'preferences').map(page => [page.id, page.id.startsWith('reports-admin-') ? ADMIN_ROLES : MODULE_ROLES])),
    actions: {create: MODULE_ROLES, edit: MODULE_ROLES, delete: MODULE_ROLES, export: MODULE_ROLES, archive: []}}});
export const reportsProductForRole = (_role: string) => product;

export function targetFromPath(pathname: string, query = ''): ReportsTarget {
  if (pathname === '/preferences') return {pageId: 'preferences'};
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : '/';
  if (/^\/downloads\/[A-Za-z0-9_.-]+$/.test(path)) return {pageId: 'reports-download', reportsPath: path};
  const match = matchReportsRoute(path + (query ? '?' + query : ''));
  if (!match) return {pageId: 'not-found'};
  const recordId = match.params.id;
  return {pageId: pageIdFor(match.route.id), reportsPath: path, ...(query ? {query} : {}), ...(recordId !== undefined ? {recordId} : {})};
}

export function hrefFor(target: ReportsTarget): string {
  if (target.pageId === 'preferences') return '/preferences';
  const route = REPORTS_ROUTE_DEFINITIONS.find(item => pageIdFor(item.id) === target.pageId);
  let path = target.reportsPath;
  if (!path && route) path = route.pattern.includes(':') ? (target.recordId !== undefined ? route.pattern.replace(':id', encodeURIComponent(target.recordId)) : undefined) : route.pattern;
  if (!path) return '/not-found';
  return path + (target.query ? '?' + target.query : '');
}

/** The module-relative path for a target (`/reports/payer-mix?denied=1`). */
export function modulePath(target: ReportsTarget): string {
  const href = hrefFor(target);
  return href === '/not-found' ? '/__not-found' : href;
}
