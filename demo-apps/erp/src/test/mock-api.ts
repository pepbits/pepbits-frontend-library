import fixtures from './fixtures.json';
import {PAGES} from '../modules/keystone/catalog';
import type {JsonRequest} from '@pepbits/patterns/resources';
import type {Row,ListResponse} from '../modules/keystone/types';
export const fixturePages=fixtures.pages as Record<string,{lookups:any;list:ListResponse|null}>;
export function mockApi(){const views=new Map(),rows=new Map<string,Row[]>();for(const p of PAGES)if(!rows.has(p.entity))rows.set(p.entity,structuredClone(fixturePages[p.section+'/'+p.slug]!.list?.rows??[]));
 const request:JsonRequest=async<T,>(path:string,init?:RequestInit)=>{const url=new URL(path,'http://localhost'),body=init?.body?JSON.parse(String(init.body)):null;let result:unknown;
 if(url.pathname==='/api/lookups')result=fixturePages[url.searchParams.get('page')!]!.lookups;
 else if(url.pathname==='/api/dashboard')result=fixtures.dashboard;
 else if(url.pathname==='/api/view-state'){if(init?.method==='PUT')views.set(body.key,body.value);result={value:views.get(body?.key??url.searchParams.get('key'))??null};}
 else {const m=url.pathname.match(/^\/api\/entities\/([^/]+)(?:\/([^/]+))?(\/support)?$/);if(!m)throw new Error('Unhandled mock path '+path);const entity=decodeURIComponent(m[1]!),id=m[2]?decodeURIComponent(m[2]):null,list=rows.get(entity)??[];
 if(m[3])result={activities:[],documents:[]};else if(init?.method==='POST'){const row={...body,id:'created',version:1};list.unshift(row);result=row;}
 else if(init?.method==='PUT'){const index=list.findIndex(r=>r.id===id);list[index]={...list[index],...body,id,version:2} as Row;result=list[index];}
 else if(id)result=list.find(r=>r.id===id)??list[0];else{const q=url.searchParams.get('q')?.toLowerCase(),filtered=q?list.filter(r=>Object.values(r).join(' ').toLowerCase().includes(q)):list;result={rows:filtered,total:filtered.length,page:1,size:20,facets:{},totals:{}};}}
 return structuredClone(result) as T;};return {request,rows};}
