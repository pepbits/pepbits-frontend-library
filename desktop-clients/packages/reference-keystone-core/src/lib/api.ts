'use client';
/*
 * Server-owned data for Keystone pages. The client bundle carries page structure only;
 * value lists, booking resources, leave/expense balances, approvers, record activity and
 * documents, company identity and process results all come from the API through the
 * host request closure (scoped per module/host scope).
 *
 *   GET  /api/lookups?entity=<entity>&page=<section>/<slug>
 *   GET  /api/entities/:entity/:id/support
 *   GET  /api/company-profile
 *   POST /api/processes/:entity/run
 */
import { useCallback, useMemo } from 'react';
import type { Field, PageDef, Row } from './types';
import { useApi, useScopedResource, type ResourceStatus } from './client';

export interface LookupResponse {
  fields: Record<string, string[]>;
  lines: Record<string, string[]>;
  params?: Record<string, string[]>;
  sections?: Record<string, string[]>;
  resources?: string[];
  balances?: { label: string; total: number; used: number }[];
  approvers?: string[];
}

export const lookupsUrl = (def: PageDef) => `/api/lookups?entity=${encodeURIComponent(def.entity)}&page=${encodeURIComponent(`${def.section}/${def.slug}`)}`;

const hydrateFields = (fields: Field[], values: Record<string, string[]> | undefined): Field[] =>
  fields.map((f) => {
    if (!f.lookupKind) return f;
    const list = values?.[f.key];
    if (!Array.isArray(list) || list.some((value) => typeof value !== 'string')) throw new Error(`Missing or invalid lookup values for ${f.key}`);
    return f.lookupKind === 'pool' ? { ...f, pool: list } : { ...f, options: list };
  });

/** Applies server lookups to a sanitized PageDef (fields, line fields, params, settings sections). */
export function hydratePageDef(def: PageDef, lookups: LookupResponse): PageDef {
  return {
    ...def,
    fields: hydrateFields(def.fields, lookups.fields),
    ...(def.lines ? { lines: { ...def.lines, fields: hydrateFields(def.lines.fields, lookups.lines) } } : {}),
    ...(def.params ? { params: hydrateFields(def.params, lookups.params ?? lookups.fields) } : {}),
    ...(def.sections ? { sections: def.sections.map((s) => ({ ...s, fields: hydrateFields(s.fields, lookups.sections ?? lookups.fields) })) } : {}),
    ...(lookups.resources ? { resources: lookups.resources } : {}),
    ...(lookups.balances ? { balances: lookups.balances } : {}),
    ...(lookups.approvers ? { approvers: lookups.approvers } : {}),
  };
}

/** A page definition hydrated with server metadata. No placeholder values while loading. */
export function usePageDefinition(def: PageDef | undefined): { def: PageDef | null; status: ResourceStatus; error: string | null; retry: () => void } {
  const res = useScopedResource<LookupResponse>(def ? lookupsUrl(def) : null);
  const hydrated = useMemo(() => {
    try { return { def: def && res.data ? hydratePageDef(def, res.data) : null, error: null }; }
    catch (error) { return { def: null, error: error instanceof Error ? error.message : 'Invalid lookup response' }; }
  }, [def, res.data]);
  return { def: hydrated.def, status: hydrated.error || !def ? 'error' : res.status, error: hydrated.error ?? (def ? res.error : 'Unknown page'), retry: res.retry };
}

export interface SupportActivity { when: string; who: string; text: string }
export interface SupportDocument { name: string; size: string; when?: string }
export interface EntitySupport { activities: SupportActivity[]; documents: SupportDocument[]; processEvents?: ProcessEvent[] }
/** Activity and documents for one record. */
export function useEntitySupport(entity: string, id: string | undefined) {
  return useScopedResource<EntitySupport>(id ? `/api/entities/${encodeURIComponent(entity)}/${encodeURIComponent(id)}/support` : null);
}

export interface CompanyProfile {
  company: string; address: string; taxId: string; email: string; bank: string; account: string;
  ifsc: string; swift: string; paymentTerms: string; invoiceTerms: string;
}
/** Company identity for print and sign-in; never substituted with invented values. */
export function useCompanyProfile() {
  return useScopedResource<CompanyProfile>('/api/company-profile');
}

export interface ProcessEvent { time: string; text: string; tone: 'info' | 'ok' | 'warn' | 'danger'; step?: number; progress?: number }
export interface ProcessRunResult { row: Row; events: ProcessEvent[] }
/** Runs a batch process on the server with the page parameters; the server computes and creates the row. */
export function useProcessRunner(entity: string) {
  const api = useApi();
  return useCallback((params: Partial<Row>) => api<ProcessRunResult>(`/api/processes/${encodeURIComponent(entity)}/run`, { method: 'POST', body: JSON.stringify(params) }), [api, entity]);
}
