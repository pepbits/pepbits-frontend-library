import {Building2, Globe, KeyRound, LayoutDashboard} from '@pepbits/icons';
import {defineProduct, type ShellNavigation} from '@pepbits/shell';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import {API_PRODUCT} from './adapters/http';

/** A target plus its query string (`?ws=`, `?type=`, `?structure=`), so deep links survive navigation. */
export type OnboardingTarget = NavigationTarget & {query?: string};
export const MODULE_ID = 'orvia';
export type OnboardingKind = 'orvia-landing' | 'orvia-workspace' | 'orvia-sign-in' | 'orvia-register';

/** One route per source page. `/login` (source path) is accepted as an alias of `/sign-in`. */
export const ROUTES = [
  {pageId: 'orvia-landing', path: '/', kind: 'orvia-landing', title: 'Orvia Health Cloud', subtitle: 'Care pathway, facility explorer, compliance and workspaces', icon: Globe},
  {pageId: 'orvia-workspace', path: '/workspace', kind: 'orvia-workspace', title: 'Find your workspace', subtitle: 'Look up a workspace by address or work email', icon: Building2},
  {pageId: 'orvia-sign-in', path: '/sign-in', kind: 'orvia-sign-in', title: 'Sign in', subtitle: 'Workspace sign-in with a 6-digit code and password reset', icon: KeyRound},
  {pageId: 'orvia-register', path: '/register', kind: 'orvia-register', title: 'Register your organization', subtitle: 'Six steps, seven for multi-facility networks', icon: LayoutDashboard},
] as const;
export const pages: PageDefinition[] = [
  ...ROUTES.map(route => ({id: route.pageId, title: route.title, subtitle: route.subtitle, kind: route.kind, module: MODULE_ID, icon: route.icon, ai: {enabled: false, useCases: []}})),
  {id: 'preferences', title: 'Preferences', subtitle: '', kind: 'preferences', module: 'shared'},
];
const navigation: ShellNavigation = {
  defaultModule: MODULE_ID,
  pages: Object.fromEntries(pages.map(page => [page.id, page])),
  quickPages: [{id: 'orvia-workspace', label: 'Find your workspace', icon: Building2}, {id: 'orvia-register', label: 'Register your organization', icon: LayoutDashboard}],
  modules: {[MODULE_ID]: {id: MODULE_ID, label: 'Orvia onboarding', shortLabel: 'Orvia', description: 'Fictional Orvia Health Cloud onboarding', icon: Globe, accent: 'var(--primary)', navigation: [
    {id: 'orvia-public', label: 'Public pages', items: [{id: 'orvia-landing', pageId: 'orvia-landing', label: 'Orvia Health Cloud', icon: Globe}]},
    {id: 'orvia-access', label: 'Workspace access', items: [{id: 'orvia-workspace', pageId: 'orvia-workspace', label: 'Find your workspace', icon: Building2}, {id: 'orvia-sign-in', pageId: 'orvia-sign-in', label: 'Sign in', icon: KeyRound}]},
    {id: 'orvia-onboarding', label: 'Onboarding', items: [{id: 'orvia-register', pageId: 'orvia-register', label: 'Register your organization', icon: LayoutDashboard}]},
  ]}},
};
// Every authenticated demo role may view the fictional public pages; no product actions are granted.
export const product = defineProduct({id: API_PRODUCT, name: 'Orvia onboarding', tagline: 'Fictional onboarding demonstration', navigation, defaultModule: MODULE_ID, enabledModules: [MODULE_ID], access: {actions: {create: [], edit: [], delete: [], export: [], archive: []}}});
export const onboardingProductForRole = (_role: string) => product;

export function targetFromPath(pathname: string, query = ''): OnboardingTarget {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/preferences') return {pageId: 'preferences'};
  const route = ROUTES.find(candidate => candidate.path === (path === '/login' ? '/sign-in' : path));
  return route ? {pageId: route.pageId, ...(query ? {query} : {})} : {pageId: 'not-found'};
}
export function hrefFor(target: OnboardingTarget): string {
  if (target.pageId === 'preferences') return '/preferences';
  const route = ROUTES.find(candidate => candidate.pageId === target.pageId);
  if (!route) return '/not-found';
  return route.path + (target.query ? '?' + target.query : '');
}
/** Build a target with query parameters, omitting empty values. */
export function onboardingTarget(pageId: OnboardingKind, params: Record<string, string | undefined> = {}): OnboardingTarget {
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => !!entry[1])).toString();
  return {pageId, ...(query ? {query} : {})};
}
