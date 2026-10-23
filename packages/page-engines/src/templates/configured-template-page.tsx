"use client";
import React,{useEffect,useMemo,useState} from 'react';
import {AccessDenied,ErrorState,LoadingState,RecoveryNotice,failureFromError} from '@pepbits/components';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import type {PageDefinition,PageTemplateDefinition,TemplateDocument} from '../types';
import {PageTemplateWorkspace} from './page-template';
import type {TemplateScope,PageTemplateAdapter} from './template-state';
export interface ConfiguredTemplatePageProps {
 page:PageDefinition;target:NavigationTarget;adapter?:PageTemplateAdapter;
 identity:{tenantId:string;applicationId:string;userId:string}|null;
 definitions?:Readonly<Record<string,PageTemplateDefinition>>;
}
/** The host supplies both the verified identity and the authorized template catalogue. */
export function ConfiguredTemplatePage({page,target,adapter,identity,definitions}:ConfiguredTemplatePageProps) {
 const host=useScreenHost(),definition=page.templateDefinition??definitions?.[page.templateId??''];
 const scope=useMemo<TemplateScope>(()=>({...identity??{tenantId:'',applicationId:'',userId:''},pageId:page.id,recordId:target.recordId??'new'}),[identity?.tenantId,identity?.applicationId,identity?.userId,page.id,target.recordId]);
 if(!identity)return <AccessDenied/>;
 if(!definition||!adapter?.load)return <ErrorState title="template.integration" description="template.adapterHelp"/>;
 return <ConnectedEditor key={JSON.stringify([scope,definition.id])} scope={scope} definition={definition} adapter={adapter} readOnly={target.mode==='view'||!host.can(target.mode==='new'?'create':'edit',page)}/>;
}
function ConnectedEditor({scope,definition,adapter,readOnly}:{scope:TemplateScope;definition:PageTemplateDefinition;adapter:PageTemplateAdapter;readOnly:boolean}) {
 const [document,setDocument]=useState<TemplateDocument|null>(null),[error,setError]=useState<unknown>(null),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;setDocument(null);setError(null);void adapter.load!(scope,definition.id).then(value=>{if(!active)return;if((scope.recordId!=='new'&&value.id!==scope.recordId)||typeof value.id!=='string'||!value.id||!Number.isSafeInteger(value.version)||value.version<0||!value.values||!Array.isArray(value.lines)||!Array.isArray(value.rows)){setError({status:502});return;}setDocument(value);}).catch(failure=>{if(active)setError(failure);});return()=>{active=false;};},[scope,definition,adapter,revision]);
 if(error)return <RecoveryNotice failure={failureFromError(error)} onRetry={()=>setRevision(value=>value+1)}/>;
 if(!document)return <LoadingState/>;
 return <PageTemplateWorkspace definition={definition} scope={{...scope,recordId:document.id}} initialDocument={document} adapter={adapter} readOnly={readOnly}/>;
}
