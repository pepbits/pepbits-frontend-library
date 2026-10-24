import {BookOpen} from '@pepbits/icons';
import {defineProduct,type ShellNavigation,type ProductDefinition} from '@pepbits/shell';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import type {SessionUser} from '@pepbits/platform/auth';
import {schoolPageAvailable} from './modules/school/policy';
import {SCHOOL_ROUTES,matchSchoolRoute} from './modules/school/routes';
import {SCHOOL_ROLE_VIEWS,schoolRoleForHost,schoolRoleView,schoolPathAllowed,type SchoolRole} from './modules/school/role-views';
export type SchoolAccount=SessionUser & {referenceSchoolViews?:readonly string[]};
export type SchoolTarget=NavigationTarget & {query?:string};
export const pageId=(id:string)=>'school-'+id;
export const pages:PageDefinition[]=[...SCHOOL_ROUTES.map(route=>({id:pageId(route.id),title:route.title,subtitle:'',kind:'scholaris',module:'school',ai:{enabled:false,useCases:[]}})),{id:'preferences',title:'Preferences',subtitle:'',kind:'preferences',module:'shared'}];
export function grantedRoles(user:Pick<SchoolAccount,'role'|'referenceSchoolViews'>):SchoolRole[]{
 const own=schoolRoleForHost(user.role),grants=Array.isArray(user.referenceSchoolViews)?user.referenceSchoolViews:[];
 return SCHOOL_ROLE_VIEWS.map(view=>view.role).filter(role=>role===own||grants.includes(role));
}
export const viewForRole=(role:SchoolRole)=>SCHOOL_ROLE_VIEWS.find(view=>view.role===role)!;
export function schoolProductForRole(role:string,user:SchoolAccount={role} as SchoolAccount):ProductDefinition{
 const roles=grantedRoles(user),views=SCHOOL_ROLE_VIEWS.filter(view=>roles.includes(view.role));
 const modules:ShellNavigation["modules"]=Object.fromEntries(views.map(view=>[view.id,{id:view.id,label:view.title,labelKey:view.titleKey,shortLabel:view.shortLabel,shortLabelKey:view.shortLabelKey,description:'Fictional school portal',icon:BookOpen,accent:'var(--primary)',pageIds:SCHOOL_ROUTES.filter(route=>schoolPageAvailable(view.role,route.path)).map(route=>pageId(route.id)),navigation:[...view.groups,{label:'Account',items:[{href:'/settings',label:'Settings'}]}].map(group=>({id:view.id+'-'+group.label,label:group.label,items:group.items.filter(item=>schoolPageAvailable(view.role,item.href)).map(item=>({id:view.id+item.href,pageId:pageId(SCHOOL_ROUTES.find(route=>route.path===item.href)!.id),label:item.label}))}))}]));
 const allowed=pages.filter(page=>page.id==='preferences'||SCHOOL_ROUTES.some(route=>pageId(route.id)===page.id&&roles.some(role=>schoolPageAvailable(role,route.path))));
 // Unknown accounts get a shell with settings and a denied school body; no invented portal grant.
 const fallback={id:'school-unavailable',label:'School',shortLabel:'School',description:'No granted school portal',icon:BookOpen,accent:'var(--primary)',navigation:[]};
 if(!views.length)modules[fallback.id]=fallback;
 const defaultModule=views[0]?.id??fallback.id;
 const navigation:ShellNavigation={defaultModule,modules,pages:Object.fromEntries(allowed.map(page=>[page.id,page]))};
 return defineProduct({navigation,id:'nexora',name:'Scholaris',tagline:'Fictional school workflows',defaultModule,enabledModules:Object.keys(modules)});
}
export function targetFromPath(pathname:string,query=''):SchoolTarget{
 if(pathname==='/preferences')return {pageId:'preferences'};
 try{if(pathname.split('/').some(value=>/[\\/?#]/.test(decodeURIComponent(value))||['.','..'].includes(decodeURIComponent(value))))return {pageId:'not-found'};}catch{return {pageId:'not-found'};}
 const path=pathname==='/login'?'/dashboard':pathname;
 const match=matchSchoolRoute(path+(query?'?'+query:''));
 if(!match)return {pageId:'not-found'};
 const view=SCHOOL_ROLE_VIEWS.find(view=>view.role===match.query.get('role'));
 return {pageId:pageId(match.route.id),...(view?{moduleId:view.id}:{}),...(match.params.id?{recordId:match.params.id}:{}),...(query?{query}:{} )};
}
export function hrefFor(target:SchoolTarget){
 if(target.pageId==='preferences')return '/preferences';
 const route=SCHOOL_ROUTES.find(route=>pageId(route.id)===target.pageId);if(!route)return '/not-found';
 const path=route.path.replace(':id',encodeURIComponent(target.recordId??''));
 const query=new URLSearchParams(target.query),view=schoolRoleView(target.moduleId);if(view)query.set('role',view.role);
 return path+(query.size?'?'+query:'');
}
