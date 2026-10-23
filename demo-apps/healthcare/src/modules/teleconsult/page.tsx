'use client';
import React,{useMemo} from 'react';
import {useSession} from '@pepbits/platform/auth';
import {useNavigation} from '@pepbits/platform/navigation';
import {usePreferences} from '@pepbits/preferences/react';
import {NotFoundState} from '@pepbits/components';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {useRequest} from '../../adapters/http';
import {createTeleconsultTransport} from '../../adapters/teleconsult';
import {hrefFor,targetFromPath,type HealthcareTarget} from '../../navigation';
import {teleconsultPages} from './navigation';
import {ReferenceTeleconsultProviderModule} from './provider/module';
import {ReferenceTeleconsultPatientModule} from './patient/module';
import type {ReferenceHost} from './host';
export function TeleconsultPage({page,target}:PageRenderContext){
 const request=useRequest(),{user}=useSession(),preference=usePreferences(),navigation=useNavigation();
 const definition=teleconsultPages.find(p=>p.id===page.id)!,variant=definition.variant,query=(target as HealthcareTarget).query;
 const path=((target as HealthcareTarget).teleconsultPath??definition.path)+(query?'?'+query:'');
 const transport=useMemo(()=>createTeleconsultTransport(request,variant,user!.branch),[request,variant,user!.branch]);
 const host=useMemo<ReferenceHost>(()=>{
  const route=(destination:string)=>{const [p,q]=destination.split('?');return targetFromPath('/teleconsult-'+variant+(p==='/'?'':p),q);};
  return {scope:{tenantId:user!.tenantId,applicationId:'nexora',branchId:user!.branch,moduleId:'reference-teleconsult-'+variant,userId:user!.id,roles:[user!.role]},preferences:preference.preferences,preferenceHost:{...preference,onPreferenceChange:(key,value)=>void preference.update({[key]:value})},path,fetch:transport,navigate:p=>navigation.open(route(p)),hrefFor:p=>hrefFor(route(p))};
 },[transport,user,preference,path,navigation,variant]);
 const allowed=['admin','enterprise-admin',...(variant==='provider'?['teleconsult-doctor','teleconsult-nurse']:['teleconsult-patient'])].includes(user!.role);
 if(!allowed)return <NotFoundState/>;
 const Module=variant==='provider'?ReferenceTeleconsultProviderModule:ReferenceTeleconsultPatientModule;
 return <Module key={variant} path={path} host={host}/>;
}
