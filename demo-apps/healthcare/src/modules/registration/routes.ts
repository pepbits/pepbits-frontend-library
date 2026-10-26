import {Hospital, UserPlus, Users, PanelTop} from '@pepbits/icons';
import type {ShellNavigation} from '@pepbits/shell';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import {SECTION_IDS, type SectionId} from '@allyvora/shared';

export const MODULE_ID = 'reference-allyvora-patients';
export const PAGE = {register: 'allyvora-patients', create: 'allyvora-patient-new', layout: 'allyvora-form-layout', preferences: 'preferences'} as const;
export type AllyVoraTarget = NavigationTarget & {query?: string; section?: SectionId};

export const pages: PageDefinition[] = [
  {id: PAGE.register, title: 'Patient register', subtitle: 'Find, view and edit registered patients', kind: 'allyvora-patients', module: MODULE_ID, entity: 'patient', ai: {enabled: false, useCases: []}},
  {id: PAGE.create, title: 'Register a patient', subtitle: 'New patient registration form', kind: 'allyvora-patients', module: MODULE_ID, entity: 'patient', ai: {enabled: false, useCases: []}},
  {id: PAGE.layout, title: 'Patient form layout', subtitle: 'How the registration form is arranged for everyone', kind: 'allyvora-layout', module: MODULE_ID, ai: {enabled: false, useCases: []}},
  {id: PAGE.preferences, title: 'Preferences', subtitle: '', kind: 'preferences', module: 'shared'},
];

export const navigation: ShellNavigation = {
  defaultModule: MODULE_ID,
  pages: Object.fromEntries(pages.map(page => [page.id, page])),
  modules: {[MODULE_ID]: {id: MODULE_ID, label: 'AllyVora Patients', shortLabel: 'Patients', description: 'Fictional patient registration', icon: Hospital, accent: 'var(--primary)', navigation: [
    {id: 'allyvora-patients-main', label: 'Patients', items: [
      {id: PAGE.register, pageId: PAGE.register, label: 'Patient register', icon: Users},
      {id: PAGE.create, pageId: PAGE.create, label: 'Register a patient', icon: UserPlus},
    ]},
    {id: 'allyvora-patients-configuration', label: 'Configuration', items: [
      {id: PAGE.layout, pageId: PAGE.layout, label: 'Form layout', icon: PanelTop},
    ]},
  ]}},
};

/** Demo sign-in roles allowed to see each action. UI gating only: the unchanged AllyVora API has simulated authentication. */
export const REGISTRATION_ROLES = ['enterprise-admin', 'admin', 'operations-analyst', 'finance-manager'];
export const LAYOUT_ROLES = ['enterprise-admin', 'admin'];
const positiveId = (value: string | null) => value && /^[1-9][0-9]{0,9}$/.test(value) ? value : undefined;

/** Source URLs are kept: `/allyvora-patients/patients` with `mode`, `id` and `section`, and `/allyvora-patients/settings/layout`. */
export function targetFromPath(pathname: string, query = ''): AllyVoraTarget {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/preferences') return {pageId: PAGE.preferences};
  if (path === '/allyvora-patients/settings/layout') return {pageId: PAGE.layout};
  if (path === '/allyvora-patients') return {pageId: PAGE.register};
  if (path !== '/allyvora-patients/patients') return {pageId: 'not-found'};
  const params = new URLSearchParams(query), mode = params.get('mode'), id = positiveId(params.get('id'));
  const sectionParam = params.get('section') as SectionId | null, section = sectionParam && SECTION_IDS.includes(sectionParam) ? sectionParam : undefined;
  if (mode === 'new') return {pageId: PAGE.create, mode: 'new', ...(section ? {section} : {})};
  if (mode === 'edit' && id) return {pageId: PAGE.register, mode: 'edit', recordId: id, ...(section ? {section} : {})};
  if (mode === 'view' && id) return {pageId: PAGE.register, mode: 'view', recordId: id};
  // The register keeps its own filter parameters (view, q, sex, payer, branch, sort, page).
  const kept = new URLSearchParams();
  for (const [key, value] of params) if (['view', 'q', 'sex', 'payer', 'branch', 'sort', 'page'].includes(key)) kept.set(key, value);
  const text = kept.toString();
  return {pageId: PAGE.register, ...(text ? {query: text} : {})};
}

export function hrefFor(target: AllyVoraTarget): string {
  if (target.pageId === PAGE.preferences) return '/preferences';
  if (target.pageId === PAGE.layout) return '/allyvora-patients/settings/layout';
  const section = target.section ? `&section=${target.section}` : '';
  if (target.pageId === PAGE.create || target.mode === 'new') return `/allyvora-patients/patients?mode=new${section}`;
  if (target.pageId !== PAGE.register) return '/not-found';
  if (target.recordId && target.mode === 'edit') return `/allyvora-patients/patients?mode=edit&id=${encodeURIComponent(target.recordId)}${section}`;
  if (target.recordId) return `/allyvora-patients/patients?mode=view&id=${encodeURIComponent(target.recordId)}`;
  return target.query ? `/allyvora-patients/patients?${target.query}` : '/allyvora-patients/patients';
}
