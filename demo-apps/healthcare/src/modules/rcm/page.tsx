'use client';
import React, {useMemo} from 'react';
import {useSession} from '@pepbits/platform/auth';
import {useNavigation} from '@pepbits/platform/navigation';
import {usePreferences} from '@pepbits/preferences/react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {useRequest} from '../../adapters/http';
import {createRcmTransport} from '../../adapters/rcm';
import {hrefFor,rcmPages,targetFromPath,type HealthcareTarget} from '../../navigation';
import {ReferenceRcmModule} from './module';
import type {ReferenceHost} from './host';
export function RcmPage({page,target}:PageRenderContext){
 const request=useRequest(),{user}=useSession(),preference=usePreferences(),navigation=useNavigation();
 const definition=rcmPages.find(p=>p.id===page.id)!,query=(target as HealthcareTarget).query;
 const path=definition.path+(query?'?'+query:'');
 const transport=useMemo(()=>createRcmTransport(request,user!.branch),[request,user!.branch]);
 const host=useMemo<ReferenceHost>(()=>{
  const route=(destination:string)=>{const [p,q]=destination.split('?');return targetFromPath('/rcm'+(p==='/'?'':p),q);};
  return {scope:{tenantId:user!.tenantId,applicationId:'nexora',branchId:user!.branch,moduleId:'reference-rcm',userId:user!.id,roles:[user!.role]},
   preferences:preference.preferences,preferenceHost:{...preference,onPreferenceChange:(key,value)=>void preference.update({[key]:value})},path,
   request:transport,navigate:p=>navigation.open(route(p)),hrefFor:p=>hrefFor(route(p))};
 },[transport,user,preference,path,navigation]);
 return <ReferenceRcmModule path={path} host={host}/>;
}
