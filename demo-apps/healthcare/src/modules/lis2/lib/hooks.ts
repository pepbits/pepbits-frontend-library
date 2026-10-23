'use client';
import {usePreference} from '@pepbits/preferences/react';
import {useDiagnosticResource} from '../../diagnostics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {type Paged} from './api';

/** Read hooks share transport cancellation and stale-response fencing. */
export function useList<T=any>(path:string|null,filters:Record<string,any>,_deps:any[]=[]){return useDiagnosticResource<Paged<T>>(path,filters);}
export function useResource<T=any>(path:string|null,_deps:any[]=[]){return useDiagnosticResource<T>(path);}

/** Filter state with page reset whenever a filter other than page changes. */
export function useFilters<T extends Record<string, any>>(initial: T) {
  const setting=usePreference('pageSize');
  const [f,setF]=useState<T & {page:number}>({page:1,...initial,pageSize:setting.value});
  const size='pageSize' in initial?setting.value:undefined;
  useEffect(()=>{if(size!==undefined)setF(cur=>({...cur,page:1,pageSize:size}));},[size]);
  const set=useCallback((patch:Partial<T & {page:number}>)=>{
    if('pageSize' in patch){if(setting.locked)return;void setting.update({pageSize:patch.pageSize as 10|20|50|100});}
    setF(cur=>({...cur,...patch,...(size!==undefined?{pageSize:size}:{}),page:'page' in patch?patch.page!:1}));
  },[setting,size]);
  return [{...f,...(size!==undefined?{pageSize:size}:{})},set] as const;
}

/** Debounced value for search boxes. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!ms) return;
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [ms]);
}
