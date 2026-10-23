'use client';
import React, {useMemo} from 'react';
import {useSession} from '@pepbits/platform/auth';
import {useNavigation} from '@pepbits/platform/navigation';
import {usePreferences} from '@pepbits/preferences/react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {useRequest} from '../../adapters/http';
import {createDiagnosticTransport} from '../../adapters/diagnostics';
import {diagnosticPages, hrefFor, targetFromPath, type HealthcareTarget} from '../../navigation';
import {DiagnosticModule as Lis1} from '../lis1/module';
import {DiagnosticModule as Lis2} from '../lis2/module';
import {DiagnosticModule as Ris1} from '../ris1/module';
import type {ReferenceHost} from './host';
export function DiagnosticPage({page,target}:PageRenderContext){
 const request=useRequest(),{user}=useSession(),{preferences}=usePreferences(),navigation=useNavigation();
 const definition=diagnosticPages.find(p=>p.id===page.id)!,variant=definition.variant;
 const specific=target as HealthcareTarget,path=(specific.diagnosticPath??definition.path)+(specific.query?'?'+specific.query:'');
 const fetch=useMemo(()=>createDiagnosticTransport(request,variant,user!.branch),[request,variant,user!.branch]);
 const host=useMemo<ReferenceHost>(()=>{
  const route=(destination:string)=>{const [p,q]=destination.split('?');return targetFromPath('/'+variant+(p==='/'?'':p),q);};
  return {scope:{tenantId:user!.tenantId,applicationId:'nexora',branchId:user!.branch,moduleId:definition.module,userId:user!.id,roles:[user!.role]},preferences,path,
   fetch,navigate:p=>navigation.open(route(p)),hrefFor:p=>hrefFor(route(p)),openInNewContext:p=>navigation.openInNewContext(route(p))};
 },[fetch,user,preferences,path,variant,definition.module,navigation]);
 const Component={lis1:Lis1,lis2:Lis2,ris1:Ris1}[variant];return <Component path={path} host={host}/>;
}
