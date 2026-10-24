import {FileQuestion} from '@pepbits/icons';
import {defineProduct,type ShellNavigation} from '@pepbits/shell';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import {PAGES,SECTIONS} from './modules/keystone/catalog';
import {matchReferencePath} from './modules/keystone/routes';
import {pagePath} from './modules/keystone/registry';
import {API_PRODUCT} from './adapters/http';
export type Variant='erp1'|'erp2';
export type ErpTarget=NavigationTarget&{query?:string};
export const pageId=(variant:Variant,def:{section:string;slug:string})=>`${variant}-${def.section}-${def.slug}`;
export const pages:PageDefinition[]=[...(['erp1','erp2'] as const).flatMap(variant=>PAGES.map(def=>({id:pageId(variant,def),title:def.title,subtitle:def.description,kind:'keystone',module:variant,entity:def.entity,ai:{enabled:false,useCases:[]}}))),{id:'preferences',title:'Preferences',subtitle:'',kind:'preferences',module:'shared'}];
const navigation:ShellNavigation={defaultModule:'erp1',pages:Object.fromEntries(pages.map(p=>[p.id,p])),modules:Object.fromEntries((['erp1','erp2'] as const).map(variant=>[variant,{id:variant,label:variant.toUpperCase(),shortLabel:variant.toUpperCase(),description:'Keystone fictional ERP workflows',icon:FileQuestion,accent:'var(--primary)',navigation:[...new Set(PAGES.map(p=>p.section))].map(section=>({id:variant+'-'+section,label:SECTIONS.find(s=>s.key===section)!.label,items:PAGES.filter(p=>p.section===section).map(def=>({id:pageId(variant,def),pageId:pageId(variant,def),label:def.title}))}))}]))};
// The shell gates the session and eligible roles; EntityAccess narrows writes to
// the current entity's grants without overriding any shell denial.
const writeRoles=['admin','enterprise-admin','operations','operations-analyst','finance','finance-manager','accountant'];
export const product=defineProduct({id:API_PRODUCT,name:'ERP',tagline:'Fictional financial demonstration',navigation,defaultModule:'erp1',enabledModules:['erp1','erp2'],access:{actions:{create:writeRoles,edit:writeRoles,delete:writeRoles,export:['admin','enterprise-admin','operations','operations-analyst'],archive:[]}}});
export const erpProductForRole=(_role:string)=>product;
export function targetFromPath(pathname:string,query=''):ErpTarget {
 if(pathname==='/preferences')return {pageId:'preferences'};
 if(pathname==='/'||pathname==='/login')return {pageId:pageId('erp1',PAGES[0]!)};
 const match=pathname.match(/^\/(erp1|erp2)(\/.*)?$/);if(!match)return {pageId:'not-found'};
 const variant=match[1] as Variant;
 try{if(pathname.split('/').some(s=>/[\\/?#]/.test(decodeURIComponent(s))))return {pageId:'not-found'};}catch{return {pageId:'not-found'};}
 const route=matchReferencePath((match[2]||'/')+(query?'?'+query:''),{records:variant==='erp2',pages:PAGES});
 if(route.kind==='login')return {pageId:pageId(variant,PAGES[0]!)};
 if(route.kind==='notfound')return {pageId:'not-found'};
 if(route.kind==='record'&&!recordAllowed(route.def.template,route.mode))return {pageId:'not-found'};
 return {pageId:pageId(variant,route.def),query,...(route.kind==='record'?{recordId:route.id,mode:route.mode}:{})};
}
export function recordAllowed(template:string,mode:string){return !['dashboard','matrix','ledger','report','settings'].includes(template)&&(!['print','inbox'].includes(template)||mode==='view')&&(template!=='process'||mode!=='edit');}
export function hrefFor(target:ErpTarget){if(target.pageId==='preferences')return '/preferences';const page=pages.find(p=>p.id===target.pageId),def=PAGES.find(d=>pageId(page?.module as Variant,d)===target.pageId);if(!def||!page)return '/not-found';return '/'+page.module+pagePath(def)+(target.mode==='new'?'/new':target.recordId?'/'+encodeURIComponent(target.recordId)+(target.mode==='edit'?'/edit':''):'')+(target.query?'?'+target.query:'');}
