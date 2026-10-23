'use client';
import React, {useMemo} from 'react';
import {useSession} from '@pepbits/platform/auth';
import {useNavigation} from '@pepbits/platform/navigation';
import {usePreferences} from '@pepbits/preferences/react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {useRequest} from '../../adapters/http';
import {createPharmacyTransport} from '../../adapters/pharmacy';
import {hrefFor,pharmacyPages,targetFromPath,type HealthcareTarget} from '../../navigation';
import {ReferencePharmacyModule} from './module';
import type {ReferenceHost} from './host';
export function PharmacyPage({page,target}:PageRenderContext){
 const request=useRequest(),{user}=useSession(),preference=usePreferences(),navigation=useNavigation();
 const definition=pharmacyPages.find(p=>p.id===page.id)!,query=(target as HealthcareTarget).query;
 const path=definition.path+(query?'?'+query:'');
 const transport=useMemo(()=>createPharmacyTransport(request,user!.branch),[request,user!.branch]);
 const host=useMemo<ReferenceHost>(()=>{
  const route=(destination:string)=>{const [p,q]=destination.split('?');return targetFromPath('/pharmacy'+(p==='/'?'':p),q);};
  return {scope:{tenantId:user!.tenantId,applicationId:'nexora',branchId:user!.branch,moduleId:'reference-pharmacy',userId:user!.id,roles:[user!.role]},
   preferences:preference.preferences,preferenceHost:{...preference,onPreferenceChange:(key,value)=>void preference.update({[key]:value})},path,
   request:transport,navigate:p=>navigation.open(route(p)),hrefFor:p=>hrefFor(route(p))};
 },[transport,user,preference,path,navigation]);
 return <ReferencePharmacyModule path={path} host={host}/>;
}
