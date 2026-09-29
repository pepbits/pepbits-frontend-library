"use client";
import React, {Suspense,lazy,useMemo} from "react";
import {useSession} from "@pepbits/auth";
import {REFERENCE_PAGE_BY_ID,referenceNavigationTarget,referenceInternalPath,schoolRoleView,moduleContainsPage,type ReferenceModuleId} from "@pepbits/erp-config";
import {useERP,useProduct} from "@pepbits/erp-shell";
import {useNavigation,type NavigationTarget} from "@pepbits/platform-ports";
import {AccessDenied,LocalizedText} from "@pepbits/ops-ui";
import {createReferenceTransport,referenceScopeKey,type ReferenceHost} from "@pepbits/reference-host";
import {useProductRequest} from "../product-services";
const Reports=lazy(()=>import('@pepbits/reference-reports').then(m=>({default:m.ReferenceReportsModule})));
const Erp1=lazy(()=>import('@pepbits/reference-erp1').then(m=>({default:m.ReferenceErp1Module})));
const Erp2=lazy(()=>import('@pepbits/reference-erp2').then(m=>({default:m.ReferenceErp2Module})));
const HealthcareSuite=lazy(()=>import('@pepbits/reference-healthcare-suite').then(m=>({default:m.ReferenceHealthcareSuiteModule})));
const School=lazy(()=>import('@pepbits/reference-school').then(m=>({default:m.ReferenceSchoolModule})));
const schoolRoles:Readonly<Record<string,string>>={'enterprise-admin':'admin','finance-manager':'accountant','operations-analyst':'teacher','school-admin':'admin','school-teacher':'teacher','school-student':'student','school-parent':'parent','school-librarian':'librarian','school-accountant':'accountant'};
/** The host supplies authentication, policies and navigation; modules import only public contracts. */
export function ReferenceModuleLibraryPage({pageId,target}:{pageId:string;target:NavigationTarget}){
 const descriptor=REFERENCE_PAGE_BY_ID[pageId],{user,status}=useSession(),erp=useERP(),product=useProduct(),navigation=useNavigation(),request=useProductRequest();
 // Next preserves encoded slashes in route parameters. Decode the module path once;
 // desktop targets already contain the plain internal path.
 const internalPath=referenceInternalPath(target.recordId);
 const rawPath=internalPath?.startsWith('/')?internalPath:descriptor?.path??'/';
 const selectedModule=target.moduleId ?? (descriptor?.variant==='school'?erp.currentModule:descriptor?.moduleId);
 const view=schoolRoleView(selectedModule);
 const path=descriptor?.variant==='school' && view ? (()=>{const [pathname,query]=rawPath.split('?');const params=new URLSearchParams(query);params.set('role',view.role);return pathname+'?'+params;})():rawPath;
 const host=useMemo<ReferenceHost|null>(()=>{
  if(!user||!descriptor||!selectedModule||!moduleContainsPage(product,selectedModule,pageId))return null;
  const moduleId=selectedModule as ReferenceModuleId,variant=descriptor.variant;
  const transport=createReferenceTransport({namespace:'/reference-modules/'+variant,moduleId,applicationId:product.id,branchId:erp.branch,fetch:request,failureMessage:()=>erp.t('reference.modules.requestFailed')});
  const navigate=(internalPath:string)=>navigation.open(referenceNavigationTarget(moduleId,internalPath));
  const schoolRole=view?.role ?? schoolRoles[user.role];
  const roles=variant==='school'&&schoolRole?['school:'+schoolRole]:[user.role];
  return {scope:{moduleId,tenantId:user.tenantId,applicationId:product.id,branchId:erp.branch,userId:user.id,roles},preferences:erp.preferences,preferenceHost:{preferences:erp.preferences,preferencePolicy:erp.preferencePolicy,preferencesAvailable:erp.preferencesAvailable,onPreferenceChange:erp.updatePreference},path,navigate,hrefFor:(internalPath:string)=>navigation.hrefFor(referenceNavigationTarget(moduleId,internalPath)),href:(internalPath:string)=>navigation.hrefFor(referenceNavigationTarget(moduleId,internalPath)),openInNewContext:(internalPath:string)=>navigation.openInNewContext(referenceNavigationTarget(moduleId,internalPath)),fetch:transport.fetch,request:transport.request};
 },[user,descriptor,selectedModule,view,product,pageId,erp.branch,erp.preferences,erp.preferencePolicy,erp.preferencesAvailable,erp.updatePreference,erp.t,product.id,navigation,request,path]);
 if(status==='authenticated'&&erp.preferencesAvailable&&selectedModule&&!moduleContainsPage(product,selectedModule,pageId))return <AccessDenied title="Page unavailable for your role" description="Your account does not have access to this page."/>;
 if(!host||status!=='authenticated'||!erp.preferencesAvailable)return <p role="status"><LocalizedText message="reference.modules.loading"/></p>;
 const Component=descriptor.variant==='reports'?Reports:descriptor.variant==='erp1'?Erp1:descriptor.variant==='erp2'?Erp2:descriptor.variant==='healthcare-suite'?HealthcareSuite:School;
 return <Suspense fallback={<p role="status"><LocalizedText message="reference.modules.loading"/></p>}><Component key={referenceScopeKey(host.scope)} path={path} host={host}/></Suspense>;
}
