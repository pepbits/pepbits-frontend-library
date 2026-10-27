import {HeartPulse, Stethoscope} from '@pepbits/icons';
import type {ShellNavigation} from '@pepbits/shell';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {NavigationTarget} from '@pepbits/platform/navigation';

export const MODULE_ID = 'reference-allyvora-outpatient';
export const KIND = 'allyvora-outpatient';
export const PAGE = {intake: 'allyvora-op-intake', intakeForm: 'allyvora-op-intake-form'} as const;
export const BASE = '/allyvora-outpatient';

export const pages: PageDefinition[] = [
  {id: PAGE.intake, title: 'Nurse intake', subtitle: 'Patients waiting for vitals, allergy review and screening', kind: KIND, module: MODULE_ID, entity: 'encounter', ai: {enabled: false, useCases: []}},
  {id: PAGE.intakeForm, title: 'Nurse intake', subtitle: 'Outpatient intake for one visit', kind: KIND, module: MODULE_ID, entity: 'encounter', ai: {enabled: false, useCases: []}},
];

export const navigation: ShellNavigation = {
  defaultModule: MODULE_ID,
  pages: Object.fromEntries(pages.map(page => [page.id, page])),
  modules: {[MODULE_ID]: {id: MODULE_ID, label: 'AllyVora Outpatient', shortLabel: 'Outpatient', description: 'Fictional outpatient clinical workflows', icon: Stethoscope, accent: 'var(--primary)', navigation: [
    {id: 'allyvora-outpatient-main', label: 'Outpatient', items: [{id: PAGE.intake, pageId: PAGE.intake, label: 'Nurse intake', icon: HeartPulse}]},
  ]}},
};

/** Encounter ids are opaque API identifiers. */
const encounterParam = (value: string | undefined) => value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : undefined;

/** `/allyvora-outpatient/intake` lists waiting visits; `/allyvora-outpatient/intake/<encounter>` is the form. */
export function targetFromPath(pathname: string): NavigationTarget {
  const path = pathname.replace(/\/+$/, '');
  if (path === BASE || path === `${BASE}/intake`) return {pageId: PAGE.intake};
  const form = /^\/allyvora-outpatient\/intake\/([^/]+)$/.exec(path);
  const id = encounterParam(form?.[1]);
  return id ? {pageId: PAGE.intakeForm, recordId: id} : {pageId: 'not-found'};
}

export function hrefFor(target: NavigationTarget): string {
  if (target.pageId === PAGE.intake) return `${BASE}/intake`;
  if (target.pageId === PAGE.intakeForm) return `${BASE}/intake/${target.recordId ? encodeURIComponent(target.recordId) : '[id]'}`;
  return '/not-found';
}
