'use client';
import React, {type ComponentType} from 'react';
import {EmptyState, PresentationProvider} from '@pepbits/components';
import {DashboardSkeleton, FormSkeleton, TableSkeleton} from '@pepbits/ui';
import {usePreferences} from '@pepbits/preferences/react';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import type {PageDefinition} from '../types';
import {WorklistPage, type WorklistPageProps} from '../worklist';
import {DynamicRecordForm, type DynamicRecordFormProps} from '../forms';
import {ConfiguredTemplatePage, type ConfiguredTemplatePageProps} from '../templates';

export interface PageRenderContext {page:PageDefinition;target:NavigationTarget}
export type PageRenderers = Readonly<Record<string, ComponentType<PageRenderContext>>>;
export function UnsupportedPage() {
  return <EmptyState title="Unsupported page" description="No renderer is registered for this page."/>;
}
export function SkeletonFor({kind}:{kind:string}) {
  if(kind==='dashboard')return <DashboardSkeleton/>;
  if(kind==='template'||kind==='form'||kind==='billing')return <FormSkeleton/>;
  return <TableSkeleton/>;
}
/** Definitions have already passed the host's route/access checks. Template ID registrations win over kind. */
export function createPageRenderer({renderers,templates={}}:{renderers:PageRenderers;templates?:PageRenderers}) {
  const kinds={...renderers},ids={...templates};
  return function PageRenderer({page,target={pageId:page.id}}:{page:PageDefinition;target?:NavigationTarget}) {
    const {preferences}=usePreferences();
    const id=page.templateDefinition?.id??page.templateId;
    const Renderer=id&&Object.hasOwn(ids,id)?ids[id]:Object.hasOwn(kinds,page.kind)?kinds[page.kind]:undefined;
    return <PresentationProvider value={preferences}><div data-page-id={page.id} className="contents">
      {Renderer?<Renderer page={page} target={target}/>:<UnsupportedPage/>}
    </div></PresentationProvider>;
  };
}
export interface EngineRegistrations {
  worklist?:(context:PageRenderContext)=>Omit<WorklistPageProps,'page'>;
  form?:(context:PageRenderContext)=>Omit<DynamicRecordFormProps,'page'|'target'>;
  template?:(context:PageRenderContext)=>Omit<ConfiguredTemplatePageProps,'page'|'target'>;
}
/** Only engines configured by the host are registered. No application pages or module registry. */
export function createEngineRenderers(options:EngineRegistrations):PageRenderers {
  const renderers:Record<string,ComponentType<PageRenderContext>>={};
  if(options.form)renderers.form=context=><DynamicRecordForm {...options.form!(context)} {...context}/>;
  if(options.worklist)renderers.worklist=context=>context.target.mode&&options.form
    ?<DynamicRecordForm {...options.form(context)} {...context}/>
    :<WorklistPage {...options.worklist!(context)} page={context.page}/>;
  if(options.template)renderers.template=context=><ConfiguredTemplatePage {...options.template!(context)} {...context}/>;
  return renderers;
}
