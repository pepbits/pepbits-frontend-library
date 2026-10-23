'use client';
import { useCallback, useEffect, useState } from 'react';
import { qs, useApiRuntime } from './api';
import type { Option } from './types';
/** Invalidating a lookup only affects this authenticated module instance. */
export function useLookupInvalidation() { const {cache} = useApiRuntime(); return useCallback(() => cache.clear(), [cache]); }
export function useLookup(entity: string, params: Record<string,string | undefined> | null) {
  const {api, cache} = useApiRuntime();
  const key = params ? JSON.stringify(params) : null;
  const [options,setOptions] = useState<Option[]>([]);
  const [loading,setLoading] = useState(false);
  useEffect(() => {
    if (key === null) {setOptions([]);return;}
    let live = true; setLoading(true);
    const url = `/lookups/${entity}${qs(JSON.parse(key))}`;
    if (!cache.has(url)) cache.set(url, api<Option[]>(url).catch(error=>{cache.delete(url);throw error;}));
    cache.get(url)!.then(data=>{if(live)setOptions(data);}).catch(()=>{if(live)setOptions([]);}).finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false;};
  }, [api, cache, entity, key]);
  return {options,loading};
}
