import {BookOpen, FileQuestion, LayoutDashboard, Users} from '@pepbits/icons';
import {defineProduct, type ShellNavigation} from '@pepbits/shell';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import {API_PRODUCT} from './adapters/http';

/** Desktop destinations: one route per page, plus record routes for the two record pages. */
export interface DesktopRoute {pageId: string; path: string; records?: {create: boolean; edit: boolean}}
export const ROUTES: readonly DesktopRoute[] = [
  {pageId: 'desktop-overview', path: '/overview'},
  {pageId: 'customer-master', path: '/finance/customers', records: {create: true, edit: true}},
  {pageId: 'component-examples', path: '/library/components'},
  {pageId: 'employee-worklist', path: '/hr/employees', records: {create: false, edit: false}},
  {pageId: 'preferences', path: '/preferences'},
];
export const HOME: NavigationTarget = {pageId: 'desktop-overview'};

export const pages: Record<string, PageDefinition> = {
  'desktop-overview': {id: 'desktop-overview', title: 'Desktop workspace', subtitle: 'Window, tab and split controls for this host', kind: 'desktop-overview', module: 'finance', icon: LayoutDashboard},
  'customer-master': {id: 'customer-master', title: 'Customer Master', subtitle: 'Fictional customers from the demo API', kind: 'desktop-records', module: 'finance', entity: 'customer',
    ai: {enabled: true, useCases: ['worklist.summarise-selection', 'record.explain']}},
  'component-examples': {id: 'component-examples', title: 'Library examples', subtitle: 'Shared components inside the desktop frame', kind: 'desktop-examples', module: 'finance', icon: BookOpen},
  'employee-worklist': {id: 'employee-worklist', title: 'Employee Worklist', subtitle: 'Fictional employees, read only', kind: 'desktop-records', module: 'hr', entity: 'employee', icon: Users},
  preferences: {id: 'preferences', title: 'My Preferences', subtitle: 'Account preferences and tenant locks', kind: 'preferences', module: 'shared'},
  'not-found': {id: 'not-found', title: 'Not found', subtitle: '', kind: 'not-found', module: 'shared'},
};

const navigation: ShellNavigation = {
  defaultModule: 'finance',
  pages,
  modules: {
    finance: {id: 'finance', label: 'Finance', shortLabel: 'FIN', description: 'Fictional finance records in the desktop frame', icon: LayoutDashboard, accent: 'var(--primary)', navigation: [
      {id: 'finance-overview', label: 'Overview', items: [{id: 'desktop-overview', label: 'Desktop workspace', pageId: 'desktop-overview'}]},
      {id: 'finance-masters', label: 'Masters', items: [{id: 'customer-master', label: 'Customer Master', pageId: 'customer-master'}]},
      {id: 'finance-library', label: 'Library', items: [{id: 'component-examples', label: 'Library examples', pageId: 'component-examples'}]},
    ]},
    hr: {id: 'hr', label: 'Human Resources', shortLabel: 'HR', description: 'Fictional people records in the desktop frame', icon: FileQuestion, accent: 'var(--primary)', navigation: [
      {id: 'hr-worklists', label: 'Worklists', items: [{id: 'employee-worklist', label: 'Employee Worklist', pageId: 'employee-worklist'}]},
    ]},
  },
};

// UI availability only: the demo API authorizes every record write and cell edit.
const writers = ['enterprise-admin', 'finance-manager'];
export const product = defineProduct({id: API_PRODUCT, name: 'Desktop', tagline: 'Fictional desktop workspace', navigation, defaultModule: 'finance', enabledModules: ['finance', 'hr'],
  access: {actions: {create: writers, edit: writers, export: [...writers, 'operations-analyst'], archive: []}}});
export const desktopProductForRole = (_role: string) => product;

const recordId = (value: string) => {try {const id = decodeURIComponent(value); return id && !/[\\/?#]/.test(id) ? id : null;} catch {return null;}};
/** Address → target. Unknown or malformed addresses become the not-found page. */
export function targetFromPath(pathname: string, _search = ''): NavigationTarget {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/index.html') return HOME;
  for (const route of ROUTES) {
    if (path === route.path) return {pageId: route.pageId};
    if (!route.records || !path.startsWith(route.path + '/')) continue;
    const rest = path.slice(route.path.length + 1).split('/');
    if (rest.length === 1 && rest[0] === 'new') return route.records.create ? {pageId: route.pageId, mode: 'new'} : {pageId: 'not-found'};
    const id = recordId(rest[0]!);
    if (!id || rest.length > 2 || rest.length === 2 && (rest[1] !== 'edit' || !route.records.edit)) return {pageId: 'not-found'};
    return {pageId: route.pageId, mode: rest.length === 2 ? 'edit' : 'view', recordId: id};
  }
  return {pageId: 'not-found'};
}
/** Target → address. Titles and module hints never enter the address. */
export function hrefFor(target: NavigationTarget): string {
  const route = ROUTES.find(item => item.pageId === target.pageId);
  if (!route) return target.pageId === 'not-found' ? '/not-found' : '/';
  if (target.mode === 'new') return route.path + '/new';
  if (target.recordId) return route.path + '/' + encodeURIComponent(target.recordId) + (target.mode === 'edit' ? '/edit' : '');
  return route.path;
}
