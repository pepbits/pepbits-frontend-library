"use client";
import React, {Suspense,lazy,useMemo} from "react";
import {useSession} from "@pepbits/auth";
import {REFERENCE_PAGE_BY_ID,referenceNavigationTarget,referenceInternalPath,type ReferenceModuleId} from "@pepbits/erp-config";
import {useERP,useProduct} from "@pepbits/erp-shell";
import {useNavigation,type NavigationTarget} from "@pepbits/platform-ports";
import {LocalizedText} from "@pepbits/ops-ui";
import {createReferenceTransport,referenceScopeKey,type ReferenceHost} from "@pepbits/reference-host";
import {useProductRequest} from "../product-services";
const Reports=lazy(()=>import('@pepbits/reference-reports').then(m=>({default:m.ReferenceReportsModule})));
const Erp1=lazy(()=>import('@pepbits/reference-erp1').then(m=>({default:m.ReferenceErp1Module})));
const Erp2=lazy(()=>import('@pepbits/reference-erp2').then(m=>({default:m.ReferenceErp2Module})));
const School=lazy(()=>import('@pepbits/reference-school').then(m=>({default:m.ReferenceSchoolModule})));
const schoolRoles:Readonly<Record<string,string>>={'enterprise-admin':'admin','finance-manager':'accountant','operations-analyst':'teacher','school-admin':'admin','school-teacher':'teacher','school-student':'student','school-parent':'parent','school-librarian':'librarian','school-accountant':'accountant'};
/** The host supplies authentication, policies and navigation; modules import only public contracts. */
export function ReferenceModuleLibraryPage({pageId,target}:{pageId:string;target:NavigationTarget}){
 const descriptor=REFERENCE_PAGE_BY_ID[pageId],{user,status}=useSession(),erp=useERP(),product=useProduct(),navigation=useNavigation(),request=useProductRequest();
 // Next preserves encoded slashes in route parameters. Decode the module path once;
 // desktop targets already contain the plain internal path.
 const internalPath=referenceInternalPath(target.recordId);
 const path=internalPath?.startsWith('/')?internalPath:descriptor?.path??'/';
 const host=useMemo<ReferenceHost|null>(()=>{
  if(!user||!descriptor)return null;
  const moduleId=descriptor.moduleId as ReferenceModuleId,variant=descriptor.variant;
  const transport=createReferenceTransport({namespace:'/reference-modules/'+variant,applicationId:product.id,branchId:erp.branch,fetch:request,failureMessage:()=>erp.t('reference.modules.requestFailed')});
  const navigate=(internalPath:string)=>navigation.open(referenceNavigationTarget(moduleId,internalPath));
  const roles=[user.role];const schoolRole=schoolRoles[user.role];if(schoolRole)roles.push(schoolRole,'school:'+schoolRole);
  return {scope:{moduleId,tenantId:user.tenantId,applicationId:product.id,branchId:erp.branch,userId:user.id,roles},preferences:erp.preferences,preferenceHost:{preferences:erp.preferences,preferencePolicy:erp.preferencePolicy,preferencesAvailable:erp.preferencesAvailable,onPreferenceChange:erp.updatePreference},path,navigate,hrefFor:(internalPath:string)=>navigation.hrefFor(referenceNavigationTarget(moduleId,internalPath)),href:(internalPath:string)=>navigation.hrefFor(referenceNavigationTarget(moduleId,internalPath)),openInNewContext:(internalPath:string)=>navigation.openInNewContext(referenceNavigationTarget(moduleId,internalPath)),fetch:transport.fetch,request:transport.request};
 },[user,descriptor,erp.branch,erp.preferences,erp.preferencePolicy,erp.preferencesAvailable,erp.updatePreference,erp.t,product.id,navigation,request,path]);
 if(!host||status!=='authenticated'||!erp.preferencesAvailable)return <p role="status"><LocalizedText message="reference.modules.loading"/></p>;
 const Component=descriptor.variant==='reports'?Reports:descriptor.variant==='erp1'?Erp1:descriptor.variant==='erp2'?Erp2:School;
 return <Suspense fallback={<p role="status"><LocalizedText message="reference.modules.loading"/></p>}><Component key={referenceScopeKey(host.scope)} path={path} host={host}/></Suspense>;
}
