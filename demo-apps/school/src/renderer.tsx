'use client';
import React,{useMemo} from 'react';
import {createPageRenderer,type PageRenderContext} from '@pepbits/page-engines/renderer';
import {AccessDenied,NotFoundState} from '@pepbits/components';
import {PreferencesPage} from '@pepbits/shell/preferences-page';
import {useSession} from '@pepbits/platform/auth';
import {useNavigation} from '@pepbits/platform/navigation';
import {usePreferences} from '@pepbits/preferences/react';
import {useRequest} from './adapters/http';
import {createSchoolRequest} from './adapters/school';
import {ReferenceSchoolModule} from './modules/school';
import {useSettingsServices} from './providers';
import {pages,grantedRoles,viewForRole,hrefFor,targetFromPath,type SchoolTarget} from './navigation';
import {schoolRoleView} from './modules/school/role-views';
function Settings(){return <PreferencesPage showTabPreferences={false} services={useSettingsServices()}/>;}
function Scholaris({target={pageId:'school-dashboard'}}:PageRenderContext){
 const {user}=useSession(),settings=usePreferences(),request=useRequest(),navigation=useNavigation();
 const roles=grantedRoles(user!),requested=schoolRoleView(target.moduleId)?.role,role=requested&&roles.includes(requested)?requested:roles[0];
 const moduleId=role?viewForRole(role).id:'school-unavailable';
 const scoped=useMemo(()=>createSchoolRequest(request,moduleId,user!.branch),[request,moduleId,user?.branch]);
 const path=hrefFor({...target,moduleId});
 const host=useMemo(()=>({scope:{moduleId,tenantId:user!.tenantId,applicationId:'nexora',branchId:user!.branch,userId:user!.id,roles:role?['school:'+role]:[]},preferences:settings.preferences,preferenceHost:{preferences:settings.preferences,preferencePolicy:settings.preferencePolicy,preferencesAvailable:settings.preferencesAvailable,onPreferenceChange:<K extends keyof typeof settings.preferences>(key:K,value:typeof settings.preferences[K])=>{void settings.update({[key]:value});}},request:scoped,navigate:(internal:string)=>navigation.open({...targetFromPath(internal.split('?')[0]!,internal.split('?')[1]??''),moduleId}),hrefFor:(internal:string)=>hrefFor({...targetFromPath(internal.split('?')[0]!,internal.split('?')[1]??''),moduleId})}),[moduleId,user,role,settings,scoped,navigation]);
 return role?<ReferenceSchoolModule host={host} path={path}/>:<AccessDenied/>;
}
const Renderer=createPageRenderer({renderers:{scholaris:Scholaris,preferences:Settings}});
export function SchoolPage({target}:{target:SchoolTarget}){const page=pages.find(page=>page.id===target.pageId);return page?<Renderer page={page} target={target}/>:<NotFoundState/>;}
