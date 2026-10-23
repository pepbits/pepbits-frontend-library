import type {Meta} from './types';
/**
 * Registry display copy that goes through the catalog. scripts/rcm/copy.mjs collects the same key set from the generated registry
 * (a test keeps the two lists equal). Codes, `key`/`value`, currencies, identities and business records are never translated.
 */
export const DEFINITION_TEXT_KEYS=['label','singular','summary','help','placeholder','short','hint','title','resourceLabel','statusLabel','amountLabel','balanceLabel','dueLabel'] as const;
const display=new Set<string>(DEFINITION_TEXT_KEYS);
/** A copy of registry-shaped data whose display strings are translated by `t()`; an unknown string comes back unchanged. */
export function localizeRcmDefinitions<T>(value:T,t:(message:string)=>string,key=''):T{
 if(Array.isArray(value))return value.map(v=>localizeRcmDefinitions(v,t)) as T;
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,localizeRcmDefinitions(v,t,k)])) as T;
 return (typeof value==='string'&&value&&display.has(key)?t(value):value) as T;
}
/** Translate registry display copy only. User identities, codes, currencies and business records remain untouched. */
export function localizeRcmMetadata(meta:Meta,t:(message:string)=>string):Meta{
 return {...meta,resources:localizeRcmDefinitions(meta.resources,t),categories:localizeRcmDefinitions(meta.categories,t),branches:localizeRcmDefinitions(meta.branches,t)};
}
