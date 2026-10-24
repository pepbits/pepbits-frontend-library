import {History, Inbox, LayoutDashboard, Settings2, type IconComponent} from '@pepbits/icons';
import {defineProduct, type MenuItem, type MenuSection, type ShellNavigation} from '@pepbits/shell';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import {API_PRODUCT} from './adapters/http';
import {resolveTenantAdminRoute, tenantAdminPaths} from './modules/tenant-admin/routes';
import {iconFor} from './modules/tenant-admin/lib/icons';

export const MODULE = 'tenant-admin';
/** `path` is the module-relative source path; it is kept so an unknown path reaches the module's own not-found page. */
export type TenantAdminTarget = NavigationTarget & {query?: string; path?: string};

/** The server registry subset that drives navigation. Labels are API text; keys are canonical catalog IDs when they exist. */
export interface NavigationRegistry {
  categories: readonly {key: string; label: string; labelKey?: string}[];
  resources: readonly {key: string; label: string; category: string; summary: string; icon: string; labelKey?: string; titleKey?: string}[];
}

const WORKSPACE = [
  {id: 'overview', path: '/', title: 'Overview', subtitle: 'Activation readiness', icon: LayoutDashboard, labelKey: 'menu.reference-tenant-admin.reference-tenant-admin-overview.label'},
  {id: 'approvals', path: '/approvals', title: 'Approvals', subtitle: 'Changes waiting for a decision', icon: Inbox, labelKey: 'menu.reference-tenant-admin.reference-tenant-admin-approvals.label'},
  {id: 'activity', path: '/activity', title: 'Activity', subtitle: 'Audit trail', icon: History, labelKey: 'menu.reference-tenant-admin.reference-tenant-admin-activity.label'},
] as const;
export const configPageId = (resource: string) => 'config-' + resource;
const page = (id: string, title: string, subtitle: string, titleKey?: string): PageDefinition => ({id, title, subtitle, kind: 'tenant-admin', module: MODULE, ...(titleKey ? {titleKey} : {}), ai: {enabled: false, useCases: []}});
const staticPages: PageDefinition[] = [
  ...WORKSPACE.map(item => page(item.id, item.title, item.subtitle, item.labelKey)),
  page('not-found', 'Not found', ''),
  {id: 'preferences', title: 'Preferences', subtitle: '', kind: 'preferences', module: 'shared'},
];

/** Workspace pages, then every registry category with its pages in registry order. Nothing is listed before `GET /meta` answers. */
export function buildNavigation(registry: NavigationRegistry | null): ShellNavigation {
  const resources = registry?.resources ?? [];
  const pages = [...staticPages, ...resources.map(resource => page(configPageId(resource.key), resource.label, resource.summary, resource.titleKey))];
  const workspace: MenuSection = {id: 'workspace', label: 'Workspace', labelKey: 'section.reference-tenant-admin.workspace.label', items: WORKSPACE.map(item => ({id: item.id, pageId: item.id, label: item.title, labelKey: item.labelKey, icon: item.icon}))};
  const sections: MenuSection[] = (registry?.categories ?? []).map(category => ({id: category.key, label: category.label, ...(category.labelKey ? {labelKey: category.labelKey} : {}),
    items: resources.filter(resource => resource.category === category.key).map((resource): MenuItem => ({id: resource.key, pageId: configPageId(resource.key), label: resource.label, ...(resource.labelKey ? {labelKey: resource.labelKey} : {}), icon: iconFor(resource.icon) as IconComponent}))}))
    .filter(section => section.items.length > 0);
  return {defaultModule: MODULE, pages: Object.fromEntries(pages.map(p => [p.id, p])),
    modules: {[MODULE]: {id: MODULE, label: 'Tenant Admin', shortLabel: 'Tenant Admin', labelKey: 'module.reference-tenant-admin.label', shortLabelKey: 'module.reference-tenant-admin.shortLabel', description: 'Fictional tenant configuration', icon: Settings2, accent: 'var(--primary)', navigation: [workspace, ...sections]}}};
}

/** One product for every role: the API decides who may read, edit or decide; the module explains a refusal. */
export function buildProduct(registry: NavigationRegistry | null) {
  return defineProduct({id: API_PRODUCT, name: 'Tenant Admin', tagline: 'Fictional tenant configuration', navigation: buildNavigation(registry), defaultModule: MODULE, enabledModules: [MODULE]});
}

/** Maps an address onto a page. Query identity (`?new=1`, `?open=<id>`, `?id=<id>`) is retained. */
export function targetFromPath(pathname: string, query = ''): TenantAdminTarget {
  if (pathname === '/preferences') return {pageId: 'preferences'};
  if (pathname === '/login') return {pageId: 'overview', path: '/'};
  const path = pathname + (query ? '?' + query : '');
  const match = resolveTenantAdminRoute(path);
  if (!match) return {pageId: 'not-found', path, ...(query ? {query} : {})};
  const pageId = match.kind === 'resource' ? configPageId(match.resource) : match.kind;
  return {pageId, path, ...(query ? {query} : {})};
}

/** Real hrefs for the shell's anchors. Unknown targets go to the module's not-found page. */
export function hrefFor(target: TenantAdminTarget): string {
  const query = target.query ? '?' + target.query : '';
  if (target.pageId === 'preferences') return '/preferences';
  const workspace = WORKSPACE.find(item => item.id === target.pageId);
  if (workspace) return workspace.path + query;
  if (target.pageId.startsWith('config-')) return tenantAdminPaths.resource(target.pageId.slice('config-'.length)) + query;
  return target.path ?? '/not-found';
}

/** The page definition for a target; configuration pages not yet in the loaded registry still render (the module validates the key). */
export function pageFor(target: TenantAdminTarget, navigation: ShellNavigation): PageDefinition {
  return navigation.pages[target.pageId] ?? (target.pageId.startsWith('config-') ? page(target.pageId, 'Configuration page', '') : navigation.pages['not-found']!);
}
