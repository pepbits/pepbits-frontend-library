'use client';
import React, {useMemo} from 'react';
import {useSession} from '@pepbits/platform/auth';
import {useNavigation} from '@pepbits/platform/navigation';
import {usePreferences} from '@pepbits/preferences/react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {useRequest} from '../../adapters/http';
import {createQualityTransport} from '../../adapters/quality';
import {hrefFor,qualityPages,targetFromPath,type HealthcareTarget} from '../../navigation';
import {ReferenceQualityModule} from './module';
import type {ReferenceHost} from './host';
export function QualityPage({page,target}:PageRenderContext){
 const request=useRequest(),{user}=useSession(),preference=usePreferences(),navigation=useNavigation();
 const definition=qualityPages.find(p=>p.id===page.id)!,query=(target as HealthcareTarget).query;
 const path=((target as HealthcareTarget).qualityPath??definition.path)+(query?'?'+query:'');
 const transport=useMemo(()=>createQualityTransport(request,user!.branch),[request,user!.branch]);
 const host=useMemo<ReferenceHost>(()=>{
  const route=(destination:string)=>{const [p,q]=destination.split('?');return targetFromPath('/quality'+(p==='/'?'':p),q);};
  return {scope:{tenantId:user!.tenantId,applicationId:'nexora',branchId:user!.branch,moduleId:'reference-quality',userId:user!.id,roles:[user!.role]},
   preferences:preference.preferences,preferenceHost:{...preference,onPreferenceChange:(key,value)=>void preference.update({[key]:value})},path,
   request:transport.request,fetch:transport.fetch,navigate:p=>navigation.open(route(p)),hrefFor:p=>hrefFor(route(p))};
 },[transport,user,preference,path,navigation]);
 return <ReferenceQualityModule path={path} host={host}/>;
}
