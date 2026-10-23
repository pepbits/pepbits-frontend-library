'use client';
import {useMemo} from 'react';
import {useJsonRequest,useScopeMemory,useScopedResource,type JsonRequest} from '@pepbits/patterns/resources';
import type {Filters,ListResponse,Row} from './types';
export {useFetch,useStoredState,useScopedResource,useScopeMemory,useViewMemory} from '@pepbits/patterns/resources';
export type {ResourceStatus} from '@pepbits/patterns/resources';
export const useApi=useJsonRequest;
export type RequestFn=JsonRequest;
const withJson=(init?:RequestInit)=>({...init,headers:{'Content-Type':'application/json',...init?.headers}});
export interface ListParams {
  q?: string;
  page?: number;
  size?: number;
  sort?: string;
  dir?: 'asc' | 'desc';
  filters?: Filters;
  facet?: string;
  asOf?: string;
  period?: string;
}

export function listUrl(entity: string, p: ListParams = {}) {
  const sp = new URLSearchParams();
  if (p.q) sp.set('q', p.q);
  if (p.page) sp.set('page', String(p.page));
  if (p.size) sp.set('size', String(p.size));
  if (p.sort) { sp.set('sort', p.sort); sp.set('dir', p.dir ?? 'asc'); }
  if (p.filters && Object.keys(p.filters).length) sp.set('filters', JSON.stringify(p.filters));
  if (p.facet) sp.set('facet', p.facet);
  if (p.asOf) sp.set('asOf', p.asOf);
  if (p.period) sp.set('period', p.period);
  return `/api/entities/${entity}?${sp.toString()}`;
}

const periodQuery = (period?: string) => (period ? `?period=${encodeURIComponent(period)}` : '');
const seg = (v: string) => encodeURIComponent(v);

/** Entity API bound to one host request closure. */
export function createEntityApi(request: RequestFn) {
  const api = <T,>(url: string, init?: RequestInit) => request<T>(url, withJson(init));
  return {
    list: (entity: string, p?: ListParams) => api<ListResponse>(listUrl(entity, p)),
    get: (entity: string, id: string, period?: string) => api<Row>(`/api/entities/${seg(entity)}/${seg(id)}${periodQuery(period)}`),
    create: (entity: string, body: Partial<Row>) => api<Row>(`/api/entities/${seg(entity)}`, { method: 'POST', body: JSON.stringify(body) }),
    update: (entity: string, id: string, body: Partial<Row>, period?: string) => api<Row>(`/api/entities/${seg(entity)}/${seg(id)}${periodQuery(period)}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (entity: string, id: string) => api<{ deleted: string }>(`/api/entities/${seg(entity)}/${seg(id)}`, { method: 'DELETE' }),
  };
}
export type EntityApi = ReturnType<typeof createEntityApi>;

/** Replaces the source `entityApi` singleton: one API per host request closure. */
export function useEntityApi(): EntityApi {
  const request = useJsonRequest();
  return useMemo(() => createEntityApi(request), [request]);
}


export function useRefOptions(entity?:string){const resource=useScopedResource<ListResponse>(entity?listUrl(entity,{size:1000}):null);return useMemo(()=>resource.data?.rows.map(r=>String(r.name??r.code??r.id))??[],[resource.data]);}
export function rememberIds(memory:Map<string,unknown>,slug:string,ids:string[]){memory.set('ids.'+slug,ids);}
export function useNeighbours(slug:string,id?:string){const memory=useScopeMemory(),ids=(memory.get('ids.'+slug) as string[]|undefined)??[],index=id?ids.indexOf(id):-1;return {index,total:ids.length,prev:index>0?ids[index-1]:null,next:index>=0&&index<ids.length-1?ids[index+1]:null};}
