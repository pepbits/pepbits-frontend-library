import {Gauge, Siren} from '@pepbits/icons';
import type {ShellNavigation} from '@pepbits/shell';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {NavigationTarget} from '@pepbits/platform/navigation';

export const MODULE_ID = 'reference-allyvora-emergency';
export const KIND = 'allyvora-emergency';
export const PAGE = {triage: 'allyvora-er-triage', triageForm: 'allyvora-er-triage-form'} as const;
export const BASE = '/allyvora-emergency';

export const pages: PageDefinition[] = [
  {id: PAGE.triage, title: 'Triage', subtitle: 'Patients waiting to be triaged, longest wait first', kind: KIND, module: MODULE_ID, entity: 'encounter', ai: {enabled: false, useCases: []}},
  {id: PAGE.triageForm, title: 'Triage', subtitle: 'Emergency triage for one visit', kind: KIND, module: MODULE_ID, entity: 'encounter', ai: {enabled: false, useCases: []}},
];

export const navigation: ShellNavigation = {
  defaultModule: MODULE_ID,
  pages: Object.fromEntries(pages.map(page => [page.id, page])),
  modules: {[MODULE_ID]: {id: MODULE_ID, label: 'AllyVora Emergency', shortLabel: 'Emergency', description: 'Fictional emergency department workflows', icon: Siren, accent: 'var(--danger)', navigation: [
    {id: 'allyvora-emergency-main', label: 'Emergency', items: [{id: PAGE.triage, pageId: PAGE.triage, label: 'Triage', icon: Gauge}]},
  ]}},
};

/** Encounter ids are opaque API identifiers. */
const encounterParam = (value: string | undefined) => value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : undefined;

/** `/allyvora-emergency/triage` lists patients waiting; `/allyvora-emergency/triage/<encounter>` is the form. */
export function targetFromPath(pathname: string): NavigationTarget {
  const path = pathname.replace(/\/+$/, '');
  if (path === BASE || path === `${BASE}/triage`) return {pageId: PAGE.triage};
  const form = /^\/allyvora-emergency\/triage\/([^/]+)$/.exec(path);
  const id = encounterParam(form?.[1]);
  return id ? {pageId: PAGE.triageForm, recordId: id} : {pageId: 'not-found'};
}

export function hrefFor(target: NavigationTarget): string {
  if (target.pageId === PAGE.triage) return `${BASE}/triage`;
  if (target.pageId === PAGE.triageForm) return `${BASE}/triage/${target.recordId ? encodeURIComponent(target.recordId) : '[id]'}`;
  return '/not-found';
}
